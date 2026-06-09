/**
 * TFM2 Guide Draft Engine — algorithme 100 % guide Early Access Ban Pick.
 * Shells · threat bans · replacement chains · Serpen/Morgard · traits · checklist.
 * Tier = tiebreaker secondaire uniquement.
 */
(function (global) {
  const SLOTS = ["Top", "Jungle", "Mid", "Bot", "Support"];
  const TIER_TB = { S: 8, A: 6, B: 4, C: 2, D: 1 };

  let guide = null;

  function setGuideData(data) {
    guide = data && typeof data === "object" ? data : null;
  }

  function shells() {
    return Object.values(guide?.compShells || {});
  }

  function getChampionGuide(name) {
    return guide?.championCounters?.[name] || null;
  }

  function getReplacementChain(coreName) {
    const cg = getChampionGuide(coreName);
    return (
      guide?.replacementChains?.[coreName] ||
      cg?.replacementIfBanned ||
      cg?.ifBanned ||
      []
    );
  }

  function tierTiebreaker(name, metaMap) {
    const t = metaMap?.[name]?.tierMeta || "C";
    return TIER_TB[t] ?? 2;
  }

  /** Détecte le shell le plus proche d'une liste de champions. */
  function detectShell(names) {
    if (!names?.length) return null;
    let best = null;
    let bestScore = 0;
    for (const shell of shells()) {
      const pool = new Set(shell.champions);
      if (shell.altSlots) Object.values(shell.altSlots).flat().forEach((n) => pool.add(n));
      const overlap = names.filter((n) => pool.has(n)).length;
      const score = overlap / shell.champions.length;
      if (score > bestScore) {
        bestScore = score;
        best = shell;
      }
    }
    if (!best || bestScore < 0.2) return null;
    return {
      shell: best,
      confidence: Math.round(bestScore * 100) / 100,
      overlap: names.filter((n) => best.champions.includes(n)),
    };
  }

  /** Sélection shell : en cours > contre adverse > rotation B1 (pas tier). */
  function recommendShell(enemyNames, ourNames, ctx = {}) {
    const ourDet = detectShell(ourNames);
    if (ourDet && ourDet.confidence >= 0.35) {
      return { shell: ourDet.shell, reason: `Shell en cours — ${ourDet.shell.labelFr}`, source: "ours" };
    }

    const enemyDet = detectShell(enemyNames);
    if (enemyDet?.shell?.style && guide?.shellCounters?.[enemyDet.shell.style]) {
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

    const shellIds = Object.keys(guide?.compShells || {});
    const rot = (ctx.sessionIndex ?? 0) + (ctx.banCount ?? 0) + (ctx.draftSeed ?? 0);
    const pickId = shellIds[rot % shellIds.length];
    const shell = guide.compShells[pickId];
    const anchor = shell.firstPickAnchors?.[rot % (shell.firstPickAnchors?.length || 1)];
    return {
      shell,
      reason: `Rotation shell — B1 ${anchor || shell.champions[0]} (${shell.labelFr})`,
      source: "rotate",
      b1Anchor: anchor,
    };
  }

  function bannedCores(ourNames, takenNames) {
    const cores = [];
    for (const [core, chain] of Object.entries(guide?.replacementChains || {})) {
      if (takenNames.has(core) && !ourNames.includes(core)) cores.push({ core, chain });
    }
    return cores;
  }

  function nextPickInOrder(shell, allies) {
    const order = shell.pickOrder || shell.champions || [];
    return order.find((c) => !allies.includes(c)) || null;
  }

  function slotForChampion(shell, champName) {
    if (!shell?.slots) return null;
    for (const [slot, name] of Object.entries(shell.slots)) {
      if (name === champName) return slot;
    }
    if (shell.altSlots) {
      for (const [slot, alts] of Object.entries(shell.altSlots)) {
        if (alts.includes(champName)) return slot;
      }
    }
    return null;
  }

  function shellDistinctPenalty(shell, champName) {
    if (!shell?.distinctFrom) return 0;
    for (const [wrong, msg] of Object.entries(shell.distinctFrom)) {
      if (champName === wrong) return -55;
    }
    return 0;
  }

  function replacementRank(champName, core, chain) {
    const idx = chain.indexOf(champName);
    if (idx < 0) return 0;
    if (idx === 0) return 92;
    if (idx === 1) return 78;
    if (idx === 2) return 62;
    return 40 - idx * 4;
  }

  function scoreGuidePick(champName, ctx = {}) {
    const {
      allies = [],
      oppNames = [],
      phase = "core",
      takenNames,
      playerTraits,
      metaMap,
      sessionIndex = 0,
      banCount = 0,
      draftSeed = 0,
    } = ctx;

    let score = 0;
    const reasons = [];
    const rec = recommendShell(oppNames, allies, { sessionIndex, banCount, draftSeed });
    const shell = rec.shell;
    const cg = getChampionGuide(champName);

    if (!shell) return { score: tierTiebreaker(champName, metaMap), reasons: ["Pas de shell"] };

    const distinctPen = shellDistinctPenalty(shell, champName);
    if (distinctPen < 0) {
      score += distinctPen;
      const msg = shell.distinctFrom?.[champName];
      reasons.push(msg || "Mauvais carry pour ce shell");
    }

    if (shell.champions?.includes(champName)) {
      const missing = shell.champions.filter((c) => !allies.includes(c) && c !== champName);
      score += 52 + missing.length * 8;
      reasons.push(`Shell ${shell.labelFr}`);
    }

    const nextPick = nextPickInOrder(shell, allies);
    if (nextPick === champName) {
      score += 44;
      reasons.push(`Prochain pick shell (${champName})`);
    }

    if (shell.firstPickAnchors?.includes(champName) && !allies.length) {
      const anchorIdx = shell.firstPickAnchors.indexOf(champName);
      const rotIdx = (sessionIndex + banCount + draftSeed) % shell.firstPickAnchors.length;
      const rotBonus = anchorIdx === rotIdx ? 42 : 20;
      score += rotBonus;
      reasons.push(anchorIdx === rotIdx ? `B1 rotation — ${champName}` : "Ancre shell flex");
    }

    if (cg) {
      for (const e of oppNames) {
        if (cg.goodInto?.includes(e)) {
          score += 26;
          if (reasons.length < 5) reasons.push(`Fort vs ${e}`);
        }
        if (cg.watchOut?.includes(e)) {
          score -= 32;
          if (reasons.length < 6) reasons.push(`⚠ ${e} counter`);
        }
      }
    }

    const taken = takenNames || new Set();
    for (const { core, chain } of bannedCores(allies, taken)) {
      const rep = replacementRank(champName, core, chain);
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
          score += 22;
          reasons.push(`Trait ${trait}`);
        }
      }
      const agg = playerTraits.includes("high_aggression")
        ? guide.playerTraits?.aggression?.high
        : playerTraits.includes("low_aggression")
          ? guide.playerTraits?.aggression?.low
          : null;
      if (agg?.includes(champName)) score += 12;

      const roam = playerTraits.includes("high_roaming")
        ? guide.playerTraits?.roaming?.high
        : playerTraits.includes("low_roaming")
          ? guide.playerTraits?.roaming?.low
          : null;
      if (roam?.includes(champName)) score += 10;
    }

    if (phase === "opening" && !allies.length && cg?.shells?.length) {
      if (cg.shells.includes(shell.id)) score += 16;
    }

    score += tierTiebreaker(champName, metaMap) * 0.35;

    return { score: Math.round(score * 10) / 10, reasons: [...new Set(reasons)].slice(0, 6), shell: rec };
  }

  function scoreThreatBan(champName, ourNames, enemyNames, ctx = {}) {
    let score = 0;
    const reasons = [];
    const rec = recommendShell(enemyNames, ourNames, ctx);
    const ourShell = detectShell(ourNames)?.shell || rec.shell;
    const enemyShell = detectShell(enemyNames)?.shell;
    const cg = getChampionGuide(champName);

    if (ourShell?.cannotAnswer?.includes(champName)) {
      score += 90;
      reasons.push(`Menace vs ${ourShell.labelFr}`);
    }
    if (ourShell?.banPriority?.includes(champName)) {
      const rank = ourShell.banPriority.indexOf(champName);
      score += 75 - rank * 11;
      if (!reasons.length) reasons.push(`Ban prio shell — ${ourShell.labelFr}`);
    }

    for (const rule of Object.values(guide?.banPhilosophy?.threats || {})) {
      if (rule.whenOurShell && ourShell && !rule.whenOurShell.includes(ourShell.id)) continue;
      if (rule.whenEnemyHas && !enemyNames.some((n) => rule.whenEnemyHas.includes(n))) continue;
      if (rule.ban?.includes(champName)) {
        score += 60;
        reasons.push(`Threat ban — ${rule.label || "profil adverse"}`);
      }
    }

    if (enemyShell) {
      const completes = enemyShell.champions.filter((c) => !enemyNames.includes(c));
      if (completes.includes(champName)) {
        score += 46;
        reasons.push(`Complète ${enemyShell.labelFr}`);
      }
      for (const e of enemyNames) {
        const eg = getChampionGuide(e);
        if (eg?.watchOut?.includes(champName)) {
          score += 38;
          reasons.push(`Répond à ${e}`);
          break;
        }
      }
    }

    for (const o of ourNames) {
      const og = getChampionGuide(o);
      if (og?.watchOut?.includes(champName)) {
        score += 54;
        reasons.push(`Counter notre ${o}`);
        break;
      }
      if (cg?.goodInto?.includes(o)) {
        score += 42;
        reasons.push(`Fort vs notre ${o}`);
        break;
      }
    }

    const carryTags = ["Archer", "Tireur", "Soldat", "Joueur"];
    if (
      enemyNames.some((n) => carryTags.includes(n)) &&
      ["Ninja", "Démon", "Exécuteur"].includes(champName)
    ) {
      score += 36;
      if (!reasons.some((r) => r.includes("carry"))) reasons.push("Anti-carry fragile adverse");
    }

    if (
      ourShell &&
      ["sniper_front_to_back", "archer_priest_kite"].includes(ourShell.id) &&
      ["Ninja", "Démon", "Exécuteur", "Bombardier"].includes(champName)
    ) {
      score += 28;
      reasons.push("Anti-dive vs notre backline");
    }

    score += tierTiebreaker(champName, ctx.metaMap) * 0.25;

    return {
      score: Math.round(score * 10) / 10,
      reasons: [...new Set(reasons)].slice(0, 6),
      ourShell,
      enemyShell,
      shellRec: rec,
    };
  }

  function scorePickCandidate(champName, ctx = {}) {
    const { openSlots = SLOTS, hintSlot, metaMap, byName } = ctx;
    const gp = scoreGuidePick(champName, ctx);
    const shell = gp.shell?.shell;
    const idealSlot = slotForChampion(shell, champName);
    const slots = openSlots.length ? openSlots : SLOTS;

    let bestSlot = idealSlot && slots.includes(idealSlot) ? idealSlot : slots[0];
    let slotBonus = 0;

    if (idealSlot) {
      if (slots.includes(idealSlot)) {
        bestSlot = idealSlot;
        slotBonus = 18;
      } else if (hintSlot === idealSlot) slotBonus = 8;
    }
    if (hintSlot && slots.includes(hintSlot)) {
      if (hintSlot === idealSlot) slotBonus += 12;
      else if (!idealSlot) bestSlot = hintSlot;
    }

    const c = byName?.get?.(champName);
    const opts = c?.optimalSlots || metaMap?.[champName]?.optimalSlots || [];
    if (opts.includes(bestSlot)) slotBonus += 4;

    let score = gp.score + slotBonus;
    const reasons = [...gp.reasons];
    if (idealSlot && bestSlot === idealSlot) reasons.push(`Poste shell ${idealSlot}`);
    if (hintSlot === bestSlot) reasons.push(`Focus ${hintSlot}`);

    return {
      score: Math.round(score * 10) / 10,
      slot: bestSlot,
      reasons: [...new Set(reasons)].slice(0, 7),
      shell: gp.shell,
    };
  }

  function scoreBanCandidate(champName, ctx = {}) {
    const { ourNames = [], oppNames = [] } = ctx;
    return scoreThreatBan(champName, ourNames, oppNames, ctx);
  }

  function serpenHint(shell, allies = []) {
    if (!shell?.serpen) return null;
    const sp = shell.serpen;
    const have = allies.filter((n) => sp.champions?.includes(n));
    const rule = guide?.serpenRules?.[sp.plan];
    const parts = [sp.label || sp.plan];
    if (have.length) parts.push(`Clés: ${have.slice(0, 3).join(", ")}`);
    if (rule?.burn_fast?.length && sp.plan === "fight_early") {
      parts.push(`Burn: ${rule.burn_fast.slice(0, 2).join(", ")}`);
    }
    const checks = (sp.checks || [])
      .map((c) => {
        const map = {
          jungler_alive: "JG vivant",
          correct_side: "bon côté",
          lanes_mobile: "lanes mobiles",
          early_damage_cc: "dmg/CC early",
          lanes_can_trade: "lanes trade",
          peel_ready: "peel prêt",
          backline_access: "accès backline",
          follow_up_cc: "follow-up CC",
        };
        return map[c] || c;
      })
      .join(" · ");
    if (checks) parts.push(`Check: ${checks}`);
    return parts.join(" · ");
  }

  function morgardHint(shell) {
    if (!shell?.morgard) return null;
    const mg = shell.morgard;
    const rule = guide?.morgardRules?.[mg.plan];
    const tactic = rule?.tactic || mg.tactics?.morgard;
    const needs = mg.draftNeeds?.length ? ` · besoin ${mg.draftNeeds.slice(0, 3).join(", ")}` : "";
    return `${mg.label || mg.plan}${tactic ? ` (${tactic})` : ""}${needs}`;
  }

  function coachDraftHint(ctx = {}) {
    const { ourNames = [], enemyNames = [], stepType, playerTraits } = ctx;
    const parts = [];
    const rec = recommendShell(enemyNames, ourNames, ctx);
    const enemyDet = detectShell(enemyNames);

    if (stepType === "ban") {
      parts.push(guide?.banPhilosophy?.principle || "Ban menaces — pas le meta");
      if (rec.shell) parts.push(`Plan: ${rec.shell.labelFr}`);
      if (enemyDet) parts.push(`Adv. → ${enemyDet.shell.labelFr} (${Math.round(enemyDet.confidence * 100)}%)`);
      if (rec.shell?.banPriority?.length) {
        const prio = rec.shell.banPriority.filter((n) => !enemyNames.includes(n)).slice(0, 3);
        if (prio.length) parts.push(`Cibles menace: ${prio.join(", ")}`);
      }
      return parts.join(" · ");
    }

    parts.push(rec.reason);
    if (enemyDet && enemyDet.confidence >= 0.3) {
      parts.push(`Adv. shell: ${enemyDet.shell.labelFr}`);
    }

    const next = nextPickInOrder(rec.shell, ourNames);
    if (next) parts.push(`Prochain: ${next}`);

    const serpen = serpenHint(rec.shell, ourNames);
    if (serpen) parts.push(`Serpent: ${serpen}`);

    const morgard = morgardHint(rec.shell);
    if (morgard) parts.push(`Morgard: ${morgard}`);

    const banned = bannedCores(ourNames, ctx.takenNames || new Set());
    if (banned[0]) {
      const chain = banned[0].chain.filter((n) => n !== banned[0].core).slice(0, 2);
      if (chain.length) parts.push(`${banned[0].core} banni → ${chain.join(" / ")}`);
    }

    if (playerTraits?.length) parts.push(`Traits: ${playerTraits.slice(0, 2).join(", ")}`);

    return parts.slice(0, 6).join(" · ");
  }

  function validateChecklist(ourNames, enemyNames, ctx = {}) {
    const rec = recommendShell(enemyNames, ourNames, ctx);
    const shell = detectShell(ourNames)?.shell || rec.shell;
    const tags = new Set();
    for (const n of ourNames) {
      const cg = getChampionGuide(n);
      (cg?.tags || []).forEach((t) => tags.add(t));
    }

    const items = (guide?.finalChecklist?.items || []).map((item) => {
      let ok = false;
      let detail = "";
      switch (item.id) {
        case "win_condition":
          ok = Boolean(shell && ourNames.length >= 3);
          detail = shell?.winCondition || shell?.labelFr || "";
          break;
        case "replacements": {
          const taken = ctx.takenNames || new Set();
          const banned = bannedCores(ourNames, taken);
          ok = banned.length === 0 || banned.every((b) => b.chain.some((c) => ourNames.includes(c)));
          detail = banned[0] ? `${banned[0].core} → ${banned[0].chain.slice(0, 2).join("/")}` : "Aucun core banni";
          break;
        }
        case "damage":
          ok = tags.has("marksman") || tags.has("mage_burst") || tags.has("burst");
          detail = [...tags].filter((t) => /marksman|mage|burst|poke/.test(t)).join(", ") || "manque DPS";
          break;
        case "engage_peel":
          ok = (tags.has("frontline") || tags.has("engage")) && (tags.has("peel") || ourNames.some((n) => /combattant|moine|porteur|prêtre/i.test(n)));
          detail = `front=${tags.has("frontline")} peel=${tags.has("peel")}`;
          break;
        case "serpen_plan":
          ok = Boolean(shell?.serpen?.plan);
          detail = serpenHint(shell, ourNames) || "";
          break;
        case "morgard_plan":
          ok = Boolean(shell?.morgard?.plan);
          detail = morgardHint(shell) || "";
          break;
        default:
          ok = false;
      }
      return { ...item, ok, detail };
    });

    const passed = items.filter((i) => i.ok).length;
    return { items, passed, total: items.length, shell, ready: passed >= items.length - 1 };
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
      notes.push(`Pivot: ${banned[0].core} → ${banned[0].chain.slice(0, 3).join(" → ")}`);
    }

    const checklist = validateChecklist(ourNames, enemyNames, ctx);

    return { ourShell: ourDet, enemyShell: enDet, recommended: rec, notes, checklist };
  }

  function getDraftPlan(ctx = {}) {
    const { ourNames = [], enemyNames = [] } = ctx;
    const rec = recommendShell(enemyNames, ourNames, ctx);
    const shell = rec.shell;
    return {
      shell: shell?.labelFr,
      shellId: shell?.id,
      reason: rec.reason,
      pickOrder: (shell?.pickOrder || []).filter((c) => !ourNames.includes(c)),
      nextPick: nextPickInOrder(shell, ourNames),
      banPriority: (shell?.banPriority || []).filter((n) => !enemyNames.includes(n)),
      serpen: serpenHint(shell, ourNames),
      morgard: morgardHint(shell),
      checklist: validateChecklist(ourNames, enemyNames, ctx),
    };
  }

  const api = {
    setGuideData,
    shells,
    getChampionGuide,
    getReplacementChain,
    detectShell,
    recommendShell,
    scoreGuidePick,
    scoreThreatBan,
    scorePickCandidate,
    scoreBanCandidate,
    serpenHint,
    morgardHint,
    coachDraftHint,
    validateChecklist,
    analyzeShellMatchup,
    getDraftPlan,
    bannedCores,
    nextPickInOrder,
    slotForChampion,
    GUIDE: () => guide,
    SLOTS,
  };

  global.TFM2GuideDraftEngine = api;
  global.TFM2DraftGuide = api;
})(typeof window !== "undefined" ? window : globalThis);
