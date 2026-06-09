/**
 * TFM2 Draft Engine v27 — session draft + scoring TFM2GuideDraftEngine (guide Early Access uniquement).
 */
(function (global) {
  const MC = () => global.TFM2MatchCore;
  const SLOTS = MC()?.SLOTS || ["Top", "Jungle", "Mid", "Bot", "Support"];
  const SLOT_LABELS = MC()?.SLOT_LABELS || { Top: "Top", Jungle: "Jungle", Mid: "Mid", Bot: "Bot", Support: "Support" };

  const PICK_STEPS = [
    { type: "pick", side: "blue" }, { type: "pick", side: "red" },
    { type: "pick", side: "red" }, { type: "pick", side: "blue" },
    { type: "pick", side: "blue" }, { type: "pick", side: "red" },
    { type: "pick", side: "red" }, { type: "pick", side: "blue" },
    { type: "pick", side: "blue" }, { type: "pick", side: "red" },
  ];

  const COMP_PLANS = {
    teamfight_engage: { label: "Teamfight engage" },
    poke_siege: { label: "Poke / siege" },
    pick_assassin: { label: "Pick / assassins" },
    hypercarry_bot: { label: "Hypercarry Bot" },
    split_map: { label: "Split map" },
    scaling_late: { label: "Scaling late" },
    early_tempo: { label: "Tempo early" },
    protect_carry: { label: "Protect carry" },
  };

  const PLAN_VS_ENEMY = {};
  const ENEMY_PLAN_ANSWERS = {};
  const SLOT_BUFF = MC()?.SLOT_BUFF || {};
  const MTG_COLORS = MC()?.MTG_COLORS || ["W", "U", "B", "R", "G"];
  const COLOR_LABELS = MC()?.COLOR_LABELS || {};
  const COLOR_HEX = MC()?.COLOR_HEX || {};

  let recommendationCache = null;

  function buildDraftSteps(n = 3) {
    const steps = [];
    for (let i = 0; i < n * 2; i++) steps.push({ type: "ban", side: i % 2 === 0 ? "blue" : "red" });
    return steps.concat(PICK_STEPS);
  }

  function normalizeSession(s) {
    if (!s) return s;
    if (s.bansPerTeam !== 2 && s.bansPerTeam !== 3) s.bansPerTeam = 3;
    if (typeof s.fearless !== "boolean") s.fearless = false;
    if (!s.bans) s.bans = { blue: [], red: [] };
    if (!s.picks) s.picks = { blue: [], red: [] };
    const max = s.bansPerTeam === 2 ? 2 : 3;
    for (const side of ["blue", "red"]) {
      const c = (s.bans[side] || []).filter(Boolean);
      s.bans[side] = Array.from({ length: max }, (_, i) => c[i] || null);
    }
    if (s.focus === undefined) s.focus = null;
    dedupePickSlots(s);
    return s;
  }

  /** Répare les sessions où plusieurs picks partagent le même poste (bug relayout). */
  function dedupePickSlots(s) {
    for (const side of ["blue", "red"]) {
      const picks = s.picks[side] || [];
      if (picks.length < 2) continue;
      const used = new Set();
      for (const p of picks) {
        if (!p.slot || used.has(p.slot)) {
          p.slot = SLOTS.find((sl) => !used.has(sl)) || p.slot || SLOTS[0];
        }
        used.add(p.slot);
      }
    }
  }

  function createSession(name, ourSide = "blue", opts = {}) {
    return normalizeSession({
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      ourSide,
      bansPerTeam: opts.bansPerTeam === 2 ? 2 : 3,
      fearless: Boolean(opts.fearless),
      stepIndex: 0,
      bans: { blue: [], red: [] },
      picks: { blue: [], red: [] },
      activeSlot: "Top",
      enemyActiveSlot: "Top",
      focus: null,
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  function getSteps(s) { return buildDraftSteps(normalizeSession(s).bansPerTeam); }
  function totalSteps(s) { return getSteps(s).length; }
  function getStep(s) { return getSteps(s)[s.stepIndex] || null; }
  function isComplete(s) {
    if (!s) return false;
    return s.stepIndex >= totalSteps(s);
  }

  function fearlessUsed(all, id) {
    const out = new Set();
    for (const sess of all || []) {
      if (sess.id === id) break;
      normalizeSession(sess);
      for (const side of ["blue", "red"]) (sess.picks[side] || []).forEach((p) => out.add(p.name));
    }
    return out;
  }

  function taken(s, all = []) {
    normalizeSession(s);
    const names = new Set();
    for (const side of ["blue", "red"]) {
      s.bans[side].forEach((n) => n && names.add(n));
      (s.picks[side] || []).forEach((p) => names.add(p.name));
    }
    if (s.fearless) fearlessUsed(all, s.id).forEach((n) => names.add(n));
    return names;
  }

  function available(allChamps, s, all = []) {
    return allChamps.filter((c) => !taken(s, all).has(c.name));
  }

  function sidePicks(s, side) { return s.picks[side] || []; }
  function pickBySlot(s, side) {
    const m = {};
    for (const p of sidePicks(s, side)) if (p.slot) m[p.slot] = p.name;
    return m;
  }
  function ourSide(s) { return s.ourSide; }
  function enemySide(s) { return s.ourSide === "blue" ? "red" : "blue"; }
  function isOurTurn(s) { const st = getStep(s); return st && st.side === ourSide(s); }
  function canEditFormat(s) { return s.stepIndex === 0; }
  function openSlots(s, side) { return SLOTS.filter((sl) => !pickBySlot(s, side)[sl]); }

  function draftDepth(s) {
    return Math.min(1, (sidePicks(s, "blue").length + sidePicks(s, "red").length) / 10);
  }

  function draftPhase(s) {
    const d = sidePicks(s, "blue").length + sidePicks(s, "red").length;
    if (d <= 2) return "opening";
    if (d <= 6) return "core";
    return "closing";
  }

  function invalidateRecommendationCache() { recommendationCache = null; }

  function phaseWeights(depth, phase) {
    return MC().phaseWeights(depth, phase);
  }

  function evaluateTeam(names, ctx) {
    return MC().evaluateTeam(names, ctx);
  }

  function compareComps(ourComp, enemyComp, byName, metaMap) {
    return MC().compareComps(ourComp, enemyComp, byName, metaMap);
  }

  function teamColorSummary(names, byName, metaMap) {
    return MC().teamColorSummary(names, byName, metaMap);
  }

  function bestLayout(names, ctx) {
    return MC().bestLayout(names, ctx);
  }

  function optimizeLayout(s, side, byName, meta) {
    const names = sidePicks(s, side).map((p) => p.name);
    if (!names.length) { s.picks[side] = []; return; }
    const opp = side === "blue" ? "red" : "blue";
    const ctx = {
      byName,
      metaMap: meta,
      oppNames: sidePicks(s, opp).map((p) => p.name),
      oppComp: pickBySlot(s, opp),
      slotsLeft: 5 - names.length,
    };
    const { assignment } = bestLayout(names, ctx);
    if (assignment.length) s.picks[side] = assignment;
  }

  function relayoutAll(s, ctx = {}) {
    if (!ctx.byName) return;
    normalizeSession(s);
    optimizeLayout(s, "blue", ctx.byName, ctx.metaMap || {});
    optimizeLayout(s, "red", ctx.byName, ctx.metaMap || {});
  }

  function pinChampionSlot(s, side, name, slot) {
    if (!slot || !name) return;
    const picks = s.picks[side];
    const target = picks.find((p) => p.name === name);
    if (!target || target.slot === slot) return;
    const occupant = picks.find((p) => p.slot === slot && p.name !== name);
    if (occupant) {
      const old = target.slot;
      target.slot = slot;
      occupant.slot = old;
    } else {
      target.slot = slot;
    }
  }

  /** TFM2 : tous les postes sont jouables — optimalSlots = bonus au score, pas un filtre. */
  function playableSlotsFor(champ, meta) {
    return SLOTS.slice();
  }

  function playsSlotFor(champ, meta, slot) {
    return SLOTS.includes(slot);
  }

  function playsSlot(v, champ, slot, meta) {
    return SLOTS.includes(slot);
  }

  function assignmentRespectsLaneRates() {
    return true;
  }

  function guideEngine() {
    return global.TFM2GuideDraftEngine || global.TFM2DraftGuide;
  }

  function scorePick(champ, s, side, byName, meta, hintSlot = null, all = []) {
    const GE = guideEngine();
    const g = guideCtx(s, side, all, byName, meta);
    const allies = sidePicks(s, side).map((p) => p.name).filter((n) => n !== champ.name);
    const open = openSlots(s, side);
    if (!GE?.scorePickCandidate) {
      return { score: 0, reasons: ["Moteur guide indisponible"], slot: hintSlot || open[0] || SLOTS[0] };
    }
    return GE.scorePickCandidate(champ.name, {
      allies,
      oppNames: g.oppNames,
      byName,
      metaMap: meta,
      openSlots: open,
      hintSlot,
      phase: draftPhase(s),
      sessionIndex: g.sessionIndex,
      banCount: g.banCount,
      takenNames: g.takenNames,
      playerTraits: g.playerTraits,
      allSessions: all,
      sessionPatterns: g.sessionPatterns,
      ourSide: s.ourSide,
    });
  }

  function guideCtx(s, side, all, byName, meta) {
    const opp = side === "blue" ? "red" : "blue";
    const bans = (s.bans.blue || []).concat(s.bans.red || []).filter(Boolean);
    const GE = guideEngine();
    const sessionPatterns = GE?.analyzeSessionPatterns?.(all, { ourSide: s.ourSide }) || null;
    return {
      sessionIndex: (all || []).indexOf(s),
      banCount: bans.length,
      takenNames: taken(s, all),
      playerTraits: s.playerTraits || [],
      oppNames: sidePicks(s, opp).map((p) => p.name),
      ourNames: sidePicks(s, side).map((p) => p.name),
      allSessions: all || [],
      sessionPatterns,
      ourSide: s.ourSide,
      byName,
      metaMap: meta,
    };
  }

  function scoreBan(champ, s, side, byName, meta, all = []) {
    const GE = guideEngine();
    const g = guideCtx(s, side, all, byName, meta);
    if (!GE?.scoreBanCandidate) {
      return { score: 0, reasons: ["Moteur guide indisponible"] };
    }
    return GE.scoreBanCandidate(champ.name, {
      sessionSide: side,
      oppNames: g.oppNames,
      ourNames: g.ourNames,
      byName,
      metaMap: meta,
      phase: draftPhase(s),
      sessionIndex: g.sessionIndex,
      banCount: g.banCount,
      takenNames: g.takenNames,
      playerTraits: g.playerTraits,
    });
  }

  function scoreCandidate(s, side, champ, byName, meta, hintSlot = null, all = []) {
    return scorePick(champ, s, side, byName, meta, hintSlot, all);
  }

  function recommendationCacheKey(s, side, all, step) {
    const picks = ["blue", "red"].map((sd) => sidePicks(s, sd).map((p) => p.name).join(",")).join("|");
    const bans = ["blue", "red"].map((sd) => (s.bans[sd] || []).join(",")).join("|");
    return `${s.id}:${step?.type}:${side}:${s.stepIndex}:${picks}:${bans}:${s.fearless}`;
  }

  function getRecommendations(s, side, allChamps, all, byName, meta, limit = 12, opts = {}) {
    normalizeSession(s);
    const step = getStep(s);
    const avail = available(allChamps, s, all);
    const hintSlot =
      opts.hintSlot ??
      (s.focus?.type === "pick" && s.focus.side === side ? s.focus.slot : null);
    const cacheKey = `${recommendationCacheKey(s, side, all, step)}:${hintSlot || ""}`;
    if (recommendationCache?.key === cacheKey && recommendationCache.limit >= limit) {
      return { ...recommendationCache.result, items: recommendationCache.result.items.slice(0, limit) };
    }
    if (step?.type === "ban") {
      const items = avail
        .map((c) => {
          const { score, reasons } = scoreBan(c, s, side, byName, meta, all);
          return { champion: c, score, reasons };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      const coachHint = getDraftCoachHint(s, side, byName, meta, all);
      const result = { type: "ban", side, items, forSide: side, coachHint };
      recommendationCache = { key: cacheKey, limit, result };
      return result;
    }
    const items = avail
      .map((c) => {
        try {
          const { score, reasons, slot, pickMeta } = scoreCandidate(s, side, c, byName, meta, hintSlot || null, all);
          return { champion: c, score, reasons, slot, pickMeta };
        } catch (err) {
          console.warn("scorePick failed", c?.name, err);
          const open = openSlots(s, side);
          return {
            champion: c,
            score: 0,
            reasons: ["Erreur scoring guide"],
            slot: hintSlot || open[0] || SLOTS[0],
          };
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    const coachHint = getDraftCoachHint(s, side, byName, meta, all);
    const gPick = guideCtx(s, side, all, byName, meta);
    const GE = guideEngine();
    const shellAnalysis = GE?.analyzeShellMatchup?.(
      gPick.ourNames,
      gPick.oppNames,
      { takenNames: gPick.takenNames, sessionIndex: gPick.sessionIndex, banCount: gPick.banCount }
    );
    const draftPlan = GE?.getDraftPlan?.({
      ourNames: gPick.ourNames,
      enemyNames: gPick.oppNames,
      takenNames: gPick.takenNames,
      sessionIndex: gPick.sessionIndex,
      banCount: gPick.banCount,
      allSessions: all,
      sessionPatterns: gPick.sessionPatterns,
      ourSide: s.ourSide,
    });
    const result = {
      type: "pick",
      side,
      slot: items[0]?.slot,
      items,
      forSide: side,
      coachHint,
      shellAnalysis,
      draftPlan,
    };
    recommendationCache = { key: cacheKey, limit, result };
    return result;
  }

  function applyAction(s, action, all = [], ctx = {}) {
    s.history.push(JSON.stringify({ stepIndex: s.stepIndex, bans: s.bans, picks: s.picks }));
    const step = getStep(s);
    if (!step) return { ok: false, error: "Draft terminé." };
    if (taken(s, all).has(action.championName)) {
      if (s.fearless && fearlessUsed(all, s.id).has(action.championName)) {
        return { ok: false, error: "Champion indisponible (fearless)." };
      }
      return { ok: false, error: "Champion déjà pris ou banni." };
    }
    if (step.type === "ban") {
      let idx = action.banIndex ?? s.bans[step.side].findIndex((n) => !n);
      if (idx < 0) return { ok: false, error: "Bans pleins." };
      s.bans[step.side][idx] = action.championName;
    } else {
      if (!ctx.byName) return { ok: false, error: "Données manquantes." };
      const list = sidePicks(s, step.side).filter((p) => p.name !== action.championName);
      if (list.length >= 5) return { ok: false, error: "Picks pleins." };
      clearFromBoard(s, action.championName);
      const targetSlot = action.slot && openSlots(s, step.side).includes(action.slot)
        ? action.slot
        : SLOTS[0];
      s.picks[step.side] = list.concat([{ name: action.championName, slot: targetSlot }]);
      try {
        relayoutAll(s, ctx);
      } catch (err) {
        console.warn("relayoutAll after pick", err);
      }
      if (action.slot) pinChampionSlot(s, step.side, action.championName, action.slot);
    }
    s.stepIndex++;
    s.updatedAt = Date.now();
    invalidateRecommendationCache();
    if (step.type === "pick") {
      return { ok: true, slot: s.picks[step.side].find((p) => p.name === action.championName)?.slot };
    }
    return { ok: true };
  }

  function clearFromBoard(s, name) {
    for (const side of ["blue", "red"]) {
      s.bans[side] = s.bans[side].map((n) => (n === name ? null : n));
      s.picks[side] = s.picks[side].filter((p) => p.name !== name);
    }
  }

  function undo(s) {
    if (!s.history.length) return false;
    Object.assign(s, JSON.parse(s.history.pop()));
    s.updatedAt = Date.now();
    invalidateRecommendationCache();
    return true;
  }

  function resetSession(s) {
    s.stepIndex = 0;
    s.bans = { blue: [], red: [] };
    s.picks = { blue: [], red: [] };
    s.history = [];
    s.focus = null;
    s.updatedAt = Date.now();
    invalidateRecommendationCache();
  }

  function resyncStepIndex(s) {
    const steps = getSteps(s);
    for (let i = 0; i < steps.length; i++) {
      const st = steps[i];
      if (st.type === "ban") {
        const need = steps.slice(0, i + 1).filter((x) => x.type === "ban" && x.side === st.side).length;
        if ((s.bans[st.side] || []).filter(Boolean).length < need) { s.stepIndex = i; return; }
      } else {
        const need = steps.slice(0, i + 1).filter((x) => x.type === "pick" && x.side === st.side).length;
        if ((s.picks[st.side] || []).length < need) { s.stepIndex = i; return; }
      }
    }
    s.stepIndex = steps.length;
  }

  function swapPickSlots(s, side, a, b) {
    normalizeSession(s);
    const comp = pickBySlot(s, side);
    const na = comp[a];
    const nb = comp[b];
    if (!na && !nb) return { ok: false, error: "Postes vides." };
    if (a === b) return { ok: false, error: "Même poste." };
    s.history.push(JSON.stringify({ stepIndex: s.stepIndex, bans: s.bans, picks: s.picks }));
    s.picks[side] = s.picks[side].filter((p) => p.slot !== a && p.slot !== b);
    if (nb) s.picks[side].push({ name: nb, slot: a });
    if (na) s.picks[side].push({ name: na, slot: b });
    s.updatedAt = Date.now();
    invalidateRecommendationCache();
    const slotLabel = (sl, n) => `${SLOT_LABELS[sl] || sl}${n ? `: ${n}` : ""}`;
    const message = na && nb
      ? `${slotLabel(a, na)} ↔ ${slotLabel(b, nb)}`
      : `${na || nb} → ${SLOT_LABELS[na ? b : a] || (na ? b : a)}`;
    return { ok: true, message };
  }

  function manualAssign(s, action, all = [], ctx = {}) {
    s.history.push(JSON.stringify({ stepIndex: s.stepIndex, bans: s.bans, picks: s.picks }));
    normalizeSession(s);
    const { type, side, name, slot: hintSlot, banIndex } = action;
    const { byName, metaMap } = ctx;
    if (!name) {
      if (type === "ban" && banIndex != null) s.bans[side][banIndex] = null;
      else if (type === "pick" && hintSlot) {
        s.picks[side] = s.picks[side].filter((p) => p.slot !== hintSlot);
      }
      resyncStepIndex(s);
      s.updatedAt = Date.now();
      invalidateRecommendationCache();
      return { ok: true };
    }
    if (
      taken(s, all).has(name) &&
      !s.bans[side].includes(name) &&
      !sidePicks(s, side).some((p) => p.name === name)
    ) {
      return { ok: false, error: "Indisponible." };
    }
    clearFromBoard(s, name);
    if (type === "ban") {
      const max = s.bansPerTeam === 2 ? 2 : 3;
      let idx = banIndex ?? s.bans[side].findIndex((n) => !n);
      if (idx < 0 || idx >= max) return { ok: false, error: "Bans pleins." };
      s.bans[side][idx] = name;
    } else {
      const list = sidePicks(s, side).filter((p) => p.name !== name);
      if (list.length >= 5) return { ok: false, error: "Picks pleins." };
      const targetSlot = hintSlot && openSlots(s, side).includes(hintSlot) ? hintSlot : SLOTS[0];
      s.picks[side] = list.concat([{ name, slot: targetSlot }]);
      relayoutAll(s, ctx);
      if (hintSlot) pinChampionSlot(s, side, name, hintSlot);
      const placed = s.picks[side].find((p) => p.name === name);
      if (!placed) return { ok: false, error: "Placement impossible." };
      resyncStepIndex(s);
      s.updatedAt = Date.now();
      invalidateRecommendationCache();
      return { ok: true, slot: placed.slot };
    }
    resyncStepIndex(s);
    s.updatedAt = Date.now();
    invalidateRecommendationCache();
    return { ok: true };
  }

  function recordAction(s, action, all = [], ctx = {}) {
    const step = getStep(s);
    if (step && step.type === action.type && step.side === action.side && !action.forceManual) {
      const result = applyAction(
        s,
        { championName: action.name, slot: action.slot, banIndex: action.banIndex },
        all,
        ctx
      );
      if (result.ok && action.type === "pick") {
        result.slot = s.picks[action.side]?.find((p) => p.name === action.name)?.slot;
      }
      return result;
    }
    return manualAssign(s, action, all, ctx);
  }

  function suggestNextFocus(s, byName, meta, all = []) {
    normalizeSession(s);
    if (isComplete(s)) { s.focus = null; return null; }
    const step = getStep(s);
    if (!step) return null;
    if (step.type === "ban") {
      const max = s.bansPerTeam === 2 ? 2 : 3;
      for (let i = 0; i < max; i++) {
        if (!s.bans[step.side][i]) {
          s.focus = { type: "ban", side: step.side, banIndex: i };
          return s.focus;
        }
      }
    } else {
      const open = openSlots(s, step.side);
      const hinted =
        s.focus?.type === "pick" && s.focus.side === step.side && s.focus.slot && open.includes(s.focus.slot)
          ? s.focus.slot
          : null;
      const slot = hinted || (byName && meta ? suggestSlot(s, step.side, meta, byName, all) : open[0]);
      s.focus = { type: "pick", side: step.side, slot: slot || undefined };
      return s.focus;
    }
    s.focus = null;
    return null;
  }

  function syncLegacySlots(s) {
    if (!s.focus || s.focus.type !== "pick" || s.focus.slot) return;
    const side = s.focus.side;
    const open = openSlots(s, side);
    if (!open.length) return;
    if (side === ourSide(s)) s.activeSlot = open[0];
    else s.enemyActiveSlot = open[0];
  }

  function getDraftCoachHint(s, side, byName, meta, all = []) {
    const GE = guideEngine();
    const step = getStep(s);
    const allies = sidePicks(s, side).map((p) => p.name);
    const oppNames = sidePicks(s, side === "blue" ? "red" : "blue").map((p) => p.name);
    const g = guideCtx(s, side, all, byName, meta);

    if (GE?.coachDraftHint) {
      try {
        const guideHint = GE.coachDraftHint({
          ourNames: allies,
          enemyNames: oppNames,
          phase: draftPhase(s),
          stepType: step?.type,
          takenNames: g.takenNames,
          sessionIndex: g.sessionIndex,
          banCount: g.banCount,
          playerTraits: g.playerTraits,
        });
        if (guideHint) return guideHint;
      } catch (err) {
        console.warn("getDraftCoachHint guide", err);
      }
    }

    return GE?.GUIDE?.()?.banPhilosophy?.principle || "Draft guide Early Access — shells & menaces";
  }

  function actionLabel(s, byName, meta, all = []) {
    let base;
    const f = s.focus;
    if (f) {
      const fr = f.side === "blue" ? "Bleu" : "Rouge";
      if (f.type === "ban") base = `Ban ${fr} → champion`;
      else if (f.type === "swap") {
        const sl = f.slot ? (SLOT_LABELS[f.slot] || f.slot) : "";
        base = isComplete(s)
          ? `Échanger (${fr}) — ${sl} → choisis le 2e poste`
          : `Swap ${fr} · ${sl} → 2e poste`;
      } else {
        const sl = f.slot ? (SLOT_LABELS[f.slot] || f.slot) : "";
        base = sl ? `Pick ${fr} · ${sl} → champion` : `Pick ${fr} → choisis un poste puis un champion`;
      }
    } else if (isComplete(s)) {
      base = "Draft terminée — clique deux postes (même équipe) pour échanger";
    } else {
      const step = getStep(s);
      if (!step) return null;
      base = step.type === "pick" ? "Pick → champion" : "Ban → champion";
    }
    if (byName && meta && !isComplete(s)) {
      const step = getStep(s);
      const side = f?.side || step?.side;
      if (side && (step?.type === "pick" || step?.type === "ban")) {
        try {
          const hint = getDraftCoachHint(s, side, byName, meta, all);
          if (hint) return `${base} · ${hint}`;
        } catch (err) {
          console.warn("actionLabel coach hint", err);
        }
      }
    }
    return base;
  }

  function suggestSlot(s, side, meta, byName, all = []) {
    const GE = guideEngine();
    const g = guideCtx(s, side, all, byName, meta);
    const open = openSlots(s, side);
    if (!GE || !open.length) return open[0] || "Top";
    const rec = GE.recommendShell(g.oppNames, g.ourNames, g);
    const next = GE.nextPickInOrder(rec.shell, g.ourNames);
    if (next) {
      const slot = GE.slotForChampion(rec.shell, next);
      if (slot && open.includes(slot)) return slot;
    }
    return open[0] || "Top";
  }

  function resolvePickSlot(s, side, name, byName, meta, hint, obj) {
    const c = obj || { name };
    return scorePick(c, s, side, byName, meta, hint).slot;
  }

  function bestSlotForChampion(c, s, side, meta, hint) {
    return resolvePickSlot(s, side, c?.name, null, meta, hint, c);
  }

  function toComps(s) {
    const fill = (m) => {
      const o = {};
      for (const sl of SLOTS) o[sl] = m[sl] || "";
      return o;
    };
    return {
      ourComp: fill(pickBySlot(s, ourSide(s))),
      enemyComp: fill(pickBySlot(s, enemySide(s))),
    };
  }

  function analyzeLive(s, meta, byName, all = []) {
    const GE = guideEngine();
    const our = sidePicks(s, ourSide(s)).map((p) => p.name);
    const en = sidePicks(s, enemySide(s)).map((p) => p.name);
    const notes = [];
    const g = guideCtx(s, ourSide(s), all, byName, meta);

    if (GE?.analyzeShellMatchup) {
      try {
        const shell = GE.analyzeShellMatchup(our, en, {
          takenNames: g.takenNames,
          sessionIndex: g.sessionIndex,
          banCount: g.banCount,
        });
        notes.push(...(shell.notes || []).slice(0, 5));
        if (shell.checklist?.items?.length) {
          const chk = shell.checklist.items
            .map((i) => `${i.ok ? "✓" : "○"} ${i.labelFr}`)
            .join(" · ");
          notes.push(`Checklist: ${chk}`);
        }
      } catch (err) {
        console.warn("analyzeLive shell", err);
      }
    }
    return { ourTags: [], enemyTags: [], notes: notes.slice(0, 9) };
  }

  function stepLabel(s) {
    const steps = getSteps(s);
    const st = steps[s.stepIndex];
    if (!st) return "Draft terminé";
    const side = st.side === "blue" ? "Bleu" : "Rouge";
    const bans = steps.filter((x) => x.type === "ban").length;
    if (st.type === "ban") return `Ban ${s.stepIndex + 1}/${bans} — ${side}`;
    return `Pick ${s.stepIndex - bans + 1}/${steps.filter((x) => x.type === "pick").length} — ${side}`;
  }

  function formatSummary(s) {
    normalizeSession(s);
    return [`${s.bansPerTeam} bans/équipe · draft TFM2`, s.fearless ? "Fearless" : null].filter(Boolean).join(" · ");
  }

  global.TFM2Draft = {
    SLOTS,
    PICK_STEPS,
    PLAN_VS_ENEMY,
    ENEMY_PLAN_ANSWERS,
    SLOT_BUFF,
    COMP_PLANS,
    buildDraftSteps,
    normalizeSession,
    createSession,
    getSteps,
    totalSteps,
    getStep,
    isComplete,
    fearlessUsedNames: fearlessUsed,
    takenNames: taken,
    availableChampions: available,
    sidePicks,
    pickBySlot,
    ourSide,
    enemySide,
    isOurTurn,
    canEditFormat,
    suggestSlot,
    bestSlotForChampion,
    resolvePickSlot,
    relayoutAllPickSlots: relayoutAll,
    optimizeTeamLayout: optimizeLayout,
    getRecommendations,
    invalidateRecommendationCache,
    getDraftCoachHint,
    applyAction,
    recordAction,
    manualAssign,
    actionLabel,
    suggestNextFocus,
    syncLegacySlots,
    resyncStepIndex,
    undo,
    resetSession,
    swapPickSlots,
    toComps,
    analyzeLive,
    stepLabel,
    formatSummary,
    scorePick: (c, s, side, slot, meta, byName) => scorePick(c, s, side, byName, meta, slot),
    scoreBan,
    evaluateTeam,
    phaseWeights,
    draftPhase,
    compareComps,
    teamColorSummary,
    MTG_COLORS,
    COLOR_LABELS,
    COLOR_HEX,
  };
})(typeof window !== "undefined" ? window : globalThis);
