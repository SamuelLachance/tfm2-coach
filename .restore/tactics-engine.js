/**
 * TFM2 Tactics Recommender — analyse comp vs comp → réglages in-game (FR).
 */
(function (global) {
  const SLOTS = ["Top", "Jungle", "Mid", "Bot", "Support"];

  function hasTag(meta, tag) {
    return meta?.tags?.includes(tag);
  }

  function teamTags(comp, metaMap) {
    const tags = new Set();
    for (const slot of SLOTS) {
      const name = comp[slot];
      if (!name) continue;
      (metaMap[name]?.tags || []).forEach((t) => tags.add(t));
    }
    return tags;
  }

  function countTags(comp, metaMap, tag) {
    return SLOTS.filter((s) => hasTag(metaMap[comp[s]], tag)).length;
  }

  function laneVerdict(ours, theirs, metaMap) {
    if (!ours || !theirs) return { verdict: "unknown", note: "Lane incomplète." };
    const o = metaMap[ours];
    const e = metaMap[theirs];
    if (o?.worstMatchups?.includes(theirs)) {
      return { verdict: "lose", note: `${ours} est counter par ${theirs} (pire matchup).` };
    }
    if (e?.worstMatchups?.includes(ours)) {
      return { verdict: "win", note: `${theirs} est counter par ${ours}.` };
    }
    if (hasTag(o, "scaling") && !hasTag(e, "dive") && hasTag(e, "assassin")) {
      return { verdict: "lose", note: `${ours} scale mais ${theirs} peut dive early.` };
    }
    if (hasTag(o, "poke") && hasTag(e, "frontline")) {
      return { verdict: "even", note: `Poke vs front — jouer distance.` };
    }
    if (hasTag(o, "frontline") && hasTag(e, "mage_burst")) {
      return { verdict: "win", note: `Front absorbe burst de ${theirs}.` };
    }
    return { verdict: "even", note: `Matchup standard — prio et items décident.` };
  }

  function findSplitPushers(comp, metaMap) {
    return SLOTS.map((s) => comp[s])
      .filter(Boolean)
      .filter((n) => {
        const m = metaMap[n];
        return hasTag(m, "split") || hasTag(m, "poke") || n === "Vampire" || n === "Pyromancien";
      });
  }

  function recommend(ourComp, enemyComp, metaMap) {
    const ourTags = teamTags(ourComp, metaMap);
    const enemyTags = teamTags(enemyComp, metaMap);
    const jungler = ourComp.Jungle;
    const jMeta = metaMap[jungler];
    const enemyJungler = enemyComp.Jungle;

    const lanes = {};
    for (const slot of SLOTS) {
      lanes[slot] = laneVerdict(ourComp[slot], enemyComp[slot], metaMap);
    }

    const ourFront = countTags(ourComp, metaMap, "frontline");
    const enemyFront = countTags(enemyComp, metaMap, "frontline");
    const ourPeel = countTags(ourComp, metaMap, "peel");
    const ourScale = countTags(ourComp, metaMap, "scaling");
    const ourPoke = countTags(ourComp, metaMap, "poke");
    const ourPick = countTags(ourComp, metaMap, "pick_jungle") + countTags(ourComp, metaMap, "assassin");
    const enemyDive = countTags(enemyComp, metaMap, "dive");
    const enemyPeel = countTags(enemyComp, metaMap, "peel");

    const botThreat = lanes.Bot?.verdict === "lose";
    const topSplit = hasTag(metaMap[ourComp.Top], "split");

    // --- Focus Lane ---
    let focusLane = "Toutes les Lanes";
    if (botThreat || enemyDive >= 2) focusLane = "Focus Mid/Bot";
    else if (lanes.Top?.verdict === "lose" && !topSplit) focusLane = "Focus Top/Mid";
    else if (ourPoke >= 2) focusLane = "Focus Mid/Bot";

    // --- Early Jungle ---
    let earlyJungle = "Farm/Couverture";
    let jungleReason = "Comp scale ou jungle safe — éviter les morts early.";
    if (hasTag(jMeta, "aggressive_jungle") && ourFront >= 1 && lanes.Mid?.verdict !== "lose") {
      earlyJungle = "Gank";
      jungleReason = `${jungler} tempo early + front pour follow — créer pression.`;
    } else if (hasTag(jMeta, "pick_jungle") && enemyPeel <= 1) {
      earlyJungle = "Gank";
      jungleReason = `${jungler} pick — chercher picks sur carry/peel faible.`;
    } else if (hasTag(jMeta, "farm_jungle") || ourScale >= 2) {
      earlyJungle = "Farm/Couverture";
      jungleReason = `${jungler || "Jungle"} / comp scale — farm et couvrir lanes.`;
    }
    if (hasTag(metaMap[enemyJungler], "farm_jungle") && hasTag(jMeta, "aggressive_jungle")) {
      earlyJungle = "Contre-Jungle";
      jungleReason += " Ennemi farm JG — invade possible.";
    }

    // --- Serpent ---
    let earlySerpent = "Flexible";
    let serpentReason = "Setup incertain — flexible par défaut.";
    const canContestSerpent =
      (hasTag(jMeta, "aggressive_jungle") || hasTag(jMeta, "engage")) &&
      ourFront >= 1 &&
      lanes.Mid?.verdict !== "lose";
    if (canContestSerpent && earlyJungle !== "Farm/Couverture") {
      earlySerpent = "Toujours Essayer";
      serpentReason = "Tempo early + front — contest Serpent si lanes mobiles.";
    } else if (ourScale >= 2 || ourFront === 0) {
      earlySerpent = "Céder";
      serpentReason = "Scale ou manque front — ne pas flip Serpent early.";
    }

    // --- Top Serpent ---
    let topSerpent = "Flexible";
    if (topSplit || hasTag(metaMap[ourComp.Top], "split")) {
      topSerpent = "Ne Pas Rejoindre";
    } else if (hasTag(metaMap[ourComp.Top], "frontline") || hasTag(metaMap[ourComp.Top], "engage")) {
      topSerpent = "Toujours Rejoindre";
    }

    // --- Wave / Objective prep ---
    const splitPushers = findSplitPushers(ourComp, metaMap);
    let waveMgmt = ourPoke >= 2 || ourScale >= 2 ? "Priorité Vague" : "Priorité Ralliement";
    let objectivePrep = "Flexible";
    if (ourFront >= 2 && enemyFront <= 1) objectivePrep = "Se Regrouper";
    else if (splitPushers.length >= 2) objectivePrep = "Split Push";

    // --- Objective combat ---
    let objectiveCombat = "Poker / Garder ses Distances";
    let combatReason = "Comp poke/pick ou vs front lourd — garder distance.";
    if (ourFront >= 2 && ourFront > enemyFront && !ourPoke) {
      objectiveCombat = "Engage Fort";
      combatReason = "Supériorité front + CC — forcer les fights.";
    } else if (ourPick >= 2 && enemyPeel <= 1) {
      objectiveCombat = "Poker / Garder ses Distances";
      combatReason = "Comp pick — softening puis élimination, pas 5v5 égal.";
    } else if (enemyFront >= 2 && ourFront <= 1) {
      objectiveCombat = "Poker / Garder ses Distances";
      combatReason = `Front ennemi (${enemyFront}) > nôtre — ne pas Engage Fort.`;
    }

    // --- Objective finish ---
    let objectiveFinish = "Priorité d'Élimination";
    if (ourPick >= 1 || ourPoke >= 2) {
      objectiveFinish = "Priorité d'Élimination";
    } else if (ourFront >= 2 && objectiveCombat === "Engage Fort") {
      objectiveFinish = "Priorité de Combat";
    }

    // --- Morgard ---
    let morgard = "Se Regrouper à 5";
    if (splitPushers.length >= 2 && enemyFront >= 2) morgard = "Split 1-3-1";
    else if (splitPushers.length >= 1 && ourPick >= 1) morgard = "Split 1-4";
    else if (ourFront >= 2 && objectiveCombat === "Engage Fort") morgard = "Se Regrouper à 5";

    // --- Tower siege ---
    let towerSiege = ourPoke >= 1 || ourFront < 2 ? "Poker / Garder ses Distances" : "Dive";

    // --- Defense ---
    let defense = botThreat || ourScale >= 2 ? "Défendre la Lane Pressée" : "Forcer le Combat";
    if (enemyFront >= 2 && ourFront <= 1) defense = "Défendre la Lane Pressée";

    // --- Closing ---
    let closing = "Flexible";
    if (canContestSerpent && objectiveCombat === "Engage Fort") closing = "Agressif";
    else if (ourScale >= 2) closing = "Stable";

    // Win plan
    const planParts = [];
    if (ourPick >= 2) planParts.push("Créer des picks avant chaque objectif — éviter les 5v5 groupés.");
    if (ourScale >= 2) planParts.push("Survivre early, protéger le carry bot/mid, ne pas contest Serpent à tout prix.");
    if (ourPoke >= 2) planParts.push("Poker sous objectif : chip puis Élimination sur carry ennemi.");
    if (splitPushers.length && enemyFront >= 2) planParts.push(`Split avec ${splitPushers.slice(0, 2).join(" / ")} — ne pas front vs leur front.`);
    if (enemyFront >= 2 && ourFront <= 1) planParts.push("Ne jamais Engage Fort vs double front ennemi.");
    if (botThreat) planParts.push("Bot est la lane faible — jungle et supp doivent babysitter.");
    if (!planParts.length) planParts.push("Jouer autour de votre win condition : prio lanes puis objectifs avec setup.");

    const avoid = [];
    if (objectiveCombat === "Poker / Garder ses Distances" && ourFront >= 2) {
      avoid.push({ setting: "Engage Fort", why: "Tu as du front mais la comp ennemi ou les matchups favorisent le poke/pick." });
    }
    if (earlySerpent === "Céder") {
      avoid.push({ setting: "Toujours Essayer (Serpent)", why: "Setup early trop faible — contest = tempo ennemi." });
    }
    if (defense === "Défendre la Lane Pressée") {
      avoid.push({ setting: "Forcer le Combat", why: "Tu perds les 5v5 ou une lane est exposée." });
    }
    if (ourScale >= 2) {
      avoid.push({ setting: "Conclusion Agressif", why: "Comp scale — closes stable une fois online." });
    }

    const itemTips = SLOTS.filter((s) => ourComp[s])
      .map((s) => {
        const b = metaMap[ourComp[s]]?.build;
        if (!b?.length) return null;
        return { slot: s, champion: ourComp[s], build: b };
      })
      .filter(Boolean);

    return {
      lanes,
      tactics: {
        focusLane: { value: focusLane, reason: `Prio lanes selon matchups (bot menacé: ${botThreat}).` },
        earlyJungle: { value: earlyJungle, reason: jungleReason },
        earlySerpent: { value: earlySerpent, reason: serpentReason },
        topSerpent: { value: topSerpent, reason: topSplit ? "Top split — ne pas abandonner side pressure." : "Top rejoint si front/group." },
        waveMgmt: { value: waveMgmt, reason: waveMgmt.includes("Vague") ? "Side lanes / scale — push vagues." : "Group pour objectifs." },
        objectivePrep: { value: objectivePrep, reason: objectivePrep === "Split Push" ? "Plusieurs splitters — pression map." : "Regroup si supérieur en 5v5." },
        objectiveCombat: { value: objectiveCombat, reason: combatReason },
        objectiveFinish: { value: objectiveFinish, reason: objectiveFinish.includes("Élimination") ? "Tuer carries avant de finir l'obj." : "Finir objectif si zone contrôlée." },
        morgard: { value: morgard, reason: "Conversion Morgard selon split vs teamfight." },
        towerSiege: { value: towerSiege, reason: towerSiege.includes("Poker") ? "Chip tours safely." : "Dive si comp tanky ahead." },
        defense: { value: defense, reason: defense.includes("Défendre") ? "Protéger lanes / carry scale." : "Force fights quand ahead." },
        closing: { value: closing, reason: closing === "Stable" ? "Close safe après timing items." : "Flexible selon lead." },
      },
      splitPushers: splitPushers.slice(0, 3),
      winPlan: planParts,
      avoid,
      itemTips,
      profile: {
        ourFront,
        enemyFront,
        ourPeel,
        ourScale,
        ourPoke,
        ourPick,
      },
    };
  }

  global.TFM2Tactics = { SLOTS, recommend };
})(typeof window !== "undefined" ? window : globalThis);
