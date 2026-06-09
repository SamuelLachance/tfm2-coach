/**
 * Smoke test — moteur draft LoL-style (TFM2DraftCore + blind pick + delta eval).
 */
const fs = require("fs");
const vm = require("vm");
const dir = require("path").join(__dirname, "../public/");
const g = { window: {}, globalThis: {} };
g.window = g;
g.globalThis = g;

function load(f) {
  vm.runInNewContext(fs.readFileSync(dir + f, "utf8"), g);
}

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

[
  "patch-config.js",
  "mtg-color-pie.js",
  "family-core.js",
  "match-core.js",
  "ability-core.js",
  "beatdown-core.js",
  "adaptive-engine.js",
  "draft-core.js",
  "draft-engine.js",
].forEach(load);

const meta = JSON.parse(fs.readFileSync(dir + "data/tactics-meta.json", "utf8"));
const champs = JSON.parse(fs.readFileSync(dir + "data/champions.json", "utf8"));
const byName = new Map(champs.champions.map((c) => [c.name, c]));
const metaMap = {};
for (const c of champs.champions) {
  metaMap[c.name] = { ...(meta[c.name] || {}), tierMeta: c.tierMeta || meta[c.name]?.tierMeta };
}

assert(g.TFM2DraftCore, "TFM2DraftCore missing");
assert(g.TFM2Draft, "TFM2Draft missing");
assert(!g.TFM2GuideDraftEngine, "guide engine should not be loaded in LoL draft path");

// Blind pick order mirrors LoL: Bot → Jungle → Mid
const session = g.TFM2Draft.createSession("Smoke", "blue");
assert(g.TFM2Draft.nextBlindSlot(session, "blue") === "Bot", "first blind slot Bot");
assert(g.TFM2Draft.isBlindPickPhase(session, "blue"), "opening is blind phase");

// B1: tier S flex anchor beats low-tier niche
const b1Ctx = {
  allies: [],
  oppNames: [],
  byName,
  metaMap,
  openSlots: ["Top", "Jungle", "Mid", "Bot", "Support"],
  phase: "opening",
};
const b1 = ["Lancier", "Vampire", "Moine", "Clown", "Androïde"]
  .map((n) => ({ n, ...g.TFM2DraftCore.scorePickCandidate(n, b1Ctx) }))
  .sort((a, b) => b.score - a.score);
console.log("B1 TOP", b1.slice(0, 3).map((p) => `${p.n}:${p.score}@${p.slot}`).join(", "));
const top = b1[0];
if (coreSupportOnly(top.n)) {
  console.error("FAIL: B1 should not be pure support");
  process.exit(1);
}
if (top.slot !== "Bot" && !["Lancier", "Vampire", "Clown", "Tireur", "Archer", "Épéiste"].includes(top.n)) {
  console.warn("WARN: B1 top is", top.n, "slot", top.slot);
}

function coreSupportOnly(name) {
  const m = metaMap[name] || {};
  return /moine|porteur|prêtre|androïde|enchanteur|pythonisse|barde/i.test(name) &&
    !((byName.get(name)?.optimalSlots || []).includes("Bot"));
}

// Synergy pick: Moine with carry allies
const allies = ["Vampire", "Clown"];
const opp = ["Infanterie lourde"];
const pickCtx = {
  allies,
  oppNames: opp,
  byName,
  metaMap,
  openSlots: ["Mid", "Bot", "Support"],
  phase: "core",
};
const picks = ["Moine", "Pyromancien", "Mage noir", "Tireur", "Porteur de bouclier"]
  .map((n) => {
    const r = g.TFM2DraftCore.scorePickCandidate(n, pickCtx);
    return { n, score: r.score, slot: r.slot, reasons: r.reasons.slice(0, 3) };
  })
  .sort((a, b) => b.score - a.score);
console.log("PICK TOP", picks.slice(0, 3));
const moine = picks.find((p) => p.n === "Moine");
const tireur = picks.find((p) => p.n === "Tireur");
if (!moine || !tireur || moine.score <= tireur.score) {
  console.error("FAIL: Moine peel should beat Tireur without front/peel setup");
  process.exit(1);
}

// Ban: deny tier S flex vs our scaling comp
const ourNames = ["Vampire", "Clown", "Moine"];
const oppNames = ["Infanterie lourde"];
const bans = ["Archer", "Tireur", "Ninja", "Lancier"]
  .map((n) => {
    const r = g.TFM2DraftCore.scoreBanCandidate(n, {
      ourNames,
      oppNames,
      byName,
      metaMap,
      phase: "core",
    });
    return { n, score: r.score, reasons: r.reasons.slice(0, 2) };
  })
  .sort((a, b) => b.score - a.score);
console.log("BAN TOP", bans.slice(0, 3));

// Session recommendations API
g.TFM2Draft.normalizeSession(session);
const rec = g.TFM2Draft.getRecommendations(
  session,
  "blue",
  champs.champions,
  [session],
  byName,
  metaMap,
  5
);
assert(rec.type === "pick" || rec.type === "ban", "rec type");
assert(rec.coachHint, "coachHint expected");
assert(rec.items?.length, "rec items expected");
console.log("REC", rec.type, rec.items[0].champion.name, rec.items[0].score);

console.log("\nSMOKE OK — LoL-style draft core");
