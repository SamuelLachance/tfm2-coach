const state = {
  baseChampions: [],
  champions: [],
  byName: new Map(),
  patchConfig: null,
  patchSearch: "",
  patchPoolFilter: "all",
  items: [],
  byItemName: new Map(),
  guide: null,
  view: "champions",
  selectedId: null,
  slotFilter: "all",
  typeFilter: "all",
  itemTierFilter: "all",
  tierFilter: "all",
  search: "",
  tacticsMeta: null,
  jungleGuide: null,
  draftSessions: [],
  activeDraftId: null,
  draftPoolSearch: "",
  draftPoolType: "all",
  draftPoolTier: "all",
  tacticsPoolSearch: "",
  tacticsPoolType: "all",
  tacticsFocus: null,
  ourComp: { Top: "", Jungle: "", Mid: "", Bot: "", Support: "" },
  enemyComp: { Top: "", Jungle: "", Mid: "", Bot: "", Support: "" },
  mtgMeta: null,
  colorFilter: "all",
};

const els = {
  grid: document.getElementById("grid"),
  empty: document.getElementById("empty"),
  countLabel: document.getElementById("count-label"),
  search: document.getElementById("search"),
  headerSearchWrap: document.getElementById("header-search-wrap"),
  detail: document.getElementById("detail"),
  detailContent: document.getElementById("detail-content"),
  overlay: document.getElementById("overlay"),
  closeDetail: document.getElementById("close-detail"),
  slotFilters: document.getElementById("slot-filters"),
  typeFilters: document.getElementById("type-filters"),
  tierFilters: document.getElementById("tier-filters"),
  colorFilters: document.getElementById("color-filters"),
  viewChampions: document.getElementById("view-champions"),
  viewItems: document.getElementById("view-items"),
  viewGuide: document.getElementById("view-guide"),
  sidebarChampions: document.getElementById("sidebar-champions"),
  sidebarItems: document.getElementById("sidebar-items"),
  sidebarGuide: document.getElementById("sidebar-guide"),
  itemsGrid: document.getElementById("items-grid"),
  itemsCountLabel: document.getElementById("items-count-label"),
  itemTierFilters: document.getElementById("item-tier-filters"),
  guideToc: document.getElementById("guide-toc"),
  guideContent: document.getElementById("guide-content"),
  viewDraft: document.getElementById("view-draft"),
  viewTactics: document.getElementById("view-tactics"),
  viewPatch: document.getElementById("view-patch"),
  sidebarPatch: document.getElementById("sidebar-patch"),
  patchTableBody: document.getElementById("patch-table-body"),
  patchEmpty: document.getElementById("patch-empty"),
  patchSearch: document.getElementById("patch-search"),
  patchNameInput: document.getElementById("patch-name-input"),
  patchStatCount: document.getElementById("patch-stat-count"),
  patchSaveStatus: document.getElementById("patch-save-status"),
  patchPoolFilters: document.getElementById("patch-pool-filters"),
  patchEnableAll: document.getElementById("patch-enable-all"),
  patchDisableAll: document.getElementById("patch-disable-all"),
  patchResetDefaults: document.getElementById("patch-reset-defaults"),
  sidebarDraft: document.getElementById("sidebar-draft"),
  sidebarTactics: document.getElementById("sidebar-tactics"),
  ourSlots: document.getElementById("our-slots"),
  enemySlots: document.getElementById("enemy-slots"),
  tacticsPool: document.getElementById("tactics-pool"),
  tacticsFocusHint: document.getElementById("tactics-focus-hint"),
  tacticsQuickIndex: document.getElementById("tactics-quick-index"),
  tacticsTemplates: document.getElementById("tactics-templates"),
  tacticsJungleFitRef: document.getElementById("tactics-jungle-fit-ref"),
  tacticsResult: document.getElementById("tactics-result"),
  tacticsCompScore: document.getElementById("tactics-comp-score"),
  analyzeTactics: document.getElementById("analyze-tactics"),
  clearTactics: document.getElementById("clear-tactics"),
  importDraftTactics: document.getElementById("import-draft-tactics"),
  navTabs: document.querySelectorAll(".nav-tab"),
};

const CHAMP_NAMES_SORTED = [];
const ITEM_NAMES_SORTED = [];

const TIER_ORDER = { S: 0, A: 1, B: 2, C: 3, D: 4 };
const MTG_CODES = ["W", "U", "B", "R", "G"];
const MTG_COLOR_META = {
  W: { label: "Blanc", hex: "#f5f0dc", philosophy: "Structure & altruisme" },
  U: { label: "Bleu", hex: "#4a9fd4", philosophy: "Connaissance & contrÃ´le" },
  B: { label: "Noir", hex: "#6b6b7a", philosophy: "Pouvoir & sacrifice" },
  R: { label: "Rouge", hex: "#e05238", philosophy: "LibertÃ© & destruction" },
  G: { label: "Vert", hex: "#3d9e5a", philosophy: "Croissance & tradition" },
};

function initMtgMeta(mtgJson) {
  state.mtgMeta = mtgJson || null;
  if (!mtgJson?.colors) return;
  for (const [code, meta] of Object.entries(mtgJson.colors)) {
    MTG_COLOR_META[code] = { ...MTG_COLOR_META[code], ...meta };
  }
}

function getMtgColorPair(champ) {
  const ci = champ?.colorIdentity;
  if (!ci) return [];
  return MTG_CODES.map((c) => ({ code: c, val: ci[c] || 0 }))
    .filter((x) => x.val > 0)
    .sort((a, b) => b.val - a.val)
    .slice(0, 2);
}

function mtgPastilleTitle(pair) {
  return pair.map((p) => `${MTG_COLOR_META[p.code].label} ${p.val}/24`).join(" Â· ");
}

function mtgPastillesHtml(champ, { variant = "card" } = {}) {
  const pair = getMtgColorPair(champ);
  if (!pair.length) return "";
  const title = mtgPastilleTitle(pair);
  return `<span class="mtg-pastilles mtg-pastilles--${variant}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${pair
    .map(
      (p, i) =>
        `<span class="mtg-pastille mtg-pastille--${p.code.toLowerCase()} mtg-pastille--${i === 0 ? "primary" : "secondary"}" style="--pastille-weight:${p.val}"></span>`
    )
    .join("")}</span>`;
}

function mtgHarmonyTagsHtml(dominantCodes, combination) {
  const pie = window.MTGColorPie;
  if (pie) {
    const tags = pie.harmonyTags(dominantCodes, combination);
    if (!tags.length) return "";
    const kindClass = { ally: "ally", enemy: "enemy", shard: "shard", wedge: "wedge", mono: "mono" };
    return `<div class="mtg-harmony-tags">${tags
      .map(
        (t) =>
          `<span class="mtg-harmony-tag mtg-harmony-tag--${kindClass[t.kind] || "ally"}">${escapeHtml(t.text)}</span>`
      )
      .join("")}</div>`;
  }
  const pairs = state.mtgMeta?.pairs || {};
  const dom = dominantCodes || [];
  const allies = [];
  const enemies = [];
  for (const [a, b] of pairs.allied || []) {
    if (dom.includes(a) && dom.includes(b)) allies.push(`${MTG_COLOR_META[a].label}+${MTG_COLOR_META[b].label}`);
  }
  for (const [a, b] of pairs.enemy || []) {
    if (dom.includes(a) && dom.includes(b)) enemies.push(`${MTG_COLOR_META[a].label} vs ${MTG_COLOR_META[b].label}`);
  }
  if (!allies.length && !enemies.length) return "";
  return `<div class="mtg-harmony-tags">${allies
    .map((t) => `<span class="mtg-harmony-tag mtg-harmony-tag--ally">${escapeHtml(t)}</span>`)
    .join("")}${enemies.map((t) => `<span class="mtg-harmony-tag mtg-harmony-tag--enemy">${escapeHtml(t)}</span>`).join("")}</div>`;
}

function compPickNames(comp) {
  return Object.values(comp || {}).filter(Boolean);
}

function mtgTeamPanelHtml(names, title) {
  if (!names.length || !window.TFM2Draft?.teamColorSummary) return "";
  const metaMap = state.tacticsMeta?.champions || {};
  const summary = window.TFM2Draft.teamColorSummary(names, state.byName, metaMap);
  const pair = (summary.dominant || [])
    .slice(0, 2)
    .map((code) => ({ code, val: Math.round((summary.bars?.find((b) => b.code === code)?.value || 0.12) * 24) }));
  const pastilles =
    pair.length > 0
      ? `<span class="mtg-pastilles mtg-pastilles--inline">${pair
          .map(
            (p, i) =>
              `<span class="mtg-pastille mtg-pastille--${p.code.toLowerCase()} mtg-pastille--${i === 0 ? "primary" : "secondary"}" style="--pastille-weight:${p.val}"></span>`
          )
          .join("")}</span>`
      : "";
  const conflicts = summary.conflicts?.length
    ? `<p class="mtg-team-conflicts">âš  ${escapeHtml(summary.conflicts.join(" Â· "))}</p>`
    : "";
  const comboLabel = summary.combination?.name || summary.identity || "";
  const identityExtra = comboLabel && summary.combination?.type && !["multicolor", "dual", "four"].includes(summary.combination.type)
    ? ` Â· ${escapeHtml(comboLabel)}`
    : "";
  return `<div class="mtg-team-panel">
    <div class="mtg-team-panel-head">
      <span class="mtg-team-panel-title">${escapeHtml(title)}</span>
      <span class="mtg-team-identity">${pastilles} Â· cohÃ©rence ${summary.score >= 0 ? "+" : ""}${summary.score}${identityExtra}</span>
    </div>
    ${conflicts}
    ${mtgHarmonyTagsHtml(summary.dominant, summary.combination)}
  </div>`;
}

