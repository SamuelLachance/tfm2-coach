/**
 * Pool champions style League of Legends — filtres rôle + grille compacte (pas alpha).
 */
(function (global) {
  const ROLE_FILTERS = [
    { id: "all", label: "Tous", short: "★", title: "Tous les champions" },
    { id: "Assassin", label: "Assassin", short: "A", colorClass: "type-assassin", title: "Assassins" },
    { id: "Guerrier", label: "Guerrier", short: "G", colorClass: "type-guerrier", title: "Guerriers / tanks" },
    { id: "Mage", label: "Mage", short: "M", colorClass: "type-mage", title: "Mages" },
    { id: "À distance", label: "ADC", short: "D", colorClass: "type-distance", title: "À distance / marksman" },
    { id: "Support", label: "Support", short: "S", colorClass: "type-support", title: "Supports" },
  ];

  const ROLE_ORDER = {
    Assassin: 0,
    Guerrier: 1,
    Mage: 2,
    "À distance": 3,
    Support: 4,
    Autre: 5,
  };

  const TIER_ORDER = { S: 0, A: 1, B: 2, C: 3, D: 4 };

  function typeCategory(type = "") {
    const t = type.toLowerCase();
    if (t.includes("guerrier")) return "Guerrier";
    if (t.includes("assassin")) return "Assassin";
    if (t.includes("support")) return "Support";
    if (t.includes("distance") || t.includes("à distance")) return "À distance";
    if (t.includes("mage")) return "Mage";
    return "Autre";
  }

  function tierRank(tier) {
    return TIER_ORDER[tier] ?? 5;
  }

  /** Rôle (style LoL) → tier → nom. Pas de tri alpha global type TFM2. */
  function sortChampions(champions, opts = {}) {
    const roleFirst = opts.roleFirst !== false;
    return [...champions].sort((a, b) => {
      if (roleFirst) {
        const ra = ROLE_ORDER[typeCategory(a.type)] ?? 99;
        const rb = ROLE_ORDER[typeCategory(b.type)] ?? 99;
        if (ra !== rb) return ra - rb;
      }
      const tr = tierRank(a.tierMeta) - tierRank(b.tierMeta);
      if (tr !== 0) return tr;
      return a.name.localeCompare(b.name, "fr");
    });
  }

  function filterChampions(champions, opts = {}) {
    const q = (opts.search || "").toLowerCase().trim();
    const type = opts.type || "all";
    const tier = opts.tier || "all";
    return champions.filter((c) => {
      if (q) {
        const hay = [c.name, c.nameEn, c.type].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (type !== "all" && typeCategory(c.type) !== type) return false;
      if (tier !== "all" && c.tierMeta !== tier) return false;
      return true;
    });
  }

  function renderRoleBar(activeType, escapeHtml) {
    const esc = escapeHtml || ((s) => s);
    return `<div class="pool-role-bar" role="tablist" aria-label="Filtrer par rôle">
      ${ROLE_FILTERS.map(
        (r) => `
        <button type="button" class="pool-role-btn${activeType === r.id ? " active" : ""}${r.colorClass ? ` ${r.colorClass}` : ""}"
          data-pool-role="${esc(r.id)}" role="tab" aria-selected="${activeType === r.id ? "true" : "false"}"
          title="${esc(r.title || r.label)}">
          <span class="pool-role-icon" aria-hidden="true">${esc(r.short || r.label.charAt(0))}</span>
          <span class="pool-role-label">${esc(r.label)}</span>
        </button>`
      ).join("")}
    </div>`;
  }

  function renderGrid(champions, ctx = {}) {
    const {
      hotNames = new Set(),
      escapeHtml = (s) => s,
      iconHtml,
      getTypeClass = () => "",
      extraAttrs = () => "",
    } = ctx;
    if (!iconHtml) return "";
    const sorted = sortChampions(champions, { roleFirst: true });
    return sorted
      .map((c) => {
        const typeClass = getTypeClass(c.type);
        const hot = hotNames.has(c.name) ? " rec-hot" : "";
        const tier = c.tierMeta
          ? `<span class="draft-pool-tier tier-${c.tierMeta.toLowerCase()}">${c.tierMeta}</span>`
          : "";
        const slotHint = c.optimalSlots?.[0] ? ` · ${c.optimalSlots[0]}` : "";
        const title = `${c.name}${c.tierMeta ? ` · Tier ${c.tierMeta}` : ""}${slotHint}`;
        return `<button type="button" class="draft-pool-card draft-pool-card--lol ${typeClass}${hot}"
          data-champ="${escapeHtml(c.name)}" title="${escapeHtml(title)}"${extraAttrs(c)}>
          ${iconHtml(c)}
          ${tier}
        </button>`;
      })
      .join("");
  }

  global.TFM2ChampionPool = {
    ROLE_FILTERS,
    ROLE_ORDER,
    typeCategory,
    tierRank,
    sortChampions,
    filterChampions,
    renderRoleBar,
    renderGrid,
  };
})(typeof window !== "undefined" ? window : globalThis);
