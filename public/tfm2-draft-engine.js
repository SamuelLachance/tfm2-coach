/**
 * TFM2 Guide Draft Engine — algorithme 100 % guide Early Access Ban Pick.
 * Shells · threat bans · replacement chains · Serpen/Morgard · traits · checklist.
 * Tier = tiebreaker secondaire uniquement.
 */
(function (global) {
  const SLOTS = ["Top", "Jungle", "Mid", "Bot", "Support"];
  const TIER_TB = { S: 8, A: 6, B: 4, C: 2, D: 1 };

  let guide = null;

  function setGuideData(data) {
    guide = data && typeof data === "object" ? data : null;
  }

  function shells() {
    return Object.values(guide?.compShells || {});
  }

  function getChampionGuide(name) {
    return guide?.championCounters?.[name] || null;
  }

  function getChampionLabel(name) {
    return guide?.championLabels?.[name] || null;
  }

  function getPickTypes(name) {
    const label = getChampionLabel(name);
    if (label?.pickTypes?.length) return label.pickTypes;
    const types = [];
    for (const [typeId, def] of Object.entries(guide?.pickTypes || {})) {
      if (def.champions?.includes(name)) types.push(typeId);
    }
    return types;
  }

  function pickTypeLabelFr(typeId) {
    return guide?.pickTypes?.[typeId]?.labelFr || typeId;
  }

  const PEEL_CHAMPS = () =>
    new Set(guide?.scalingRules?.peelChampions || ["Prêtre", "Mage de glace", "Moine", "Porteur de bouclier", "Esprit gardien"]);
  const SCALING_CARRIES = () => new Set(guide?.scalingRules?.scalingCarries || ["Tireur", "Archer", "Soldat"]);
  const HARD_CC_ENEMY = () => new Set(["Moine", "Porteur de bouclier", "Prêtre", "Mage de glace", "Esprit gardien"]);
  const DIVE_ENEMY = () => new Set(["Ninja", "Démon", "Exécuteur", "Bombardier"]);
  const FRAGILE_CARRY = () => new Set(["Archer", "Tireur", "Soldat", "Joueur", "Pyromancien"]);

  function teamTags(names) {
    const tags = new Set();
    for (const n of names) (getChampionGuide(n)?.tags || []).forEach((t) => tags.add(t));
    return tags;
  }

  function hasPeel(names) {
    return names.some((n) => PEEL_CHAMPS().has(n) || getChampionGuide(n)?.tags?.includes("peel"));
  }

  function hasFrontline(names) {
    return names.some((n) => {
      const t = getChampionGuide(n)?.tags || [];
      return t.includes("frontline") || t.includes("engage");
    });
  }

  function hasScalingCarry(names) {
    return names.some((n) => SCALING_CARRIES().has(n) || getChampionGuide(n)?.tags?.includes("scaling"));
  }

  /** Situation draft pour decision table + trap risk. */
  function analyzeDraftSituation(ctx = {}) {
    const allies = ctx.allies || ctx.ourNames || [];
    const opp = ctx.oppNames || ctx.enemyNames || [];
    const tags = teamTags(allies);
    const oppTags = teamTags(opp);

    const firstPick = !allies.length;
    const unknownEnemy = opp.length <= 1;
    const scalingCarry = hasScalingCarry(allies);
    const peelReady = hasPeel(allies);
    const frontReady = hasFrontline(allies);
    const enemyDive = opp.some((n) => DIVE_ENEMY().has(n));
    const enemyHeavyPeel = opp.filter((n) => PEEL_CHAMPS().has(n)).length >= 2;
    const enemyHardCc = opp.some((n) => HARD_CC_ENEMY().has(n));
    const enemyFragileBackline = opp.some((n) => FRAGILE_CARRY().has(n));
    const lacksDamage = allies.length >= 2 && !tags.has("marksman") && !tags.has("mage_burst") && !tags.has("burst");
    const lacksEarlyObjective =
      allies.length >= 2 &&
      !allies.some((n) => guide?.safePickJobs?.objective_tempo?.champions?.includes(n)) &&
      !tags.has("lane_priority") &&
      !tags.has("aggressive_jungle");
    const losingBeforeScaling = scalingCarry && !frontReady && allies.length >= 2;

    return {
      firstPick,
      unknownEnemy,
      hasScalingCarry: scalingCarry,
      scalingWithoutPeel: scalingCarry && !peelReady,
      scalingWithoutFront: scalingCarry && !frontReady,
      enemyHeavyDive: enemyDive,
      enemyHeavyPeel,
      enemyHardCc,
      enemyFragileBackline,
      lacksDamage,
      lacksEarlyObjective,
      losingBeforeScaling,
      peelReady,
      frontReady,
      oppTags,
      tags,
    };
  }

  function conditionMatches(ruleWhen, sit) {
    const map = {
      scalingWithoutPeel: sit.scalingWithoutPeel,
      scalingWithoutFront: sit.scalingWithoutFront,
      enemyHardCc: sit.enemyHardCc,
      enemyHeavyPeel: sit.enemyHeavyPeel,
    };
    return Boolean(map[ruleWhen]);
  }

  function evaluateTrapRisks(champName, sit, allies = []) {
    const warnings = [];
    let penalty = 0;
    for (const rule of guide?.trapRiskRules || []) {
      if (rule.champion && rule.champion !== champName) continue;
      const applies =
        (rule.when === "trapRiskCandidate" && getPickTypes(champName).includes("scaling_carry") && !sit.frontReady && !sit.peelReady) ||
        conditionMatches(rule.when, sit) ||
        (rule.when === "scalingWithoutPeel" && champName === "Tireur" && !hasPeel(allies) && !hasPeel([champName])) ||
        (rule.when === "scalingWithoutFront" && champName === "Tireur" && !hasFrontline(allies) && !hasFrontline([champName]));
      if (!applies) continue;
      penalty += rule.penalty || -40;
      warnings.push({ id: rule.id, messageFr: rule.messageFr });
    }
    if (sit.firstPick && getPickTypes(champName).includes("scaling_carry")) {
      penalty -= 50;
      warnings.push({ id: "blind_scaling", messageFr: "Ne pas blind-pick scaling sans shell" });
    }
    if (sit.firstPick && getPickTypes(champName).includes("counter_pick")) {
      penalty -= 28;
      warnings.push({ id: "early_counter", messageFr: "Counter-pick trop tôt en blind" });
    }
    return { penalty, warnings };
  }

  function applyDecisionTable(champName, sit, score, reasons) {
    const types = getPickTypes(champName);
    let delta = 0;
    const rationale = [];

    for (const rule of guide?.decisionTable || []) {
      let active = false;
      switch (rule.condition) {
        case "firstPick":
          active = sit.firstPick;
          break;
        case "unknownEnemy":
          active = sit.unknownEnemy;
          break;
        case "hasScalingCarry":
          active = sit.hasScalingCarry;
          break;
        case "enemyFragileBackline":
          active = sit.enemyFragileBackline;
          break;
        case "enemyHeavyDive":
          active = sit.enemyHeavyDive;
          break;
        case "lacksDamage":
          active = sit.lacksDamage;
          break;
        case "lacksEarlyObjective":
          active = sit.lacksEarlyObjective;
          break;
        case "losingBeforeScaling":
          active = sit.losingBeforeScaling;
          break;
        case "trapRiskCandidate":
          active = getPickTypes(champName).includes("scaling_carry") && !sit.frontReady && !sit.peelReady;
          break;
        default:
          active = false;
      }
      if (!active) continue;

      const preferType = rule.preferTypes?.some((t) => types.includes(t));
      const avoidType = rule.avoidTypes?.some((t) => types.includes(t));
      const preferChamp = rule.preferChampions?.includes(champName);
      const avoidChamp = rule.avoidChampions?.includes(champName);

      if (preferType || preferChamp) {
        delta += rule.bonus || 24;
        if (rule.rationaleFr && rationale.length < 4) rationale.push(rule.rationaleFr);
      } else if (avoidType || avoidChamp) {
        delta += rule.penalty || -20;
        if (rule.rationaleFr && rationale.length < 4) rationale.push(rule.rationaleFr);
      } else if (rule.penalty && rule.condition === "trapRiskCandidate") {
        delta += rule.penalty;
        if (rule.rationaleFr) rationale.push(rule.rationaleFr);
      }
    }

    return { delta, rationale };
  }

  function getSniperDraftState(ctx = {}) {
    const allies = ctx.allies || ctx.ourNames || [];
    const sit = analyzeDraftSituation(ctx);
    const taken = ctx.takenNames || new Set();
    const peelBanned = [...PEEL_CHAMPS()].some((n) => taken.has(n) && !allies.includes(n));
    const frontBanned = ["Chevalier de cavalerie", "Porteur de bouclier", "Combattant", "Moine"].some(
      (n) => taken.has(n) && !allies.includes(n)
    );
    const volatile =
      ctx.playerTraits?.includes("high_aggression") || ctx.playerTraits?.includes("volatile_mental");

    if (sit.firstPick || (sit.unknownEnemy && !sit.frontReady)) return { state: "risky_blind", ...guide?.sniperStates?.risky_blind };
    if (!hasPeel(allies) || sit.enemyHeavyDive) return { state: "trap_risk", ...guide?.sniperStates?.trap_risk };
    if (peelBanned || frontBanned) return { state: "ban_dependent", ...guide?.sniperStates?.ban_dependent };
    if (volatile) return { state: "player_fit_problem", ...guide?.sniperStates?.player_fit_problem };
    if (hasFrontline(allies) && hasPeel(allies)) return { state: "good_scaling_pick", ...guide?.sniperStates?.good_scaling_pick };
    return { state: "risky_blind", ...guide?.sniperStates?.risky_blind };
  }

  /** Patterns multi-sessions pour rotation shell / adaptation IA. */
  function analyzeSessionPatterns(allSessions = [], opts = {}) {
    const ourSide = opts.ourSide || "blue";
    const patterns = {
      ourShellIds: [],
      ourOpeners: [],
      enemyFirstPicks: [],
      ourBanStreak: [],
      adaptations: [],
    };
    if (!allSessions?.length) return patterns;

    for (const sess of allSessions) {
      const picks = sess.picks?.[ourSide] || [];
      const names = picks.map((p) => p.name);
      if (names.length) {
        patterns.ourOpeners.push(names[0]);
        const det = detectShell(names);
        if (det?.shell?.id) patterns.ourShellIds.push(det.shell.id);
      }
      const enemySide = ourSide === "blue" ? "red" : "blue";
      const enPicks = sess.picks?.[enemySide] || [];
      if (enPicks[0]?.name) patterns.enemyFirstPicks.push(enPicks[0].name);
      const lastBan = (sess.bans?.[ourSide] || []).filter(Boolean).slice(-1)[0];
      if (lastBan) patterns.ourBanStreak.push(lastBan);
    }

    const streak = (arr, val) => {
      let c = 0;
      for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i] === val) c++;
        else break;
      }
      return c;
    };

    for (const pat of guide?.aiAdaptationPatterns || []) {
      if (pat.detect?.enemyFirstPicks) {
        const count = patterns.enemyFirstPicks.filter((n) => pat.detect.enemyFirstPicks.includes(n)).length;
        if (count >= (pat.detect.minCount || 2)) patterns.adaptations.push(pat);
      }
      if (pat.detect?.ourOpeners) {
        const opener = pat.detect.ourOpeners[0];
        if (streak(patterns.ourOpeners, opener) >= (pat.detect.streakMin || 3)) patterns.adaptations.push(pat);
      }
      if (pat.detect?.sameBanStreak && patterns.ourBanStreak.length >= 2) {
        const last = patterns.ourBanStreak[patterns.ourBanStreak.length - 1];
        if (streak(patterns.ourBanStreak, last) >= (pat.detect.sameBanStreak || 3)) patterns.adaptations.push(pat);
      }
      if (pat.detect?.ourShellStreak) {
        const ids = pat.detect.ourShellStreak;
        const recent = patterns.ourShellIds.slice(-(pat.detect.streakMin || 3));
        if (recent.length >= (pat.detect.streakMin || 3) && recent.every((id) => ids.includes(id))) {
          patterns.adaptations.push(pat);
        }
      }
    }

    patterns.adaptations = [...new Map(patterns.adaptations.map((a) => [a.id, a])).values()];
    return patterns;
  }

  function getPickMeta(champName, ctx = {}) {
    const label = getChampionLabel(champName);
    const types = getPickTypes(champName);
    const sit = analyzeDraftSituation(ctx);
    const trap = evaluateTrapRisks(champName, sit, ctx.allies || ctx.ourNames || []);
    const decision = applyDecisionTable(champName, sit, 0, []);
    const primaryType = label?.earlyLabel || types[0] || "flex";
    const safeVsScaling =
      types.includes("scaling_carry") || primaryType === "scaling_carry"
        ? "scaling"
        : types.includes("safe_blind") || types.includes("objective_pick")
          ? "safe"
          : types.includes("counter_pick")
            ? "counter"
            : "flex";

    let sniperState = null;
    if (champName === "Tireur") sniperState = getSniperDraftState(ctx);

    return {
      pickTypes: types,
      pickTypeLabelFr: pickTypeLabelFr(primaryType),
      primaryType,
      safeVsScaling,
      earlyLabel: label?.earlyLabel,
      whyItFits: label?.whyItFits,
      draftWith: label?.draftWith,
      watchOutFor: label?.watchOutFor,
      trapWarnings: trap.warnings,
      decisionRationale: decision.rationale,
      sniperState,
      situation: sit,
    };
  }

  function getReplacementChain(coreName) {
    const cg = getChampionGuide(coreName);
    return (
      guide?.replacementChains?.[coreName] ||
      cg?.replacementIfBanned ||
      cg?.ifBanned ||
      []
    );
  }

  function tierTiebreaker(name, metaMap) {
    const t = metaMap?.[name]?.tierMeta || "C";
    return TIER_TB[t] ?? 2;
  }

  /** Détecte le shell le plus proche d'une liste de champions. */
  function detectShell(names) {
    if (!names?.length) return null;
    let best = null;
    let bestScore = 0;
    for (const shell of shells()) {
      const pool = new Set(shell.champions);
      if (shell.altSlots) Object.values(shell.altSlots).flat().forEach((n) => pool.add(n));
      const overlap = names.filter((n) => pool.has(n)).length;
      const score = overlap / shell.champions.length;
      if (score > bestScore) {
        bestScore = score;
        best = shell;
      }
    }
    if (!best || bestScore < 0.2) return null;
    return {
      shell: best,
      confidence: Math.round(bestScore * 100) / 100,
      overlap: names.filter((n) => best.champions.includes(n)),
    };
  }

  /** Sélection shell : en cours > adaptation session > contre adverse > rotation B1. */
  function recommendShell(enemyNames, ourNames, ctx = {}) {
    const ourDet = detectShell(ourNames);
    if (ourDet && ourDet.confidence >= 0.35) {
      return { shell: ourDet.shell, reason: `Shell en cours — ${ourDet.shell.labelFr}`, source: "ours" };
    }

    const patterns = ctx.sessionPatterns || analyzeSessionPatterns(ctx.allSessions, { ourSide: ctx.ourSide });
    const adaptation = patterns.adaptations?.[0];
    if (adaptation?.rotateShells?.length) {
      const shellIds = adaptation.rotateShells.filter((id) => guide?.compShells?.[id]);
      const rot = (ctx.sessionIndex ?? 0) + (ctx.banCount ?? 0);
      const pickId = shellIds[rot % shellIds.length];
      const shell = guide.compShells[pickId];
      if (shell) {
        return {
          shell,
          reason: adaptation.responseFr || `Rotation — ${shell.labelFr}`,
          source: "adapt",
          adaptation,
        };
      }
    }

    const enemyDet = detectShell(enemyNames);
    if (enemyNames.some((n) => n === "Tireur") && !ourNames.length) {
      const safeShell = guide.compShells?.safe_objective || guide.compShells?.archer_priest_kite;
      if (safeShell) {
        return {
          shell: safeShell,
          reason: "Adv. Tireur visible → opener safe / anti-dive",
          source: "counter_sniper",
        };
      }
    }

    if (enemyDet?.shell?.style && guide?.shellCounters?.[enemyDet.shell.style]) {
      const counterId = guide.shellCounters[enemyDet.shell.style];
      const counterShell = guide.compShells?.[counterId];
      if (counterShell) {
        return {
          shell: counterShell,
          reason: `Contre ${enemyDet.shell.labelFr} → ${counterShell.labelFr}`,
          source: "counter",
          enemyShell: enemyDet.shell,
        };
      }
    }

    if (hasScalingCarry(enemyNames) && !ourNames.length) {
      const anti = guide.compShells?.anti_scaling;
      if (anti) {
        return { shell: anti, reason: "Carry scaling adverse → shell anti-scaling", source: "anti_scaling" };
      }
    }

    const shellIds = Object.keys(guide?.compShells || {});
    const rot = (ctx.sessionIndex ?? 0) + (ctx.banCount ?? 0) + (ctx.draftSeed ?? 0);
    const pickId = shellIds[rot % shellIds.length];
    const shell = guide.compShells[pickId];
    const anchor = shell.firstPickAnchors?.[rot % (shell.firstPickAnchors?.length || 1)];
    return {
      shell,
      reason: `Rotation shell — B1 ${anchor || shell.champions[0]} (${shell.labelFr})`,
      source: "rotate",
      b1Anchor: anchor,
      sessionPatterns: patterns,
    };
  }

  function bannedCores(ourNames, takenNames) {
    const cores = [];
    for (const [core, chain] of Object.entries(guide?.replacementChains || {})) {
      if (takenNames.has(core) && !ourNames.includes(core)) cores.push({ core, chain });
    }
    return cores;
  }

  function nextPickInOrder(shell, allies) {
    const order = shell.pickOrder || shell.champions || [];
    return order.find((c) => !allies.includes(c)) || null;
  }

  function slotForChampion(shell, champName) {
    if (!shell?.slots) return null;
    for (const [slot, name] of Object.entries(shell.slots)) {
      if (name === champName) return slot;
    }
    if (shell.altSlots) {
      for (const [slot, alts] of Object.entries(shell.altSlots)) {
        if (alts.includes(champName)) return slot;
      }
    }
    return null;
  }

  function shellDistinctPenalty(shell, champName) {
    if (!shell?.distinctFrom) return 0;
    for (const [wrong, msg] of Object.entries(shell.distinctFrom)) {
      if (champName === wrong) return -55;
    }
    return 0;
  }

  function replacementRank(champName, core, chain) {
    const idx = chain.indexOf(champName);
    if (idx < 0) return 0;
    if (idx === 0) return 92;
    if (idx === 1) return 78;
    if (idx === 2) return 62;
    return 40 - idx * 4;
  }

  function scoreGuidePick(champName, ctx = {}) {
    const {
      allies = [],
      oppNames = [],
      phase = "core",
      takenNames,
      playerTraits,
      metaMap,
      sessionIndex = 0,
      banCount = 0,
      draftSeed = 0,
      allSessions,
      sessionPatterns,
      ourSide,
    } = ctx;

    let score = 0;
    const reasons = [];
    const pickCtx = { allies, oppNames, ourNames: allies, enemyNames: oppNames, takenNames, playerTraits, allSessions, ourSide };
    const sit = analyzeDraftSituation(pickCtx);
    const pickMeta = getPickMeta(champName, pickCtx);

    const rec = recommendShell(oppNames, allies, {
      sessionIndex,
      banCount,
      draftSeed,
      allSessions,
      sessionPatterns,
      ourSide,
    });
    const shell = rec.shell;
    const cg = getChampionGuide(champName);

    if (!shell) return { score: tierTiebreaker(champName, metaMap), reasons: ["Pas de shell"], pickMeta };

    const distinctPen = shellDistinctPenalty(shell, champName);
    if (distinctPen < 0) {
      score += distinctPen;
      const msg = shell.distinctFrom?.[champName];
      reasons.push(msg || "Mauvais carry pour ce shell");
    }

    if (shell.champions?.includes(champName)) {
      const missing = shell.champions.filter((c) => !allies.includes(c) && c !== champName);
      score += 52 + missing.length * 8;
      reasons.push(`Shell ${shell.labelFr}`);
    }

    const nextPick = nextPickInOrder(shell, allies);
    if (nextPick === champName) {
      score += 44;
      reasons.push(`Prochain pick shell (${champName})`);
    }

    if (shell.firstPickAnchors?.includes(champName) && !allies.length) {
      const anchorIdx = shell.firstPickAnchors.indexOf(champName);
      const rotIdx = (sessionIndex + banCount + draftSeed) % shell.firstPickAnchors.length;
      const rotBonus = anchorIdx === rotIdx ? 42 : 20;
      score += rotBonus;
      reasons.push(anchorIdx === rotIdx ? `B1 rotation — ${champName}` : "Ancre shell flex");
    }

    if (pickMeta.pickTypeLabelFr) {
      reasons.push(`Type: ${pickMeta.pickTypeLabelFr}`);
    }

    const decision = applyDecisionTable(champName, sit, score, reasons);
    score += decision.delta;
    decision.rationale.forEach((r) => {
      if (reasons.length < 7) reasons.push(r);
    });

    const trap = evaluateTrapRisks(champName, sit, allies);
    score += trap.penalty;
    trap.warnings.slice(0, 2).forEach((w) => reasons.push(`⚠ ${w.messageFr}`));

    if (sit.hasScalingCarry && getPickTypes(champName).includes("scaling_carry") && champName !== "Tireur") {
      score -= 25;
      reasons.push("Déjà un carry scaling");
    }

    if (shell.id === "sniper_scaling" && champName === "Tireur" && sit.frontReady && sit.peelReady) {
      score += 35;
      reasons.push("Shell Tireur scaling complet");
    }

    if (shell.id === "safe_objective" && guide?.safePickJobs) {
      for (const job of Object.values(guide.safePickJobs)) {
        if (job.champions?.includes(champName)) {
          score += 14;
          if (reasons.length < 8) reasons.push(`Job safe: ${job.labelFr}`);
          break;
        }
      }
    }

    if (cg) {
      for (const e of oppNames) {
        if (cg.goodInto?.includes(e)) {
          score += 26;
          if (reasons.length < 8) reasons.push(`Fort vs ${e}`);
        }
        if (cg.watchOut?.includes(e)) {
          score -= 32;
          if (reasons.length < 9) reasons.push(`⚠ ${e} counter`);
        }
      }
    }

    const taken = takenNames || new Set();
    for (const { core, chain } of bannedCores(allies, taken)) {
      const rep = replacementRank(champName, core, chain);
      if (rep > 0) {
        score += rep;
        const step = chain.indexOf(champName) + 1;
        reasons.push(`${core} banni → pivot ${step} (${champName})`);
        break;
      }
    }

    if (playerTraits?.length) {
      for (const trait of playerTraits) {
        const syn = guide.playerTraits?.traitSynergies?.[trait];
        if (syn?.bonus?.includes(champName)) {
          score += 22;
          reasons.push(`Trait ${trait}`);
        }
      }
      const agg = playerTraits.includes("high_aggression")
        ? guide.playerTraits?.aggression?.high
        : playerTraits.includes("low_aggression")
          ? guide.playerTraits?.aggression?.low
          : null;
      if (agg?.includes(champName)) score += 12;

      const roam = playerTraits.includes("high_roaming")
        ? guide.playerTraits?.roaming?.high
        : playerTraits.includes("low_roaming")
          ? guide.playerTraits?.roaming?.low
          : null;
      if (roam?.includes(champName)) score += 10;
    }

    if (phase === "opening" && !allies.length && cg?.shells?.length) {
      if (cg.shells.includes(shell.id)) score += 16;
    }

    score += tierTiebreaker(champName, metaMap) * 0.35;

    return {
      score: Math.round(score * 10) / 10,
      reasons: [...new Set(reasons)].slice(0, 8),
      shell: rec,
      pickMeta,
      situation: sit,
    };
  }

  function scoreThreatBan(champName, ourNames, enemyNames, ctx = {}) {
    let score = 0;
    const reasons = [];
    const rec = recommendShell(enemyNames, ourNames, ctx);
    const ourShell = detectShell(ourNames)?.shell || rec.shell;
    const enemyShell = detectShell(enemyNames)?.shell;
    const cg = getChampionGuide(champName);

    if (ourShell?.cannotAnswer?.includes(champName)) {
      score += 90;
      reasons.push(`Menace vs ${ourShell.labelFr}`);
    }
    if (ourShell?.banPriority?.includes(champName)) {
      const rank = ourShell.banPriority.indexOf(champName);
      score += 75 - rank * 11;
      if (!reasons.length) reasons.push(`Ban prio shell — ${ourShell.labelFr}`);
    }

    for (const rule of Object.values(guide?.banPhilosophy?.threats || {})) {
      if (rule.whenOurShell && ourShell && !rule.whenOurShell.includes(ourShell.id)) continue;
      if (rule.whenEnemyHas && !enemyNames.some((n) => rule.whenEnemyHas.includes(n))) continue;
      if (rule.ban?.includes(champName)) {
        score += 60;
        reasons.push(`Threat ban — ${rule.label || "profil adverse"}`);
      }
    }

    if (enemyShell) {
      const completes = enemyShell.champions.filter((c) => !enemyNames.includes(c));
      if (completes.includes(champName)) {
        score += 46;
        reasons.push(`Complète ${enemyShell.labelFr}`);
      }
      for (const e of enemyNames) {
        const eg = getChampionGuide(e);
        if (eg?.watchOut?.includes(champName)) {
          score += 38;
          reasons.push(`Répond à ${e}`);
          break;
        }
      }
    }

    for (const o of ourNames) {
      const og = getChampionGuide(o);
      if (og?.watchOut?.includes(champName)) {
        score += 54;
        reasons.push(`Counter notre ${o}`);
        break;
      }
      if (cg?.goodInto?.includes(o)) {
        score += 42;
        reasons.push(`Fort vs notre ${o}`);
        break;
      }
    }

    const carryTags = ["Archer", "Tireur", "Soldat", "Joueur"];
    if (
      enemyNames.some((n) => carryTags.includes(n)) &&
      ["Ninja", "Démon", "Exécuteur"].includes(champName)
    ) {
      score += 36;
      if (!reasons.some((r) => r.includes("carry"))) reasons.push("Anti-carry fragile adverse");
    }

    if (
      ourShell &&
      ["sniper_front_to_back", "archer_priest_kite"].includes(ourShell.id) &&
      ["Ninja", "Démon", "Exécuteur", "Bombardier"].includes(champName)
    ) {
      score += 28;
      reasons.push("Anti-dive vs notre backline");
    }

    score += tierTiebreaker(champName, ctx.metaMap) * 0.25;

    return {
      score: Math.round(score * 10) / 10,
      reasons: [...new Set(reasons)].slice(0, 6),
      ourShell,
      enemyShell,
      shellRec: rec,
    };
  }

  function scorePickCandidate(champName, ctx = {}) {
    const { openSlots = SLOTS, hintSlot, metaMap, byName } = ctx;
    const gp = scoreGuidePick(champName, ctx);
    const shell = gp.shell?.shell;
    const idealSlot = slotForChampion(shell, champName);
    const slots = openSlots.length ? openSlots : SLOTS;

    let bestSlot = idealSlot && slots.includes(idealSlot) ? idealSlot : slots[0];
    let slotBonus = 0;

    if (idealSlot) {
      if (slots.includes(idealSlot)) {
        bestSlot = idealSlot;
        slotBonus = 18;
      } else if (hintSlot === idealSlot) slotBonus = 8;
    }
    if (hintSlot && slots.includes(hintSlot)) {
      if (hintSlot === idealSlot) slotBonus += 12;
      else if (!idealSlot) bestSlot = hintSlot;
    }

    const c = byName?.get?.(champName);
    const opts = c?.optimalSlots || metaMap?.[champName]?.optimalSlots || [];
    if (opts.includes(bestSlot)) slotBonus += 4;

    let score = gp.score + slotBonus;
    const reasons = [...gp.reasons];
    if (idealSlot && bestSlot === idealSlot) reasons.push(`Poste shell ${idealSlot}`);
    if (hintSlot === bestSlot) reasons.push(`Focus ${hintSlot}`);

    return {
      score: Math.round(score * 10) / 10,
      slot: bestSlot,
      reasons: [...new Set(reasons)].slice(0, 8),
      shell: gp.shell,
      pickMeta: gp.pickMeta,
      situation: gp.situation,
    };
  }

  function scoreBanCandidate(champName, ctx = {}) {
    const { ourNames = [], oppNames = [] } = ctx;
    return scoreThreatBan(champName, ourNames, oppNames, ctx);
  }

  function serpenHint(shell, allies = []) {
    if (!shell?.serpen) return null;
    const sp = shell.serpen;
    const have = allies.filter((n) => sp.champions?.includes(n));
    const rule = guide?.serpenRules?.[sp.plan];
    const parts = [sp.label || sp.plan];
    if (have.length) parts.push(`Clés: ${have.slice(0, 3).join(", ")}`);
    if (rule?.burn_fast?.length && sp.plan === "fight_early") {
      parts.push(`Burn: ${rule.burn_fast.slice(0, 2).join(", ")}`);
    }
    const checks = (sp.checks || [])
      .map((c) => {
        const map = {
          jungler_alive: "JG vivant",
          correct_side: "bon côté",
          lanes_mobile: "lanes mobiles",
          early_damage_cc: "dmg/CC early",
          lanes_can_trade: "lanes trade",
          peel_ready: "peel prêt",
          backline_access: "accès backline",
          follow_up_cc: "follow-up CC",
        };
        return map[c] || c;
      })
      .join(" · ");
    if (checks) parts.push(`Check: ${checks}`);
    return parts.join(" · ");
  }

  function morgardHint(shell) {
    if (!shell?.morgard) return null;
    const mg = shell.morgard;
    const rule = guide?.morgardRules?.[mg.plan];
    const tactic = rule?.tactic || mg.tactics?.morgard;
    const needs = mg.draftNeeds?.length ? ` · besoin ${mg.draftNeeds.slice(0, 3).join(", ")}` : "";
    return `${mg.label || mg.plan}${tactic ? ` (${tactic})` : ""}${needs}`;
  }

  function coachDraftHint(ctx = {}) {
    const { ourNames = [], enemyNames = [], stepType, playerTraits, allSessions, ourSide } = ctx;
    const parts = [];
    const patterns = ctx.sessionPatterns || analyzeSessionPatterns(allSessions, { ourSide });
    const rec = recommendShell(enemyNames, ourNames, { ...ctx, sessionPatterns: patterns });
    const enemyDet = detectShell(enemyNames);
    const sit = analyzeDraftSituation({ allies: ourNames, oppNames: enemyNames });

    if (stepType === "ban") {
      parts.push(guide?.banPhilosophy?.principle || "Ban menaces — pas le meta");
      if (rec.shell) parts.push(`Plan: ${rec.shell.labelFr}`);
      if (enemyDet) parts.push(`Adv. → ${enemyDet.shell.labelFr} (${Math.round(enemyDet.confidence * 100)}%)`);
      if (rec.shell?.banPriority?.length) {
        const prio = rec.shell.banPriority.filter((n) => !enemyNames.includes(n)).slice(0, 3);
        if (prio.length) parts.push(`Cibles menace: ${prio.join(", ")}`);
      }
      return parts.join(" · ");
    }

    parts.push(rec.reason);
    if (sit.firstPick) parts.push("B1 → pick safe (Épéiste/Archer/Lancier/Prêtre)");
    else if (sit.hasScalingCarry && !sit.peelReady) parts.push("Priorité peel / front");
    else if (sit.enemyFragileBackline) parts.push("Fenêtre counter-pick");

    if (patterns.adaptations?.[0]?.responseFr) {
      parts.push(`Adapt: ${patterns.adaptations[0].responseFr}`);
    }

    if (enemyDet && enemyDet.confidence >= 0.3) {
      parts.push(`Adv. shell: ${enemyDet.shell.labelFr}`);
    }

    const next = nextPickInOrder(rec.shell, ourNames);
    if (next) parts.push(`Prochain: ${next}`);

    const serpen = serpenHint(rec.shell, ourNames);
    if (serpen) parts.push(`Serpent: ${serpen}`);

    const morgard = morgardHint(rec.shell);
    if (morgard) parts.push(`Morgard: ${morgard}`);

    const banned = bannedCores(ourNames, ctx.takenNames || new Set());
    if (banned[0]) {
      const chain = banned[0].chain.filter((n) => n !== banned[0].core).slice(0, 2);
      if (chain.length) parts.push(`${banned[0].core} banni → ${chain.join(" / ")}`);
    }

    if (playerTraits?.length) parts.push(`Traits: ${playerTraits.slice(0, 2).join(", ")}`);

    return parts.slice(0, 7).join(" · ");
  }

  function validateChecklist(ourNames, enemyNames, ctx = {}) {
    const rec = recommendShell(enemyNames, ourNames, ctx);
    const shell = detectShell(ourNames)?.shell || rec.shell;
    const tags = new Set();
    for (const n of ourNames) {
      const cg = getChampionGuide(n);
      (cg?.tags || []).forEach((t) => tags.add(t));
    }

    const items = (guide?.finalChecklist?.items || []).map((item) => {
      let ok = false;
      let detail = "";
      switch (item.id) {
        case "win_condition":
          ok = Boolean(shell && ourNames.length >= 3);
          detail = shell?.winCondition || shell?.labelFr || "";
          break;
        case "replacements": {
          const taken = ctx.takenNames || new Set();
          const banned = bannedCores(ourNames, taken);
          ok = banned.length === 0 || banned.every((b) => b.chain.some((c) => ourNames.includes(c)));
          detail = banned[0] ? `${banned[0].core} → ${banned[0].chain.slice(0, 2).join("/")}` : "Aucun core banni";
          break;
        }
        case "damage":
          ok = tags.has("marksman") || tags.has("mage_burst") || tags.has("burst");
          detail = [...tags].filter((t) => /marksman|mage|burst|poke/.test(t)).join(", ") || "manque DPS";
          break;
        case "engage_peel":
          ok = (tags.has("frontline") || tags.has("engage")) && (tags.has("peel") || ourNames.some((n) => /combattant|moine|porteur|prêtre/i.test(n)));
          detail = `front=${tags.has("frontline")} peel=${tags.has("peel")}`;
          break;
        case "serpen_plan":
          ok = Boolean(shell?.serpen?.plan);
          detail = serpenHint(shell, ourNames) || "";
          break;
        case "morgard_plan":
          ok = Boolean(shell?.morgard?.plan);
          detail = morgardHint(shell) || "";
          break;
        default:
          ok = false;
      }
      return { ...item, ok, detail };
    });

    const passed = items.filter((i) => i.ok).length;
    return { items, passed, total: items.length, shell, ready: passed >= items.length - 1 };
  }

  function analyzeShellMatchup(ourNames, enemyNames, ctx = {}) {
    const ourDet = detectShell(ourNames);
    const enDet = detectShell(enemyNames);
    const rec = recommendShell(enemyNames, ourNames, ctx);
    const notes = [];

    if (ourDet) notes.push(`Notre shell: ${ourDet.shell.labelFr} (${Math.round(ourDet.confidence * 100)}%)`);
    else if (rec.shell) notes.push(`Shell cible: ${rec.shell.labelFr}`);

    if (enDet) notes.push(`Shell adverse: ${enDet.shell.labelFr}`);

    if (rec.shell?.serpen?.label) notes.push(`Serpent: ${rec.shell.serpen.label}`);
    if (rec.shell?.morgard?.label) notes.push(`Morgard: ${rec.shell.morgard.label}`);

    const banned = bannedCores(ourNames, ctx.takenNames || new Set());
    if (banned[0]) {
      notes.push(`Pivot: ${banned[0].core} → ${banned[0].chain.slice(0, 3).join(" → ")}`);
    }

    const checklist = validateChecklist(ourNames, enemyNames, ctx);

    return { ourShell: ourDet, enemyShell: enDet, recommended: rec, notes, checklist };
  }

  function getDraftPlan(ctx = {}) {
    const { ourNames = [], enemyNames = [], allSessions, ourSide } = ctx;
    const patterns = ctx.sessionPatterns || analyzeSessionPatterns(allSessions, { ourSide });
    const rec = recommendShell(enemyNames, ourNames, { ...ctx, sessionPatterns: patterns });
    const shell = rec.shell;
    const sit = analyzeDraftSituation({ allies: ourNames, oppNames: enemyNames });
    const safeHint = sit.firstPick
      ? "Safe blind recommandé (Épéiste, Archer, Lancier, Prêtre)"
      : sit.hasScalingCarry && !sit.peelReady
        ? "Scaling en cours → compléter peel / front"
        : sit.unknownEnemy
          ? "Adversaire flou → structure safe"
          : null;
    const scalingHint = guide?.scalingRules?.ruleBlind || null;
    const trapWarnings = [];
    if (ourNames.includes("Tireur") && !hasPeel(ourNames)) {
      trapWarnings.push("Tireur sans peel — risque trap");
    }
    if (sit.enemyHeavyDive && !hasPeel(ourNames)) {
      trapWarnings.push("Dive adverse sans réponse peel");
    }

    return {
      shell: shell?.labelFr,
      shellId: shell?.id,
      reason: rec.reason,
      pickOrder: (shell?.pickOrder || []).filter((c) => !ourNames.includes(c)),
      nextPick: nextPickInOrder(shell, ourNames),
      banPriority: (shell?.banPriority || []).filter((n) => !enemyNames.includes(n)),
      serpen: serpenHint(shell, ourNames),
      morgard: morgardHint(shell),
      checklist: validateChecklist(ourNames, enemyNames, ctx),
      safeHint,
      scalingHint,
      trapWarnings,
      situation: sit,
      sessionAdaptation: patterns.adaptations?.[0]?.responseFr || null,
      sniperState: ourNames.includes("Tireur") || shell?.id?.includes("sniper")
        ? getSniperDraftState({ allies: ourNames, oppNames: enemyNames, takenNames: ctx.takenNames })
        : null,
    };
  }

  const api = {
    setGuideData,
    shells,
    getChampionGuide,
    getChampionLabel,
    getPickTypes,
    getPickMeta,
    getReplacementChain,
    detectShell,
    recommendShell,
    analyzeDraftSituation,
    analyzeSessionPatterns,
    evaluateTrapRisks,
    getSniperDraftState,
    pickTypeLabelFr,
    scoreGuidePick,
    scoreThreatBan,
    scorePickCandidate,
    scoreBanCandidate,
    serpenHint,
    morgardHint,
    coachDraftHint,
    validateChecklist,
    analyzeShellMatchup,
    getDraftPlan,
    bannedCores,
    nextPickInOrder,
    slotForChampion,
    GUIDE: () => guide,
    SLOTS,
  };

  global.TFM2GuideDraftEngine = api;
  global.TFM2DraftGuide = api;
})(typeof window !== "undefined" ? window : globalThis);
