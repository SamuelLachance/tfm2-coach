/**
 * TFM2 Draft UI — case + pool (style drafting.gg). v2 perf.
 */
(function () {
  const STORAGE_KEY = "tfm2-draft-sessions-v1";
  const SLOT_ICONS = { Top: "▣", Jungle: "🔥", Mid: "⚡", Bot: "◎", Support: "✚" };

  let coach = null;
  let saveTimer = null;

  function saveSessionsDebounced() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSessions, 120);
  }

  function flushSaveSessions() {
    clearTimeout(saveTimer);
    saveSessions();
  }

  function loadSessions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { sessions: [], activeId: null };
      const parsed = JSON.parse(raw);
      return {
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        activeId: parsed.activeId || null,
      };
    } catch {
      return { sessions: [], activeId: null };
    }
  }

  function saveSessions() {
    coach.state.draftSessions.forEach((s) => window.TFM2Draft.normalizeSession(s));
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        sessions: coach.state.draftSessions,
        activeId: coach.state.activeDraftId,
      })
    );
  }

  function getActiveSession() {
    return coach.state.draftSessions.find((s) => s.id === coach.state.activeDraftId) || null;
  }

  function ensureSessions() {
    if (!coach.state.draftSessions.length) {
      const s = window.TFM2Draft.createSession("Game 1");
      coach.state.draftSessions = [s];
      coach.state.activeDraftId = s.id;
      saveSessions();
    }
  }

  function allSessions() {
    return coach.state.draftSessions;
  }

  function renderAll() {
    try {
      const session = getActiveSession();
      if (session && !window.TFM2Draft.isComplete(session)) {
        const step = window.TFM2Draft.getStep(session);
        const focus = session.focus;
        const staleFocus =
          !focus ||
          !step ||
          focus.type !== step.type ||
          focus.side !== step.side;
        if (staleFocus) {
          window.TFM2Draft.suggestNextFocus(session, coach.state.byName, draftMetaMap());
        }
      }
      renderSessionBar();
      renderBoard();
      renderPool();
    } catch (err) {
      console.error("TFM2DraftUI.renderAll", err);
      showDraftError("Erreur affichage draft — recharge la page (F5).");
    }
  }

  function showDraftError(msg) {
    showDraftFlash(msg, "error");
  }

  function setFocus(session, focus) {
    session.focus = focus;
    window.TFM2Draft.syncLegacySlots(session);
    saveSessionsDebounced();
  }

  function draftMetaMap() {
    return coach.state.tacticsMeta?.champions || {};
  }

  function syncBoardFocus(session) {
    const el = coach.els.draftBoard;
    if (!el?.querySelector(".draft-cell")) {
      renderBoard();
      return;
    }

    el.querySelectorAll(".draft-cell-focused").forEach((c) => c.classList.remove("draft-cell-focused"));
    el.querySelectorAll(".draft-cell-swap-target").forEach((c) => c.classList.remove("draft-cell-swap-target"));

    el.querySelectorAll(".draft-cell[data-focus-type]").forEach((cell) => {
      const type = cell.dataset.focusType;
      const side = cell.dataset.side;
      const banIndex = type === "ban" ? parseInt(cell.dataset.banIndex, 10) : null;
      const slot = cell.dataset.slot || null;
      if (isCellFocused(session, type, side, banIndex, slot)) {
        cell.classList.add("draft-cell-focused");
      }
      if (type === "pick" && isSwapTarget(session, side, slot)) {
        cell.classList.add("draft-cell-swap-target");
      }
    });

    const turnBox = el.querySelector(".draft-turn-box");
    if (turnBox) {
      const spans = turnBox.querySelectorAll("span");
      const focusHint = window.TFM2Draft.actionLabel(session, coach.state.byName, draftMetaMap(), allSessions());
      const hintSpan = spans[spans.length - 1];
      if (hintSpan && focusHint) hintSpan.textContent = focusHint;
    }
  }

  function syncPoolFocus(session) {
    const el = coach.els.draftPool;
    if (!el) return;
    const actionText = window.TFM2Draft.actionLabel(session, coach.state.byName, draftMetaMap(), allSessions());
    const actionEl = el.querySelector(".draft-pool-action");
    if (actionEl) {
      actionEl.textContent = actionText || "";
      actionEl.classList.toggle("focus-ready", Boolean(session.focus));
    }
  }

  function afterFocusChange(session) {
    window.TFM2Draft.invalidateRecommendationCache();
    syncBoardFocus(session);
    syncPoolFocus(session);
    fillSuggestChips(session, getSessionRecommendations(session, 6));
  }

  function isCellFocused(session, type, side, banIndex, slot) {
    const f = session.focus;
    if (!f || f.side !== side) return false;
    if (f.type === "swap" && type === "pick") return f.slot === slot;
    if (f.type !== type) return false;
    if (type === "ban") return f.banIndex === banIndex;
    if (f.slot) return f.slot === slot;
    const comp = window.TFM2Draft.pickBySlot(session, side);
    return !comp[slot];
  }

  function isSwapTarget(session, side, slot) {
    const f = session.focus;
    if (f?.type !== "swap" || f.side !== side || f.slot === slot) return false;
    const comp = window.TFM2Draft.pickBySlot(session, side);
    return Boolean(comp[f.slot] || comp[slot]);
  }

  function showDraftFlash(msg, kind = "success") {
    const el = coach.els.draftFlash;
    if (!el) return;
    el.classList.remove("error", "success");
    el.classList.add("visible", kind);
    el.textContent = msg;
    setTimeout(() => el.classList.remove("visible", "error", "success"), kind === "error" ? 2800 : 1800);
  }

  function handlePickCellClick(session, side, slot) {
    const comp = window.TFM2Draft.pickBySlot(session, side);
    const focus = session.focus;

    if (focus?.type === "swap" && focus.side === side) {
      if (focus.slot === slot) {
        session.focus = null;
      } else {
        const result = window.TFM2Draft.swapPickSlots(session, side, focus.slot, slot);
        if (!result.ok) showDraftFlash(result.error, "error");
        else showDraftFlash(result.message || "Postes échangés", "success");
        session.focus = null;
      }
      saveSessionsDebounced();
      renderAll();
      return;
    }

    if (comp[slot]) {
      session.focus = { type: "swap", side, slot };
      saveSessionsDebounced();
      renderAll();
      return;
    }

    if (window.TFM2Draft.isComplete(session)) {
      showDraftFlash("Draft terminée — sélectionne un champion déjà placé pour le déplacer.", "error");
      return;
    }

    session.focus = { type: "pick", side, slot };
    saveSessionsDebounced();
    afterFocusChange(session);
  }

  function draftCtx() {
    return {
      byName: coach.state.byName,
      metaMap: coach.state.tacticsMeta?.champions || {},
    };
  }

  function recordChampionAction(payload) {
    const session = getActiveSession();
    if (!session || window.TFM2Draft.isComplete(session)) return false;
    const result = window.TFM2Draft.recordAction(session, payload, allSessions(), draftCtx());
    if (!result.ok) {
      showDraftError(result.error);
      return false;
    }
    if (payload.type === "pick" && result.slot) {
      showDraftFlash(`${payload.name} → ${result.slot}`, "success");
    }
    window.TFM2Draft.suggestNextFocus(session, coach.state.byName, draftMetaMap());
    flushSaveSessions();
    renderAll();
    return true;
  }

  function pickChampion(name, opts = {}) {
    const session = getActiveSession();
    if (!session || window.TFM2Draft.isComplete(session)) return;

    const step = window.TFM2Draft.getStep(session);
    if (!step) {
      showDraftError("Draft terminée.");
      return;
    }

    if (step.type === "ban") {
      if (!session.focus || session.focus.type !== "ban" || session.focus.side !== step.side) {
        window.TFM2Draft.suggestNextFocus(session, coach.state.byName, draftMetaMap());
      }
      if (!session.focus || session.focus.type !== "ban") {
        showDraftError("Sélectionne une case ban, puis le champion.");
        return;
      }
    } else {
      const slotHint =
        opts.slot ||
        (session.focus?.type === "pick" && session.focus.side === step.side ? session.focus.slot : undefined);
      session.focus = {
        type: "pick",
        side: step.side,
        ...(slotHint ? { slot: slotHint } : {}),
      };
    }

    if (session.focus?.type === "swap") {
      showDraftError("Mode swap actif — clique un autre poste pour échanger.");
      return;
    }

    recordChampionAction({
      type: step.type,
      side: step.side,
      name,
      slot: step.type === "pick" ? session.focus?.slot || opts.slot || null : null,
      banIndex: step.type === "ban" ? session.focus?.banIndex ?? null : null,
    });
  }

  function renderSessionBar() {
    const el = coach.els.draftSessionBar;
    if (!el) return;
    const session = getActiveSession();
    if (!session) {
      el.innerHTML = `<p class="muted">Aucune session draft — clique « + Nouvelle ».</p>`;
      return;
    }
    window.TFM2Draft.normalizeSession(session);
    const canEdit = window.TFM2Draft.canEditFormat(session);
    const total = window.TFM2Draft.totalSteps(session);
    const options = coach.state.draftSessions
      .map(
        (s) =>
          `<option value="${coach.escapeHtml(s.id)}"${s.id === coach.state.activeDraftId ? " selected" : ""}>${coach.escapeHtml(s.name)}</option>`
      )
      .join("");

    el.innerHTML = `
      <div class="draft-session-controls">
        <select id="draft-session-select" class="draft-select-compact" aria-label="Choisir la partie">${options}</select>
        <button type="button" class="btn-secondary btn-sm" id="draft-new-game">+ Nouvelle</button>
        <button type="button" class="btn-secondary btn-sm" id="draft-rename-game" title="Renommer">✎</button>
      </div>
      <div class="draft-side-toggle">
        <span class="draft-side-label">Nous sommes</span>
        <button type="button" class="side-chip${session.ourSide === "blue" ? " active" : ""}" data-side="blue"${canEdit ? "" : " disabled"}>Bleu</button>
        <button type="button" class="side-chip side-red${session.ourSide === "red" ? " active" : ""}" data-side="red"${canEdit ? "" : " disabled"}>Rouge</button>
      </div>
      <div class="draft-format-options">
        <label class="draft-option-check" title="Picks des games précédentes indisponibles">
          <input type="checkbox" id="draft-fearless"${session.fearless ? " checked" : ""}${canEdit ? "" : " disabled"} />
          <span>Fearless</span>
        </label>
        <div class="draft-ban-toggle">
          <span class="draft-side-label">Bans</span>
          <button type="button" class="ban-chip${session.bansPerTeam === 2 ? " active" : ""}" data-bans="2"${canEdit ? "" : " disabled"}>2</button>
          <button type="button" class="ban-chip${session.bansPerTeam !== 2 ? " active" : ""}" data-bans="3"${canEdit ? "" : " disabled"}>3</button>
        </div>
      </div>
      <div class="draft-progress-wrap">
        <div class="draft-step-label">${coach.escapeHtml(window.TFM2Draft.stepLabel(session))}</div>
        <div class="draft-progress"><div class="draft-progress-fill" style="width:${Math.round(((session.stepIndex || 0) / total) * 100)}%"></div></div>
        <div class="draft-format-badge">${coach.escapeHtml(window.TFM2Draft.formatSummary(session))}</div>
      </div>
      <div class="draft-bar-actions">
        <button type="button" class="btn-secondary btn-sm" id="draft-undo" title="Annuler">↩ Undo</button>
        <button type="button" class="btn-secondary btn-sm" id="draft-reset">Reset</button>
        ${
          window.TFM2Draft.isComplete(session)
            ? `<button type="button" class="btn-secondary btn-sm" id="draft-swap-help" title="Échanger Top/Jungle/Mid…">⇄ Postes</button>
               <button type="button" class="btn-primary btn-sm" id="draft-to-tactics">→ Tactiques</button>`
            : ""
        }
      </div>
    `;

    el.querySelector("#draft-session-select")?.addEventListener("change", (e) => {
      coach.state.activeDraftId = e.target.value;
      saveSessions();
      renderAll();
    });
    el.querySelector("#draft-new-game")?.addEventListener("click", () => {
      const n = coach.state.draftSessions.length + 1;
      const prev = coach.state.draftSessions[coach.state.draftSessions.length - 1];
      const s = window.TFM2Draft.createSession(`Game ${n}`, prev?.ourSide || "blue", {
        fearless: prev?.fearless ?? false,
        bansPerTeam: prev?.bansPerTeam ?? 3,
      });
      coach.state.draftSessions.push(s);
      coach.state.activeDraftId = s.id;
      saveSessions();
      renderAll();
    });
    el.querySelector("#draft-rename-game")?.addEventListener("click", () => {
      const s = getActiveSession();
      if (!s) return;
      const name = prompt("Nom de la partie :", s.name);
      if (name?.trim()) {
        s.name = name.trim();
        saveSessions();
        renderSessionBar();
      }
    });
    el.querySelector("#draft-undo")?.addEventListener("click", () => {
      const s = getActiveSession();
      if (s && window.TFM2Draft.undo(s)) {
        window.TFM2Draft.suggestNextFocus(s, coach.state.byName, draftMetaMap());
        saveSessions();
        renderAll();
      }
    });
    el.querySelector("#draft-reset")?.addEventListener("click", () => {
      const s = getActiveSession();
      if (s && confirm(`Reset ${s.name} ?`)) {
        window.TFM2Draft.resetSession(s);
        s.focus = null;
        window.TFM2Draft.suggestNextFocus(s, coach.state.byName, draftMetaMap());
        saveSessions();
        renderAll();
      }
    });
    el.querySelector("#draft-to-tactics")?.addEventListener("click", exportToTactics);
    el.querySelector("#draft-swap-help")?.addEventListener("click", () => {
      const s = getActiveSession();
      if (!s) return;
      s.focus = null;
      saveSessionsDebounced();
      showDraftFlash("Clique un poste, puis un autre (même équipe) pour échanger les champions.", "success");
      renderAll();
    });
    el.querySelectorAll(".side-chip:not([disabled])").forEach((btn) => {
      btn.addEventListener("click", () => {
        const s = getActiveSession();
        if (!s || !window.TFM2Draft.canEditFormat(s)) return;
        s.ourSide = btn.dataset.side;
        saveSessions();
        renderAll();
      });
    });
    el.querySelector("#draft-fearless")?.addEventListener("change", (e) => {
      const s = getActiveSession();
      if (!s || !window.TFM2Draft.canEditFormat(s)) return;
      s.fearless = e.target.checked;
      saveSessions();
      renderAll();
    });
    el.querySelectorAll(".ban-chip:not([disabled])").forEach((btn) => {
      btn.addEventListener("click", () => {
        const s = getActiveSession();
        if (!s || !window.TFM2Draft.canEditFormat(s)) return;
        s.bansPerTeam = parseInt(btn.dataset.bans, 10) === 2 ? 2 : 3;
        saveSessions();
        renderAll();
      });
    });
  }

  function renderBanRow(side, session) {
    const bans = session.bans[side];
    const count = session.bansPerTeam === 2 ? 2 : 3;
    const cells = [];
    for (let i = 0; i < count; i++) {
      const name = bans[i] || null;
      const champ = name ? coach.state.byName.get(name) : null;
      const focused = isCellFocused(session, "ban", side, i, null);
      cells.push(`
        <button type="button"
          class="draft-cell draft-ban-cell${name ? " filled" : " empty"}${focused ? " draft-cell-focused" : ""}"
          data-focus-type="ban" data-side="${side}" data-ban-index="${i}"
          aria-label="Ban ${side} ${i + 1}${name ? ` : ${name}` : ""}">
          <span class="draft-cell-tag">BAN</span>
          ${
            champ
              ? coach.championIconHtml(champ, { size: "ban" })
              : `<span class="draft-cell-plus">+</span>`
          }
          <span class="draft-cell-name">${name ? coach.escapeHtml(champ?.name || name) : ""}</span>
        </button>`);
    }
    return cells.join("");
  }

  function renderTeamColumn(side, session, label) {
    const isOurs = side === window.TFM2Draft.ourSide(session);
    const comp = window.TFM2Draft.pickBySlot(session, side);
    const step = window.TFM2Draft.getStep(session);
    const sideActive = step?.side === side;

    const slots = window.TFM2Draft.SLOTS.map((slot) => {
      const name = comp[slot];
      const champ = name ? coach.state.byName.get(name) : null;
      const focused = isCellFocused(session, "pick", side, null, slot);
      const swapTarget = isSwapTarget(session, side, slot);
      const complete = window.TFM2Draft.isComplete(session);
      const swappable = complete && name;

      return `
        <button type="button"
          class="draft-cell draft-pick-cell${name ? " filled" : " empty"}${focused ? " draft-cell-focused" : ""}${swapTarget ? " draft-cell-swap-target" : ""}${swappable ? " draft-pick-swappable" : ""}"
          data-focus-type="pick" data-side="${side}" data-slot="${slot}"
          aria-label="Pick ${slot}${name ? ` : ${name}` : ""}${swappable ? " — cliquer pour échanger" : ""}">
          <span class="draft-cell-tag">${SLOT_ICONS[slot]} ${slot}</span>
          ${
            champ
              ? coach.championIconHtml(champ, { size: "draft" })
              : `<span class="draft-cell-plus">+</span>`
          }
          <span class="draft-cell-name">${name ? coach.escapeHtml(champ?.name || name) : ""}</span>
        </button>`;
    }).join("");

    return `
      <div class="draft-team ${side}${isOurs ? " our-team" : " enemy-team"}${sideActive ? " side-active" : ""}">
        <div class="draft-team-header">
          <span class="draft-team-badge draft-badge-${side}">${side === "blue" ? "Bleu" : "Rouge"}</span>
          <h3>${coach.escapeHtml(label)}</h3>
          ${sideActive ? '<span class="draft-turn-pulse">Au tour</span>' : ""}
        </div>
        <div class="draft-bans-row">${renderBanRow(side, session)}</div>
        <div class="draft-slots-grid">${slots}</div>
      </div>`;
  }

  function bindFocusCells(container) {
    if (container.dataset.boardBound === "1") return;
    container.dataset.boardBound = "1";
    container.addEventListener("click", (e) => {
      const cell = e.target.closest(".draft-cell[data-focus-type]");
      if (!cell || !container.contains(cell)) return;
      const session = getActiveSession();
      if (!session) return;
      const type = cell.dataset.focusType;
      const side = cell.dataset.side;
      if (type === "ban") {
        setFocus(session, { type: "ban", side, banIndex: parseInt(cell.dataset.banIndex, 10) });
        afterFocusChange(session);
      } else {
        handlePickCellClick(session, side, cell.dataset.slot);
      }
    });
  }

  function renderShellPlanPanel(session) {
    const GE = window.TFM2GuideDraftEngine || window.TFM2DraftGuide;
    if (!GE?.getDraftPlan) return "";
    const our = window.TFM2Draft.sidePicks(session, window.TFM2Draft.ourSide(session)).map((p) => p.name);
    const en = window.TFM2Draft.sidePicks(session, window.TFM2Draft.enemySide(session)).map((p) => p.name);
    try {
      const taken = window.TFM2Draft.takenNames(session, allSessions());
      const ctx = { takenNames: taken, sessionIndex: allSessions().indexOf(session) };
      const plan = GE.getDraftPlan({ ourNames: our, enemyNames: en, ...ctx });
      const step = window.TFM2Draft.getStep(session);
      const lines = [];

      if (plan.shell) lines.push(`<strong>Shell:</strong> ${coach.escapeHtml(plan.shell)}`);
      if (plan.reason) lines.push(`<span>${coach.escapeHtml(plan.reason)}</span>`);
      if (plan.nextPick) lines.push(`<span>Prochain pick: <strong>${coach.escapeHtml(plan.nextPick)}</strong></span>`);

      if (step?.type === "ban" && plan.banPriority?.length) {
        lines.push(`<span>Bans menace: ${plan.banPriority.slice(0, 3).map((n) => coach.escapeHtml(n)).join(", ")}</span>`);
      }

      if (plan.serpen) lines.push(`<span>Serpent: ${coach.escapeHtml(plan.serpen)}</span>`);
      if (plan.morgard) lines.push(`<span>Morgard: ${coach.escapeHtml(plan.morgard)}</span>`);

      const banned = GE.bannedCores?.(our, taken) || [];
      if (banned[0]) {
        const pivot = banned[0].chain.filter((n) => n !== banned[0].core).slice(0, 2);
        if (pivot.length) {
          lines.push(`<span>Pivot ${coach.escapeHtml(banned[0].core)} → ${pivot.map((n) => coach.escapeHtml(n)).join(" / ")}</span>`);
        }
      }

      if (plan.checklist?.items?.length) {
        const chk = plan.checklist.items
          .map((i) => `<span class="${i.ok ? "chk-ok" : "chk-pending"}">${i.ok ? "✓" : "○"} ${coach.escapeHtml(i.labelFr)}</span>`)
          .join("");
        lines.push(`<div class="draft-checklist">${chk}</div>`);
      }

      if (!lines.length) return "";
      return `
        <div class="draft-shell-plan coach-hint" aria-label="Plan draft guide">
          ${lines.map((l) => `<div>${l}</div>`).join("")}
        </div>`;
    } catch (err) {
      console.warn("renderShellPlanPanel", err);
      return "";
    }
  }

  function renderBoard() {
    const el = coach.els.draftBoard;
    const session = getActiveSession();
    if (!el || !session) return;

    const ourSideId = window.TFM2Draft.ourSide(session);
    const enemySideId = window.TFM2Draft.enemySide(session);
    const complete = window.TFM2Draft.isComplete(session);
    const focusHint = window.TFM2Draft.actionLabel(session, coach.state.byName, draftMetaMap(), allSessions());
    const shellPanel = renderShellPlanPanel(session);

    el.classList.toggle("draft-layout-ready", complete);
    el.innerHTML = `
      ${renderTeamColumn(ourSideId, session, "Notre équipe")}
      <div class="draft-center-vs">
        <div class="draft-vs-badge">VS</div>
        <div class="draft-turn-box ${complete ? "draft-complete" : window.TFM2Draft.isOurTurn(session) ? "our-turn" : "enemy-turn"}">
          ${
            complete
              ? "<strong>Terminé</strong><span>⇄ Postes · Export → Tactiques</span>"
              : `<strong>${window.TFM2Draft.isOurTurn(session) ? "Notre tour" : "Tour adversaire"}</strong>`
          }
          <span>${focusHint ? coach.escapeHtml(focusHint) : "1. Case · 2. Champion"}</span>
        </div>
        ${shellPanel}
      </div>
      ${renderTeamColumn(enemySideId, session, "Adversaire")}
    `;

    bindFocusCells(el);
  }

  function poolCtx(hotNames = new Set()) {
    return {
      hotNames,
      escapeHtml: coach.escapeHtml,
      iconHtml: (c) => coach.championIconHtml(c, { size: "pool-lol" }),
      getTypeClass: coach.getTypeClass,
    };
  }

  function getPoolFiltered(session) {
    const Pool = window.TFM2ChampionPool;
    const searchQuery = coach.state.draftPoolSearch || "";
    const typeFilter = coach.state.draftPoolType || "all";
    const avail = window.TFM2Draft.availableChampions(coach.state.champions, session, allSessions());
    const filtered = Pool
      ? Pool.filterChampions(avail, { search: searchQuery, type: typeFilter })
      : avail.filter((c) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return { searchQuery, typeFilter, filtered };
  }

  function renderPoolRoleBar(activeType) {
    return window.TFM2ChampionPool?.renderRoleBar?.(activeType, coach.escapeHtml) || "";
  }

  function renderPoolGrid(champions, hotNames = new Set()) {
    const Pool = window.TFM2ChampionPool;
    if (Pool?.renderGrid) return Pool.renderGrid(champions, poolCtx(hotNames));
    return champions
      .map(
        (c) =>
          `<button type="button" class="draft-pool-card" data-champ="${coach.escapeHtml(c.name)}">${coach.escapeHtml(c.name)}</button>`
      )
      .join("");
  }

  function recommendationSide(session) {
    const step = window.TFM2Draft.getStep(session);
    return session.focus?.side || step?.side || session.ourSide || "blue";
  }

  function getSessionRecommendations(session, limit = 6) {
    if (window.TFM2Draft.isComplete(session)) return null;
    const step = window.TFM2Draft.getStep(session);
    if (!step) return null;
    const side = recommendationSide(session);
    const hintSlot =
      session.focus?.type === "pick" && session.focus.side === side ? session.focus.slot : null;
    try {
      return window.TFM2Draft.getRecommendations(
        session,
        side,
        coach.state.champions,
        allSessions(),
        coach.state.byName,
        draftMetaMap(),
        limit,
        { hintSlot }
      );
    } catch (err) {
      console.error("TFM2Draft.getRecommendations", err);
      return null;
    }
  }

  function buildSuggestChipsHtml(session, rec) {
    if (!rec?.items?.length) return "";
    return `
      <div id="draft-suggest-host" class="draft-suggest-row" aria-label="Suggestions coach">
        ${rec.items
          .map(
            (item, i) => `
          <button type="button" class="draft-suggest-chip" data-champ="${coach.escapeHtml(item.champion.name)}"${item.slot ? ` data-slot="${coach.escapeHtml(item.slot)}"` : ""} title="${coach.escapeHtml((item.reasons || []).slice(0, 4).join(" · ") || item.champion.name)}">
            <span class="draft-suggest-rank">#${i + 1}</span>
            ${coach.championIconHtml(item.champion, { size: "coach" })}
            <span class="draft-suggest-name">${coach.escapeHtml(item.champion.name)}</span>
            ${item.slot ? `<span class="draft-suggest-slot">${coach.escapeHtml(item.slot)}</span>` : ""}
          </button>`
          )
          .join("")}
      </div>`;
  }

  function renderSuggestChips(session) {
    return `<div id="draft-suggest-host"></div>`;
  }

  function fillSuggestChips(session, rec) {
    let host = document.getElementById("draft-suggest-host");
    if (!host) {
      const pool = coach.els.draftPool;
      if (!pool) return;
      pool.insertAdjacentHTML("afterbegin", `<div id="draft-suggest-host"></div>`);
      host = document.getElementById("draft-suggest-host");
      if (!host) return;
    }
    const run = () => {
      if (getActiveSession()?.id !== session.id) return;
      const html = buildSuggestChipsHtml(session, rec ?? getSessionRecommendations(session, 6));
      if (html) {
        host.outerHTML = html;
      } else {
        host.innerHTML = `<p class="muted draft-suggest-empty">Aucune suggestion pour cette étape.</p>`;
      }
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(run, { timeout: 200 });
    } else {
      requestAnimationFrame(run);
    }
  }

  function bindPoolEvents(container) {
    if (container.dataset.poolBound === "1") return;
    container.dataset.poolBound = "1";
    container.addEventListener("click", (e) => {
      const roleBtn = e.target.closest("[data-pool-role]");
      if (roleBtn && container.contains(roleBtn)) {
        coach.state.draftPoolType = roleBtn.dataset.poolRole || "all";
        container.querySelectorAll(".pool-role-btn").forEach((b) => {
          const on = b.dataset.poolRole === coach.state.draftPoolType;
          b.classList.toggle("active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
        renderPool({ gridOnly: true });
        return;
      }
      const btn = e.target.closest(".draft-pool-card, .draft-suggest-chip");
      if (btn && container.contains(btn)) {
        pickChampion(btn.dataset.champ, { slot: btn.dataset.slot || undefined });
      }
    });
    container.addEventListener("input", (e) => {
      if (e.target.id !== "draft-pool-search") return;
      coach.state.draftPoolSearch = e.target.value;
      renderPool({ gridOnly: true });
    });
  }

  function poolNeedsFullRender(el) {
    return !el?.querySelector(".pool-role-bar") || !el?.querySelector(".draft-pool-grid-lol");
  }

  function ensureLolPoolGrid(gridEl) {
    if (!gridEl) return;
    gridEl.classList.remove("draft-pool-grid-alpha");
    gridEl.classList.add("draft-pool-grid-lol");
  }

  function updatePoolGrid(el, filtered, typeFilter, hotNames) {
    const countEl = el.querySelector(".draft-pool-count");
    if (countEl) countEl.textContent = `${filtered.length} dispo · ${coach.state.champions.length} rotation patch`;

    const gridEl = el.querySelector(".draft-pool-grid");
    ensureLolPoolGrid(gridEl);
    if (gridEl) {
      gridEl.innerHTML = filtered.length
        ? renderPoolGrid(filtered, hotNames)
        : `<p class="muted draft-pool-empty">Aucun champion pour ce filtre.</p>`;
    }
  }

  function renderPool({ gridOnly = false, forceFull = false } = {}) {
    const el = coach.els.draftPool;
    const session = getActiveSession();
    if (!el || !session) return;

    const { searchQuery, typeFilter, filtered } = getPoolFiltered(session);
    const complete = window.TFM2Draft.isComplete(session);
    const rec = complete ? null : getSessionRecommendations(session, 8);
    const hotNames = new Set((rec?.items || []).map((item) => item.champion.name));

    const full = forceFull || !gridOnly || poolNeedsFullRender(el);

    if (!full && el.querySelector("#draft-pool-search")) {
      updatePoolGrid(el, filtered, typeFilter, hotNames);
      fillSuggestChips(session, rec);
      return;
    }

    const actionText = (() => {
      try {
        return window.TFM2Draft.actionLabel(session, coach.state.byName, draftMetaMap(), allSessions());
      } catch (err) {
        console.warn("renderPool actionLabel", err);
        const st = window.TFM2Draft.getStep(session);
        return st?.type === "ban" ? "Ban → champion" : "Pick → champion";
      }
    })();
    const hasFocus = Boolean(session.focus);

    el.innerHTML = `
      <div class="draft-pool-header">
        <h2 class="draft-pool-title">Champions</h2>
        <span class="draft-pool-count">${filtered.length} dispo · ${coach.state.champions.length} rotation patch</span>
      </div>
      ${
        actionText
          ? `<div class="draft-pool-action${hasFocus ? " focus-ready" : ""}">${coach.escapeHtml(actionText)}</div>`
          : ""
      }
      ${renderSuggestChips(session)}
      ${renderPoolRoleBar(typeFilter)}
      <div class="draft-pool-toolbar">
        <input type="search" class="draft-pool-search" placeholder="Rechercher un champion…" value="${coach.escapeHtml(searchQuery)}" id="draft-pool-search" autocomplete="off" />
      </div>
      <div class="draft-pool-grid draft-pool-grid-lol">
        ${filtered.length ? renderPoolGrid(filtered, hotNames) : `<p class="muted draft-pool-empty">Aucun champion pour ce filtre.</p>`}
      </div>
    `;

    delete el.dataset.poolBound;
    bindPoolEvents(el);
    fillSuggestChips(session, rec);
  }

  function init(TFM2Coach) {
    coach = TFM2Coach;
    const loaded = loadSessions();
    coach.state.draftSessions = loaded.sessions.map((s) => window.TFM2Draft.normalizeSession(s));
    coach.state.activeDraftId = loaded.activeId;
    coach.state.draftPoolSearch = "";
    coach.state.draftPoolType = "all";

    if (!coach.state.draftSessions.length) {
      const s = window.TFM2Draft.createSession("Game 1");
      coach.state.draftSessions = [s];
      coach.state.activeDraftId = s.id;
      saveSessions();
    } else if (!coach.state.draftSessions.some((s) => s.id === coach.state.activeDraftId)) {
      coach.state.activeDraftId = coach.state.draftSessions[0].id;
      saveSessions();
    }

    coach.els.draftSessionBar = document.getElementById("draft-session-bar");
    coach.els.draftBoard = document.getElementById("draft-board");
    coach.els.draftPool = document.getElementById("draft-pool");
    coach.els.draftFlash = document.getElementById("draft-flash");
    renderAll();
  }

  function exportToTactics() {
    const session = getActiveSession();
    if (!session) return;
    const { ourComp, enemyComp } = window.TFM2Draft.toComps(session);
    Object.assign(coach.state.ourComp, ourComp);
    Object.assign(coach.state.enemyComp, enemyComp);
    coach.setView("tactics");
    if (typeof coach.runTacticsAnalysis === "function") coach.runTacticsAnalysis();
  }

  function onViewShow() {
    ensureSessions();
    renderAll();
  }

  window.TFM2DraftUI = { init, onViewShow, renderAll };
})();
