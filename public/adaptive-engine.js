/**
 * TFM2 Adaptive Engine — feature vector + multi-option scoring per match state.
 * Shared by tactics (12 réglages) and draft (pick/ban marginal utility).
 */
(function (global) {
  const MC = () => global.TFM2MatchCore;
  const SLOTS = () => MC()?.SLOTS || ["Top", "Jungle", "Mid", "Bot", "Support"];

  const TACTIC_VALUES = {
    focusLane: ["Focus Top/Mid", "Focus Mid/Bot", "Toutes les Lanes"],
    earlyJungle: ["Gank", "Farm/Couverture", "Contre-Jungle"],
    earlySerpent: ["Flexible", "Toujours Essayer", "Céder"],
    topSerpent: ["Flexible", "Toujours Rejoindre", "Ne Pas Rejoindre"],
    waveMgmt: ["Priorité Ralliement", "Priorité Vague"],
    objectivePrep: ["Split Push", "Flexible", "Se Regrouper"],
    objectiveCombat: ["Engage Fort", "Poker / Garder ses Distances"],
    objectiveFinish: ["Priorité d'Élimination", "Priorité de Combat"],
    morgard: ["Split 1-3-1", "Se Regrouper à 5", "Split 1-4"],
    towerSiege: ["Poker / Garder ses Distances", "Dive"],
    defense: ["Forcer le Combat", "Défendre la Lane Pressée"],
    closing: ["Agressif", "Stable", "Flexible"],
  };

  const TAG_KEYS = [
    "frontline", "peel", "wave_clear", "scaling", "engage", "poke",
    "assassin", "dive", "mage_burst", "marksman", "split", "mobility",
  ];

  const JG_STYLE = { aggressive: 1, engage: 0.9, pick: 0.75, skirmish: 0.7, flex: 0.5, side: 0.45, stable_front: 0.4, safe: 0.2 };

  function slug(name) {
    return (name || "").replace(/[^\w\u00C0-\u024F]+/g, "_").slice(0, 36);
  }

  function hasTag(name, tag, metaMap) {
    return MC()?.hasTag?.(name, tag, metaMap) || metaMap?.[name]?.tags?.includes(tag);
  }

  function tagCounts(names, metaMap, prefix) {
    const out = {};
    for (const tag of TAG_KEYS) out[`${prefix}_tag_${tag}`] = 0;
    for (const n of names) {
      for (const t of metaMap?.[n]?.tags || []) {
        const k = `${prefix}_tag_${t}`;
        if (k in out) out[k] += 1;
      }
    }
    return out;
  }

  function tierNorm(name, metaMap) {
    const t = metaMap?.[name]?.tierMeta || "C";
    return { S: 1, A: 0.76, B: 0.54, C: 0.3, D: 0.1 }[t] ?? 0.3;
  }

  function sumLaneScores(lanes) {
    let t = 0;
    for (const slot of SLOTS()) {
      t += (lanes?.[slot]?.score || 0) / 100;
    }
    return t;
  }

  /** Vecteur de features continu — unique par combinaison de champions + lanes. */
  function buildMatchFeatures(ctx) {
    const lanes = ctx.lanes || {};
    const ourNames = SLOTS().map((s) => ctx.ourComp?.[s]).filter(Boolean);
    const enNames = SLOTS().map((s) => ctx.enemyComp?.[s]).filter(Boolean);
    const metaMap = ctx.metaMap || {};

    const f = {
      laneNet: (ctx.laneNet || 0) / 4,
      laneWins: (ctx.laneWins || 0) / 5,
      compMargin: (ctx.compMargin || 0) / 70,
      ourFront: ctx.ourFront || 0,
      enemyFront: ctx.enemyFront || 0,
      frontGap: (ctx.ourFront || 0) - (ctx.enemyFront || 0),
      ourPeel: ctx.ourPeel || 0,
      enemyPeel: ctx.enemyPeel || 0,
      peelGap: (ctx.ourPeel || 0) - (ctx.enemyPeel || 0),
      ourScale: ctx.ourScale || 0,
      ourPoke: ctx.ourPoke || 0,
      ourPick: ctx.ourPick || 0,
      enemyDive: ctx.enemyDive || 0,
      earlyCc: ctx.earlyCc || 0,
      splitPower: (ctx.qualified || []).reduce((s, q) => s + (q.score || 0), 0) / 180,
      splitCount: (ctx.qualified || []).length / 3,
      jgStyle: JG_STYLE[ctx.jFit?.style] ?? 0.45,
      enemyJgSlow: ctx.enemyJgSlow ? 1 : 0,
      lanesMobile: ctx.lanesMobile ? 1 : 0,
      botThreat: ctx.botThreat ? 1 : 0,
      behind: ctx.behind ? 1 : Math.max(-0.6, (ctx.compMargin || 0) / -60),
      ahead: ctx.ahead ? 1 : Math.max(0, (ctx.compMargin || 0) / 60),
      laneSum: sumLaneScores(lanes) / 5,
    };

    for (const slot of SLOTS()) {
      const lm = lanes[slot];
      f[`lane_${slot}`] = (lm?.score || 0) / 100;
      f[`lane_${slot}_v`] = lm?.verdict === "win" ? 1 : lm?.verdict === "lose" ? -1 : 0;
    }

    const ob = ctx.compCompare?.our?.breakdown || {};
    const eb = ctx.compCompare?.enemy?.breakdown || {};
    for (const k of ["balance", "synergy", "counter", "lane", "tier"]) {
      f[`our_${k}`] = (ob[k] || 0) / 180;
      f[`enemy_${k}`] = (eb[k] || 0) / 180;
      f[`delta_${k}`] = f[`our_${k}`] - f[`enemy_${k}`];
    }

    Object.assign(f, tagCounts(ourNames, metaMap, "our"));
    Object.assign(f, tagCounts(enNames, metaMap, "en"));

    f.teamfightUs =
      f.ourFront * 0.32 + f.laneWins * 0.28 + Math.max(0, f.laneNet) * 0.2 +
      f.ourPeel * 0.1 + f.earlyCc * 0.08 + f.our_tag_frontline * 0.12;
    f.teamfightThem =
      f.enemyFront * 0.34 + f.enemyPeel * 0.14 + f.enemyDive * 0.12 +
      f.en_tag_frontline * 0.15 + Math.max(0, -f.laneNet) * 0.15;
    f.teamfightDelta = f.teamfightUs - f.teamfightThem;

    for (const n of ourNames) {
      f[`our_ch_${slug(n)}`] = tierNorm(n, metaMap);
    }
    for (const n of enNames) {
      f[`en_ch_${slug(n)}`] = tierNorm(n, metaMap);
    }

    f.carryBot = ctx.carry?.slot === "Bot" ? 1 : 0;
    f.hasPickCore = ctx.hasPickCore ? 1 : 0;
    f.fingerprint = `${ourNames.join(" · ")} vs ${enNames.join(" · ")}`;
    return f;
  }

  function pickBestOption(setting, scoreFn, f, ctx) {
    const opts = TACTIC_VALUES[setting];
    const scores = {};
    let best = opts[0];
    let bestScore = -Infinity;
    for (const opt of opts) {
      const s = scoreFn(opt, f, ctx);
      scores[opt] = Math.round(s * 10) / 10;
      if (s > bestScore) {
        bestScore = s;
        best = opt;
      }
    }
    const sorted = opts.map((o) => ({ option: o, score: scores[o] })).sort((a, b) => b.score - a.score);
    const margin = sorted[0].score - (sorted[1]?.score ?? 0);
    return {
      value: best,
      score: bestScore,
      scores,
      margin,
      runnerUp: sorted[1]?.option || null,
      reason: explainTacticChoice(setting, best, f, ctx, sorted),
    };
  }

  function explainTacticChoice(setting, choice, f, ctx, sorted) {
    const parts = [];
    const add = (s) => { if (s && parts.length < 4) parts.push(s); };

    if (setting === "focusLane") {
      if (choice === "Focus Mid/Bot") {
        if (ctx.botThreat) add(`Bot lose vs ${ctx.enemyComp?.Bot}`);
        if (f.carryBot) add(`Carry ${ctx.carry?.name} bot`);
        if (f.enemyDive >= 2) add("Dive ennemi sur backline");
      } else if (choice === "Focus Top/Mid") {
        const top = ctx.ourComp?.Top;
        if (top) add(`Pression ${top} top`);
        if (f.splitPower > 0.4) add("Split side fort");
      } else add("Lanes équilibrées — flex vision");
    }

    if (setting === "earlyJungle") {
      add(`${ctx.jungler || "JG"} · ${ctx.jFit?.label || "fit"}`);
      if (choice === "Contre-Jungle" && ctx.enemyJungler) add(`Invade vs ${ctx.enemyJungler}`);
      if (choice === "Gank" && f.lane_Bot_v < 0) add("Gank bot menacé");
    }

    if (setting === "objectiveCombat") {
      add(`TF Δ ${(f.teamfightDelta * 100 | 0) / 100}`);
      if (choice.includes("Poker")) add(`Front ${f.ourFront} vs ${f.enemyFront}`);
      else add(`Engage si lanes +${f.laneWins.toFixed(1)}`);
    }

    if (setting === "morgard" && choice.includes("Split") && ctx.qualified?.length) {
      add(`Split ${ctx.qualified.slice(0, 2).map((q) => q.name).join(" / ")}`);
    }

    if (parts.length < 2 && sorted[1]) {
      add(`Δ +${(sorted[0].score - sorted[1].score).toFixed(0)} vs ${sorted[1].option}`);
    }
    if (!parts.length) parts.push(`Score ${sorted[0].score.toFixed(0)} — ${f.fingerprint.slice(0, 48)}`);
    return parts.join(" · ");
  }

  function scoreFocusLane(opt, f, ctx) {
    let s = 0;
    if (opt === "Focus Mid/Bot") {
      s += f.botThreat * 62 + f.enemyDive * 18 + f.carryBot * 38;
      s += Math.max(0, -f.lane_Bot) * 55 + Math.max(0, -f.lane_Bot_v) * 42;
      s += f.our_tag_scaling * 14 + f.lane_Mid_v * 12;
      s -= f.lane_Top_v * 10;
      if (ctx.enemyComp?.Bot === "Chevalier de cavalerie") s += 36;
      if (ctx.ourComp?.Support === "Moine") s += 12;
    } else if (opt === "Focus Top/Mid") {
      s += f.lane_Top_v * 28 + f.lane_Mid_v * 22 + f.splitPower * 35;
      s += f.our_tag_split * 20 + f.our_tag_poke * 12;
      if (ctx.ourComp?.Top) s += 8 + tierNorm(ctx.ourComp.Top, ctx.metaMap) * 10;
      if (ctx.ourComp?.Mid === "Mage noir") s += 22;
      s -= f.botThreat * 28;
    } else {
      s += 18 + (Math.abs(f.laneNet) < 0.25 ? 22 : 0);
      s -= f.botThreat * 32 - f.splitPower * 15;
    }
    return s + f.laneSum * 4;
  }

  function scoreEarlyJungle(opt, f, ctx) {
    const j = ctx.jungler;
    let s = 0;
    if (opt === "Gank") {
      s += f.jgStyle * 45 + (JG_STYLE[ctx.jFit?.style] ?? 0.4) * 30;
      s += f.lanesMobile * 22 + f.laneWins * 18 + f.earlyCc * 8;
      s += f.botThreat * 15 + f.ahead * 12;
      s -= f.ourScale * 8;
      if (j === "Clown" || j === "Ninja" || j === "Lancier") s += 18;
    } else if (opt === "Farm/Couverture") {
      s += f.ourScale * 22 + f.behind * 28 + (1 - f.jgStyle) * 35;
      s += f.our_tag_scaling * 12;
      s -= f.ahead * 15 - f.lanesMobile * 10;
      if (j === "Ogre" || j === "Nécromancien") s += 24;
    } else {
      s += f.enemyJgSlow * 40 + f.jgStyle * 25 + f.ahead * 18;
      s += f.lane_Jungle_v * 15;
      s -= f.behind * 20;
    }
    return s;
  }

  function scoreEarlySerpent(opt, f, ctx) {
    let s = 0;
    if (opt === "Toujours Essayer") {
      s += f.jgStyle * 35 + f.lanesMobile * 28 + f.earlyCc * 12 + f.ourFront * 14;
      s += f.ahead * 22 + f.laneWins * 20;
      s -= f.teamfightDelta < -0.3 ? 45 : 0;
      s -= f.enemyFront * 12 + f.behind * 25;
    } else if (opt === "Céder") {
      s += f.behind * 35 + f.ourScale * 18 + Math.max(0, -f.teamfightDelta) * 40;
      s += f.enemyFront * 10;
      s -= f.ahead * 20 - f.ourPick * 8;
    } else {
      s += 20 + f.ourPick * 14 + f.laneNet * 10;
      s += Math.abs(f.teamfightDelta) < 0.35 ? 18 : 0;
      s -= f.jgStyle > 0.8 && f.ahead > 0.5 ? 15 : 0;
    }
    return s;
  }

  function scoreTopSerpent(opt, f, ctx) {
    const top = ctx.ourComp?.Top;
    let s = 0;
    if (opt === "Ne Pas Rejoindre") {
      s += f.splitPower * 40 + f.our_tag_split * 25;
      if (top === "Vampire") s += 32;
      if (ctx.topSplit) s += 22;
      s += f.lane_Top_v * 8;
      s -= f.earlySerpentContest * 0;
    } else if (opt === "Toujours Rejoindre") {
      s += f.our_tag_frontline * 18 + f.earlyCc * 10 + f.jgStyle * 15;
      s += f.lane_Top_v * -15 + 15;
      s -= f.splitPower * 30;
    } else {
      s += 15 + (f.splitPower > 0.35 && f.jgStyle > 0.5 ? -8 : 8);
    }
    return s;
  }

  function scoreWaveMgmt(opt, f, ctx) {
    let s = 0;
    if (opt === "Priorité Ralliement") {
      s += f.ourPick * 16 + f.our_tag_engage * 10 + f.jgStyle * 12;
      s += f.lane_Mid_v * 14 + (1 - f.splitPower) * 12;
      s += f.botThreat * 10;
      s -= f.ourScale * 6;
    } else {
      s += f.splitPower * 38 + f.our_tag_split * 22 + f.ourScale * 14;
      s += f.our_tag_poke * 12;
      s -= f.ourPick * 10 - f.jgStyle * 8;
    }
    return s;
  }

  function scoreObjectivePrep(opt, f, ctx) {
    let s = 0;
    if (opt === "Split Push") {
      s += f.splitPower * 45 + f.our_tag_split * 20;
      s += Math.max(0, -f.teamfightDelta) * 35;
      s -= f.jgStyle * 10;
    } else if (opt === "Se Regrouper") {
      s += f.teamfightDelta * 40 + f.jgStyle * 22 + f.earlyCc * 12;
      s += f.ahead * 15;
      s -= f.splitPower * 25;
    } else {
      s += 18 + Math.abs(f.teamfightDelta) * 15 + f.ourPick * 10;
    }
    return s;
  }

  function scoreObjectiveCombat(opt, f, ctx) {
    let s = 0;
    if (opt === "Engage Fort") {
      s += f.teamfightDelta * 55 + f.ourFront * 16 + f.earlyCc * 14;
      s += f.laneWins * 22 + f.ahead * 18;
      s += f.our_tag_engage * 12;
      s -= f.enemyPeel * 10 + f.ourPoke * 8;
    } else {
      s += f.ourPick * 18 + f.ourPoke * 16 + Math.max(0, -f.teamfightDelta) * 48;
      s += f.enemyFront * 12 + f.enemyDive * 8;
      s -= f.teamfightDelta > 0.4 ? 30 : 0;
      if (ctx.enemyComp?.Support === "Porteur de bouclier") s += 14;
    }
    return s;
  }

  function scoreObjectiveFinish(opt, f, ctx) {
    let s = 0;
    if (opt === "Priorité d'Élimination") {
      s += f.ourPick * 22 + f.ourPoke * 14 + Math.max(0, -f.teamfightDelta) * 30;
      s += f.enemyDive * 8;
    } else {
      s += f.teamfightDelta * 35 + f.ahead * 20 + f.jgStyle * 12;
      s += f.our_tag_engage * 10;
      s -= f.ourPick * 12;
    }
    return s;
  }

  function scoreMorgard(opt, f, ctx) {
    let s = 0;
    if (opt === "Split 1-3-1") {
      s += f.splitPower * 50 + (ctx.qualified?.length >= 2 ? 28 : 0);
      s += Math.max(0, -f.teamfightDelta) * 38 + f.our_tag_split * 18;
    } else if (opt === "Split 1-4") {
      s += f.splitPower * 35 + f.ourPick * 16;
      s += Math.max(0, -f.teamfightDelta) * 25;
      s -= ctx.qualified?.length >= 2 ? 10 : 0;
    } else {
      s += f.teamfightDelta * 42 + f.ourScale * 14 + f.ourPeel * 10;
      s += f.ahead * 15;
      s -= f.splitPower * 30 - f.ourPick * 12;
    }
    return s;
  }

  function scoreTowerSiege(opt, f, ctx) {
    let s = 0;
    if (opt === "Dive") {
      s += f.teamfightDelta * 40 + f.ourFront * 14 + f.ahead * 22;
      s += f.our_tag_engage * 10;
      s -= f.enemyPeel * 12;
    } else {
      s += f.ourPoke * 22 + f.ourPick * 14 + Math.max(0, -f.teamfightDelta) * 35;
      s += f.our_tag_mage_burst * 8;
      s -= f.ourFront < 2 ? 15 : 0;
    }
    return s;
  }

  function scoreDefense(opt, f, ctx) {
    let s = 0;
    if (opt === "Défendre la Lane Pressée") {
      s += f.botThreat * 45 + f.ourScale * 18 + f.behind * 28;
      s += Math.max(0, -f.teamfightDelta) * 30 + f.enemyDive * 10;
    } else {
      s += f.ahead * 35 + f.jgStyle * 18 + f.laneWins * 15;
      s += f.teamfightDelta * 25;
      s -= f.behind * 40 - f.botThreat * 25;
    }
    return s;
  }

  function scoreClosing(opt, f, ctx) {
    let s = 0;
    if (opt === "Agressif") {
      s += f.ahead * 45 + f.jgStyle * 20 + f.laneWins * 18;
      s += f.teamfightDelta * 30;
      s -= f.behind * 50 - f.ourScale * 10;
    } else if (opt === "Stable") {
      s += f.ourScale * 28 + f.ourPeel * 14 + f.behind * 22;
      s += f.carryBot * 12;
      s -= f.ahead * 15;
    } else {
      s += 20 + f.ourPick * 12 + Math.abs(f.compMargin) * 8;
      s += Math.abs(f.teamfightDelta) < 0.3 ? 15 : 0;
    }
    return s;
  }

  const TACTIC_SCORERS = {
    focusLane: scoreFocusLane,
    earlyJungle: scoreEarlyJungle,
    earlySerpent: scoreEarlySerpent,
    topSerpent: scoreTopSerpent,
    waveMgmt: scoreWaveMgmt,
    objectivePrep: scoreObjectivePrep,
    objectiveCombat: scoreObjectiveCombat,
    objectiveFinish: scoreObjectiveFinish,
    morgard: scoreMorgard,
    towerSiege: scoreTowerSiege,
    defense: scoreDefense,
    closing: scoreClosing,
  };

  function assignSplitters(ctx, morgardChoice, prepChoice) {
    const q = ctx.qualified || [];
    const n = morgardChoice === "Split 1-3-1" ? 2 : morgardChoice === "Split 1-4" ? 1 : 0;
    const assign = q.slice(0, n);
    if (prepChoice === "Split Push" && assign.length < 2 && q.length >= 2) {
      return q.slice(0, 2);
    }
    return assign;
  }

  function scoreAdaptiveTactics(ctx) {
    const f = buildMatchFeatures(ctx);
    const tactics = {};
    const allScores = {};
    const margins = {};

    for (const [key, fn] of Object.entries(TACTIC_SCORERS)) {
      const r = pickBestOption(key, fn, f, ctx);
      tactics[key] = {
        value: r.value,
        reason: r.reason,
        score: r.score,
        runnerUp: r.runnerUp,
        margin: r.margin,
      };
      allScores[key] = r.scores;
      margins[key] = r.margin;
    }

    const assign = assignSplitters(ctx, tactics.morgard.value, tactics.objectivePrep.value);
    if (assign.length) {
      tactics.objectivePrep.assign = assign.slice(0, tactics.objectivePrep.value === "Split Push" ? 2 : 1);
      tactics.morgard.assign = assign.slice(0, tactics.morgard.value === "Split 1-3-1" ? 2 : 1);
    }

    return {
      tactics,
      features: f,
      optionScores: allScores,
      margins,
      confidence: Object.values(margins).reduce((a, b) => a + b, 0) / Object.keys(margins).length,
    };
  }

  /** Draft — breakdown delta + profil adversaire + identité champion. */
  function buildDraftFeatures(allies, champName, slot, ctx) {
    const metaMap = ctx.metaMap || {};
    const oppNames = ctx.oppNames || [];
    const partial = { ...(ctx.projectedComp || {}) };
    if (!Object.keys(partial).length) {
      for (const s of SLOTS()) partial[s] = ctx.oppComp?.[s] || "";
      partial[slot] = champName;
    }
    const lanes = {};
    if (MC()?.laneMatchup) {
      for (const s of SLOTS()) {
        if (partial[s] && ctx.oppComp?.[s]) {
          lanes[s] = MC().laneMatchup(partial[s], ctx.oppComp[s], metaMap);
        }
      }
    }
    const miniCtx = {
      ourComp: partial,
      enemyComp: ctx.oppComp || {},
      metaMap,
      lanes,
      laneNet: Object.values(lanes).reduce((s, l) => s + (l?.score || 0) / 100, 0),
      laneWins: Object.values(lanes).filter((l) => l?.verdict === "win").length,
      ourFront: allies.filter((n) => hasTag(n, "frontline", metaMap)).length,
      enemyFront: oppNames.filter((n) => hasTag(n, "frontline", metaMap)).length,
      ourPeel: 0,
      enemyPeel: 0,
      ourScale: 0,
      ourPoke: 0,
      ourPick: 0,
      enemyDive: 0,
      earlyCc: 0,
      qualified: [],
      jFit: { style: "flex" },
      jungler: partial.Jungle,
      enemyJungler: ctx.oppComp?.Jungle,
      botThreat: lanes.Bot?.verdict === "lose",
      topSplit: false,
      compMargin: 0,
      compCompare: null,
      behind: false,
      ahead: false,
      lanesMobile: true,
      hasPickCore: false,
      hasSideTradeCore: false,
      hasPeelSupport: false,
      enemyJgSlow: false,
      carry: null,
    };
    return buildMatchFeatures(miniCtx);
  }

  function draftBreakdownDelta(beforeEv, afterEv, pm) {
    const w = { balance: 1.8, synergy: 0.85, counter: 1.15, lane: 1.1, tier: 0.35 };
    let d = 0;
    for (const [k, wt] of Object.entries(w)) {
      d += ((afterEv?.breakdown?.[k] || 0) - (beforeEv?.breakdown?.[k] || 0)) * wt * (pm?.eval ?? 1) * 0.04;
    }
    return d;
  }

  function enemyProfileVector(oppNames, metaMap) {
    const v = {};
    for (const t of TAG_KEYS) v[t] = 0;
    for (const n of oppNames) {
      for (const t of metaMap?.[n]?.tags || []) {
        if (t in v) v[t] += 1;
      }
    }
    return v;
  }

  function counterProfileBonus(champName, enemyVec, metaMap) {
    const tags = metaMap?.[champName]?.tags || [];
    let b = 0;
    const counterMap = {
      frontline: ["mage_burst", "poke"],
      dive: ["peel", "frontline"],
      assassin: ["peel", "frontline"],
      scaling: ["assassin", "dive", "engage"],
      engage: ["poke", "wave_clear"],
    };
    for (const [enTag, counters] of Object.entries(counterMap)) {
      if ((enemyVec[enTag] || 0) > 0) {
        for (const ct of counters) {
          if (tags.includes(ct)) b += 12 + enemyVec[enTag] * 6;
        }
      }
    }
    return b;
  }

  function championIdentityScore(champName, allies, oppNames, metaMap, byName) {
    const core = MC();
    let s = 0;
    const m = metaMap?.[champName] || {};
    for (const a of allies) {
      s += (core?.pairingPts?.(champName, a, metaMap) ?? 0) * 0.08;
    }
    for (const e of oppNames) {
      s += (core?.counterPts?.(champName, e, metaMap) ?? 0) * 0.1;
      if (m.worstMatchups?.includes(e)) s -= 18;
    }
    s += tierNorm(champName, metaMap) * 8;
    const dp = m.draftProfile || {};
    s += (dp.dpsWeight ?? 0) * 6 + (dp.tankWeight ?? 0) * 4;
    return s;
  }

  function enrichDraftPickScore(base, champName, slot, ctx, beforeEv, afterEv) {
    const pm = ctx.phase ? { eval: 1 } : { eval: 1 };
    const allies = ctx.allies || [];
    const oppNames = ctx.oppNames || [];
    const metaMap = ctx.metaMap || {};
    let score = base;

    score += draftBreakdownDelta(beforeEv, afterEv, pm);
    const enemyVec = enemyProfileVector(oppNames, metaMap);
    score += counterProfileBonus(champName, enemyVec, metaMap);
    score += championIdentityScore(champName, allies, oppNames, metaMap, ctx.byName);

    const df = buildDraftFeatures(allies, champName, slot, ctx);
    score += df.laneNet * 12 + df.delta_counter * 25 + df.teamfightDelta * 18;

    return Math.round(score * 100) / 100;
  }

  global.TFM2Adaptive = {
    TACTIC_VALUES,
    buildMatchFeatures,
    scoreAdaptiveTactics,
    buildDraftFeatures,
    enrichDraftPickScore,
    enemyProfileVector,
    counterProfileBonus,
    championIdentityScore,
  };
})(typeof window !== "undefined" ? window : globalThis);
