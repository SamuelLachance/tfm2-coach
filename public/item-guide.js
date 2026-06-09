/**
 * TFM2 Item Guide v2 — builds par scaling des sorts (adRatio/apRatio) + tanks adaptés aux dégâts adverses.
 */
(function (global) {
  const SLOTS = ["Top", "Jungle", "Mid", "Bot", "Support"];

  const ITEM_CATEGORY = {
    PLAYER: "player",
    AD: "AD",
    AP: "Magique",
    AS: "Vit. d'attaque",
    ARMOR: "Défense",
    MR: "Résist. Magique",
    HP: "PV",
  };

  const ITEM_CATEGORY_LABELS = {
    [ITEM_CATEGORY.PLAYER]: "Laisser le joueur décider",
    [ITEM_CATEGORY.AD]: "AD",
    [ITEM_CATEGORY.AP]: "Magique",
    [ITEM_CATEGORY.AS]: "Vit. d'attaque",
    [ITEM_CATEGORY.ARMOR]: "Défense",
    [ITEM_CATEGORY.MR]: "Résist. Magique",
    [ITEM_CATEGORY.HP]: "PV",
  };

  const ITEM_TO_CATEGORY = {
    "Épée de fer": ITEM_CATEGORY.AD,
    "Dague rapide": ITEM_CATEGORY.AS,
    "Armure d'acier": ITEM_CATEGORY.ARMOR,
    "Cape mystique": ITEM_CATEGORY.MR,
    "Cristal arcanique": ITEM_CATEGORY.AP,
    "Orbe vital": ITEM_CATEGORY.HP,
    "Lame perforante": ITEM_CATEGORY.AD,
    "Lame de vol de vie": ITEM_CATEGORY.AD,
    "Dague maudite": ITEM_CATEGORY.AD,
    "Marteau brise-bouclier": ITEM_CATEGORY.AD,
    "Dague de vent": ITEM_CATEGORY.AS,
    "Arc long": ITEM_CATEGORY.AS,
    "Lame gardienne": ITEM_CATEGORY.AS,
    "Lance sauvage": ITEM_CATEGORY.AS,
    "Armure de fer": ITEM_CATEGORY.ARMOR,
    "Bouclier ralentisseur": ITEM_CATEGORY.ARMOR,
    "Plaque réfléchissante": ITEM_CATEGORY.ARMOR,
    "Volonté inébranlable": ITEM_CATEGORY.ARMOR,
    "Bâton du sorcier": ITEM_CATEGORY.AP,
    "Cristal chrono": ITEM_CATEGORY.AP,
    "Orbe venimeux": ITEM_CATEGORY.AP,
    "Bâton corrosif": ITEM_CATEGORY.AP,
    "Cœur de vie": ITEM_CATEGORY.HP,
    "Armure grandissante": ITEM_CATEGORY.HP,
    "Masse du géant": ITEM_CATEGORY.HP,
    "Bouclier sacrificiel": ITEM_CATEGORY.HP,
    "Voile d'aura": ITEM_CATEGORY.MR,
    "Cape affaiblissante": ITEM_CATEGORY.MR,
    "Linceul de flammes": ITEM_CATEGORY.MR,
    "Cape inflexible": ITEM_CATEGORY.MR,
    "Jugement final du seigneur de guerre": ITEM_CATEGORY.AD,
    "Souverain de la tempête": ITEM_CATEGORY.AS,
    "Forteresse imprenable": ITEM_CATEGORY.ARMOR,
    "Voile d'annihilation": ITEM_CATEGORY.MR,
    "Prophète de l'abîme": ITEM_CATEGORY.AP,
    "Fragment de corne du géant": ITEM_CATEGORY.HP,
  };

  /** Tier 5 + tier 2 utiles — tags pour scoring scaling. */
  const ITEM_META = {
    "Souverain de la tempête": { tier: 5, tags: ["as", "crit", "ad", "marksman"] },
    "Jugement final du seigneur de guerre": { tier: 5, tags: ["ad", "pen", "lifesteal", "burst_ad"] },
    "Prophète de l'abîme": { tier: 5, tags: ["ap", "pen", "cdr", "burst_ap"] },
    "Forteresse imprenable": { tier: 5, tags: ["armor", "anti_auto", "tank"] },
    "Voile d'annihilation": { tier: 5, tags: ["mr", "hp", "anti_ap", "tank"] },
    "Fragment de corne du géant": { tier: 5, tags: ["hp", "scale_hp", "tank"] },
    "Lame perforante": { tier: 2, tags: ["ad", "pen"] },
    "Lame de vol de vie": { tier: 2, tags: ["ad", "lifesteal", "bruiser"] },
    "Dague maudite": { tier: 2, tags: ["ad", "antiheal"] },
    "Marteau brise-bouclier": { tier: 2, tags: ["ad", "anti_shield"] },
    "Dague de vent": { tier: 2, tags: ["as", "ms", "assassin"] },
    "Arc long": { tier: 2, tags: ["as", "range", "marksman"] },
    "Lame gardienne": { tier: 2, tags: ["as", "survival"] },
    "Lance sauvage": { tier: 2, tags: ["as", "onhit", "scale_hp"] },
    "Bâton du sorcier": { tier: 2, tags: ["ap", "pen"] },
    "Cristal chrono": { tier: 2, tags: ["ap", "cdr"] },
    "Orbe venimeux": { tier: 2, tags: ["ap", "dot"] },
    "Bâton corrosif": { tier: 2, tags: ["ap", "scale_hp"] },
    "Armure de fer": { tier: 2, tags: ["armor"] },
    "Bouclier ralentisseur": { tier: 2, tags: ["armor", "anti_auto"] },
    "Plaque réfléchissante": { tier: 2, tags: ["armor", "reflect"] },
    "Cœur de vie": { tier: 2, tags: ["hp", "regen"] },
    "Masse du géant": { tier: 2, tags: ["hp", "scale_hp"] },
    "Bouclier sacrificiel": { tier: 2, tags: ["hp", "support"] },
    "Voile d'aura": { tier: 2, tags: ["mr", "support"] },
    "Cape affaiblissante": { tier: 2, tags: ["mr", "debuff"] },
    "Cape inflexible": { tier: 2, tags: ["mr"] },
  };

  const SURVIVAL_T5 = {
    ad: "Forteresse imprenable",
    ap: "Voile d'annihilation",
    mixed: "Fragment de corne du géant",
  };

  const SURVIVAL_T2 = {
    ad: "Armure de fer",
    ap: "Cape inflexible",
    mixed: "Cœur de vie",
  };

  function hasTag(name, tag, metaMap) {
    return metaMap[name]?.tags?.includes(tag) || false;
  }

  function draftProfile(name, metaMap) {
    return metaMap[name]?.draftProfile || {};
  }

  function detectArchetype(champion, metaMap) {
    const dp = draftProfile(champion, metaMap);
    const tags = metaMap[champion]?.tags || [];
    const adR = dp.adRatio ?? 0;
    const apR = dp.apRatio ?? 0;
    const tw = dp.tankWeight ?? 0;
    const dw = dp.dpsWeight ?? 0;
    const adShare = dp.adShare ?? 0;
    const apShare = dp.apShare ?? 0;

    if (tw >= 0.85) return "tank";
    if ((hasTag(champion, "peel", metaMap) || hasTag(champion, "heal", metaMap)) && apR >= 35 && dw < 0.55) {
      return "support_ap";
    }
    if (apShare >= 0.6 && apR >= 50) return "ap_burst";
    if (adShare >= 0.6) {
      if (hasTag(champion, "scaling", metaMap) || hasTag(champion, "marksman", metaMap)) return "marksman";
      if (hasTag(champion, "assassin", metaMap) || (adR >= 180 && tw < 0.55)) return "ad_burst";
      if (tw >= 0.48) return "bruiser";
      if (dw >= 0.5 && adR >= 90 && adR <= 240) return "marksman";
      return "ad_burst";
    }
    if (tw >= 0.48 && adR >= 70) return "bruiser";
    if (apR > adR && apR >= 40) return "ap_burst";
    if (adR >= 100) return "ad_burst";
    return "utility";
  }

  function scalingSummary(champion, metaMap) {
    const dp = draftProfile(champion, metaMap);
    const adR = dp.adRatio ?? 0;
    const apR = dp.apRatio ?? 0;
    const total = adR + apR;
    const archetype = detectArchetype(champion, metaMap);
    const parts = [];
    if (adR > 0) parts.push(`${adR}% AD`);
    if (apR > 0) parts.push(`${apR}% PM`);
    return {
      archetype,
      adR,
      apR,
      total,
      adShare: dp.adShare ?? (total ? adR / total : 0),
      apShare: dp.apShare ?? (total ? apR / total : 0),
      tankWeight: dp.tankWeight ?? 0,
      dpsWeight: dp.dpsWeight ?? 0,
      squishy: (dp.tankWeight ?? 0) < 0.45,
      label: parts.length ? parts.join(" + ") : "utilitaire",
    };
  }

  function scoreItemForChampion(itemName, profile, slotIndex, enemyCtx) {
    const meta = ITEM_META[itemName];
    if (!meta) return 0;
    const tags = meta.tags || [];
    let score = meta.tier === 5 ? 28 : 12;

    const boost = (t, w) => (tags.includes(t) ? w : 0);

    if (profile.archetype === "marksman") {
      score += boost("as", 55) + boost("crit", 45) + boost("marksman", 40);
      score += boost("ad", profile.adR * 0.08);
      if (slotIndex === 0) score += boost("as", 30);
      if (slotIndex === 1) score += boost("ad", 25) + boost("pen", 15);
      if (slotIndex === 2) score += boost("pen", 20);
    } else if (profile.archetype === "ad_burst") {
      score += boost("ad", profile.adR * 0.12) + boost("pen", 35) + boost("burst_ad", 40);
      if (slotIndex === 0) score += boost("burst_ad", 25);
      if (slotIndex === 1) score += boost("pen", 30);
      if (slotIndex === 2) score += boost("as", 15) + boost("lifesteal", 12);
    } else if (profile.archetype === "ap_burst") {
      score += boost("ap", profile.apR * 0.12) + boost("pen", 30) + boost("burst_ap", 40);
      if (slotIndex === 0) score += boost("burst_ap", 30);
      if (slotIndex === 1) score += boost("pen", 35);
      if (slotIndex === 2) score += boost("cdr", 40);
    } else if (profile.archetype === "support_ap") {
      score += boost("ap", profile.apR * 0.08) + boost("cdr", 25) + boost("support", 20);
      if (slotIndex >= 1) score += boost("mr", 20) + boost("hp", 18);
    } else if (profile.archetype === "bruiser") {
      score += boost("ad", profile.adR * 0.1) + boost("lifesteal", 25) + boost("hp", 22);
      if (slotIndex === 0) score += boost("burst_ad", 20) + boost("lifesteal", 15);
      if (slotIndex >= 1) score += boost("hp", 30) + boost("armor", 15);
    } else if (profile.archetype === "tank") {
      score += boost("tank", 40) + boost("hp", 25);
      if (enemyCtx?.primary === "ad") {
        score += boost("armor", 50) + boost("anti_auto", 35);
      } else if (enemyCtx?.primary === "ap") {
        score += boost("mr", 50) + boost("anti_ap", 40);
      } else {
        score += boost("hp", 35) + boost("scale_hp", 25);
      }
    }

    if (profile.squishy && slotIndex === 2) {
      score += boost("survival", 30);
    }

    if (enemyCtx?.healHeavy && tags.includes("antiheal")) score += 45;
    if (enemyCtx?.shieldHeavy && tags.includes("anti_shield")) score += 35;

    return score;
  }

  function pickBestItem(candidates, profile, slotIndex, enemyCtx, used) {
    let best = null;
    let bestScore = -Infinity;
    for (const name of candidates) {
      if (used.has(name)) continue;
      const s = scoreItemForChampion(name, profile, slotIndex, enemyCtx);
      if (s > bestScore) {
        bestScore = s;
        best = name;
      }
    }
    return best;
  }

  const ARCHETYPE_POOLS = {
    marksman: [
      "Souverain de la tempête",
      "Jugement final du seigneur de guerre",
      "Lame perforante",
      "Arc long",
      "Lame de vol de vie",
    ],
    ad_burst: [
      "Jugement final du seigneur de guerre",
      "Lame perforante",
      "Dague de vent",
      "Souverain de la tempête",
      "Lame de vol de vie",
    ],
    ap_burst: [
      "Prophète de l'abîme",
      "Bâton du sorcier",
      "Cristal chrono",
      "Orbe venimeux",
      "Bâton corrosif",
    ],
    support_ap: [
      "Prophète de l'abîme",
      "Voile d'annihilation",
      "Fragment de corne du géant",
      "Cristal chrono",
      "Bouclier sacrificiel",
    ],
    bruiser: [
      "Jugement final du seigneur de guerre",
      "Fragment de corne du géant",
      "Forteresse imprenable",
      "Lame de vol de vie",
      "Lance sauvage",
    ],
    tank: [
      "Forteresse imprenable",
      "Voile d'annihilation",
      "Fragment de corne du géant",
      "Armure de fer",
      "Bouclier ralentisseur",
      "Cape inflexible",
      "Cœur de vie",
    ],
    utility: [
      "Fragment de corne du géant",
      "Voile d'annihilation",
      "Prophète de l'abîme",
      "Jugement final du seigneur de guerre",
    ],
  };

  function analyzeEnemyThreat(enemyComp, metaMap) {
    let adDps = 0;
    let apDps = 0;
    let adAuto = 0;
    let apBurst = 0;
    let healHeavy = 0;
    let shieldHeavy = 0;
    let count = 0;

    for (const name of Object.values(enemyComp)) {
      if (!name) continue;
      count += 1;
      const dp = draftProfile(name, metaMap);
      const tags = metaMap[name]?.tags || [];
      const w = 0.35 + (dp.dpsWeight ?? 0.25);

      if ((dp.adShare ?? 0) >= 0.55 || (dp.adRatio ?? 0) > (dp.apRatio ?? 0)) {
        adDps += w * Math.min(1.4, (dp.adRatio ?? 0) / 180);
      }
      if ((dp.apShare ?? 0) >= 0.55 || (dp.apRatio ?? 0) > (dp.adRatio ?? 0)) {
        apDps += w * Math.min(1.4, (dp.apRatio ?? 0) / 160);
      }
      if (tags.includes("scaling") || tags.includes("marksman")) adAuto += w;
      if (tags.includes("mage_burst") || tags.includes("assassin")) apBurst += w * 0.85;
      if (tags.includes("heal")) healHeavy += 1;
      if (tags.includes("peel") || name === "Androïde" || name === "Mage de barrière") shieldHeavy += 0.5;
    }

    let primary = "mixed";
    if (adDps > apDps * 1.2) primary = "ad";
    else if (apDps > adDps * 1.2) primary = "ap";

    return {
      adDps,
      apDps,
      adAuto,
      apBurst,
      healHeavy: healHeavy >= 2,
      shieldHeavy: shieldHeavy >= 1.5,
      primary,
      mixed: primary === "mixed",
      apHeavy: apDps >= adDps * 1.15 && apBurst >= 0.8,
      adHeavy: adDps >= apDps * 1.15 && adAuto >= 0.8,
    };
  }

  function tankItemForThreat(threat, slotIndex, used) {
    const order = [];
    if (threat.adAuto >= threat.apBurst && threat.adDps >= threat.apDps * 0.65) {
      order.push("Forteresse imprenable", "Fragment de corne du géant", "Voile d'annihilation");
    } else if (threat.apBurst >= threat.adAuto && threat.apDps >= threat.adDps * 0.65) {
      order.push("Voile d'annihilation", "Fragment de corne du géant", "Forteresse imprenable");
    } else if (threat.primary === "ad") {
      order.push("Forteresse imprenable", "Fragment de corne du géant", "Voile d'annihilation");
    } else if (threat.primary === "ap") {
      order.push("Voile d'annihilation", "Fragment de corne du géant", "Forteresse imprenable");
    } else {
      order.push("Fragment de corne du géant", "Voile d'annihilation", "Forteresse imprenable");
    }

    const t2 = {
      "Forteresse imprenable": "Bouclier ralentisseur",
      "Voile d'annihilation": "Cape inflexible",
      "Fragment de corne du géant": "Cœur de vie",
    };

    const pick = order[slotIndex] || order[order.length - 1];
    if (slotIndex === 0) {
      const name = pick;
      const reason =
        name === "Forteresse imprenable"
          ? "Menace AD / auto-attaque — armure anti-DPS."
          : name === "Voile d'annihilation"
            ? "Menace AP / burst magique — RM + réduction compétences."
            : "Dégâts mixtes — scale PV (aura zone).";
      return { name, reason };
    }

    const fallback = t2[order[0]] || "Cœur de vie";
    const name = order.includes(pick) && !used.has(pick) ? pick : fallback;
    return {
      name: used.has(name) ? order.find((x) => !used.has(x)) || name : name,
      reason: `2e/3e item défensif vs ${threat.primary === "mixed" ? "mixte" : threat.primary.toUpperCase()}.`,
    };
  }

  function buildReasonForItem(champion, item, profile, slotIndex) {
    const meta = ITEM_META[item];
    const tags = meta?.tags || [];
    if (profile.archetype === "marksman" && tags.includes("as")) {
      return `Scaling auto (${profile.label}) — AS/crit prioritaire.`;
    }
    if (profile.archetype === "ap_burst" && tags.includes("ap")) {
      return `Scaling sorts ${profile.label} — burst AP.`;
    }
    if (profile.archetype === "ad_burst" && tags.includes("ad")) {
      return `Scaling sorts ${profile.label} — burst AD + pénétration.`;
    }
    if (tags.includes("tank") || tags.includes("armor") || tags.includes("mr")) {
      return `Profil tank (tw ${profile.tankWeight.toFixed(2)}) — résistance adaptée.`;
    }
    return `Build optimal ${champion} · ${profile.label}.`;
  }

  function scalingBuild(champion, metaMap, threat) {
    const profile = scalingSummary(champion, metaMap);
    const metaBuild = metaMap[champion]?.build?.filter(Boolean) || [];
    const used = new Set();
    const out = [];

    if (profile.archetype === "tank") {
      for (let i = 0; i < 3; i += 1) {
        const { name, reason } = tankItemForThreat(threat, i, used);
        used.add(name);
        out.push({ item: name, reason });
      }
      return { profile, slots: out };
    }

    const pool = [...(ARCHETYPE_POOLS[profile.archetype] || ARCHETYPE_POOLS.utility)];
    for (const m of metaBuild) {
      if (!pool.includes(m)) pool.unshift(m);
    }

    for (let i = 0; i < 3; i += 1) {
      let item = pickBestItem(pool, profile, i, threat, used);
      if (!item) item = metaBuild[i] || pool[i] || pool[0];
      let reason = buildReasonForItem(champion, item, profile, i);

      if (i === 0 && champion === "Exécuteur") {
        item = "Dague maudite";
        reason = "Exécuteur — anti-heal early vs comps sustain.";
      } else if (i === 1 && threat.healHeavy && profile.archetype !== "ap_burst") {
        if (!used.has("Dague maudite") && (profile.adShare ?? 0) >= 0.5) {
          item = "Dague maudite";
          reason = "Ennemis sustain — réduction soins.";
        }
      } else if (i === 1 && threat.shieldHeavy && !used.has("Marteau brise-bouclier")) {
        if ((profile.adShare ?? 0) >= 0.5) {
          item = "Marteau brise-bouclier";
          reason = "Shields ennemis — brise-bouclier.";
        }
      }

      used.add(item);
      out.push({ item, reason });
    }

    return { profile, slots: out };
  }

  function opponentDamageType(name, metaMap) {
    if (!name) return "mixed";
    const dp = draftProfile(name, metaMap);
    if (dp.damage === "AP" || (dp.apShare ?? 0) >= 0.55) return "ap";
    if (dp.damage === "AD" || (dp.adShare ?? 0) >= 0.55) return "ad";
    return "mixed";
  }

  function survivalItemForThreat(damageType, squishy) {
    const tier = squishy ? "t5" : "t2";
    if (damageType === "ap") {
      return tier === "t5" ? SURVIVAL_T5.ap : SURVIVAL_T2.ap;
    }
    if (damageType === "ad") {
      return tier === "t5" ? SURVIVAL_T5.ad : SURVIVAL_T2.ad;
    }
    return tier === "t5" ? SURVIVAL_T5.mixed : SURVIVAL_T2.mixed;
  }

  function adaptBuildForLane(build, champion, laneSlot, metaMap, lane, laneOpponent, threat) {
    const profile = scalingSummary(champion, metaMap);
    if (profile.archetype === "tank") return build;

    const laneType = opponentDamageType(laneOpponent, metaMap);
    const losing = lane?.verdict === "lose";
    const hardMatch = lane?.verdict === "lose";

    if (!hardMatch && !profile.squishy) return build;

    const survIdx = losing && profile.squishy ? 0 : profile.squishy ? 2 : 1;
    const dmgType = laneOpponent ? laneType : threat.primary === "ad" ? "ad" : threat.primary === "ap" ? "ap" : "mixed";
    const survItem = survivalItemForThreat(dmgType, profile.squishy && losing);
    const survLabel = ITEM_CATEGORY_LABELS[itemToCategory(survItem, metaMap, champion)] || survItem;

    const slots = build.map((s, i) => {
      if (i !== survIdx) return s;
      return {
        item: survItem,
        reason: losing
          ? `Lane ${laneSlot} perdante vs ${laneOpponent || "?"} — ${survLabel} (${dmgType.toUpperCase()}).`
          : `Matchup ${laneSlot} — ${survLabel} vs dégâts ${dmgType.toUpperCase()}.`,
      };
    });

    return slots;
  }

  function itemToCategory(itemName, metaMap, champion) {
    if (ITEM_TO_CATEGORY[itemName]) return ITEM_TO_CATEGORY[itemName];
    const lower = (itemName || "").toLowerCase();
    if (/lame|marteau|épée|jugement/.test(lower)) return ITEM_CATEGORY.AD;
    if (/dague|arc long|souverain|lance sauvage/.test(lower)) return ITEM_CATEGORY.AS;
    if (/bâton|cristal chrono|prophète|orbe venimeux|cristal arcanique/.test(lower)) return ITEM_CATEGORY.AP;
    if (/forteresse|armure|bouclier ralentisseur|plaque|volonté/.test(lower)) return ITEM_CATEGORY.ARMOR;
    if (/voile|cape mystique|linceul|cape affaiblissante/.test(lower)) return ITEM_CATEGORY.MR;
    if (/fragment|orbe vital|cœur de vie|masse du géant|bouclier sacrificiel/.test(lower)) return ITEM_CATEGORY.HP;
    const dp = champion ? draftProfile(champion, metaMap) : {};
    if ((dp.apShare ?? 0) > 0.55) return ITEM_CATEGORY.AP;
    if ((dp.adShare ?? 0) > 0.55) return ITEM_CATEGORY.AD;
    if ((dp.tankWeight ?? 0) >= 0.7) return ITEM_CATEGORY.ARMOR;
    return ITEM_CATEGORY.PLAYER;
  }

  function slotRecord(champion, index, itemName, category, reason) {
    return {
      index: index + 1,
      item: itemName,
      category,
      label: ITEM_CATEGORY_LABELS[category] || ITEM_CATEGORY_LABELS[ITEM_CATEGORY.PLAYER],
      reason,
    };
  }

  function recommendChampionItems(champion, laneSlot, metaMap, lanes, enemyComp, options = {}) {
    const { isEnemy = false } = options;
    const lane = lanes[laneSlot];
    const laneOpponent = enemyComp[laneSlot];
    const threat = analyzeEnemyThreat(enemyComp, metaMap);
    const { profile, slots: core } = scalingBuild(champion, metaMap, threat);

    let slots = isEnemy
      ? core
      : adaptBuildForLane(core, champion, laneSlot, metaMap, lane, laneOpponent, threat);

    const used = new Set();
    return slots.map((entry, i) => {
      let item = entry.item;
      if (used.has(item)) {
        const pool = ARCHETYPE_POOLS[profile.archetype] || ARCHETYPE_POOLS.utility;
        item = pool.find((p) => !used.has(p)) || item;
      }
      used.add(item);
      const reason = entry.reason || buildReasonForItem(champion, item, profile, i);
      const category = itemToCategory(item, metaMap, champion);
      return slotRecord(champion, i, item, category, reason);
    });
  }

  function recommendGuides(ourComp, enemyComp, metaMap, lanes) {
    const our = SLOTS.filter((s) => ourComp[s]).map((slot) => ({
      champion: ourComp[slot],
      laneSlot: slot,
      slots: recommendChampionItems(ourComp[slot], slot, metaMap, lanes, enemyComp, { isEnemy: false }),
    }));
    const enemy = SLOTS.filter((s) => enemyComp[s]).map((slot) => ({
      champion: enemyComp[slot],
      laneSlot: slot,
      slots: recommendChampionItems(enemyComp[slot], slot, metaMap, lanes, ourComp, { isEnemy: true }),
    }));
    return { our, enemy };
  }

  /** Compat legacy — délègue au moteur scaling. */
  function metaBuild(champion, metaMap) {
    const threat = { primary: "mixed", adDps: 0, apDps: 0, adAuto: 0, apBurst: 0 };
    return scalingBuild(champion, metaMap, threat).slots.map((s) => s.item);
  }

  global.TFM2ItemGuide = {
    SLOTS,
    ITEM_CATEGORY,
    ITEM_CATEGORY_LABELS,
    ITEM_TO_CATEGORY,
    itemToCategory,
    scalingSummary,
    detectArchetype,
    analyzeEnemyThreat,
    scalingBuild,
    metaBuild,
    recommendGuides,
    recommendChampionItems,
  };
})(typeof window !== "undefined" ? window : globalThis);
