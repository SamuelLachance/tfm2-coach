/**
 * TFM2 Draft Guide Core — shells, counters, replacement chains, Serpen/Morgard.
 * Data: public/data/draft-guide.json (inline fallback pour smoke tests).
 */
(function (global) {
  const INLINE_GUIDE = {
    compShells: {
      sniper_front_to_back: {
        id: "sniper_front_to_back",
        labelFr: "Tireur front-to-back",
        style: "front_to_back",
        champions: ["Chevalier de cavalerie", "Lancier", "Mage de glace", "Tireur", "Combattant"],
        firstPickAnchors: ["Chevalier de cavalerie", "Lancier", "Mage de glace"],
        cannotAnswer: ["Ninja", "Démon", "Exécuteur"],
        banPriority: ["Ninja", "Démon", "Exécuteur", "Moine", "Bombardier"],
        serpen: { plan: "fight_early", label: "Fight early Serpent", champions: ["Lancier", "Mage de glace", "Combattant"] },
        morgard: { plan: "force_5v5", label: "Force 5v5 front-to-back" },
      },
      archer_priest_kite: {
        id: "archer_priest_kite",
        labelFr: "Archer-Prêtre kite",
        style: "kite_poke",
        champions: ["Épéiste", "Lancier", "Pyromancien", "Archer", "Prêtre"],
        firstPickAnchors: ["Épéiste", "Pyromancien", "Archer", "Prêtre"],
        cannotAnswer: ["Ninja", "Démon", "Combattant"],
        banPriority: ["Ninja", "Démon", "Chevalier de cavalerie", "Exécuteur"],
        serpen: { plan: "delay_trade", label: "Delay / trade Serpent", champions: ["Épéiste", "Pyromancien", "Prêtre"] },
        morgard: { plan: "pick_first", label: "Pick first — pas 5v5 égal" },
      },
      ninja_executioner_dive: {
        id: "ninja_executioner_dive",
        labelFr: "Ninja-Exécuteur dive",
        style: "dive_pick",
        champions: ["Chevalier magique", "Ninja", "Bombardier", "Exécuteur", "Combattant"],
        firstPickAnchors: ["Ninja", "Bombardier", "Chevalier magique", "Moine"],
        cannotAnswer: ["Moine", "Porteur de bouclier", "Esprit gardien", "Prêtre"],
        banPriority: ["Moine", "Porteur de bouclier", "Prêtre", "Esprit gardien"],
        serpen: { plan: "punish_pick", label: "Punish / pick avant objectif", champions: ["Ninja", "Exécuteur", "Moine"] },
        morgard: { plan: "pick_first", label: "Pick first — surplus numérique" },
      },
    },
    replacementChains: {
      Archer: ["Tireur", "Joueur", "Pyromancien"],
      Tireur: ["Archer", "Soldat", "Joueur"],
      Épéiste: ["Combattant", "Chevalier de cavalerie", "Chevalier"],
      Combattant: ["Porteur de bouclier", "Moine", "Chevalier de cavalerie"],
      "Chevalier de cavalerie": ["Lancier", "Épéiste", "Combattant"],
      Lancier: ["Ninja", "Berserker", "Combattant"],
      "Mage de glace": ["Pyromancien", "Mage de barrière", "Joueur"],
      Prêtre: ["Moine", "Porteur de bouclier", "Esprit gardien"],
      "Médecin de la peste": ["Esprit gardien", "Pythonisse", "Prêtre"],
      "Esprit gardien": ["Prêtre", "Moine", "Porteur de bouclier"],
      "Porteur de bouclier": ["Moine", "Combattant", "Chevalier de cavalerie"],
      Ninja: ["Démon", "Exécuteur", "Clown"],
      Exécuteur: ["Démon", "Ninja", "Bombardier"],
      Démon: ["Ninja", "Exécuteur", "Chasseur"],
      Pyromancien: ["Mage de glace", "Joueur", "Bombardier"],
      Bombardier: ["Archer", "Joueur", "Pyromancien"],
      Joueur: ["Pyromancien", "Archer", "Bombardier"],
      Moine: ["Porteur de bouclier", "Prêtre", "Combattant"],
      Berserker: ["Lancier", "Combattant", "Chevalier de cavalerie"],
      Soldat: ["Tireur", "Archer", "Joueur"],
      "Chevalier magique": ["Moine", "Combattant", "Pyromancien"],
    },
    championCounters: {
      Archer: { goodInto: ["Épéiste", "Chevalier", "Infanterie lourde", "Ogre", "Combattant"], watchOut: ["Ninja", "Démon", "Exécuteur", "Clown"], ifBanned: ["Tireur", "Joueur", "Pyromancien"], shells: ["archer_priest_kite"] },
      Tireur: { goodInto: ["Chevalier de cavalerie", "Épéiste", "Porteur de bouclier", "Ogre"], watchOut: ["Ninja", "Démon", "Moine", "Clown"], ifBanned: ["Archer", "Soldat", "Joueur"], shells: ["sniper_front_to_back"] },
      Épéiste: { goodInto: ["Archer", "Tireur", "Pyromancien", "Bombardier", "Joueur"], watchOut: ["Mage de glace", "Pyromancien", "Lancier", "Ninja"], ifBanned: ["Combattant", "Chevalier de cavalerie", "Chevalier"], shells: ["archer_priest_kite"] },
      Combattant: { goodInto: ["Mage de glace", "Pyromancien", "Archer", "Bombardier"], watchOut: ["Pyromancien", "Tireur", "Joueur"], ifBanned: ["Porteur de bouclier", "Moine", "Chevalier de cavalerie"], shells: ["sniper_front_to_back", "ninja_executioner_dive"] },
      "Chevalier de cavalerie": { goodInto: ["Archer", "Tireur", "Joueur", "Bombardier", "Soldat"], watchOut: ["Ninja", "Moine", "Mage de glace"], ifBanned: ["Lancier", "Épéiste", "Combattant"], shells: ["sniper_front_to_back"] },
      Lancier: { goodInto: ["Épéiste", "Chevalier", "Archer", "Tireur"], watchOut: ["Exorciste", "Moine", "Porteur de bouclier"], ifBanned: ["Ninja", "Berserker", "Combattant"], shells: ["sniper_front_to_back", "archer_priest_kite"] },
      "Mage de glace": { goodInto: ["Épéiste", "Chevalier de cavalerie", "Combattant"], watchOut: ["Ninja", "Démon", "Lancier"], ifBanned: ["Pyromancien", "Mage de barrière", "Joueur"], shells: ["sniper_front_to_back"] },
      Prêtre: { goodInto: ["Ninja", "Démon", "Lancier", "Berserker"], watchOut: ["Démon", "Bombardier", "Joueur"], ifBanned: ["Moine", "Porteur de bouclier", "Esprit gardien"], shells: ["archer_priest_kite"] },
      "Médecin de la peste": { goodInto: ["Chevalier de cavalerie", "Épéiste", "Ogre"], watchOut: ["Ninja", "Démon", "Exécuteur", "Bombardier"], ifBanned: ["Esprit gardien", "Pythonisse", "Prêtre"], shells: ["archer_priest_kite"] },
      "Esprit gardien": { goodInto: ["Ninja", "Démon", "Lancier", "Berserker"], watchOut: ["Bombardier", "Joueur", "Pyromancien"], ifBanned: ["Prêtre", "Moine", "Porteur de bouclier"], shells: [] },
      "Porteur de bouclier": { goodInto: ["Ninja", "Démon", "Exécuteur", "Lancier"], watchOut: ["Mage de glace", "Pyromancien", "Bombardier", "Joueur"], ifBanned: ["Moine", "Combattant", "Chevalier de cavalerie"], shells: [] },
      Ninja: { goodInto: ["Archer", "Tireur", "Joueur", "Soldat", "Pyromancien"], watchOut: ["Moine", "Porteur de bouclier", "Prêtre", "Esprit gardien"], ifBanned: ["Démon", "Exécuteur", "Clown"], shells: ["ninja_executioner_dive"] },
      Exécuteur: { goodInto: ["Prêtre", "Esprit gardien", "Archer", "Tireur"], watchOut: ["Moine", "Porteur de bouclier", "Chevalier de cavalerie"], ifBanned: ["Démon", "Ninja", "Bombardier"], shells: ["ninja_executioner_dive"] },
      Démon: { goodInto: ["Archer", "Tireur", "Pyromancien", "Bombardier", "Joueur"], watchOut: ["Moine", "Prêtre", "Porteur de bouclier"], ifBanned: ["Ninja", "Exécuteur", "Chasseur"], shells: ["ninja_executioner_dive"] },
      Pyromancien: { goodInto: ["Épéiste", "Chevalier", "Combattant", "Porteur de bouclier"], watchOut: ["Ninja", "Démon", "Lancier"], ifBanned: ["Mage de glace", "Joueur", "Bombardier"], shells: ["archer_priest_kite"] },
      Bombardier: { goodInto: ["Épéiste", "Chevalier de cavalerie", "Ogre", "Porteur de bouclier"], watchOut: ["Ninja", "Démon", "Lancier"], ifBanned: ["Archer", "Joueur", "Pyromancien"], shells: ["ninja_executioner_dive"] },
      Joueur: { goodInto: ["Épéiste", "Chevalier", "Ogre", "Porteur de bouclier"], watchOut: ["Ninja", "Démon", "Lancier", "Clown"], ifBanned: ["Pyromancien", "Archer", "Bombardier"], shells: ["archer_priest_kite"] },
      Moine: { goodInto: ["Ninja", "Démon", "Exécuteur", "Lancier", "Berserker"], watchOut: ["Bombardier", "Joueur", "Pyromancien", "Mage de glace"], ifBanned: ["Porteur de bouclier", "Prêtre", "Combattant"], shells: ["ninja_executioner_dive"] },
      Berserker: { goodInto: ["Archer", "Tireur", "Pyromancien", "Bombardier"], watchOut: ["Moine", "Porteur de bouclier", "Prêtre", "Mage de glace"], ifBanned: ["Lancier", "Combattant", "Chevalier de cavalerie"], shells: [] },
      Soldat: { goodInto: ["Épéiste", "Chevalier", "Combattant", "Ogre"], watchOut: ["Ninja", "Démon", "Clown", "Lancier"], ifBanned: ["Tireur", "Archer", "Joueur"], shells: ["sniper_front_to_back"] },
      "Chevalier magique": { goodInto: ["Archer", "Tireur", "Pyromancien", "Bombardier"], watchOut: ["Moine", "Porteur de bouclier", "Prêtre"], ifBanned: ["Moine", "Combattant", "Pyromancien"], shells: ["ninja_executioner_dive"] },
    },
    banPhilosophy: {
      threats: {
        fragile_carry: { ban: ["Ninja", "Démon", "Exécuteur"], whenEnemyHas: ["Archer", "Tireur", "Joueur", "Soldat"] },
        lane_priority: { ban: ["Épéiste", "Pyromancien", "Chevalier de cavalerie"], whenEnemyHas: ["Lancier", "Mage de glace", "Archer", "Prêtre"] },
        dive_vs_backline: { ban: ["Ninja", "Démon", "Exécuteur", "Bombardier"], whenOurShell: ["sniper_front_to_back", "archer_priest_kite"] },
        peel_vs_dive: { ban: ["Moine", "Porteur de bouclier", "Prêtre", "Esprit gardien"], whenOurShell: ["ninja_executioner_dive"] },
      },
    },
    shellCounters: {
      front_to_back: "ninja_executioner_dive",
      kite_poke: "ninja_executioner_dive",
      dive_pick: "sniper_front_to_back",
    },
    playerTraits: {
      aggression: { high: ["Ninja", "Lancier", "Berserker", "Démon", "Exécuteur", "Clown"], low: ["Archer", "Tireur", "Prêtre", "Esprit gardien", "Pyromancien"] },
      roaming: { high: ["Ninja", "Lancier", "Clown", "Démon", "Berserker"], low: ["Tireur", "Archer", "Ogre", "Nécromancien"] },
      traitSynergies: {
        "Collaboration Attack": { bonus: ["Combattant", "Lancier", "Chevalier de cavalerie", "Berserker", "Exécuteur"] },
        "Despise Weakness": { bonus: ["Exécuteur", "Ninja", "Démon", "Berserker", "Inquisiteur"] },
      },
    },
  };

  let guide = INLINE_GUIDE;

  function setGuideData(data) {
    if (data && typeof data === "object") guide = { ...INLINE_GUIDE, ...data };
  }

  function shells() {
    return Object.values(guide.compShells || {});
  }

  function getChampionGuide(name) {
    return guide.championCounters?.[name] || null;
  }

  function getReplacementChain(coreName) {
    return guide.replacementChains?.[coreName] || getChampionGuide(coreName)?.ifBanned || [];
  }

  /** Détecte le shell le plus proche d'une liste de champions. */
  function detectShell(names) {
    if (!names?.length) return null;
    let best = null;
    let bestScore = 0;
    for (const shell of shells()) {
      const set = new Set(shell.champions);
      const alt = shell.altSlots ? Object.values(shell.altSlots).flat() : [];
      const pool = new Set([...set, ...alt]);
      const overlap = names.filter((n) => pool.has(n)).length;
      const score = overlap / shell.champions.length;
      if (score > bestScore) {
        bestScore = score;
        best = shell;
      }
    }
    if (!best || bestScore < 0.2) return null;
    return { shell: best, confidence: Math.round(bestScore * 100) / 100, overlap: names.filter((n) => best.champions.includes(n)) };
  }

  /** Shell recommandé vs adversaire (contre-pick shell, pas seulement champion). */
  function recommendShell(enemyNames, ourNames, ctx = {}) {
    const enemyDet = detectShell(enemyNames);
    const ourDet = detectShell(ourNames);

    if (ourDet && ourDet.confidence >= 0.4) {
      return { shell: ourDet.shell, reason: `Shell en cours — ${ourDet.shell.labelFr}`, source: "ours" };
    }

    if (enemyDet?.shell?.style && guide.shellCounters?.[enemyDet.shell.style]) {
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

    const shellIds = Object.keys(guide.compShells || {});
    const rot = (ctx.sessionIndex ?? 0) + (ctx.banCount ?? 0);
    const pickId = shellIds[rot % shellIds.length];
    const shell = guide.compShells[pickId];
    return {
      shell,
      reason: `Rotation shell — éviter B1 prévisible (${shell.labelFr})`,
      source: "rotate",
    };
  }

  function bannedCores(ourNames, takenNames) {
    const cores = [];
    for (const [core, chain] of Object.entries(guide.replacementChains || {})) {
      if (takenNames.has(core) && !ourNames.includes(core)) cores.push({ core, chain });
    }
    return cores;
  }

  function replacementRank(champName, core, chain, pivotIndex) {
    const idx = chain.indexOf(champName);
    if (idx < 0) return 0;
    if (idx === pivotIndex) return 95 - idx * 8;
    if (idx === pivotIndex + 1) return 72 - idx * 6;
    return 40 - idx * 4;
  }

  /** Score pick — shell, counters, replacements, rotation B1. */
  function scoreGuidePick(champName, ctx = {}) {
    const { allies = [], oppNames = [], phase = "core", takenNames, playerTraits } = ctx;
    let score = 0;
    const reasons = [];
    const rec = recommendShell(oppNames, allies, ctx);
    const shell = rec.shell;
    const cg = getChampionGuide(champName);

    if (shell?.champions?.includes(champName)) {
      const missing = shell.champions.filter((c) => !allies.includes(c) && c !== champName);
      score += 48 + missing.length * 6;
      reasons.push(`Shell ${shell.labelFr}`);
    }

    if (shell?.firstPickAnchors?.includes(champName) && !allies.length) {
      const anchorIdx = shell.firstPickAnchors.indexOf(champName);
      const rotBonus = anchorIdx === ((ctx.sessionIndex ?? 0) % shell.firstPickAnchors.length) ? 38 : 22;
      score += rotBonus;
      reasons.push(anchorIdx === 0 ? "Ancre shell (rotation)" : "Flex shell anchor");
    }

    if (cg) {
      for (const e of oppNames) {
        if (cg.goodInto?.includes(e)) {
          score += 28;
          if (reasons.length < 4) reasons.push(`Fort vs ${e}`);
        }
        if (cg.watchOut?.includes(e)) {
          score -= 34;
          if (reasons.length < 5) reasons.push(`⚠ ${e} counter`);
        }
      }
    }

    const taken = takenNames || new Set();
    for (const { core, chain } of bannedCores(allies, taken)) {
      const pivot = chain[0] === core ? 1 : 0;
      const rep = replacementRank(champName, core, chain, pivot);
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
          score += 24;
          reasons.push(`Trait ${trait}`);
        }
      }
      const agg = playerTraits.includes("high_aggression")
        ? guide.playerTraits?.aggression?.high
        : playerTraits.includes("low_aggression")
          ? guide.playerTraits?.aggression?.low
          : null;
      if (agg?.includes(champName)) score += 14;
    }

    if (phase === "opening" && !allies.length && cg?.shells?.length) {
      const matchesRec = cg.shells.includes(shell?.id);
      if (matchesRec) score += 18;
    }

    return { score, reasons: [...new Set(reasons)].slice(0, 5) };
  }

  /** Score ban — menaces que notre shell ne peut pas répondre (pas tier seul). */
  function scoreThreatBan(champName, ourNames, enemyNames, ctx = {}) {
    let score = 0;
    const reasons = [];
    const rec = recommendShell(enemyNames, ourNames, ctx);
    const ourShell = detectShell(ourNames)?.shell || rec.shell;
    const enemyShell = detectShell(enemyNames)?.shell;
    const cg = getChampionGuide(champName);

    if (ourShell?.cannotAnswer?.includes(champName)) {
      score += 88;
      reasons.push(`Menace vs ${ourShell.labelFr}`);
    }
    if (ourShell?.banPriority?.includes(champName)) {
      const rank = ourShell.banPriority.indexOf(champName);
      score += 72 - rank * 10;
      if (!reasons.length) reasons.push(`Ban prio shell — ${ourShell.labelFr}`);
    }

    for (const rule of Object.values(guide.banPhilosophy?.threats || {})) {
      if (rule.whenOurShell && ourShell && !rule.whenOurShell.includes(ourShell.id)) continue;
      if (rule.whenEnemyHas && !enemyNames.some((n) => rule.whenEnemyHas.includes(n))) continue;
      if (rule.ban?.includes(champName)) {
        score += 58;
        reasons.push(`Threat ban — ${rule.label || "profil adverse"}`);
      }
    }

    if (enemyShell) {
      const completes = enemyShell.champions.filter((c) => !enemyNames.includes(c));
      if (completes.includes(champName)) {
        score += 44;
        reasons.push(`Complète ${enemyShell.labelFr}`);
      }
      for (const e of enemyNames) {
        const eg = getChampionGuide(e);
        if (eg?.watchOut?.includes(champName)) {
          score += 36;
          reasons.push(`Répond à ${e}`);
          break;
        }
      }
    }

    for (const o of ourNames) {
      const og = getChampionGuide(o);
      if (og?.watchOut?.includes(champName)) {
        score += 52;
        reasons.push(`Counter notre ${o}`);
        break;
      }
      if (cg?.goodInto?.includes(o)) {
        score += 40;
        reasons.push(`Fort vs notre ${o}`);
        break;
      }
    }

    const carryTags = ["Archer", "Tireur", "Soldat", "Joueur"];
    if (enemyNames.some((n) => carryTags.includes(n)) && ["Ninja", "Démon", "Exécuteur"].includes(champName)) {
      score += 35;
      if (!reasons.some((r) => r.includes("fragile"))) reasons.push("Anti-carry fragile");
    }

    if (enemyNames.some((n) => ["Lancier", "Mage de glace", "Archer"].includes(n)) &&
        ["Épéiste", "Pyromancien", "Chevalier de cavalerie"].includes(champName)) {
      score += 28;
      reasons.push("Anti prio lane adverse");
    }

    return { score, reasons: [...new Set(reasons)].slice(0, 5), ourShell, enemyShell };
  }

  function serpenHint(shell, allies = []) {
    if (!shell?.serpen) return null;
    const sp = shell.serpen;
    const have = allies.filter((n) => sp.champions?.includes(n));
    const parts = [sp.label || sp.plan];
    if (have.length) parts.push(have.slice(0, 2).join(", "));
    parts.push("Check: JG vivant · bon côté · lanes mobiles · dmg/CC early");
    return parts.join(" · ");
  }

  function morgardHint(shell) {
    if (!shell?.morgard) return null;
    const mg = shell.morgard;
    const needs = mg.draftNeeds?.length ? ` · besoin ${mg.draftNeeds.slice(0, 2).join(", ")}` : "";
    return `${mg.label || mg.plan}${needs}`;
  }

  function coachDraftHint(ctx = {}) {
    const { ourNames = [], enemyNames = [], phase, stepType, playerTraits } = ctx;
    const parts = [];
    const rec = recommendShell(enemyNames, ourNames, ctx);
    const enemyDet = detectShell(enemyNames);

    if (stepType === "ban") {
      parts.push("Ban menaces — pas le « meilleur » meta");
      if (rec.shell) parts.push(`Plan: ${rec.shell.labelFr}`);
      if (enemyDet) parts.push(`Adv. → ${enemyDet.shell.labelFr} (${Math.round(enemyDet.confidence * 100)}%)`);
      if (rec.shell?.banPriority?.length) {
        const prio = rec.shell.banPriority.filter((n) => !enemyNames.includes(n)).slice(0, 2);
        if (prio.length) parts.push(`Cibles: ${prio.join(", ")}`);
      }
      return parts.join(" · ");
    }

    parts.push(rec.reason);
    if (enemyDet && enemyDet.confidence >= 0.35) {
      parts.push(`Adv. shell: ${enemyDet.shell.labelFr}`);
    }

    const serpen = serpenHint(rec.shell, ourNames);
    if (serpen) parts.push(`Serpent: ${serpen}`);

    const morgard = morgardHint(rec.shell);
    if (morgard) parts.push(`Morgard: ${morgard}`);

    const banned = bannedCores(ourNames, ctx.takenNames || new Set());
    if (banned[0]) {
      const chain = banned[0].chain.filter((n) => n !== banned[0].core).slice(0, 2);
      if (chain.length) parts.push(`${banned[0].core} banni → ${chain.join(" / ")}`);
    }

    if (playerTraits?.length) {
      const t = playerTraits.slice(0, 2).join(", ");
      parts.push(`Traits: ${t}`);
    }

    return parts.slice(0, 5).join(" · ");
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
      notes.push(`Pivot: ${banned[0].core} → ${banned[0].chain.slice(1, 3).join(" / ")}`);
    }

    return { ourShell: ourDet, enemyShell: enDet, recommended: rec, notes };
  }

  global.TFM2DraftGuide = {
    setGuideData,
    getChampionGuide,
    getReplacementChain,
    detectShell,
    recommendShell,
    scoreGuidePick,
    scoreThreatBan,
    serpenHint,
    morgardHint,
    coachDraftHint,
    analyzeShellMatchup,
    bannedCores,
    shells,
    GUIDE: () => guide,
  };
})(typeof window !== "undefined" ? window : globalThis);
