/**
 * TFM2 Tactics Engine v16 — jungle/objective guide + draft-shell wiring.
 */
(function (global) {
  const GUIDE = "https://dq7reimagined.com/teamfight-manager-2/jungle-guide/";
  const MC = () => global.TFM2MatchCore;
  const SLOTS = MC()?.SLOTS || ["Top", "Jungle", "Mid", "Bot", "Support"];
  const LANE_W = { Top: 2.25, Jungle: 1.1, Mid: 1.0, Bot: 1.2, Support: 2.0 };
  let JUNGLE_GUIDE_DATA = null;

  /** 7 jungle fits mis en avant dans le guide (FR in-game). */
  const HERO_JUNGLE_CHAMPS = new Set([
    "Lancier", "Ninja", "Chasseur de boomerang", "Berserker", "Combattant",
    "Chevalier de cavalerie", "Démon",
  ]);

  const SERPEN_CHECK_LABELS = {
    jungler_alive: "Jungler vivant au timer",
    correct_side: "Bon côté / vision pit",
    lanes_mobile: "Lanes mobiles (pas stuck)",
    early_damage_cc: "Dégâts + CC early prêts",
  };

  /** Fit jungle — tableau « Jungle Champion Fit » du guide dq7. */
  const JUNGLE_FIT = {
    Lancier: {
      style: "aggressive",
      serpent: "contest",
      earlyJungle: "Gank",
      label: "Aggressive / gank · tempo objectif",
    },
    Ninja: {
      style: "pick",
      serpent: "after_advantage",
      earlyJungle: "Gank",
      label: "Pick pressure · backline",
    },
    "Chasseur de boomerang": {
      style: "flex",
      serpent: "flexible",
      earlyJungle: "Farm/Couverture",
      label: "Mobilité · pression flexible (vérifier en review)",
    },
    Berserker: {
      style: "skirmish",
      serpent: "flexible",
      earlyJungle: "Gank",
      label: "Skirmish · isolations early",
    },
    Combattant: {
      style: "engage",
      serpent: "contest",
      earlyJungle: "Gank",
      label: "CC jungle · engage support",
    },
    "Chevalier de cavalerie": {
      style: "stable_front",
      serpent: "delay_trade",
      earlyJungle: "Farm/Couverture",
      label: "Front stable · présence objectif",
    },
    Démon: {
      style: "pick",
      serpent: "after_advantage",
      earlyJungle: "Gank",
      label: "Dive · displacement backline",
    },
    Clown: {
      style: "pick",
      serpent: "after_advantage",
      earlyJungle: "Gank",
      label: "Pick · gank mid/bot",
    },
    Inquisiteur: {
      style: "pick",
      serpent: "after_advantage",
      earlyJungle: "Gank",
      label: "Pick · snowball tempo",
    },
    "Maître du fouet": {
      style: "flex",
      serpent: "flexible",
      earlyJungle: "Farm/Couverture",
      label: "Contrôle · flexible",
    },
    "Tueur à gages": {
      style: "pick",
      serpent: "after_advantage",
      earlyJungle: "Gank",
      label: "Pick · exécution",
    },
    Chasseur: {
      style: "pick",
      serpent: "after_advantage",
      earlyJungle: "Gank",
      label: "Pick · burst jungle",
    },
    "Briseur de siège": {
      style: "engage",
      serpent: "contest",
      earlyJungle: "Gank",
      label: "Engage · waveclear objectif",
    },
    Ogre: {
      style: "safe",
      serpent: "delay",
      earlyJungle: "Farm/Couverture",
      label: "Farm · scale tard",
    },
    Fantôme: {
      style: "safe",
      serpent: "delay",
      earlyJungle: "Farm/Couverture",
      label: "Farm · hypercarry",
    },
    Druide: {
      style: "safe",
      serpent: "delay",
      earlyJungle: "Farm/Couverture",
      label: "Farm · split scale",
    },
    Vampire: {
      style: "safe",
      serpent: "delay",
      earlyJungle: "Farm/Couverture",
      label: "Farm · front scale",
    },
    Nécromancien: {
      style: "safe",
      serpent: "delay",
      earlyJungle: "Farm/Couverture",
      label: "Farm · scale AP",
    },
    Soldat: {
      style: "flex",
      serpent: "flexible",
      earlyJungle: "Farm/Couverture",
      label: "Pression mobile · flexible",
    },
    Exécuteur: {
      style: "pick",
      serpent: "after_advantage",
      earlyJungle: "Gank",
      label: "Pick · anti-heal / execute",
    },
    "Mage des ombres": {
      style: "pick",
      serpent: "after_advantage",
      earlyJungle: "Gank",
      label: "Pick · burst AP",
    },
    "Double lame": {
      style: "pick",
      serpent: "after_advantage",
      earlyJungle: "Gank",
      label: "Pick · assassin",
    },
    Pyromancien: {
      style: "side",
      serpent: "delay_trade",
      earlyJungle: "Farm/Couverture",
      label: "Poke · trade side",
    },
    "Mage noir": {
      style: "pick",
      serpent: "after_advantage",
      earlyJungle: "Gank",
      label: "Pick · malédiction",
    },
  };

  const AGGRESSIVE_EARLY_JG = new Set([
    "Lancier", "Combattant", "Berserker", "Briseur de siège",
  ]);
  const SLOW_ENEMY_JG = new Set([
    "Ogre", "Fantôme", "Nécromancien", "Vampire", "Druide", "Maître du fouet",
  ]);
  /** Modèle unique objectif du guide : Contest / Delay / Pick / Trade / Defend. */
  const OBJECTIVE_DECISION = {
    early_serpent_pressure: "contest",
    protect_scale: "delay",
    pick_before_morgard: "pick",
    side_pressure_trade: "trade",
    behind_stabilize: "defend",
    balanced: "flex",
  };
  const REVIEW_QUESTIONS = {
    early_serpent_pressure:
      "La pression early a-t-elle mené au Serpent, à l'avantage lane ou au retard jungle ennemi ?",
    protect_scale:
      "L'équipe a-t-elle survécu early sans céder toute la map ?",
    pick_before_morgard:
      "Des picks avant objectif, ou marche dans des 5v5 groupés ?",
    side_pressure_trade:
      "Le trade a-t-il récupéré assez de value, ou snowball objectif ennemi ?",
    behind_stabilize:
      "Éviter chain fights — ajuster draft ou jungle risk au prochain match.",
    balanced:
      "Le réglage choisi a-t-il été exécutable par l'IA (review post-match) ?",
  };
  /** Table « If the Early Jungle Plan Fails » du guide. */
  const FAILURE_ADJUSTMENTS = [
    { pattern: "Jungle agressive → morts early", adjust: "Baisser Style jungle + delay Serpent." },
    { pattern: "JG arrive en retard à l'objectif", adjust: "Setup plus safe ou draft prio lanes." },
    { pattern: "Start objectif mais ne finit pas", adjust: "Revoir Finalisation d'Objectif + dégâts équipe." },
    { pattern: "Morgard gagné mais pas de push", adjust: "Morgard / Conclusion → siège ou pression stable." },
    { pattern: "Comp pick → 5v5 égal", adjust: "Combat objectif → pick first (Poker)." },
    { pattern: "Comp scale contest trop tôt", adjust: "Delay Serpent + protéger carry." },
    { pattern: "Jungle safe cède tout", adjust: "Ajouter prio lanes, poke ou pression objectif." },
  ];
  const PICK_CORE = new Set([
    "Ninja", "Démon", "Clown", "Inquisiteur", "Chasseur", "Tueur à gages",
    "Exécuteur", "Mage des ombres", "Double lame", "Mage noir",
  ]);
  const PICK_FOLLOW = new Set(["Exécuteur", "Bombardier", "Mage noir"]);
  const SCALE_CARRIES = new Set([
    "Tireur", "Chasseur de fléchettes empoisonnées", "Archer", "Fantôme", "Chasseur de boomerang",
  ]);
  const PEEL_SUPPORTS = new Set([
    "Prêtre", "Moine", "Porteur de bouclier", "Esprit gardien", "Pythonisse",
    "Androïde", "Enchanteur", "Barde",
  ]);
  const SIDE_TRADE_CORE = new Set([
    "Pyromancien", "Chevalier de cavalerie", "Épéiste", "Soldat", "Vampire",
  ]);
  const SPLIT_PUSHERS = new Set([
    "Vampire", "Pyromancien", "Chevalier de cavalerie", "Épéiste", "Berserker",
    "Soldat", "Ninja", "Clown", "Chasseur de boomerang",
  ]);

  const ARCHETYPE_LABELS = {
    early_serpent_pressure: "Early Serpent pressure (Lancer)",
    protect_scale: "Protect scaling carry (Sniper)",
    pick_before_morgard: "Pick before objective (Ninja / Demon)",
    side_pressure_trade: "Side-pressure trade (Pyromancer / Cavalry)",
    behind_stabilize: "Behind — stabilize (next-match adjustment)",
    balanced: "Flexible / responsive (guide)",
  };

  const ITEM_CATEGORY = {
    PLAYER: "player", AD: "AD", AP: "Magique", AS: "Vit. d'attaque",
    ARMOR: "Défense", MR: "Résist. Magique", HP: "PV",
  };
  const ITEM_CATEGORY_LABELS = {
    [ITEM_CATEGORY.PLAYER]: "Laisser le joueur décider",
    [ITEM_CATEGORY.AD]: "AD", [ITEM_CATEGORY.AP]: "Magique",
    [ITEM_CATEGORY.AS]: "Vit. d'attaque", [ITEM_CATEGORY.ARMOR]: "Défense",
    [ITEM_CATEGORY.MR]: "Résist. Magique", [ITEM_CATEGORY.HP]: "PV",
  };
  const ITEM_TO_CATEGORY = {
    "Épée de fer": ITEM_CATEGORY.AD, "Dague rapide": ITEM_CATEGORY.AS,
    "Armure d'acier": ITEM_CATEGORY.ARMOR, "Cape mystique": ITEM_CATEGORY.MR,
    "Cristal arcanique": ITEM_CATEGORY.AP, "Orbe vital": ITEM_CATEGORY.HP,
    "Forteresse imprenable": ITEM_CATEGORY.ARMOR, "Voile d'annihilation": ITEM_CATEGORY.MR,
    "Fragment de corne du géant": ITEM_CATEGORY.HP, "Prophète de l'abîme": ITEM_CATEGORY.AP,
    "Souverain de la tempête": ITEM_CATEGORY.AS, "Jugement final du seigneur de guerre": ITEM_CATEGORY.AD,
    "Bâton du sorcier": ITEM_CATEGORY.AP, "Cristal chrono": ITEM_CATEGORY.AP,
  };

  function hasTag(name, tag, metaMap) {
    return MC()?.hasTag(name, tag, metaMap) || metaMap[name]?.tags?.includes(tag) || false;
  }

  function countTags(comp, metaMap, tag) {
    return SLOTS.filter((s) => comp[s] && hasTag(comp[s], tag, metaMap)).length;
  }

  function draftProfile(name, metaMap) {
    return metaMap[name]?.draftProfile || {};
  }

  function compValues(comp) {
    return SLOTS.map((s) => comp[s]).filter(Boolean);
  }

  function countFrontline(comp, metaMap) {
    let n = countTags(comp, metaMap, "frontline");
    for (const slot of SLOTS) {
      const name = comp[slot];
      if (!name || hasTag(name, "frontline", metaMap)) continue;
      if ((draftProfile(name, metaMap).tankWeight ?? 0) >= 0.88) n += 1;
    }
    return n;
  }

  function inferJungleStyle(jungler, metaMap) {
    const fit = JUNGLE_FIT[jungler];
    if (fit) return fit;
    if (hasTag(jungler, "aggressive_jungle", metaMap)) {
      return { style: "aggressive", serpent: "contest", earlyJungle: "Gank", label: "Jungle agressive" };
    }
    if (hasTag(jungler, "pick_jungle", metaMap) || hasTag(jungler, "assassin", metaMap)) {
      return { style: "pick", serpent: "after_advantage", earlyJungle: "Gank", label: "Jungle pick" };
    }
    if (hasTag(jungler, "farm_jungle", metaMap)) {
      return { style: "safe", serpent: "delay", earlyJungle: "Farm/Couverture", label: "Jungle farm" };
    }
    if (hasTag(jungler, "engage", metaMap)) {
      return { style: "engage", serpent: "contest", earlyJungle: "Gank", label: "Jungle engage" };
    }
    return { style: "flex", serpent: "flexible", earlyJungle: "Farm/Couverture", label: "Jungle flexible" };
  }

  function lanesCanMove(lanes) {
    const midOk = lanes.Mid?.verdict !== "lose";
    const botOk = lanes.Bot?.verdict !== "lose";
    const topOk = lanes.Top?.verdict !== "lose";
    return midOk && (botOk || topOk);
  }

  function countLaneWins(lanes) {
    return SLOTS.filter((s) => lanes[s]?.verdict === "win").length;
  }

  function lanePressure(lanes) {
    let net = 0;
    for (const slot of SLOTS) {
      const lm = lanes[slot];
      if (!lm) continue;
      const w = LANE_W[slot] || 1;
      if (lm.verdict === "win") net += w;
      else if (lm.verdict === "lose") net -= w;
    }
    return net;
  }

  function findPrimaryCarry(comp, metaMap) {
    let best = null;
    for (const slot of ["Bot", "Mid", "Top"]) {
      const name = comp[slot];
      if (!name) continue;
      const dp = draftProfile(name, metaMap);
      const dps = dp.dpsWeight ?? 0;
      const isHyper = MC()?.HYPER_CARRIES?.has(name) || SCALE_CARRIES.has(name);
      const score = dps + (isHyper ? 0.35 : 0) + (slot === "Bot" ? 0.15 : 0);
      if (!best || score > best.score) best = { name, slot, score, dps };
    }
    return best;
  }

  function hasPeelSupport(comp) {
    return compValues(comp).some((n) => PEEL_SUPPORTS.has(n));
  }

  function hasPickCore(comp) {
    return compValues(comp).some((n) => PICK_CORE.has(n));
  }

  function hasSideTradeCore(comp) {
    return compValues(comp).some((n) => SIDE_TRADE_CORE.has(n));
  }

  function rankSplitCandidates(comp, metaMap, lanes = {}) {
    const candidates = [];
    for (const slot of SLOTS) {
      const name = comp[slot];
      if (!name || MC()?.SPLIT_EXCLUDE?.has(name)) continue;
      let score = 0;
      if (SPLIT_PUSHERS.has(name)) score += 50;
      if (MC()?.SPLITTERS?.has(name)) score += 40;
      if (hasTag(name, "split", metaMap)) score += 30;
      if (hasTag(name, "wave_clear", metaMap)) score += 16;
      if (slot === "Top") score += 18;
      if (slot === "Jungle" && (hasTag(name, "mobility", metaMap) || PICK_CORE.has(name))) score += 14;
      if (name === "Clown" && comp.Jungle === "Clown") score += 16;
      const lane = lanes[slot];
      if (lane?.verdict === "win") score += 12;
      else if (lane?.verdict === "lose") score -= 18;
      if (score >= 36) candidates.push({ name, slot, score });
    }
    return candidates.sort((a, b) => b.score - a.score);
  }

  function refineLanes(lanes, ourComp, enemyComp, metaMap) {
    const out = { ...lanes };
    const bot = ourComp.Bot;
    const eBot = enemyComp.Bot;
    if (bot && eBot && eBot === "Chevalier de cavalerie" && SCALE_CARRIES.has(bot)) {
      if (out.Bot?.verdict !== "win") {
        out.Bot = {
          verdict: "lose",
          note: `${eBot} menace ${bot} (impale) — babysitter bot (guide Cavalerie).`,
        };
      }
    }
    return out;
  }

  function gatherContext(ourComp, enemyComp, metaMap, championsByName) {
    const core = MC();
    let lanes = core?.lanesFromComps ? core.lanesFromComps(ourComp, enemyComp, metaMap) : {};
    lanes = refineLanes(lanes, ourComp, enemyComp, metaMap);

    const jungler = ourComp.Jungle;
    const jFit = inferJungleStyle(jungler, metaMap);
    const enemyJungler = enemyComp.Jungle;

    const ourFront = countFrontline(ourComp, metaMap);
    const enemyFront = countFrontline(enemyComp, metaMap);
    const ourPeel = countTags(ourComp, metaMap, "peel") + (hasPeelSupport(ourComp) ? 1 : 0);
    const ourScale = countTags(ourComp, metaMap, "scaling");
    const ourPoke = countTags(ourComp, metaMap, "poke");
    const enemyPeel = countTags(enemyComp, metaMap, "peel");
    const enemyDive = countTags(enemyComp, metaMap, "dive") + countTags(enemyComp, metaMap, "assassin");

    const qualified = rankSplitCandidates(ourComp, metaMap, lanes);
    const laneWins = countLaneWins(lanes);
    const laneNet = lanePressure(lanes);
    const carry = findPrimaryCarry(ourComp, metaMap);
    const botThreat = lanes.Bot?.verdict === "lose";
    const topSplit = SPLIT_PUSHERS.has(ourComp.Top) || hasTag(ourComp.Top, "split", metaMap);

    const canWinDirect5v5 = ourFront >= 1 && ourFront >= enemyFront && laneWins >= 2 && laneNet >= 0;

    let compMargin = 0;
    let compCompare = null;
    try {
      const cmp = global.TFM2Draft?.compareComps || core?.compareComps;
      if (cmp) {
        compCompare = cmp(ourComp, enemyComp, championsByName, metaMap);
        if (compCompare?.complete) compMargin = compCompare.margin || 0;
      }
    } catch (_) { /* ignore */ }

    const behind = compMargin < -35 || laneNet <= -2;
    const ahead = compMargin > 30 || laneNet >= 2;
    const enemyJgSlow = enemyJungler && SLOW_ENEMY_JG.has(enemyJungler);
    const gunnerPressure =
      jungler === "Chasseur de boomerang" && lanesCanMove(lanes) && laneWins >= 2;

    const ourNames = SLOTS.map((s) => ourComp[s]).filter(Boolean);
    const enemyNames = SLOTS.map((s) => enemyComp[s]).filter(Boolean);
    const FC = global.TFM2FamilyCore;
    const familySummary = FC?.teamFamilySummary?.(ourNames, championsByName, metaMap) || null;
    const compType = familySummary?.dominant || FC?.dominantCompType?.(ourComp, metaMap, championsByName) || null;
    const compTypeLabel = familySummary?.dominantLabel || (compType && FC?.COMP_LABELS?.[compType]) || null;
    const ourPick =
      countTags(ourComp, metaMap, "assassin") +
      countTags(ourComp, metaMap, "pick_jungle") +
      compValues(ourComp).filter((n) => PICK_CORE.has(n)).length;
    const cantEngage5v5 = enemyFront >= 2 && ourFront <= 1;

    const BD = global.TFM2Beatdown;
    const roles = BD?.assignRoles?.(ourNames, enemyNames, metaMap, championsByName, {
      laneNet, compMargin,
    }) || null;

    return {
      ourComp, enemyComp, metaMap, championsByName, lanes,
      jungler, jFit, enemyJungler,
      ourFront, enemyFront, ourPeel, ourScale, ourPoke,
      enemyPeel, enemyDive,
      qualified, laneWins, laneNet, carry, botThreat, topSplit,
      canWinDirect5v5,
      compMargin, compCompare, behind, ahead,
      lanesMobile: lanesCanMove(lanes),
      hasPickCore: hasPickCore(ourComp),
      hasSideTradeCore: hasSideTradeCore(ourComp),
      hasPeelSupport: hasPeelSupport(ourComp),
      enemyJgSlow,
      gunnerPressure,
      earlyCc: countTags(ourComp, metaMap, "engage") + countTags(ourComp, metaMap, "cc"),
      familySummary,
      compType,
      compTypeLabel,
      ourPick,
      cantEngage5v5,
      roles,
      ourNames,
      enemyNames,
    };
  }

  /** Règles explicites tactiques-options.md § Règles de choix + match enregistré. */
  const GUIDE_COMP_RULES = [
    {
      id: "flechettes_moine",
      when: (ctx) =>
        ctx.ourComp.Bot === "Chasseur de fléchettes empoisonnées" &&
        ctx.ourComp.Support === "Moine",
      patch: {
        focusLane: ["Focus Mid/Bot", "Fléchettes + Moine — prio bot (guide)."],
        towerSiege: ["Poker / Garder ses Distances", "Artillerie bot — siège poker (guide)."],
        defense: ["Défendre la Lane Pressée", "Protéger le carry bot (guide)."],
      },
    },
    {
      id: "mage_noir_mid",
      when: (ctx) => ctx.ourComp.Mid === "Mage noir",
      patch: {
        waveMgmt: ["Priorité Ralliement", "Ralliement mid — malédiction 40 % (guide)."],
        objectiveFinish: ["Priorité d'Élimination", "Cible carries — malédiction (guide)."],
        objectiveCombat: ["Poker / Garder ses Distances", "Poke mid avant commit (guide)."],
      },
    },
    {
      id: "clown_jungle",
      when: (ctx) => ctx.jungler === "Clown",
      patch: {
        earlyJungle: ["Gank", "Clown — gank mid/bot (guide)."],
        objectiveFinish: ["Priorité d'Élimination", "Burst pick puis finir (guide Clown)."],
      },
    },
    {
      id: "vampire_top",
      when: (ctx) => ctx.ourComp.Top === "Vampire",
      patch: {
        topSerpent: ["Ne Pas Rejoindre", "Vampire split top — pas group Serpent (guide)."],
        morgard: ["Split 1-3-1", "Vampire side — Morgard 1-3-1 (guide)."],
      },
    },
    {
      id: "vs_cavalerie_bot",
      when: (ctx) => ctx.enemyComp.Bot === "Chevalier de cavalerie" && SCALE_CARRIES.has(ctx.ourComp.Bot),
      patch: {
        focusLane: ["Focus Mid/Bot", "Cavalerie bot vs carry squishy — babysitter (guide)."],
        earlyJungle: ["Gank", "Gank bot — contrer Cavalerie (guide)."],
        defense: ["Défendre la Lane Pressée", "Bot exposé — défendre lane pressée (guide)."],
      },
    },
    {
      id: "vs_porteur_infanterie",
      when: (ctx) => detectHeavyFrontPeel(ctx),
      patch: {
        objectiveCombat: [
          "Poker / Garder ses Distances",
          "Porteur + Infanterie — poke/pick, jamais 5v5 front (guide match enregistré).",
        ],
        objectiveFinish: [
          "Priorité d'Élimination",
          "Élimination JG puis carry — pas finir l'obj aveugle (guide).",
        ],
        defense: [
          "Défendre la Lane Pressée",
          "Forcer le Combat = lose vs leur front (guide).",
        ],
        closing: ["Flexible", "Pas Agressif — picks opportunistes (guide)."],
        towerSiege: ["Poker / Garder ses Distances", "Siège poker — pas dive (guide)."],
      },
    },
  ];

  /** Matchup lourd front + peel — tactiques-options match enregistré. */
  function detectHeavyFrontPeel(ctx) {
    const names = compValues(ctx.enemyComp);
    const hasPorteur = names.includes("Porteur de bouclier");
    const hasInfanterie = names.includes("Infanterie lourde");
    return hasPorteur && hasInfanterie;
  }

  function tactic(value, reason, assign) {
    const o = { value, reason };
    if (assign?.length) o.assign = assign;
    return o;
  }

  function applyGuideCompRules(ctx, tactics) {
    for (const rule of GUIDE_COMP_RULES) {
      if (!rule.when(ctx)) continue;
      for (const [key, [val, reason]] of Object.entries(rule.patch)) {
        const prev = tactics[key];
        tactics[key] = tactic(val, reason, prev?.assign);
      }
    }
    return tactics;
  }

  function inferGameModelFromTactics(tactics, ctx) {
    if (tactics.earlySerpent?.value === "Toujours Essayer" && tactics.objectiveCombat?.value === "Engage Fort") {
      return "early_serpent_pressure";
    }
    if (tactics.earlyJungle?.value === "Farm/Couverture" && ctx.ourScale >= 2) return "protect_scale";
    if (tactics.objectiveCombat?.value?.includes("Poker") && ctx.hasPickCore) return "pick_before_morgard";
    if (tactics.morgard?.value?.includes("Split") && ctx.cantEngage5v5) return "side_pressure_trade";
    if (ctx.behind) return "behind_stabilize";
    return "balanced";
  }

  function isPureSplitTrade(ctx) {
    return ctx.hasSideTradeCore && !ctx.hasPickCore && ctx.ourPoke >= 2 && !ctx.botThreat;
  }

  /** 12 réglages — une règle par option, ordre guide tactiques-jungle-objectifs.md */
  function buildTacticsFromGuide(ctx) {
    const jFit = ctx.jFit;
    const j = ctx.jungler || "Jungle";
    const splits = ctx.qualified;
    const cant5 = ctx.cantEngage5v5;
    const heavyFront = detectHeavyFrontPeel(ctx);
    const vsHeavy = cant5 || heavyFront;
    const t = {};

    // --- Focus de Lane ---
    if (ctx.botThreat || (ctx.enemyComp.Bot === "Chevalier de cavalerie" && SCALE_CARRIES.has(ctx.ourComp.Bot))) {
      t.focusLane = tactic("Focus Mid/Bot", "Lane bot menacée — jungle/supp babysitter carry (guide).");
    } else if (ctx.carry?.slot === "Bot" && (ctx.hasPeelSupport || ctx.ourPeel >= 1)) {
      t.focusLane = tactic("Focus Mid/Bot", "Carry bot + peel — prio Mid/Bot (guide protection scale).");
    } else if (isPureSplitTrade(ctx) && ctx.lanes.Top?.verdict === "win") {
      t.focusLane = tactic("Focus Top/Mid", "Trade side — pression top/mid (guide Pyro/Cavalerie).");
    } else {
      t.focusLane = tactic("Toutes les Lanes", "Équilibre vision et timers (guide défaut).");
    }

    // --- Style jungle — fit champion TOUJOURS en premier (guide § Fit jungle) ---
    let jg = jFit.earlyJungle || "Farm/Couverture";
    if (
      jg === "Gank" &&
      ctx.enemyJgSlow &&
      (AGGRESSIVE_EARLY_JG.has(j) || jFit.style === "aggressive")
    ) {
      jg = "Contre-Jungle";
    }
    if (
      jg === "Farm/Couverture" &&
      PICK_CORE.has(j) &&
      ctx.lanes.Jungle?.verdict !== "lose"
    ) {
      jg = "Gank";
    }
    if (
      jg === "Gank" &&
      !ctx.lanesMobile &&
      jFit.style === "safe" &&
      !PICK_CORE.has(j) &&
      !AGGRESSIVE_EARLY_JG.has(j)
    ) {
      jg = "Farm/Couverture";
    }
    t.earlyJungle = tactic(
      jg,
      jg === "Contre-Jungle"
        ? `${jFit.label} — invade vs jungle lent (guide).`
        : `${jFit.label || j} — fit guide jungle (champion > archétype).`
    );

    // --- Serpent early — modèle contest / delay / pick / trade ---
    if (
      AGGRESSIVE_EARLY_JG.has(j) &&
      ctx.lanesMobile &&
      ctx.ourFront >= 1 &&
      ctx.earlyCc >= 1 &&
      !vsHeavy
    ) {
      t.earlySerpent = tactic("Toujours Essayer", "Tempo JG + lanes mobiles + CC early (guide Lancier).");
    } else if (vsHeavy || ctx.behind) {
      if (ctx.hasPickCore || PICK_CORE.has(j) || ctx.ourPick >= 2) {
        t.earlySerpent = tactic(
          "Flexible",
          heavyFront
            ? "Serpent flexible — contest après pick, pas 5v5 aveugle (guide match Porteur+Infanterie)."
            : "Contest après avantage — setup pas prêt (guide pick)."
        );
      } else {
        t.earlySerpent = tactic(
          "Céder",
          heavyFront
            ? "Double front adverse — trade Serpent (guide)."
            : "Behind / scale — delay Serpent (guide)."
        );
      }
    } else if (jFit.serpent === "after_advantage" || ctx.hasPickCore || ctx.ourPick >= 2) {
      t.earlySerpent = tactic("Flexible", "Contest Serpent après avantage lane / pick (guide Ninja/Clown).");
    } else if (jFit.serpent === "delay" || ctx.ourScale >= 2) {
      t.earlySerpent = tactic(
        ctx.lanesMobile && ctx.ourFront >= 1 ? "Flexible" : "Céder",
        "Comp scale — survivre > contest early (guide Tireur)."
      );
    } else if (jFit.serpent === "delay_trade") {
      t.earlySerpent = tactic("Céder", "Trade side si contest direct perdant (guide Pyro/Cavalerie).");
    } else {
      t.earlySerpent = tactic("Flexible", "Contest seulement si setup playable (règle d'or guide).");
    }

    // --- Top au Serpent ---
    if (
      ctx.ourComp.Top === "Vampire" ||
      ctx.topSplit ||
      splits.some((s) => s.slot === "Top")
    ) {
      t.topSerpent = tactic(
        "Ne Pas Rejoindre",
        `${ctx.ourComp.Top || "Top"} split — pression side > group Serpent (guide).`
      );
    } else if (
      t.earlySerpent.value === "Toujours Essayer" &&
      hasTag(ctx.ourComp.Top, "frontline", ctx.metaMap)
    ) {
      t.topSerpent = tactic("Toujours Rejoindre", "Top tank — présence Serpent early (guide engage).");
    } else {
      t.topSerpent = tactic("Flexible", "Rejoindre si setup group, sinon push side.");
    }

    // --- Vagues ---
    if (vsHeavy && (ctx.hasPickCore || ctx.ourPoke >= 1 || heavyFront)) {
      t.waveMgmt = tactic(
        "Priorité Ralliement",
        "Regrouper mid pour picks avant objectif — pas arriver tard au pit (guide match Porteur+Infanterie)."
      );
    } else if (isPureSplitTrade(ctx)) {
      t.waveMgmt = tactic("Priorité Vague", "Push sidelanes — trade map (guide Pyro/Cavalerie).");
    } else if (t.earlySerpent.value === "Toujours Essayer") {
      t.waveMgmt = tactic("Priorité Ralliement", "Group cohérent pour Serpent (guide Lancier).");
    } else if (ctx.ourScale >= 2 && !ctx.hasPickCore) {
      t.waveMgmt = tactic("Priorité Vague", "Scale — farm/push side en sécurité.");
    } else {
      t.waveMgmt = tactic("Priorité Ralliement", "Prio mid pour vision et picks.");
    }

    // --- Préparation objectif ---
    const splitAssign = splits.slice(0, 2);
    if (vsHeavy && isPureSplitTrade(ctx) && splitAssign.length >= 1) {
      t.objectivePrep = tactic(
        splitAssign.length >= 2 ? "Split Push" : "Flexible",
        `Trade map — ${splitAssign.map((s) => s.name).join(" / ")} side (guide Pyro/Cavalerie).`,
        splitAssign
      );
    } else if (vsHeavy && (ctx.hasPickCore || ctx.ourPick >= 2)) {
      t.objectivePrep = tactic(
        "Flexible",
        "Pick comp — regrouper seulement si contest groupé viable (guide match enregistré).",
        splitAssign.slice(0, 1)
      );
    } else if (t.earlySerpent.value === "Toujours Essayer") {
      t.objectivePrep = tactic("Se Regrouper", "Arriver ensemble au Serpent (guide Lancier).", []);
    } else if (ctx.hasPickCore) {
      t.objectivePrep = tactic("Flexible", "Pick first — ne pas start fair 5v5 (guide Ninja/Démon).", splitAssign.slice(0, 1));
    } else {
      t.objectivePrep = tactic("Flexible", "Adapter selon vision (guide).", splitAssign.slice(0, 1));
    }

    // --- Combat objectif — règle d'or : jamais Engage Fort vs double front peel ---
    if (vsHeavy || ctx.ourPoke >= 2 || ctx.hasPickCore || !ctx.canWinDirect5v5) {
      t.objectiveCombat = tactic(
        "Poker / Garder ses Distances",
        vsHeavy
          ? `Front ${ctx.enemyFront} vs ${ctx.ourFront} — poke/pick, pas 5v5 (guide Porteur+Infanterie).`
          : "Pick/poke avant commit — comp ne gagne pas 5v5 égal (guide)."
      );
    } else if (AGGRESSIVE_EARLY_JG.has(j) && ctx.ourFront >= 1 && ctx.earlyCc >= 1) {
      t.objectiveCombat = tactic("Engage Fort", "Front + CC early — hard engage (guide Lancier).");
    } else {
      t.objectiveCombat = tactic(
        ctx.canWinDirect5v5 ? "Engage Fort" : "Poker / Garder ses Distances",
        ctx.canWinDirect5v5 ? "Front supérieur — engage autorisé." : "Commit sur advantage clair seulement."
      );
    }

    // --- Finalisation ---
    if (t.objectiveCombat.value.includes("Poker") || ctx.hasPickCore || vsHeavy) {
      t.objectiveFinish = tactic(
        "Priorité d'Élimination",
        heavyFront
          ? "Cible JG puis carry bot — turn après pick (guide match : Raven puis HUNDEN)."
          : "Turn / carries avant finir l'obj (guide pick & poke)."
      );
    } else if (t.earlySerpent.value === "Toujours Essayer") {
      t.objectiveFinish = tactic("Priorité de Combat", "Finir obj si ennemi zoned (guide Lancier).");
    } else {
      t.objectiveFinish = tactic(
        "Priorité d'Élimination",
        "Priorité carries avant objectif par défaut (guide)."
      );
    }

    // --- Morgard ---
    if (vsHeavy && splitAssign.length >= 2) {
      t.morgard = tactic(
        "Split 1-3-1",
        `Split ${splitAssign.map((s) => s.name).join(" + ")} — éviter front groupé (guide).`,
        splitAssign
      );
    } else if (vsHeavy && splitAssign.length === 1) {
      t.morgard = tactic(
        "Split 1-4",
        `Side ${splitAssign[0].name} — trade pendant groupe 4 (guide).`,
        splitAssign
      );
    } else if (ctx.hasPickCore && !ctx.canWinDirect5v5) {
      t.morgard = tactic(
        "Split 1-4",
        "Avantage numérique avant Morgard — pas 5v5 égal (guide Ex. 3).",
        splitAssign.slice(0, 1)
      );
    } else if (ctx.ourScale >= 2 && ctx.hasPeelSupport) {
      t.morgard = tactic("Se Regrouper à 5", "Closing stable une fois carry online (guide Tireur).", []);
    } else if (isPureSplitTrade(ctx)) {
      t.morgard = tactic(
        splitAssign.length >= 2 ? "Split 1-3-1" : "Split 1-4",
        "Conversion Morgard via side (guide Pyro/Cavalerie).",
        splitAssign
      );
    } else {
      t.morgard = tactic(
        splitAssign.length ? "Split 1-4" : "Se Regrouper à 5",
        splitAssign.length ? "Side si teamfight incertain." : "Group si comp le permet.",
        splitAssign.slice(0, 1)
      );
    }

    // --- Siège ---
    if (vsHeavy || ctx.ourPoke >= 1 || ctx.ourFront < 2) {
      t.towerSiege = tactic("Poker / Garder ses Distances", "Chip tours — pas dive sans front (guide).");
    } else if (ctx.ahead && ctx.ourFront >= 2 && !vsHeavy) {
      t.towerSiege = tactic("Dive", "Ahead + front — dive sous tour.");
    } else {
      t.towerSiege = tactic("Poker / Garder ses Distances", "Siège safe par défaut.");
    }

    // --- Défense ---
    if (ctx.botThreat || vsHeavy || ctx.ourScale >= 2 || ctx.behind) {
      t.defense = tactic(
        "Défendre la Lane Pressée",
        ctx.botThreat
          ? "Bot exposé — défendre lane pressée (guide Cavalerie)."
          : "Scale / manque front — éviter chain fights (guide)."
      );
    } else if (t.earlySerpent.value === "Toujours Essayer" && ctx.ahead) {
      t.defense = tactic("Forcer le Combat", "Ahead tempo — punir rotations (guide Lancier).");
    } else {
      t.defense = tactic("Défendre la Lane Pressée", "Défaut safe — protéger lanes faibles.");
    }

    // --- Conclusion ---
    if (vsHeavy || ctx.hasPickCore) {
      t.closing = tactic("Flexible", "Picks opportunistes — pas forcer bad fights (guide match enregistré).");
    } else if (ctx.ourScale >= 2) {
      t.closing = tactic("Stable", "Close safe après timing carry (guide Tireur).");
    } else if (t.earlySerpent.value === "Toujours Essayer" && ctx.ahead && !vsHeavy) {
      t.closing = tactic("Agressif", "Convertir tempo early (guide Lancier).");
    } else if (ctx.behind) {
      t.closing = tactic("Stable", "Rattrapage — pas de throw.");
    } else {
      t.closing = tactic("Flexible", "Adapter selon lead et picks.");
    }

    // Assign split pushers on prep/morgard
    if (t.objectivePrep && splitAssign.length && !t.objectivePrep.assign?.length) {
      t.objectivePrep.assign = splitAssign.slice(0, t.objectivePrep.value === "Split Push" ? 2 : 1);
    }
    if (t.morgard && splitAssign.length && !t.morgard.assign?.length) {
      t.morgard.assign = splitAssign.slice(0, t.morgard.value === "Split 1-3-1" ? 2 : 1);
    }

    return applyGuideCompRules(ctx, t);
  }

  function enforceGuideHardRules(ctx, tactics) {
    const vsHeavy = ctx.cantEngage5v5 || detectHeavyFrontPeel(ctx);

    if (vsHeavy && tactics.objectiveCombat?.value === "Engage Fort") {
      tactics.objectiveCombat = tactic(
        "Poker / Garder ses Distances",
        "Engage Fort interdit vs Porteur+Infanterie / double front (guide)."
      );
    }
    if (vsHeavy && tactics.earlySerpent?.value === "Toujours Essayer") {
      tactics.earlySerpent = tactic("Flexible", "Serpent flexible vs front lourd — pas contest aveugle.");
    }
    if (ctx.botThreat && tactics.focusLane?.value !== "Focus Mid/Bot") {
      tactics.focusLane = tactic("Focus Mid/Bot", "Bot menacé — correction guide.");
    }
    if (vsHeavy && tactics.closing?.value === "Agressif") {
      tactics.closing = tactic("Flexible", "Conclusion Agressif = bad fights vs leur front (guide).");
    }
    if (vsHeavy && tactics.defense?.value === "Forcer le Combat") {
      tactics.defense = tactic("Défendre la Lane Pressée", "Ne pas forcer 5v5 vs front lourd (guide).");
    }
    return tactics;
  }

  /** @deprecated v11 — conservé pour debug / export */
  function scoreArchetypes(ctx) {
    const scores = {
      early_serpent_pressure: 0,
      protect_scale: 0,
      pick_before_morgard: 0,
      side_pressure_trade: 0,
      behind_stabilize: 0,
      balanced: 18,
    };

    if (ctx.behind) {
      scores.behind_stabilize += 120;
      return scores;
    }

    const j = ctx.jungler;
    const cant5 = ctx.cantEngage5v5;

    // --- Early Serpent (Lancier) ---
    if (AGGRESSIVE_EARLY_JG.has(j)) scores.early_serpent_pressure += 38;
    if (ctx.jFit.style === "aggressive" || ctx.jFit.style === "engage") scores.early_serpent_pressure += 22;
    if (ctx.lanesMobile) scores.early_serpent_pressure += 28;
    if (ctx.ourFront >= 1) scores.early_serpent_pressure += 22;
    if (ctx.earlyCc >= 2) scores.early_serpent_pressure += 12;
    if (ctx.ahead) scores.early_serpent_pressure += 18;
    if (ctx.gunnerPressure) scores.early_serpent_pressure += 15;
    if (cant5) scores.early_serpent_pressure -= 55;
    if (ctx.ourScale >= 2) scores.early_serpent_pressure -= 28;
    if (ctx.botThreat) scores.early_serpent_pressure -= 15;

    // --- Protect scale (Tireur) ---
    if (ctx.carry && SCALE_CARRIES.has(ctx.carry.name)) scores.protect_scale += 42;
    if (ctx.ourScale >= 2) scores.protect_scale += 38;
    if (ctx.hasPeelSupport || ctx.ourPeel >= 1) scores.protect_scale += 28;
    if (ctx.jFit.style === "safe" || ctx.jFit.serpent === "delay") scores.protect_scale += 22;
    if (ctx.botThreat) scores.protect_scale += 20;
    if (ctx.compType === "hypercarry") scores.protect_scale += 14;
    if (AGGRESSIVE_EARLY_JG.has(j) && ctx.lanesMobile && ctx.ourFront >= 1) scores.protect_scale -= 25;

    // --- Pick before Morgard ---
    if (ctx.hasPickCore) scores.pick_before_morgard += 32;
    if (PICK_CORE.has(j)) scores.pick_before_morgard += 28;
    if (ctx.ourPick >= 2) scores.pick_before_morgard += 30;
    if (ctx.enemyPeel <= 1) scores.pick_before_morgard += 22;
    if (cant5) scores.pick_before_morgard += 28;
    if (!ctx.canWinDirect5v5) scores.pick_before_morgard += 15;
    if (ctx.canWinDirect5v5 && ctx.ourFront >= ctx.enemyFront) scores.pick_before_morgard -= 35;
    if (ctx.compType === "pick_global" || ctx.compType === "all_in") scores.pick_before_morgard += 12;

    // --- Side pressure trade ---
    if (cant5) scores.side_pressure_trade += 50;
    if (ctx.hasSideTradeCore) scores.side_pressure_trade += 26;
    if (ctx.ourPoke >= 2) scores.side_pressure_trade += 24;
    if (ctx.qualified.length >= 1) scores.side_pressure_trade += 18;
    if (ctx.enemyFront > ctx.ourFront) scores.side_pressure_trade += 16;
    if (ctx.laneNet < 0) scores.side_pressure_trade += 12;
    if (ctx.canWinDirect5v5) scores.side_pressure_trade -= 40;
    if (ctx.compType === "poke_disengage" || ctx.compType === "split_push") scores.side_pressure_trade += 10;

    // Conflits famille → favoriser trade ou protect
    if (ctx.familySummary?.conflicts?.length) {
      scores.side_pressure_trade += 8;
      scores.protect_scale += 6;
      scores.early_serpent_pressure -= 12;
    }

    return scores;
  }

  function pickGameModel(ctx) {
    const scores = scoreArchetypes(ctx);
    let best = "balanced";
    let bestScore = -Infinity;
    for (const [key, val] of Object.entries(scores)) {
      if (val > bestScore) {
        bestScore = val;
        best = key;
      }
    }
    return best;
  }

  function pickEliminationTargets(ctx) {
    const targets = [];
    if (ctx.enemyComp.Jungle && ctx.lanes.Jungle?.verdict === "win") {
      targets.push({
        name: ctx.enemyComp.Jungle,
        slot: "Jungle",
        why: "Jungle favorable — deny tempo (guide match : Raven).",
      });
    }
    if (ctx.enemyComp.Bot && (ctx.botThreat || hasTag(ctx.enemyComp.Bot, "scaling", ctx.metaMap))) {
      targets.push({
        name: ctx.enemyComp.Bot,
        slot: "Bot",
        why: "Carry bot menaçant — cible pick (guide match : HUNDEN).",
      });
    }
    for (const slot of ["Mid", "Support"]) {
      if (ctx.lanes[slot]?.verdict === "win" && ctx.enemyComp[slot]) {
        targets.push({ name: ctx.enemyComp[slot], slot, why: `Lane ${slot} gagnable.` });
      }
    }
    const seen = new Set();
    return targets.filter((t) => {
      if (seen.has(t.name)) return false;
      seen.add(t.name);
      return true;
    }).slice(0, 3);
  }

  function buildAvoidList(ctx, tactics, model) {
    const avoid = [];
    const vsHeavy = ctx.cantEngage5v5 || detectHeavyFrontPeel(ctx);
    if (tactics.earlySerpent.value === "Céder") {
      avoid.push({
        setting: "Toujours Essayer (Serpent)",
        why: "Ne pas contest parce que l'objectif existe — setup non playable (guide).",
      });
    }
    if (tactics.objectiveCombat.value.includes("Poker") || vsHeavy) {
      avoid.push({
        setting: "Engage Fort (combat objectif)",
        why: vsHeavy
          ? "Porteur + Infanterie — Engage Fort = lose 5v5 (guide match enregistré)."
          : "Pick/poke comp — Poker first (guide failure table).",
      });
    }
    if (ctx.hasPickCore && tactics.morgard.value === "Se Regrouper à 5") {
      avoid.push({
        setting: "Se Regrouper à 5 (Morgard)",
        why: "Do not start fair 5v5 — numbers advantage first (guide Ex. 3).",
      });
    }
    if (vsHeavy && tactics.closing.value === "Agressif") {
      avoid.push({
        setting: "Conclusion Agressif",
        why: "Force bad fights vs front lourd (guide match enregistré).",
      });
    }
    if (ctx.botThreat && tactics.focusLane.value !== "Focus Mid/Bot") {
      avoid.push({
        setting: "Focus Top/Mid",
        why: "Bot menacé — Focus Mid/Bot obligatoire (guide).",
      });
    }
    if (vsHeavy && tactics.defense?.value === "Forcer le Combat") {
      avoid.push({
        setting: "Forcer le Combat (défense)",
        why: "Lose 5v5 vs Porteur+Infanterie — Défendre lane pressée (guide).",
      });
    }
    for (const c of ctx.familySummary?.conflicts || []) {
      avoid.push({ setting: "Plan incohérent", why: c });
    }
    return avoid;
  }

  function buildWinPlan(ctx, model, elimTargets) {
    const parts = [];
    if (ctx.roles?.ourGoal) parts.push(ctx.roles.ourGoal);
    else if (ctx.roles?.label) parts.push(ctx.roles.label);
    if (ctx.roles?.dualRole) parts.push("Double rôle — pression board + win late");
    if (ctx.roles?.invGap > 10) parts.push(`Inévitabilité +${Math.round(ctx.roles.invGap)} — ne pas gaspiller`);
    else if (ctx.roles?.invGap < -10) parts.push(`Leur inévitabilité — finir avant le late`);
    const warn = global.TFM2Beatdown?.roleMisassignmentWarning?.(ctx.roles);
    if (warn) parts.push(warn);
    if (ctx.cantEngage5v5) {
      parts.push(`Ne pas 5v5 — front ${ctx.ourFront} vs ${ctx.enemyFront} adverse.`);
    }
    if (ctx.ourPick >= 2) parts.push("Picks avant objectif — éviter les 5v5 groupés.");
    if (ctx.ourScale >= 2) parts.push("Survivre early, protéger le carry, delay Serpent.");
    if (ctx.ourPoke >= 2) parts.push("Poker objectif : chip puis Élimination carry.");
    if (ctx.qualified.length && ctx.cantEngage5v5) {
      parts.push(`Split ${ctx.qualified.slice(0, 2).map((q) => q.name).join(" / ")}.`);
    }
    if (ctx.botThreat) parts.push("Bot lane faible — jungle/supp babysitter.");
    if (ctx.compTypeLabel) parts.push(`Plan comp : ${ctx.compTypeLabel}.`);
    parts.push(ARCHETYPE_LABELS[model] || model);
    if (elimTargets.length) parts.push(`Cibles : ${elimTargets.map((t) => t.name).join(", ")}.`);
    if (!parts.length) parts.push("Prio lanes → objectifs avec setup jouable.");
    return parts;
  }

  function baseCategoriesFromBuild(champion, metaMap) {
    const build = metaMap[champion]?.build || [];
    const dp = draftProfile(champion, metaMap);
    const cats = build.slice(0, 3).map((item) => ITEM_TO_CATEGORY[item] || ITEM_CATEGORY.PLAYER);
    while (cats.length < 3) {
      if ((dp.apShare ?? 0) > 0.55) cats.push(ITEM_CATEGORY.AP);
      else if ((dp.adShare ?? 0) > 0.55) cats.push(ITEM_CATEGORY.AD);
      else cats.push(ITEM_CATEGORY.PLAYER);
    }
    return cats.slice(0, 3);
  }

  function setJungleGuide(data) {
    if (!data || typeof data !== "object") return;
    JUNGLE_GUIDE_DATA = data;
    const fit = data.jungleChampionFit;
    if (!fit) return;
    for (const [name, row] of Object.entries(fit)) {
      JUNGLE_FIT[name] = {
        style: row.style,
        serpent: row.serpent,
        earlyJungle: row.earlyJungle,
        label: row.label,
        verify: row.verify,
      };
    }
    if (data.archetypeLabels) Object.assign(ARCHETYPE_LABELS, data.archetypeLabels);
    if (data.failureAdjustments?.length) {
      FAILURE_ADJUSTMENTS.length = 0;
      for (const row of data.failureAdjustments) {
        FAILURE_ADJUSTMENTS.push({
          pattern: row.pattern,
          adjust: row.adjust,
        });
      }
    }
  }

  function getJungleGuide() {
    return JUNGLE_GUIDE_DATA;
  }

  function detectDraftShell(ourNames) {
    const DG = global.TFM2DraftGuide;
    if (!DG?.detectShell || !ourNames?.length) return null;
    const det = DG.detectShell(ourNames);
    if (!det || det.confidence < 0.35) return null;
    return det;
  }

  function applyShellDraftPatches(ctx, tactics) {
    const det = detectDraftShell(ctx.ourNames);
    if (!det?.shell) return { tactics, shellDet: det };

    const shell = det.shell;
    const label = shell.labelFr || shell.id || "shell";
    const patches = {
      ...(shell.serpen?.tactics || {}),
      ...(shell.morgard?.tactics || {}),
    };
    for (const [key, val] of Object.entries(patches)) {
      if (!val || !TACTIC_ORDER.includes(key)) continue;
      tactics[key] = tactic(val, `${label} — draft-guide shell`, tactics[key]?.assign);
    }
    return { tactics: enforceGuideHardRules(ctx, tactics), shellDet: det };
  }

  const TACTIC_ORDER = [
    "focusLane", "earlyJungle", "earlySerpent", "topSerpent", "waveMgmt",
    "objectivePrep", "objectiveCombat", "objectiveFinish", "morgard",
    "towerSiege", "defense", "closing",
  ];

  function buildShellHints(shellDet, ourNames) {
    if (!shellDet?.shell) return null;
    const DG = global.TFM2DraftGuide;
    const shell = shellDet.shell;
    return {
      shell: shell.labelFr || shell.id,
      confidence: shellDet.confidence,
      style: shell.style || null,
      serpen: DG?.serpenHint?.(shell, ourNames) || shell.serpen?.label || null,
      morgard: DG?.morgardHint?.(shell) || shell.morgard?.label || null,
      serpenPlan: shell.serpen?.plan || null,
      morgardPlan: shell.morgard?.plan || null,
    };
  }

  function buildGuideExtras(ctx, model, tactics, shellDet) {
    const g = JUNGLE_GUIDE_DATA;
    const quickEntry = g?.quickSettingsIndex?.find((e) => e.id === model) || null;
    const decisionKey = OBJECTIVE_DECISION[model] || "flex";
    const objDecision = g?.objectiveDecisionModel?.[decisionKey] || null;
    const jungler = ctx.jungler;
    const fitRow = jungler && (g?.jungleChampionFit?.[jungler] || JUNGLE_FIT[jungler]);
    const combatVal = tactics.objectiveCombat?.value || "";
    const combatApproach =
      g?.objectiveCombatOptions?.find((o) => combatVal && o.value === combatVal) ||
      g?.objectiveCombatOptions?.find((o) => o.id === "poke") ||
      null;
    const finishVal = tactics.objectiveFinish?.value || "";
    const finishBehavior =
      g?.objectiveFinishBehaviors?.find((o) => finishVal && o.value === finishVal) || null;
    const closingVal = tactics.closing?.value || "";
    const morgardPlan =
      g?.morgardClosingPlans?.find(
        (p) =>
          (p.closing && p.closing === closingVal) ||
          (p.morgard && tactics.morgard?.value && p.morgard === tactics.morgard.value) ||
          (p.value && p.value === closingVal)
      ) || null;
    const templateMatch = g?.templates?.find((t) => t.id === model || t.key === model) || null;

    const reviewChecklist = [];
    const rq = REVIEW_QUESTIONS[model];
    if (rq) reviewChecklist.push({ text: rq, kind: "archetype" });
    if (fitRow?.verify) reviewChecklist.push({ text: fitRow.verify, kind: "jungler" });
    if (quickEntry?.review) reviewChecklist.push({ text: quickEntry.review, kind: "template" });
    for (const c of shellDet?.shell?.serpen?.checks || []) {
      const label = SERPEN_CHECK_LABELS[c] || c;
      reviewChecklist.push({ text: label, kind: "serpent" });
    }
    reviewChecklist.push({
      text: "Serpent/Morgard a-t-il créé conversion (tours, or, reset) ?",
      kind: "conversion",
    });

    return {
      quickIndex: g?.quickSettingsIndex || [],
      quickEntry,
      objectiveDecisionDetail: objDecision,
      jungleFitDetail: fitRow
        ? { champion: jungler, ...fitRow, hero: HERO_JUNGLE_CHAMPS.has(jungler) }
        : null,
      shellHints: buildShellHints(shellDet, ctx.ourNames),
      combatApproach,
      finishBehavior,
      morgardPlan,
      templateMatch,
      reviewChecklist,
      heroJungleFit: g?.jungleChampionFit
        ? Object.entries(g.jungleChampionFit)
            .filter(([name]) => HERO_JUNGLE_CHAMPS.has(name))
            .map(([name, row]) => ({ name, ...row }))
        : [],
    };
  }

  function recommendItemGuides(ourComp, enemyComp, metaMap, lanes) {
    const our = SLOTS.filter((s) => ourComp[s]).map((slot) => {
      const champion = ourComp[slot];
      const lane = lanes[slot];
      const base = baseCategoriesFromBuild(champion, metaMap);
      const dp = draftProfile(champion, metaMap);
      const slots = base.map((category, i) => {
        let cat = category;
        const reasons = [];
        if (lane?.verdict === "lose" && i === 0 && (dp.tankWeight ?? 0) < 0.8) {
          cat = ITEM_CATEGORY.HP;
          reasons.push(`Lane ${slot} difficile — survie.`);
        }
        if (!reasons.length && metaMap[champion]?.build?.[i]) {
          reasons.push(`Build meta : ${metaMap[champion].build[i]}.`);
        }
        return {
          index: i + 1,
          item: metaMap[champion]?.build?.[i] || null,
          category: cat,
          label: ITEM_CATEGORY_LABELS[cat],
          reason: reasons.join(" ") || "Profil champion.",
        };
      });
      return { champion, laneSlot: slot, slots };
    });
    const enemy = SLOTS.filter((s) => enemyComp[s]).map((slot) => ({
      champion: enemyComp[slot],
      laneSlot: slot,
      slots: baseCategoriesFromBuild(enemyComp[slot], metaMap).map((category, i) => ({
        index: i + 1,
        item: metaMap[enemyComp[slot]]?.build?.[i] || null,
        category,
        label: ITEM_CATEGORY_LABELS[category],
        reason: metaMap[enemyComp[slot]]?.build?.[i]
          ? `Build probable : ${metaMap[enemyComp[slot]].build[i]}.`
          : "Profil champion.",
      })),
    }));
    return { our, enemy };
  }

  function recommend(ourComp, enemyComp, metaMap, championsByName) {
    const ctx = gatherContext(ourComp, enemyComp, metaMap, championsByName);
    const BD = global.TFM2Beatdown;
    let tactics = {};
    let optionScores = null;
    let beatPlan = null;

    if (BD && ctx.roles) {
      const beat = BD.tacticsFromRoles(ctx, ctx.roles);
      for (const [key, t] of Object.entries(beat.tactics)) {
        tactics[key] = {
          value: t.value,
          reason: t.reason,
          assign: t.assign,
          runnerUp: t.runnerUp,
          margin: t.margin,
        };
      }
      optionScores = beat.optionScores;
      beatPlan = beat.plan;
      tactics = applyGuideCompRules(ctx, tactics);
      tactics = enforceGuideHardRules(ctx, tactics);
      if (ctx.jFit?.earlyJungle && ctx.jungler) {
        const jFitVal = ctx.jFit.earlyJungle;
        const cur = tactics.earlyJungle?.value;
        if (cur && cur !== jFitVal && (tactics.earlyJungle.margin ?? 0) < 10) {
          tactics.earlyJungle = tactic(
            jFitVal,
            `${ctx.jFit.label || ctx.jungler} — fit jungle (nudge guide).`,
            tactics.earlyJungle.assign
          );
        }
      }
    } else {
      tactics = buildTacticsFromGuide(ctx);
      tactics = enforceGuideHardRules(ctx, tactics);
    }

    const shellPatch = applyShellDraftPatches(ctx, tactics);
    tactics = shellPatch.tactics;
    const shellDet = shellPatch.shellDet;

    let model = ctx.roles?.dualRole
      ? "side_pressure_trade"
      : ctx.roles?.ourInevitability > ctx.roles?.enemyInevitability + 10
        ? "protect_scale"
        : ctx.roles?.enemyInevitability > ctx.roles?.ourInevitability + 10
          ? "pick_before_morgard"
          : ctx.roles?.ourRole === BD?.ROLE?.BEATDOWN
            ? "early_serpent_pressure"
            : inferGameModelFromTactics(tactics, ctx);

    const g = JUNGLE_GUIDE_DATA;
    if (shellDet?.shell?.style && g?.shellStyleToArchetype?.[shellDet.shell.style]) {
      const shellModel = g.shellStyleToArchetype[shellDet.shell.style];
      if (shellDet.confidence >= 0.45) model = shellModel;
    } else if (ctx.behind && model !== "behind_stabilize") {
      const scores = scoreArchetypes(ctx);
      if ((scores.behind_stabilize || 0) >= 80) model = "behind_stabilize";
    }

    const archetypeScores = scoreArchetypes(ctx);
    const archetype = model;
    const archetypeLabel = ARCHETYPE_LABELS[model] || model;
    const elimTargets = pickEliminationTargets(ctx);
    const avoid = buildAvoidList(ctx, tactics, model);
    const splitPlan = {
      prep: tactics.objectivePrep.value,
      morgard: tactics.morgard.value,
      assign: tactics.objectivePrep.assign || [],
    };

    const itemGuides =
      global.TFM2ItemGuide?.recommendGuides?.(ourComp, enemyComp, metaMap, ctx.lanes, ctx) ||
      recommendItemGuides(ourComp, enemyComp, metaMap, ctx.lanes);

    const guideExtras = buildGuideExtras(ctx, model, tactics, shellDet);

    return {
      lanes: ctx.lanes,
      tactics,
      archetype,
      archetypeLabel,
      guideUrl: g?.guideUrl || GUIDE,
      objectiveDecision: OBJECTIVE_DECISION[model] || "flex",
      reviewQuestion: REVIEW_QUESTIONS[model] || null,
      failureAdjustments: FAILURE_ADJUSTMENTS,
      ...guideExtras,
      compType: ctx.compType,
      compTypeLabel: ctx.compTypeLabel,
      familySummary: ctx.familySummary,
      splitPushers: ctx.qualified.map((q) => q.name).slice(0, 3),
      splitAssignments: { objectivePrep: splitPlan.assign, morgard: splitPlan.assign },
      eliminationTargets: elimTargets,
      winPlan: buildWinPlan(ctx, model, elimTargets),
      avoid,
      itemGuides,
      profile: {
        ourFront: ctx.ourFront,
        enemyFront: ctx.enemyFront,
        ourPeel: ctx.ourPeel,
        ourScale: ctx.ourScale,
        ourPoke: ctx.ourPoke,
        ourPick: ctx.ourPick,
        cantEngage5v5: ctx.cantEngage5v5,
        compMargin: ctx.compMargin,
        gameModel: model,
        archetypeScores,
        jungleFit: ctx.jFit?.label,
        beatdownRole: ctx.roles?.ourRole,
        beatdownPlan: beatPlan || ctx.roles?.label,
        winGoal: ctx.roles?.ourGoal || beatPlan,
        enemyGoal: ctx.roles?.enemyGoal,
        ourInevitability: ctx.roles?.ourInevitability,
        enemyInevitability: ctx.roles?.enemyInevitability,
        invGap: ctx.roles?.invGap,
        dualRole: ctx.roles?.dualRole,
        tableGap: ctx.roles?.tableGap,
        beatdownProfile: ctx.roles?.our,
        enemyBeatdownProfile: ctx.roles?.enemy,
        misassignmentWarning: BD?.roleMisassignmentWarning?.(ctx.roles),
        tacticOptionScores: optionScores,
      },
      colorSummary: global.TFM2Draft?.teamColorSummary
        ? {
            our: global.TFM2Draft.teamColorSummary(
              SLOTS.map((s) => ourComp[s]).filter(Boolean),
              championsByName,
              metaMap
            ),
            enemy: global.TFM2Draft.teamColorSummary(
              SLOTS.map((s) => enemyComp[s]).filter(Boolean),
              championsByName,
              metaMap
            ),
          }
        : null,
    };
  }

  function scoreArchetypesExport(ctx) {
    const scores = scoreArchetypes(ctx);
    const model = pickGameModel(ctx);
    return { archetype: model, scores, label: ARCHETYPE_LABELS[model] };
  }

  const IG = () => global.TFM2ItemGuide;

  global.TFM2Tactics = {
    SLOTS,
    GUIDE,
    HERO_JUNGLE_CHAMPS,
    OBJECTIVE_DECISION,
    REVIEW_QUESTIONS,
    FAILURE_ADJUSTMENTS,
    SERPEN_CHECK_LABELS,
    ITEM_CATEGORY: IG()?.ITEM_CATEGORY || ITEM_CATEGORY,
    ITEM_CATEGORY_LABELS: IG()?.ITEM_CATEGORY_LABELS || ITEM_CATEGORY_LABELS,
    JUNGLE_FIT,
    ARCHETYPE_LABELS,
    setJungleGuide,
    getJungleGuide,
    recommend,
    gatherContext,
    scoreArchetypes: scoreArchetypesExport,
    inferJungleStyle,
    pickGameModel,
    recommendItemGuides: (our, en, meta, lanes, ctx) =>
      IG()?.recommendGuides?.(our, en, meta, lanes, ctx) || recommendItemGuides(our, en, meta, lanes),
  };
})(typeof window !== "undefined" ? window : globalThis);
