/**
 * TFM2 Match Core v11 — lanes, skeleton comp, layout ; draft scoring → TFM2DraftCore.
 */
(function (global) {
  const SLOTS = ["Top", "Jungle", "Mid", "Bot", "Support"];
  const SLOT_LABELS = { Top: "Top", Jungle: "Jungle", Mid: "Mid", Bot: "Bot", Support: "Support" };

  const TIER = { S: 100, A: 76, B: 54, C: 30, D: 10 };
  const LIST_W = [100, 82, 64, 48, 36];
  const LANE_W = { Top: 2.25, Jungle: 1.1, Mid: 1.0, Bot: 1.2, Support: 2.0 };

  const ENCHANTERS = new Set([
    "Moine", "Porteur de bouclier", "Androïde", "Prêtre", "Enchanteur", "Barde",
    "Pythonisse", "Exorciste", "Esprit gardien", "Invocateur d'esprit", "Taoïste",
    "Jiangshi", "Mage de barrière",
  ]);
  const HYPER_CARRIES = new Set([
    "Tireur", "Chasseur de boomerang", "Chasseur de fléchettes empoisonnées", "Fantôme", "Vampire", "Archer",
  ]);
  const SPLITTERS = new Set([
    "Soldat", "Ninja", "Berserker", "Vampire", "Druide", "Épéiste",
    "Chevalier de cavalerie", "Pyromancien",
  ]);
  const SPLIT_EXCLUDE = new Set(["Bombardier", "Mage blanc", "Mage du vent"]);

  const SLOT_BUFF = {
    Top: { wants: ["frontline", "tanky", "split", "sustain"] },
    Jungle: { wants: ["pick", "dive", "mobility", "objective", "aggressive_jungle", "pick_jungle"] },
    Mid: { wants: ["mage_burst", "mage", "wave_clear", "burst"] },
    Bot: { wants: ["scaling", "marksman", "poke"] },
    Support: { wants: ["peel", "heal", "shield", "utility", "frontline"] },
  };

  const SKELETON = {
    frontline: { tags: ["frontline", "tank"], types: /tank|guerrier|infanterie|chevalier|ogre/i, penalty: 95 },
    mage: { tags: ["mage_burst", "mage"], types: /mage|pyro|necro|chaman/i, penalty: 88 },
    dps: { tags: ["scaling"], types: /tireur|archer|artillerie|distance|assassin/i, penalty: 92, names: HYPER_CARRIES },
    enchanter: { tags: ["peel"], names: ENCHANTERS, penalty: 85 },
    wave_clear: { tags: ["wave_clear"], penalty: 82 },
  };

  const GAP_LABELS = {
    frontline: "frontline",
    mage: "mage AP",
    dps: "DPS carry",
    enchanter: "save/peel",
    wave_clear: "wave clear",
  };

  const DAMAGE_TAGS = new Set(["scaling", "marksman", "mage_burst", "burst", "assassin"]);

  const ROLE_FILL_BONUS = {
    wave_clear: 62,
    mage: 48,
    dps: 48,
    frontline: 42,
    enchanter: 24,
  };

  const MTG_PICK = {
    coherenceDelta: 5.4,
    directBonus: 4.2,
    familyBonus: 2.2,
    familyCoherenceDelta: 3.8,
    denyEnemy: 1.9,
    conflictPenalty: 52,
    familyConflictPenalty: 38,
    tierTiebreak: 0.06,
    deltaCap: 130,
  };

  const MTG_BAN = {
    denyDelta: 4.8,
    guildBlock: 48,
    shardBlock: 58,
    alliedOverlap: 20,
    enemyThreat: 18,
    tierTiebreak: 0.05,
  };

  /** Poste TFM2 → rôle structurel prioritaire */
  const SLOT_ROLE = {
    Top: "frontline",
    Mid: "mage",
    Bot: "dps",
    Support: "enchanter",
  };

  const SLOT_BUFF_WEIGHT = {
    Top: 1.15,
    Jungle: 1.05,
    Mid: 1.12,
    Bot: 1.18,
    Support: 1.1,
  };

  const EVAL_WEIGHTS = {
    balance: 2.05,
    synergy: 0.72,
    counter: 1.12,
    lane: 1.15,
    tier: 0.28,
    layout: 1.85,
    color: 0.92,
    family: 0.75,
  };

  const MTG_COLORS = ["W", "U", "B", "R", "G"];
  const COLOR_LABELS = { W: "Blanc", U: "Bleu", B: "Noir", R: "Rouge", G: "Vert" };
  const COLOR_HEX = { W: "#f5f0dc", U: "#4a9fd4", B: "#6b6b7a", R: "#e05238", G: "#3d9e5a" };

  function meta(name, metaMap) {
    return metaMap?.[name] || {};
  }

  function champ(name, byName, metaMap) {
    return byName?.get?.(name) || metaMap?.[name] || { name };
  }

  function hasTag(name, tag, metaMap) {
    return meta(name, metaMap).tags?.includes(tag) || false;
  }

  function tierVal(name, metaMap) {
    const t = meta(name, metaMap).tierMeta || champ(name, null, metaMap).tierMeta || "C";
    return TIER[t] ?? 30;
  }

  function listRank(name, list) {
    if (!list?.length) return -1;
    if (typeof list[0] === "string") return list.indexOf(name);
    return list.findIndex((x) => x?.name === name);
  }

  function listPts(rank) {
    return rank >= 0 ? LIST_W[Math.min(rank, LIST_W.length - 1)] : 0;
  }

  function draftProfile(name, metaMap) {
    return meta(name, metaMap).draftProfile || {};
  }

  function pairingPts(a, b, metaMap) {
    const ma = meta(a, metaMap);
    const mb = meta(b, metaMap);
    const ab = listPts(listRank(b, ma.bestPairings));
    const ba = listPts(listRank(a, mb.bestPairings));
    let pts = ab + Math.round(ba * 0.9);
    if (isDedicatedSupport(a, metaMap) && isDedicatedSupport(b, metaMap)) {
      pts = Math.min(pts, 22);
    } else if (isDedicatedSupport(a, metaMap) !== isDedicatedSupport(b, metaMap)) {
      const carry = isDedicatedSupport(a, metaMap) ? b : a;
      const dp = draftProfile(carry, metaMap);
      if ((dp.dpsWeight ?? 0.3) >= 0.55) pts = Math.round(pts * 1.08);
    }
    return pts;
  }

  function counterPts(attacker, defender, metaMap) {
    const md = meta(defender, metaMap);
    return listPts(listRank(attacker, md.worstMatchups));
  }

  /** Matchup lane — curated first, heuristiques tags ensuite */
  function laneMatchup(ourName, theirName, metaMap) {
    if (!ourName || !theirName) {
      return { verdict: "unknown", score: 0, note: "Lane incomplète." };
    }
    const oMeta = meta(ourName, metaMap);
    const eMeta = meta(theirName, metaMap);

    if (oMeta.worstMatchups?.includes(theirName)) {
      const r = listRank(theirName, oMeta.worstMatchups);
      return {
        verdict: "lose",
        score: -listPts(r),
        note: `${ourName} est counter par ${theirName} (matchup curaté #${r + 1}).`,
      };
    }
    if (eMeta.worstMatchups?.includes(ourName)) {
      const r = listRank(ourName, eMeta.worstMatchups);
      return {
        verdict: "win",
        score: listPts(r),
        note: `${theirName} est counter par ${ourName} (matchup curaté #${r + 1}).`,
      };
    }

    if (hasTag(ourName, "scaling", metaMap) && (hasTag(theirName, "assassin", metaMap) || hasTag(theirName, "dive", metaMap))) {
      return { verdict: "lose", score: -28, note: `${ourName} scale mais ${theirName} peut dive early.` };
    }
    if (hasTag(ourName, "poke", metaMap) && hasTag(theirName, "frontline", metaMap)) {
      return { verdict: "even", score: 4, note: "Poke vs front — jouer la distance." };
    }
    if (hasTag(ourName, "frontline", metaMap) && hasTag(theirName, "mage_burst", metaMap)) {
      return { verdict: "win", score: 22, note: `Front absorbe le burst de ${theirName}.` };
    }
    if (hasTag(ourName, "peel", metaMap) && (hasTag(theirName, "assassin", metaMap) || hasTag(theirName, "dive", metaMap))) {
      return { verdict: "win", score: 18, note: "Peel vs dive/assassin." };
    }
    return { verdict: "even", score: 0, note: "Matchup standard — prio et items décident." };
  }

  function teamSynergy(names, metaMap) {
    let total = 0;
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        total += pairingPts(names[i], names[j], metaMap);
      }
    }
    const families = names.map((n) => meta(n, metaMap).colorIdentity?.family).filter(Boolean);
    const famCount = {};
    for (const f of families) famCount[f] = (famCount[f] || 0) + 1;
    for (const count of Object.values(famCount)) {
      if (count >= 2) total += 24 + (count - 2) * 18;
    }
    return total;
  }

  function teamCounters(ourNames, enemyNames, metaMap) {
    let total = 0;
    for (const o of ourNames) {
      for (const e of enemyNames) {
        total += counterPts(o, e, metaMap);
        total -= Math.round(counterPts(e, o, metaMap) * 0.45);
      }
    }
    return total;
  }

  function teamLanes(ourComp, enemyComp, metaMap) {
    const lanes = {};
    let total = 0;
    for (const slot of SLOTS) {
      const lm = laneMatchup(ourComp[slot], enemyComp[slot], metaMap);
      lanes[slot] = lm;
      total += lm.score * (LANE_W[slot] || 1);
    }
    return { lanes, total };
  }

  function roleFilled(name, roleKey, metaMap) {
    const m = meta(name, metaMap);
    const c = champ(name, null, metaMap);
    const sk = SKELETON[roleKey];
    if (sk.names?.has(name)) return true;
    if (sk.tags?.some((t) => m.tags?.includes(t))) return true;
    if (sk.types?.test(c.type || m.type || "")) return true;
    return false;
  }

  /** Support dédié (peel/save) — pas front/mage waveclear/carry */
  function isDedicatedSupport(name, metaMap) {
    const m = meta(name, metaMap);
    const dp = draftProfile(name, metaMap);
    const fam = m.colorIdentity?.family || "";
    if (hasTag(name, "wave_clear", metaMap) && hasTag(name, "mage_burst", metaMap)) return false;
    if (hasTag(name, "scaling", metaMap) || hasTag(name, "marksman", metaMap)) return false;
    if (hasTag(name, "frontline", metaMap) && (dp.tankWeight || 0) >= 0.5) return false;
    if (/^support_/.test(fam)) return true;
    if ((dp.dpsWeight ?? 1) <= 0.15 && hasTag(name, "peel", metaMap)) return true;
    const tags = m.tags || [];
    if ((dp.dpsWeight ?? 1) <= 0.15 && (tags.includes("heal") || tags.includes("shield"))) return true;
    return false;
  }

  /** @deprecated alias */
  function isPureUtility(name, metaMap) {
    return isDedicatedSupport(name, metaMap);
  }

  function teamDamageBudget(names, metaMap) {
    let dps = 0;
    let waveClear = 0;
    for (const n of names) {
      const dp = draftProfile(n, metaMap);
      dps += dp.dpsWeight ?? 0.28;
      if (hasTag(n, "wave_clear", metaMap)) waveClear++;
    }
    return { dps, waveClear, size: names.length };
  }

  function newSkeletonRoles(beforeNames, champName, metaMap) {
    const before = {};
    for (const k of Object.keys(SKELETON)) {
      before[k] = beforeNames.some((n) => roleFilled(n, k, metaMap));
    }
    const out = [];
    for (const k of Object.keys(SKELETON)) {
      if (!before[k] && roleFilled(champName, k, metaMap)) out.push(k);
    }
    return out;
  }

  function skeletonFillBonus(beforeNames, champName, metaMap) {
    let bonus = 0;
    const prof = compositionProfile(beforeNames, metaMap);
    for (const role of newSkeletonRoles(beforeNames, champName, metaMap)) {
      bonus += ROLE_FILL_BONUS[role] || 20;
    }
    if (isDedicatedSupport(champName, metaMap)) {
      if (prof.dedicatedSupport >= 1) bonus -= 220 + prof.dedicatedSupport * 55;
      else if (beforeNames.length >= 3) bonus -= 35;
    }
    const budget = teamDamageBudget(beforeNames, metaMap);
    if (budget.waveClear === 0 && hasTag(champName, "wave_clear", metaMap)) {
      bonus += 52 + beforeNames.length * 12;
    }
    if (budget.dps < 1.4 && beforeNames.length >= 2) {
      const dp = draftProfile(champName, metaMap).dpsWeight ?? 0;
      if (dp >= 0.55) bonus += 36;
      else if (dp >= 0.35) bonus += 18;
    }
    if (beforeNames.length === 0) {
      if (isDedicatedSupport(champName, metaMap)) bonus -= 130;
      else if (roleFilled(champName, "frontline", metaMap)) bonus += 28;
      else if ((draftProfile(champName, metaMap).dpsWeight ?? 0) >= 0.55) bonus += 22;
    }
    return bonus;
  }

  function compositionProfile(names, metaMap) {
    let dedicatedSupport = 0;
    let peel = 0;
    let waveClear = 0;
    for (const n of names) {
      if (isDedicatedSupport(n, metaMap)) dedicatedSupport++;
      if (hasTag(n, "peel", metaMap) || ENCHANTERS.has(n)) peel++;
      if (hasTag(n, "wave_clear", metaMap)) waveClear++;
    }
    const budget = teamDamageBudget(names, metaMap);
    return {
      pureUtility: dedicatedSupport,
      dedicatedSupport,
      peel,
      waveClear,
      dpsBudget: budget.dps,
      size: names.length,
    };
  }

  function scoreCompositionBalance(profile, names, metaMap) {
    let score = 0;
    const { dedicatedSupport, peel, waveClear, size, dpsBudget } = profile;
    if (dedicatedSupport >= 3) score -= 340 + (dedicatedSupport - 3) * 140;
    else if (dedicatedSupport >= 2) score -= 185;
    else if (peel >= 3) score -= 240;
    else if (peel === 2 && dedicatedSupport >= 1) score -= 85;
    if (waveClear === 0 && size >= 3) score -= 65 + (size - 3) * 42;
    else if (waveClear >= 3 && size >= 5) score -= 40;
    if (dpsBudget < 1.0 && size >= 3) score -= (1.0 - dpsBudget) * 120;
    if (dpsBudget < 1.8 && size >= 5) score -= (1.8 - dpsBudget) * 95;
    return score;
  }

  function teamSkeleton(names, metaMap) {
    const filled = { frontline: false, mage: false, dps: false, enchanter: false, wave_clear: false };
    for (const n of names) {
      for (const k of Object.keys(filled)) {
        if (roleFilled(n, k, metaMap)) filled[k] = true;
      }
    }
    let score = 0;
    const gaps = [];
    for (const [k, sk] of Object.entries(SKELETON)) {
      if (filled[k]) score += 42;
      else {
        score -= sk.penalty;
        gaps.push(GAP_LABELS[k] || k);
      }
    }
    const comp = compositionProfile(names, metaMap);
    score += scoreCompositionBalance(comp, names, metaMap);
    return { score, filled, gaps, composition: comp };
  }

  function capDelta(delta, cap) {
    if (delta > cap) return cap + (delta - cap) * 0.15;
    if (delta < -cap) return -cap + (delta + cap) * 0.15;
    return delta;
  }

  function champColorIdentity(name, byName, metaMap) {
    return champ(name, byName, metaMap).colorIdentity || meta(name, metaMap).colorIdentity || null;
  }

  const FAMILY = () => global.TFM2FamilyCore;

  function familyKey(name, byName, metaMap) {
    return FAMILY()?.familyKey(name, byName, metaMap) ||
      champColorIdentity(name, byName, metaMap)?.family ||
      meta(name, metaMap).colorIdentity?.family ||
      meta(name, metaMap).family ||
      "";
  }

  function familyPickBonus(champName, allies, byName, metaMap) {
    const FC = FAMILY();
    if (FC?.familyPickBonus) return FC.familyPickBonus(champName, allies, byName, metaMap);
    const fam = familyKey(champName, byName, metaMap);
    if (!fam) return { bonus: 0, label: null };
    const same = allies.filter((a) => familyKey(a, byName, metaMap) === fam).length;
    if (same >= 2) return { bonus: 38, label: `Famille ${fam} (×${same + 1})` };
    if (same === 1) return { bonus: 32, label: `Famille ${fam}` };
    if (!allies.length) return { bonus: 10, label: `Identité ${fam}` };
    return { bonus: 0, label: null };
  }

  function mtgColorPickBonus(champName, allies, byName, metaMap, teamSumBefore) {
    const pie = global.MTGColorPie;
    if (!pie?.colorPickBonus) return { score: 0, label: null };
    const ci = champColorIdentity(champName, byName, metaMap);
    if (!ci) return { score: 0, label: null };
    const champColors = {
      W: ci.W, U: ci.U, B: ci.B, R: ci.R, G: ci.G,
      dominant: ci.dominant || [],
      identity: ci.identity || "",
      vector: ci.vector,
      family: ci.family,
    };
    const teamColors = allies.map((n) => {
      const c = champColorIdentity(n, byName, metaMap);
      if (!c) return null;
      return { dominant: c.dominant || [], identity: c.identity || "", vector: c.vector, W: c.W, U: c.U, B: c.B, R: c.R, G: c.G };
    }).filter(Boolean);
    if (!teamColors.length) return { score: 0, label: null };
    return pie.colorPickBonus(champColors, teamColors, teamSumBefore);
  }

  function counterPickBonus(champName, slot, ctx) {
    const { oppNames, oppComp, metaMap } = ctx;
    let score = 0;
    const reasons = [];
    for (const e of oppNames) {
      const cp = counterPts(champName, e, metaMap);
      if (cp <= 0) continue;
      score += cp * (cp >= 64 ? 0.48 : cp >= 36 ? 0.32 : 0.18);
      if (cp >= 64 && reasons.length < 2) reasons.push(`Counter ${e}`);
    }
    const opp = oppComp?.[slot];
    if (opp) {
      const laneCp = counterPts(champName, opp, metaMap);
      score += laneCp * (LANE_W[slot] || 1) * 0.88;
      score += laneMatchup(champName, opp, metaMap).score * (LANE_W[slot] || 1) * 0.52;
      if (laneCp >= 36) reasons.push(`Lane ${SLOT_LABELS[slot]} vs ${opp}`);
    }
    return { score, reasons };
  }

  function positionPickBonus(champName, slot, byName, metaMap, hintSlot) {
    const fit = slotFit(champName, slot, metaMap, byName);
    const opts = optimalSlotsFor(champName, byName, metaMap);
    let bonus = fit;
    if (opts[0] === slot) bonus += 24;
    else if (opts.includes(slot)) bonus += 10;
    else if (opts.length && hintSlot !== slot) bonus -= 48;
    if (hintSlot === slot) bonus += 18;
    return { bonus, fit, opts };
  }
  function optimalSlotsFor(name, byName, metaMap) {
    const c = champ(name, byName, metaMap);
    return c.optimalSlots || meta(name, metaMap).optimalSlots || [];
  }

  function optimalSlotBonus(name, slot, byName, metaMap) {
    const opts = optimalSlotsFor(name, byName, metaMap);
    if (!opts.length) return 0;
    if (opts[0] === slot) return 72;
    if (opts.includes(slot)) return 38;
    return -68;
  }

  function slotRoleBonus(name, slot, skel, metaMap) {
    const roleKey = SLOT_ROLE[slot];
    if (!roleKey || skel.filled[roleKey]) return 0;
    if (roleFilled(name, roleKey, metaMap)) return 44;
    if (slot === "Mid" && hasTag(name, "wave_clear", metaMap) && !skel.filled.wave_clear) return 36;
    if (slot === "Jungle" && (hasTag(name, "pick_jungle", metaMap) || hasTag(name, "aggressive_jungle", metaMap))) return 28;
    return 0;
  }

  function slotFit(name, slot, metaMap, byName) {
    const m = meta(name, metaMap);
    const wants = SLOT_BUFF[slot]?.wants || [];
    let s = optimalSlotBonus(name, slot, byName, metaMap);
    for (const w of wants) {
      if (m.tags?.includes(w)) s += 14;
    }
    if (slot === "Mid" && hasTag(name, "wave_clear", metaMap)) s += 18;
    if (slot === "Mid" && hasTag(name, "mage_burst", metaMap)) s += 14;
    if (slot === "Bot" && (hasTag(name, "scaling", metaMap) || hasTag(name, "marksman", metaMap))) s += 18;
    if (slot === "Top" && hasTag(name, "frontline", metaMap)) s += 16;
    if (slot === "Top" && hasTag(name, "split", metaMap)) s += 12;
    if (slot === "Jungle" && (hasTag(name, "pick_jungle", metaMap) || hasTag(name, "mobility", metaMap))) s += 14;
    if (slot === "Support" && isDedicatedSupport(name, metaMap)) s += 22;
    if (slot !== "Support" && isDedicatedSupport(name, metaMap) && !hasTag(name, "frontline", metaMap)) s -= 28;
    const dp = draftProfile(name, metaMap);
    if (slot === "Bot" && (dp.dpsWeight ?? 0) >= 0.55) s += 16;
    if (slot === "Top" && (dp.tankWeight ?? 0) >= 0.7) s += 14;
    return Math.round(s * (SLOT_BUFF_WEIGHT[slot] || 1));
  }

  function scoreSlotForPick(champName, slot, ctx, skel) {
    const { metaMap, byName, oppComp, allies } = ctx;
    let score = slotFit(champName, slot, metaMap, byName);
    score += slotRoleBonus(champName, slot, skel, metaMap);
    const opp = oppComp[slot];
    if (opp) {
      score += counterPts(champName, opp, metaMap) * (LANE_W[slot] || 1) * 0.62;
      score += laneMatchup(champName, opp, metaMap).score * (LANE_W[slot] || 1) * 0.45;
    }
    if (slot === "Support" && allies.length) {
      const bot = allies.find((a) => {
        const opts = optimalSlotsFor(a, byName, metaMap);
        return opts.includes("Bot") || hasTag(a, "scaling", metaMap);
      });
      if (bot && meta(champName, metaMap).bestPairings?.includes(bot)) score += 22;
    }
    if (slot === "Bot" && (draftProfile(champName, metaMap).dpsWeight ?? 0) >= 0.5) score += 18;
    return score;
  }

  function bestSlotForChampion(champName, ctx) {
    const { openSlots, hintSlot, byName, metaMap } = ctx;
    if (!openSlots?.length) return { slot: SLOTS[0], score: 0 };
    const skel = teamSkeleton(ctx.allies || [], ctx.metaMap);
    const opts = optimalSlotsFor(champName, byName, metaMap);
    let best = openSlots[0];
    let bestScore = -Infinity;
    for (const slot of openSlots) {
      let s = scoreSlotForPick(champName, slot, ctx, skel);
      if (hintSlot === slot) s += 42;
      else if (opts.length && !opts.includes(slot)) s -= 42;
      if (s > bestScore) {
        bestScore = s;
        best = slot;
      }
    }
    return { slot: best, score: bestScore };
  }

  function layoutBonus(assignment, metaMap, byName) {
    let s = 0;
    for (const { name, slot } of assignment) {
      s += slotFit(name, slot, metaMap, byName);
    }
    if (assignment.find((a) => a.slot === "Support") && assignment.find((a) => a.slot === "Bot")) {
      const sup = assignment.find((a) => a.slot === "Support")?.name;
      const bot = assignment.find((a) => a.slot === "Bot")?.name;
      if (sup && bot && pairingPts(sup, bot, metaMap) >= 64) s += 32;
    }
    return s;
  }

  function teamTier(names, metaMap) {
    return names.reduce((s, n) => s + tierVal(n, metaMap), 0);
  }

  function colorCoherence(names, byName, metaMap) {
    const pie = global.MTGColorPie;
    if (pie?.colorCoherence) {
      const vs = names.map((n) => ({
        name: n,
        colors: champColorIdentity(n, byName, metaMap),
      })).filter((v) => v.colors);
      if (vs.length) return pie.colorCoherence(vs);
    }

    const sum = [0, 0, 0, 0, 0];
    const families = {};
    for (const n of names) {
      const ci = champColorIdentity(n, byName, metaMap);
      if (!ci) continue;
      MTG_COLORS.forEach((c, i) => { sum[i] += ci[c] || 0; });
      if (ci.family) families[ci.family] = (families[ci.family] || 0) + 1;
    }
    let score = 0;
    const top = [...sum].sort((a, b) => b - a);
    if (top[0] >= 18) score += 28;
    if (top[0] + top[1] >= 28) score += 22;
    for (const c of Object.values(families)) {
      if (c >= 2) score += 18 + (c - 2) * 10;
    }
    const dominant = MTG_COLORS[sum.indexOf(Math.max(...sum))] || "";
    const identity = ciIdentity(names, byName, metaMap);
    return { score, teamSum: sum, identity, dominant, families, conflicts: [] };
  }

  function familyCoherenceScore(names, byName, metaMap) {
    const FC = FAMILY();
    if (FC?.teamVectors && FC?.familyCoherence) {
      return FC.familyCoherence(FC.teamVectors(names, byName, metaMap)).score;
    }
    const counts = {};
    for (const n of names) {
      const fam = familyKey(n, byName, metaMap);
      if (!fam) continue;
      counts[fam] = (counts[fam] || 0) + 1;
    }
    let score = 0;
    for (const c of Object.values(counts)) {
      if (c >= 2) score += 22 + (c - 2) * 14;
    }
    return score;
  }

  function teamFamilySummary(names, byName, metaMap) {
    const FC = FAMILY();
    if (FC?.teamFamilySummary) return FC.teamFamilySummary(names, byName, metaMap);
    return { score: familyCoherenceScore(names, byName, metaMap), dominant: null, conflicts: [] };
  }

  function ciIdentity(names, byName, metaMap) {
    const ids = names.map((n) => (champ(n, byName, metaMap).colorIdentity || meta(n, metaMap).colorIdentity)?.identity).filter(Boolean);
    if (!ids.length) return "";
    const counts = {};
    for (const id of ids) counts[id] = (counts[id] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || ids[0];
  }

  function evaluateTeam(names, opts = {}) {
    const { byName, metaMap, oppNames = [], oppComp = {}, assignment = [], slotsLeft = 0 } = opts;
    const skel = teamSkeleton(names, metaMap);
    const syn = teamSynergy(names, metaMap);
    const ctr = oppNames.length ? teamCounters(names, oppNames, metaMap) : 0;
    const tier = teamTier(names, metaMap);
    const layout = layoutBonus(assignment, metaMap, byName);

    let lane = 0;
    if (assignment.length && Object.keys(oppComp).length) {
      const comp = {};
      for (const { name, slot } of assignment) comp[slot] = name;
      lane = teamLanes(comp, oppComp, metaMap).total;
    }

    const color = colorCoherence(names, byName, metaMap);
    const familyScore = familyCoherenceScore(names, byName, metaMap);
    const incomplete = names.length < 5;
    const missingPenalty = incomplete ? (5 - names.length) * slotsLeft * 8 : 0;

    const breakdown = {
      balance: skel.score,
      synergy: syn,
      counter: ctr,
      lane,
      h2h: ctr,
      color: color.score,
      family: familyScore,
      tier: Math.round(tier * 0.35),
    };

    const total =
      skel.score * EVAL_WEIGHTS.balance +
      syn * EVAL_WEIGHTS.synergy +
      ctr * EVAL_WEIGHTS.counter +
      lane * EVAL_WEIGHTS.lane +
      tier * EVAL_WEIGHTS.tier +
      layout * EVAL_WEIGHTS.layout +
      color.score * EVAL_WEIGHTS.color +
      familyScore * EVAL_WEIGHTS.family -
      missingPenalty;

    return {
      total,
      breakdown,
      gaps: skel.gaps,
      skeleton: skel.filled,
      composition: skel.composition,
      color,
      profiles: names,
    };
  }

  function comb(arr, k) {
    if (k === 0) return [[]];
    if (k > arr.length) return [];
    const [h, ...t] = arr;
    return comb(t, k - 1).map((c) => [h].concat(c)).concat(comb(t, k));
  }

  function permute(arr) {
    if (arr.length <= 1) return [arr.slice()];
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      for (const p of permute(arr.slice(0, i).concat(arr.slice(i + 1)))) out.push([arr[i]].concat(p));
    }
    return out;
  }

  function bestLayout(names, ctx, pin = null) {
    const n = names.length;
    if (!n) return { assignment: [], eval: null, score: -Infinity };
    if (pin?.name && pin?.slot && names.includes(pin.name)) {
      const others = names.filter((nm) => nm !== pin.name);
      const otherSlots = SLOTS.filter((sl) => sl !== pin.slot);
      if (!others.length) {
        const assignment = [{ name: pin.name, slot: pin.slot }];
        const ev = evaluateTeam(names, { ...ctx, assignment, slotsLeft: 5 - n });
        return { assignment, eval: ev, score: ev.total };
      }
      let best = { assignment: [], eval: null, score: -Infinity };
      for (const slots of comb(otherSlots, others.length)) {
        for (const order of permute(others)) {
          const assignment = order.map((name, i) => ({ name, slot: slots[i] }));
          assignment.push({ name: pin.name, slot: pin.slot });
          const ev = evaluateTeam(names, { ...ctx, assignment, slotsLeft: 5 - n });
          if (ev.total > best.score) best = { assignment, eval: ev, score: ev.total };
        }
      }
      return best;
    }
    let best = { assignment: [], eval: null, score: -Infinity };
    for (const slots of comb(SLOTS, n)) {
      for (const order of permute(names)) {
        const assignment = order.map((name, i) => ({ name, slot: slots[i] }));
        const ev = evaluateTeam(names, { ...ctx, assignment, slotsLeft: 5 - n });
        if (ev.total > best.score) best = { assignment, eval: ev, score: ev.total };
      }
    }
    return best;
  }

  function winProbFromScores(ourTotal, enemyTotal) {
    const sum = ourTotal + enemyTotal;
    if (sum <= 0) return { our: 0.5, enemy: 0.5 };
    const our = ourTotal / sum;
    return { our, enemy: 1 - our };
  }

  function compareComps(ourComp, enemyComp, byName, metaMap) {
    const DC = global.TFM2DraftCore;
    if (DC?.compareComps) return DC.compareComps(ourComp, enemyComp, byName, metaMap);
    const ourNames = SLOTS.map((s) => ourComp[s]).filter(Boolean);
    const enemyNames = SLOTS.map((s) => enemyComp[s]).filter(Boolean);
    if (ourNames.length < 5 || enemyNames.length < 5) {
      return { complete: false, ourCount: ourNames.length, enemyCount: enemyNames.length };
    }
    const ourEval = evaluateTeam(ourNames, { byName, metaMap, oppNames: enemyNames, oppComp: enemyComp });
    const enemyEval = evaluateTeam(enemyNames, { byName, metaMap, oppNames: ourNames, oppComp: ourComp });
    const margin = ourEval.total - enemyEval.total;
    return {
      complete: true,
      our: { score: Math.round(ourEval.total), breakdown: ourEval.breakdown, plan: ourEval.gaps?.[0] || "Skeleton OK" },
      enemy: { score: Math.round(enemyEval.total), breakdown: enemyEval.breakdown, plan: enemyEval.gaps?.[0] || "Skeleton OK" },
      margin: Math.round(margin),
      winProb: winProbFromScores(ourEval.total, enemyEval.total),
    };
  }

  function phaseWeights(depth, phase) {
    if (phase === "opening") return { skeleton: 1.2, synergy: 0.9, counter: 0.6, tier: 0.8 };
    if (phase === "closing") return { skeleton: 0.85, synergy: 1.0, counter: 1.25, tier: 0.5 };
    return { skeleton: 1.25, synergy: 1.0, counter: 1.0, tier: 0.65 };
  }

  /** Score draft : cohérence MTG + familles / types de comp. */
  function evaluateColorTeam(names, byName, metaMap) {
    const color = colorCoherence(names, byName, metaMap);
    const family = teamFamilySummary(names, byName, metaMap);
    const familyScore = family.score || 0;
    const total = color.score + familyScore * 0.85;
    return {
      total,
      breakdown: { color: color.score, family: familyScore },
      color,
      family,
    };
  }

  function mtgPhaseBonus(phase, pickCount, afterColor, beforeColor) {
    let bonus = 0;
    const combo = afterColor?.combination;
    const prevCombo = beforeColor?.combination;
    if (pickCount <= 1 && (combo?.type === "mono" || combo?.type === "guild")) bonus += 30;
    if (pickCount >= 2 && pickCount <= 3) {
      if (combo?.type === "guild" && prevCombo?.type !== "guild") bonus += 24;
      if (combo?.type === "shard" || combo?.type === "wedge") bonus += 40;
    }
    if (pickCount >= 3) {
      if (combo?.type === "five") bonus -= 100;
      if (combo?.type === "four" && pickCount >= 4) bonus -= 45;
      if ((afterColor?.active?.length || 0) >= 4 && !["shard", "wedge"].includes(combo?.type)) bonus -= 50;
    }
    if (phase === "closing" && combo?.type === "shard") bonus += 18;
    if (phase === "closing" && combo?.type === "wedge") bonus += 14;
    return bonus;
  }

  /** Valeur de deny : ce pick empêche l'adversaire d'obtenir cette identité couleur. */
  function colorDenyEnemyPickBonus(champName, oppNames, byName, metaMap) {
    if (!oppNames.length) return { bonus: 0, label: null };
    const before = colorCoherence(oppNames, byName, metaMap);
    const withChamp = colorCoherence(oppNames.concat(champName), byName, metaMap);
    const delta = withChamp.score - before.score;
    if (delta <= 8) return { bonus: 0, label: null };
    let label = "Deny identité adverse";
    if (withChamp.combination?.name && withChamp.combination.type !== before.combination?.type) {
      label = `Deny ${withChamp.combination.name}`;
    }
    return { bonus: delta * MTG_PICK.denyEnemy, label };
  }

  function mtgPickReasons(champName, allies, before, after, colorDirect, famDirect, denyEnemy, pie, byName, metaMap, famFoundation) {
    const reasons = [];
    const delta = after.total - before.total;
    if (delta > 22) reasons.push("Renforce cohérence MTG");
    if (colorDirect.label) reasons.push(colorDirect.label);
    else if (after.color?.combination?.name) reasons.push(after.color.combination.name);
    if (famDirect.label) reasons.push(famDirect.label);
    if (famFoundation?.delta > 12 && !reasons.includes("Respecte la famille")) {
      reasons.push("Respecte la famille");
    }
    if (after.family?.dominantLabel) reasons.push(`Plan ${after.family.dominantLabel}`);
    for (const c of after.family?.conflicts || []) reasons.push(`⚠ ${c}`);
    if (denyEnemy.label) reasons.push(denyEnemy.label);
    for (const c of after.color?.conflicts || []) reasons.push(`⚠ ${c}`);
    const ci = champColorIdentity(champName, byName, metaMap);
    if (!colorDirect.label && ci?.identity && pie?.LABELS) {
      const dom = (ci.dominant || []).map((c) => pie.LABELS[c]).filter(Boolean);
      if (dom.length) reasons.push(`Identité ${dom.join("/")}`);
      else reasons.push(`Identité ${ci.identity}`);
    }
    if (allies.length === 0 && after.color?.combination?.type === "mono") {
      reasons.push("Base mono — poser un plan");
    }
    if (allies.length >= 2 && after.color?.combination?.type === "guild") {
      reasons.push(`Guilde ${after.color.combination.name}`);
    }
    if (allies.length >= 3 && (after.color?.combination?.type === "shard" || after.color?.combination?.type === "wedge")) {
      reasons.push(`${after.color.combination.type === "shard" ? "Shard" : "Wedge"} ${after.color.combination.name}`);
    }
    return [...new Set(reasons)];
  }

  function scorePickCandidate(champName, ctx) {
    const DC = global.TFM2DraftCore;
    if (DC?.scorePickCandidate) return DC.scorePickCandidate(champName, ctx);
    return { score: tierVal(champName, ctx.metaMap), slot: SLOTS[0], reasons: ["Fallback"], eval: null };
  }

  function scoreBanCandidate(champName, ctx) {
    const DC = global.TFM2DraftCore;
    if (DC?.scoreBanCandidate) return DC.scoreBanCandidate(champName, ctx);
    return { score: tierVal(champName, ctx.metaMap) * 0.1, reasons: ["Fallback"] };
  }

  function dominantFromTeamSum(teamSum) {
    if (!teamSum?.length) return [];
    return [...teamSum]
      .map((v, i) => ({ code: MTG_COLORS[i], v: v || 0 }))
      .sort((a, b) => b.v - a.v)
      .filter((x) => x.v > 0)
      .slice(0, 2)
      .map((x) => x.code);
  }

  function teamColorSummary(names, byName, metaMap) {
    const coh = colorCoherence(names, byName, metaMap);
    const teamSum = coh.teamSum || [0, 0, 0, 0, 0];
    const dominant = dominantFromTeamSum(teamSum);
    const total = teamSum.reduce((a, b) => a + (b || 0), 0) || 1;
    const active = MTG_COLORS.filter((_, i) => (teamSum[i] || 0) > 0);
    const pie = global.MTGColorPie;
    const combination = pie?.detectCombination?.(active.length ? active : dominant) || null;
    return {
      score: coh.score,
      teamSum,
      identity: coh.identity,
      dominant,
      families: coh.families,
      conflicts: coh.conflicts || [],
      combination,
      bars: MTG_COLORS.map((c, i) => ({
        code: c,
        label: COLOR_LABELS[c],
        hex: COLOR_HEX[c],
        value: (teamSum[i] || 0) / total,
      })),
    };
  }

  function countTags(comp, metaMap, tag) {
    return SLOTS.filter((s) => comp[s] && hasTag(comp[s], tag, metaMap)).length;
  }

  function lanesFromComps(ourComp, enemyComp, metaMap) {
    const lanes = {};
    for (const slot of SLOTS) {
      lanes[slot] = laneMatchup(ourComp[slot], enemyComp[slot], metaMap);
    }
    return lanes;
  }

  /** Score ban MTG — deny shard/guild + identité adverse. */
  function scoreMtgBanBonus(champName, ourNames, enemyNames, byName, metaMap) {
    let score = 0;
    const reasons = [];
    const pie = global.MTGColorPie;

    const deny = colorDenyEnemyPickBonus(champName, enemyNames, byName, metaMap);
    if (deny.bonus > 0) {
      score += deny.bonus;
      reasons.push(deny.label);
    }

    const enBefore = evaluateColorTeam(enemyNames, byName, metaMap);
    const enAfter = evaluateColorTeam(enemyNames.concat(champName), byName, metaMap);
    const delta = enAfter.total - enBefore.total;
    if (delta > 10) {
      score += delta * MTG_BAN.denyDelta;
      if (enAfter.color?.combination?.name && enAfter.color.combination.type !== enBefore.color?.combination?.type) {
        reasons.push(`Deny ${enAfter.color.combination.name}`);
      } else if (!reasons.length) {
        reasons.push("Renforce identité MTG adverse");
      }
    }

    const ci = champColorIdentity(champName, byName, metaMap);
    const combo = enAfter.color?.combination;
    if (combo?.type === "guild" && ci?.identity && combo.key?.includes?.(ci.identity?.[0])) {
      score += MTG_BAN.guildBlock;
      reasons.push(`Bloc guilde ${combo.name}`);
    }
    if (combo?.type === "shard" || combo?.type === "wedge") {
      score += MTG_BAN.shardBlock * 0.55;
      reasons.push(`Menace ${combo.type} ${combo.name}`);
    }

    if (pie && ourNames.length) {
      const ourCoh = colorCoherence(ourNames, byName, metaMap);
      const dom = ci?.dominant || [];
      for (const c of dom) {
        if (pie.isEnemy?.(c, ourCoh.dominant?.[0]) || pie.isEnemy?.(c, ourCoh.dominant?.[1])) {
          score += MTG_BAN.enemyThreat;
          reasons.push(`Couleur ennemie ${COLOR_LABELS[c]}`);
          break;
        }
      }
    }

    return { score: Math.round(score), reasons: [...new Set(reasons)].slice(0, 4) };
  }

  global.TFM2MatchCore = {
    SLOTS,
    SLOT_LABELS,
    SLOT_BUFF,
    MTG_COLORS,
    COLOR_LABELS,
    COLOR_HEX,
    ENCHANTERS,
    HYPER_CARRIES,
    SPLITTERS,
    SPLIT_EXCLUDE,
    meta,
    champ,
    hasTag,
    laneMatchup,
    lanesFromComps,
    evaluateTeam,
    evaluateColorTeam,
    compareComps,
    bestLayout,
    bestSlotForChampion,
    slotFit,
    optimalSlotsFor,
    scoreSlotForPick,
    scorePickCandidate,
    scoreBanCandidate,
    counterPickBonus,
    teamColorSummary,
    teamFamilySummary,
    familyKey,
    teamSynergy,
    teamCounters,
    teamSkeleton,
    compositionProfile,
    isDedicatedSupport,
    isPureUtility,
    teamDamageBudget,
    skeletonFillBonus,
    newSkeletonRoles,
    roleFilled,
    SLOT_ROLE,
    scoreCompositionBalance,
    phaseWeights,
    winProbFromScores,
    countTags,
    tierVal,
    pairingPts,
    counterPts,
    MTG_PICK,
    MTG_BAN,
    mtgColorPickBonus,
    mtgPhaseBonus,
    colorDenyEnemyPickBonus,
    scoreMtgBanBonus,
    mtgPickReasons,
    familyPickBonus,
  };
})(typeof window !== "undefined" ? window : globalThis);