function colorFilterMatches(champ, filter) {
  if (!filter || filter === "all") return true;
  const ci = champ?.colorIdentity;
  if (!ci) return false;
  const dom = ci.dominant || [];
  const id = ci.identity || "";
  return dom.includes(filter) || id.includes(filter) || (ci[filter] || 0) >= 6;
}

function countChampionsByColor(code) {
  if (!code || code === "all") return state.champions.length;
  return state.champions.filter((c) => colorFilterMatches(c, code)).length;
}

function buildColorFilterUI() {
  if (!els.colorFilters) return;
  const active = state.colorFilter;
  els.colorFilters.innerHTML = `
    <div class="mtg-filter-dots">
      <button type="button" class="mtg-dot-btn${active === "all" ? " is-active" : ""}" data-color="all" title="Toutes les couleurs">
        <span class="mtg-pastille mtg-pastille--all"></span>
      </button>
      ${MTG_CODES.map((c) => {
        const meta = MTG_COLOR_META[c];
        const n = countChampionsByColor(c);
        return `<button type="button" class="mtg-dot-btn mtg-dot-btn--${c.toLowerCase()}${active === c ? " is-active" : ""}" data-color="${c}" title="${escapeHtml(meta.label)} Â· ${n}" style="--chip-color:${meta.hex}">
          <span class="mtg-pastille mtg-pastille--${c.toLowerCase()} mtg-pastille--primary" style="--pastille-weight:12"></span>
        </button>`;
      }).join("")}
    </div>`;
}

function setupColorFilters() {
  els.colorFilters?.addEventListener("click", (e) => {
    const chip = e.target.closest(".mtg-dot-btn");
    if (!chip) return;
    state.colorFilter = chip.dataset.color || "all";
    buildColorFilterUI();
    renderGrid();
  });
}

function rebuildEffectiveChampions() {
  if (!state.baseChampions.length || !state.patchConfig) return;
  state.champions = window.TFM2Patch.getPlayable(state.baseChampions, state.patchConfig);
  state.byName.clear();
  state.champions.forEach((c) => state.byName.set(c.name, c));
}

function persistPatchConfig() {
  if (!state.patchConfig) return;
  window.TFM2Patch.save(state.patchConfig);
  rebuildEffectiveChampions();
  refreshPatchDependentViews();
  markPatchSaved();
}

function markPatchSaved() {
  els.patchSaveStatus?.classList.remove("is-dirty");
  if (els.patchSaveStatus) els.patchSaveStatus.textContent = "SynchronisÃ© Â· utilisÃ© partout";
}

function refreshPatchDependentViews() {
  updatePatchStats();
  if (state.view === "champions") renderGrid();
  if (state.view === "patch") renderPatchTable();
  if (state.view === "draft" && window.TFM2DraftUI) window.TFM2DraftUI.renderAll?.();
  if (state.view === "tactics") renderTacticsPool({ forceFull: true });
}

function updatePatchStats() {
  if (!state.patchConfig) return;
  const total = state.baseChampions.length;
  const enabled = window.TFM2Patch.countEnabled(state.patchConfig);
  if (els.patchStatCount) {
    els.patchStatCount.textContent = `${enabled} / ${total} en rotation`;
  }
  if (els.countLabel && state.view === "champions") {
    els.countLabel.textContent = `${state.champions.length} en rotation (patch)`;
  }
}

function patchEntryFor(name) {
  return state.patchConfig?.overrides?.[name];
}

function updatePatchEntry(name, patch) {
  if (!state.patchConfig) return;
  window.TFM2Patch.setEntry(state.patchConfig, name, patch);
  persistPatchConfig();
}

function renderPatchTable() {
  if (!els.patchTableBody || !state.patchConfig) return;

  const q = (state.patchSearch || "").toLowerCase();
  const filter = state.patchPoolFilter;
  const rows = state.baseChampions.filter((c) => {
    const entry = patchEntryFor(c.name);
    const enabled = entry?.enabled !== false;
    if (filter === "enabled" && !enabled) return false;
    if (filter === "disabled" && enabled) return false;
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.nameEn || "").toLowerCase().includes(q) ||
      (c.type || "").toLowerCase().includes(q)
    );
  });

  els.patchEmpty?.classList.toggle("hidden", rows.length > 0);
  els.patchTableBody.innerHTML = rows
    .map((c) => {
      const entry = patchEntryFor(c.name);
      const enabled = entry?.enabled !== false;
      const tier = entry?.tierMeta || "C";
      const slots = entry?.optimalSlots || [];
      const display = window.TFM2Patch.applyToChampion(c, entry);

      const slotChips = window.TFM2Patch.SLOTS.map((slot) => {
        const active = slots.includes(slot);
        return `<label class="patch-slot-chip${active ? " is-active" : ""}" title="${slot}">
          <input type="checkbox" data-patch-slot="${slot}" data-champ="${escapeHtml(c.name)}"${active ? " checked" : ""} />
          ${slot}
        </label>`;
      }).join("");

      const tierOptions = window.TFM2Patch.TIERS.map(
        (t) => `<option value="${t}"${t === tier ? " selected" : ""}>${t}</option>`
      ).join("");

      return `<tr class="${enabled ? "" : "is-disabled"}" data-champ="${escapeHtml(c.name)}">
        <td>
          <div class="patch-champ-cell">
            ${championIconHtml(display, { size: "coach" })}
            <span class="patch-champ-name">${escapeHtml(c.name)}</span>
          </div>
        </td>
        <td>
          <label class="patch-toggle">
            <input type="checkbox" class="patch-enabled-toggle" data-champ="${escapeHtml(c.name)}"${enabled ? " checked" : ""} />
            ${enabled ? "Actif" : "Hors rotation"}
          </label>
        </td>
        <td>
          <select class="patch-tier-select tier-${tier.toLowerCase()}" data-champ="${escapeHtml(c.name)}" aria-label="Tier ${escapeHtml(c.name)}">
            ${tierOptions}
          </select>
        </td>
        <td><div class="patch-slots">${slotChips}</div></td>
      </tr>`;
    })
    .join("");

  bindPatchTableEvents();
  updatePatchStats();
}

function bindPatchTableEvents() {
  els.patchTableBody?.querySelectorAll(".patch-enabled-toggle").forEach((input) => {
    input.addEventListener("change", () => {
      updatePatchEntry(input.dataset.champ, { enabled: input.checked });
    });
  });

  els.patchTableBody?.querySelectorAll(".patch-tier-select").forEach((select) => {
    select.addEventListener("change", () => {
      select.className = `patch-tier-select tier-${select.value.toLowerCase()}`;
      updatePatchEntry(select.dataset.champ, { tierMeta: select.value });
    });
  });

  els.patchTableBody?.querySelectorAll(".patch-slot-chip input").forEach((input) => {
    input.addEventListener("change", () => {
      const name = input.dataset.champ;
      const entry = patchEntryFor(name);
      const slots = new Set(entry?.optimalSlots || []);
      if (input.checked) slots.add(input.dataset.patchSlot);
      else slots.delete(input.dataset.patchSlot);
      updatePatchEntry(name, { optimalSlots: window.TFM2Patch.SLOTS.filter((s) => slots.has(s)) });
    });
  });
}

function setupPatchUI() {
  if (els.patchNameInput) {
    els.patchNameInput.value = state.patchConfig?.label || "Patch actuel";
    els.patchNameInput.addEventListener("change", () => {
      if (!state.patchConfig) return;
      state.patchConfig.label = els.patchNameInput.value.trim() || "Patch actuel";
      persistPatchConfig();
    });
  }

  els.patchSearch?.addEventListener("input", (e) => {
    state.patchSearch = e.target.value;
    renderPatchTable();
  });

  els.patchPoolFilters?.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    els.patchPoolFilters.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    state.patchPoolFilter = chip.dataset.pool;
    renderPatchTable();
  });

  els.patchEnableAll?.addEventListener("click", () => {
    if (!state.patchConfig || !confirm("Activer tous les champions dans la rotation ?")) return;
    window.TFM2Patch.setAllEnabled(state.patchConfig, true);
    persistPatchConfig();
  });

  els.patchDisableAll?.addEventListener("click", () => {
    if (!state.patchConfig || !confirm("Retirer tous les champions de la rotation ?")) return;
    window.TFM2Patch.setAllEnabled(state.patchConfig, false);
    persistPatchConfig();
  });

  els.patchResetDefaults?.addEventListener("click", () => {
    if (!confirm("RÃ©initialiser tiers, postes et pool depuis les donnÃ©es de base ?")) return;
    state.patchConfig = window.TFM2Patch.resetToDefaults(state.baseChampions);
    if (els.patchNameInput) els.patchNameInput.value = state.patchConfig.label;
    persistPatchConfig();
  });
}

