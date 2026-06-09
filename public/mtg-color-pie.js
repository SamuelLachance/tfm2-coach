/**
 * Magic: The Gathering — color pie (WUBRG)
 * Roue : W → U → B → R → G → W
 * Alliées = adjacentes · Ennemies = non-adjacentes (2 crans)
 * Réf. : docs/mtg-color-pie.md
 */
(function (global) {
  const WHEEL = ["W", "U", "B", "R", "G"];

  const LABELS = {
    W: "Blanc", U: "Bleu", B: "Noir", R: "Rouge", G: "Vert",
  };

  const HEX = {
    W: "#f5f0dc", U: "#4a9fd4", B: "#6b6b7a", R: "#e05238", G: "#3d9e5a",
  };

  /** 5 paires alliées (adjacentes sur la roue) — guildes Ravnica */
  const ALLIED_PAIRS = [
    ["W", "U"], ["U", "B"], ["B", "R"], ["R", "G"], ["G", "W"],
  ];

  /** 5 paires ennemies (non-adjacentes) — collèges Strixhaven */
  const ENEMY_PAIRS = [
    ["W", "B"], ["W", "R"], ["U", "R"], ["U", "G"], ["B", "G"],
  ];

  const GUILDS = {
    WU: { name: "Azorius", colors: ["W", "U"], kind: "allied" },
    UB: { name: "Dimir", colors: ["U", "B"], kind: "allied" },
    BR: { name: "Rakdos", colors: ["B", "R"], kind: "allied" },
    RG: { name: "Gruul", colors: ["R", "G"], kind: "allied" },
    GW: { name: "Selesnya", colors: ["G", "W"], kind: "allied" },
  };

  const ENEMY_DUAL = {
    WB: { name: "Silverquill", colors: ["W", "B"], kind: "enemy" },
    WR: { name: "Boros", colors: ["W", "R"], kind: "enemy" },
    UR: { name: "Izzet", colors: ["U", "R"], kind: "enemy" },
    BG: { name: "Golgari", colors: ["B", "G"], kind: "enemy" },
    GU: { name: "Simic", colors: ["G", "U"], kind: "enemy" },
  };

  const SHARDS = {
    Bant: { colors: ["G", "W", "U"], kind: "shard" },
    Esper: { colors: ["W", "U", "B"], kind: "shard" },
    Grixis: { colors: ["U", "B", "R"], kind: "shard" },
    Jund: { colors: ["B", "R", "G"], kind: "shard" },
    Naya: { colors: ["R", "G", "W"], kind: "shard" },
  };

  const WEDGES = {
    Abzan: { colors: ["W", "B", "G"], kind: "wedge" },
    Sultai: { colors: ["B", "G", "U"], kind: "wedge" },
    Temur: { colors: ["G", "U", "R"], kind: "wedge" },
    Jeskai: { colors: ["U", "R", "W"], kind: "wedge" },
    Mardu: { colors: ["R", "W", "B"], kind: "wedge" },
  };

  function pairKey(a, b) {
    return [a, b].sort().join("");
  }

  const ALLIED_SET = new Set(ALLIED_PAIRS.map(([a, b]) => pairKey(a, b)));
  const ENEMY_SET = new Set(ENEMY_PAIRS.map(([a, b]) => pairKey(a, b)));

  function wheelIndex(c) {
    return WHEEL.indexOf(c);
  }

  function isAdjacent(a, b) {
    const i = wheelIndex(a);
    const j = wheelIndex(b);
    if (i < 0 || j < 0) return false;
    const d = Math.abs(i - j);
    return d === 1 || d === 4;
  }

  function isAllied(a, b) {
    return ALLIED_SET.has(pairKey(a, b));
  }

  function isEnemy(a, b) {
    return ENEMY_SET.has(pairKey(a, b));
  }

  function colorVectorFrom(ci) {
    if (!ci) return WHEEL.map(() => 0);
    return WHEEL.map((k) => (ci[k] || 0) / 24);
  }

  function sumVectors(vectors) {
    const out = WHEEL.map(() => 0);
    for (const v of vectors) {
      if (!v) continue;
      for (let i = 0; i < 5; i += 1) out[i] += v[i] || 0;
    }
    return out;
  }

  function dominantFromSum(sum, threshold = 0.35) {
    return WHEEL.map((c, i) => [c, sum[i]]).filter(([, v]) => v >= threshold).map(([c]) => c);
  }

  function activeColorsFromSum(sum, threshold = 0.12) {
    return WHEEL.filter((c, i) => sum[i] >= threshold);
  }

  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    const s = new Set(a);
    return b.every((x) => s.has(x));
  }

  function detectCombination(colorCodes) {
    const sorted = [...colorCodes].sort((a, b) => wheelIndex(a) - wheelIndex(b));
    const key = sorted.join("");
    if (colorCodes.length === 0) return { type: "none", name: "", colors: [] };
    if (colorCodes.length === 1) {
      return { type: "mono", name: LABELS[colorCodes[0]], colors: colorCodes, key };
    }
    if (colorCodes.length === 2) {
      const pk = pairKey(colorCodes[0], colorCodes[1]);
      if (GUILDS[pk]) return { type: "guild", name: GUILDS[pk].name, colors: colorCodes, key: pk, kind: "allied" };
      if (ENEMY_DUAL[pk]) return { type: "enemy_dual", name: ENEMY_DUAL[pk].name, colors: colorCodes, key: pk, kind: "enemy" };
      return { type: "dual", name: pk, colors: colorCodes, key: pk };
    }
    if (colorCodes.length === 3) {
      for (const [name, def] of Object.entries(SHARDS)) {
        if (sameSet(colorCodes, def.colors)) return { type: "shard", name, colors: colorCodes, key: name, kind: "shard" };
      }
      for (const [name, def] of Object.entries(WEDGES)) {
        if (sameSet(colorCodes, def.colors)) return { type: "wedge", name, colors: colorCodes, key: name, kind: "wedge" };
      }
      return { type: "tricolor", name: key, colors: colorCodes, key };
    }
    if (colorCodes.length === 4) return { type: "four", name: key, colors: colorCodes, key };
    if (colorCodes.length >= 5) return { type: "five", name: "WUBRG", colors: WHEEL.slice(), key: "WUBRG" };
    return { type: "multicolor", name: key, colors: colorCodes, key };
  }

  function combinationScore(combo) {
    switch (combo.type) {
      case "mono": return 28;
      case "guild": return 42;
      case "enemy_dual": return 18;
      case "shard": return 55;
      case "wedge": return 48;
      case "dual": return 22;
      case "tricolor": return 12;
      case "four": return 6;
      case "five": return -18;
      default: return 0;
    }
  }

  function pairRelationScore(d1, d2) {
    if (!d1?.length || !d2?.length) return 0;
    let s = 0;
    for (const x of d1) {
      for (const y of d2) {
        if (x === y) s += 10;
        else if (isAllied(x, y)) s += 16;
        else if (isEnemy(x, y)) s -= 24;
      }
    }
    return s;
  }

  function identityAlignBonus(champIdentity, teamCombo) {
    if (!champIdentity || !teamCombo?.colors?.length) return 0;
    const id = champIdentity.toUpperCase().replace(/[^WUBRG]/g, "");
    if (!id) return 0;
    const champColors = [...new Set(id.split(""))].filter((c) => WHEEL.includes(c));
    const champCombo = detectCombination(champColors);
    if (teamCombo.type === "guild" && champCombo.key === teamCombo.key) return 38;
    if (teamCombo.type === "shard" && champColors.every((c) => teamCombo.colors.includes(c))) return 32;
    if (teamCombo.type === "wedge" && champColors.every((c) => teamCombo.colors.includes(c))) return 28;
    if (teamCombo.type === "mono" && champColors.length === 1 && champColors[0] === teamCombo.colors[0]) return 26;
    let overlap = 0;
    for (const c of champColors) if (teamCombo.colors.includes(c)) overlap += 1;
    return overlap * 12;
  }

  function colorCoherence(vectors) {
    if (!vectors?.length) {
      return { score: 0, dominant: [], conflicts: [], identity: "", combination: null, teamSum: null };
    }
    const cis = vectors.map((v) => v.colors).filter(Boolean);
    if (!cis.length) {
      return { score: 0, dominant: [], conflicts: [], identity: "", combination: null, teamSum: null };
    }

    const teamSum = sumVectors(cis.map((c) => colorVectorFrom(c)));
    const dominant = dominantFromSum(teamSum);
    const active = activeColorsFromSum(teamSum);
    const combination = detectCombination(active.length ? active : dominant);
    let score = combinationScore(combination);

    if (combination.type === "mono" && vectors.length >= 2) score += vectors.length * 8;
    if (combination.type === "guild" && vectors.length >= 3) score += 22;
    if (combination.type === "shard" && vectors.length >= 4) score += 35;
    if (combination.type === "wedge" && vectors.length >= 4) score += 28;

    const conflicts = [];
    if (combination.type === "five" && vectors.length >= 4) {
      conflicts.push("Identité 5 couleurs — manque de plan");
    }
    if (active.length >= 4 && !["shard", "wedge", "four"].includes(combination.type)) {
      score -= 22;
      conflicts.push("Couleurs dispersées sans shard/wedge");
    }

    for (let i = 0; i < cis.length; i += 1) {
      for (let j = i + 1; j < cis.length; j += 1) {
        const d1 = cis[i].dominant || dominantFromSum(colorVectorFrom(cis[i]));
        const d2 = cis[j].dominant || dominantFromSum(colorVectorFrom(cis[j]));
        score += pairRelationScore(d1, d2);
        for (const x of d1) {
          for (const y of d2) {
            if (isEnemy(x, y)) {
              conflicts.push(`${LABELS[x]} vs ${LABELS[y]} (${vectors[i].name}/${vectors[j].name})`);
              score -= 14;
            }
          }
        }
        if (cis[i].identity && cis[j].identity) {
          const ci = detectCombination([...new Set(`${cis[i].identity}${cis[j].identity}`.split(""))].filter((c) => WHEEL.includes(c)));
          if (ci.type === "guild") score += 8;
          if (ci.type === "enemy_dual" && d1.some((x) => d2.some((y) => isEnemy(x, y)))) score -= 6;
        }
      }
    }

    return {
      score: Math.round(score),
      dominant,
      conflicts: [...new Set(conflicts)].slice(0, 4),
      identity: combination.name || dominant.join("") || active.join("") || "",
      combination,
      teamSum,
      active,
    };
  }

  function colorPickBonus(champColors, teamColors, teamSum) {
    if (!champColors || !teamColors?.length) return { score: 0, label: null };
    let s = 0;
    const dom = champColors.dominant || [];
    const sum = teamSum || sumVectors(teamColors.map((c) => colorVectorFrom(c)));
    const active = activeColorsFromSum(sum);
    const teamCombo = detectCombination(active.length ? active : dominantFromSum(sum));

    for (const tc of teamColors) {
      s += pairRelationScore(dom, tc.dominant || []);
      const dot = colorVectorFrom(champColors).reduce(
        (acc, v, i) => acc + v * (colorVectorFrom(tc)[i] || 0),
        0
      );
      s += Math.round(dot * 52);
    }

    s += identityAlignBonus(champColors.identity, teamCombo);

    const champActive = detectCombination(
      dom.length ? dom : [...new Set((champColors.identity || "").split(""))].filter((c) => WHEEL.includes(c))
    );
    let label = null;
    if (champActive.type === "guild") label = `Guild ${champActive.name}`;
    else if (teamCombo.type === "shard" && identityAlignBonus(champColors.identity, teamCombo) >= 28) {
      label = `Shard ${teamCombo.name}`;
    } else if (teamCombo.type === "wedge" && identityAlignBonus(champColors.identity, teamCombo) >= 24) {
      label = `Wedge ${teamCombo.name}`;
    } else if (teamCombo.type === "guild") label = `Vers ${teamCombo.name}`;

    return { score: Math.round(s), label, teamCombo, champCombo: champActive };
  }

  function harmonyTags(dominantCodes, combination) {
    const tags = [];
    const combo = combination || detectCombination(dominantCodes || []);
    if (combo.type === "guild") tags.push({ kind: "ally", text: combo.name });
    else if (combo.type === "enemy_dual") tags.push({ kind: "enemy", text: combo.name });
    else if (combo.type === "shard") tags.push({ kind: "shard", text: `Shard ${combo.name}` });
    else if (combo.type === "wedge") tags.push({ kind: "wedge", text: `Wedge ${combo.name}` });
    else if (combo.type === "mono") tags.push({ kind: "mono", text: `Mono ${combo.name}` });

    for (const [a, b] of ALLIED_PAIRS) {
      if (dominantCodes?.includes(a) && dominantCodes?.includes(b)) {
        const g = GUILDS[pairKey(a, b)];
        if (g && !tags.some((t) => t.text === g.name)) tags.push({ kind: "ally", text: g.name });
      }
    }
    for (const [a, b] of ENEMY_PAIRS) {
      if (dominantCodes?.includes(a) && dominantCodes?.includes(b)) {
        const e = ENEMY_DUAL[pairKey(a, b)];
        if (e && !tags.some((t) => t.text === e.name)) tags.push({ kind: "enemy", text: e.name });
      }
    }
    return tags;
  }

  const pie = {
    WHEEL,
    LABELS,
    HEX,
    ALLIED_PAIRS,
    ENEMY_PAIRS,
    GUILDS,
    ENEMY_DUAL,
    SHARDS,
    WEDGES,
    pairKey,
    isAllied,
    isEnemy,
    isAdjacent,
    colorVectorFrom,
    sumVectors,
    dominantFromSum,
    activeColorsFromSum,
    detectCombination,
    combinationScore,
    pairRelationScore,
    identityAlignBonus,
    colorCoherence,
    colorPickBonus,
    harmonyTags,
  };

  global.MTGColorPie = pie;
})(typeof window !== "undefined" ? window : globalThis);
