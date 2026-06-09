#!/usr/bin/env node
/** Smoke tests — TFM2 draft scoring (shell detection, ban deny, blind order). */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadTFM2() {
  const sandbox = { global: {}, window: {}, globalThis: {} };
  sandbox.global = sandbox.window = sandbox.globalThis = sandbox;
  const files = [
    "mtg-color-pie.js",
    "family-core.js",
    "match-core.js",
    "ability-core.js",
    "beatdown-core.js",
    "adaptive-engine.js",
    "draft-core.js",
    "draft-engine.js",
  ];
  for (const file of files) {
    vm.runInNewContext(readFileSync(join(root, "public", file), "utf8"), sandbox);
  }
  return {
    Draft: sandbox.TFM2Draft,
    Core: sandbox.TFM2DraftCore,
    MC: sandbox.TFM2MatchCore,
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function main() {
  const { Draft, Core, MC } = loadTFM2();
  assert(Draft && Core && MC, "TFM2 engines missing");

  const tacticsMeta = JSON.parse(readFileSync(join(root, "public/data/tactics-meta.json"), "utf8"));
  const meta = tacticsMeta.champions || {};
  const champs = JSON.parse(readFileSync(join(root, "public/data/champions.json"), "utf8")).champions;
  const byName = new Map(champs.map((c) => [c.name, c]));

  const shell = Core.detectCompShell(["Infanterie lourde", "Prêtre", "Tireur"], meta);
  assert(shell.shell === "front_to_back" || shell.label.includes("Front"), `expected front-to-back, got ${shell.shell}`);
  assert(shell.completeness >= 40, "front-to-back should be fairly complete");

  const session = Draft.createSession("smoke", "blue");
  assert(Draft.nextBlindSlot(session, "blue") === "Bot", "B1 blind slot should be Bot");

  const tireur = champs.find((c) => c.name === "Tireur");
  const pretre = champs.find((c) => c.name === "Prêtre");
  assert(tireur && pretre, "fixture champions missing");

  const b1 = Draft.scorePick(tireur, session, "blue", byName, meta);
  assert(b1.score > 0, "Tireur B1 should score positively");
  assert(b1.reasons.length > 0, "Tireur B1 should have French reasons");

  Draft.applyAction(session, { championName: "Tireur" }, [], { byName, metaMap: meta });
  const pretrePick = Core.scorePickCandidate("Prêtre", {
    allies: ["Tireur"],
    oppNames: [],
    byName,
    metaMap: meta,
    openSlots: ["Jungle", "Mid", "Support", "Top"],
    phase: "core",
  });
  assert(
    pretrePick.reasons.some((r) => /peel|carry|shell|synergie|Pairing|bot/i.test(r)),
    `Prêtre after Tireur should mention synergy/shell, got: ${pretrePick.reasons.join("; ")}`
  );

  const ban = Core.scoreBanCandidate("Ninja", {
    ourNames: ["Tireur", "Prêtre"],
    oppNames: ["Infanterie lourde"],
    byName,
    metaMap: meta,
    phase: "core",
  });
  assert(ban.score > 0, "Ninja ban should score positively");
  assert(ban.reasons.length > 0, "Ban should have French reasons");

  const pmOpen = Core.phaseMultiplier?.("opening") || {};
  const pmClose = Core.phaseMultiplier?.("closing") || {};
  assert(pmClose.counter > pmOpen.counter, "closing should weight counter higher than opening");

  console.log("OK — TFM2 draft scoring smoke tests passed");
  console.log(`  shell: ${shell.label} (${shell.completeness}%)`);
  console.log(`  ban Ninja reasons: ${ban.reasons.slice(0, 3).join(" · ")}`);
}

main();