function tierRank(tier) {
  return TIER_ORDER[tier] ?? 99;
}

function tierBadgeHtml(tier, large = false) {
  if (!tier) return "";
  const cls = `tier-badge tier-${tier.toLowerCase()}${large ? " tier-badge-lg" : ""}`;
  return `<span class="${cls}" title="Tier meta ${tier}">${tier}</span>`;
}

function getTypeClass(type = "") {
  const t = type.toLowerCase();
  if (t.includes("guerrier")) return "type-guerrier";
  if (t.includes("mage")) return "type-mage";
  if (t.includes("support")) return "type-support";
  if (t.includes("distance") || t.includes("Ã  distance")) return "type-distance";
  if (t.includes("assassin")) return "type-assassin";
  return "type-default";
}

function getTypeCategory(type = "") {
  const t = type.toLowerCase();
  if (t.includes("guerrier")) return "Guerrier";
  if (t.includes("assassin")) return "Assassin";
  if (t.includes("support")) return "Support";
  if (t.includes("distance") || t.includes("Ã  distance")) return "Ã€ distance";
  if (t.includes("mage")) return "Mage";
  return "Autre";
}

function initials(name) {
  const parts = name.split(/[\s-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function championIconHtml(champ, { size = "card", alt = "" } = {}) {
  const label = alt || champ.name;
  const typeClass = getTypeClass(champ.type);
  const iconSrc = champ.icon || (champ.id ? `icons/${champ.id}.png` : "");
  if (iconSrc) {
    return `<div class="champ-icon ${typeClass} champ-icon--${size}" role="img" aria-label="${escapeHtml(label)}">
      <img src="${escapeHtml(iconSrc)}" alt="" loading="lazy" decoding="async" onerror="this.closest('.champ-icon').classList.add('champ-icon--fallback'); this.remove();">
      <span class="champ-icon-fallback" aria-hidden="true">${initials(champ.name)}</span>
    </div>`;
  }
  return `<div class="champ-icon champ-icon--fallback ${typeClass} champ-icon--${size}" aria-label="${escapeHtml(label)}">${initials(champ.name)}</div>`;
}

function escapeHtml(text = "") {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mdInline(text = "") {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = linkChampionNames(html);
  html = linkItemNames(html);
  return html;
}

function linkChampionNames(html) {
  for (const name of CHAMP_NAMES_SORTED) {
    if (!state.byName.has(name)) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![\\w-])(${escaped})(?![\\w-])`, "g");
    html = html.replace(
      re,
      `<button type="button" class="champ-link" data-champ="${escapeHtml(name)}">$1</button>`
    );
  }
  return html;
}

function linkItemNames(html) {
  for (const name of ITEM_NAMES_SORTED) {
    if (!state.byItemName.has(name)) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![\\w-])(${escaped})(?![\\w-])`, "g");
    html = html.replace(
      re,
      `<button type="button" class="item-link" data-item="${escapeHtml(name)}">$1</button>`
    );
  }
  return html;
}

function mdBlock(text = "") {
  const blocks = text.trim().split(/\n\n+/);
  return blocks
    .map((block) => {
      const trimmed = block.trim();
      if (trimmed.startsWith("|")) {
        return renderMarkdownTable(trimmed);
      }
      if (/^\d+\.\s/.test(trimmed)) {
        const items = trimmed.split(/\n(?=\d+\.\s)/);
        return `<ol>${items.map((li) => `<li>${mdInline(li.replace(/^\d+\.\s*/, ""))}</li>`).join("")}</ol>`;
      }
      if (trimmed.startsWith("- ")) {
        const items = trimmed.split(/\n- /);
        return `<ul>${items.map((li, i) => `<li>${mdInline(i === 0 ? li.replace(/^- /, "") : li)}</li>`).join("")}</ul>`;
      }
      return `<p>${mdInline(trimmed.replace(/\n/g, " "))}</p>`;
    })
    .join("");
}

function renderMarkdownTable(text) {
  const rows = text.split("\n").filter((r) => r.trim());
  if (rows.length < 2) return `<p>${mdInline(text)}</p>`;
  const headerCells = rows[0].split("|").filter(Boolean).map((c) => c.trim());
  const bodyRows = rows.slice(2);
  const thead = `<thead><tr>${headerCells.map((c) => `<th>${mdInline(c)}</th>`).join("")}</tr></thead>`;
  const tbody = bodyRows
    .map((row) => {
      const cells = row.split("|").filter(Boolean).map((c) => c.trim());
      return `<tr>${cells.map((c) => `<td>${mdInline(c)}</td>`).join("")}</tr>`;
    })
    .join("");
  return `<table>${thead}<tbody>${tbody}</tbody></table>`;
}

function normalize(str = "") {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesFilters(champ) {
  const q = normalize(state.search);
  if (q) {
    const hay = normalize(
      [champ.name, champ.nameEn, champ.type, champ.positions, champ.raison, champ.tierMeta, champ.tierNote].join(" ")
    );
    if (!hay.includes(q)) return false;
  }

  if (state.slotFilter !== "all") {
    const slots = champ.optimalSlots || [];
    if (!slots.some((s) => s.includes(state.slotFilter))) return false;
  }

  if (state.typeFilter !== "all") {
    if (getTypeCategory(champ.type) !== state.typeFilter) return false;
  }

  if (state.tierFilter !== "all") {
    if (champ.tierMeta !== state.tierFilter) return false;
  }

  if (state.colorFilter !== "all" && !colorFilterMatches(champ, state.colorFilter)) {
    return false;
  }

  return true;
}

function renderGrid() {
  const filtered = state.champions.filter(matchesFilters).sort((a, b) => {
    const tr = tierRank(a.tierMeta) - tierRank(b.tierMeta);
    if (tr !== 0) return tr;
    return a.name.localeCompare(b.name, "fr");
  });
  els.countLabel.textContent = `${filtered.length} / ${state.champions.length} (rotation patch)`;
  els.grid.innerHTML = "";
  els.empty.classList.toggle("hidden", filtered.length > 0);

  for (const champ of filtered) {
    const btn = document.createElement("button");
    btn.className = `champion-card ${getTypeClass(champ.type)}${state.selectedId === champ.id ? " selected" : ""}`;
    btn.type = "button";
    btn.dataset.id = champ.id;
    btn.setAttribute("aria-label", champ.name);

    const slot = champ.optimalSlots?.[0] || "Flex";
    btn.innerHTML = `
      ${tierBadgeHtml(champ.tierMeta)}
      ${championIconHtml(champ, { size: "card" })}
      <div class="card-body">
        <div class="card-name">${champ.name}</div>
        ${champ.nameEn ? `<div class="card-en">${champ.nameEn}</div>` : ""}
        <div class="card-badges">
          <span class="badge badge-type">${getTypeCategory(champ.type)}</span>
          <span class="badge badge-slot">${slot}</span>
        </div>
        <div class="card-meta-color">${mtgPastillesHtml(champ, { variant: "micro" })}</div>
      </div>
    `;

    btn.addEventListener("click", () => openDetail(champ.id));
    els.grid.appendChild(btn);
  }
}

function renderDetail(champ) {
  const abilitiesHtml = champ.abilities
    .map(
      (a) => `
      <div class="ability-card ${a.slot === "Ultimate" ? "ultimate" : ""}">
        <div class="ability-header">
          <span class="ability-slot">${a.slot}</span>
          <span class="ability-meta">${a.meta}</span>
        </div>
        <div class="ability-desc">${mdInline(a.description)}</div>
      </div>
    `
    )
    .join("");

  const worstHtml = champ.worstMatchups
    .map(
      (n) =>
        `<button type="button" class="matchup-chip worst" data-champ="${n}">${n}</button>`
    )
    .join("");

  const bestHtml = champ.bestPairings
    .map(
      (n) =>
        `<button type="button" class="matchup-chip best" data-champ="${n}">${n}</button>`
    )
    .join("");

  els.detailContent.innerHTML = `
    <div class="detail-inner">
      <div class="detail-hero">
        ${championIconHtml(champ, { size: "detail" })}
        <div class="detail-title">
          <div class="detail-title-row">
            <h2>${champ.name}</h2>
            ${tierBadgeHtml(champ.tierMeta, true)}
          </div>
          ${champ.nameEn ? `<div class="en-name">${champ.nameEn}</div>` : ""}
          <div class="detail-meta">
            <span class="badge badge-type">${champ.type || "â€”"}</span>
            ${(champ.optimalSlots || []).map((s) => `<span class="badge badge-slot">${s}</span>`).join("")}
          </div>
        </div>
      </div>

      ${
        champ.tierNote
          ? `<section class="detail-section tier-note-section">
        <h3>Tier meta ${champ.tierMeta || "â€”"}</h3>
        <p class="text-block tier-note-text">${escapeHtml(champ.tierNote)}</p>
      </section>`
          : ""
      }

      ${
        champ.colorIdentity
          ? `<section class="detail-section">
        <h3>IdentitÃ© couleur (MTG)</h3>
        <p class="text-block detail-mtg">
          ${mtgPastillesHtml(champ, { variant: "detail" })}
          <strong>${escapeHtml(champ.colorIdentity.identity || "")}</strong>
          <span class="detail-mtg-philo">${escapeHtml(
            (champ.colorIdentity.dominant || [])
              .map((c) => MTG_COLOR_META[c]?.philosophy)
              .filter(Boolean)
              .join(" Â· ")
          )}</span>
        </p>
      </section>`
          : ""
      }

      <section class="detail-section">
        <h3>Positions</h3>
        <p class="text-block">${champ.positions || "â€”"}</p>
      </section>

      <section class="detail-section">
        <h3>Raison TFM2</h3>
        <p class="text-block">${champ.raison || "â€”"}</p>
      </section>

      ${
        champ.stats
          ? `<section class="detail-section"><h3>Stats Lv.12</h3><div class="stats-block">${champ.stats}</div></section>`
          : ""
      }

      ${
        champ.visual
          ? `<section class="detail-section"><h3>RepÃ¨re visuel</h3><p class="visual-note">${champ.visual}${champ.grid ? ` Â· ${champ.grid}` : ""}</p></section>`
          : ""
      }

      <section class="detail-section">
        <h3>Pires matchups</h3>
        <div class="matchup-list">${worstHtml || "<span class='text-block'>â€”</span>"}</div>
      </section>

      <section class="detail-section">
        <h3>Meilleurs pairings</h3>
        <div class="matchup-list">${bestHtml || "<span class='text-block'>â€”</span>"}</div>
      </section>

      ${
        champ.build?.length
          ? `<section class="detail-section">
        <h3>Build optimal</h3>
        <div class="build-list">${champ.build
          .map(
            (item, i) =>
              `<div class="build-slot"><span class="build-order">${i + 1}</span><button type="button" class="build-chip" data-item="${escapeHtml(item)}">${escapeHtml(item)}</button></div>`
          )
          .join("")}</div>
      </section>`
          : ""
      }

      <section class="detail-section">
        <h3>Abilities</h3>
        ${abilitiesHtml}
      </section>
    </div>
  `;

  bindChampLinks(els.detailContent);
  els.detailContent.querySelectorAll(".build-chip").forEach((chip) => {
    chip.addEventListener("click", () => scrollToItem(chip.dataset.item));
  });
}

function scrollToItem(name) {
  setView("items");
  requestAnimationFrame(() => {
    const card = document.querySelector(`[data-item-id="${CSS.escape(name)}"]`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    card?.classList.add("highlight");
    setTimeout(() => card?.classList.remove("highlight"), 2000);
  });
}

function bindChampLinks(root) {
  root.querySelectorAll(".champ-link, .matchup-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const target = state.byName.get(chip.dataset.champ);
      if (target) openDetail(target.id);
    });
  });
}

function openDetail(id) {
  const champ = state.champions.find((c) => c.id === id);
  if (!champ) return;

  if (state.view !== "champions") {
    setView("champions");
  }

  state.selectedId = id;
  renderDetail(champ);
  renderGrid();

  els.detail.classList.add("open");
  els.detail.setAttribute("aria-hidden", "false");
  els.overlay.classList.remove("hidden");
}

function closeDetail() {
  state.selectedId = null;
  els.detail.classList.remove("open");
  els.detail.setAttribute("aria-hidden", "true");
  els.overlay.classList.add("hidden");
  renderGrid();
}

function renderItems() {
  const filtered = state.items.filter((item) => {
    if (state.itemTierFilter === "all") return true;
    return String(item.tier) === state.itemTierFilter;
  });

  els.itemsCountLabel.textContent = `${filtered.length} / ${state.items.length} objets`;
  els.itemsGrid.innerHTML = filtered
    .sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name, "fr"))
    .map((item) => {
      const champs =
        item.typicalChampions
          ?.map(
            (n) =>
              state.byName.has(n)
                ? `<button type="button" class="champ-link" data-champ="${escapeHtml(n)}">${escapeHtml(n)}</button>`
                : escapeHtml(n)
          )
          .join(" Â· ") || "";

      return `
        <article class="item-card tier-${item.tier}" data-item-id="${escapeHtml(item.name)}">
          <div class="item-card-header">
            <h3>${escapeHtml(item.name)}</h3>
            <span class="item-tier-badge">T${item.tier}</span>
          </div>
          <div class="item-cost">${item.cost} or</div>
          ${item.type ? `<div class="item-type">${escapeHtml(item.type)}</div>` : ""}
          <div class="item-stats">${escapeHtml(item.stats)}</div>
          ${item.passive ? `<div class="item-passive">${mdInline(item.passive)}</div>` : ""}
          ${champs ? `<div class="item-champs"><span class="item-champs-label">Pour :</span> ${champs}</div>` : ""}
        </article>`;
    })
    .join("");

  bindChampLinks(els.itemsGrid);
}

