/**
 * TFM2 Draft Model v1 — modèle de scoring UNIQUE, explicable, fidèle à TFM2.
 *
 * Principe : on note un champion candidat pour le POSTE précis d'un joueur.
 * Une seule couche additive ; chaque terme correspond à UNE raison affichable.
 *
 *   PickScore(C, poste) =
 *       w.buff    · BuffFit(C, poste)          // le kit exploite le buff du poste (cœur TFM2)
 *     + w.tier    · Tier(C)                     // départage, jamais moteur principal
 *     + w.synergy · Σ Pairings(C, alliés)       // ordinal (rang 1..5), sans double compte
 *     + w.counter · MatchupEdge(C, ennemis)     // + si C counter, − si C est counter
 *     + w.protect · ProtègeCarry(C, comp)       // peel/front pour notre carry fragile
 *     + w.shell   · AvancéePlan(C, comp)        // fait progresser une win-condition (shell du guide)
 *     − w.trap    · Piège(C, comp, ennemis)     // risques nommés (contré, mono-dégâts, ...)
 *
 * Règles : matchups/pairings ORDINAUX (jamais de magnitude inventée) ; « absent ≠ égal » ;
 * aucune contrainte de poste dure (tous les postes jouables) ; poids peu nombreux et documentés.
 * Marche en navigateur (window.TFM2DraftModel) et sous Node (module.exports).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof root !== "undefined") root.TFM2DraftModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // Résolveur de données : injecté par le moteur (TFM2DraftData ou compatible).
  let D = null;
  function useData(dataApi) {
    D = dataApi;
  }
  function data() {
    if (D) return D;
    if (typeof TFM2DraftData !== "undefined") return TFM2DraftData;
    if (typeof globalThis !== "undefined" && globalThis.TFM2DraftData) return globalThis.TFM2DraftData;
    throw new Error("TFM2DraftModel: couche de données non initialisée (useData).");
  }

  const SLOTS = ["Top", "Jungle", "Mid", "Bot", "Support"];
  const TIER_VALUE = { S: 4, A: 3, B: 2, C: 1, D: 0 };

  /**
   * Poids des termes. Peu nombreux, à échelle comparable (contribution en « points »).
   * Non calibrés sur des résultats réels (données indisponibles) : gardés sobres et documentés.
   * BuffFit et MatchupEdge dominent ; Tier ne fait que départager.
   */
  const W = {
    buff: 30, // BuffFit ∈ [0..1.15]  → ~0..35 pts (dominant)
    tier: 11, // Tier ∈ [0..1]        → 0..11 pts (départage)
    synergy: 15, // Synergie (capée)  → 0..~35 pts
    counter: 17, // Edge matchup      → ±~40 pts
    protect: 13, // Protection carry  → 0..13 pts
    shell: 12, // Avancée plan        → 0..~18 pts
    trap: 18, // Pénalité pièges      → 0..~35 pts (soustraite)
  };

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const round1 = (x) => Math.round(x * 10) / 10;

  /** Décroissance ordinale d'un rang 0..4 (top-5) → 1.0, 0.8, 0.6, 0.4, 0.2. */
  function ordinal(rank) {
    if (rank == null || rank < 0) return 0;
    return Math.max(0.2, 1 - rank * 0.2);
  }

  function tierNorm(name) {
    return (TIER_VALUE[data().tier(name)] ?? 1) / 4;
  }

  // --- Classifications dérivées des données (pas de listes codées en dur) -----
  function isSupportJob(name) {
    return data().draftJob(name) === "support";
  }
  function providesProtection(name) {
    const job = data().draftJob(name);
    if (job === "support" || job === "frontline") return true;
    const tags = data().roleTags(name);
    return tags.includes("peel") || tags.includes("frontline");
  }
  function isFragileCarry(name) {
    const p = data().profile(name);
    const job = data().draftJob(name);
    return job === "carry" && (p.squishy === true || (p.dpsWeight ?? 0) >= 0.5);
  }

  // --- BuffFit ---------------------------------------------------------------
  const BUFF_LABEL = {
    Top: "regen % PV",
    Jungle: "mobilité + exécution objectifs",
    Mid: "+20% XP (scaling niveaux)",
    Bot: "+20% or (carry item)",
    Support: "funnel or allié",
  };

  /** Bonus fin lié au buff du poste (raffinement ±, pas le moteur principal). */
  function buffProfileBonus(name, slot) {
    const p = data().profile(name);
    const tags = data().roleTags(name);
    switch (slot) {
      case "Top": // regen % PV : récompense gros PV / tank / bruiser
        return (p.tanky ? 0.1 : 0) + ((p.tankWeight ?? 0) >= 0.4 ? 0.05 : 0) + (tags.includes("frontline") ? 0.05 : 0);
      case "Jungle": // mobilité + sécurisation d'objectifs
        return (tags.includes("pick_jungle") || tags.includes("aggressive_jungle") || tags.includes("farm_jungle") ? 0.12 : 0) +
          (tags.includes("dive") || tags.includes("assassin") ? 0.04 : 0);
      case "Mid": // +XP : casters qui scalent en niveaux
        return ((p.apShare ?? 0) >= 0.5 ? 0.1 : 0) + (tags.includes("mage_burst") ? 0.05 : 0) + (tags.includes("scaling") ? 0.04 : 0);
      case "Bot": // +or : carry AD item-dépendant
        return ((p.dpsWeight ?? 0) >= 0.5 && (p.adShare ?? 0) >= 0.5 ? 0.14 : 0) + (tags.includes("scaling") ? 0.04 : 0);
      case "Support": // funnel : utilitaire à faible besoin d'économie
        return (isSupportJob(name) ? 0.12 : 0) + (tags.includes("peel") ? 0.05 : 0);
      default:
        return 0;
    }
  }

  function buffFit(name, slot) {
    const opt = data().optimalSlots(name);
    const via = data().viableSlots(name);
    let base, why;
    if (opt.includes(slot)) {
      base = 1.0;
      why = `Poste optimal (${BUFF_LABEL[slot]})`;
    } else if (via.includes(slot)) {
      base = 0.55;
      why = `Poste viable`;
    } else {
      base = 0.2;
      why = `Hors poste (flex)`;
    }
    const bonus = buffProfileBonus(name, slot);
    const score = clamp(base + bonus, 0, 1.15);
    return { score, reason: bonus >= 0.1 && base >= 0.55 ? `${why} · exploite ${BUFF_LABEL[slot]}` : why };
  }

  // --- Synergies (pairings ordinaux, sans double compte) ----------------------
  function pairScore(a, b) {
    const inA = data().pairings(a).find((x) => x.name === b); // b listé par a
    const inB = data().pairings(b).find((x) => x.name === a); // a listé par b
    const s = Math.max(inA ? ordinal(inA.rank) : 0, inB ? ordinal(inB.rank) : 0);
    return s;
  }

  function synergy(name, allies) {
    let raw = 0;
    const hits = [];
    for (const a of allies) {
      if (a === name) continue;
      const s = pairScore(name, a);
      if (s > 0) {
        raw += s;
        hits.push({ name: a, s });
      }
    }
    hits.sort((x, y) => y.s - x.s);
    const capped = Math.min(raw, 2.5); // évite qu'une comp entière s'auto-gonfle
    return { score: capped, reasons: hits.map((h) => h.name) };
  }

  // --- Edge matchup (ordinal, bidirectionnel via inversion) -------------------
  function matchupEdge(name, enemies) {
    let score = 0;
    const beats = [];
    const losesTo = [];
    const counteredByName = data().counteredBy(name); // qui counter `name`
    for (const e of enemies) {
      if (!e) continue;
      // `name` counter `e` ?  → e liste name dans ses worstMatchups
      const iBeat = data().counteredBy(e).find((x) => x.name === name);
      if (iBeat) {
        score += ordinal(iBeat.rank);
        beats.push(e);
      }
      // `e` counter `name` ?
      const beatsMe = counteredByName.find((x) => x.name === e);
      if (beatsMe) {
        score -= ordinal(beatsMe.rank);
        losesTo.push(e);
      }
    }
    const capped = clamp(score, -2.5, 2.5);
    return { score: capped, beats, losesTo };
  }

  // --- Protection du carry ----------------------------------------------------
  function protectCarry(name, allies) {
    const carry = allies.find((a) => isFragileCarry(a));
    if (!carry) return { score: 0, reason: null };
    if (name === carry) return { score: 0, reason: null };
    if (providesProtection(name)) {
      return { score: 1, reason: `Protège ${carry}` };
    }
    return { score: 0, reason: null };
  }

  // --- Shells (win-conditions du guide) --------------------------------------
  /** Shell dominant d'une liste de champions + progression. */
  function detectShell(names) {
    const shells = data().shells();
    let best = null;
    for (const sh of shells) {
      const set = new Set(sh.champions);
      const overlap = names.filter((n) => set.has(n)).length;
      const anchor = names.some((n) => sh.firstPickAnchors.includes(n));
      const score = overlap + (anchor ? 0.5 : 0);
      if (score > 0 && (!best || score > best.score)) {
        best = { shell: sh, overlap, anchor, score };
      }
    }
    return best;
  }

  function shellProgress(name, allies) {
    const lead = detectShell(allies);
    if (lead) {
      const sh = lead.shell;
      if (sh.champions.includes(name) && !allies.includes(name)) {
        const isAnchor = sh.firstPickAnchors.includes(name);
        return { score: isAnchor ? 1.5 : 1, reason: `Complète « ${sh.label} »` };
      }
      return { score: 0, reason: null };
    }
    // Ouverture : un anchor flexible de n'importe quel shell est un bon départ.
    if (!allies.length) {
      const anchorOf = data().shells().find((sh) => sh.firstPickAnchors.includes(name));
      if (anchorOf) return { score: 0.6, reason: `Ouverture flexible (${anchorOf.label})` };
    }
    return { score: 0, reason: null };
  }

  // --- Pièges (risques nommés, jamais des filtres durs) -----------------------
  function damageShares(names) {
    let ad = 0, ap = 0, n = 0;
    for (const name of names) {
      const p = data().profile(name);
      if (p.adShare == null && p.apShare == null) continue;
      ad += p.adShare ?? 0;
      ap += p.apShare ?? 0;
      n++;
    }
    return n ? { ad: ad / n, ap: ap / n, n } : { ad: 0, ap: 0, n: 0 };
  }

  function trapRisk(name, allies, enemies) {
    const warnings = [];
    let penalty = 0;

    // 1) Déjà hard-countered par un ennemi placé (rang 0 ou 1).
    const hard = data().counteredBy(name).filter((x) => enemies.includes(x.name) && x.rank <= 1);
    if (hard.length) {
      penalty += ordinal(hard[0].rank);
      warnings.push(`Contré par ${hard.map((h) => h.name).join(", ")} (déjà pické)`);
    }

    // 2) Carry fragile pris sans protection alors que l'adversaire dive.
    if (isFragileCarry(name)) {
      const hasProtect = allies.some((a) => providesProtection(a));
      const enemyDive = enemies.some((e) => {
        const t = data().roleTags(e);
        return t.includes("dive") || t.includes("assassin");
      });
      if (!hasProtect && enemyDive) {
        penalty += 0.6;
        warnings.push("Carry fragile sans peel face à une menace dive");
      }
    }

    // 3) Comp mono-dégâts (facile à itemiser côté adverse).
    const shares = damageShares(allies.concat(name));
    if (shares.n >= 3) {
      if (shares.ad >= 0.75) warnings.push("Comp très AD (résistances adverses faciles)");
      else if (shares.ap >= 0.75) warnings.push("Comp très AP (résistances adverses faciles)");
      if (shares.ad >= 0.85 || shares.ap >= 0.85) penalty += 0.4;
    }

    // 4) Empilement de supports dédiés (soft, jamais bloquant).
    if (isSupportJob(name)) {
      const sup = allies.filter((a) => isSupportJob(a)).length;
      if (sup >= 1) {
        penalty += 0.5;
        warnings.push("Deuxième support dédié — redondant");
      }
    }

    return { penalty, warnings };
  }

  // --- Score d'un pick à un poste donné --------------------------------------
  function scorePickAtSlot(name, slot, ctx) {
    const allies = (ctx.allies || []).filter((n) => n !== name);
    const enemies = (ctx.enemies || []).filter(Boolean);

    const bf = buffFit(name, slot);
    const tn = tierNorm(name);
    const syn = synergy(name, allies);
    const edge = matchupEdge(name, enemies);
    const prot = protectCarry(name, allies);
    const shell = shellProgress(name, allies);
    const trap = trapRisk(name, allies, enemies);

    const contrib = {
      buff: bf.score * W.buff,
      tier: tn * W.tier,
      synergy: syn.score * W.synergy,
      counter: edge.score * W.counter,
      protect: prot.score * W.protect,
      shell: shell.score * W.shell,
      trap: -trap.penalty * W.trap,
    };
    const score = Object.values(contrib).reduce((a, b) => a + b, 0);

    // Raisons ordonnées par importance / lisibilité.
    const reasons = [];
    reasons.push(bf.reason);
    if (edge.beats.length) reasons.push(`Counter ${edge.beats.join(", ")}`);
    if (syn.reasons.length) reasons.push(`Synergie ${syn.reasons.slice(0, 2).join(", ")}`);
    if (prot.reason) reasons.push(prot.reason);
    if (shell.reason) reasons.push(shell.reason);
    if (edge.losesTo.length) reasons.push(`⚠ Perd vs ${edge.losesTo.join(", ")}`);
    reasons.push(`Tier ${data().tier(name)}`);

    return {
      name,
      slot,
      score: round1(score),
      reasons: reasons.filter(Boolean).slice(0, 6),
      warnings: trap.warnings,
      breakdown: contrib,
    };
  }

  /**
   * Score un pick. Si `slot` est fourni → à ce poste. Sinon → meilleur poste
   * parmi `openSlots` (évaluation directe des ≤5 postes, aucun optimiseur exponentiel).
   */
  function scorePick(name, ctx = {}) {
    const open = (ctx.openSlots && ctx.openSlots.length ? ctx.openSlots : SLOTS).slice();
    if (ctx.slot) return scorePickAtSlot(name, ctx.slot, ctx);
    let best = null;
    for (const slot of open) {
      const r = scorePickAtSlot(name, slot, ctx);
      if (!best || r.score > best.score) best = r;
    }
    return best || scorePickAtSlot(name, open[0] || SLOTS[0], ctx);
  }

  /** Meilleur poste ouvert pour un champion (défaut de placement). */
  function bestSlotFor(name, openSlots) {
    const open = (openSlots && openSlots.length ? openSlots : SLOTS).slice();
    // Priorité au poste optimal s'il est ouvert.
    const opt = data().optimalSlots(name).find((s) => open.includes(s));
    if (opt) return opt;
    let best = open[0], bestScore = -Infinity;
    for (const slot of open) {
      const s = buffFit(name, slot).score;
      if (s > bestScore) { bestScore = s; best = slot; }
    }
    return best;
  }

  // --- Ban (avec contexte de NOTRE comp) -------------------------------------
  function scoreBan(name, ctx = {}) {
    const ourNames = (ctx.ourNames || []).filter(Boolean);
    const enemyNames = (ctx.enemyNames || []).filter(Boolean);
    const reasons = [];
    let score = 0;

    // 1) `name` counter l'un de NOS champions placés → menace directe.
    const threatens = ourNames.filter((o) => data().counteredBy(o).some((x) => x.name === name));
    if (threatens.length) {
      score += 22 + threatens.length * 6;
      reasons.push(`Counter notre ${threatens.join(", ")}`);
    }

    // 2) `name` complète un duo fort avec un ennemi déjà pické.
    const duoWith = enemyNames.filter((e) => data().pairings(e).some((x) => x.name === name) || data().pairings(name).some((x) => x.name === e));
    if (duoWith.length) {
      score += 16;
      reasons.push(`Casse le duo ${duoWith[0]} + ${name}`);
    }

    // 3) Menace meta : tier élevé + flexibilité de postes (difficile à cibler).
    const tv = tierNorm(name);
    const flex = data().optimalSlots(name).length + data().viableSlots(name).length;
    score += tv * 18 + Math.min(flex, 5) * 2;
    if (tv >= 0.75) reasons.push(`Tier ${data().tier(name)} meta`);

    // 4) Priorité de ban issue du shell que NOUS visons (guide).
    const lead = detectShell(ourNames);
    if (lead && lead.shell.banPriority.includes(name)) {
      score += 14;
      reasons.push(`Ban prioritaire vs « ${lead.shell.label} »`);
    }

    if (!reasons.length) reasons.push(`Retirer ${name} (tier ${data().tier(name)})`);
    return { name, score: round1(score), reasons: reasons.slice(0, 5) };
  }

  // --- Évaluation de comp + estimation de victoire ---------------------------
  /** Force brute d'une comp (pour l'estimation de win). Assignation optionnelle {slot:name}. */
  function evaluateComp(names, enemyNames = [], slotOf = null) {
    let total = 0;
    const breakdown = { tier: 0, synergy: 0, counter: 0, buff: 0, shell: 0 };
    for (const n of names) {
      breakdown.tier += tierNorm(n) * W.tier;
      if (slotOf && slotOf[n]) breakdown.buff += buffFit(n, slotOf[n]).score * W.buff;
    }
    // Synergies : toutes les paires, une fois.
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) breakdown.synergy += pairScore(names[i], names[j]) * W.synergy;
    }
    // Edge matchup global vs comp adverse.
    if (enemyNames.length) {
      for (const n of names) breakdown.counter += matchupEdge(n, enemyNames).score * W.counter;
    }
    const lead = detectShell(names);
    if (lead) breakdown.shell = lead.overlap * W.shell;
    total = Object.values(breakdown).reduce((a, b) => a + b, 0);
    return { total: round1(total), breakdown };
  }

  const VERDICT = (p) =>
    p >= 0.62 ? "Favorable" : p >= 0.54 ? "Léger avantage" : p > 0.46 ? "Équilibré" : p > 0.38 ? "Léger désavantage" : "Défavorable";

  /**
   * Estimation de victoire honnête : logistique sur l'écart de score.
   * Étiquetée « estimation heuristique » — ce n'est pas une probabilité mesurée.
   */
  function winEstimate(ourNames, enemyNames, ourSlots = null, enemySlots = null) {
    const our = evaluateComp(ourNames, enemyNames, ourSlots);
    const enemy = evaluateComp(enemyNames, ourNames, enemySlots);
    const margin = our.total - enemy.total;
    // Calibré sur la distribution réelle des écarts (std ≈ 76 sur 5v5 aléatoires).
    // SCALE=100 : une draft nettement gagnée (p95) ≈ 78%, jamais 95%+ — la draft ne
    // décide pas tout. Bornage [10%, 90%] pour rester honnête sur les extrêmes.
    const SCALE = 100;
    const raw = 1 / (1 + Math.exp(-margin / SCALE));
    const ourPct = clamp(raw, 0.1, 0.9);
    return {
      ourPct,
      enemyPct: 1 - ourPct,
      margin: round1(margin),
      verdict: VERDICT(ourPct),
      our,
      enemy,
      heuristic: true,
    };
  }

  return {
    SLOTS,
    W,
    useData,
    // pick / ban
    scorePick,
    scorePickAtSlot,
    scoreBan,
    bestSlotFor,
    // sous-composants (exposés pour tests / UI)
    buffFit,
    synergy,
    matchupEdge,
    protectCarry,
    shellProgress,
    trapRisk,
    detectShell,
    // comp
    evaluateComp,
    winEstimate,
    // classifs
    isFragileCarry,
    providesProtection,
    isSupportJob,
  };
});
