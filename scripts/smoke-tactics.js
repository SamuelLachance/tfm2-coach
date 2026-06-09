#!/usr/bin/env node
/** Smoke test — TFM2 tactics engine v2 (MOBA rebuild). */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const pub = path.join(ROOT, "public");

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(pub, rel), "utf8"));
}

function makeSandbox(extra = {}) {
  const g = { console, ...extra };
  vm.createContext(g);
  return g;
}

function runFile(g, file) {
  const code = fs.readFileSync(path.join(pub, file), "utf8");
  vm.runInContext(code, g, { filename: file });
}

function assertEnum(tactics, allowed, order) {
  for (const key of order) {
    const val = tactics[key]?.value;
    if (!val) throw new Error(`missing ${key}`);
    if (!allowed[key]?.values.includes(val)) {
      throw new Error(`enum ${key}=${val} not in ${JSON.stringify(allowed[key]?.values)}`);
    }
  }
}

const meta = loadJson("data/tactics-meta.json");
const guide = loadJson("data/tfm2-jungle-tactics-guide.json");
const draftGuide = loadJson("data/tfm2-draft-guide.json");
const champions = loadJson("data/champions.json");
const byName = new Map(champions.champions.map((c) => [c.name, c]));
const metaMap = meta.champions;
const opts = meta.tacticOptions;

const g = makeSandbox();
runFile(g, "match-core.js");
runFile(g, "tfm2-draft-engine.js");
runFile(g, "tfm2-tactics-engine.js");

g.TFM2GuideDraftEngine.setGuideData(draftGuide);
g.TFM2Tactics.setGuide(guide);
g.TFM2Tactics.setTacticOptions(opts);

const T = g.TFM2Tactics;
const ORDER = T.TACTIC_ORDER;

// 1. Sniper shell → Lancer tempo Serpent
const sniperShell = draftGuide.compShells.sniper_front_to_back;
const sniperOur = { ...sniperShell.slots };
const sniperEnemy = {
  Top: "Infanterie lourde",
  Jungle: "Ogre",
  Mid: "Pyromancien",
  Bot: "Archer",
  Support: "Moine",
};
const sniper = T.recommend(sniperOur, sniperEnemy, metaMap, byName);
assertEnum(sniper.tactics, opts, ORDER);
if (sniper.archetype !== "early_serpent_pressure") {
  throw new Error(`sniper shell: expected early_serpent_pressure, got ${sniper.archetype}`);
}
if (sniper.tactics.earlyJungle.value !== "Gank") {
  throw new Error("sniper shell: expected Gank jungle");
}
if (sniper.tactics.earlySerpent.value !== "Toujours Essayer") {
  throw new Error(`sniper shell: expected Toujours Essayer Serpent, got ${sniper.tactics.earlySerpent.value}`);
}
console.log("OK scenario 1 — Sniper/Lancer tempo");

// 2. Porteur + Infanterie — never Engage Fort
const porteur = T.recommend(
  {
    Top: "Vampire",
    Jungle: "Clown",
    Mid: "Mage noir",
    Bot: "Chasseur de fléchettes empoisonnées",
    Support: "Moine",
  },
  {
    Top: "Infanterie lourde",
    Jungle: "Maître du fouet",
    Mid: "Mage de glace",
    Bot: "Chevalier de cavalerie",
    Support: "Porteur de bouclier",
  },
  metaMap,
  byName
);
assertEnum(porteur.tactics, opts, ORDER);
if (porteur.tactics.objectiveCombat.value.includes("Engage Fort")) {
  throw new Error("Porteur+Infanterie must not get Engage Fort");
}
if (porteur.tactics.focusLane.value !== "Focus Mid/Bot") {
  throw new Error("Porteur match: expected Focus Mid/Bot for threatened bot");
}
console.log("OK scenario 2 — vs heavy front peel");

// 3. Dive vs Dive (Ninja shell)
const diveOur = { ...draftGuide.compShells.ninja_executioner_dive.slots };
const diveEnemy = {
  Top: "Chevalier magique",
  Jungle: "Démon",
  Mid: "Bombardier",
  Bot: "Exécuteur",
  Support: "Combattant",
};
const dive = T.recommend(diveOur, diveEnemy, metaMap, byName);
assertEnum(dive.tactics, opts, ORDER);
if (dive.tactics.objectiveCombat.value.includes("Engage Fort")) {
  throw new Error("Dive vs dive should not hard engage at pit");
}
if (!["pick_before_morgard", "side_pressure_trade", "balanced"].includes(dive.archetype)) {
  throw new Error(`dive vs dive unexpected archetype ${dive.archetype}`);
}
console.log("OK scenario 3 — Dive vs Dive");

// 4. Lancer early tempo (explicit)
const lancerOur = {
  Top: "Combattant",
  Jungle: "Lancier",
  Mid: "Pyromancien",
  Bot: "Archer",
  Support: "Moine",
};
const lancerEnemy = {
  Top: "Porteur de bouclier",
  Jungle: "Ogre",
  Mid: "Mage de glace",
  Bot: "Soldat",
  Support: "Infanterie lourde",
};
const lancer = T.recommend(lancerOur, lancerEnemy, metaMap, byName);
assertEnum(lancer.tactics, opts, ORDER);
if (!["Gank", "Contre-Jungle"].includes(lancer.tactics.earlyJungle.value)) {
  throw new Error(`Lancer tempo: expected Gank/Contre-Jungle, got ${lancer.tactics.earlyJungle.value}`);
}
if (lancer.tactics.objectiveCombat.value.includes("Engage Fort")) {
  throw new Error("Lancer vs double front: Engage Fort forbidden");
}
console.log("OK scenario 4 — Lancer early vs scaling front");

// 5. vs scaling enemy (Tireur protect)
const scaleOur = {
  Top: "Chevalier de cavalerie",
  Jungle: "Ogre",
  Mid: "Mage de glace",
  Bot: "Tireur",
  Support: "Prêtre",
};
const scaleEnemy = {
  Top: "Infanterie lourde",
  Jungle: "Lancier",
  Mid: "Pyromancien",
  Bot: "Archer",
  Support: "Moine",
};
const scale = T.recommend(scaleOur, scaleEnemy, metaMap, byName);
assertEnum(scale.tactics, opts, ORDER);
if (scale.tactics.earlyJungle.value !== "Farm/Couverture") {
  throw new Error(`scale comp: expected Farm jungle, got ${scale.tactics.earlyJungle.value}`);
}
if (scale.tactics.earlySerpent.value === "Toujours Essayer") {
  throw new Error("scale comp should not force early Serpent");
}
console.log("OK scenario 5 — protect scale vs tempo enemy");

// API surface
if (typeof T.analyzeGameState !== "function" || typeof T.scoreTacticsAlternative !== "function") {
  throw new Error("missing analyzeGameState or scoreTacticsAlternative");
}
const profile = T.analyzeGameState(sniperOur, sniperEnemy, metaMap, byName);
if (!profile.winCondition || !profile.powerSpike) throw new Error("GameProfile incomplete");
const tpl = guide.templates.find((t) => t.id === "lancer_early_serpent");
const tplScore = T.scoreTacticsAlternative(tpl.tactics, profile);
const dynScore = T.scoreTacticsAlternative(
  Object.fromEntries(ORDER.map((k) => [k, sniper.tactics[k].value])),
  profile
);
if (dynScore < tplScore - 50) {
  console.warn("WARN dynamic score much lower than template", dynScore, tplScore);
}

console.log("OK — all tactics smoke scenarios passed");