function renderGuide() {
  const guide = state.guide;
  if (!guide) return;

  els.guideToc.innerHTML = guide.sections
    .map(
      (sec) =>
        `<a href="#guide-${sec.id}" class="guide-toc-link" data-section="${sec.id}">${sec.title}</a>`
    )
    .join("");

  const sectionsHtml = guide.sections
    .map((sec) => {
      let body = "";
      if (sec.note) {
        body += `<p class="guide-note">${mdInline(sec.note)}</p>`;
      }
      if (sec.content) {
        body += `<div class="guide-body">${mdBlock(sec.content)}</div>`;
      }
      if (sec.tiers) {
        body += `<div class="tier-list">${sec.tiers
          .map((t) => {
            const nameHtml = state.byName.has(t.name)
              ? `<button type="button" class="champ-link" data-champ="${escapeHtml(t.name)}">${escapeHtml(t.name)}</button>`
              : escapeHtml(t.name);
            return `
          <div class="tier-entry">
            <div class="tier-entry-name">${nameHtml}</div>
            <div class="tier-entry-text">${mdInline(t.text)}</div>
          </div>`;
          })
          .join("")}</div>`;
      }
      if (sec.tactics) {
        body += `<div class="tactic-list">${sec.tactics
          .map(
            (t) => `
          <div class="tactic-entry">
            <div class="tactic-entry-name">${mdInline(t.name)}</div>
            <div class="tactic-entry-text">${mdInline(t.text)}</div>
          </div>`
          )
          .join("")}</div>`;
      }
      return `
        <section class="guide-section" id="guide-${sec.id}">
          <h3>${sec.title}</h3>
          ${body}
        </section>`;
    })
    .join("");

  els.guideContent.innerHTML = `
    <header class="guide-hero">
      <h2>${guide.title}</h2>
      <p class="guide-meta">${guide.subtitle} Â· <a href="${guide.sourceUrl}" target="_blank" rel="noopener">Source Steam</a></p>
      <p class="guide-disclaimer">${guide.disclaimer}</p>
    </header>
    ${sectionsHtml}
  `;

  bindChampLinks(els.guideContent);

  els.guideToc.querySelectorAll(".guide-toc-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const el = document.getElementById(`guide-${link.dataset.section}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

const TACTIC_ORDER = [
  "focusLane",
  "earlyJungle",
  "earlySerpent",
  "topSerpent",
  "waveMgmt",
  "objectivePrep",
  "objectiveCombat",
  "objectiveFinish",
  "morgard",
  "towerSiege",
  "defense",
  "closing",
];

const TACTIC_LABELS = {
  focusLane: "Focus de Lane",
  earlyJungle: "Style de Jungle PrÃ©coce",
  earlySerpent: "Tentative de Serpent PrÃ©coce",
  topSerpent: "Top Laner au Serpent PrÃ©coce",
  waveMgmt: "Gestion des Vagues de Sbires",
  objectivePrep: "PrÃ©paration d'Objectif",
  objectiveCombat: "StratÃ©gie de Combat d'Objectif",
  objectiveFinish: "Finalisation d'Objectif",
  morgard: "Utilisation du Buff Morgard",
  towerSiege: "SiÃ¨ge de Tour",
  defense: "Tactiques DÃ©fensives",
  closing: "Conclusion de Partie",
};

function getTacticTemplates() {
  const templates = state.jungleGuide?.templates || [];
  const out = {};
  for (const t of templates) {
    if (t.key && t.our && t.enemy) out[t.key] = { our: t.our, enemy: t.enemy, label: t.label };
  }
  return out;
}

function verdictLabel(v) {
  if (v === "win") return '<span class="verdict win">Favorable</span>';
  if (v === "lose") return '<span class="verdict lose">DÃ©favorable</span>';
  return '<span class="verdict even">Ã‰gal</span>';
}

const TACTICS_SLOT_ICONS = { Top: "â–£", Jungle: "ðŸ”¥", Mid: "âš¡", Bot: "â—Ž", Support: "âœš" };
const DRAFT_STORAGE_KEY = "tfm2-draft-sessions-v1";

function syncDraftSessionsFromStorage() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      state.draftSessions = [];
      state.activeDraftId = null;
      return;
    }
    const parsed = JSON.parse(raw);
    state.draftSessions = (Array.isArray(parsed.sessions) ? parsed.sessions : []).map((s) =>
      window.TFM2Draft.normalizeSession(s)
    );
    state.activeDraftId = parsed.activeId || null;
  } catch {
    state.draftSessions = [];
    state.activeDraftId = null;
  }
}

