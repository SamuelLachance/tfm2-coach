/**
 * TFM2 Ability Core — profils kit depuis champions-abilities.md (via champions.json).
 * CC, peel, burst, scaling, anti-heal… pour le draft.
 */
(function (global) {
  const MC = () => global.TFM2MatchCore;
  const profileCache = new Map();

  function abilityText(champ) {
    return (champ?.abilities || []).map((a) => a.description || "").join(" ");
  }

  function parseStats(stats) {
    if (!stats) return {};
    const out = {};
    const patterns = [
      ["hp", /HP\s*(\d+)\s*→\s*(\d+)/i],
      ["ad", /AD\s*(\d+)\s*→\s*(\d+)/i],
      ["pm", /PM\s*(\d+)\s*→\s*(\d+)/i],
      ["arm", /Arm\s*(\d+)\s*→\s*(\d+)/i],
      ["rm", /RM\s*(\d+)\s*→\s*(\d+)/i],
      ["range", /Portée\s*(\d+)/i],
      ["ms", /MS\s*(\d+)\s*→\s*(\d+)/i],
    ];
    for (const [key, re] of patterns) {
      const m = stats.match(re);
      if (!m) continue;
      out[key] = parseInt(m[2] ?? m[1], 10);
    }
    return out;
  }

  function parseRatios(text) {
    let ad = 0;
    let ap = 0;
    const adRe = /(\d+)\s*%\s*(?:AD|des dégâts d'attaque)/gi;
    const apRe = /(\d+)\s*%\s*(?:PM|Puissance|puissance)/gi;
    let m;
    while ((m = adRe.exec(text))) ad += parseInt(m[1], 10);
    while ((m = apRe.exec(text))) ap += parseInt(m[1], 10);
    return { ad, ap };
  }

  function hasRe(text, re) {
    return re.test(text);
  }

  function buildProfile(champ) {
    if (!champ?.name) return null;
    const cached = profileCache.get(champ.name);
    if (cached) return cached;

    const text = abilityText(champ).toLowerCase();
    const stats = parseStats(champ.stats || "");
    const ratios = parseRatios(abilityText(champ));
    const dp = champ.draftProfile || {};
    const tags = new Set(champ.tags || []);

    const hp = stats.hp ?? 2000;
    const arm = stats.arm ?? 80;
    const rng = stats.range ?? 30;

    const prof = {
      name: champ.name,
      tier: champ.tierMeta || "C",
      adRatio: ratios.ad || dp.adRatio || 0,
      apRatio: ratios.ap || dp.apRatio || 0,
      hp,
      arm,
      range: rng,
      squishy: hp < 1900 && arm < 100,
      tanky: hp >= 2200 || arm >= 120 || tags.has("frontline"),
      dash: hasRe(text, /dash|téléport|charge|saut|se déplace/i),
      stun: hasRe(text, /étourdi|étourdit|stun/i),
      root: hasRe(text, /enracin|root|immobilis/i),
      knockup: hasRe(text, /projet|en l'air|knock/i),
      silence: text.includes("silence"),
      slow: hasRe(text, /ralent/i),
      heal: hasRe(text, /soin|heal|régén|restaure/i),
      shield: hasRe(text, /bouclier|shield/i),
      antiHeal: champ.name === "Exécuteur" || /réduction soins|anti-heal/i.test(text),
      aoe: hasRe(text, /tous les ennemis|zone|cercle|rayon/i),
      singleTarget: hasRe(text, /allié ciblé|ennemi ciblé|une cible/i),
      ccScore: 0,
      peelScore: 0,
      burstScore: 0,
      scaleScore: 0,
      engageScore: 0,
      waveClearScore: 0,
    };

    if (prof.stun) prof.ccScore += 28;
    if (prof.root) prof.ccScore += 22;
    if (prof.knockup) prof.ccScore += 24;
    if (prof.silence) prof.ccScore += 18;
    if (prof.slow) prof.ccScore += 8;

    if (prof.heal) prof.peelScore += 22;
    if (prof.shield) prof.peelScore += 26;
    if (tags.has("peel")) prof.peelScore += 16;
    if (MC()?.isDedicatedSupport?.(champ.name, { [champ.name]: champ })) prof.peelScore += 14;

    prof.burstScore =
      (ratios.ad >= 120 ? 18 : ratios.ad >= 80 ? 12 : 0) +
      (ratios.ap >= 100 ? 16 : ratios.ap >= 60 ? 10 : 0) +
      (tags.has("assassin") || tags.has("dive") ? 14 : 0) +
      (tags.has("mage_burst") ? 12 : 0);

    prof.scaleScore =
      (tags.has("scaling") || tags.has("marksman") ? 22 : 0) +
      ((dp.dpsWeight ?? 0) >= 0.55 ? 16 : 0) +
      (MC()?.HYPER_CARRIES?.has(champ.name) ? 24 : 0);

    prof.engageScore =
      (tags.has("engage") ? 16 : 0) +
      (prof.dash && prof.stun ? 20 : prof.dash ? 10 : 0) +
      (tags.has("frontline") && prof.ccScore > 20 ? 14 : 0);

    prof.waveClearScore =
      (tags.has("wave_clear") ? 20 : 0) +
      (prof.aoe && ratios.ap >= 40 ? 16 : 0) +
      (prof.aoe && ratios.ad >= 80 ? 12 : 0);

    profileCache.set(champ.name, prof);
    return prof;
  }

  function getProfile(name, byName) {
    const c = byName?.get?.(name);
    if (!c) return null;
    return buildProfile(c);
  }

  function teamKit(names, byName) {
    const profiles = names.map((n) => getProfile(n, byName)).filter(Boolean);
    const agg = {
      cc: 0,
      peel: 0,
      burst: 0,
      scale: 0,
      engage: 0,
      waveClear: 0,
      heal: 0,
      antiHeal: 0,
      lockdown: 0,
      count: profiles.length,
    };
    for (const p of profiles) {
      agg.cc += p.ccScore;
      agg.peel += p.peelScore;
      agg.burst += p.burstScore;
      agg.scale += p.scaleScore;
      agg.engage += p.engageScore;
      agg.waveClear += p.waveClearScore;
      if (p.heal || p.shield) agg.heal += 1;
      if (p.antiHeal) agg.antiHeal += 1;
      if (p.stun || p.root || p.knockup) agg.lockdown += 1;
    }
    return agg;
  }

  /** Synergie kit abilities avec l'équipe alliée + menaces adverses. */
  function pickKitBonus(champName, allies, oppNames, byName, metaMap) {
    const prof = getProfile(champName, byName);
    if (!prof) return { score: 0, reasons: [] };

    const before = teamKit(allies, byName);
    const after = teamKit(allies.concat(champName), byName);
    let score = 0;
    const reasons = [];

    const hasCarry = allies.some((a) => {
      const p = getProfile(a, byName);
      return p && (p.scaleScore >= 28 || (metaMap?.[a]?.draftProfile?.dpsWeight ?? 0) >= 0.55);
    });
    const needsPeel = hasCarry && before.peel < 35;
    if (needsPeel && prof.peelScore >= 20) {
      score += 38 + prof.peelScore * 0.6;
      reasons.push("Peel kit — protège le carry");
    }

    if (before.lockdown < 2 && prof.ccScore >= 22) {
      score += 28 + prof.ccScore * 0.35;
      reasons.push("Lockdown CC (abilities)");
    }

    if (before.burst < 40 && prof.burstScore >= 24 && before.lockdown >= 1) {
      score += 32;
      reasons.push("Burst après CC allié");
    }

    if (before.waveClear < 30 && prof.waveClearScore >= 18) {
      score += 26;
      reasons.push("Wave clear kit");
    }

    if (before.scale >= 40 && prof.engageScore >= 20 && !hasCarry) {
      score += 18;
      reasons.push("Engage pour setup");
    }

    const enemyHeal = teamKit(oppNames, byName).heal;
    if (enemyHeal >= 2 && prof.antiHeal) {
      score += 44;
      reasons.push("Anti-heal vs leur sustain");
    }

    if (prof.scaleScore >= 30 && before.peel >= 35 && before.scale < 35) {
      score += 34;
      reasons.push("Hypercarry protégé par peel");
    }

    const deltaEngage = after.engage - before.engage;
    if (deltaEngage > 15 && after.lockdown >= 2) {
      score += deltaEngage * 0.5;
      if (!reasons.some((r) => r.includes("Engage"))) reasons.push("All-in engage + CC");
    }

    return { score, reasons: reasons.slice(0, 4) };
  }

  /** Deny kits adverses clés (peel, scale, tempo CC). */
  function banKitDeny(champName, ourNames, enemyNames, byName, metaMap) {
    const prof = getProfile(champName, byName);
    if (!prof) return { score: 0, reasons: [] };

    let score = 0;
    const reasons = [];
    const enBefore = teamKit(enemyNames, byName);
    const enAfter = teamKit(enemyNames.concat(champName), byName);
    const ourKit = teamKit(ourNames, byName);

    if (prof.scaleScore >= 30) {
      score += prof.scaleScore * 1.1;
      reasons.push("Deny hypercarry kit");
    }
    if (prof.peelScore >= 24 && ourKit.scale >= 30) {
      score += 36 + prof.peelScore * 0.5;
      reasons.push("Deny peel vs notre carry");
    }
    if (prof.ccScore >= 28 && ourKit.scale >= 30) {
      score += 28;
      reasons.push("Deny lockdown vs notre carry");
    }
    if (enAfter.peel - enBefore.peel > 18 && ourKit.scale >= 35) {
      score += 22;
      reasons.push("Bloque infrastructure peel");
    }
    if (prof.antiHeal && teamKit(ourNames, byName).heal >= 1) {
      score += 26;
      reasons.push("Deny anti-heal");
    }
    if (prof.waveClearScore >= 24 && ourKit.waveClear < 25) {
      score += 20;
      reasons.push("Deny wave clear stall");
    }

    const tier = metaMap?.[champName]?.tierMeta || prof.tier;
    if (tier === "S" || tier === "A") {
      score += tier === "S" ? 18 : 12;
    }

    return { score, reasons: reasons.slice(0, 4) };
  }

  function coachKitHint(allies, oppNames, byName) {
    const kit = teamKit(allies, byName);
    const parts = [];
    if (kit.scale >= 40 && kit.peel < 30) parts.push("Manque peel kit pour le carry");
    else if (kit.lockdown < 2) parts.push("Priorité CC (stun/root) abilities");
    else if (kit.waveClear < 25) parts.push("Wave clear kit Mid/Jungle");
    else if (kit.burst < 35 && kit.lockdown >= 2) parts.push("Burst après lockdown");
    const en = teamKit(oppNames, byName);
    if (en.heal >= 2 && kit.antiHeal < 1) parts.push("Anti-heal vs leur sustain");
    return parts.slice(0, 2).join(" · ");
  }

  global.TFM2AbilityCore = {
    buildProfile,
    getProfile,
    teamKit,
    pickKitBonus,
    banKitDeny,
    coachKitHint,
    clearCache: () => profileCache.clear(),
  };
})(typeof window !== "undefined" ? window : globalThis);
