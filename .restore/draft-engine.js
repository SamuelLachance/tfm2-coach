/**
 * TFM2 Draft Engine — phases ban/pick, scoring, recommandations coach.
 */
(function (global) {
  const SLOTS = ["Top", "Jungle", "Mid", "Bot", "Support"];
  const TIER_SCORE = { S: 50, A: 38, B: 26, C: 14, D: 6 };

  /** Format compétitif type LoL : 6 bans alternés, snake pick 10. */
  const DRAFT_STEPS = [
    { type: "ban", side: "blue" },
    { type: "ban", side: "red" },
    { type: "ban", side: "blue" },
    { type: "ban", side: "red" },
    { type: "ban", side: "blue" },
    { type: "ban", side: "red" },
    { type: "pick", side: "blue" },
    { type: "pick", side: "red" },
    { type: "pick", side: "red" },
    { type: "pick", side: "blue" },
    { type: "pick", side: "blue" },
    { type: "pick", side: "red" },
    { type: "pick", side: "red" },
    { type: "pick", side: "blue" },
    { type: "pick", side: "blue" },
    { type: "pick", side: "red" },
  ];

  const TAG_NEEDS = {
    frontline: { weight: 18, label: "frontline" },
    peel: { weight: 14, label: "peel" },
    scaling: { weight: 10, label: "scaling" },
    poke: { weight: 8, label: "poke" },
    engage: { weight: 12, label: "engage" },
  };

  function emptyPicks() {
    return { blue: [], red: [] };
  }

  function emptyBans() {
    return { blue: [], red: [] };
  }

  function createSession(name, ourSide = "blue") {
    return {
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      ourSide,
      stepIndex: 0,
      bans: emptyBans(),
      picks: emptyPicks(),
      activeSlot: "Top",
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  function getStep(session) {
    return DRAFT_STEPS[session.stepIndex] || null;
  }

  function isComplete(session) {
    return session.stepIndex >= DRAFT_STEPS.length;
  }

  function takenNames(session) {
    const names = new Set();
    for (const side of ["blue", "red"]) {
      session.bans[side].forEach((n) => names.add(n));
      session.picks[side].forEach((p) => names.add(p.name));
    }
    return names;
  }

  function availableChampions(allChampions, session) {
    const taken = takenNames(session);
    return allChampions.filter((c) => !taken.has(c.name));
  }

  function sidePicks(session, side) {
    return session.picks[side] || [];
  }

  function pickBySlot(session, side) {
    const map = {};
    for (const p of sidePicks(session, side)) {
      if (p.slot) map[p.slot] = p.name;
    }
    return map;
  }

  function ourSide(session) {
    return session.ourSide;
  }

  function enemySide(session) {
    return session.ourSide === "blue" ? "red" : "blue";
  }

  function isOurTurn(session) {
    const step = getStep(session);
    return step && step.side === ourSide(session);
  }

  function champMeta(name, metaMap, byName) {
    const m = metaMap[name] || {};
    const c = byName.get(name);
    return { ...m, champ: c, name };
  }

  function teamTags(pickNames, metaMap) {
    const tags = new Set();
    for (const n of pickNames) {
      (metaMap[n]?.tags || []).forEach((t) => tags.add(t));
    }
    return tags;
  }

  function countTag(pickNames, metaMap, tag) {
    return pickNames.filter((n) => metaMap[n]?.tags?.includes(tag)).length;
  }

  function missingTags(pickNames, metaMap) {
    const have = teamTags(pickNames, metaMap);
    const missing = [];
    for (const [tag, cfg] of Object.entries(TAG_NEEDS)) {
      if (!have.has(tag)) missing.push({ tag, ...cfg });
    }
    return missing.sort((a, b) => b.weight - a.weight);
  }

  function suggestSlot(session, side, metaMap, byName) {
    const comp = pickBySlot(session, side);
    const pickNames = sidePicks(session, side).map((p) => p.name);
    const missing = missingTags(pickNames, metaMap);

    for (const slot of SLOTS) {
      if (!comp[slot]) {
        if (missing.length) {
          const tag = missing[0].tag;
          const best = SLOTS.find((s) => !comp[s]);
          if (tag === "frontline" && !comp.Top) return "Top";
          if (tag === "peel" && !comp.Support) return "Support";
          if (tag === "scaling" && !comp.Bot) return "Bot";
          return best || slot;
        }
        return slot;
      }
    }
    return session.activeSlot || "Top";
  }

  function bestSlotForChampion(champ, session, side, metaMap) {
    const comp = pickBySlot(session, side);
    const open = SLOTS.filter((s) => !comp[s]);
    if (!open.length) return champ.optimalSlots?.[0] || "Flex";

    const scored = open.map((slot) => {
      let score = 0;
      if (champ.optimalSlots?.includes(slot)) score += 40;
      if (slot === "Bot" && (champ.type || "").toLowerCase().includes("distance")) score += 15;
      if (slot === "Mid" && (champ.type || "").toLowerCase().includes("mage")) score += 15;
      if (slot === "Support" && (champ.type || "").toLowerCase().includes("support")) score += 15;
      if (slot === "Jungle" && (metaMap[champ.name]?.tags || []).some((t) => t.includes("jungle"))) score += 20;
      return { slot, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.slot || open[0];
  }

  function scoreBan(champ, session, side, metaMap, byName) {
    const reasons = [];
    let score = TIER_SCORE[champ.tierMeta] || 10;
    if (champ.tierMeta === "S") reasons.push("Tier S meta");
    else if (champ.tierMeta === "A") reasons.push("Tier A fort");

    const allySide = side;
    const oppSide = side === "blue" ? "red" : "blue";
    const allyNames = sidePicks(session, allySide).map((p) => p.name);
    const oppNames = sidePicks(session, oppSide).map((p) => p.name);

    for (const opp of oppNames) {
      const om = metaMap[opp];
      if (om?.worstMatchups?.includes(champ.name)) {
        score += 35;
        reasons.push(`Counter ${opp}`);
      }
      if (champ.bestPairings?.includes(opp)) {
        score += 12;
        reasons.push(`Synergie ennemie avec ${opp} — deny`);
      }
    }

    for (const ally of allyNames) {
      if (champ.worstMatchups?.includes(ally)) {
        score += 28;
        reasons.push(`Menace vs notre ${ally}`);
      }
    }

    const oppTags = teamTags(oppNames, metaMap);
    if (oppTags.has("scaling") && (metaMap[champ.name]?.tags || []).includes("dive")) {
      score += 15;
      reasons.push("Anti-scale dive");
    }
    if (oppTags.has("poke") && (metaMap[champ.name]?.tags || []).includes("engage")) {
      score += 12;
      reasons.push("Engage vs poke ennemi");
    }

    if ((metaMap[champ.name]?.tags || []).includes("pick_jungle")) {
      score += 8;
      reasons.push("Jungle pick dangereux");
    }

    return { score, reasons: reasons.slice(0, 3) };
  }

  function scorePick(champ, session, side, slot, metaMap, byName) {
    const reasons = [];
    let score = TIER_SCORE[champ.tierMeta] || 10;

    if (champ.optimalSlots?.includes(slot)) {
      score += 30;
      reasons.push(`Slot optimal ${slot}`);
    } else if (champ.optimalSlots?.length) {
      score += 5;
      reasons.push(`Flex — pref. ${champ.optimalSlots.join("/")}`);
    }

    const allyNames = sidePicks(session, side).map((p) => p.name);
    const oppNames = sidePicks(session, side === "blue" ? "red" : "blue").map((p) => p.name);

    for (const ally of allyNames) {
      if (champ.bestPairings?.includes(ally)) {
        score += 22;
        reasons.push(`Synergie ${ally}`);
      }
      const am = metaMap[ally];
      if (am?.bestPairings?.includes(champ.name)) {
        score += 18;
        reasons.push(`${ally} veut ce pairing`);
      }
    }

    for (const opp of oppNames) {
      if (opp && champ.worstMatchups?.includes(opp)) {
        score -= 32;
        reasons.push(`Counter par ${opp}`);
      }
      const om = metaMap[opp];
      if (om?.worstMatchups?.includes(champ.name)) {
        score += 26;
        reasons.push(`Counter ${opp}`);
      }
    }

    const missing = missingTags(allyNames, metaMap);
    const tags = metaMap[champ.name]?.tags || [];
    for (const need of missing.slice(0, 2)) {
      if (tags.includes(need.tag)) {
        score += need.weight;
        reasons.push(`Apporte ${need.label}`);
      }
    }

    if (slot === "Bot" && tags.includes("scaling")) {
      score += 10;
      reasons.push("Carry scale + or Bot");
    }
    if (slot === "Support" && tags.includes("peel")) {
      score += 10;
      reasons.push("Peel Support");
    }
    if (slot === "Jungle" && tags.some((t) => t.includes("jungle"))) {
      score += 12;
      reasons.push("Profil jungle");
    }

    return { score, reasons: reasons.slice(0, 4) };
  }

  function getRecommendations(session, allChampions, metaMap, byName, limit = 8) {
    const step = getStep(session);
    if (!step || isComplete(session)) return { type: "none", items: [] };

    const avail = availableChampions(allChampions, session);
    const side = step.side;
    const isBan = step.type === "ban";

    if (isBan) {
      const items = avail
        .map((c) => {
          const { score, reasons } = scoreBan(c, session, side, metaMap, byName);
          return { champion: c, score, reasons };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      return { type: "ban", side, items };
    }

    const slot =
      side === ourSide(session)
        ? session.activeSlot || suggestSlot(session, side, metaMap, byName)
        : suggestSlot(session, side, metaMap, byName);

    const items = avail
      .map((c) => {
        const useSlot = side === ourSide(session) ? slot : bestSlotForChampion(c, session, side, metaMap);
        const { score, reasons } = scorePick(c, session, side, useSlot, metaMap, byName);
        return { champion: c, score, reasons, slot: useSlot };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return { type: "pick", side, slot, items };
  }

  function applyAction(session, action) {
    const snapshot = JSON.stringify({ stepIndex: session.stepIndex, bans: session.bans, picks: session.picks });
    session.history.push(snapshot);

    const step = getStep(session);
    if (!step) return { ok: false, error: "Draft terminé." };

    const taken = takenNames(session);
    if (taken.has(action.championName)) {
      return { ok: false, error: "Champion déjà pris ou banni." };
    }

    if (step.type === "ban") {
      session.bans[step.side].push(action.championName);
    } else {
      const slot =
        action.slot ||
        (step.side === ourSide(session)
          ? session.activeSlot
          : bestSlotForChampion(
              { name: action.championName, optimalSlots: [] },
              session,
              step.side,
              {}
            ));
      const comp = pickBySlot(session, step.side);
      if (slot && comp[slot]) {
        return { ok: false, error: `Slot ${slot} déjà occupé.` };
      }
      session.picks[step.side].push({
        name: action.championName,
        slot: slot || null,
      });
    }

    session.stepIndex += 1;
    session.updatedAt = Date.now();
    return { ok: true };
  }

  function undo(session) {
    if (!session.history.length) return false;
    const prev = JSON.parse(session.history.pop());
    session.stepIndex = prev.stepIndex;
    session.bans = prev.bans;
    session.picks = prev.picks;
    session.updatedAt = Date.now();
    return true;
  }

  function resetSession(session) {
    session.stepIndex = 0;
    session.bans = emptyBans();
    session.picks = emptyPicks();
    session.history = [];
    session.updatedAt = Date.now();
  }

  function toComps(session) {
    const ours = pickBySlot(session, ourSide(session));
    const enemy = pickBySlot(session, enemySide(session));
    const fill = (comp) => {
      const out = {};
      for (const s of SLOTS) out[s] = comp[s] || "";
      return out;
    };
    return { ourComp: fill(ours), enemyComp: fill(enemy) };
  }

  function analyzeLive(session, metaMap) {
    const ourNames = sidePicks(session, ourSide(session)).map((p) => p.name);
    const enemyNames = sidePicks(session, enemySide(session)).map((p) => p.name);
    const ourTags = teamTags(ourNames, metaMap);
    const enemyTags = teamTags(enemyNames, metaMap);
    const notes = [];

    const ourMissing = missingTags(ourNames, metaMap);
    if (ourMissing.length && ourNames.length >= 2) {
      notes.push(`Manque : ${ourMissing.slice(0, 2).map((m) => m.label).join(", ")}`);
    }
    if (countTag(enemyNames, metaMap, "dive") >= 2 && !ourTags.has("peel")) {
      notes.push("Ennemi dive — prio peel / front");
    }
    if (countTag(enemyNames, metaMap, "frontline") >= 2 && !ourTags.has("poke")) {
      notes.push("Double front ennemi — éviter 5v5, poke/split");
    }
    if (ourTags.has("scaling") && enemyTags.has("aggressive_jungle")) {
      notes.push("Scale vs tempo — jungle safe early");
    }

    return { ourTags: [...ourTags], enemyTags: [...enemyTags], notes };
  }

  function stepLabel(session) {
    const step = getStep(session);
    if (!step) return "Draft terminé";
    const sideLabel = step.side === "blue" ? "Bleu" : "Rouge";
    const n = session.stepIndex + 1;
    if (step.type === "ban") return `Ban ${n}/6 — ${sideLabel}`;
    const pickN = session.stepIndex - 5;
    return `Pick ${pickN}/10 — ${sideLabel}`;
  }

  global.TFM2Draft = {
    SLOTS,
    DRAFT_STEPS,
    createSession,
    getStep,
    isComplete,
    takenNames,
    availableChampions,
    sidePicks,
    pickBySlot,
    ourSide,
    enemySide,
    isOurTurn,
    suggestSlot,
    bestSlotForChampion,
    getRecommendations,
    applyAction,
    undo,
    resetSession,
    toComps,
    analyzeLive,
    stepLabel,
    scorePick,
    scoreBan,
  };
})(typeof window !== "undefined" ? window : globalThis);
