#!/usr/bin/env node
/** Rebuild validation — TFM2 draft scoring scenarios. */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadTFM2() {
  const sandbox = { global: {}, window: {}, globalThis: {} };
  sandbox.global = sandbox.window = sandbox.globalThis = sandbox;
  for (const file of [
    "mtg-color-pie.js", "family-core.js", "match-core.js", "ability-core.js",
    "beatdown-core.js", "adaptive-engine.js", "draft-core.js", "draft-engine.js",
  ]) {
    vm.runInNewContext(readFileSync(join(root, "public", file), "utf8"), sandbox);
  }
  return { Draft: sandbox.TFM2Draft, Core: sandbox.TFM2DraftCore };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function main() {
  const { Draft, Core } = loadTFM2();
  assert(Draft && Core, "TFM2 engines missing");

  const tacticsMeta = JSON.parse(readFileSync(join(root, "public/data/tactics-meta.json"), "utf8"));
  const meta = tacticsMeta.champions || {};
  const champs = JSON.parse(readFileSync(join(root, "public/data/champions.json"), "utf8")).champions;
  const byName = new Map(champs.map((c) => [c.name, c]));

  const session = Draft.createSession("b1", "blue");
  assert(Draft.nextBlindSlot(session, "blue") === "Bot", "B1 blind slot Bot");

  const b1Top = champs
    .map((c) => {
      const r = Draft.scorePick(c, session, "blue", byName, meta);
      return { name: c.name, score: r.score, slot: r.slot, tier: meta[c.name]?.tierMeta, reasons: r.reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  console.log("\n=== TFM2 B1 (top picks) ===");
  for (const p of b1Top.slice(0, 3)) {
    console.log(`  ${p.name}: ${Math.round(p.score)} (${p.tier}) slot=${p.slot} — ${p.reasons.slice(0, 2).join("; ")}`);
  }

  assert(b1Top[0].slot === "Bot", `B1 should be Bot slot, got ${b1Top[0].slot}`);
  const topName = b1Top[0].name;
  assert(
    Core.B1_PRIORITY.has(topName) || Core.CARRY_BOTS.has(topName),
    `B1 should be carry/flex anchor, got ${topName}`
  );
  assert(!Core.DEDICATED_SUPPORT?.has?.(topName) && !/^(Prêtre|Moine|Porteur)/.test(topName),
    `B1 should not be pure support, got ${topName}`);

  const pretre = champs.find((c) => c.name === "Prêtre");
  const pretreScore = Draft.scorePick(pretre, session, "blue", byName, meta).score;
  assert(pretreScore < b1Top[2].score, `Prêtre B1 (${pretreScore}) should lose to top carries`);

  // Anti-blind specialist
  const specialist = champs.find((c) => c.name === "Ninja") || champs.find((c) => c.name === "Exécuteur");
  if (specialist) {
    const sp = Draft.scorePick(specialist, session, "blue", byName, meta);
    assert(sp.score < b1Top[0].score - 30, `${specialist.name} specialist should not top B1`);
  }

  // Scenario: enemy dive comp forming
  const diveSession = Draft.createSession("dive", "blue");
  diveSession.picks.red = [
    { name: "Ninja", slot: "Jungle" },
    { name: "Exécuteur", slot: "Mid" },
  ];
  const peelCandidates = ["Prêtre", "Moine", "Porteur de bouclier", "Pythonisse", "Infanterie lourde"]
    .map((name) => {
      const c = champs.find((x) => x.name === name);
      if (!c) return null;
      const r = Draft.scorePick(c, diveSession, "blue", byName, meta);
      return { name, score: r.score, reasons: r.reasons };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  console.log("\n=== TFM2 vs enemy dive ===");
  for (const p of peelCandidates.slice(0, 4)) {
    console.log(`  ${p.name}: ${Math.round(p.score)} — ${p.reasons.slice(0, 2).join("; ")}`);
  }

  const bestPeel = peelCandidates.find((p) => /Prêtre|Moine|Porteur|Pythonisse/.test(p.name));
  assert(bestPeel && bestPeel.score > 0, "Should recommend peel vs dive");
  assert(
    bestPeel.reasons.some((r) => /peel|dive|front|shell/i.test(r)),
    `Peel pick should explain dive answer, got: ${bestPeel.reasons.join("; ")}`
  );

  // Shell detection
  const shell = Core.detectCompShell(["Infanterie lourde", "Prêtre", "Tireur"], meta);
  assert(shell.shell === "front_to_back" || shell.label.includes("Front"), `expected front-to-back, got ${shell.shell}`);

  // Synergy: Moine after carries
  const allies = ["Vampire", "Clown"];
  const picks = ["Moine", "Tireur", "Pyromancien"]
    .map((n) => ({ n, ...Core.scorePickCandidate(n, { allies, oppNames: ["Infanterie lourde"], byName, metaMap: meta, openSlots: ["Mid", "Bot", "Support"], phase: "core" }) }))
    .sort((a, b) => b.score - a.score);
  const moine = picks.find((p) => p.n === "Moine");
  const tireur = picks.find((p) => p.n === "Tireur");
  assert(moine && tireur && moine.score > tireur.score, "Moine peel should beat Tireur when carries need peel");

  console.log("\nOK — TFM2 draft rebuild tests passed");
}

main();
