/**
 * TFM2 Draft Data v1 — couche de données unique et *groundée*.
 *
 * Objectif : exposer, à partir de `champions.json` + `tfm2-draft-guide.json`,
 * des accès propres aux SEULS signaux réels du jeu — tier, matchups (worstMatchups),
 * pairings (bestPairings), postes (optimalSlots/viableSlots), roleTags, draftProfile —
 * plus les index dérivés à l'exécution :
 *   - `beats(name)`   : qui `name` counter (inversion des worstMatchups sur tout le roster).
 *   - shells / banPhilosophy / trapRules / replacementChains issus du guide.
 *
 * Aucune donnée fabriquée : les matchups/pairings restent ORDINAUX (rang 1..5).
 * Marche en navigateur (window.TFM2DraftData) et sous Node (module.exports).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof root !== "undefined") root.TFM2DraftData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SLOTS = ["Top", "Jungle", "Mid", "Bot", "Support"];

  const state = {
    ready: false,
    byName: new Map(), // name -> champ object (source: champions.json)
    beatsIndex: new Map(), // name -> [{ name, rank }]  (champions que `name` counter)
    guide: null,
    shells: [], // [{ id, label, style, slots{}, champions[], firstPickAnchors[], banPriority[], winCondition }]
  };

  function normList(v) {
    return Array.isArray(v) ? v.filter(Boolean) : [];
  }

  /** Accepte soit un tableau de champions, soit un objet { name: champ }, soit { champions:[...] }. */
  function toChampArray(champions) {
    if (!champions) return [];
    if (Array.isArray(champions)) return champions;
    if (Array.isArray(champions.champions)) return champions.champions;
    return Object.values(champions);
  }

  function init(opts = {}) {
    const champs = toChampArray(opts.champions);
    state.byName = new Map();
    for (const c of champs) {
      if (c && c.name) state.byName.set(c.name, c);
    }

    // Index inversé des counters : D.worstMatchups contient E (au rang r)
    // signifie « E counter D », donc E *beats* D. On enregistre beats[E] += { D, rank r }.
    state.beatsIndex = new Map();
    for (const [name, c] of state.byName) {
      const worst = normList(c.worstMatchups); // champions qui counterent `name`
      worst.forEach((enemyName, rank) => {
        if (!state.beatsIndex.has(enemyName)) state.beatsIndex.set(enemyName, []);
        state.beatsIndex.get(enemyName).push({ name, rank });
      });
    }

    state.guide = opts.guide || null;
    state.shells = buildShells(state.guide);
    state.ready = state.byName.size > 0;
    return state.ready;
  }

  function buildShells(guide) {
    const raw = guide && guide.compShells;
    if (!raw) return [];
    return Object.keys(raw).map((id) => {
      const s = raw[id] || {};
      return {
        id,
        label: s.labelFr || id,
        style: s.style || "",
        winCondition: s.winCondition || "",
        slots: s.slots || {},
        champions: normList(s.champions),
        firstPickAnchors: normList(s.firstPickAnchors),
        banPriority: normList(s.banPriority),
        cannotAnswer: normList(s.cannotAnswer),
      };
    });
  }

  // ---- Accès champion --------------------------------------------------------
  function get(name) {
    return state.byName.get(name) || null;
  }
  function exists(name) {
    return state.byName.has(name);
  }
  function all() {
    return Array.from(state.byName.values());
  }
  function names() {
    return Array.from(state.byName.keys());
  }

  function tier(name) {
    const c = get(name);
    return (c && c.tierMeta) || "C";
  }
  function roleTags(name) {
    const c = get(name);
    return normList(c && (c.roleTags || c.tags));
  }
  function hasTag(name, tag) {
    return roleTags(name).includes(tag);
  }
  function profile(name) {
    const c = get(name);
    return (c && c.draftProfile) || {};
  }
  function optimalSlots(name) {
    const c = get(name);
    return normList(c && c.optimalSlots);
  }
  function viableSlots(name) {
    const c = get(name);
    return normList(c && c.viableSlots);
  }
  function draftJob(name) {
    const c = get(name);
    return (c && c.draftJob) || "";
  }

  /** Champions qui counterent `name` (rang 0 = pire), tel que fourni par les données. */
  function counteredBy(name) {
    const c = get(name);
    return normList(c && c.worstMatchups).map((n, rank) => ({ name: n, rank }));
  }
  /** Champions que `name` counter (dérivé par inversion). */
  function beats(name) {
    return (state.beatsIndex.get(name) || []).slice();
  }
  /** Pairings (synergies) déclarés de `name`, rang 0 = meilleur. */
  function pairings(name) {
    const c = get(name);
    return normList(c && c.bestPairings).map((n, rank) => ({ name: n, rank }));
  }

  // ---- Guide -----------------------------------------------------------------
  function shells() {
    return state.shells.slice();
  }
  function banPhilosophy() {
    return (state.guide && state.guide.banPhilosophy) || null;
  }
  function trapRiskRules() {
    return (state.guide && state.guide.trapRiskRules) || null;
  }
  function replacementChains() {
    return (state.guide && state.guide.replacementChains) || null;
  }
  function draftFormat() {
    return (state.guide && state.guide.draftFormat) || { bansPerTeam: 3, pickOrder: "snake_5v5" };
  }

  return {
    SLOTS,
    init,
    isReady: () => state.ready,
    // champion
    get,
    exists,
    all,
    names,
    tier,
    roleTags,
    hasTag,
    profile,
    optimalSlots,
    viableSlots,
    draftJob,
    counteredBy,
    beats,
    pairings,
    // guide
    shells,
    banPhilosophy,
    trapRiskRules,
    replacementChains,
    draftFormat,
  };
});
