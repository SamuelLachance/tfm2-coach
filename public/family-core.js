/**
 * TFM2 Family Core — logique familles / types de comp (Shanei, alignée lol-coach).
 */
(function (global) {
  const SLOTS = ["Top", "Jungle", "Mid", "Bot", "Support"];

  const FAMILY_LABELS = {
    tank_engage: "Tank engage",
    tank_disengage: "Tank disengage",
    bruiser_teamfight: "Bruiser teamfight",
    bruiser_split: "Bruiser split",
    mage_control: "Mage contrôle",
    mage_dps: "Mage DPS",
    assassin_ad_pick: "Assassin AD pick",
    assassin_ap_pick: "Assassin AP pick",
    adc_hypercarry: "ADC hypercarry",
    adc_short_allin: "ADC all-in",
    adc_poke: "ADC poke",
    adc_tempo: "ADC tempo",
    support_enchanter: "Support enchanter",
    support_engage: "Support engage",
    support_poke: "Support poke",
    support_disengage: "Support disengage",
    jungle_defensive: "Jungle défensive",
    jungle_offensive: "Jungle offensive",
    jungle_hypercarry: "Jungle hypercarry",
    global_pick: "Pick global",
    specialist: "Spécialiste",
    ovni: "Ovni",
  };

  const FAMILY_COMP_TYPES = {
    tank_engage: ["teamfight_engage"],
    tank_disengage: ["poke_disengage"],
    bruiser_teamfight: ["teamfight_engage"],
    bruiser_split: ["split_push"],
    mage_control: ["poke_siege", "poke_disengage"],
    mage_dps: ["lane_tempo", "all_in"],
    assassin_ad_pick: ["pick_global", "all_in"],
    assassin_ap_pick: ["pick_global", "all_in"],
    adc_hypercarry: ["hypercarry"],
    adc_short_allin: ["all_in"],
    adc_poke: ["poke_siege", "poke_disengage"],
    adc_tempo: ["lane_tempo"],
    support_enchanter: ["hypercarry"],
    support_engage: ["teamfight_engage", "all_in"],
    support_poke: ["poke_siege", "poke_disengage"],
    support_disengage: ["poke_disengage"],
    jungle_defensive: ["hypercarry", "poke_disengage"],
    jungle_offensive: ["lane_tempo", "all_in"],
    jungle_hypercarry: ["hypercarry"],
    global_pick: ["pick_global"],
    specialist: ["lane_tempo"],
    ovni: ["pick_global"],
  };

  const COMP_LABELS = {
    poke_siege: "Poke / Siege",
    poke_disengage: "Poke + Disengage",
    teamfight_engage: "Teamfight / Engage",
    split_push: "Split push",
    hypercarry: "Hypercarry",
    lane_tempo: "Lane tempo",
    all_in: "All-in / Catch",
    pick_global: "Pick / Global",
  };

  /** Biais tactique jungle par type de comp dominant. */
  const COMP_TACTICS_BIAS = {
    hypercarry: "protect_scale",
    poke_disengage: "side_pressure_trade",
    poke_siege: "side_pressure_trade",
    split_push: "side_pressure_trade",
    pick_global: "pick_before_morgard",
    all_in: "pick_before_morgard",
    teamfight_engage: "early_serpent_pressure",
    lane_tempo: "early_serpent_pressure",
  };

  function meta(name, metaMap) {
    return metaMap?.[name] || {};
  }

  function champ(name, byName, metaMap) {
    return byName?.get?.(name) || metaMap?.[name] || { name };
  }

  function familyKey(name, byName, metaMap) {
    const m = meta(name, metaMap);
    const c = champ(name, byName, metaMap);
    return (
      m.family ||
      c.championFamily?.key ||
      c.colorIdentity?.family ||
      m.colorIdentity?.family ||
      ""
    );
  }

  function familyLabel(key) {
    return FAMILY_LABELS[key] || key;
  }

  function resolveCompTypes(name, byName, metaMap) {
    const m = meta(name, metaMap);
    const c = champ(name, byName, metaMap);
    if (m.compTypes?.length) return m.compTypes.slice(0, 2);
    const fam = c.championFamily?.compTypes || FAMILY_COMP_TYPES[familyKey(name, byName, metaMap)] || [];
    return fam.slice(0, 2);
  }

  function buildVector(name, byName, metaMap) {
    const fk = familyKey(name, byName, metaMap);
    const compTypes = resolveCompTypes(name, byName, metaMap);
    const m = meta(name, metaMap);
    const tags = new Set(m.tags || []);
    return {
      name,
      familyKey: fk,
      familyLabel: m.familyLabel || familyLabel(fk),
      compTypes,
      tags,
      hasTag: (t) => tags.has(t),
    };
  }

  function teamVectors(names, byName, metaMap) {
    return names.filter(Boolean).map((n) => buildVector(n, byName, metaMap));
  }

  /** Cohérence familles / types de comp — port Shanei (lol-coach). */
  function familyCoherence(vectors) {
    if (!vectors?.length || vectors.length < 2) {
      return { score: 0, dominant: null, dominantLabel: null, conflicts: [], typeCounts: {} };
    }
    const typeCounts = {};
    const familyKeys = new Set();
    for (const v of vectors) {
      if (v.familyKey) familyKeys.add(v.familyKey);
      for (const t of v.compTypes || []) {
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      }
    }
    const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    const dominant = sorted[0]?.[0] || null;
    let score = 0;
    const conflicts = [];

    if (dominant && sorted[0][1] >= 2) {
      score += 15 + sorted[0][1] * 12;
      if (sorted[0][1] >= 3) score += 25;
    }

    const hasPoke = (typeCounts.poke_disengage || 0) + (typeCounts.poke_siege || 0) >= 2;
    const hasEngageSup = vectors.some((v) => v.familyKey === "support_engage");
    const hasDisengageSup = vectors.some((v) => v.familyKey === "support_disengage");
    const hasHyper = (typeCounts.hypercarry || 0) >= 1;
    const hasEnchanter = vectors.some((v) => v.familyKey === "support_enchanter");
    const hasSplit = (typeCounts.split_push || 0) >= 2;

    if (hasPoke && hasEngageSup) {
      score -= 45;
      conflicts.push("Poke/disengage + support engage — plan incohérent");
    }
    if (hasHyper && !hasEnchanter && vectors.some((v) => v.familyKey === "support_engage")) {
      score -= 20;
      conflicts.push("Hypercarry sans enchanter + support engage");
    }
    if (hasHyper && hasEnchanter) score += 30;
    if (hasPoke && hasDisengageSup) score += 28;
    if (hasSplit && (typeCounts.pick_global || 0) >= 1) score += 18;

    if (familyKeys.size > 4 && vectors.length >= 4) {
      score -= 15;
      conflicts.push("Trop de familles différentes — manque cohérence");
    }

    return {
      score,
      dominant,
      dominantLabel: dominant ? COMP_LABELS[dominant] || dominant : null,
      conflicts,
      typeCounts,
      familyKeys: [...familyKeys],
    };
  }

  function dominantCompType(comp, metaMap, byName) {
    const counts = {};
    for (const slot of SLOTS) {
      const name = comp[slot];
      if (!name) continue;
      for (const t of resolveCompTypes(name, byName, metaMap)) {
        counts[t] = (counts[t] || 0) + 1;
      }
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || null;
  }

  function familyPickBonus(champName, allies, byName, metaMap) {
    const fk = familyKey(champName, byName, metaMap);
    if (!fk) return { bonus: 0, label: null };
    const label = familyLabel(fk);
    const same = allies.filter((a) => familyKey(a, byName, metaMap) === fk).length;
    if (same >= 2) return { bonus: 38, label: `Famille ${label} (×${same + 1})` };
    if (same === 1) return { bonus: 32, label: `Famille ${label}` };
    if (!allies.length) return { bonus: 10, label: `Identité ${label}` };

    const before = familyCoherence(teamVectors(allies, byName, metaMap));
    const after = familyCoherence(teamVectors(allies.concat(champName), byName, metaMap));
    const delta = after.score - before.score;
    if (delta > 8) return { bonus: 28 + Math.min(delta, 40), label: "Respecte la famille" };
    if (after.dominant && after.dominant !== before.dominant && (after.typeCounts[after.dominant] || 0) >= 2) {
      return { bonus: 22, label: `Plan ${COMP_LABELS[after.dominant] || after.dominant}` };
    }
    return { bonus: 0, label: null };
  }

  function compFoundationDelta(champName, allies, byName, metaMap) {
    const before = familyCoherence(teamVectors(allies, byName, metaMap));
    const after = familyCoherence(teamVectors(allies.concat(champName), byName, metaMap));
    return {
      delta: after.score - before.score,
      before,
      after,
    };
  }

  function tacticsBiasFromComp(comp, metaMap, byName) {
    const ct = dominantCompType(comp, metaMap, byName);
    return ct ? COMP_TACTICS_BIAS[ct] || null : null;
  }

  function teamFamilySummary(names, byName, metaMap) {
    const vectors = teamVectors(names, byName, metaMap);
    const fam = familyCoherence(vectors);
    return {
      ...fam,
      vectors,
      compTypeLabel: fam.dominantLabel,
    };
  }

  global.TFM2FamilyCore = {
    SLOTS,
    FAMILY_LABELS,
    FAMILY_COMP_TYPES,
    COMP_LABELS,
    COMP_TACTICS_BIAS,
    familyKey,
    familyLabel,
    resolveCompTypes,
    buildVector,
    teamVectors,
    familyCoherence,
    dominantCompType,
    familyPickBonus,
    compFoundationDelta,
    tacticsBiasFromComp,
    teamFamilySummary,
  };
})(typeof window !== "undefined" ? window : globalThis);
