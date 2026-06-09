/**
 * TFM2 Tactics Engine v2 — rebuild MOBA/objective logic (pre-match settings only).
 *
 * Pipeline: analyzeGameState → recommendTactics → validate + hard rules
 * Public: recommend(), scoreTacticsAlternative(), templates as presets only.
 */
(function (global) {
  const MC = () => global.TFM2MatchCore;
  const SLOTS = MC()?.SLOTS || ["Top", "Jungle", "Mid", "Bot", "Support"];

  let GUIDE = null;
  let TACTIC_OPTIONS = null;

  const TACTIC_ORDER = [
    "focusLane", "earlyJungle", "earlySerpent", "topSerpent", "waveMgmt",
    "objectivePrep", "objectiveCombat", "objectiveFinish", "morgard",
    "towerSiege", "defense", "closing",
  ];

  const OBJECTIVE_DECISION = {
    serpent_rush: "contest",
    morgard_5v5: "contest",
    pick_comp: "pick",
    scale_late: "delay",
    side_trade: "trade",
    stabilize: "defend",
    balanced: "flex",
  };

  const ARCHETYPE_IDS = {
    serpent_rush: "early_serpent_pressure",
    morgard_5v5: "protect_scale",
    pick_comp: "pick_before_morgard",
    scale_late: "protect_scale",
    side_trade: "side_pressure_trade",
    stabilize: "behind_stabilize",
    balanced: "balanced",
  };

  const SERPEN_CHECKS = {
    jungler_alive: "Jungler vivant au timer",
    correct_side: "Bon côté / vision pit",
    lanes_mobile: "Lanes mobiles (pas stuck)",
    early_damage_cc: "Dégâts + CC early prêts",
    lanes_can_trade: "Lanes peuvent trader",
    peel_ready: "Peel prêt pour carry",
    backline_access: "Accès backline adverse",
    follow_up_cc: "Follow-up CC après pick",
  };

  const SCALE_CARRIES = new Set([
    "Tireur", "Chasseur de fléchettes empoisonnées", "Archer", "Fantôme", "Chasseur de boomerang",
  ]);
  const PEEL_SUPPORTS = new Set([
    "Prêtre", "Moine", "Porteur de bouclier", "Esprit gardien", "Pythonisse",
    "Androïde", "Enchanteur", "Barde",
  ]);
  const PICK_CORE = new Set([
    "Ninja", "Démon", "Clown", "Inquisiteur", "Chasseur", "Tueur à gages",
    "Exécuteur", "Mage des ombres", "Double lame", "Mage noir",
  ]);
  const AGGRESSIVE_JG = new Set(["Lancier", "Combattant", "Berserker", "Briseur de siège"]);
  const SLOW_ENEMY_JG = new Set(["Ogre", "Fantôme", "Nécromancien", "Vampire", "Druide", "Maître du fouet"]);
  const SIDE_TRADE = new Set(["Pyromancien", "Chevalier de cavalerie", "Épéiste", "Soldat", "Vampire"]);
  const SPLIT_PUSHERS = new Set([
    "Vampire", "Pyromancien", "Chevalier de cavalerie", "Épéiste", "Berserker",
    "Soldat", "Ninja", "Clown", "Chasseur de boomerang",
  ]);
  const DIVE_THREATS = new Set(["Ninja", "Démon", "Exécuteur", "Double lame", "Chasseur", "Clown"]);

  const LANE_W = { Top: 2.25, Jungle: 1.1, Mid: 1.0, Bot: 1.2, Support: 2.0 };

  function setGuide(data) {
    GUIDE = data && typeof data === "object" ? data : null;
  }

  function setTacticOptions(opts) {
    TACTIC_OPTIONS = opts && typeof opts === "object" ? opts : null;
  }

  function getGuide() {
    return GUIDE;
  }

  function hasTag(name, tag, metaMap) {
    return MC()?.hasTag?.(name, tag, metaMap) || metaMap[name]?.tags?.includes(tag) || false;
  }

  function countTags(comp, metaMap, tag) {
    return SLOTS.filter((s) => comp[s] && hasTag(comp[s], tag, metaMap)).length;
  }

  function compValues(comp) {
    return SLOTS.map((s) => comp[s]).filter(Boolean);
  }

  function countFrontline(comp, metaMap) {
    let n = countTags(comp, metaMap, "frontline");
    for (const slot of SLOTS) {
      const name = comp[slot];
      if (!name || hasTag(name, "frontline", metaMap)) continue;
      if ((metaMap[name]?.draftProfile?.tankWeight ?? 0) >= 0.88) n += 1;
    }
    return n;
  }

  function lanesCanMove(lanes) {
    return lanes.Mid?.verdict !== "lose" && (lanes.Bot?.verdict !== "lose" || lanes.Top?.verdict !== "lose");
  }

  function lanePressure(lanes) {
    let net = 0;
    for (const slot of SLOTS) {
      const lm = lanes[slot];
      if (!lm) continue;
      const w = LANE_W[slot] || 1;
      if (lm.verdict === "win") net += w;
      else if (lm.verdict === "lose") net -= w;
    }
    return net;
  }

  function countLaneWins(lanes) {
    return SLOTS.filter((s) => lanes[s]?.verdict === "win").length;
  }

  function findCarry(comp, metaMap) {
    let best = null;
    for (const slot of ["Bot", "Mid", "Top"]) {
      const name = comp[slot];
      if (!name) continue;
      const dp = metaMap[name]?.draftProfile || {};
      const score = (dp.dpsWeight ?? 0) + (SCALE_CARRIES.has(name) ? 0.35 : 0) + (slot === "Bot" ? 0.15 : 0);
      if (!best || score > best.score) best = { name, slot, score };
    }
    return best;
  }

  function rankSplitters(comp, metaMap, lanes) {
    const out = [];
    for (const slot of SLOTS) {
      const name = comp[slot];
      if (!name || MC()?.SPLIT_EXCLUDE?.has(name)) continue;
      let score = 0;
      if (SPLIT_PUSHERS.has(name)) score += 50;
      if (MC()?.SPLITTERS?.has(name)) score += 40;
      if (hasTag(name, "split", metaMap)) score += 30;
      if (slot === "Top") score += 18;
      if (lanes[slot]?.verdict === "win") score += 12;
      else if (lanes[slot]?.verdict === "lose") score -= 18;
      if (score >= 36) out.push({ name, slot, score });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  function refineLanes(lanes, ourComp, enemyComp) {
    const out = { ...lanes };
    if (
      enemyComp.Bot === "Chevalier de cavalerie" &&
      ourComp.Bot &&
      SCALE_CARRIES.has(ourComp.Bot) &&
      out.Bot?.verdict !== "win"
    ) {
      out.Bot = {
        verdict: "lose",
        note: `${enemyComp.Bot} menace ${ourComp.Bot} — babysitter bot requis.`,
      };
    }
    return out;
  }

  function detectShell(names) {
    const DG = global.TFM2GuideDraftEngine || global.TFM2DraftGuide;
    if (!DG?.detectShell || !names?.length) return null;
    const det = DG.detectShell(names);
    if (!det || det.confidence < 0.35) return null;
    return det;
  }

  function detectEnemyShell(names) {
    return detectShell(names);
  }

  function jungleFit(name) {
    return GUIDE?.jungleChampionFit?.[name] || inferJungleFallback(name, {});
  }

  function inferJungleFallback(jungler, metaMap) {
    if (hasTag(jungler, "aggressive_jungle", metaMap)) {
      return { earlyJungle: "Gank", style: "aggressive", serpent: "contest", label: "Jungle agressive — tempo objectif" };
    }
    if (hasTag(jungler, "pick_jungle", metaMap) || hasTag(jungler, "assassin", metaMap)) {
      return { earlyJungle: "Gank", style: "pick", serpent: "after_advantage", label: "Jungle pick — pression backline" };
    }
    if (hasTag(jungler, "farm_jungle", metaMap)) {
      return { earlyJungle: "Farm/Couverture", style: "safe", serpent: "delay", label: "Jungle farm — scale / couverture" };
    }
    return { earlyJungle: "Farm/Couverture", style: "flex", serpent: "flexible", label: "Jungle flexible" };
  }

  function resolveJungleFit(jungler, metaMap) {
    const fromGuide = GUIDE?.jungleChampionFit?.[jungler];
    if (fromGuide) return { ...fromGuide };
    return inferJungleFallback(jungler, metaMap);
  }

  function detectHeavyFrontPeel(enemyComp) {
    const names = compValues(enemyComp);
    return names.includes("Porteur de bouclier") && names.includes("Infanterie lourde");
  }

  function detectKeyThreats(enemyComp, metaMap) {
    const names = compValues(enemyComp);
    const porteurPeel = detectHeavyFrontPeel(enemyComp);
    return {
      enemyDive: countTags(enemyComp, metaMap, "dive") + countTags(enemyComp, metaMap, "assassin") +
        names.filter((n) => DIVE_THREATS.has(n)).length,
      enemyScaleCarry: names.some((n) => SCALE_CARRIES.has(n) && hasTag(n, "scaling", metaMap)) ||
        names.filter((n) => SCALE_CARRIES.has(n)).length >= 1,
      enemyPick: names.filter((n) => PICK_CORE.has(n)).length + countTags(enemyComp, metaMap, "assassin"),
      heavyFront: porteurPeel,
      doubleFront: countFrontline(enemyComp, metaMap) >= 2,
      enemyPoke: countTags(enemyComp, metaMap, "poke") >= 2,
    };
  }

  function isBad5v5(profile) {
    return profile.cantWin5v5 || profile.threats.heavyFront;
  }

  function assessJungleMatchup(ourJg, enemyJg, jFit, enemyJgFit, lanes, enemyPeel) {
    let score = 0;
    const notes = [];
    if (AGGRESSIVE_JG.has(ourJg) && enemyJg && SLOW_ENEMY_JG.has(enemyJg)) {
      score += 35;
      notes.push("Jungle ennemi lent — invade / tempo favorable.");
    }
    if (jFit.style === "pick" && enemyPeel <= 0) {
      notes.push("Peel adverse faible — gank pick viable.");
      score += 12;
    }
    if (lanes.Jungle?.verdict === "lose") {
      score -= 28;
      notes.push("Matchup jungle défavorable — réduire risque.");
    } else if (lanes.Jungle?.verdict === "win") {
      score += 18;
      notes.push("Jungle ahead — pression objectif possible.");
    }
    if (jFit.style === "safe" && AGGRESSIVE_JG.has(enemyJg)) {
      score -= 20;
      notes.push("JG ennemi agressif vs notre farm — protéger lanes.");
    }
    let verdict = "neutral";
    if (score >= 20) verdict = "favorable";
    else if (score <= -15) verdict = "unfavorable";
    return { score, verdict, notes, ourStyle: jFit.style, enemyStyle: enemyJgFit?.style || "unknown" };
  }

  function inferPowerSpike(ctx) {
    const { jFit, lanesMobile, earlyCc, ourFront, laneNet, ourScale, carry } = ctx;
    if (
      (AGGRESSIVE_JG.has(ctx.jungler) || jFit.style === "aggressive" || jFit.style === "engage") &&
      lanesMobile && ourFront >= 1 && earlyCc >= 1 && laneNet >= 0
    ) {
      return "early";
    }
    if (ourScale >= 2 || (carry && SCALE_CARRIES.has(carry.name) && ctx.ourPeel >= 1)) {
      return "late";
    }
    return "mid";
  }

  function scoreWinConditions(ctx) {
    const scores = {
      serpent_rush: 0,
      morgard_5v5: 0,
      pick_comp: 0,
      scale_late: 0,
      side_trade: 0,
      stabilize: 0,
      balanced: 10,
    };

    if (ctx.behind) scores.stabilize += 120;

    const j = ctx.jungler;
    const fit = ctx.jFit;
    const vsHeavy = isBad5v5(ctx);

    if (AGGRESSIVE_JG.has(j) || fit.style === "aggressive" || fit.style === "engage") scores.serpent_rush += 38;
    if (ctx.lanesMobile) scores.serpent_rush += 26;
    if (ctx.ourFront >= 1 && ctx.earlyCc >= 1) scores.serpent_rush += 22;
    if (ctx.ahead && !vsHeavy) scores.serpent_rush += 20;
    if (ctx.shell?.style === "front_to_back" && ctx.shellConfidence >= 0.45) scores.serpent_rush += 18;
    if (vsHeavy) scores.serpent_rush -= 55;
    if (ctx.scaleBot) scores.serpent_rush -= 32;

    if (ctx.scaleBot || ctx.ourScale >= 2) scores.scale_late += 45;
    if (ctx.ourPeel >= 1) scores.scale_late += 28;
    if (fit.style === "safe" || fit.serpent === "delay") scores.scale_late += 22;
    if (ctx.botThreat) scores.scale_late += 18;
    if (ctx.carry && SCALE_CARRIES.has(ctx.carry.name)) scores.morgard_5v5 += 35;
    if (ctx.ourFront >= ctx.enemyFront && ctx.canWin5v5) scores.morgard_5v5 += 30;

    if (ctx.ourPick >= 1 || PICK_CORE.has(j) || ctx.hasPick) scores.pick_comp += 35;
    if (vsHeavy) scores.pick_comp += 30;
    if (ctx.threats.enemyPick >= 2) scores.pick_comp += 12;
    if (ctx.canWin5v5) scores.pick_comp -= 32;

    if (vsHeavy && ctx.splits.length) scores.side_trade += 45;
    if (ctx.ourPoke >= 2) scores.side_trade += 28;
    if (ctx.hasSide) scores.side_trade += 24;
    if (fit.serpent === "delay_trade") scores.side_trade += 20;
    if (ctx.canWin5v5) scores.side_trade -= 38;
    if (ctx.shell?.style === "kite_poke") scores.side_trade += 16;

    if (ctx.shell?.style === "dive_pick" && ctx.shellConfidence >= 0.4) scores.pick_comp += 25;

    return scores;
  }

  function pickWinCondition(scores, ctx) {
    if (ctx.behind && ctx.compMargin < -20) return "stabilize";

    if (ctx.shell && ctx.shellConfidence >= 0.45) {
      const shellId = ctx.shell.id;
      const fromGuide = GUIDE?.shellIdToArchetype?.[shellId];
      if (fromGuide) {
        const mapBack = {
          early_serpent_pressure: "serpent_rush",
          protect_scale: "scale_late",
          pick_before_morgard: "pick_comp",
          side_pressure_trade: "side_trade",
          behind_stabilize: "stabilize",
        };
        if (mapBack[fromGuide]) return mapBack[fromGuide];
      }
      const styleMap = {
        front_to_back: ctx.jFit.style === "safe" ? "scale_late" : "serpent_rush",
        dive_pick: "pick_comp",
        kite_poke: "side_trade",
        safe_objective: "serpent_rush",
      };
      if (styleMap[ctx.shell.style]) return styleMap[ctx.shell.style];
    }

    let best = "balanced";
    let bestScore = -Infinity;
    for (const [k, v] of Object.entries(scores)) {
      if (v > bestScore) {
        bestScore = v;
        best = k;
      }
    }
    return best;
  }

  /**
   * @returns {import('./types').GameProfile}
   */
  function analyzeGameState(allies, enemies, metaMap, championsByName) {
    metaMap = metaMap || {};
    let lanes = MC()?.lanesFromComps?.(allies, enemies, metaMap) || {};
    lanes = refineLanes(lanes, allies, enemies);

    const ourNames = compValues(allies);
    const enemyNames = compValues(enemies);
    const shellDet = detectShell(ourNames);
    const enemyShellDet = detectEnemyShell(enemyNames);

    const jungler = allies.Jungle;
    const enemyJungler = enemies.Jungle;
    const jFit = resolveJungleFit(jungler, metaMap);
    const enemyJFit = enemyJungler ? resolveJungleFit(enemyJungler, metaMap) : null;

    const ourFront = countFrontline(allies, metaMap);
    const enemyFront = countFrontline(enemies, metaMap);
    const ourPeel = countTags(allies, metaMap, "peel") + (compValues(allies).some((n) => PEEL_SUPPORTS.has(n)) ? 1 : 0);
    const ourScale = countTags(allies, metaMap, "scaling");
    const ourPoke = countTags(allies, metaMap, "poke");
    const ourPick = compValues(allies).filter((n) => PICK_CORE.has(n)).length;
    const laneNet = lanePressure(lanes);
    const laneWins = countLaneWins(lanes);
    const carry = findCarry(allies, metaMap);
    const botThreat = lanes.Bot?.verdict === "lose";
    const splits = rankSplitters(allies, metaMap, lanes);
    const threats = detectKeyThreats(enemies, metaMap);
    const cantWin5v5 = enemyFront >= 2 && ourFront <= 1;
    const canWin5v5 = ourFront >= 1 && ourFront >= enemyFront && laneWins >= 2 && laneNet >= 0;
    const scaleBot = carry && SCALE_CARRIES.has(carry.name) && (ourPeel >= 1 || ourScale >= 1);
    const hasPick = ourPick >= 1 || PICK_CORE.has(jungler);
    const hasSide = compValues(allies).some((n) => SIDE_TRADE.has(n));
    const earlyCc = countTags(allies, metaMap, "engage") + countTags(allies, metaMap, "cc");

    let compMargin = 0;
    try {
      const cmp = global.TFM2Draft?.compareComps;
      if (cmp) {
        const r = cmp(allies, enemies, championsByName, metaMap);
        if (r?.complete) compMargin = r.margin || 0;
      }
    } catch (_) { /* ignore */ }

    const behind = laneNet <= -2 || compMargin < -30;
    const ahead = laneNet >= 2 || compMargin > 25;

    const partial = {
      allies, enemies, metaMap, lanes, jungler, enemyJungler, jFit, enemyJFit,
      ourFront, enemyFront, ourPeel, ourScale, ourPoke, ourPick,
      laneNet, laneWins, carry, botThreat, splits, threats,
      cantWin5v5, canWin5v5, behind, ahead, scaleBot, hasPick, hasSide,
      lanesMobile: lanesCanMove(lanes), earlyCc, compMargin, ourNames, enemyNames,
      shell: shellDet?.shell || null,
      shellConfidence: shellDet?.confidence || 0,
      shellDet,
      enemyShell: enemyShellDet?.shell || null,
      enemyShellConfidence: enemyShellDet?.confidence || 0,
    };

    partial.jungleMatchup = assessJungleMatchup(
      jungler,
      enemyJungler,
      jFit,
      enemyJFit,
      lanes,
      countTags(enemies, metaMap, "peel")
    );
    partial.powerSpike = inferPowerSpike(partial);
    partial.winConditionScores = scoreWinConditions(partial);
    partial.winCondition = pickWinCondition(partial.winConditionScores, partial);
    partial.archetype = ARCHETYPE_IDS[partial.winCondition] || "balanced";

    return partial;
  }

  function tactic(value, reason, assign) {
    const o = { value, reason };
    if (assign?.length) o.assign = assign;
    return o;
  }

  function scoreOption(key, value, profile) {
    const weights = OPTION_WEIGHTS[key];
    if (!weights?.[value]) return 0;
    let score = weights[value].base || 0;
    const fn = weights[value].fn;
    if (fn) score += fn(profile);
    return score;
  }

  function pickBestOption(key, profile, reasonFn) {
    const allowed = TACTIC_OPTIONS?.[key]?.values || [];
    if (!allowed.length) return tactic("", "");

    let best = allowed[0];
    let bestScore = -Infinity;
    let runnerUp = null;
    let runnerScore = -Infinity;

    for (const val of allowed) {
      const s = scoreOption(key, val, profile);
      if (s > bestScore) {
        runnerUp = best;
        runnerScore = bestScore;
        bestScore = s;
        best = val;
      } else if (s > runnerScore) {
        runnerUp = val;
        runnerScore = s;
      }
    }

    const t = tactic(best, reasonFn(best, profile), profile.splits.slice(0, 2));
    if (runnerUp && bestScore - runnerScore < 12) {
      t.runnerUp = runnerUp;
      t.margin = bestScore - runnerScore;
    }
    return t;
  }

  const OPTION_WEIGHTS = {
    focusLane: {
      "Focus Mid/Bot": {
        base: 20,
        fn: (p) => (p.botThreat ? 80 : 0) + (p.scaleBot ? 35 : 0) + (p.enemies.Bot === "Chevalier de cavalerie" ? 25 : 0),
      },
      "Focus Top/Mid": {
        base: 15,
        fn: (p) =>
          (p.winCondition === "side_trade" ? 55 : 0) +
          (p.lanes.Top?.verdict === "win" ? 20 : 0) +
          (p.hasSide && !p.botThreat ? 25 : 0),
      },
      "Toutes les Lanes": {
        base: 30,
        fn: (p) =>
          (!p.botThreat && !p.scaleBot && p.winCondition !== "side_trade" ? 40 : 0) +
          (p.winCondition === "serpent_rush" ? 25 : 0),
      },
    },
    earlyJungle: {
      Gank: {
        base: 10,
        fn: (p) => {
          let s = 0;
          if (AGGRESSIVE_JG.has(p.jungler) || p.jFit.style === "aggressive" || p.jFit.style === "engage") s += 45;
          if (PICK_CORE.has(p.jungler) || p.jFit.style === "pick") s += 30;
          if (p.lanesMobile) s += 22;
          if (p.winCondition === "serpent_rush") s += 28;
          if (p.winCondition === "pick_comp") s += 20;
          if (p.botThreat) s += 18;
          if (p.jungleMatchup.verdict === "favorable") s += 15;
          return s;
        },
      },
      "Farm/Couverture": {
        base: 15,
        fn: (p) => {
          let s = 0;
          if (p.jFit.style === "safe" || p.jFit.serpent === "delay") s += 45;
          if (p.winCondition === "scale_late" || p.scaleBot) s += 40;
          if (p.winCondition === "side_trade") s += 30;
          if (p.behind) s += 25;
          if (!p.lanesMobile) s += 20;
          if (p.jungleMatchup.verdict === "unfavorable") s += 22;
          return s;
        },
      },
      "Contre-Jungle": {
        base: 5,
        fn: (p) => {
          let s = 0;
          if (p.enemyJungler && SLOW_ENEMY_JG.has(p.enemyJungler) && AGGRESSIVE_JG.has(p.jungler)) s += 55;
          if (p.jungleMatchup.verdict === "favorable" && p.ahead) s += 25;
          if (p.lanes.Jungle?.verdict === "win") s += 20;
          return s;
        },
      },
    },
    earlySerpent: {
      "Toujours Essayer": {
        base: 0,
        fn: (p) => {
          if (p.cantWin5v5 || p.threats.heavyFront) return -100;
          let s = 0;
          if (p.winCondition === "serpent_rush") s += 70;
          if (AGGRESSIVE_JG.has(p.jungler) && p.lanesMobile && p.ourFront >= 1 && p.earlyCc >= 1) s += 45;
          if (p.ahead && p.jFit.serpent === "contest") s += 25;
          if (p.powerSpike === "early") s += 20;
          return s;
        },
      },
      Flexible: {
        base: 25,
        fn: (p) => {
          let s = 0;
          if (p.jFit.serpent === "after_advantage" || p.winCondition === "pick_comp") s += 45;
          if (p.threats.heavyFront || p.cantWin5v5) s += 35;
          if (p.winCondition === "scale_late") s += 20;
          if (p.shell?.serpen?.plan === "punish_pick") s += 18;
          return s;
        },
      },
      Céder: {
        base: 10,
        fn: (p) => {
          let s = 0;
          if (p.winCondition === "scale_late" || p.scaleBot) s += 50;
          if (p.winCondition === "side_trade") s += 45;
          if (p.behind) s += 40;
          if (p.jFit.serpent === "delay" || p.jFit.serpent === "delay_trade") s += 35;
          if (p.threats.heavyFront && !p.hasPick) s += 30;
          return s;
        },
      },
    },
    topSerpent: {
      "Ne Pas Rejoindre": {
        base: 10,
        fn: (p) => {
          let s = 0;
          if (p.splits.some((x) => x.slot === "Top")) s += 55;
          if (SPLIT_PUSHERS.has(p.allies.Top)) s += 40;
          if (p.winCondition === "side_trade") s += 30;
          if (p.allies.Top === "Vampire") s += 35;
          return s;
        },
      },
      "Toujours Rejoindre": {
        base: 5,
        fn: (p) => {
          let s = 0;
          if (p.winCondition === "serpent_rush" && hasTag(p.allies.Top, "frontline", p.metaMap)) s += 55;
          if (p.ourFront <= 1 && hasTag(p.allies.Top, "frontline", p.metaMap)) s += 25;
          return s;
        },
      },
      Flexible: { base: 28, fn: () => 10 },
    },
    waveMgmt: {
      "Priorité Ralliement": {
        base: 20,
        fn: (p) => {
          let s = 0;
          if (p.winCondition === "serpent_rush") s += 50;
          if (p.winCondition === "pick_comp" || p.threats.heavyFront) s += 35;
          if (p.winCondition === "morgard_5v5") s += 30;
          return s;
        },
      },
      "Priorité Vague": {
        base: 15,
        fn: (p) => {
          let s = 0;
          if (p.winCondition === "side_trade") s += 55;
          if (p.winCondition === "scale_late") s += 45;
          if (p.splits.length && p.cantWin5v5) s += 25;
          return s;
        },
      },
    },
    objectivePrep: {
      "Se Regrouper": {
        base: 10,
        fn: (p) => (p.winCondition === "serpent_rush" ? 60 : 0) + (p.canWin5v5 ? 25 : 0),
      },
      "Split Push": {
        base: 5,
        fn: (p) =>
          (p.winCondition === "side_trade" ? 65 : 0) + (p.splits.length >= 2 ? 30 : 0),
      },
      Flexible: {
        base: 30,
        fn: (p) =>
          (p.winCondition === "pick_comp" ? 40 : 0) +
          (p.winCondition === "scale_late" ? 35 : 0) +
          (!p.canWin5v5 && p.splits.length ? 20 : 0),
      },
    },
    objectiveCombat: {
      "Engage Fort": {
        base: 0,
        fn: (p) => {
          if (p.cantWin5v5 || p.threats.heavyFront) return -200;
          if (p.threats.enemyPoke && p.ourFront < 2) return -40;
          let s = 0;
          if (p.winCondition === "serpent_rush" && p.canWin5v5) s += 70;
          if (p.ourFront >= 2 && p.earlyCc >= 2 && p.ahead) s += 40;
          return s;
        },
      },
      "Poker / Garder ses Distances": {
        base: 35,
        fn: (p) => {
          let s = 0;
          if (p.cantWin5v5 || p.threats.heavyFront) s += 90;
          if (p.winCondition === "pick_comp" || p.hasPick) s += 45;
          if (p.winCondition === "scale_late" || p.ourPoke >= 2) s += 40;
          if (p.winCondition === "side_trade") s += 35;
          if (p.threats.enemyDive >= 2) s += 20;
          return s;
        },
      },
    },
    objectiveFinish: {
      "Priorité d'Élimination": {
        base: 25,
        fn: (p) => {
          let s = 0;
          if (p.winCondition === "pick_comp" || p.hasPick) s += 55;
          if (p.cantWin5v5 || p.threats.heavyFront) s += 45;
          if (p.threats.enemyScaleCarry) s += 20;
          return s;
        },
      },
      "Priorité de Combat": {
        base: 15,
        fn: (p) => {
          let s = 0;
          if (p.winCondition === "serpent_rush" && p.canWin5v5) s += 60;
          if (p.ahead && p.ourFront >= 2 && !p.threats.heavyFront) s += 35;
          return s;
        },
      },
    },
    morgard: {
      "Se Regrouper à 5": {
        base: 15,
        fn: (p) => {
          let s = 0;
          if (p.winCondition === "morgard_5v5" || (p.scaleBot && p.canWin5v5)) s += 60;
          if (p.canWin5v5 && !p.hasPick) s += 35;
          if (p.shell?.morgard?.plan === "force_5v5") s += 30;
          return s;
        },
      },
      "Split 1-4": {
        base: 10,
        fn: (p) => {
          let s = 0;
          if (p.winCondition === "pick_comp" && !p.canWin5v5) s += 55;
          if (p.cantWin5v5 && p.splits.length >= 1) s += 40;
          return s;
        },
      },
      "Split 1-3-1": {
        base: 5,
        fn: (p) => {
          let s = 0;
          if (p.winCondition === "side_trade" && p.splits.length >= 2) s += 65;
          if (p.cantWin5v5 && p.splits.length >= 2) s += 35;
          return s;
        },
      },
    },
    towerSiege: {
      "Poker / Garder ses Distances": {
        base: 30,
        fn: (p) => {
          let s = 0;
          if (p.ourPoke >= 1 || p.cantWin5v5 || p.threats.heavyFront) s += 45;
          if (p.winCondition === "scale_late" || p.winCondition === "pick_comp") s += 25;
          if (p.threats.enemyPoke) s += 20;
          return s;
        },
      },
      Dive: {
        base: 5,
        fn: (p) => {
          if (p.threats.heavyFront || p.cantWin5v5) return -50;
          let s = 0;
          if (p.ahead && p.ourFront >= 2) s += 50;
          if (p.winCondition === "pick_comp" && p.shell?.style === "dive_pick") s += 30;
          return s;
        },
      },
    },
    defense: {
      "Défendre la Lane Pressée": {
        base: 25,
        fn: (p) => {
          let s = 0;
          if (p.botThreat) s += 55;
          if (p.behind || p.scaleBot || p.cantWin5v5) s += 40;
          if (p.threats.heavyFront) s += 30;
          if (p.winCondition === "scale_late") s += 25;
          return s;
        },
      },
      "Forcer le Combat": {
        base: 0,
        fn: (p) => {
          if (p.threats.heavyFront || p.cantWin5v5) return -100;
          let s = 0;
          if (p.winCondition === "serpent_rush" && p.ahead) s += 55;
          return s;
        },
      },
    },
    closing: {
      Agressif: {
        base: 0,
        fn: (p) => {
          if (p.threats.heavyFront || p.cantWin5v5) return -80;
          let s = 0;
          if (p.winCondition === "serpent_rush" && p.ahead) s += 60;
          return s;
        },
      },
      Stable: {
        base: 15,
        fn: (p) => {
          let s = 0;
          if (p.winCondition === "scale_late" || p.scaleBot) s += 55;
          if (p.behind) s += 40;
          return s;
        },
      },
      Flexible: {
        base: 30,
        fn: (p) => {
          let s = 0;
          if (p.winCondition === "pick_comp") s += 40;
          if (p.threats.heavyFront || p.cantWin5v5) s += 35;
          if (p.winCondition === "side_trade") s += 25;
          return s;
        },
      },
    },
  };

  const REASON_BUILDERS = {
    focusLane: (val, p) => {
      if (val === "Focus Mid/Bot") {
        if (p.botThreat) return "Lane bot menacée — jungle/supp babysitter le carry.";
        if (p.scaleBot) return "Carry bot + peel — prio Mid/Bot pour scale safe.";
        return "Protéger les lanes centrales.";
      }
      if (val === "Focus Top/Mid") return "Trade map — pression top/mid sans commit bot.";
      return "Lanes équilibrées — vision et timers sur toute la map.";
    },
    earlyJungle: (val, p) => {
      const j = p.jungler || "Jungle";
      if (val === "Contre-Jungle") return `${j} — invade vs jungle lent (${p.enemyJungler}).`;
      if (val === "Gank") return `${p.jFit.label || j} — pression lanes / objectif early.`;
      return `${p.jFit.label || j} — farm safe, comp ${p.powerSpike === "late" ? "late" : "mid"}.`;
    },
    earlySerpent: (val, p) => {
      if (val === "Toujours Essayer") return "Tempo early + lanes mobiles + CC — contest Serpent (dragon/Herald MOBA).";
      if (val === "Céder") {
        if (p.threats.heavyFront) return "Double front adverse — trade Serpent, pas 5v5 pit.";
        return "Scale / behind — survivre > contest early.";
      }
      if (p.jFit.serpent === "after_advantage") return "Contest Serpent après avantage lane ou pick.";
      return "Serpent seulement si setup playable — règle d'or MOBA.";
    },
    topSerpent: (val, p) => {
      if (val === "Ne Pas Rejoindre") return `${p.allies.Top || "Top"} split — pression side > group Serpent.`;
      if (val === "Toujours Rejoindre") return "Front top requis au pit Serpent early.";
      return "Rejoindre si group viable, sinon push side.";
    },
    waveMgmt: (val, p) => {
      if (val === "Priorité Vague") return "Push sidelanes — trade map ou farm scale.";
      if (p.threats.heavyFront) return "Regrouper mid pour picks avant objectif — pas arriver tard.";
      return "Ralliement mid pour vision et setup objectif.";
    },
    objectivePrep: (val, p) => {
      if (val === "Se Regrouper") return "Arriver ensemble au Serpent — prio MOBA group.";
      if (val === "Split Push") {
        const names = p.splits.slice(0, 2).map((s) => s.name).join(" / ");
        return `Trade map via ${names || "split"} pendant objectif.`;
      }
      return "Adapter vision — pick first ou group selon numbers.";
    },
    objectiveCombat: (val, p) => {
      if (val === "Engage Fort") return `Front ${p.ourFront} + CC — hard engage au pit.`;
      if (p.threats.heavyFront) return "Porteur + Infanterie — poke/pick, jamais 5v5 front.";
      if (p.threats.enemyPoke) return "Comp poke adverse — ne pas group choke sans engage.";
      return "Poker avant commit — comp ne gagne pas 5v5 égal.";
    },
    objectiveFinish: (val, p) => {
      if (val === "Priorité d'Élimination") {
        if (p.threats.heavyFront) return "Turn sur JG/carry après pick — pas finir obj aveugle.";
        return "Éliminer carries avant objectif (pick comp MOBA).";
      }
      return "Finir Serpent si ennemi zoned — tempo engage.";
    },
    morgard: (val, p) => {
      if (val === "Se Regrouper à 5") return "Closing 5v5 front-to-back — Baron MOBA convert.";
      if (val === "Split 1-3-1") return "Double side — trade tours si teamfight perdant.";
      return "Surplus numérique side — pas 5v5 égal au Morgard.";
    },
    towerSiege: (val, p) => {
      if (val === "Dive") return "Ahead + double front — dive sous tour.";
      return "Chip tours safe — artillerie / poke sans dive.";
    },
    defense: (val, p) => {
      if (val === "Forcer le Combat") return "Ahead tempo — punir rotations adverses.";
      if (p.botThreat) return "Bot exposé — défendre lane pressée.";
      return "Éviter chain fights — protéger scale ou lanes faibles.";
    },
    closing: (val, p) => {
      if (val === "Agressif") return "Convertir lead early — snowball objectifs.";
      if (val === "Stable") return "Close safe après timing carry — pas de throw.";
      return "Picks opportunistes — adapter au lead.";
    },
  };

  function enforceJungleFit(profile, tactics) {
    const fitVal = profile.jFit?.earlyJungle;
    if (!fitVal || !profile.jungler) return tactics;
    const cur = tactics.earlyJungle?.value;
    if (cur === fitVal) return tactics;

    const canInvade =
      fitVal === "Gank" &&
      profile.enemyJungler &&
      SLOW_ENEMY_JG.has(profile.enemyJungler) &&
      AGGRESSIVE_JG.has(profile.jungler) &&
      profile.lanes.Jungle?.verdict !== "lose";

    const preferred = canInvade ? "Contre-Jungle" : fitVal;
    const margin = tactics.earlyJungle?.margin ?? 999;

    if (AGGRESSIVE_JG.has(profile.jungler) || PICK_CORE.has(profile.jungler) || margin < 8) {
      tactics.earlyJungle = tactic(
        preferred,
        `${profile.jFit.label || profile.jungler} — fit jungle champion (priorité guide).`
      );
    }
    return tactics;
  }

  function applyShellPatches(profile, tactics) {
    const shell = profile.shell;
    if (!shell || profile.shellConfidence < 0.4) return tactics;
    const label = shell.labelFr || shell.id;
    const patches = { ...(shell.serpen?.tactics || {}), ...(shell.morgard?.tactics || {}) };
    for (const [key, val] of Object.entries(patches)) {
      if (!val || !TACTIC_ORDER.includes(key)) continue;
      tactics[key] = tactic(val, `${label} — shell draft`, tactics[key]?.assign);
    }
    return tactics;
  }

  function applyChampionRules(profile, tactics) {
    const p = profile;
    if (p.allies.Bot === "Chasseur de fléchettes empoisonnées" && p.allies.Support === "Moine") {
      tactics.focusLane = tactic("Focus Mid/Bot", "Fléchettes + Moine — prio bot peel.");
      tactics.towerSiege = tactic("Poker / Garder ses Distances", "Artillerie bot — siège poker.");
    }
    if (p.allies.Mid === "Mage noir") {
      tactics.waveMgmt = tactic("Priorité Ralliement", "Ralliement mid — malédiction 40 %.");
      tactics.objectiveFinish = tactic("Priorité d'Élimination", "Cible carries — malédiction.");
      tactics.objectiveCombat = tactic("Poker / Garder ses Distances", "Poke mid avant commit.");
    }
    if (p.jungler === "Clown") {
      tactics.earlyJungle = tactic("Gank", "Clown — gank mid/bot burst.");
    }
    if (p.allies.Top === "Vampire") {
      tactics.topSerpent = tactic("Ne Pas Rejoindre", "Vampire split top.");
      tactics.morgard = tactic("Split 1-3-1", "Vampire side Morgard.", p.splits.slice(0, 2));
    }
    return tactics;
  }

  function enforceHardRules(profile, tactics) {
    const vsHeavy = isBad5v5(profile);
    const shellSerpent = profile.shell?.serpen?.tactics?.earlySerpent;
    const forceSerpent =
      shellSerpent === "Toujours Essayer" &&
      profile.shellConfidence >= 0.45 &&
      profile.canWin5v5 &&
      !profile.threats.heavyFront;

    if (vsHeavy && tactics.objectiveCombat?.value === "Engage Fort") {
      tactics.objectiveCombat = tactic(
        "Poker / Garder ses Distances",
        "Règle dure — Engage Fort interdit vs Porteur+Infanterie / double front."
      );
    }
    if (vsHeavy && tactics.earlySerpent?.value === "Toujours Essayer" && !forceSerpent) {
      tactics.earlySerpent = tactic("Flexible", "Serpent flexible vs front lourd — pas contest aveugle.");
    }
    if (profile.botThreat && tactics.focusLane?.value !== "Focus Mid/Bot") {
      tactics.focusLane = tactic("Focus Mid/Bot", "Bot menacé — correction obligatoire.");
    }
    if (vsHeavy && tactics.closing?.value === "Agressif") {
      tactics.closing = tactic("Flexible", "Pas Agressif vs front lourd — picks opportunistes.");
    }
    if (vsHeavy && tactics.defense?.value === "Forcer le Combat") {
      tactics.defense = tactic("Défendre la Lane Pressée", "Ne pas forcer 5v5 vs front lourd.");
    }
    if (profile.threats.enemyPoke >= 2 && tactics.objectiveCombat?.value === "Engage Fort" && profile.ourFront < 2) {
      tactics.objectiveCombat = tactic(
        "Poker / Garder ses Distances",
        "Comp poke adverse — pas Engage Fort sans front."
      );
    }
    return tactics;
  }

  function validateEnum(tactics) {
    if (!TACTIC_OPTIONS) return tactics;
    for (const key of TACTIC_ORDER) {
      const t = tactics[key];
      if (!t?.value) continue;
      const allowed = TACTIC_OPTIONS[key]?.values;
      if (!allowed?.includes(t.value)) {
        const fallback = allowed?.[0];
        if (fallback) {
          tactics[key] = tactic(fallback, `${t.reason} (corrigé → enum in-game)`);
        }
      }
    }
    return tactics;
  }

  function assignSplitters(tactics, profile) {
    const splits = profile.splits;
    if (tactics.objectivePrep?.value === "Split Push" && !tactics.objectivePrep.assign?.length) {
      tactics.objectivePrep.assign = splits.slice(0, 2);
    }
    if (tactics.morgard?.value === "Split 1-3-1" && !tactics.morgard.assign?.length) {
      tactics.morgard.assign = splits.slice(0, 2);
    } else if (tactics.morgard?.value === "Split 1-4" && !tactics.morgard.assign?.length) {
      tactics.morgard.assign = splits.slice(0, 1);
    }
    return tactics;
  }

  /**
   * Pure decision: 12 settings from GameProfile.
   */
  function recommendTactics(profile) {
    const tactics = {};
    for (const key of TACTIC_ORDER) {
      const reasonFn = REASON_BUILDERS[key] || ((val) => `Recommandation ${val}.`);
      tactics[key] = pickBestOption(key, profile, reasonFn);
    }
    applyShellPatches(profile, tactics);
    applyChampionRules(profile, tactics);
    enforceJungleFit(profile, tactics);
    enforceHardRules(profile, tactics);
    assignSplitters(tactics, profile);
    validateEnum(tactics);
    return tactics;
  }

  function flattenSettings(tactics) {
    const out = {};
    for (const key of TACTIC_ORDER) {
      out[key] = tactics[key]?.value || "";
    }
    return out;
  }

  /**
   * Compare a full or partial tactics set against profile (higher = better fit).
   */
  function scoreTacticsAlternative(settings, profile) {
    let total = 0;
    for (const key of TACTIC_ORDER) {
      const val = settings[key];
      if (!val) continue;
      total += scoreOption(key, val, profile);
    }
    const vsHeavy = isBad5v5(profile);
    if (vsHeavy && settings.objectiveCombat === "Engage Fort") total -= 500;
    if (vsHeavy && settings.earlySerpent === "Toujours Essayer" && !profile.canWin5v5) total -= 80;
    if (profile.botThreat && settings.focusLane !== "Focus Mid/Bot") total -= 60;
    return total;
  }

  function templateForArchetype(archetype) {
    const map = {
      early_serpent_pressure: "lancer_early_serpent",
      protect_scale: "sniper_protect_scale",
      pick_before_morgard: "ninja_demon_pick",
      side_pressure_trade: "pyro_cavalry_trade",
      behind_stabilize: null,
    };
    const id = map[archetype];
    if (!id) return null;
    return (GUIDE?.templates || []).find((t) => t.id === id) || null;
  }

  function buildAvoid(profile, tactics) {
    const avoid = [];
    const vsHeavy = isBad5v5(profile);
    if (tactics.earlySerpent?.value === "Céder") {
      avoid.push({ setting: "Toujours Essayer (Serpent)", why: "Ne pas contest parce que l'objectif existe — setup non playable." });
    }
    if (tactics.objectiveCombat?.value?.includes("Poker") || vsHeavy) {
      avoid.push({
        setting: "Engage Fort",
        why: vsHeavy ? "Porteur + Infanterie — lose 5v5 au pit." : "Comp pick/poke — Poker first.",
      });
    }
    if (profile.hasPick && tactics.morgard?.value === "Se Regrouper à 5") {
      avoid.push({ setting: "Se Regrouper à 5 (Morgard)", why: "Pick comp — surplus numérique avant 5v5." });
    }
    if (profile.threats.enemyDive >= 2) {
      avoid.push({ setting: "Engage Fort sans peel", why: "Dive adverse — protéger backline d'abord." });
    }
    return avoid;
  }

  function buildWinPlan(profile) {
    const parts = [];
    if (profile.shell?.labelFr) parts.push(`Shell : ${profile.shell.labelFr}.`);
    parts.push(`Spike ${profile.powerSpike} · ${profile.winCondition.replace(/_/g, " ")}.`);
    if (profile.cantWin5v5) parts.push(`Éviter 5v5 — front ${profile.ourFront} vs ${profile.enemyFront}.`);
    if (profile.scaleBot) parts.push("Protéger carry, delay Serpent.");
    if (profile.hasPick) parts.push("Picks avant Morgard.");
    if (profile.jungleMatchup.notes[0]) parts.push(profile.jungleMatchup.notes[0]);
    if (profile.threats.enemyScaleCarry) parts.push("Menace : carry scale adverse.");
    if (profile.threats.heavyFront) parts.push("Menace : double front + peel.");
    return parts;
  }

  function buildReviewChecklist(profile) {
    const list = [];
    const archetype = profile.archetype;
    const rq = {
      early_serpent_pressure: "Pression early → Serpent ou retard jungle ennemi ?",
      protect_scale: "Survécu early sans céder toute la map ?",
      pick_before_morgard: "Picks avant objectif ou marche en 5v5 groupé ?",
      side_pressure_trade: "Trade suffisant ou snowball objectif ennemi ?",
      behind_stabilize: "Éviter chain fights — ajuster au prochain match.",
    };
    if (rq[archetype]) list.push({ text: rq[archetype], kind: "archetype" });
    if (profile.jFit?.verify) list.push({ text: profile.jFit.verify, kind: "jungler" });
    for (const c of profile.shell?.serpen?.checks || []) {
      list.push({ text: SERPEN_CHECKS[c] || c, kind: "serpent" });
    }
    list.push({ text: "Serpent/Morgard → conversion (tours, or, reset) ?", kind: "conversion" });
    return list;
  }

  function recommend(ourComp, enemyComp, metaMap, championsByName) {
    const profile = analyzeGameState(ourComp, enemyComp, metaMap, championsByName);
    const tactics = recommendTactics(profile);
    const archetype = profile.archetype;
    const decisionKey = OBJECTIVE_DECISION[profile.winCondition] || "flex";
    const tpl = templateForArchetype(archetype);
    const templateScore = tpl ? scoreTacticsAlternative(tpl.tactics, profile) : null;
    const dynamicScore = scoreTacticsAlternative(flattenSettings(tactics), profile);

    const shellHints = profile.shell
      ? {
          shell: profile.shell.labelFr || profile.shell.id,
          confidence: profile.shellConfidence,
          style: profile.shell.style,
          serpen: profile.shell.serpen?.label || null,
          morgard: profile.shell.morgard?.label || null,
          serpenPlan: profile.shell.serpen?.plan || null,
          morgardPlan: profile.shell.morgard?.plan || null,
        }
      : null;

    return {
      lanes: profile.lanes,
      tactics,
      archetype,
      archetypeLabel: GUIDE?.archetypeLabels?.[archetype] || archetype,
      archetypeScores: profile.winConditionScores,
      objectiveDecision: decisionKey,
      objectiveDecisionDetail: GUIDE?.objectiveDecisionModel?.[decisionKey] || null,
      guideUrl: GUIDE?.guideUrl,
      quickIndex: GUIDE?.quickSettingsIndex || [],
      quickEntry: GUIDE?.quickSettingsIndex?.find((e) => e.id === archetype) || null,
      templateMatch: tpl,
      templateScore,
      dynamicScore,
      shellHints,
      jungleFitDetail: profile.jFit
        ? { champion: profile.jungler, ...profile.jFit, hero: (GUIDE?.heroJungleChampions || []).includes(profile.jungler) }
        : null,
      heroJungleFit: (GUIDE?.heroJungleChampions || [])
        .map((name) => ({ name, ...(GUIDE?.jungleChampionFit?.[name] || {}) }))
        .filter((r) => r.label),
      combatApproach: GUIDE?.objectiveCombatOptions?.find((o) => o.value === tactics.objectiveCombat?.value) || null,
      finishBehavior: GUIDE?.objectiveFinishBehaviors?.find((o) => o.value === tactics.objectiveFinish?.value) || null,
      morgardPlan: GUIDE?.morgardClosingPlans?.find(
        (p) => p.closing === tactics.closing?.value || p.morgard === tactics.morgard?.value
      ) || null,
      reviewChecklist: buildReviewChecklist(profile),
      failureAdjustments: GUIDE?.failureAdjustments || [],
      winPlan: buildWinPlan(profile),
      avoid: buildAvoid(profile, tactics),
      splitPushers: profile.splits.map((s) => s.name).slice(0, 3),
      profile: {
        gameModel: archetype,
        winCondition: profile.winCondition,
        powerSpike: profile.powerSpike,
        ourShell: profile.shell?.labelFr || profile.shell?.id || null,
        enemyShell: profile.enemyShell?.labelFr || profile.enemyShell?.id || null,
        jungleMatchup: profile.jungleMatchup,
        keyThreats: profile.threats,
        jungleFit: profile.jFit?.label,
        ourFront: profile.ourFront,
        enemyFront: profile.enemyFront,
        cantEngage5v5: profile.cantWin5v5,
        compMargin: profile.compMargin,
        shellConfidence: profile.shellConfidence,
        shellId: profile.shell?.id,
        dynamicScore,
        templateScore,
      },
      itemGuides: global.TFM2ItemGuide?.recommendGuides?.(ourComp, enemyComp, metaMap, profile.lanes, profile) || null,
    };
  }

  global.TFM2Tactics = {
    SLOTS,
    TACTIC_ORDER,
    OBJECTIVE_DECISION,
    SERPEN_CHECK_LABELS: SERPEN_CHECKS,
    setGuide,
    setTacticOptions,
    getGuide,
    analyzeGameState,
    recommendTactics,
    scoreTacticsAlternative,
    recommend,
    gatherContext: analyzeGameState,
    scoreArchetypes: (ctx) => ({
      archetype: ctx.archetype || ARCHETYPE_IDS[pickWinCondition(ctx.winConditionScores || scoreWinConditions(ctx), ctx)],
      scores: ctx.winConditionScores || scoreWinConditions(ctx),
    }),
    heroJungleChampions: () => GUIDE?.heroJungleChampions || [],
    jungleFit: (name, metaMap) => resolveJungleFit(name, metaMap || {}),
    templateForArchetype,
    detectShell,
  };
})(typeof window !== "undefined" ? window : globalThis);
