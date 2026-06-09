#!/usr/bin/env node
/** Smoke test — tfm2-tactics-engine + guide JSON + shell Sniper → Lancer template. */
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

const meta = loadJson("data/tactics-meta.json");
const guide = loadJson("data/tfm2-jungle-tactics-guide.json");
const draftGuide = loadJson("data/tfm2-draft-guide.json");
const champions = loadJson("data/champions.json");
const byName = new Map(champions.champions.map((c) => [c.name, c]));
const metaMap = meta.champions;

const g = makeSandbox();
runFile(g, "match-core.js");
runFile(g, "tfm2-draft-engine.js");
runFile(g, "tfm2-tactics-engine.js");

g.TFM2GuideDraftEngine.setGuideData(draftGuide);
g.TFM2Tactics.setGuide(guide);
g.TFM2Tactics.setTacticOptions(meta.tacticOptions);

const sniperShell = draftGuide.compShells.sniper_front_to_back;
const our = { ...sniperShell.slots };
const enemy = {
  Top: "Infanterie lourde",
  Jungle: "Ogre",
  Mid: "Pyromancien",
  Bot: "Archer",
  Support: "Moine",
};

const result = g.TFM2Tactics.recommend(our, enemy, metaMap, byName);
const t = result.tactics;

console.log("Archetype:", result.archetype, "→", result.archetypeLabel);
console.log("Shell:", result.shellHints?.shell, result.shellHints?.confidence);
console.log("Early jungle:", t.earlyJungle?.value);
console.log("Early serpent:", t.earlySerpent?.value);
console.log("Combat:", t.objectiveCombat?.value);

const allowed = meta.tacticOptions;
for (const key of g.TFM2Tactics.TACTIC_ORDER) {
  const val = t[key]?.value;
  if (!val) {
    console.error("FAIL missing", key);
    process.exit(1);
  }
  if (!allowed[key]?.values.includes(val)) {
    console.error("FAIL enum", key, val, "not in", allowed[key].values);
    process.exit(1);
  }
}

if (result.archetype !== "early_serpent_pressure") {
  console.error("FAIL expected early_serpent_pressure for sniper shell, got", result.archetype);
  process.exit(1);
}
if (t.earlyJungle.value !== "Gank") {
  console.error("FAIL expected Gank jungle for Lancer shell");
  process.exit(1);
}

const porteurMatch = g.TFM2Tactics.recommend(
  { Top: "Vampire", Jungle: "Clown", Mid: "Mage noir", Bot: "Chasseur de fléchettes empoisonnées", Support: "Moine" },
  { Top: "Infanterie lourde", Jungle: "Maître du fouet", Mid: "Mage de glace", Bot: "Chevalier de cavalerie", Support: "Porteur de bouclier" },
  metaMap,
  byName
);
if (porteurMatch.tactics.objectiveCombat.value.includes("Engage Fort")) {
  console.error("FAIL Porteur+Infanterie must not get Engage Fort");
  process.exit(1);
}

console.log("OK — smoke tactics passed");
