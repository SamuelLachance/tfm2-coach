/**
 * Smoke test — moteur guide TFM2 (shell Sniper vs dive adverse).
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

load("tfm2-draft-engine.js");
load("draft-engine.js");

const guideJson = JSON.parse(fs.readFileSync(dir + "data/tfm2-draft-guide.json", "utf8"));
g.TFM2GuideDraftEngine.setGuideData(guideJson);

const meta = JSON.parse(fs.readFileSync(dir + "data/tactics-meta.json", "utf8"));
const champs = JSON.parse(fs.readFileSync(dir + "data/champions.json", "utf8"));
const byName = new Map(champs.champions.map((c) => [c.name, c]));
const metaMap = {};
for (const c of champs.champions) {
  metaMap[c.name] = { ...(meta[c.name] || {}), tierMeta: c.tierMeta || meta[c.name]?.tierMeta };
}

// Scénario: adverse draft dive (Ninja + Exécuteur) — nous shell Sniper front-to-back
const ourNames = ["Chevalier de cavalerie", "Lancier"];
const oppNames = ["Ninja", "Exécuteur", "Bombardier"];
const ctx = { sessionIndex: 0, banCount: 2, takenNames: new Set(["Ninja"]) };

const enemyShell = g.TFM2GuideDraftEngine.detectShell(oppNames);
console.log("SHELL ADVERSE", enemyShell?.shell?.labelFr, enemyShell?.confidence);

const rec = g.TFM2GuideDraftEngine.recommendShell(oppNames, ourNames, ctx);
console.log("SHELL RECOMMANDÉ", rec.shell.labelFr, "—", rec.reason);

const bans = ["Ninja", "Démon", "Exécuteur", "Moine", "Pyromancien", "Archer", "Tireur"]
  .map((n) => {
    const r = g.TFM2GuideDraftEngine.scoreBanCandidate(n, { ourNames, oppNames, metaMap, ...ctx });
    return { n, score: r.score, reasons: r.reasons.slice(0, 3) };
  })
  .sort((a, b) => b.score - a.score);

console.log("\nTOP BANS (menaces vs Sniper shell):");
bans.slice(0, 4).forEach((b) => console.log(`  ${b.n}: ${b.score}`, b.reasons.join(" · ")));

const picks = ["Mage de glace", "Tireur", "Combattant", "Archer", "Moine", "Pyromancien"]
  .map((n) => {
    const r = g.TFM2GuideDraftEngine.scorePickCandidate(n, {
      allies: ourNames,
      oppNames,
      byName,
      metaMap,
      openSlots: ["Mid", "Bot", "Support"],
      ...ctx,
    });
    return { n, score: r.score, slot: r.slot, reasons: r.reasons.slice(0, 4) };
  })
  .sort((a, b) => b.score - a.score);

console.log("\nTOP PICKS (compléter shell Sniper):");
picks.slice(0, 4).forEach((p) => console.log(`  ${p.n}@${p.slot}: ${p.score}`, p.reasons.join(" · ")));

const archerVsTireur = picks.find((p) => p.n === "Archer");
const tireurPick = picks.find((p) => p.n === "Tireur");
if (archerVsTireur && tireurPick && tireurPick.score <= archerVsTireur.score) {
  console.error("FAIL: Archer ne doit pas battre Tireur dans shell Sniper");
  process.exit(1);
}
console.log("\nOK: Tireur > Archer pour shell Sniper");

const plan = g.TFM2GuideDraftEngine.getDraftPlan({ ourNames, enemyNames: oppNames, ...ctx });
console.log("\nPLAN:", plan.shell, "| prochain:", plan.nextPick);
console.log("Serpent:", plan.serpen?.slice(0, 80));
console.log("Morgard:", plan.morgard?.slice(0, 80));

const chk = plan.checklist;
console.log(`\nCHECKLIST: ${chk.passed}/${chk.total}`);
chk.items.forEach((i) => console.log(`  ${i.ok ? "✓" : "○"} ${i.labelFr}`));

console.log("\nSMOKE OK");
