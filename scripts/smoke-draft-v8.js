const fs = require("fs");
const vm = require("vm");
const dir = require("path").join(__dirname, "../public/");
const g = { window: {}, globalThis: {} };
g.window = g;
g.globalThis = g;

function load(f) {
  vm.runInNewContext(fs.readFileSync(dir + f, "utf8"), g);
}

[
  "patch-config.js",
  "mtg-color-pie.js",
  "family-core.js",
  "match-core.js",
  "ability-core.js",
  "beatdown-core.js",
  "draft-guide-core.js",
  "draft-core.js",
].forEach(load);

const meta = JSON.parse(fs.readFileSync(dir + "data/tactics-meta.json", "utf8"));
const champs = JSON.parse(fs.readFileSync(dir + "data/champions.json", "utf8"));
const byName = new Map(champs.champions.map((c) => [c.name, c]));
const metaMap = {};
for (const c of champs.champions) {
  metaMap[c.name] = { ...(meta[c.name] || {}), colorIdentity: c.colorIdentity || meta[c.name]?.colorIdentity };
}

const allies = ["Vampire", "Clown"];
const opp = ["Infanterie lourde"];
const ctx = { allies, oppNames: opp, byName, metaMap, openSlots: ["Mid", "Bot", "Support"], phase: "core" };

const picks = ["Moine", "Pyromancien", "Mage noir", "Tireur", "Porteur de bouclier"]
  .map((n) => {
    const r = g.TFM2DraftCore.scorePickCandidate(n, ctx);
    return { n, score: r.score, slot: r.slot, reasons: r.reasons.slice(0, 4) };
  })
  .sort((a, b) => b.score - a.score);

console.log("PICK TOP", picks.slice(0, 4));

const bans = ["Archer", "Moine", "Pyromancien", "Enchanteur"]
  .map((n) => {
    const r = g.TFM2DraftCore.scoreBanCandidate(n, {
      ourNames: allies,
      oppNames: opp,
      byName,
      metaMap,
      phase: "opening",
    });
    return { n, score: r.score, reasons: r.reasons.slice(0, 4) };
  })
  .sort((a, b) => b.score - a.score);

console.log("BAN TOP", bans);

const prof = g.TFM2AbilityCore.getProfile("Moine", byName);
console.log("MOINE KIT", { peel: prof.peelScore, cc: prof.ccScore });