function getImportableDraftSession() {
  syncDraftSessionsFromStorage();
  if (!state.draftSessions.length) return null;
  let session = state.draftSessions.find((s) => s.id === state.activeDraftId);
  if (!session) {
    session = [...state.draftSessions].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  }
  return session;
}

function countCompPicks(comp) {
  return tacticsSlots().filter((s) => comp[s]).length;
}

function updateImportDraftButton() {
  const btn = els.importDraftTactics;
  if (!btn) return;
  const session = getImportableDraftSession();
  if (!session) {
    btn.disabled = true;
    btn.textContent = "Importer la draft";
    btn.title = "Aucune draft â€” crÃ©e-en une dans lâ€™onglet Draft";
    return;
  }
  btn.disabled = false;
  const { ourComp, enemyComp } = window.TFM2Draft.toComps(session);
  const picks = countCompPicks(ourComp) + countCompPicks(enemyComp);
  btn.textContent = `Importer ${session.name}`;
  btn.title = `${session.name} â€” ${picks} pick${picks !== 1 ? "s" : ""} enregistrÃ©${picks !== 1 ? "s" : ""}`;
}

function importDraftToTactics() {
  const session = getImportableDraftSession();
  if (!session) {
    if (els.tacticsFocusHint) {
      els.tacticsFocusHint.textContent = "Aucune draft trouvÃ©e. Utilise lâ€™onglet Draft dâ€™abord.";
    }
    return;
  }

  const { ourComp, enemyComp } = window.TFM2Draft.toComps(session);
  Object.assign(state.ourComp, ourComp);
  Object.assign(state.enemyComp, enemyComp);
  state.tacticsFocus = null;
  renderTacticsDraft();
  updateImportDraftButton();

  const ours = countCompPicks(state.ourComp);
  const theirs = countCompPicks(state.enemyComp);
  const complete = ours === 5 && theirs === 5;

  if (els.tacticsFocusHint) {
    els.tacticsFocusHint.textContent = complete
      ? `Draft Â« ${session.name} Â» importÃ©e â€” prÃªte Ã  analyser.`
      : `Draft Â« ${session.name} Â» importÃ©e (${ours}/5 Â· ${theirs}/5) â€” complÃ¨te les lanes vides si besoin.`;
  }

  els.tacticsResult.classList.add("hidden");
  els.tacticsResult.innerHTML = "";
}

function tacticsSlots() {
  return window.TFM2Tactics?.SLOTS || ["Top", "Jungle", "Mid", "Bot", "Support"];
}

function tacticsComp(side) {
  return side === "our" ? state.ourComp : state.enemyComp;
}

function isTacticsCellFocused(side, slot) {
  const f = state.tacticsFocus;
  return f && f.side === side && f.slot === slot;
}

function setTacticsFocus(side, slot) {
  state.tacticsFocus = { side, slot };
  renderTacticsDraft();
}

function assignTacticsChampion(name) {
  if (!state.tacticsFocus) {
    const slots = tacticsSlots();
    for (const side of ["our", "enemy"]) {
      const comp = tacticsComp(side);
      const empty = slots.find((s) => !comp[s]);
      if (empty) {
        state.tacticsFocus = { side, slot: empty };
        break;
      }
    }
  }
  if (!state.tacticsFocus) return;
  const { side, slot } = state.tacticsFocus;
  const comp = tacticsComp(side);
  comp[slot] = name;
  const next = tacticsSlots().find((s) => !comp[s]);
  state.tacticsFocus = next ? { side, slot: next } : null;
  renderTacticsDraft();
}

function getTacticsCompCompare() {
  if (!window.TFM2Draft?.compareComps) return null;
  const metaMap = state.tacticsMeta?.champions || {};
  return window.TFM2Draft.compareComps(state.ourComp, state.enemyComp, state.byName, metaMap);
}

function renderTacticsCompScoreHtml(comp) {
  if (!comp?.complete) {
    const our = comp?.ourCount ?? countCompPicks(state.ourComp);
    const en = comp?.enemyCount ?? countCompPicks(state.enemyComp);
    return `<div class="tactics-comp-score-inner tactics-comp-score-pending">
      <p class="tactics-comp-score-title">Score de comp</p>
      <p class="muted">ComplÃ¨te les deux Ã©quipes (5/5) pour afficher le score et les probabilitÃ©s de victoire.
        <span class="tactics-comp-score-progress">Nous ${our}/5 Â· Adversaire ${en}/5</span></p>
    </div>`;
  }

  const ourPct = Math.round(comp.winProb.our * 100);
  const enemyPct = Math.round(comp.winProb.enemy * 100);
  const fav = ourPct >= enemyPct ? "our" : "enemy";

  const breakdownRow = (label, key) => {
    const o = comp.our.breakdown[key] ?? 0;
    const e = comp.enemy.breakdown[key] ?? 0;
    return `<tr><td>${label}</td><td class="num our-num">${o}</td><td class="num enemy-num">${e}</td></tr>`;
  };

  return `<div class="tactics-comp-score-inner">
    <p class="tactics-comp-score-title">Analyse draft — score comp TFM2 &amp; winrate estimé</p>
    <div class="tactics-comp-duel">
      <div class="tactics-comp-side our-team${fav === "our" ? " is-favored" : ""}">
        <span class="tactics-comp-label">Notre comp</span>
        <span class="tactics-comp-points">${comp.our.score}</span>
        <span class="tactics-comp-win">${ourPct}% victoire</span>
      </div>
      <div class="tactics-comp-vs">VS</div>
      <div class="tactics-comp-side enemy-team${fav === "enemy" ? " is-favored" : ""}">
        <span class="tactics-comp-label">Adversaire</span>
        <span class="tactics-comp-points">${comp.enemy.score}</span>
        <span class="tactics-comp-win">${enemyPct}% victoire</span>
      </div>
    </div>
    <div class="tactics-win-bar" role="img" aria-label="ProbabilitÃ© victoire ${ourPct}% nous, ${enemyPct}% adversaire">
      <div class="tactics-win-bar-our" style="width:${ourPct}%"></div>
      <div class="tactics-win-bar-enemy" style="width:${enemyPct}%"></div>
    </div>
    <p class="tactics-comp-margin muted">Écart de score : ${comp.margin >= 0 ? "+" : ""}${comp.margin} · faveur ${fav === "our" ? "bleue" : "rouge"}${comp.our.plan ? ` · Plan : ${escapeHtml(comp.our.plan)}` : ""}${comp.our.goal ? ` · Objectif : ${escapeHtml(comp.our.goal)}` : ""}${comp.misassignmentWarning ? ` · ⚠ ${escapeHtml(comp.misassignmentWarning)}` : ""}${comp.our.gaps?.length ? ` · Manque : ${escapeHtml(comp.our.gaps.slice(0, 2).join(", "))}` : ""}</p>
    ${comp.roles ? `<p class="tactics-comp-margin muted">Inévitabilité ${Math.round(comp.roles.ourInevitability)} vs ${Math.round(comp.roles.enemyInevitability)}${comp.roles.dualRole ? " · double rôle (board + late)" : ""} · table ${comp.roles.tableGap >= 0 ? "+" : ""}${Math.round(comp.roles.tableGap)}</p>` : ""}
    <details class="tactics-comp-details">
      <summary>Détail scoring (skeleton · synergies · counters)</summary>
      <table class="tactics-comp-breakdown">
        <thead><tr><th>Axe</th><th>Nous</th><th>Ennemi</th></tr></thead>
        <tbody>
          ${breakdownRow("Équilibre skeleton", "balance")}
          ${breakdownRow("Synergies", "synergy")}
          ${breakdownRow("Counters", "counter")}
          ${breakdownRow("Lanes", "lane")}
          ${breakdownRow("Tier meta", "tier")}
        </tbody>
      </table>
    </details>
  </div>`;
}

function updateTacticsCompScore() {
  const el = els.tacticsCompScore;
  if (!el) return;
  const comp = getTacticsCompCompare();
  const filled = countCompPicks(state.ourComp) + countCompPicks(state.enemyComp);
  if (filled === 0) {
    el.classList.add("hidden");
    el.innerHTML = "";
    return;
  }
  el.classList.remove("hidden");
  el.innerHTML = renderTacticsCompScoreHtml(comp);
}

function tacticsPoolCtx() {
  return {
    hotNames: new Set(),
    escapeHtml,
    iconHtml: (c) => championIconHtml(c, { size: "pool-lol" }),
    getTypeClass,
  };
}

