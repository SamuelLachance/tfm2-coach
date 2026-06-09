/**
 * TFM2 Draft Core v8 — algorithme unifié :
 * abilities (.md) · familles · MTG · tier · beatdown/inevitabilité · skeleton TFM2
 */
(function (global) {
  const MC = () => global.TFM2MatchCore;
  const SLOTS = () => MC()?.SLOTS || ["Top", "Jungle", "Mid", "Bot", "Support"];
  const LANE_W = { Top: 2.25, Jungle: 1.1, Mid: 1.0, Bot: 1.2, Support: 2.0 };

  const TIER = { S: 100, A: 76, B: 54, C: 30, D: 10 };

  /** Poids relatifs par couche (draft ≠ evaluateTeam seul). */
  const LAYER = {
    eval: 1,
    tier: 1,
    mtgFamily: 1,
    ability: 1,
    beatdown: 1,
    banMtg: 1,
    banAbility: 1,
    guide: 0,
  };

  const TAG_NEEDS = [
    { tag: "frontline", weight: 26, label: "frontline" },
    { tag: "peel", weight: 20, label: "peel / save" },
    { tag: "wave_clear", weight: 18, label: "wave clear" },
    { tag: "scaling", weight: 14, label: "scaling carry" },
    { tag: "engage", weight: 14, label: "engage" },
    { tag: "mage_burst", weight: 14, label: "mage AP" },
    { tag: "marksman", weight: 12, label: "marksman" },
  ];

  /** Synergies documentées — game-rules + tactiques-options */
  function knownDuoBonus(champName, allies, metaMap) {
    let bonus = 0;
    const reasons = [];
    const hasCarryBot = allies.some(
      (a) => /fléchettes|tireur|archer|boomerang|fantôme/i.test(a) ||
        hasTag(a, "marksman", metaMap) || hasTag(a, "scaling", metaMap)
    );
    const isPeelSup = /moine|porteur|prêtre|pythonisse|enchanteur|androïde|barde/i.test(champName);

    if (hasCarryBot && isPeelSup) {
      bonus += 38;
      reasons.push("Bot carry + peel (guide)");
    }
    if (allies.includes("Mage noir") && isPeelSup) {
      bonus += 28;
      reasons.push("Malédiction + save");
    }
    if (
      (champName === "Vampire" && allies.some((a) => /infanterie|prêtre|moine|enchanteur/i.test(a))) ||
      (allies.includes("Vampire") && /infanterie|prêtre|moine|enchanteur/i.test(champName))
    ) {
      bonus += 32;
      reasons.push("Vampire combo setup");
    }
    if (
      (champName === "Pyromancien" && allies.some((a) => /infanterie|ogre|chevalier|porteur/i.test(a))) ||
      (allies.includes("Pyromancien") && /infanterie|ogre|chevalier|porteur/i.test(champName))
    ) {
      bonus += 26;
      reasons.push("Front + mage waveclear");
    }
    return { bonus, reasons };
  }

  const FLEX_ANCHORS = new Set([
    "Lancier", "Vampire", "Mage noir", "Tireur", "Archer", "Clown", "Ninja",
    "Infanterie lourde", "Pyromancien", "Moine", "Porteur de bouclier",
  ]);

  function meta(name, metaMap) {
    return metaMap?.[name] || {};
  }

  function champ(name, byName, metaMap) {
    return byName?.get?.(name) || metaMap?.[name] || { name };
  }

  function draftProfile(name, metaMap) {
    return meta(name, metaMap).draftProfile || {};
  }

  function hasTag(name, tag, metaMap) {
    return MC()?.hasTag?.(name, tag, metaMap) || meta(name, metaMap).tags?.includes(tag);
  }

  function tierVal(name, metaMap) {
    const t = meta(name, metaMap).tierMeta || champ(name, null, metaMap).tierMeta || "C";
    return TIER[t] ?? 30;
  }

  function teamTags(names, metaMap) {
    const tags = new Set();
    for (const n of names) (meta(n, metaMap).tags || []).forEach((t) => tags.add(t));
    return tags;
  }

  function countDedicatedSupport(names, metaMap) {
    const core = MC();
    if (!core?.isDedicatedSupport) return 0;
    return names.filter((n) => core.isDedicatedSupport(n, metaMap)).length;
  }

  function hasCarryAnchor(names, metaMap) {
    return names.some((n) => {
      const dp = draftProfile(n, metaMap);
      return (dp.dpsWeight ?? 0) >= 0.52 || hasTag(n, "scaling", metaMap) || MC()?.HYPER_CARRIES?.has(n);
    });
  }

  function missingTags(allyNames, metaMap) {
    const have = teamTags(allyNames, metaMap);
    const core = MC();
    const out = [];
    for (const need of TAG_NEEDS) {
      if (have.has(need.tag)) continue;
      out.push(need);
    }
    if (core && allyNames.length >= 2) {
      const skel = core.teamSkeleton(allyNames, metaMap);
      if (!skel.filled.frontline) out.unshift({ tag: "frontline", weight: 32, label: "frontline" });
      if (!skel.filled.dps) out.push({ tag: "scaling", weight: 24, label: "DPS carry" });
      if (!skel.filled.mage) out.push({ tag: "mage_burst", weight: 20, label: "mage AP" });
      if (!skel.filled.enchanter && allyNames.length >= 3) {
        out.push({ tag: "peel", weight: 18, label: "support peel" });
      }
      if (!skel.filled.wave_clear && allyNames.length >= 2) {
        out.push({ tag: "wave_clear", weight: 16, label: "wave clear" });
      }
    }
    const seen = new Set();
    return out.filter((n) => {
      if (seen.has(n.tag)) return false;
      seen.add(n.tag);
      return true;
    });
  }

  function phaseMultiplier(phase) {
    if (phase === "opening") {
      return { eval: 2.0, skeleton: 1.15, synergy: 0.85, counter: 0.55, slot: 1.12, tier: 1.35, mtg: 1.25, ability: 0.9, beatdown: 1.05, guide: 1.45 };
    }
    if (phase === "closing") {
      return { eval: 2.35, skeleton: 0.75, synergy: 0.95, counter: 1.45, slot: 1.18, tier: 0.75, mtg: 1.15, ability: 1.1, beatdown: 1.55, guide: 1.2 };
    }
    return { eval: 2.55, skeleton: 1.35, synergy: 1.08, counter: 1.05, slot: 1.05, tier: 0.95, mtg: 1.05, ability: 1.0, beatdown: 2.05, guide: 1.35 };
  }

  /** Tier meta S–D — ouverture forte, closing réduit si counter disponible. */
  function tierPickLayer(champName, metaMap, phase, allies) {
    const tv = tierVal(champName, metaMap);
    const label = meta(champName, metaMap).tierMeta || "?";
    let score = tv * 0.06;
    const reasons = [];
    if (phase === "opening" || !allies.length) {
      score += tv * 0.16;
      if (tv >= 76) reasons.push(`Tier ${label} — meta`);
      else if (tv >= 54) reasons.push(`Tier ${label} — solide`);
    } else if (phase === "closing") {
      score += tv * 0.04;
    } else {
      score += tv * 0.08;
    }
    if (meta(champName, metaMap).tierNote && tv >= 76 && phase === "opening") {
      reasons.push("Note tier guide");
    }
    return { score, reasons };
  }

  /** MTG color pie + familles Shanei — cohérence identité / plan comp. */
  function mtgFamilyPickLayer(champName, allies, byName, metaMap, phase) {
    const core = MC();
    const FC = global.TFM2FamilyCore;
    if (!core) return { score: 0, reasons: [] };

    let score = 0;
    const reasons = [];
    const before = core.evaluateColorTeam(allies, byName, metaMap);
    const after = core.evaluateColorTeam(allies.concat(champName), byName, metaMap);
    const cohDelta = after.total - before.total;

    if (cohDelta > 6) {
      score += Math.min(cohDelta, core.MTG_PICK?.deltaCap ?? 130) * 0.42;
      if (after.color?.combination?.name) reasons.push(after.color.combination.name);
      else reasons.push("Cohérence MTG/famille");
    }

    const colorDirect = core.mtgColorPickBonus?.(
      champName, allies, byName, metaMap, before.color?.teamSum
    );
    if (colorDirect?.score > 0) {
      score += colorDirect.score * 0.48;
      if (colorDirect.label) reasons.push(colorDirect.label);
    }

    const famDirect = core.familyPickBonus?.(champName, allies, byName, metaMap);
    if (famDirect?.bonus > 0) {
      score += famDirect.bonus * 0.72;
      if (famDirect.label) reasons.push(famDirect.label);
    }

    const famFound = FC?.compFoundationDelta?.(champName, allies, byName, metaMap);
    if (famFound?.delta > 10) {
      score += famFound.delta * 0.9;
      if (famFound.after?.dominantLabel && !reasons.some((r) => r.includes(famFound.after.dominantLabel))) {
        reasons.push(`Plan ${famFound.after.dominantLabel}`);
      }
    } else if (famFound?.delta < -18) {
      score += famFound.delta * 0.55;
      for (const c of famFound.after?.conflicts || []) reasons.push(`⚠ ${c}`);
    }

    score += core.mtgPhaseBonus?.(phase, allies.length + 1, after.color, before.color) ?? 0;

    for (const c of after.family?.conflicts || []) {
      score -= (core.MTG_PICK?.familyConflictPenalty ?? 38) * 0.3;
      if (!reasons.some((r) => r.includes(c))) reasons.push(`⚠ ${c}`);
    }

    return { score, reasons: reasons.slice(0, 5) };
  }

  /** Kits abilities (.md) — CC, peel, burst, anti-heal. */
  function abilityPickLayer(champName, allies, oppNames, byName, metaMap) {
    const AC = global.TFM2AbilityCore;
    if (!AC?.pickKitBonus) return { score: 0, reasons: [] };
    return AC.pickKitBonus(champName, allies, oppNames || [], byName, metaMap);
  }

  function gameRulesSynergy(champName, slot, allies, metaMap, byName) {
    const core = MC();
    let bonus = 0;
    const reasons = [];

    const isSup = core?.isDedicatedSupport?.(champName, metaMap);
    const dp = draftProfile(champName, metaMap);
    const isCarry = (dp.dpsWeight ?? 0) >= 0.55 || hasTag(champName, "scaling", metaMap) || hasTag(champName, "marksman", metaMap);

    if (slot === "Support" && isSup) {
      const carry = allies.find(
        (a) => (draftProfile(a, metaMap).dpsWeight ?? 0) >= 0.55 ||
          hasTag(a, "scaling", metaMap) || hasTag(a, "marksman", metaMap)
      );
      if (carry) {
        bonus += 44;
        reasons.push(`Support funnel or → ${carry}`);
        if (meta(champName, metaMap).bestPairings?.includes(carry)) bonus += 28;
      }
    }

    if (slot === "Bot" && isCarry) {
      bonus += 28;
      reasons.push("Carry Bot (+20% or TFM2)");
      if (allies.some((a) => core?.isDedicatedSupport?.(a, metaMap))) bonus += 34;
    }

    if (slot === "Mid" && (hasTag(champName, "mage_burst", metaMap) || hasTag(champName, "wave_clear", metaMap))) {
      if (allies.some((a) => hasTag(a, "frontline", metaMap))) {
        bonus += 22;
        reasons.push("Mid mage (+20% XP) + front");
      }
    }

    if (slot === "Top" && (hasTag(champName, "frontline", metaMap) || (dp.tankWeight ?? 0) >= 0.7)) {
      if (allies.some((a) => hasTag(a, "mage_burst", metaMap) || hasTag(a, "wave_clear", metaMap))) {
        bonus += 22;
        reasons.push("Top regen % + mage Mid");
      }
    }

    if (slot === "Jungle" &&
      (hasTag(champName, "mobility", metaMap) || hasTag(champName, "aggressive_jungle", metaMap) || hasTag(champName, "pick_jungle", metaMap))) {
      if (allies.some((a) => hasTag(a, "frontline", metaMap))) {
        bonus += 20;
        reasons.push("Jungle MS + Top tank");
      }
    }

    if (champName === "Médecin de la peste" && slot === "Support") {
      const nearCarry = allies.some((a) => {
        const o = cOptimalSlots(a, byName, metaMap);
        return o.includes("Bot") || o.includes("Jungle");
      });
      if (nearCarry) {
        bonus += 24;
        reasons.push("Médecin — élixir sans or (guide)");
      }
    }

    const duo = knownDuoBonus(champName, allies, metaMap);
    bonus += duo.bonus;
    reasons.push(...duo.reasons);

    return { bonus, reasons };
  }

  function tagNeedBonus(champName, allies, metaMap) {
    let bonus = 0;
    const reasons = [];
    const tags = meta(champName, metaMap).tags || [];
    for (const need of missingTags(allies, metaMap).slice(0, 5)) {
      if (tags.includes(need.tag)) {
        bonus += need.weight;
        reasons.push(`Comble ${need.label}`);
      }
    }
    return { bonus, reasons };
  }

  function pairingBonus(champName, allies, metaMap, byName) {
    const core = MC();
    let bonus = 0;
    const reasons = [];
    const c = champ(champName, byName, metaMap);
    const pairList = c.bestPairings || meta(champName, metaMap).bestPairings || [];

    for (const ally of allies) {
      if (pairList.includes(ally)) {
        const pts = core?.pairingPts?.(champName, ally, metaMap) ?? 64;
        bonus += Math.min(pts * 0.42, 52);
        reasons.push(`Pairing ${ally}`);
      }
      if (meta(ally, metaMap).bestPairings?.includes(champName)) {
        bonus += 24;
        reasons.push(`Mutuel ${ally}`);
      }
    }
    return { bonus, reasons };
  }

  function roleGapBonus(champName, slot, allies, metaMap, phase) {
    const core = MC();
    if (!core?.teamSkeleton || !core?.SLOT_ROLE) return { bonus: 0, reasons: [] };
    const skel = core.teamSkeleton(allies, metaMap);
    const roleKey = core.SLOT_ROLE[slot];
    let bonus = 0;
    const reasons = [];

    if (roleKey && !skel.filled[roleKey] && core.roleFilled?.(champName, roleKey, metaMap)) {
      const w = phase === "opening" && roleKey === "frontline" ? 52
        : phase === "core" ? 48
        : 36;
      bonus += w;
      reasons.push(`Rôle ${roleKey} sur ${slot}`);
    }
    if (slot === "Mid" && !skel.filled.wave_clear && hasTag(champName, "wave_clear", metaMap)) {
      bonus += phase === "core" ? 40 : 28;
      reasons.push("Wave clear Mid");
    }
    if (slot === "Jungle" && !skel.filled.frontline &&
      (hasTag(champName, "aggressive_jungle", metaMap) || hasTag(champName, "pick_jungle", metaMap))) {
      bonus += 22;
      reasons.push("Tempo jungle");
    }
    return { bonus, reasons };
  }

  function compositionPenalty(champName, slot, allies, metaMap) {
    const core = MC();
    let pen = 0;
    const reasons = [];

    if (core?.isDedicatedSupport?.(champName, metaMap)) {
      const supCount = countDedicatedSupport(allies, metaMap);
      if (supCount >= 1) {
        pen -= 180 + supCount * 55;
        reasons.push("Déjà un support dédié");
      } else if (!hasCarryAnchor(allies, metaMap) && allies.length >= 1 && allies.length <= 3) {
        pen -= 95;
        reasons.push("Carry d'abord, support ensuite");
      }
      if (slot !== "Support" && !hasTag(champName, "frontline", metaMap)) {
        pen -= 45;
        reasons.push("Support hors slot Support");
      }
    }

    const prof = core?.compositionProfile?.(allies, metaMap);
    if (prof) {
      if (prof.dedicatedSupport >= 2 && core.isDedicatedSupport(champName, metaMap)) {
        pen -= 120;
      }
      if (prof.waveClear >= 2 && hasTag(champName, "wave_clear", metaMap) && !hasTag(champName, "mage_burst", metaMap)) {
        pen -= 35;
        reasons.push("Wave clear redondant");
      }
    }

    const dp = draftProfile(champName, metaMap);
    if ((dp.dpsWeight ?? 0) >= 0.55 && allies.filter((a) => (draftProfile(a, metaMap).dpsWeight ?? 0) >= 0.55).length >= 2) {
      pen -= 40;
      reasons.push("Trop de carries");
    }

    return { pen, reasons };
  }

  function enemyThreatPenalty(champName, slot, ctx) {
    const { oppNames, oppComp, metaMap } = ctx;
    let pen = 0;
    const reasons = [];
    const core = MC();

    const oppLane = oppComp?.[slot];
    if (oppLane && meta(champName, metaMap).worstMatchups?.includes(oppLane)) {
      pen -= 72;
      reasons.push(`Counter lane vs ${oppLane}`);
    }

    for (const e of oppNames) {
      if (meta(champName, metaMap).worstMatchups?.includes(e)) {
        const rank = meta(champName, metaMap).worstMatchups.indexOf(e);
        pen -= Math.max(28, 64 - rank * 12);
        if (reasons.length < 2) reasons.push(`Faible vs ${e}`);
      }
    }

    if (core?.laneMatchup && oppLane) {
      const lm = core.laneMatchup(champName, oppLane, metaMap);
      if (lm.verdict === "lose" && lm.score <= -36) {
        pen -= 38;
        reasons.push(`Lane ${slot} perdante`);
      }
    }

    return { pen, reasons };
  }

  function firstPickBonus(champName, metaMap, byName, ctx = {}) {
    const core = MC();
    let bonus = tierVal(champName, metaMap) * 0.08;
    const reasons = [];

    if (core?.isDedicatedSupport?.(champName, metaMap)) {
      bonus -= 140;
      reasons.push("Pas support pure en B1");
    } else if (FLEX_ANCHORS.has(champName)) {
      bonus += 42;
      reasons.push("Flex anchor meta");
    } else if (hasTag(champName, "frontline", metaMap) || (draftProfile(champName, metaMap).tankWeight ?? 0) >= 0.75) {
      bonus += 38;
      reasons.push("Ancre front Top/Jungle");
    } else if ((draftProfile(champName, metaMap).dpsWeight ?? 0) >= 0.58) {
      bonus += 32;
      reasons.push("Ancre carry Bot/Mid");
    }

    if (tierVal(champName, metaMap) >= 76) {
      bonus += 18;
      reasons.push("Tier S/A");
    }

    const opts = cOptimalSlots(champName, byName, metaMap);
    if (opts.includes("Bot") && (draftProfile(champName, metaMap).dpsWeight ?? 0) >= 0.5) {
      bonus += 48;
      reasons.push("Blind ADC / carry Bot");
    } else if (opts.includes("Jungle")) {
      bonus += 28;
      reasons.push("Blind Jungle flex");
    } else if (opts.includes("Mid")) {
      bonus += 18;
      reasons.push("Blind Mid flex");
    }
    if (opts[0] && !reasons.some((r) => r.includes(opts[0]))) reasons.push(`Profil ${opts[0]}`);
    return { bonus, reasons };
  }

  function cOptimalSlots(name, byName, metaMap) {
    const c = champ(name, byName, metaMap);
    return c.optimalSlots || meta(name, metaMap).optimalSlots || [];
  }

  function layoutWithPick(allies, champName, slot, ctx) {
    const core = MC();
    const names = allies.concat(champName);
    const evalCtx = {
      byName: ctx.byName,
      metaMap: ctx.metaMap,
      oppNames: ctx.oppNames || [],
      oppComp: ctx.oppComp || {},
      slotsLeft: Math.max(0, (ctx.openSlots?.length ?? 5 - allies.length) - 1),
    };
    return core.bestLayout(names, evalCtx, { name: champName, slot });
  }

  function scorePickAtSlot(champName, slot, ctx) {
    const core = MC();
    if (!core) return { score: 0, reasons: [], eval: null };

    const { allies, oppNames, oppComp, byName, metaMap, openSlots, phase = "core" } = ctx;
    const pm = phaseMultiplier(phase);

    const beforeLayout = core.bestLayout(allies, {
      byName, metaMap, oppNames, oppComp,
      slotsLeft: openSlots?.length ?? Math.max(0, 5 - allies.length),
    });
    const afterLayout = layoutWithPick(allies, champName, slot, ctx);

    const beforeEv = beforeLayout.eval || core.evaluateTeam(allies, {
      byName, metaMap, oppNames, oppComp,
      assignment: beforeLayout.assignment,
      slotsLeft: openSlots?.length ?? 0,
    });
    const afterEv = afterLayout.eval || core.evaluateTeam(allies.concat(champName), {
      byName, metaMap, oppNames, oppComp,
      assignment: afterLayout.assignment,
      slotsLeft: Math.max(0, (openSlots?.length ?? 1) - 1),
    });

    let score = (afterEv.total - beforeEv.total) * pm.eval;
    score += (core.skeletonFillBonus?.(allies, champName, metaMap) ?? 0) * pm.skeleton;

    const syn = gameRulesSynergy(champName, slot, allies, metaMap, byName);
    score += syn.bonus * pm.synergy;

    const pair = pairingBonus(champName, allies, metaMap, byName);
    score += pair.bonus * pm.synergy;

    const tags = tagNeedBonus(champName, allies, metaMap);
    score += tags.bonus * pm.skeleton;

    const roleGap = roleGapBonus(champName, slot, allies, metaMap, phase);
    score += roleGap.bonus * pm.skeleton;

    const ctrCtx = { allies, oppNames, oppComp, metaMap, byName };
    const ctr = core.counterPickBonus ? core.counterPickBonus(champName, slot, ctrCtx) : { score: 0, reasons: [] };
    score += (ctr.score || 0) * pm.counter;

    score += core.slotFit(champName, slot, metaMap, byName) * 0.52 * pm.slot;

    const compPen = compositionPenalty(champName, slot, allies, metaMap);
    score += compPen.pen;

    const threat = enemyThreatPenalty(champName, slot, ctx);
    score += threat.pen;

    let fpReasons = [];
    if (!allies.length) {
      const fp = firstPickBonus(champName, metaMap, byName, {
        oppNames,
        sessionIndex: ctx.sessionIndex,
        banCount: ctx.banCount,
        takenNames: ctx.takenNames,
        playerTraits: ctx.playerTraits,
      });
      score += fp.bonus * pm.tier;
      fpReasons = fp.reasons;
    }

    const tierLayer = tierPickLayer(champName, metaMap, phase, allies);
    score += tierLayer.score * pm.tier * LAYER.tier;

    const mtgFam = mtgFamilyPickLayer(champName, allies, byName, metaMap, phase);
    score += mtgFam.score * pm.mtg * LAYER.mtgFamily;

    const abil = abilityPickLayer(champName, allies, oppNames, byName, metaMap);
    score += abil.score * pm.ability * LAYER.ability;

    const reasons = [];
    const delta = afterEv.total - beforeEv.total;
    if (delta > 12) reasons.push("Renforce la comp");
    const filledBefore = beforeEv.gaps?.length ?? 0;
    const filledAfter = afterEv.gaps?.length ?? 0;
    if (filledAfter < filledBefore && beforeEv.gaps?.[0]) {
      reasons.push(`Comble ${beforeEv.gaps[0]}`);
    }
    reasons.push(...fpReasons, ...tierLayer.reasons.slice(0, 1), ...mtgFam.reasons.slice(0, 2));
    reasons.push(...abil.reasons.slice(0, 2));
    reasons.push(...syn.reasons.slice(0, 2), ...pair.reasons.slice(0, 2));
    reasons.push(...tags.reasons.slice(0, 2), ...roleGap.reasons.slice(0, 1));
    reasons.push(...ctr.reasons.slice(0, 2));
    reasons.push(...compPen.reasons.slice(0, 1), ...threat.reasons.slice(0, 1));

    const opts = cOptimalSlots(champName, byName, metaMap);
    if (!reasons.length) {
      if (opts.includes(slot)) reasons.push(`Slot optimal ${slot}`);
      else reasons.push(`Tier ${meta(champName, metaMap).tierMeta || "?"}`);
    }

    const BD = global.TFM2Beatdown;
    let draftRole = null;
    if (BD && oppNames?.length) {
      const projected = allies.concat(champName);
      let laneNet = 0;
      if (core.lanesFromComps && oppComp && Object.keys(oppComp).length) {
        const projComp = {};
        for (const a of afterLayout.assignment || [{ name: champName, slot }]) {
          projComp[a.slot] = a.name;
        }
        const lanes = core.lanesFromComps(projComp, oppComp, metaMap);
        for (const s of SLOTS()) laneNet += (lanes[s]?.score || 0) / 100;
      }
      const roles = BD.assignRoles(projected, oppNames, metaMap, byName, {
        laneNet,
        compMargin: delta,
      });
      draftRole = roles;
      const rolePick = BD.scorePickForRole(champName, slot, allies, ctx, roles);
      const roleW = (phase === "closing" ? 1.55 : 2.05) * LAYER.beatdown;
      score += rolePick.score * roleW * pm.beatdown;
      reasons.unshift(roles.label, ...rolePick.reasons.slice(0, 2));
    }

    const draftCtx = {
      ...ctx,
      allies,
      phase,
      oppNames,
      oppComp,
      metaMap,
      byName,
      projectedComp: Object.fromEntries(
        (afterLayout.assignment || [{ name: champName, slot }]).map((a) => [a.slot, a.name])
      ),
    };
    score = global.TFM2Adaptive?.enrichDraftPickScore?.(score, champName, slot, draftCtx, beforeEv, afterEv) ?? score;

    return {
      score: Math.round(score * 10) / 10,
      slot,
      reasons: [...new Set(reasons)].slice(0, 8),
      eval: afterEv,
      role: draftRole,
    };
  }

  function scorePickCandidate(champName, ctx) {
    const core = MC();
    if (!core) return { score: 0, slot: SLOTS()[0], reasons: ["Engine indisponible"], eval: null };

    const { openSlots, hintSlot, allies = [] } = ctx;
    let slots = (openSlots?.length ? openSlots : SLOTS()).slice();
    if (!slots.length) slots.push(SLOTS()[0]);

    /** LoL B1 : scorer uniquement le prochain blind (Bot → Jungle → Mid). */
    if (!allies.length && (ctx.phase === "opening" || ctx.phase === undefined)) {
      const blindOrder = ["Bot", "Jungle", "Mid"];
      const nextBlind = blindOrder.find((s) => slots.includes(s));
      if (nextBlind) slots = [nextBlind];
    }

    let best = null;
    for (const slot of slots) {
      let r = scorePickAtSlot(champName, slot, ctx);
      if (hintSlot === slot) r = { ...r, score: r.score + 28 };
      if (!best || r.score > best.score) best = r;
    }
    if (!best) {
      return { score: 0, slot: slots[0] || SLOTS()[0], reasons: ["Placement par défaut"], eval: null };
    }
    return best;
  }

  function scoreBanCandidate(champName, ctx) {
    const core = MC();
    const FC = global.TFM2FamilyCore;
    const AC = global.TFM2AbilityCore;
    const { oppNames = [], ourNames = [], byName, metaMap, phase = "core" } = ctx;
    let score = tierVal(champName, metaMap) * 0.28;
    const reasons = [];

    const BD = global.TFM2Beatdown;
    if (BD?.scoreBanForRole) {
      const banRole = BD.scoreBanForRole(champName, ourNames, oppNames, metaMap, byName, { phase });
      const banW = phase === "opening" ? 2.15 : phase === "closing" ? 1.75 : 1.95;
      score += banRole.score * banW * LAYER.beatdown;
      reasons.push(...banRole.reasons.slice(0, 3));
    }

    const tierLabel = meta(champName, metaMap).tierMeta;
    const tierBonus = tierVal(champName, metaMap) >= 76 ? (phase === "opening" ? 38 : 26) : 0;
    if (tierBonus) {
      score += tierBonus;
      reasons.push(`Tier ${tierLabel} meta`);
    } else if (tierVal(champName, metaMap) >= 54 && phase === "opening" && reasons.length < 2) {
      score += 10;
      reasons.push(`Tier ${tierLabel} — deny solide`);
    }
    if (FLEX_ANCHORS.has(champName)) {
      score += 22;
      reasons.push("Deny flex anchor");
    }

    if (core?.scoreMtgBanBonus) {
      const mtgBan = core.scoreMtgBanBonus(champName, ourNames, oppNames, byName, metaMap);
      score += mtgBan.score * LAYER.banMtg;
      reasons.push(...mtgBan.reasons.slice(0, 2));
    }

    if (FC && oppNames.length) {
      const enBefore = FC.teamFamilySummary(oppNames, byName, metaMap);
      const enAfter = FC.teamFamilySummary(oppNames.concat(champName), byName, metaMap);
      const famDeny = enAfter.score - enBefore.score;
      if (famDeny > 12) {
        score += famDeny * 0.55;
        if (enAfter.dominantLabel) reasons.push(`Complète ${enAfter.dominantLabel}`);
        else reasons.push("Renforce plan familial adverse");
      }
    }

    if (AC?.banKitDeny) {
      const kitBan = AC.banKitDeny(champName, ourNames, oppNames, byName, metaMap);
      score += kitBan.score * LAYER.banAbility;
      reasons.push(...kitBan.reasons.slice(0, 2));
    }

    if (core) {
      const oppBefore = core.evaluateTeam(oppNames, { byName, metaMap, slotsLeft: 5 - oppNames.length });
      const oppAfter = core.evaluateTeam(oppNames.concat(champName), {
        byName, metaMap, slotsLeft: Math.max(0, 5 - oppNames.length - 1),
      });
      const deny = oppAfter.total - oppBefore.total;
      if (deny > 10) {
        score += deny * 0.4;
        reasons.push("Renforce leur comp");
      }

      const oppSkel = core.teamSkeleton(oppNames, metaMap);
      const GAP_TO_ROLE = {
        frontline: "frontline",
        "mage AP": "mage",
        "DPS carry": "dps",
        "save/peel": "enchanter",
        "wave clear": "wave_clear",
      };
      for (const gap of oppSkel.gaps || []) {
        const roleKey = GAP_TO_ROLE[gap];
        if (roleKey && core.roleFilled?.(champName, roleKey, metaMap)) {
          score += 18;
          reasons.push(`Comble leur ${gap}`);
          break;
        }
      }
    }

    const ourTags = teamTags(ourNames, metaMap);
    if (ourTags.has("scaling") && (hasTag(champName, "assassin", metaMap) || hasTag(champName, "dive", metaMap))) {
      score += 26;
      reasons.push("Anti-dive vs notre scale");
    }
    if (ourTags.has("poke") && hasTag(champName, "engage", metaMap)) {
      score += 20;
      reasons.push("Engage vs poke");
    }

    if (!reasons.length) reasons.push(`Retirer ${champName} du pool`);

    score += global.TFM2Adaptive?.championIdentityScore?.(champName, ourNames, oppNames, metaMap, byName) ?? 0;
    score += global.TFM2Adaptive?.counterProfileBonus?.(
      champName,
      global.TFM2Adaptive.enemyProfileVector(oppNames, metaMap),
      metaMap
    ) ?? 0;

    return { score: Math.round(score * 10) / 10, reasons: [...new Set(reasons)].slice(0, 7) };
  }

  function compareComps(ourComp, enemyComp, byName, metaMap) {
    const BD = global.TFM2Beatdown;
    if (BD?.predictMatch) {
      const pred = BD.predictMatch(ourComp, enemyComp, metaMap, byName);
      if (!pred.complete) return pred;
      const core = MC();
      const ourNames = SLOTS().map((s) => ourComp[s]).filter(Boolean);
      const ourEval = core?.evaluateTeam?.(ourNames, {
        byName, metaMap, oppNames: SLOTS().map((s) => enemyComp[s]).filter(Boolean),
        oppComp: enemyComp, slotsLeft: 0,
      });
      return {
        ...pred,
        our: {
          ...pred.our,
          gaps: ourEval?.gaps,
          skeleton: ourEval?.skeleton,
        },
      };
    }

    const core = MC();
    if (!core) return { complete: false };

    const slots = SLOTS();
    const ourNames = slots.map((s) => ourComp[s]).filter(Boolean);
    const enemyNames = slots.map((s) => enemyComp[s]).filter(Boolean);
    if (ourNames.length < 5 || enemyNames.length < 5) {
      return { complete: false, ourCount: ourNames.length, enemyCount: enemyNames.length };
    }

    const ourEval = core.evaluateTeam(ourNames, {
      byName, metaMap, oppNames: enemyNames, oppComp: enemyComp, slotsLeft: 0,
    });
    const enemyEval = core.evaluateTeam(enemyNames, {
      byName, metaMap, oppNames: ourNames, oppComp: ourComp, slotsLeft: 0,
    });
    const margin = ourEval.total - enemyEval.total;
    return {
      complete: true,
      our: { score: Math.round(ourEval.total), breakdown: ourEval.breakdown, plan: "Skeleton OK" },
      enemy: { score: Math.round(enemyEval.total), breakdown: enemyEval.breakdown, plan: "Skeleton OK" },
      margin: Math.round(margin),
      winProb: core.winProbFromScores(ourEval.total, enemyEval.total),
    };
  }

  global.TFM2DraftCore = {
    TAG_NEEDS,
    LAYER,
    missingTags,
    tierPickLayer,
    mtgFamilyPickLayer,
    abilityPickLayer,
    scorePickCandidate,
    scorePickAtSlot,
    scoreBanCandidate,
    compareComps,
  };
})(typeof window !== "undefined" ? window : globalThis);
