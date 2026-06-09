/**
 * Smoke test — moteur guide TFM2 (shell Sniper vs dive + Safe vs Scaling).
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
    return { n, score: r.score, slot: r.slot, reasons: r.reasons.slice(0, 4), pickMeta: r.pickMeta };
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
console.log("\nOK: Tireur > Archer pour shell Sniper (mid-game shell)");

// --- Safe vs Scaling: B1 prefer safe blind over Tireur ---
const b1Ctx = { allies: [], oppNames: [], sessionIndex: 0, banCount: 6, metaMap, byName };
const b1Candidates = ["Épéiste", "Archer", "Lancier", "Prêtre", "Tireur"].map((n) => {
  const r = g.TFM2GuideDraftEngine.scorePickCandidate(n, {
    ...b1Ctx,
    openSlots: ["Top", "Jungle", "Mid", "Bot", "Support"],
  });
  return { n, score: r.score, pickMeta: r.pickMeta };
});
b1Candidates.sort((a, b) => b.score - a.score);
console.log("\nB1 SAFE vs SCALING:");
b1Candidates.forEach((p) =>
  console.log(`  ${p.n}: ${p.score} [${p.pickMeta?.safeVsScaling}/${p.pickMeta?.pickTypeLabelFr}]`)
);

const b1Best = b1Candidates[0];
const tireurB1 = b1Candidates.find((p) => p.n === "Tireur");
const safeTop = b1Candidates.find((p) => ["Épéiste", "Archer", "Lancier", "Prêtre"].includes(p.n));
if (!safeTop || !tireurB1 || tireurB1.score >= safeTop.score) {
  console.error("FAIL: B1 safe blind doit battre Tireur");
  process.exit(1);
}
if (b1Best.n === "Tireur") {
  console.error("FAIL: Tireur ne doit pas être #1 en B1");
  process.exit(1);
}
console.log(`OK: B1 safe (${safeTop.n}) > Tireur (${tireurB1.score})`);

// --- Tireur penalized without peel ---
const noPeelCtx = { allies: ["Chevalier de cavalerie", "Lancier"], oppNames: [], metaMap, byName };
const withPeelCtx = { allies: ["Chevalier de cavalerie", "Lancier", "Prêtre"], oppNames: [], metaMap, byName };
const tireurNoPeel = g.TFM2GuideDraftEngine.scorePickCandidate("Tireur", {
  ...noPeelCtx,
  openSlots: ["Mid", "Bot", "Support"],
}).score;
const tireurWithPeel = g.TFM2GuideDraftEngine.scorePickCandidate("Tireur", {
  ...withPeelCtx,
  openSlots: ["Mid", "Bot"],
}).score;
console.log(`\nTireur sans peel: ${tireurNoPeel} | avec peel: ${tireurWithPeel}`);
if (tireurNoPeel >= tireurWithPeel) {
  console.error("FAIL: Tireur doit être pénalisé sans peel");
  process.exit(1);
}
const trapMeta = g.TFM2GuideDraftEngine.getPickMeta("Tireur", { allies: noPeelCtx.allies, oppNames: [] });
if (!trapMeta.trapWarnings?.length) {
  console.error("FAIL: trap warnings attendus pour Tireur sans peel");
  process.exit(1);
}
console.log("OK: Tireur pénalisé sans peel —", trapMeta.trapWarnings[0].messageFr);

const plan = g.TFM2GuideDraftEngine.getDraftPlan({ ourNames, enemyNames: oppNames, ...ctx });
console.log("\nPLAN:", plan.shell, "| prochain:", plan.nextPick);
console.log("Safe hint:", plan.safeHint?.slice(0, 60));
console.log("Serpent:", plan.serpen?.slice(0, 80));
console.log("Morgard:", plan.morgard?.slice(0, 80));

const chk = plan.checklist;
console.log(`\nCHECKLIST: ${chk.passed}/${chk.total}`);
chk.items.forEach((i) => console.log(`  ${i.ok ? "✓" : "○"} ${i.labelFr}`));

console.log("\nSMOKE OK");