function getTacticsPoolFiltered() {
  const Pool = window.TFM2ChampionPool;
  const searchQuery = state.tacticsPoolSearch || "";
  const typeFilter = state.tacticsPoolType || "all";
  const filtered = Pool
    ? Pool.filterChampions(state.champions, { search: searchQuery, type: typeFilter })
    : state.champions.filter((c) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  return { searchQuery, typeFilter, filtered };
}

function renderTacticsPoolGrid(champions) {
  const Pool = window.TFM2ChampionPool;
  if (Pool?.renderGrid) return Pool.renderGrid(champions, tacticsPoolCtx());
  return champions.map((c) => `<button type="button" class="draft-pool-card" data-champ="${escapeHtml(c.name)}">${escapeHtml(c.name)}</button>`).join("");
}

function renderTacticsPoolRoleBar(activeType) {
  return window.TFM2ChampionPool?.renderRoleBar?.(activeType, escapeHtml) || "";
}

function bindTacticsPoolEvents(container) {
  if (!container || container.dataset.poolBound === "1") return;
  container.dataset.poolBound = "1";
  container.addEventListener("click", (e) => {
    const roleBtn = e.target.closest("[data-pool-role]");
    if (roleBtn && container.contains(roleBtn)) {
      state.tacticsPoolType = roleBtn.dataset.poolRole || "all";
      container.querySelectorAll(".pool-role-btn").forEach((b) => {
        const on = b.dataset.poolRole === state.tacticsPoolType;
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      renderTacticsPool({ gridOnly: true });
      return;
    }
    const btn = e.target.closest(".draft-pool-card");
    if (btn && container.contains(btn)) assignTacticsChampion(btn.dataset.champ);
  });
  container.addEventListener("input", (e) => {
    if (e.target.id !== "tactics-pool-search") return;
    state.tacticsPoolSearch = e.target.value;
    renderTacticsPool({ gridOnly: true });
  });
}

function ensureLolPoolGrid(gridEl) {
  if (!gridEl) return;
  gridEl.classList.remove("draft-pool-grid-alpha");
  gridEl.classList.add("draft-pool-grid-lol");
}

function updateTacticsPoolGrid(el, filtered) {
  const countEl = el.querySelector(".draft-pool-count");
  if (countEl) countEl.textContent = `${filtered.length} dispo · ${state.champions.length} rotation patch`;

  const gridEl = el.querySelector(".draft-pool-grid");
  ensureLolPoolGrid(gridEl);
  if (gridEl) {
    gridEl.innerHTML = filtered.length
      ? renderTacticsPoolGrid(filtered)
      : `<p class="muted draft-pool-empty">Aucun champion pour ce filtre.</p>`;
  }
}

function tacticsPoolNeedsFullRender(el) {
  return !el?.querySelector(".pool-role-bar") || !el?.querySelector(".draft-pool-grid-lol");
}

function renderTacticsPool({ gridOnly = false, forceFull = false } = {}) {
  const el = els.tacticsPool;
  if (!el) return;

  const { searchQuery, typeFilter, filtered } = getTacticsPoolFiltered();
  const full = forceFull || !gridOnly || tacticsPoolNeedsFullRender(el);

  if (!full && el.querySelector("#tactics-pool-search")) {
    updateTacticsPoolGrid(el, filtered);
    return;
  }

  const focus = state.tacticsFocus;
  const actionText = focus
    ? `${focus.side === "our" ? "Notre" : "Adversaire"} · ${focus.slot} → choisis un champion`
    : "Clique une lane ci-dessus, puis un champion";

  el.innerHTML = `
    <div class="draft-pool-header">
      <h2 class="draft-pool-title">Champions</h2>
      <span class="draft-pool-count">${filtered.length} dispo · ${state.champions.length} rotation patch</span>
    </div>
    <div class="draft-pool-action${focus ? " focus-ready" : ""}">${escapeHtml(actionText)}</div>
    ${renderTacticsPoolRoleBar(typeFilter)}
    <div class="draft-pool-toolbar">
      <input type="search" class="draft-pool-search" placeholder="Rechercher un champion…" value="${escapeHtml(searchQuery)}" id="tactics-pool-search" autocomplete="off" />
    </div>
    <div class="draft-pool-grid draft-pool-grid-lol">
      ${filtered.length ? renderTacticsPoolGrid(filtered) : `<p class="muted draft-pool-empty">Aucun champion pour ce filtre.</p>`}
    </div>
  `;

  delete el.dataset.poolBound;
  bindTacticsPoolEvents(el);
}

function renderTacticsSlotGrid(side, container, comp) {
  const slots = tacticsSlots();
  container.innerHTML = slots
    .map((slot) => {
      const name = comp[slot];
      const champ = name ? state.byName.get(name) : null;
      const focused = isTacticsCellFocused(side, slot);
      return `
        <button type="button"
          class="draft-cell draft-pick-cell tactics-slot-cell${name ? " filled" : " empty"}${focused ? " draft-cell-focused" : ""}"
          data-tactics-side="${side}" data-tactics-slot="${slot}"
          aria-label="${side === "our" ? "Notre" : "Adversaire"} ${slot}${name ? ` : ${name}` : ""}">
          <span class="draft-cell-tag">${TACTICS_SLOT_ICONS[slot]} ${slot}</span>
          ${
            champ
              ? championIconHtml(champ, { size: "draft" })
              : `<span class="draft-cell-plus">+</span>`
          }
          <span class="draft-cell-name">${name ? escapeHtml(champ?.name || name) : ""}</span>
        </button>`;
    })
    .join("");

  container.querySelectorAll("[data-tactics-side]").forEach((cell) => {
    cell.addEventListener("click", () => {
      setTacticsFocus(cell.dataset.tacticsSide, cell.dataset.tacticsSlot);
    });
  });
}

function renderTacticsDraft() {
  renderTacticsSlotGrid("our", els.ourSlots, state.ourComp);
  renderTacticsSlotGrid("enemy", els.enemySlots, state.enemyComp);
  const poolEl = els.tacticsPool;
  const focus = state.tacticsFocus;
  const actionText = focus
    ? `${focus.side === "our" ? "Notre" : "Adversaire"} Â· ${focus.slot} â†’ choisis un champion`
    : "Clique une lane ci-dessus, puis un champion";
  if (tacticsPoolNeedsFullRender(poolEl)) {
    renderTacticsPool({ forceFull: true });
  } else {
    const actionEl = poolEl?.querySelector(".draft-pool-action");
    if (actionEl) {
      actionEl.textContent = actionText;
      actionEl.classList.toggle("focus-ready", Boolean(focus));
    }
    renderTacticsPool({ gridOnly: true });
  }
  updateTacticsCompScore();
  if (els.tacticsFocusHint) {
    els.tacticsFocusHint.textContent = state.tacticsFocus
      ? `${state.tacticsFocus.side === "our" ? "Notre Ã©quipe" : "Adversaire"} Â· ${state.tacticsFocus.slot} â€” choisis un champion dans la liste`
      : "Clique une lane, puis un champion ci-dessous (A â†’ Z)";
  }
}

function applyTacticTemplate(key) {
  const t = getTacticTemplates()[key];
  if (!t) return;
  Object.assign(state.ourComp, t.our);
  Object.assign(state.enemyComp, t.enemy);
  renderTacticsDraft();
  runTacticsAnalysis();
}

function renderTacticsSidebar() {
  const guide = state.jungleGuide;
  if (!guide) return;

  if (els.tacticsQuickIndex) {
    els.tacticsQuickIndex.innerHTML = (guide.quickSettingsIndex || [])
      .map(
        (e) => `<div class="tactics-quick-row">
          <strong>${escapeHtml(e.draftGoal)}</strong>
          <span class="muted">${escapeHtml(e.earlyJungle)} · ${escapeHtml(e.earlySerpent)} · ${escapeHtml(e.objectiveCombat)}</span>
          <span class="tactics-quick-ex">${escapeHtml(e.example)}</span>
        </div>`
      )
      .join("");
  }

  if (els.tacticsTemplates) {
    els.tacticsTemplates.innerHTML = (guide.templates || [])
      .map(
        (t) =>
          `<button type="button" class="template-btn" data-template="${escapeHtml(t.key)}" title="${escapeHtml(t.draft || "")}">${escapeHtml(t.label)}</button>`
      )
      .join("");
    els.tacticsTemplates.querySelectorAll(".template-btn").forEach((btn) => {
      btn.addEventListener("click", () => applyTacticTemplate(btn.dataset.template));
    });
  }

  if (els.tacticsJungleFitRef) {
    const heroes = guide.heroJungleChampions || [];
    els.tacticsJungleFitRef.innerHTML = heroes
      .map((name) => {
        const fit = guide.jungleChampionFit?.[name];
        if (!fit) return "";
        return `<div class="jungle-fit-row">
          <strong>${escapeHtml(name)}</strong>
          <span>${escapeHtml(fit.label || fit.earlyJungle)}</span>
          <em class="muted">${escapeHtml(fit.verify || "")}</em>
        </div>`;
      })
      .join("");
  }
}

function renderItemSlotCell(slotRec) {
  const reason = slotRec.reason || "";
  const itemName = slotRec.item || "";
  const category = slotRec.label || "â€”";
  const itemBtn = itemName
    ? `<button type="button" class="build-chip tactics-item-chip" data-item="${escapeHtml(itemName)}" title="${escapeHtml(reason)}">${escapeHtml(itemName)}</button>`
    : `<span class="muted">â€”</span>`;
  return `
    <div class="tactics-item-slot-rec" title="${escapeHtml(reason)}">
      ${itemBtn}
      <span class="item-cat-badge">${escapeHtml(category)}</span>
    </div>`;
}

function renderItemGuideTable(guides, teamLabel, teamClass) {
  if (!guides?.length) return "";

  const rows = guides
    .map((guide) => {
      const champ = state.byName.get(guide.champion);
      const champCell = `
        <td>
          <div class="tactics-item-champ">
            ${champ ? championIconHtml(champ, { size: "coach" }) : ""}
            <div class="tactics-item-champ-meta">
              <strong>${escapeHtml(guide.champion)}</strong>
              <span>${escapeHtml(guide.laneSlot)}</span>
            </div>
          </div>
        </td>`;
      const itemCells = guide.slots
        .map((slotRec) => `<td>${renderItemSlotCell(slotRec)}</td>`)
        .join("");
      return `<tr class="tactics-item-row">${champCell}${itemCells}</tr>`;
    })
    .join("");

  return `
    <div class="tactics-item-team ${teamClass}">
      <h4 class="tactics-item-team-title">${escapeHtml(teamLabel)}</h4>
      <div class="tactics-item-table-wrap">
        <table class="tactics-item-table">
          <thead>
            <tr>
              <th>Champion</th>
              <th>1er Objet</th>
              <th>2e Objet</th>
              <th>3e Objet</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function renderTacticsItemGuidesSection(itemGuides) {
  if (!itemGuides?.our?.length) return "";

  return `
    <section class="tactics-block tactics-items-block">
      <h3>Objets (Ã©cran Tactiques in-game)</h3>
      <p class="tactics-items-hint">
        Objet recommandÃ© (scaling sorts + dÃ©gÃ¢ts adverses) et <strong>catÃ©gorie in-game</strong> Ã  rÃ©gler sur l'Ã©cran Tactiques.
        Survole un objet pour le dÃ©tail â€” clic ouvre la fiche objet.
      </p>
      ${renderItemGuideTable(itemGuides.our, "Notre Ã©quipe", "our-team")}
      ${
        itemGuides.enemy?.length
          ? renderItemGuideTable(itemGuides.enemy, "Adversaire (builds probables)", "enemy-team")
          : ""
      }
    </section>`;
}

function renderTacticAssignees(assignees) {
  if (!assignees?.length) return "";
  return `<div class="tactic-assign">${assignees
    .map((a) => {
      const champ = state.byName.get(a.name);
      const icon = champ ? championIconHtml(champ, { size: "coach" }) : "";
      return `<span class="tactic-assign-chip">${icon}<span>${escapeHtml(a.name)} <em>(${escapeHtml(a.slot)})</em></span></span>`;
    })
    .join("")}</div>`;
}

function renderTacticValueCell(t) {
  if (!t?.value) return "â€”";
  return `<strong>${escapeHtml(t.value)}</strong>${renderTacticAssignees(t.assign)}`;
}

function runTacticsAnalysis() {
  const slots = window.TFM2Tactics?.SLOTS || [];
  const missing = slots.filter((s) => !state.ourComp[s] || !state.enemyComp[s]);
  if (missing.length) {
    els.tacticsResult.classList.remove("hidden");
    updateTacticsCompScore();
    els.tacticsResult.innerHTML = `<div class="tactics-alert">ComplÃ¨te toutes les lanes (${missing.join(", ")} manquant).</div>`;
    return;
  }

  if (!window.TFM2Tactics?.recommend) {
    els.tacticsResult.classList.remove("hidden");
    els.tacticsResult.innerHTML = `<div class="tactics-alert">Moteur tactiques indisponible â€” recharge la page (Ctrl+F5).</div>`;
    return;
  }

  let result;
  try {
    const metaMap = state.tacticsMeta?.champions || {};
    result = window.TFM2Tactics.recommend(state.ourComp, state.enemyComp, metaMap, state.byName);
  } catch (err) {
    console.error("TFM2Tactics.recommend", err);
    els.tacticsResult.classList.remove("hidden");
    els.tacticsResult.innerHTML = `<div class="tactics-alert">Erreur analyse tactique : ${escapeHtml(String(err.message || err))}</div>`;
    return;
  }

  if (!result?.tactics) {
    els.tacticsResult.classList.remove("hidden");
    els.tacticsResult.innerHTML = `<div class="tactics-alert">Analyse vide â€” vÃ©rifie que les champions sont dans le pool patch.</div>`;
    return;
  }

  const laneRows = slots
    .map(
      (s) => `
    <tr>
      <td>${s}</td>
      <td>${escapeHtml(state.ourComp[s])}</td>
      <td>${verdictLabel(result.lanes[s]?.verdict)}</td>
      <td>${escapeHtml(state.enemyComp[s])}</td>
      <td class="lane-note">${escapeHtml(result.lanes[s]?.note || "")}</td>
    </tr>`
    )
    .join("");

  const tacticRows = TACTIC_ORDER.map((key) => {
    const t = result.tactics[key];
    const label = TACTIC_LABELS[key] || key;
    const alt =
      t?.runnerUp && t.margin != null && t.margin < 12
        ? `<span class="tactic-alt muted"> — proche: ${escapeHtml(t.runnerUp)}</span>`
        : "";
    return `
    <tr>
      <td class="tactic-name">${label}</td>
      <td class="tactic-value">${renderTacticValueCell(t)}${alt}</td>
      <td class="tactic-reason">${escapeHtml(t?.reason || "â€”")}</td>
    </tr>`;
  }).join("");

  const avoidHtml = (result.avoid || []).length
    ? `<section class="tactics-block tactics-avoid">
        <h3>À éviter</h3>
        <ul>${result.avoid.map((a) => `<li><strong>${escapeHtml(a.setting)}</strong> — ${escapeHtml(a.why)}</li>`).join("")}</ul>
      </section>`
    : "";

  const archetypeHtml = result.archetypeLabel
    ? `<p class="tactics-archetype-badge">${escapeHtml(result.archetypeLabel)}${result.objectiveDecision ? ` · <span class="muted">${escapeHtml(result.objectiveDecisionDetail?.label || result.objectiveDecision)}</span>` : ""}</p>`
    : "";

  const shellHtml = result.shellHints
    ? `<section class="tactics-block tactics-shell-hints">
        <h3>Shell draft → tactiques</h3>
        <p><strong>${escapeHtml(result.shellHints.shell)}</strong> (${Math.round((result.shellHints.confidence || 0) * 100)}%)</p>
        ${result.shellHints.serpen ? `<p>Serpent : ${escapeHtml(result.shellHints.serpen)}</p>` : ""}
        ${result.shellHints.morgard ? `<p>Morgard : ${escapeHtml(result.shellHints.morgard)}</p>` : ""}
      </section>`
    : "";

  const reviewHtml = (result.reviewChecklist || []).length
    ? `<section class="tactics-block tactics-review">
        <h3>Review post-match</h3>
        <ul class="tactics-checklist">${result.reviewChecklist
          .map((c) => `<li><span class="check-kind">${escapeHtml(c.kind)}</span> ${escapeHtml(c.text)}</li>`)
          .join("")}</ul>
      </section>`
    : "";

  const failureHtml = (result.failureAdjustments || []).length
    ? `<section class="tactics-block tactics-failure">
        <h3>Si le plan échoue → prochain match</h3>
        <table class="tactics-table failure-table">
          <thead><tr><th>Pattern</th><th>Ajustement</th></tr></thead>
          <tbody>${result.failureAdjustments
            .map((r) => `<tr><td>${escapeHtml(r.pattern)}</td><td>${escapeHtml(r.adjust)}</td></tr>`)
            .join("")}</tbody>
        </table>
      </section>`
    : "";

  const junglerFitHtml = result.jungleFitDetail
    ? `<p class="tactics-jungler-fit"><strong>${escapeHtml(result.jungleFitDetail.champion)}</strong> — ${escapeHtml(result.jungleFitDetail.label || "")}${result.jungleFitDetail.verify ? ` · <em>${escapeHtml(result.jungleFitDetail.verify)}</em>` : ""}</p>`
    : "";

  const buildsHtml = renderTacticsItemGuidesSection(result.itemGuides);

  els.tacticsResult.classList.remove("hidden");
  updateTacticsCompScore();
  els.tacticsResult.innerHTML = `
    <header class="tactics-result-header">
      <h2>Plan de match</h2>
      ${archetypeHtml}
      ${junglerFitHtml}
      ${result.compTypeLabel ? `<p class="tactics-comp-type-badge">${escapeHtml(result.compTypeLabel)}</p>` : ""}
      <p class="win-plan">${result.winPlan.map((p) => escapeHtml(p)).join(" · ")}</p>
    </header>

    ${shellHtml}

    <div class="tactics-mtg-row mtg-team-row">
      ${mtgTeamPanelHtml(compPickNames(state.ourComp), "Identité couleur · nous")}
      ${mtgTeamPanelHtml(compPickNames(state.enemyComp), "Identité couleur · adversaire")}
    </div>

    <section class="tactics-block">
      <h3>Matchups par lane</h3>
      <table class="tactics-table lane-table">
        <thead><tr><th>Lane</th><th>Nous</th><th></th><th>Ennemi</th><th>Notes</th></tr></thead>
        <tbody>${laneRows}</tbody>
      </table>
    </section>

    <section class="tactics-block">
      <h3>Réglages à appliquer (écran Tactiques)</h3>
      <table class="tactics-table settings-table">
        <thead><tr><th>Option</th><th>Choix</th><th>Pourquoi</th></tr></thead>
        <tbody>${tacticRows}</tbody>
      </table>
    </section>

    ${avoidHtml}
    ${reviewHtml}
    ${failureHtml}
    ${buildsHtml}
  `;

  els.tacticsResult.querySelectorAll(".tactics-item-chip").forEach((chip) => {
    chip.addEventListener("click", () => scrollToItem(chip.dataset.item));
  });

  els.tacticsResult.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setupTactics() {
  updateImportDraftButton();
  renderTacticsSidebar();
  renderTacticsDraft();
  els.importDraftTactics?.addEventListener("click", importDraftToTactics);
  els.analyzeTactics?.addEventListener("click", runTacticsAnalysis);
  els.clearTactics?.addEventListener("click", () => {
    for (const s of tacticsSlots()) {
      state.ourComp[s] = "";
      state.enemyComp[s] = "";
    }
    state.tacticsFocus = null;
    state.tacticsPoolSearch = "";
    state.tacticsPoolType = "all";
    renderTacticsDraft();
    els.tacticsResult.classList.add("hidden");
    els.tacticsResult.innerHTML = "";
    updateTacticsCompScore();
  });
}

function setView(view) {
  state.view = view;

  document.querySelector(".app")?.classList.toggle("draft-focus", view === "draft");
  document.querySelector(".app")?.classList.toggle("tactics-focus", view === "tactics");

  els.viewChampions.classList.toggle("hidden", view !== "champions");
  els.viewItems.classList.toggle("hidden", view !== "items");
  els.viewDraft.classList.toggle("hidden", view !== "draft");
  els.viewTactics.classList.toggle("hidden", view !== "tactics");
  els.viewPatch.classList.toggle("hidden", view !== "patch");
  els.viewGuide.classList.toggle("hidden", view !== "guide");
  els.sidebarChampions.classList.toggle("hidden", view !== "champions");
  els.sidebarItems.classList.toggle("hidden", view !== "items");
  els.sidebarPatch.classList.toggle("hidden", view !== "patch");
  els.sidebarDraft.classList.add("hidden");
  els.sidebarTactics.classList.toggle("hidden", view !== "tactics");
  els.sidebarGuide.classList.toggle("hidden", view !== "guide");
  els.headerSearchWrap.classList.toggle("hidden", view !== "champions");

  els.navTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === view);
  });

  if (view === "guide" && state.guide) renderGuide();
  if (view === "items") renderItems();
  if (view === "patch") renderPatchTable();
  if (view === "draft" && window.TFM2DraftUI) window.TFM2DraftUI.onViewShow();
  if (view === "tactics") {
    updateImportDraftButton();
    renderTacticsPool({ forceFull: true });
    renderTacticsSlotGrid("our", els.ourSlots, state.ourComp);
    renderTacticsSlotGrid("enemy", els.enemySlots, state.enemyComp);
    updateTacticsCompScore();
  }
}

function setupFilters(container, attr, stateKey) {
  container.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;

    container.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    state[stateKey] = chip.dataset[attr];
    syncMobileSelect(stateKey);
    renderGrid();
  });
}

function syncFilterChips(container, attr, value) {
  container.querySelectorAll(".chip").forEach((c) => {
    c.classList.toggle("active", c.dataset[attr] === value || (value === "all" && c.dataset[attr] === "all"));
  });
}

function syncMobileSelect(stateKey) {
  const map = { slotFilter: "mobile-slot", typeFilter: "mobile-type", tierFilter: "mobile-tier" };
  const el = document.getElementById(map[stateKey]);
  if (el) el.value = state[stateKey];
}

function setupKeyboard() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDetail();
    if (e.key === "/" && state.view === "champions" && document.activeElement !== els.search) {
      e.preventDefault();
      els.search.focus();
    }
  });
}

async function init() {
  els.navTabs.forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });

  try {
    const [champRes, guideRes, itemsRes, tacticsRes, mtgRes, draftGuideRes, jungleGuideRes] = await Promise.all([
      fetch("data/champions.json"),
      fetch("data/guide-fr.json"),
      fetch("data/items.json"),
      fetch("data/tactics-meta.json"),
      fetch("data/mtg-colors.json"),
      fetch("data/tfm2-draft-guide.json"),
      fetch("data/tfm2-jungle-tactics-guide.json"),
    ]);
    if (!champRes.ok) throw new Error(`Champions HTTP ${champRes.status}`);
    const data = await champRes.json();
    state.baseChampions = data.champions;
    state.patchConfig = window.TFM2Patch.load(state.baseChampions);
    rebuildEffectiveChampions();
    CHAMP_NAMES_SORTED.length = 0;
    CHAMP_NAMES_SORTED.push(...state.champions.map((c) => c.name).sort((a, b) => b.length - a.length));
    renderGrid();
    setupPatchUI();
    updatePatchStats();
    markPatchSaved();

    if (itemsRes.ok) {
      const itemsData = await itemsRes.json();
      state.items = itemsData.items || [];
      state.items.forEach((i) => state.byItemName.set(i.name, i));
      ITEM_NAMES_SORTED.push(...state.items.map((i) => i.name).sort((a, b) => b.length - a.length));
    }

    if (guideRes.ok) {
      state.guide = await guideRes.json();
    }

    if (tacticsRes.ok) {
      state.tacticsMeta = await tacticsRes.json();
      window.TFM2Tactics?.setTacticOptions?.(state.tacticsMeta.tacticOptions);
    }

    if (jungleGuideRes.ok) {
      state.jungleGuide = await jungleGuideRes.json();
      window.TFM2Tactics?.setGuide?.(state.jungleGuide);
    } else if (state.tacticsMeta?.jungleGuide) {
      state.jungleGuide = state.tacticsMeta.jungleGuide;
      window.TFM2Tactics?.setGuide?.(state.jungleGuide);
    }

    if (draftGuideRes.ok) {
      state.draftGuide = await draftGuideRes.json();
    }
    // Configure le moteur de draft reconstruit : couche de données = TOUS les champions
    // (index inversé des counters + shells), guide = playbook « Early Access ».
    try {
      window.TFM2Draft?.configure?.({ champions: state.baseChampions, guide: state.draftGuide || null });
    } catch (e) {
      console.error("TFM2Draft.configure", e);
    }

    if (mtgRes.ok) {
      initMtgMeta(await mtgRes.json());
    }
    buildColorFilterUI();
    setupColorFilters();
    renderTacticsSidebar();
  } catch (err) {
    els.grid.innerHTML = `<div class="empty-state"><p>Impossible de charger les donnÃ©es.<br>Lancez le serveur local (voir README).</p><p style="margin-top:0.5rem;font-size:0.85rem;color:#8b97a8">${err.message}</p></div>`;
  }

  setupFilters(els.slotFilters, "slot", "slotFilter");
  setupFilters(els.typeFilters, "type", "typeFilter");
  setupFilters(els.tierFilters, "tier", "tierFilter");
  els.itemTierFilters?.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    els.itemTierFilters.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    state.itemTierFilter = chip.dataset.tier;
    renderItems();
  });
  els.search.addEventListener("input", (e) => {
    state.search = e.target.value;
    renderGrid();
  });
  document.getElementById("mobile-slot")?.addEventListener("change", (e) => {
    state.slotFilter = e.target.value;
    syncFilterChips(els.slotFilters, "slot", state.slotFilter);
    renderGrid();
  });
  document.getElementById("mobile-type")?.addEventListener("change", (e) => {
    state.typeFilter = e.target.value;
    syncFilterChips(els.typeFilters, "type", state.typeFilter);
    renderGrid();
  });
  document.getElementById("mobile-tier")?.addEventListener("change", (e) => {
    state.tierFilter = e.target.value;
    syncFilterChips(els.tierFilters, "tier", state.tierFilter);
    renderGrid();
  });
  els.closeDetail.addEventListener("click", closeDetail);
  els.overlay.addEventListener("click", closeDetail);
  setupKeyboard();
  setupTactics();

  window.TFM2Coach = {
    state,
    els,
    setView,
    championIconHtml,
    escapeHtml,
    tierRank,
    tierBadgeHtml,
    getTypeClass,
    runTacticsAnalysis,
    rebuildEffectiveChampions,
    getPlayableChampions: () => state.champions,
    mtgPastillesHtml,
    mtgTeamPanelHtml,
    colorFilterMatches,
  };
  if (window.TFM2DraftUI) window.TFM2DraftUI.init(window.TFM2Coach);

  if (location.hash === "#guide") setView("guide");
  else if (location.hash === "#items") setView("items");
  else if (location.hash === "#draft") setView("draft");
  else if (location.hash === "#tactics") setView("tactics");
  else if (location.hash === "#patch") setView("patch");
}

init();
