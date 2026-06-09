/**
 * Configuration du patch actuel — pool, tiers et positions (localStorage).
 */
(function (global) {
  const STORAGE_KEY = "tfm2-patch-config-v1";
  const SLOTS = ["Top", "Jungle", "Mid", "Bot", "Support"];
  const TIERS = ["S", "A", "B", "C", "D"];

  function defaultEntry(champ) {
    return {
      enabled: true,
      tierMeta: champ.tierMeta || "C",
      optimalSlots: [...(champ.optimalSlots || [])],
    };
  }

  function createDefaultConfig(champions, label = "Patch actuel") {
    const overrides = {};
    for (const c of champions) overrides[c.name] = defaultEntry(c);
    return { version: 1, label, updatedAt: Date.now(), overrides };
  }

  function mergeWithBase(config, champions) {
    const overrides = { ...(config?.overrides || {}) };
    for (const c of champions) {
      const prev = overrides[c.name];
      if (!prev) {
        overrides[c.name] = defaultEntry(c);
        continue;
      }
      const slots = Array.isArray(prev.optimalSlots) ? prev.optimalSlots.filter((s) => SLOTS.includes(s)) : [];
      overrides[c.name] = {
        enabled: prev.enabled !== false,
        tierMeta: TIERS.includes(prev.tierMeta) ? prev.tierMeta : c.tierMeta || "C",
        optimalSlots: slots.length ? slots : [...(c.optimalSlots || [])],
      };
    }
    for (const name of Object.keys(overrides)) {
      if (!champions.some((c) => c.name === name)) delete overrides[name];
    }
    return {
      version: 1,
      label: config?.label || "Patch actuel",
      updatedAt: config?.updatedAt || Date.now(),
      overrides,
    };
  }

  function load(champions) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultConfig(champions);
      return mergeWithBase(JSON.parse(raw), champions);
    } catch {
      return createDefaultConfig(champions);
    }
  }

  function save(config) {
    config.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  function applyToChampion(base, entry) {
    const slots = entry?.optimalSlots?.length ? entry.optimalSlots : base.optimalSlots || [];
    const positions =
      slots.length > 0
        ? `Toutes · ${slots.length === 1 ? "optimal : " : "jouable : "}${slots.join(", ")}`
        : base.positions;
    return {
      ...base,
      tierMeta: entry?.tierMeta || base.tierMeta,
      optimalSlots: [...slots],
      positions,
      patchEnabled: entry?.enabled !== false,
    };
  }

  function getPlayable(baseChampions, config) {
    return baseChampions
      .filter((c) => config.overrides[c.name]?.enabled !== false)
      .map((c) => applyToChampion(c, config.overrides[c.name]))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }

  function getAllWithPatch(baseChampions, config) {
    return baseChampions
      .map((c) => applyToChampion(c, config.overrides[c.name]))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }

  function countEnabled(config) {
    return Object.values(config.overrides).filter((o) => o.enabled !== false).length;
  }

  function setEntry(config, name, patch) {
    const prev = config.overrides[name] || { enabled: true, tierMeta: "C", optimalSlots: [] };
    config.overrides[name] = {
      enabled: patch.enabled ?? prev.enabled,
      tierMeta: patch.tierMeta ?? prev.tierMeta,
      optimalSlots: patch.optimalSlots ?? prev.optimalSlots,
    };
    return config;
  }

  function setAllEnabled(config, enabled) {
    for (const name of Object.keys(config.overrides)) {
      config.overrides[name].enabled = enabled;
    }
    return config;
  }

  function resetToDefaults(champions) {
    return createDefaultConfig(champions, "Patch actuel");
  }

  global.TFM2Patch = {
    STORAGE_KEY,
    SLOTS,
    TIERS,
    load,
    save,
    createDefaultConfig,
    mergeWithBase,
    applyToChampion,
    getPlayable,
    getAllWithPatch,
    countEnabled,
    setEntry,
    setAllEnabled,
    resetToDefaults,
  };
})(typeof window !== "undefined" ? window : globalThis);
