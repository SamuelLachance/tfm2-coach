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

const guideJson = JSON.parse(fs.readFileSync(dir + "data/draft-guide.json", "utf8"));
g.TFM2DraftGuide.setGuideData(guideJson);

const meta = JSON.parse(fs.readFileSync(dir + "data/tactics-meta.json", "utf8"));
const champs = JSON.parse(fs.readFileSync(dir + "data/champions.json", "utf8"));
const byName = new Map(champs.champions.map((c) => [c.name, c]));
const metaMap = {};
for (const c of champs.champions) {
  metaMap[c.name] = { ...(meta[c.name] || {}), colorIdentity: c.colorIdentity || meta[c.name]?.colorIdentity };
}

// Scenario: enemy picked Archer + Prêtre (kite shell) — our front-to-back plan
const ourNames = ["Chevalier de cavalerie", "Lancier"];
const oppNames = ["Archer", "Prêtre"];

const shell = g.TFM2DraftGuide.detectShell(oppNames);
console.log("ENEMY SHELL", shell?.shell?.labelFr, shell?.confidence);

const rec = g.TFM2DraftGuide.recommendShell(oppNames, ourNames, { sessionIndex: 0 });
console.log("REC SHELL", rec.shell.labelFr, "—", rec.reason);

const bans = ["Ninja", "Démon", "Moine", "Exécuteur", "Pyromancien", "Archer"]
  .map((n) => {
    const r = g.TFM2DraftCore.scoreBanCandidate(n, {
      ourNames,
      oppNames,
      byName,
      metaMap,
      phase: "core",
      sessionIndex: 0,
      banCount: 0,
    });
    return { n, score: r.score, reasons: r.reasons.slice(0, 3) };
  })
  .sort((a, b) => b.score - a.score);

console.log("\nBAN TOP (threat vs kite enemy):");
bans.slice(0, 4).forEach((b) => console.log(`  ${b.n}: ${b.score}`, b.reasons.join(" · ")));

const picks = ["Mage de glace", "Tireur", "Combattant", "Moine", "Pyromancien", "Joueur"]
  .map((n) => {
    const r = g.TFM2DraftCore.scorePickCandidate(n, {
      allies: ourNames,
      oppNames,
      byName,
      metaMap,
      openSlots: ["Mid", "Bot", "Support"],
      phase: "core",
      sessionIndex: 0,
      takenNames: new Set(["Archer"]),
    });
    return { n, score: r.score, slot: r.slot, reasons: r.reasons.slice(0, 4) };
  })
  .sort((a, b) => b.score - a.score);

console.log("\nPICK TOP (complete sniper shell):");
picks.slice(0, 4).forEach((p) => console.log(`  ${p.n}@${p.slot}: ${p.score}`, p.reasons.join(" · ")));

const pivot = g.TFM2DraftGuide.getReplacementChain("Archer");
console.log("\nARCHER BANNED →", pivot.join(" → "));

const hint = g.TFM2DraftGuide.coachDraftHint({
  ourNames,
  enemyNames: oppNames,
  stepType: "pick",
  takenNames: new Set(["Archer"]),
});
console.log("\nCOACH HINT:", hint);
