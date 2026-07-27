/**
 * TFM2 Draft Engine v1 (reconstruit) — façade `TFM2Draft`.
 *
 * Rôle : gérer la SESSION de draft (ordre snake, bans, picks, postes, undo) et
 * déléguer TOUTE la notation à `TFM2DraftModel` (couche unique, groundée).
 *
 * Différences clés vs l'ancien moteur :
 *   - plus de « blind pick » LoL forcé (ADC en B1, Top/Support counter-only) ;
 *   - plus d'optimiseur de placement exponentiel (`bestLayout`) ni de « relayout » ;
 *     le poste est choisi par l'utilisateur, avec un défaut = poste optimal si libre ;
 *   - plus de MTG dans le score ; plus de listes de champions codées en dur.
 *
 * Format : 3 bans / équipe en amont puis snake 5v5 (source : guide « Early Access »),
 * nombre de bans configurable (2 ou 3).
 * Marche en navigateur (window.TFM2Draft) et sous Node (module.exports).
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof root !== "undefined") root.TFM2Draft = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  function pick(name) {
    if (root && root[name]) return root[name];
    try {
      return require("./" + ({ TFM2DraftData: "draft-data", TFM2DraftModel: "draft-model" }[name]));
    } catch (e) {
      return null;
    }
  }
  const Data = () => pick("TFM2DraftData");
  const Model = () => pick("TFM2DraftModel");

  const SLOTS = ["Top", "Jungle", "Mid", "Bot", "Support"];
  const SLOT_LABELS = { Top: "Top", Jungle: "Jungle", Mid: "Mid", Bot: "ADC", Support: "Support" };

  // Ordre snake 5v5 des picks (10 picks), après la phase de bans.
  const PICK_STEPS = [
    { type: "pick", side: "blue" }, { type: "pick", side: "red" },
    { type: "pick", side: "red" }, { type: "pick", side: "blue" },
    { type: "pick", side: "blue" }, { type: "pick", side: "red" },
    { type: "pick", side: "red" }, { type: "pick", side: "blue" },
    { type: "pick", side: "blue" }, { type: "pick", side: "red" },
  ];

  let configured = false;

  /** Initialise la couche de données (une fois) : champions = TOUS les champions. */
  function configure(opts = {}) {
    const D = Data(), M = Model();
    if (!D || !M) throw new Error("TFM2Draft.configure: modules draft-data/draft-model absents.");
    D.init({ champions: opts.champions, guide: opts.guide });
    M.useData(D);
    configured = true;
    return configured;
  }
  function ensureData(fallbackChampions) {
    if (!configured && fallbackChampions) configure({ champions: fallbackChampions, guide: null });
  }

  // ---- Session ---------------------------------------------------------------
  function createSession(name, ourSide = "blue", opts = {}) {
    return normalizeSession({
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name || "Draft",
      ourSide: ourSide === "red" ? "red" : "blue",
      bansPerTeam: opts.bansPerTeam === 2 ? 2 : 3,
      fearless: Boolean(opts.fearless),
      stepIndex: 0,
      bans: { blue: [], red: [] },
      picks: { blue: [], red: [] },
      focus: null,
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  function normalizeSession(s) {
    if (!s) return s;
    if (s.bansPerTeam !== 2 && s.bansPerTeam !== 3) s.bansPerTeam = 3;
    if (typeof s.fearless !== "boolean") s.fearless = false;
    if (!s.bans) s.bans = { blue: [], red: [] };
    if (!s.picks) s.picks = { blue: [], red: [] };
    if (!Array.isArray(s.history)) s.history = [];
    const max = s.bansPerTeam;
    for (const side of ["blue", "red"]) {
      const c = (s.bans[side] || []).filter(Boolean);
      s.bans[side] = Array.from({ length: max }, (_, i) => c[i] || null);
      s.picks[side] = (s.picks[side] || []).filter((p) => p && p.name);
    }
    if (s.focus === undefined) s.focus = null;
    return s;
  }

  function buildDraftSteps(bansPerTeam = 3) {
    const steps = [];
    for (let i = 0; i < bansPerTeam * 2; i++) steps.push({ type: "ban", side: i % 2 === 0 ? "blue" : "red" });
    return steps.concat(PICK_STEPS);
  }
  const getSteps = (s) => buildDraftSteps(normalizeSession(s).bansPerTeam);
  const totalSteps = (s) => getSteps(s).length;
  const getStep = (s) => getSteps(s)[s.stepIndex] || null;
  const isComplete = (s) => s && s.stepIndex >= totalSteps(s);

  const ourSide = (s) => s.ourSide;
  const enemySide = (s) => (s.ourSide === "blue" ? "red" : "blue");
  const isOurTurn = (s) => { const st = getStep(s); return st && st.side === ourSide(s); };
  const canEditFormat = (s) => s.stepIndex === 0;
  const sidePicks = (s, side) => s.picks[side] || [];
  const sidePickCount = (s, side) => sidePicks(s, side).length;

  function pickBySlot(s, side) {
    const m = {};
    for (const p of sidePicks(s, side)) if (p.slot) m[p.slot] = p.name;
    return m;
  }
  const openSlots = (s, side) => SLOTS.filter((sl) => !pickBySlot(s, side)[sl]);

  function draftPhase(s) {
    const d = sidePickCount(s, "blue") + sidePickCount(s, "red");
    if (d <= 2) return "opening";
    if (d <= 6) return "core";
    return "closing";
  }

  // ---- Disponibilité ---------------------------------------------------------
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
  /** Champions disponibles : pool (noms) − pris. `pool` défaut = tout le roster. */
  function availableNames(s, pool, all = []) {
    const t = taken(s, all);
    const base = pool && pool.length ? pool : Data().names();
    return base.filter((n) => !t.has(n));
  }

  // ---- Enregistrement des actions -------------------------------------------
  function snapshot(s) {
    s.history.push(JSON.stringify({ stepIndex: s.stepIndex, bans: s.bans, picks: s.picks }));
    if (s.history.length > 40) s.history.shift();
  }
  function clearFromBoard(s, name) {
    for (const side of ["blue", "red"]) {
      s.bans[side] = s.bans[side].map((n) => (n === name ? null : n));
      s.picks[side] = s.picks[side].filter((p) => p.name !== name);
    }
  }

  /**
   * Réassigne dynamiquement les postes d'un côté selon la logique de draft :
   * chaque champion NON épinglé va à son meilleur poste (buff + matchup de lane
   * vs la comp adverse). Les postes épinglés (pinned) restent fixes.
   */
  function reoptimizeSide(s, side) {
    const picks = sidePicks(s, side);
    if (!picks.length) return;
    const names = picks.map((p) => p.name);
    const pinned = {};
    const pinFlag = {};
    for (const p of picks) { pinFlag[p.name] = !!p.pinned; if (p.pinned && p.slot) pinned[p.name] = p.slot; }
    const enemyComp = pickBySlot(s, side === "blue" ? "red" : "blue");
    const { assignment } = Model().bestAssignment(names, enemyComp, pinned);
    if (assignment && assignment.length) {
      s.picks[side] = assignment.map((a) => ({ name: a.name, slot: a.slot, pinned: pinFlag[a.name] || false }));
    }
  }
  function reoptimizeAll(s) {
    // deux passes : la 2e stabilise les matchups de lane croisés entre côtés.
    for (let i = 0; i < 2; i++) { reoptimizeSide(s, "blue"); reoptimizeSide(s, "red"); }
  }
  function togglePin(s, side, name) {
    const p = sidePicks(s, side).find((x) => x.name === name);
    if (!p) return false;
    p.pinned = !p.pinned;
    if (!p.pinned) reoptimizeAll(s);
    s.updatedAt = Date.now();
    return p.pinned;
  }

  function applyAction(s, action, all = []) {
    normalizeSession(s);
    const step = getStep(s);
    if (!step) return { ok: false, error: "Draft terminé." };
    const name = action.championName || action.name;
    if (!name) return { ok: false, error: "Champion manquant." };
    if (taken(s, all).has(name)) {
      return { ok: false, error: s.fearless ? "Indisponible (fearless)." : "Déjà pris ou banni." };
    }
    snapshot(s);
    if (step.type === "ban") {
      const idx = action.banIndex ?? s.bans[step.side].findIndex((n) => !n);
      if (idx < 0 || idx >= s.bansPerTeam) return { ok: false, error: "Bans pleins." };
      s.bans[step.side][idx] = name;
    } else {
      if (sidePickCount(s, step.side) >= 5) return { ok: false, error: "Picks pleins." };
      const open = openSlots(s, step.side);
      const userSlot = action.slot && open.includes(action.slot) ? action.slot : null;
      const slot = userSlot || Model().bestSlotFor(name, open);
      s.picks[step.side] = sidePicks(s, step.side).concat([{ name, slot, pinned: Boolean(action.pin && userSlot) }]);
      reoptimizeAll(s);
    }
    s.stepIndex++;
    s.updatedAt = Date.now();
    if (step.type === "pick") {
      return { ok: true, slot: sidePicks(s, step.side).find((p) => p.name === name)?.slot };
    }
    return { ok: true };
  }

  /** Assignation manuelle libre (hors ordre) — édition d'un board déjà rempli. */
  function manualAssign(s, action, all = []) {
    normalizeSession(s);
    const { type, side, name, slot, banIndex } = action;
    snapshot(s);
    if (!name) {
      if (type === "ban" && banIndex != null) s.bans[side][banIndex] = null;
      else if (type === "pick" && slot) s.picks[side] = s.picks[side].filter((p) => p.slot !== slot);
      resyncStepIndex(s);
      s.updatedAt = Date.now();
      return { ok: true };
    }
    if (taken(s, all).has(name) && !s.bans[side].includes(name) && !sidePicks(s, side).some((p) => p.name === name)) {
      s.history.pop();
      return { ok: false, error: "Indisponible." };
    }
    clearFromBoard(s, name);
    if (type === "ban") {
      const idx = banIndex ?? s.bans[side].findIndex((n) => !n);
      if (idx < 0 || idx >= s.bansPerTeam) { s.history.pop(); return { ok: false, error: "Bans pleins." }; }
      s.bans[side][idx] = name;
    } else {
      if (sidePickCount(s, side) >= 5) { s.history.pop(); return { ok: false, error: "Picks pleins." }; }
      const open = openSlots(s, side);
      const userSlot = slot && open.includes(slot) ? slot : null;
      const target = userSlot || Model().bestSlotFor(name, open);
      // Placement manuel dans un poste précis = épinglé (choix explicite de l'utilisateur).
      s.picks[side] = sidePicks(s, side).concat([{ name, slot: target, pinned: Boolean(userSlot) }]);
      reoptimizeAll(s);
    }
    resyncStepIndex(s);
    s.updatedAt = Date.now();
    return { ok: true, slot: sidePicks(s, side).find((p) => p.name === name)?.slot };
  }

  function recordAction(s, action, all = []) {
    const step = getStep(s);
    if (step && step.type === action.type && step.side === action.side && !action.forceManual) {
      return applyAction(s, { championName: action.name, slot: action.slot, banIndex: action.banIndex }, all);
    }
    return manualAssign(s, action, all);
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

  function undo(s) {
    if (!s.history.length) return false;
    Object.assign(s, JSON.parse(s.history.pop()));
    s.updatedAt = Date.now();
    return true;
  }
  function resetSession(s) {
    s.stepIndex = 0;
    s.bans = { blue: [], red: [] };
    s.picks = { blue: [], red: [] };
    s.history = [];
    s.focus = null;
    s.updatedAt = Date.now();
  }
  function swapPickSlots(s, side, a, b) {
    normalizeSession(s);
    if (a === b) return { ok: false, error: "Même poste." };
    const comp = pickBySlot(s, side);
    if (!comp[a] && !comp[b]) return { ok: false, error: "Postes vides." };
    snapshot(s);
    s.picks[side] = s.picks[side].filter((p) => p.slot !== a && p.slot !== b);
    // Échange manuel = les deux postes deviennent épinglés (choix utilisateur).
    if (comp[b]) s.picks[side].push({ name: comp[b], slot: a, pinned: true });
    if (comp[a]) s.picks[side].push({ name: comp[a], slot: b, pinned: true });
    s.updatedAt = Date.now();
    return { ok: true };
  }

  // ---- Recommandations -------------------------------------------------------
  function focusSlotForPick(s, side) {
    if (s.focus && s.focus.type === "pick" && s.focus.side === side && s.focus.slot) return s.focus.slot;
    return null;
  }

  /**
   * Recommandations pour l'étape courante.
   * opts.pool : noms jouables (patch/pool perso) ; opts.hintSlot : poste ciblé.
   */
  function getRecommendations(s, side, opts = {}) {
    normalizeSession(s);
    const D = Data(), M = Model();
    const step = getStep(s);
    const all = opts.allSessions || [];
    const avail = availableNames(s, opts.pool, all);
    const allies = sidePicks(s, side).map((p) => p.name);
    const enemies = sidePicks(s, side === "blue" ? "red" : "blue").map((p) => p.name);
    const phase = draftPhase(s);

    if (step && step.type === "ban") {
      const ourNames = sidePicks(s, ourSide(s)).map((p) => p.name);
      const enemyNames = sidePicks(s, enemySide(s)).map((p) => p.name);
      const items = avail
        .map((n) => { const r = M.scoreBan(n, { ourNames, enemyNames, phase }); return { name: n, champion: D.get(n), score: r.score, reasons: r.reasons }; })
        .sort((a, b) => b.score - a.score)
        .slice(0, opts.limit || 12);
      return { type: "ban", side, items, coachHint: banHint(s, side), plan: null };
    }

    const hintSlot = opts.hintSlot || focusSlotForPick(s, side);
    const open = openSlots(s, side);
    const items = avail
      .map((n) => {
        const r = M.scorePick(n, { allies, enemies, slot: hintSlot && open.includes(hintSlot) ? hintSlot : null, openSlots: open, phase });
        return { name: n, champion: D.get(n), score: r.score, slot: r.slot, reasons: r.reasons, warnings: r.warnings };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.limit || 12);

    return {
      type: "pick",
      side,
      slot: hintSlot || (items[0] && items[0].slot) || open[0] || null,
      items,
      coachHint: pickHint(s, side, allies, enemies),
      plan: livePlan(s, side),
    };
  }

  function pickHint(s, side, allies, enemies) {
    const M = Model();
    const lead = M.detectShell(allies);
    const parts = [];
    if (lead) parts.push(`Plan : ${lead.shell.label}`);
    const carry = allies.find((a) => M.isFragileCarry(a));
    if (carry && !allies.some((a) => M.providesProtection(a))) parts.push(`Pense à protéger ${carry}`);
    if (!allies.length) parts.push("Ouverture : champion flexible, fort et difficile à contrer");
    return parts.join(" · ") || "Meilleur pick pour le poste et la comp";
  }
  function banHint(s, side) {
    return "Ban ce qui counter notre plan ou complète un duo adverse fort";
  }

  // ---- Analyse live ----------------------------------------------------------
  function toComps(s) {
    const fill = (m) => { const o = {}; for (const sl of SLOTS) o[sl] = m[sl] || ""; return o; };
    return { ourComp: fill(pickBySlot(s, ourSide(s))), enemyComp: fill(pickBySlot(s, enemySide(s))) };
  }
  function slotOf(s, side) {
    const m = {};
    for (const p of sidePicks(s, side)) if (p.slot) m[p.name] = p.slot;
    return m;
  }
  function livePlan(s, side) {
    const M = Model();
    const our = sidePicks(s, side).map((p) => p.name);
    const enemy = sidePicks(s, side === "blue" ? "red" : "blue").map((p) => p.name);
    if (!our.length) return null;
    const lead = M.detectShell(our);
    return {
      shell: lead ? lead.shell.label : null,
      win: our.length && enemy.length ? M.winEstimate(our, enemy, slotOf(s, side), slotOf(s, side === "blue" ? "red" : "blue")) : null,
    };
  }
  /** Comparaison de deux comps complètes → estimation (remplace l'ancien win% bidon). */
  function compareComps(ourComp, enemyComp) {
    const M = Model();
    const our = SLOTS.map((sl) => ourComp[sl]).filter(Boolean);
    const enemy = SLOTS.map((sl) => enemyComp[sl]).filter(Boolean);
    if (our.length < 5 || enemy.length < 5) return { complete: false, ourCount: our.length, enemyCount: enemy.length };
    const invert = (comp) => { const o = {}; for (const sl of SLOTS) if (comp[sl]) o[comp[sl]] = sl; return o; };
    const win = M.winEstimate(our, enemy, invert(ourComp), invert(enemyComp));
    return { complete: true, win, margin: win.margin };
  }
  function analyzeLive(s) {
    const M = Model();
    const our = sidePicks(s, ourSide(s)).map((p) => p.name);
    const enemy = sidePicks(s, enemySide(s)).map((p) => p.name);
    const notes = [];
    const lead = M.detectShell(our);
    if (lead) notes.push(`Identité : ${lead.shell.label}`);
    const carry = our.find((a) => M.isFragileCarry(a));
    if (carry && !our.some((a) => M.providesProtection(a))) notes.push(`Carry ${carry} sans protection`);
    if (our.length && enemy.length) {
      const w = M.winEstimate(our, enemy, slotOf(s, ourSide(s)), slotOf(s, enemySide(s)));
      notes.push(`${w.verdict} (${Math.round(w.ourPct * 100)}%, estimation)`);
    }
    return { notes: notes.slice(0, 6) };
  }

  function bestSlotForChampion(name, s, side) {
    return Model().bestSlotFor(name, openSlots(s, side));
  }

  function suggestNextFocus(s) {
    normalizeSession(s);
    if (isComplete(s)) { s.focus = null; return null; }
    const step = getStep(s);
    if (!step) return null;
    if (step.type === "ban") {
      const idx = s.bans[step.side].findIndex((n) => !n);
      s.focus = { type: "ban", side: step.side, banIndex: idx < 0 ? 0 : idx };
    } else {
      // Poste NON forcé par défaut : les conseils sont dynamiques (meilleur pick,
      // chaque champion à son meilleur poste ouvert). Un poste n'est ciblé que si
      // l'utilisateur clique explicitement une case (onCellClick).
      const open = openSlots(s, step.side);
      const keep = s.focus && s.focus.type === "pick" && s.focus.side === step.side && open.includes(s.focus.slot) ? s.focus.slot : null;
      s.focus = { type: "pick", side: step.side, slot: keep };
    }
    return s.focus;
  }

  function stepLabel(s) {
    const steps = getSteps(s);
    const st = steps[s.stepIndex];
    if (!st) return "Draft terminée";
    const side = st.side === "blue" ? "Bleu" : "Rouge";
    const bans = steps.filter((x) => x.type === "ban").length;
    if (st.type === "ban") return `Ban ${s.stepIndex + 1}/${bans} — ${side}`;
    return `Pick ${s.stepIndex - bans + 1}/${steps.filter((x) => x.type === "pick").length} — ${side}`;
  }
  function formatSummary(s) {
    normalizeSession(s);
    return [`${s.bansPerTeam} bans · snake 5v5`, s.fearless ? "Fearless" : null].filter(Boolean).join(" · ");
  }

  return {
    SLOTS,
    SLOT_LABELS,
    PICK_STEPS,
    configure,
    ensureData,
    isConfigured: () => configured,
    createSession,
    normalizeSession,
    buildDraftSteps,
    getSteps,
    totalSteps,
    getStep,
    isComplete,
    ourSide,
    enemySide,
    isOurTurn,
    canEditFormat,
    sidePicks,
    pickBySlot,
    openSlots,
    draftPhase,
    takenNames: taken,
    availableNames,
    applyAction,
    manualAssign,
    recordAction,
    resyncStepIndex,
    undo,
    resetSession,
    swapPickSlots,
    reoptimizeAll,
    togglePin,
    getRecommendations,
    bestSlotForChampion,
    suggestNextFocus,
    toComps,
    compareComps,
    analyzeLive,
    stepLabel,
    formatSummary,
  };
});
