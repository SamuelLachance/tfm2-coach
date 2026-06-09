/**
 * TFM2 Draft Core v9 — pipeline unique scoreBan / scorePick (MOBA theory).
 * Delta eval via TFM2MatchCore · sans couches beatdown/adaptive conflictuelles.
 */
(function (global) {
  const MC = () => global.TFM2MatchCore;
  const SLOTS = () => MC()?.SLOTS || ["Top", "Jungle", "Mid", "Bot", "Support"];
  const TIER = { S: 100, A: 76, B: 54, C: 30, D: 10 };
  const SYN_W = [64, 52, 40, 30, 22];
  const CTR_W = [72, 58, 44, 32, 24];

  const BLIND_ORDER = ["Bot", "Jungle", "Mid"];
  const CARRY_BOTS = new Set([
    "Tireur", "Archer", "Vampire", "Chasseur de boomerang",
    "Chasseur de fléchettes empoisonnées", "Fantôme", "Joueur", "Danseuse",
  ]);
  /** B1 idéal : carry Bot meta — pas artillerie/split. */
  const B1_PRIORITY = new Set([
    "Tireur", "Vampire", "Archer", "Chasseur de boomerang",
    "Chasseur de fléchettes empoisonnées", "Fantôme", "Lancier", "Clown", "Joueur",
  ]);
  const B1_AVOID = new Set(["Bombardier", "Soldat", "Nécromancien", "Chef", "Maître du fouet"]);
  const FLEX_ANCHORS = new Set([
    "Lancier", "Vampire", "Mage noir", "Tireur", "Archer", "Clown", "Ninja",
    "Infanterie lourde", "Pyromancien", "Moine", "Porteur de bouclier", "Épéiste",
  ]);
  const DEDICATED_SUPPORT = new Set([
    "Moine", "Porteur de bouclier", "Androïde", "Prêtre", "Enchanteur", "Barde",
    "Pythonisse", "Exorciste", "Esprit gardien", "Invocateur d'esprit", "Taoïste",
    "Jiangshi", "Mage de barrière", "Médecin de la peste",
  ]);

  const SHELL_LABELS = {
    front_to_back: "Front-to-back",
    dive: "Dive",
    kite: "Kite",
    tempo: "Tempo early",
    scaling: "Scaling late",
  };

  const KNOWN_DUOS = [
    ["Vampire", "Moine"], ["Vampire", "Prêtre"], ["Vampire", "Infanterie lourde"],
    ["Mage noir", "Moine"], ["Mage noir", "Porteur de bouclier"],
    ["Pyromancien", "Infanterie lourde"], ["Pyromancien", "Chevalier"],
    ["Tireur", "Moine"], ["Tireur", "Prêtre"], ["Tireur", "Porteur de bouclier"],
  ];

  function meta(name, metaMap) { return metaMap?.[name] || {}; }
  function champ(name, byName, metaMap) { return byName?.get?.(name) || metaMap?.[name] || { name }; }
  function tierVal(name, metaMap) {
    const t = meta(name, metaMap).tierMeta || champ(name, null, metaMap).tierMeta || "C";
    return TIER[t] ?? 30;
  }
  function hasTag(name, tag, metaMap) {
    return MC()?.hasTag?.(name, tag, metaMap) || meta(name, metaMap).tags?.includes(tag);
  }
  function draftProfile(name, metaMap) { return meta(name, metaMap).draftProfile || {}; }
  function listScore(name, list, w) {
    if (!list?.length) return 0;
    const i = list.findIndex((x) => (typeof x === "string" ? x : x?.name) === name);
    return i >= 0 ? w[Math.min(i, w.length - 1)] : 0;
  }
  function pairingList(name, byName, metaMap) {
    const c = champ(name, byName, metaMap);
    return c.bestPairings || meta(name, metaMap).bestPairings || [];
  }
  function counterList(name, byName, metaMap) {
    const c = champ(name, byName, metaMap);
    return c.bestCounters || meta(name, metaMap).bestCounters || [];
  }
  function counteredByList(name, byName, metaMap) {
    const c = champ(name, byName, metaMap);
    return c.worstMatchups || meta(name, metaMap).worstMatchups || [];
  }
  function isDedicatedSupport(name, metaMap) {
    return MC()?.isDedicatedSupport?.(name, metaMap) || DEDICATED_SUPPORT.has(name);
  }
  function isCarryBot(name, metaMap) {
    if (B1_AVOID.has(name)) return false;
    if (CARRY_BOTS.has(name)) return true;
    const dp = draftProfile(name, metaMap);
    return (dp.dpsWeight ?? 0) >= 0.52 || hasTag(name, "marksman", metaMap) || hasTag(name, "scaling", metaMap);
  }

  function phaseMultiplier(phase) {
    if (phase === "opening") return { eval: 1.8, tier: 1.45, synergy: 0.75, counter: 0.45, blind: 1.5, shell: 0.9, slot: 1.2, deny: 1.15 };
    if (phase === "closing") return { eval: 2.1, tier: 0.65, synergy: 0.95, counter: 1.55, blind: 0.4, shell: 1.1, slot: 1.15, deny: 1.0 };
    return { eval: 2.3, tier: 0.9, synergy: 1.05, counter: 1.1, blind: 0.7, shell: 1.25, slot: 1.05, deny: 1.05 };
  }

  function detectCompShell(allies, metaMap) {
    if (!allies.length) return { shell: null, label: "", completeness: 0, gaps: [], carry: null };
    const core = MC();
    const skel = core?.teamSkeleton?.(allies, metaMap);
    const tags = new Set();
    for (const n of allies) (meta(n, metaMap).tags || []).forEach((t) => tags.add(t));
    const gaps = [];
    let shell = null;
    let completeness = 0;
    let carry = allies.find((n) => isCarryBot(n, metaMap)) || null;

    const hasFront = tags.has("frontline") || skel?.filled?.frontline;
    const hasPeel = tags.has("peel") || skel?.filled?.enchanter;
    const hasDive = tags.has("dive") || tags.has("assassin") || allies.some((n) => /ninja|exécuteur|assassin/i.test(n));
    const hasMarksman = tags.has("marksman") || tags.has("scaling") || Boolean(carry);
    const hasMage = tags.has("mage_burst") || skel?.filled?.mage;

    if (hasFront && hasPeel && hasMarksman) {
      shell = "front_to_back";
      completeness = 35 + (hasMage ? 15 : 0) + (skel?.filled?.dps ? 25 : 0);
      if (!skel?.filled?.dps) gaps.push("carry Bot");
    } else if (hasDive) {
      shell = "dive";
      completeness = 28 + (tags.has("engage") ? 20 : 0);
      if (!hasFront && !tags.has("engage")) gaps.push("engage");
    } else if (hasMarksman && !hasPeel) {
      shell = "scaling";
      completeness = 18;
      gaps.push("peel");
      if (!hasFront) gaps.push("frontline");
    } else if (tags.has("aggressive_jungle") || tags.has("pick_jungle")) {
      shell = "tempo";
      completeness = 22;
    }

    return { shell, label: SHELL_LABELS[shell] || shell || "", completeness: Math.min(100, completeness), gaps, carry };
  }

  function enemyThreatProfile(oppNames, metaMap) {
    const tags = new Set();
    for (const n of oppNames) (meta(n, metaMap).tags || []).forEach((t) => tags.add(t));
    const dive = tags.has("dive") || tags.has("assassin") ||
      oppNames.some((n) => /ninja|exécuteur|assassin|berserker/i.test(n));
    const engage = tags.has("engage") || tags.has("frontline");
    const scale = tags.has("scaling") || tags.has("marksman");
    return { dive, engage, scale, tags };
  }

  function knownDuoBonus(champName, allies) {
    let bonus = 0;
    const reasons = [];
    for (const a of allies) {
      if (KNOWN_DUOS.some(([x, y]) => (x === champName && y === a) || (x === a && y === champName))) {
        bonus += 38;
        reasons.push(`Combo ${a}+${champName}`);
      }
    }
    if (allies.some((a) => isCarryBot(a, null)) && isDedicatedSupport(champName, null)) {
      bonus += 42;
      reasons.push("Carry Bot + peel");
    }
    return { bonus, reasons };
  }

  function counterabilityPenalty(champName, metaMap) {
    const worst = counteredByList(champName, null, metaMap);
    const flex = (meta(champName, metaMap).optimalSlots || []).length;
    const specialist = (draftProfile(champName, metaMap).dpsWeight ?? 0) >= 0.62 && flex <= 1;
    const risk = worst.length * 14 + (specialist ? 24 : 0) + (flex <= 1 ? 10 : 0);
    return { risk, poolThreat: worst.length, specialist };
  }

  function firstBlindBonus(champName, slot, metaMap, byName) {
    let bonus = 0;
    const reasons = [];
    const tv = tierVal(champName, metaMap);
    const label = meta(champName, metaMap).tierMeta || "?";

    if (isDedicatedSupport(champName, metaMap)) {
      bonus -= 200;
      reasons.push("Pas support en B1");
      return { bonus, reasons };
    }

    if (slot === "Bot") {
      if (isCarryBot(champName, metaMap)) {
        bonus += tv >= 76 ? 72 : tv >= 54 ? 48 : 22;
        reasons.push(tv >= 76 ? "Blind carry Bot tier S/A" : "Blind carry Bot");
      } else {
        bonus -= 120;
        reasons.push("Carry Bot requis au B1");
      }
    } else {
      bonus -= 80;
      reasons.push("B1 = Bot obligatoire");
    }

    if (B1_PRIORITY.has(champName)) {
      bonus += 95;
      reasons.push("Ancre carry Bot meta");
    }
    if (B1_AVOID.has(champName)) {
      bonus -= 120;
      reasons.push("Profil niche — pas B1");
    }
    if (MC()?.HYPER_CARRIES?.has(champName)) {
      bonus += 35;
      reasons.push("Hypercarry Bot");
    }

    if (FLEX_ANCHORS.has(champName)) {
      bonus += 28;
      reasons.push("Flex anchor meta");
    }
    if (tv >= 76) {
      bonus += 22;
      reasons.push(`Tier ${label}`);
    } else if (tv <= 30 && slot === "Bot") {
      bonus -= 55;
      reasons.push("Tier faible — éviter B1");
    }

    const ctr = counterabilityPenalty(champName, metaMap);
    if (ctr.risk >= 35) {
      bonus -= Math.round(ctr.risk * 0.9);
      if (ctr.poolThreat >= 2) reasons.push(`Counterable (${ctr.poolThreat} menaces)`);
      if (ctr.specialist) reasons.push("Spécialiste — blind risqué");
    }

    return { bonus, reasons };
  }

  function scorePickAtSlot(champName, slot, ctx) {
    const core = MC();
    if (!core) return { score: 0, reasons: ["Engine indisponible"], slot, eval: null };

    const { allies = [], oppNames = [], oppComp = {}, byName, metaMap, phase = "core" } = ctx;
    const pm = phaseMultiplier(phase);
    const reasons = [];

    const beforeLayout = core.bestLayout(allies, {
      byName, metaMap, oppNames, oppComp,
      slotsLeft: ctx.openSlots?.length ?? Math.max(0, 5 - allies.length),
    });
    const afterLayout = core.bestLayout(allies.concat(champName), {
      byName, metaMap, oppNames, oppComp,
      slotsLeft: Math.max(0, (ctx.openSlots?.length ?? 5 - allies.length) - 1),
    }, { name: champName, slot });

    const beforeEv = beforeLayout.eval || core.evaluateTeam(allies, { byName, metaMap, oppNames, oppComp, assignment: beforeLayout.assignment });
    const afterEv = afterLayout.eval || core.evaluateTeam(allies.concat(champName), {
      byName, metaMap, oppNames, oppComp, assignment: afterLayout.assignment,
    });

    let score = (afterEv.total - beforeEv.total) * pm.eval;
    score += tierVal(champName, metaMap) * 0.08 * pm.tier;

    const duo = knownDuoBonus(champName, allies);
    score += duo.bonus * pm.synergy;
    reasons.push(...duo.reasons.slice(0, 2));

    for (const a of allies) {
      const syn = listScore(champName, pairingList(a, byName, metaMap), SYN_W) +
        listScore(a, pairingList(champName, byName, metaMap), SYN_W);
      if (syn) {
        score += syn * 0.35 * pm.synergy;
        if (!reasons.some((r) => r.includes("Pairing"))) reasons.push(`Pairing ${a}`);
      }
    }

    score += core.slotFit(champName, slot, metaMap, byName) * 0.45 * pm.slot;

    const beforeShell = detectCompShell(allies, metaMap);
    const afterShell = detectCompShell(allies.concat(champName), metaMap);
    const shellDelta = afterShell.completeness - beforeShell.completeness;
    if (shellDelta >= 10) {
      score += shellDelta * pm.shell * 0.55;
      if (afterShell.label) reasons.push(`Shell ${afterShell.label}`);
      const filled = beforeShell.gaps.find((g) => !afterShell.gaps.includes(g));
      if (filled) reasons.push(`Complète : ${filled}`);
    }

    const enemy = enemyThreatProfile(oppNames, metaMap);
    const oppLane = oppComp?.[slot];
    if (oppLane) {
      const beatsLane = listScore(oppLane, counterList(champName, byName, metaMap), CTR_W);
      const losesLane = listScore(oppLane, counteredByList(champName, byName, metaMap), CTR_W);
      if (beatsLane) {
        score += beatsLane * 0.55 * pm.counter;
        reasons.push(`Counter lane vs ${oppLane}`);
      }
      if (losesLane) score -= losesLane * 0.35;
    }

    if (enemy.dive && (isDedicatedSupport(champName, metaMap) || hasTag(champName, "peel", metaMap))) {
      score += 55 * pm.counter;
      reasons.push("Peel vs comp dive");
    }
    if (enemy.dive && beforeShell.shell !== "front_to_back" && (hasTag(champName, "frontline", metaMap) || slot === "Top")) {
      score += 38 * pm.shell;
      reasons.push("Frontline vs dive");
    }
    if (enemy.dive && isCarryBot(champName, metaMap) && slot === "Bot" && !allies.some((a) => isDedicatedSupport(a, metaMap))) {
      score -= 25;
    }

    if (isDedicatedSupport(champName, metaMap)) {
      const supCount = allies.filter((a) => isDedicatedSupport(a, metaMap)).length;
      if (supCount >= 1) {
        score -= 200;
        reasons.push("Déjà un support");
      } else if (!allies.some((a) => isCarryBot(a, metaMap)) && allies.length >= 1) {
        score -= 85;
        reasons.push("Carry d'abord");
      }
      if (slot !== "Support" && !hasTag(champName, "frontline", metaMap)) {
        score -= 40;
        reasons.push("Support hors slot Support");
      }
    }

    if (!allies.length && (phase === "opening" || phase === undefined)) {
      const fb = firstBlindBonus(champName, slot, metaMap, byName);
      const skipBlindSupPenalty = enemy.dive && (isDedicatedSupport(champName, metaMap) || hasTag(champName, "peel", metaMap));
      if (!skipBlindSupPenalty) {
        score += fb.bonus * pm.blind;
        reasons.unshift(...fb.reasons.slice(0, 4));
      } else if (slot === "Support") {
        score += 35;
        reasons.push("Peel urgent vs dive");
      }
      if (B1_AVOID.has(champName) && slot === "Bot") {
        score -= 180;
        reasons.push("Artillerie/split — pas B1 Bot");
      }
    }

    const delta = afterEv.total - beforeEv.total;
    if (delta > 10 && !reasons.some((r) => r.includes("Renforce"))) reasons.push("Renforce la comp");
    if (!reasons.length) reasons.push(`Tier ${meta(champName, metaMap).tierMeta || "?"}`);

    return {
      score: Math.round(score * 10) / 10,
      slot,
      reasons: [...new Set(reasons)].slice(0, 8),
      eval: afterEv,
    };
  }

  function nextBlindSlotFromOpen(openSlots, allyCount) {
    const order = BLIND_ORDER.slice();
    if (allyCount < order.length) return order[allyCount];
    return null;
  }

  function scorePickCandidate(champName, ctx) {
    const core = MC();
    if (!core) return { score: 0, slot: SLOTS()[0], reasons: ["Engine indisponible"], eval: null };

    let slots = (ctx.openSlots?.length ? ctx.openSlots : SLOTS()).slice();
    const allyCount = ctx.allies?.length || 0;
    const inOpening = ctx.phase === "opening" || ctx.phase === undefined;
    if (inOpening && allyCount < BLIND_ORDER.length) {
      const next = nextBlindSlotFromOpen(slots, allyCount);
      if (next && slots.includes(next)) slots = [next];
    }

    let best = null;
    for (const slot of slots) {
      let r = scorePickAtSlot(champName, slot, ctx);
      if (ctx.hintSlot === slot) r = { ...r, score: r.score + 24 };
      if (!best || r.score > best.score) best = r;
    }
    return best || { score: 0, slot: slots[0], reasons: ["Placement par défaut"], eval: null };
  }

  function scoreBanCandidate(champName, ctx) {
    const core = MC();
    const { oppNames = [], ourNames = [], byName, metaMap, phase = "core" } = ctx;
    const pm = phaseMultiplier(phase);
    let score = tierVal(champName, metaMap) * 0.25 * pm.tier;
    const reasons = [];

    const label = meta(champName, metaMap).tierMeta;
    if (tierVal(champName, metaMap) >= 76) {
      score += phase === "opening" ? 36 : 24;
      reasons.push(`Tier ${label} meta`);
    }
    if (FLEX_ANCHORS.has(champName)) {
      score += 20;
      reasons.push("Deny flex anchor");
    }

    for (const e of oppNames) {
      const pair = pairingList(e, byName, metaMap);
      if (pair.includes(champName)) {
        score += 38 * pm.deny;
        reasons.push(`Casse duo ${e}+${champName}`);
        break;
      }
    }

    if (core) {
      const oppBefore = core.evaluateTeam(oppNames, { byName, metaMap, slotsLeft: 5 - oppNames.length });
      const oppAfter = core.evaluateTeam(oppNames.concat(champName), { byName, metaMap, slotsLeft: Math.max(0, 5 - oppNames.length - 1) });
      const deny = oppAfter.total - oppBefore.total;
      if (deny > 8) {
        score += deny * 0.38;
        reasons.push("Renforce leur comp");
      }
    }

    const ourShell = detectCompShell(ourNames, metaMap);
    if (ourShell.carry && counteredByList(ourShell.carry, byName, metaMap).includes(champName)) {
      score += 36;
      reasons.push(`Counter carry ${ourShell.carry}`);
    }

    const enemyThreat = enemyThreatProfile(oppNames, metaMap);
    if (ourShell.shell === "front_to_back" && (hasTag(champName, "dive", metaMap) || hasTag(champName, "assassin", metaMap))) {
      score += 28;
      reasons.push("Dive vs front-to-back");
    }
    if (ourNames.some((n) => hasTag(n, "scaling", metaMap)) && (hasTag(champName, "dive", metaMap) || hasTag(champName, "assassin", metaMap))) {
      score += 24;
      reasons.push("Anti-dive vs notre scale");
    }

    if (phase === "opening" && FLEX_ANCHORS.has(champName)) {
      score += 12;
      reasons.push("Flex ban — cache intent");
    }

    if (!reasons.length) reasons.push(`Retirer ${champName} du pool`);
    return { score: Math.round(score * 10) / 10, reasons: [...new Set(reasons)].slice(0, 7) };
  }

  function compareComps(ourComp, enemyComp, byName, metaMap) {
    const core = MC();
    if (!core) return { complete: false };
    const slots = SLOTS();
    const ourNames = slots.map((s) => ourComp[s]).filter(Boolean);
    const enemyNames = slots.map((s) => enemyComp[s]).filter(Boolean);
    if (ourNames.length < 5 || enemyNames.length < 5) {
      return { complete: false, ourCount: ourNames.length, enemyCount: enemyNames.length };
    }
    const ourEval = core.evaluateTeam(ourNames, { byName, metaMap, oppNames: enemyNames, oppComp: enemyComp, slotsLeft: 0 });
    const enemyEval = core.evaluateTeam(enemyNames, { byName, metaMap, oppNames: ourNames, oppComp: ourComp, slotsLeft: 0 });
    const margin = ourEval.total - enemyEval.total;
    return {
      complete: true,
      our: { score: Math.round(ourEval.total), breakdown: ourEval.breakdown, plan: detectCompShell(ourNames, metaMap).label },
      enemy: { score: Math.round(enemyEval.total), breakdown: enemyEval.breakdown, plan: detectCompShell(enemyNames, metaMap).label },
      margin: Math.round(margin),
      winProb: core.winProbFromScores?.(ourEval.total, enemyEval.total) || { our: 0.5, enemy: 0.5 },
    };
  }

  global.TFM2DraftCore = {
    BLIND_ORDER,
    CARRY_BOTS,
    FLEX_ANCHORS,
    DEDICATED_SUPPORT,
    B1_PRIORITY,
    B1_AVOID,
    SHELL_LABELS,
    detectCompShell,
    phaseMultiplier,
    counterabilityPenalty,
    scorePickCandidate,
    scorePickAtSlot,
    scoreBanCandidate,
    compareComps,
  };
})(typeof window !== "undefined" ? window : globalThis);
