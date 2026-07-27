/**
 * TFM2 Draft UI v1 (refonte) — onglet Draft.
 *
 * Objectifs de la refonte :
 *   - conseils EXPLIQUÉS (score + raisons visibles + poste + avertissements pièges) ;
 *   - saisie unifiée pick/ban (cliquer un champion « marche » toujours) ;
 *   - tour clairement étiqueté (nous / adversaire) + ordre de pick numéroté ;
 *   - pool perso (« mes champions jouables ») ;
 *   - estimation de victoire honnête (heuristique, jamais un faux %) ;
 *   - récupération robuste : éditer le format sans reset, pas de F5, pas de prompt() natif.
 *
 * S'appuie sur la façade window.TFM2Draft (moteur reconstruit) et sur window.TFM2Coach.
 */
(function () {
  const SESSIONS_KEY = "tfm2-draft-sessions-v2";
  const PERSO_KEY = "tfm2-draft-perso-v1";
  const SLOT_ICONS = { Top: "▣", Jungle: "🔥", Mid: "⚡", Bot: "◎", Support: "✚" };
  const D = () => window.TFM2Draft;

  let coach = null;
  let saveTimer = null;
  let perso = { names: [], active: false, editing: false };
  let bound = false;

  // ---- persistance -----------------------------------------------------------
  function esc(s) { return coach.escapeHtml(String(s == null ? "" : s)); }
  function saveDebounced() { clearTimeout(saveTimer); saveTimer = setTimeout(saveSessions, 150); }
  function saveSessions() {
    try {
      coach.state.draftSessions.forEach((s) => D().normalizeSession(s));
      localStorage.setItem(SESSIONS_KEY, JSON.stringify({ sessions: coach.state.draftSessions, activeId: coach.state.activeDraftId }));
    } catch (e) { /* quota / privée : on ignore, l'état reste en mémoire */ }
  }
  function loadSessions() {
    try {
      const p = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "{}");
      return { sessions: Array.isArray(p.sessions) ? p.sessions : [], activeId: p.activeId || null };
    } catch { return { sessions: [], activeId: null }; }
  }
  function loadPerso() {
    try {
      const p = JSON.parse(localStorage.getItem(PERSO_KEY) || "{}");
      perso.names = Array.isArray(p.names) ? p.names : [];
      perso.active = Boolean(p.active);
    } catch { perso = { names: [], active: false, editing: false }; }
  }
  function savePerso() {
    try { localStorage.setItem(PERSO_KEY, JSON.stringify({ names: perso.names, active: perso.active })); } catch {}
  }

  // ---- helpers session -------------------------------------------------------
  const sessions = () => coach.state.draftSessions;
  const active = () => sessions().find((s) => s.id === coach.state.activeDraftId) || null;
  function ensureSession() {
    if (!sessions().length) {
      const s = D().createSession("Game 1");
      coach.state.draftSessions = [s];
      coach.state.activeDraftId = s.id;
      saveSessions();
    } else if (!active()) {
      coach.state.activeDraftId = sessions()[0].id;
    }
  }

  /** Noms jouables ce patch, éventuellement restreints au pool perso actif. */
  function poolNames() {
    let names = (coach.state.champions || []).map((c) => c.name);
    if (perso.active && perso.names.length) {
      const set = new Set(perso.names);
      names = names.filter((n) => set.has(n));
    }
    return names;
  }

  function flash(msg, kind = "info") {
    const el = coach.els.draftFlash;
    if (!el) return;
    el.textContent = msg;
    el.className = `draft-flash draft-flash--${kind} is-visible`;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = "draft-flash"; el.textContent = ""; }, 2600);
  }

  // ---- rendu principal -------------------------------------------------------
  function renderAll() {
    try {
      ensureSession();
      const s = active();
      if (s && !D().isComplete(s)) D().suggestNextFocus(s);
      syncComps(s);
      renderSessionBar(s);
      renderBoard(s);
      renderPool(s);
    } catch (err) {
      console.error("TFM2DraftUI.renderAll", err);
      // Récupération douce : on ne demande pas de F5, on réinitialise le focus.
      const s = active();
      if (s) { s.focus = null; }
      safeHtml(coach.els.draftPool, `<div class="draft-pool-empty">Un souci d'affichage est survenu — l'action a été annulée. Réessaie.</div>`);
    }
  }

  function safeHtml(el, html) { if (el) el.innerHTML = html; }

  function syncComps(s) {
    if (!s || !coach.state.ourComp) return;
    try {
      const { ourComp, enemyComp } = D().toComps(s);
      Object.assign(coach.state.ourComp, ourComp);
      Object.assign(coach.state.enemyComp, enemyComp);
    } catch {}
  }

  // ---- barre de session ------------------------------------------------------
  function renderSessionBar(s) {
    const el = coach.els.draftSessionBar;
    if (!el) return;
    const canFormat = D().canEditFormat(s);
    const tabs = sessions().map((x) =>
      `<button type="button" class="draft-session-tab${x.id === s.id ? " is-active" : ""}" data-act="select" data-id="${x.id}">${esc(x.name)}</button>`
    ).join("");
    const fmtDisabledTitle = canFormat ? "" : `title="Réinitialise la draft pour changer le format"`;
    el.innerHTML = `
      <div class="draft-session-tabs">
        ${tabs}
        <button type="button" class="draft-session-add" data-act="new" title="Nouvelle draft">+ Game</button>
      </div>
      <div class="draft-session-controls" ${fmtDisabledTitle}>
        <span class="draft-ctl-group">
          <span class="draft-ctl-label">Notre côté</span>
          <button type="button" class="draft-chip${s.ourSide === "blue" ? " is-active" : ""}" data-act="side" data-val="blue" ${canFormat ? "" : "disabled"}>Bleu</button>
          <button type="button" class="draft-chip${s.ourSide === "red" ? " is-active" : ""}" data-act="side" data-val="red" ${canFormat ? "" : "disabled"}>Rouge</button>
        </span>
        <span class="draft-ctl-group">
          <span class="draft-ctl-label">Bans</span>
          <button type="button" class="draft-chip${s.bansPerTeam === 2 ? " is-active" : ""}" data-act="bans" data-val="2" ${canFormat ? "" : "disabled"}>2</button>
          <button type="button" class="draft-chip${s.bansPerTeam === 3 ? " is-active" : ""}" data-act="bans" data-val="3" ${canFormat ? "" : "disabled"}>3</button>
        </span>
        <button type="button" class="draft-chip${s.fearless ? " is-active" : ""}" data-act="fearless" ${canFormat ? "" : "disabled"}>Fearless</button>
        <button type="button" class="draft-chip${perso.active ? " is-active" : ""}" data-act="perso-toggle" title="Restreindre aux champions de mon pool">Pool perso${perso.active ? ` (${perso.names.length})` : ""}</button>
        <button type="button" class="draft-chip" data-act="perso-edit">${perso.editing ? "Fermer l'édition" : "Éditer le pool"}</button>
        <span class="draft-ctl-spacer"></span>
        <button type="button" class="draft-chip" data-act="rename">Renommer</button>
        <button type="button" class="draft-chip" data-act="undo">↶ Annuler</button>
        <button type="button" class="draft-chip draft-chip--danger" data-act="reset">⟲ Reset</button>
        ${sessions().length > 1 ? `<button type="button" class="draft-chip draft-chip--danger" data-act="delete">🗑</button>` : ""}
      </div>`;
  }

  // ---- plateau ---------------------------------------------------------------
  function turnBanner(s) {
    if (D().isComplete(s)) {
      const a = D().analyzeLive(s);
      return `<div class="draft-turn-banner is-complete">✓ Draft terminée${a.notes.length ? ` · ${esc(a.notes[a.notes.length - 1])}` : ""} · clique deux postes d'une équipe pour échanger</div>`;
    }
    const step = D().getStep(s);
    const ours = step.side === s.ourSide;
    const kind = step.type === "ban" ? "BAN" : "PICK";
    const sideLabel = step.side === "blue" ? "Bleu" : "Rouge";
    const dot = step.side === "blue" ? "🔵" : "🔴";
    let hint = "";
    if (step.type === "pick") {
      const slot = s.focus && s.focus.slot ? s.focus.slot : null;
      hint = slot
        ? ` · poste ciblé : <strong>${esc(D().SLOT_LABELS[slot] || slot)}</strong> <button type="button" class="draft-clear-slot" data-act="clear-slot">✕</button>`
        : ` · <span class="draft-turn-flex">meilleur pick — poste flexible (clique une case pour cibler un poste)</span>`;
    }
    const who = ours ? `À toi` : `Adversaire (renseigne son choix)`;
    return `<div class="draft-turn-banner ${ours ? "is-ours" : "is-enemy"}">${dot} ${who} — <strong>${kind}</strong> ${sideLabel}${hint} · <span class="draft-turn-step">${esc(D().stepLabel(s))}</span></div>`;
  }

  function pickOrderMap(s) {
    // numéro d'ordre de pick par (side, slotIndexParPick) — simple compteur d'apparition
    const map = {};
    for (const side of ["blue", "red"]) {
      D().sidePicks(s, side).forEach((p, i) => { map[`${side}:${p.slot}`] = i + 1; });
    }
    return map;
  }

  function cellChampHtml(name) {
    const c = coach.state.byName.get(name);
    const tier = c && c.tierMeta ? c.tierMeta : "?";
    return `<span class="draft-cell-champ">${coach.championIconHtml ? coach.championIconHtml(c, "xs") : ""}<span class="draft-cell-name">${esc(name)}</span><span class="draft-cell-tier tier-${String(tier).toLowerCase()}">${esc(tier)}</span></span>`;
  }

  function teamColumnHtml(s, side) {
    const isOur = side === s.ourSide;
    const focus = s.focus;
    const bans = s.bans[side] || [];
    const banCells = bans.map((n, i) => {
      const foc = focus && focus.type === "ban" && focus.side === side && focus.banIndex === i;
      return `<button type="button" class="draft-ban-cell${n ? " is-filled" : ""}${foc ? " draft-cell-focused" : ""}" data-cell="ban" data-side="${side}" data-ban="${i}">${n ? `🚫 ${esc(n)}` : `Ban ${i + 1}`}</button>`;
    }).join("");

    const byslot = D().pickBySlot(s, side);
    const pinnedBySlot = {};
    for (const p of D().sidePicks(s, side)) if (p.pinned && p.slot) pinnedBySlot[p.slot] = true;
    const orderMap = pickOrderMap(s);
    const slotCells = D().SLOTS.map((slot) => {
      const name = byslot[slot];
      const foc = focus && focus.type === "pick" && focus.side === side && focus.slot === slot;
      const swap = D().isComplete(s) && name;
      const num = orderMap[`${side}:${slot}`];
      const pin = name && pinnedBySlot[slot];
      const title = name
        ? (pin ? `${name} épinglé à ce poste — clique pour libérer (auto)` : `${name} — poste auto (dynamique) · clique pour épingler`)
        : `Cibler ${D().SLOT_LABELS[slot] || slot} pour le prochain pick`;
      return `<button type="button" title="${esc(title)}" class="draft-cell draft-pick-cell${name ? " is-filled" : ""}${foc ? " draft-cell-focused" : ""}${swap ? " draft-pick-swappable" : ""}${pin ? " draft-pick-pinned" : ""}" data-cell="pick" data-side="${side}" data-slot="${slot}">
        <span class="draft-slot-label">${SLOT_ICONS[slot] || ""} ${esc(D().SLOT_LABELS[slot] || slot)}${pin ? ` <span class="draft-pin-badge" title="Poste épinglé">📌</span>` : ""}${num ? `<span class="draft-pick-order">#${num}</span>` : ""}</span>
        ${name ? cellChampHtml(name) : `<span class="draft-cell-plus">+</span>`}
      </button>`;
    }).join("");

    return `<div class="draft-column${isOur ? " our-team" : " draft-enemy"}">
      <div class="draft-col-head">${side === "blue" ? "🔵 Bleu" : "🔴 Rouge"}${isOur ? " · <em>nous</em>" : ""}</div>
      <div class="draft-bans-row">${banCells}</div>
      <div class="draft-slots">${slotCells}</div>
    </div>`;
  }

  function renderBoard(s) {
    const el = coach.els.draftBoard;
    if (!el) return;
    const left = s.ourSide === "blue" ? "blue" : "red";
    const right = left === "blue" ? "red" : "blue";
    el.innerHTML = `
      ${turnBanner(s)}
      <div class="draft-teams">
        ${teamColumnHtml(s, left)}
        <div class="draft-center-vs">VS${winStripHtml(s)}</div>
        ${teamColumnHtml(s, right)}
      </div>`;
  }

  function winStripHtml(s) {
    const plan = safePlan(s);
    if (!plan || !plan.win) return "";
    const pct = Math.round(plan.win.ourPct * 100);
    return `<div class="draft-winstrip" title="Estimation heuristique — la draft ne décide pas tout">
      <span class="draft-winstrip-pct">${pct}%</span>
      <span class="draft-winstrip-verdict">${esc(plan.win.verdict)}</span>
      <span class="draft-winstrip-note">estimation</span>
    </div>`;
  }
  function safePlan(s) {
    try {
      const rec = currentRec(s);
      return rec ? rec.plan : null;
    } catch { return null; }
  }

  // ---- pool + conseils -------------------------------------------------------
  let _recCache = { key: null, rec: null };
  function currentRec(s) {
    if (D().isComplete(s)) return null;
    const step = D().getStep(s);
    const side = step.side;
    const key = `${s.id}:${s.stepIndex}:${step.type}:${side}:${JSON.stringify(s.focus)}:${perso.active}:${(coach.state.champions || []).length}`;
    if (_recCache.key === key) return _recCache.rec;
    const rec = D().getRecommendations(s, side, { pool: poolNames(), allSessions: sessions(), limit: 40 });
    _recCache = { key, rec };
    return rec;
  }
  function invalidateRec() { _recCache = { key: null, rec: null }; }

  function reasonsHtml(reasons) {
    return (reasons || []).map((r) => {
      const warn = r.startsWith("⚠");
      return `<span class="draft-reason${warn ? " draft-reason--warn" : ""}">${esc(r)}</span>`;
    }).join("");
  }
  function warningsHtml(warnings) {
    if (!warnings || !warnings.length) return "";
    return `<div class="draft-warn-row">${warnings.map((w) => `<span class="draft-warn">⚠ ${esc(w)}</span>`).join("")}</div>`;
  }

  function coachPanelHtml(s, rec) {
    if (!rec) {
      const a = D().analyzeLive(s);
      return `<div class="draft-coach-panel"><div class="draft-coach-title">Draft terminée</div>${a.notes.map((n) => `<div class="draft-note">${esc(n)}</div>`).join("")}</div>`;
    }
    const isBan = rec.type === "ban";
    const top = rec.items.slice(0, 5);
    const rows = top.map((it, i) => {
      const slot = isBan ? "" : `<span class="draft-suggest-slot">${SLOT_ICONS[it.slot] || ""} ${esc(D().SLOT_LABELS[it.slot] || it.slot || "")}</span>`;
      return `<button type="button" class="draft-rec-row${i === 0 ? " is-top" : ""}" data-act="apply" data-name="${esc(it.name)}"${it.slot ? ` data-slot="${esc(it.slot)}"` : ""}>
        <span class="draft-rec-rank">${i + 1}</span>
        <span class="draft-rec-main">
          <span class="draft-rec-head"><span class="draft-rec-name">${esc(it.name)}</span>${slot}<span class="draft-rec-score">${it.score}</span></span>
          <span class="draft-rec-reasons">${reasonsHtml(it.reasons)}</span>
          ${warningsHtml(it.warnings)}
        </span>
      </button>`;
    }).join("");
    return `<div class="draft-coach-panel">
      <div class="draft-coach-title">${isBan ? "🚫 Bans conseillés" : "🎯 Picks conseillés"} <span class="draft-coach-hint">${esc(rec.coachHint || "")}</span></div>
      <div class="draft-rec-list">${rows}</div>
    </div>`;
  }

  function poolCardsHtml(s, rec) {
    const scoreByName = new Map();
    if (rec) rec.items.forEach((it) => scoreByName.set(it.name, it));
    const q = (coach.state.draftPoolSearch || "").toLowerCase();
    const taken = D().takenNames(s, sessions());
    let list = (coach.state.champions || []).filter((c) => !taken.has(c.name));
    if (perso.active && perso.names.length) { const set = new Set(perso.names); list = list.filter((c) => set.has(c.name)); }
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q));
    // tri : par score de reco si dispo, sinon tier puis alpha
    list.sort((a, b) => {
      const sa = scoreByName.get(a.name), sb = scoreByName.get(b.name);
      if (sa && sb) return sb.score - sa.score;
      if (sa) return -1;
      if (sb) return 1;
      return a.name.localeCompare(b.name);
    });
    const cards = list.map((c) => {
      const it = scoreByName.get(c.name);
      const tier = c.tierMeta || "?";
      const scoreTag = it ? `<span class="draft-pool-score">${it.score}</span>` : "";
      const persoOn = perso.names.includes(c.name);
      const editTag = perso.editing ? `<span class="draft-pool-perso${persoOn ? " is-on" : ""}">${persoOn ? "★" : "☆"}</span>` : "";
      return `<button type="button" class="draft-pool-card" data-act="pool" data-name="${esc(c.name)}">
        ${coach.championIconHtml ? coach.championIconHtml(c, "sm") : ""}
        <span class="draft-pool-name">${esc(c.name)}</span>
        <span class="draft-pool-tier tier-${String(tier).toLowerCase()}">${esc(tier)}</span>
        ${scoreTag}${editTag}
      </button>`;
    }).join("");
    return `<div class="draft-pool-grid">${cards || `<div class="draft-pool-empty">Aucun champion disponible${perso.active ? " dans ton pool perso" : ""}.</div>`}</div>`;
  }

  function renderPool(s) {
    const el = coach.els.draftPool;
    if (!el) return;
    const rec = currentRec(s);
    const count = (coach.state.champions || []).length;
    const persoBar = perso.editing
      ? `<div class="draft-perso-bar">Édition du pool perso : clique les champions pour les ajouter/retirer (★). <strong>${perso.names.length}</strong> sélectionnés. <button type="button" class="draft-chip" data-act="perso-clear">Vider</button></div>`
      : "";
    el.innerHTML = `
      ${coachPanelHtml(s, rec)}
      ${persoBar}
      <div class="draft-pool-toolbar">
        <input type="search" class="draft-pool-search" placeholder="Filtrer un champion…" value="${esc(coach.state.draftPoolSearch || "")}" />
        <span class="draft-pool-count">${count} en rotation${perso.active ? ` · pool perso (${perso.names.length})` : ""}</span>
      </div>
      ${poolCardsHtml(s, rec)}`;
    const inp = el.querySelector(".draft-pool-search");
    if (inp && coach.state._draftFocusSearch) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); coach.state._draftFocusSearch = false; }
  }

  // ---- actions ---------------------------------------------------------------
  function applyChampion(name, slot) {
    const s = active();
    if (!s) return;
    if (perso.editing) { togglePerso(name); return; }
    if (D().isComplete(s)) { flash("Draft terminée — utilise Reset ou change de Game.", "info"); return; }
    const step = D().getStep(s);
    const action = { type: step.type, side: step.side, name };
    if (step.type === "pick") {
      // slot explicite (case cliquée) = épinglé ; sinon poste auto (dynamique).
      const userSlot = s.focus && s.focus.slot ? s.focus.slot : null;
      action.slot = slot || userSlot || D().bestSlotForChampion(name, s, step.side);
      action.pin = Boolean(userSlot && !slot);
    } else if (s.focus && s.focus.type === "ban" && s.focus.side === step.side) {
      action.banIndex = s.focus.banIndex;
    }
    const res = D().recordAction(s, action, sessions());
    if (!res.ok) { flash(res.error || "Action impossible.", "error"); return; }
    invalidateRec();
    D().suggestNextFocus(s);
    saveDebounced();
    renderAll();
  }

  function togglePerso(name) {
    const i = perso.names.indexOf(name);
    if (i >= 0) perso.names.splice(i, 1); else perso.names.push(name);
    savePerso();
    invalidateRec();
    renderAll();
  }

  function onCellClick(s, cell) {
    const type = cell.dataset.cell;
    const side = cell.dataset.side;
    if (D().isComplete(s) && type === "pick") {
      // mode swap : mémoriser 1er clic, échanger au 2e
      const slot = cell.dataset.slot;
      if (!s._swapA) { s._swapA = slot; flash(`Échanger ${D().SLOT_LABELS[slot] || slot} avec…`, "info"); renderBoard(s); return; }
      if (s._swapA === slot) { s._swapA = null; renderBoard(s); return; }
      const r = D().swapPickSlots(s, side, s._swapA, slot);
      s._swapA = null;
      if (r.ok) { saveDebounced(); flash("Postes échangés.", "info"); }
      renderAll();
      return;
    }
    // Case pick DÉJÀ remplie (draft en cours) → épingler/libérer le poste.
    if (type === "pick") {
      const slot = cell.dataset.slot;
      const occupant = D().pickBySlot(s, side)[slot];
      if (occupant) {
        const pinned = D().togglePin(s, side, occupant);
        invalidateRec();
        saveDebounced();
        renderAll();
        flash(pinned ? `${occupant} épinglé à ${D().SLOT_LABELS[slot] || slot} 📌` : `${occupant} — poste auto (dynamique)`, "info");
        return;
      }
    }
    // Case vide → cibler ce poste/ban pour la prochaine sélection.
    if (type === "ban") s.focus = { type: "ban", side, banIndex: parseInt(cell.dataset.ban, 10) };
    else s.focus = { type: "pick", side, slot: cell.dataset.slot };
    invalidateRec();
    saveDebounced();
    renderAll();
  }

  function sessionAction(act, target) {
    const s = active();
    switch (act) {
      case "select": coach.state.activeDraftId = target.dataset.id; invalidateRec(); saveDebounced(); renderAll(); break;
      case "new": {
        const n = D().createSession(`Game ${sessions().length + 1}`);
        coach.state.draftSessions.push(n);
        coach.state.activeDraftId = n.id;
        invalidateRec(); saveSessions(); renderAll(); break;
      }
      case "side": if (D().canEditFormat(s)) { s.ourSide = target.dataset.val; invalidateRec(); saveDebounced(); renderAll(); } break;
      case "bans": if (D().canEditFormat(s)) { s.bansPerTeam = parseInt(target.dataset.val, 10); D().normalizeSession(s); invalidateRec(); saveDebounced(); renderAll(); } break;
      case "fearless": if (D().canEditFormat(s)) { s.fearless = !s.fearless; invalidateRec(); saveDebounced(); renderAll(); } break;
      case "undo": if (D().undo(s)) { invalidateRec(); D().suggestNextFocus(s); saveDebounced(); renderAll(); } else flash("Rien à annuler.", "info"); break;
      case "reset": inlineConfirm(target, "Réinitialiser cette draft ?", () => { D().resetSession(s); invalidateRec(); saveDebounced(); renderAll(); }); break;
      case "delete": inlineConfirm(target, "Supprimer cette Game ?", () => {
        coach.state.draftSessions = sessions().filter((x) => x.id !== s.id);
        coach.state.activeDraftId = sessions()[0] ? sessions()[0].id : null;
        invalidateRec(); saveSessions(); renderAll();
      }); break;
      case "rename": inlineRename(s); break;
      case "perso-toggle": perso.active = !perso.active; savePerso(); invalidateRec(); renderAll(); break;
      case "perso-edit": perso.editing = !perso.editing; renderAll(); break;
      case "perso-clear": perso.names = []; savePerso(); invalidateRec(); renderAll(); break;
    }
  }

  // Confirmation inline (remplace confirm() natif) : double-clic de validation.
  function inlineConfirm(btn, msg, onYes) {
    if (btn._armed) { clearTimeout(btn._armT); btn._armed = false; onYes(); return; }
    btn._armed = true;
    const old = btn.textContent;
    btn.textContent = "Confirmer ?";
    btn.classList.add("is-armed");
    btn._armT = setTimeout(() => { btn._armed = false; btn.textContent = old; btn.classList.remove("is-armed"); }, 2600);
  }

  // Renommage inline (remplace prompt() natif).
  function inlineRename(s) {
    const bar = coach.els.draftSessionBar;
    const tab = bar.querySelector(".draft-session-tab.is-active");
    if (!tab) return;
    const input = document.createElement("input");
    input.className = "draft-rename-input";
    input.value = s.name;
    tab.replaceWith(input);
    input.focus(); input.select();
    const commit = () => { const v = input.value.trim(); if (v) s.name = v; saveDebounced(); renderAll(); };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") renderAll(); });
    input.addEventListener("blur", commit);
  }

  // ---- délégation d'événements ----------------------------------------------
  function bind() {
    if (bound) return;
    bound = true;
    coach.els.draftSessionBar?.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (b) sessionAction(b.dataset.act, b);
    });
    coach.els.draftBoard?.addEventListener("click", (e) => {
      const clear = e.target.closest('[data-act="clear-slot"]');
      if (clear) {
        const s = active();
        if (s && s.focus) { s.focus.slot = null; invalidateRec(); saveDebounced(); renderAll(); }
        return;
      }
      const cell = e.target.closest("[data-cell]");
      if (cell) onCellClick(active(), cell);
    });
    coach.els.draftPool?.addEventListener("click", (e) => {
      const apply = e.target.closest('[data-act="apply"]');
      if (apply) { applyChampion(apply.dataset.name, apply.dataset.slot); return; }
      const card = e.target.closest('[data-act="pool"]');
      if (card) { applyChampion(card.dataset.name); return; }
    });
    coach.els.draftPool?.addEventListener("input", (e) => {
      if (e.target.classList.contains("draft-pool-search")) {
        coach.state.draftPoolSearch = e.target.value;
        coach.state._draftFocusSearch = true;
        renderPool(active());
      }
    });
  }

  // ---- cycle de vie ----------------------------------------------------------
  function init(TFM2Coach) {
    coach = TFM2Coach;
    const loaded = loadSessions();
    coach.state.draftSessions = loaded.sessions.map((s) => D().normalizeSession(s));
    coach.state.activeDraftId = loaded.activeId;
    coach.state.draftPoolSearch = "";
    coach.state.ourComp = coach.state.ourComp || {};
    coach.state.enemyComp = coach.state.enemyComp || {};
    loadPerso();
    ensureSession();
    coach.els.draftSessionBar = document.getElementById("draft-session-bar");
    coach.els.draftBoard = document.getElementById("draft-board");
    coach.els.draftPool = document.getElementById("draft-pool");
    coach.els.draftFlash = document.getElementById("draft-flash");
    bind();
  }

  function onViewShow() { invalidateRec(); renderAll(); }

  window.TFM2DraftUI = { init, onViewShow, renderAll };
})();
