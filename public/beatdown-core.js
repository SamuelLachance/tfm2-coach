/**
 * TFM2 Strategy Core — Inevitability + Flores beatdown/control.
 *
 * Central question (Finkel): who has inevitability — who wins the long game?
 * Beatdown/control are goals derived from that, and can flip with board state.
 * Signals: inevitability · table (board freeze) · damage · removal · permission · speed.
 */
(function (global) {
  const MC = () => global.TFM2MatchCore;
  const SLOTS = () => MC()?.SLOTS || ["Top", "Jungle", "Mid", "Bot", "Support"];

  const ROLE = { BEATDOWN: "beatdown", CONTROL: "control" };

  const AXIS = {
    damage: { R: 1.0, B: 0.55, G: 0.48, W: 0.18, U: 0.12 },
    removal: { W: 0.92, B: 0.88, U: 0.42, G: 0.32, R: 0.22 },
    permission: { U: 1.0, W: 0.38, B: 0.32, G: 0.18, R: 0.08 },
    speed: { R: 0.95, B: 0.72, W: 0.35, U: 0.28, G: 0.22 },
    scale: { G: 1.0, U: 0.35, W: 0.28, B: 0.22, R: 0.12 },
  };

  const TIER = { S: 1, A: 0.76, B: 0.54, C: 0.3, D: 0.1 };

  const TACTIC_VALUES = {
    focusLane: ["Focus Top/Mid", "Focus Mid/Bot", "Toutes les Lanes"],
    earlyJungle: ["Gank", "Farm/Couverture", "Contre-Jungle"],
    earlySerpent: ["Flexible", "Toujours Essayer", "Céder"],
    topSerpent: ["Flexible", "Toujours Rejoindre", "Ne Pas Rejoindre"],
    waveMgmt: ["Priorité Ralliement", "Priorité Vague"],
    objectivePrep: ["Split Push", "Flexible", "Se Regrouper"],
    objectiveCombat: ["Engage Fort", "Poker / Garder ses Distances"],
    objectiveFinish: ["Priorité d'Élimination", "Priorité de Combat"],
    morgard: ["Split 1-3-1", "Se Regrouper à 5", "Split 1-4"],
    towerSiege: ["Poker / Garder ses Distances", "Dive"],
    defense: ["Forcer le Combat", "Défendre la Lane Pressée"],
    closing: ["Agressif", "Stable", "Flexible"],
  };

  function meta(name, metaMap) {
    return metaMap?.[name] || {};
  }

  function hasTag(name, tag, metaMap) {
    return MC()?.hasTag?.(name, tag, metaMap) || meta(name, metaMap).tags?.includes(tag);
  }

  function colorIdentity(name, byName, metaMap) {
    const c = byName?.get?.(name) || meta(name, metaMap);
    return c.colorIdentity || meta(name, metaMap).colorIdentity || null;
  }

  function axisFromColors(ci, weights) {
    if (!ci) return 0;
    let s = 0;
    for (const [col, w] of Object.entries(weights)) {
      s += ((ci[col] || 0) / 24) * w;
    }
    return s;
  }

  function compProfile(names, metaMap, byName) {
    if (!names.length) {
      return {
        damage: 0, removal: 0, permission: 0, speed: 0, scaling: 0,
        inevitability: 0, table: 0, detail: {},
      };
    }

    let damage = 0;
    let removal = 0;
    let permission = 0;
    let speed = 0;
    let scaling = 0;
    let table = 0;
    const detail = {
      damageChamps: [], removalChamps: [], permissionChamps: [],
      scaleChamps: [], peelChamps: [],
    };

    for (const n of names) {
      const m = meta(n, metaMap);
      const dp = m.draftProfile || {};
      const ci = colorIdentity(n, byName, metaMap);
      const tier = TIER[m.tierMeta] ?? 0.3;

      let d =
        axisFromColors(ci, AXIS.damage) * 28 +
        (dp.dpsWeight ?? 0) * 22 + tier * 12;
      if (hasTag(n, "scaling", metaMap) || hasTag(n, "marksman", metaMap)) d += 14;
      if (hasTag(n, "assassin", metaMap) || hasTag(n, "dive", metaMap)) d += 12;
      if (hasTag(n, "burst", metaMap) || hasTag(n, "aggressive_jungle", metaMap)) d += 10;
      if (MC()?.HYPER_CARRIES?.has(n)) d += 16;

      let r =
        axisFromColors(ci, AXIS.removal) * 26 +
        (hasTag(n, "peel", metaMap) ? 18 : 0) +
        (hasTag(n, "frontline", metaMap) ? 10 : 0) +
        ((dp.tankWeight ?? 0) >= 0.75 ? 12 : 0);
      if (MC()?.isDedicatedSupport?.(n, metaMap)) r += 14;
      if (hasTag(n, "engage", metaMap) && hasTag(n, "frontline", metaMap)) r += 8;

      let p =
        axisFromColors(ci, AXIS.permission) * 30 +
        (hasTag(n, "wave_clear", metaMap) ? 16 : 0) +
        (hasTag(n, "poke", metaMap) ? 12 : 0) +
        (hasTag(n, "mage_burst", metaMap) ? 10 : 0);

      let sp =
        axisFromColors(ci, AXIS.speed) * 24 + tier * 10 +
        (hasTag(n, "aggressive_jungle", metaMap) || hasTag(n, "pick_jungle", metaMap) ? 16 : 0) +
        (hasTag(n, "mobility", metaMap) ? 8 : 0);
      if (hasTag(n, "scaling", metaMap) && !hasTag(n, "burst", metaMap)) sp -= 8;

      let sc =
        axisFromColors(ci, AXIS.scale) * 32 +
        (hasTag(n, "scaling", metaMap) ? 22 : 0) +
        (hasTag(n, "marksman", metaMap) ? 16 : 0) +
        ((dp.dpsWeight ?? 0) >= 0.55 ? 14 : 0);
      if (MC()?.HYPER_CARRIES?.has(n)) sc += 20;
      if (hasTag(n, "burst", metaMap) && !hasTag(n, "scaling", metaMap)) sc -= 10;

      let tb =
        (hasTag(n, "frontline", metaMap) ? 16 : 0) +
        ((dp.tankWeight ?? 0) >= 0.7 ? 14 : 0) +
        (hasTag(n, "engage", metaMap) ? 10 : 0) +
        (dp.dpsWeight ?? 0) * 12 + tier * 8;

      damage += d;
      removal += r;
      permission += p;
      speed += sp;
      scaling += sc;
      table += tb;

      if (d >= 35) detail.damageChamps.push(n);
      if (r >= 28) detail.removalChamps.push(n);
      if (p >= 22) detail.permissionChamps.push(n);
      if (sc >= 30) detail.scaleChamps.push(n);
      if (hasTag(n, "peel", metaMap)) detail.peelChamps.push(n);
    }

    const n = names.length;
    const prof = {
      damage: damage / n,
      removal: removal / n,
      permission: permission / n,
      speed: speed / n,
      scaling: scaling / n,
      table: table / n,
      detail,
    };
    prof.inevitability = inevitabilityFromProfile(prof, names, metaMap);
    return prof;
  }

  /** Long-game win potential — scaling + permission + peel infrastructure. */
  function inevitabilityFromProfile(prof, names, metaMap) {
    let inv =
      prof.scaling * 1.35 +
      prof.permission * 0.72 +
      prof.removal * 0.48 +
      (prof.detail.peelChamps.length ? prof.detail.peelChamps.length * 8 : 0) +
      (prof.detail.scaleChamps.length ? prof.detail.scaleChamps.length * 6 : 0);

    const scaleCount = names.filter((n) => hasTag(n, "scaling", metaMap)).length;
    if (scaleCount >= 2 && prof.detail.peelChamps.length >= 1) inv += 18;
    if (scaleCount >= 1 && prof.removal >= 28) inv += 12;

    inv -= Math.max(0, prof.speed - prof.scaling) * 0.35;
    if (prof.speed > prof.scaling + 12 && prof.scaling < 25) inv -= 15;

    return Math.max(0, inv);
  }

  function beatdownIndex(prof) {
    return prof.damage * 1.15 - prof.removal * 0.92 - prof.permission * 0.78;
  }

  function winGoal(role, hasInv, invStrong, boardLead) {
    if (hasInv && invStrong && boardLead) {
      return "Préserver board + longue partie — double avantage";
    }
    if (hasInv && invStrong) {
      return role === ROLE.CONTROL
        ? "Préserver l'inévitabilité — gagner en late"
        : "Forcer du tempo pour accéder à l'inévitabilité";
    }
    if (hasInv) {
      return "Inévitabilité fragile — ne pas gaspiller de ressources";
    }
    return role === ROLE.BEATDOWN
      ? "Finir avant leur scaling — beatdown obligatoire"
      : "Stabiliser puis trouver une fenêtre";
  }

  /**
   * Rôles dérivés de l'inévitabilité + état board (Countersliver reversal).
   * Celui qui contrôle la table préserve ; celui qui perd doit agir (beatdown).
   */
  function assignRoles(ourNames, enemyNames, metaMap, byName, ctx = {}) {
    const our = compProfile(ourNames, metaMap, byName);
    const enemy = compProfile(enemyNames, metaMap, byName);
    const ourIdx = beatdownIndex(our);
    const enIdx = beatdownIndex(enemy);
    const invGap = our.inevitability - enemy.inevitability;
    const tableGap = our.table - enemy.table;
    const laneNet = ctx.laneNet ?? 0;
    const margin = ctx.compMargin ?? 0;
    const reasons = [];

    const ourInvStrong = invGap > 10;
    const enInvStrong = invGap < -10;
    const boardLead = laneNet > 0.35 || margin > 12;
    const boardBehind = laneNet < -0.35 || margin < -12;
    const tableLead = tableGap > 6;

    let ourRole;
    let enemyRole;

    if (ourInvStrong && !enInvStrong) {
      if (boardLead || tableLead) {
        ourRole = ROLE.CONTROL;
        reasons.push("Inévitabilité + board — préserver le status quo (control)");
      } else if (boardBehind) {
        ourRole = ROLE.BEATDOWN;
        reasons.push("Inévitabilité mais behind — agir pour survivre au early (role flip)");
      } else {
        ourRole = ROLE.CONTROL;
        reasons.push("Inévitabilité supérieure — farm et scale");
      }
    } else if (enInvStrong && !ourInvStrong) {
      ourRole = ROLE.BEATDOWN;
      reasons.push("Adversaire a l'inévitabilité — finir avant le late (Finkel)");
    } else if (Math.abs(invGap) <= 10) {
      if (boardLead && tableLead) {
        ourRole = ROLE.CONTROL;
        reasons.push("Inévitabilité proche — board mène → préserver");
      } else if (boardBehind) {
        ourRole = ROLE.BEATDOWN;
        reasons.push("Inévitabilité proche — behind → forcer des changements");
      } else if (ourIdx - enIdx > 8) {
        ourRole = ROLE.BEATDOWN;
        reasons.push("Mirror — plus de pression directe (Flores damage)");
      } else if (enIdx - ourIdx > 8) {
        ourRole = ROLE.CONTROL;
        reasons.push("Mirror — plus d'answers → stabiliser");
      } else {
        ourRole = our.speed >= enemy.speed ? ROLE.BEATDOWN : ROLE.CONTROL;
        reasons.push("Inévitabilité équivalente — tempo décide");
      }
    } else {
      ourRole = invGap > 0 ? ROLE.CONTROL : ROLE.BEATDOWN;
      reasons.push(`Écart inévitabilité ${invGap > 0 ? "+" : ""}${invGap.toFixed(0)}`);
    }

    enemyRole = ourRole === ROLE.BEATDOWN ? ROLE.CONTROL : ROLE.BEATDOWN;

    if (tableLead && boardLead && ourInvStrong) {
      enemyRole = ROLE.BEATDOWN;
      reasons.push("On gagne sur la table — ils doivent nous déloger");
    }

    if (enemy.speed > our.speed + 5 && enemy.damage > our.damage + 6 && !ourInvStrong) {
      if (ourRole === ROLE.BEATDOWN && our.removal < enemy.damage * 0.3) {
        ourRole = ROLE.CONTROL;
        enemyRole = ROLE.BEATDOWN;
        reasons.push("Suicide vs Sligh — race perdante, weather d'abord");
      }
    }

    const dualRole =
      ourInvStrong && (boardLead || tableLead) && invGap > 14 &&
      ourRole === ROLE.CONTROL;

    const ourGoal = winGoal(ourRole, invGap > 0, ourInvStrong, boardLead || tableLead);
    const enemyGoal = winGoal(
      enemyRole,
      invGap < 0,
      enInvStrong,
      !boardLead && !tableLead
    );

    let label;
    if (dualRole) {
      label = "Double rôle — inévitabilité + board (Looter)";
    } else if (ourRole === ROLE.CONTROL && ourInvStrong) {
      label = "Control — préserver l'inévitabilité";
    } else if (ourRole === ROLE.BEATDOWN && enInvStrong) {
      label = "Beatdown — finir avant leur late";
    } else if (ourRole === ROLE.BEATDOWN) {
      label = "Beatdown — imposer des changements";
    } else {
      label = "Control — weather puis prendre l'inévitabilité";
    }

    return {
      ourRole,
      enemyRole,
      our,
      enemy,
      ourIdx,
      enemyIdx: enIdx,
      invGap,
      tableGap,
      ourInevitability: our.inevitability,
      enemyInevitability: enemy.inevitability,
      dualRole,
      ourGoal,
      enemyGoal,
      reasons,
      label,
      enemyLabel: enemyRole === ROLE.BEATDOWN
        ? "Adv. beatdown — doit agir"
        : "Adv. control — préserve",
      focus: ourGoal,
    };
  }

  function champAddsToAxis(champName, axis, metaMap, byName) {
    const single = compProfile([champName], metaMap, byName);
    if (axis === "inevitability") return single.inevitability;
    return single[axis] || 0;
  }

  function scorePickForRole(champName, slot, allies, ctx, roles) {
    const metaMap = ctx.metaMap || {};
    const byName = ctx.byName;
    const ourRole = roles.ourRole;
    const enInv = roles.enemyInevitability > roles.ourInevitability + 8;
    const weInv = roles.ourInevitability > roles.enemyInevitability + 8;
    let score = 0;
    const reasons = [];

    const inv = champAddsToAxis(champName, "inevitability", metaMap, byName);
    const sc = champAddsToAxis(champName, "scaling", metaMap, byName);
    const dmg = champAddsToAxis(champName, "damage", metaMap, byName);
    const rem = champAddsToAxis(champName, "removal", metaMap, byName);
    const perm = champAddsToAxis(champName, "permission", metaMap, byName);
    const spd = champAddsToAxis(champName, "speed", metaMap, byName);

    if (weInv || roles.dualRole) {
      score += inv * 1.4 + sc * 1.1 + rem * 0.9 + perm * 0.7 + dmg * 0.35;
      if (hasTag(champName, "peel", metaMap)) {
        score += 24;
        reasons.push("Peel — préserver l'inévitabilité");
      }
      if (hasTag(champName, "scaling", metaMap) && slot === "Bot") {
        score += 20;
        reasons.push("Carry scale — late win");
      }
      if (hasTag(champName, "wave_clear", metaMap)) {
        score += 14;
        reasons.push("Permission / farm safe");
      }
    } else if (enInv) {
      score += spd * 1.25 + dmg * 1.2 + rem * 0.55 + inv * 0.2;
      if (slot === "Jungle" && (hasTag(champName, "aggressive_jungle", metaMap) || hasTag(champName, "pick_jungle", metaMap))) {
        score += 26;
        reasons.push("Tempo JG — couper leur late");
      }
      if (hasTag(champName, "burst", metaMap) || hasTag(champName, "dive", metaMap)) {
        score += 16;
        reasons.push("Burst — beatdown avant scale");
      }
      for (const e of roles.enemy?.detail?.scaleChamps || []) {
        if (meta(champName, metaMap).worstMatchups?.includes(e) || MC()?.counterPts?.(champName, e, metaMap) >= 36) {
          score += 22;
          reasons.push(`Answer scale ${e}`);
          break;
        }
      }
    } else if (ourRole === ROLE.BEATDOWN) {
      score += dmg * 1.2 + spd * 1.05 + rem * 0.4 + inv * 0.35;
      if (slot === "Jungle" && hasTag(champName, "aggressive_jungle", metaMap)) {
        score += 18;
        reasons.push("JG tempo");
      }
    } else {
      score += inv * 0.9 + rem * 1.1 + perm * 0.95 + dmg * 0.4;
      if (MC()?.isDedicatedSupport?.(champName, metaMap)) {
        score += 22;
        reasons.push("Support — infrastructure late");
      }
    }

    const ci = colorIdentity(champName, byName, metaMap);
    if (ci?.dominant?.includes("G") && (weInv || ourRole === ROLE.CONTROL)) {
      score += 8;
      reasons.push("Identité G — scale");
    }
    if (ci?.dominant?.includes("R") && (enInv || ourRole === ROLE.BEATDOWN)) {
      score += 8;
      reasons.push("Identité R — pression");
    }

    return { score, reasons };
  }

  /**
   * Score ban — deny ce qui sert le plan adverse (inévitabilité / beatdown / control).
   * Évalue l'impact si l'ennemi pouvait draft ce champion.
   */
  function scoreBanForRole(champName, ourNames, enemyNames, metaMap, byName, ctx = {}) {
    const phase = ctx.phase || "opening";
    let score = 0;
    const reasons = [];

    const prof = compProfile([champName], metaMap, byName);
    const inv = prof.inevitability;
    const sc = prof.scaling;
    const dmg = prof.damage;
    const rem = prof.removal;
    const perm = prof.permission;
    const spd = prof.speed;

    const ourProf = compProfile(ourNames, metaMap, byName);
    const enProf = compProfile(enemyNames, metaMap, byName);
    const enemyProjected = enemyNames.concat(champName);

    let roles = null;
    let rolesBefore = null;
    try {
      rolesBefore = assignRoles(ourNames, enemyNames, metaMap, byName, ctx);
      roles = assignRoles(ourNames, enemyProjected, metaMap, byName, ctx);
    } catch (err) {
      console.warn("scoreBanForRole assignRoles", err);
    }

    const invDelta = roles
      ? roles.enemyInevitability - (rolesBefore?.enemyInevitability ?? enProf.inevitability)
      : inv;
    const weLeanInv =
      (rolesBefore?.ourInevitability ?? ourProf.inevitability) >
      (rolesBefore?.enemyInevitability ?? enProf.inevitability) + 5;
    const theyGainInv = invDelta > 5 || inv > 34;
    const weMustRace =
      roles?.enemyInevitability > roles?.ourInevitability + 8 ||
      (rolesBefore?.enemyInevitability ?? enProf.inevitability) >
        (rolesBefore?.ourInevitability ?? ourProf.inevitability) + 10;
    const weAreControl = roles?.ourRole === ROLE.CONTROL || weLeanInv;

    if (theyGainInv || inv > 32) {
      score += inv * 1.35 + invDelta * 2.4 + sc * 0.75;
      if (inv > 38) reasons.push("Deny inévitabilité — win condition late");
      else if (invDelta > 6) reasons.push(`Boost leur late +${Math.round(invDelta)}`);
      else reasons.push("Menace scaling / late");
    }

    if (weMustRace || weAreControl) {
      score += dmg * 1.2 + spd * 1.05;
      if (spd > 28) reasons.push("Deny tempo — finir avant leur late");
      if (hasTag(champName, "aggressive_jungle", metaMap) || hasTag(champName, "pick_jungle", metaMap)) {
        score += 22;
        reasons.push("Deny JG beatdown");
      }
      if (hasTag(champName, "burst", metaMap) || hasTag(champName, "dive", metaMap)) {
        score += 16;
        reasons.push("Deny burst race");
      }
    }

    if (weAreControl) {
      score += dmg * 0.55 + spd * 0.65;
      if (rem > 26) {
        score += rem * 0.5;
        reasons.push("Deny removal — protège leur carry");
      }
    } else if (roles?.ourRole === ROLE.BEATDOWN || !weLeanInv) {
      score += inv * 0.95 + rem * 0.85 + perm * 0.7;
      if (MC()?.isDedicatedSupport?.(champName, metaMap) && hasTag(champName, "peel", metaMap)) {
        score += 28;
        reasons.push("Deny peel — infrastructure control");
      }
      if (hasTag(champName, "wave_clear", metaMap)) {
        score += 18;
        reasons.push("Deny permission / stall");
      }
      if (hasTag(champName, "frontline", metaMap) && rem > 22) {
        score += 14;
        reasons.push("Deny front — weather notre race");
      }
    }

    if (MC()?.HYPER_CARRIES?.has(champName)) {
      score += 42;
      reasons.push("Hypercarry — inévitabilité pure");
    }
    if (hasTag(champName, "scaling", metaMap) && hasTag(champName, "marksman", metaMap)) {
      score += 24;
      reasons.push("Marksman scale");
    }

    for (const e of enemyNames) {
      if (meta(champName, metaMap).bestPairings?.includes(e)) {
        score += 36;
        reasons.push(`Synergie avec ${e}`);
        break;
      }
      if (meta(e, metaMap).bestPairings?.includes(champName)) {
        score += 32;
        reasons.push(`Complète ${e}`);
        break;
      }
    }

    for (const o of ourNames) {
      if (meta(o, metaMap).worstMatchups?.includes(champName)) {
        score += 40;
        reasons.push(`Counter ${o}`);
        break;
      }
    }

    if (phase === "opening" && !enemyNames.length && !ourNames.length) {
      score += inv * 0.55 + dmg * 0.35 + spd * 0.25;
      reasons.push("Ban meta — deny flex late/tempo");
    } else if (phase === "opening") {
      score += inv * 0.35;
    }

    if (roles?.enemyRole === ROLE.BEATDOWN && dmg > 30) {
      score += 12;
      reasons.push("Renforce leur beatdown");
    }
    if (roles?.enemyInevitability > roles?.ourInevitability + 12 && inv > 25) {
      score += 15;
      reasons.push("Pivote leur comp vers late");
    }

    const ci = colorIdentity(champName, byName, metaMap);
    if (weMustRace && ci?.dominant?.includes?.("R")) {
      score += 10;
      reasons.push("Identité R — pression");
    }
    if ((weAreControl || theyGainInv) && ci?.dominant?.includes?.("G")) {
      score += 10;
      reasons.push("Identité G — scale");
    }
    if (weAreControl && (ci?.dominant?.includes?.("U") || ci?.dominant?.includes?.("W"))) {
      score += 8;
      reasons.push("Identité U/W — answers");
    }

    return { score, reasons, roles, invDelta };
  }

  /** Plan de bans selon inévitabilité partielle. */
  function banPlanHint(ourNames, enemyNames, metaMap, byName, ctx = {}) {
    const ourProf = compProfile(ourNames, metaMap, byName);
    const enProf = compProfile(enemyNames, metaMap, byName);
    const parts = [];

    if (!ourNames.length && !enemyNames.length) {
      parts.push("Bans — deny hypercarry + peel + tempo JG");
      parts.push("Priorité inévitabilité puis flex S/A");
      return parts.join(" · ");
    }

    let roles = null;
    try {
      roles = assignRoles(ourNames, enemyNames, metaMap, byName, ctx);
    } catch (_) { /* ignore */ }

    if (roles) {
      if (roles.enemyInevitability > roles.ourInevitability + 8) {
        parts.push("Leur late menace — ban scale/peel/wave clear");
      } else if (roles.ourInevitability > roles.enemyInevitability + 8) {
        parts.push("Notre late — deny tempo/burst/answers");
      } else if (roles.ourRole === ROLE.BEATDOWN) {
        parts.push("Beatdown — deny removal + infrastructure control");
      } else {
        parts.push("Control — deny race + hypercarries");
      }
      if (roles.enemy?.detail?.scaleChamps?.length) {
        parts.push(`Protège ${roles.enemy.detail.scaleChamps.slice(0, 2).join(", ")}`);
      }
    } else if (enProf.inevitability > ourProf.inevitability + 6) {
      parts.push("Ban scale/peel — leur profil late");
    } else {
      parts.push("Ban tempo + flex anchors");
    }

    return parts.join(" · ");
  }

  function pickBestOption(setting, scores) {
    const opts = TACTIC_VALUES[setting];
    let best = opts[0];
    let bestScore = -Infinity;
    const out = {};
    for (const o of opts) {
      const s = scores[o] ?? 0;
      out[o] = Math.round(s * 10) / 10;
      if (s > bestScore) {
        bestScore = s;
        best = o;
      }
    }
    const sorted = opts.map((o) => ({ option: o, score: out[o] })).sort((a, b) => b.score - a.score);
    return {
      value: best,
      score: bestScore,
      scores: out,
      margin: sorted[0].score - (sorted[1]?.score ?? 0),
      runnerUp: sorted[1]?.option || null,
    };
  }

  function tacticsFromRoles(ctx, roles) {
    const bd = roles.ourRole === ROLE.BEATDOWN;
    const weInv = roles.invGap > 8;
    const enInv = roles.invGap < -8;
    const dual = roles.dualRole;
    const lanes = ctx.lanes || {};
    const splits = ctx.qualified || [];
    const laneBot = (lanes.Bot?.score || 0) / 100;
    const ahead = (ctx.compMargin || 0) > 10 || (ctx.laneNet || 0) > 0.5;
    const behind = (ctx.compMargin || 0) < -10 || (ctx.laneNet || 0) < -0.5;
    const preserve = (weInv || dual) && !behind;
    const mustAct = enInv || (behind && !weInv);

    const focusScores = {
      "Focus Mid/Bot": (ctx.botThreat ? 55 : 0) + (mustAct ? 22 : 0) + (preserve ? 28 : 0) + Math.max(0, -laneBot) * 35,
      "Focus Top/Mid": (dual ? 30 : 0) + (splits.length ? 22 : 0) + (lanes.Top?.verdict === "win" ? 18 : 0),
      "Toutes les Lanes": preserve ? 18 : mustAct ? 10 : 24,
    };

    const jgScores = {
      Gank: mustAct ? 50 + roles.enemy.inevitability * 0.15 : preserve ? 12 : bd ? 40 : 18,
      "Farm/Couverture": preserve || weInv ? 48 + roles.our.scaling * 0.2 : mustAct ? 14 : 38,
      "Contre-Jungle": mustAct && ctx.enemyJgSlow ? 36 : 10,
    };

    const serpentScores = {
      "Toujours Essayer": mustAct && ahead ? 40 + roles.our.speed * 0.25 : preserve ? 8 : bd && ahead ? 34 : 6,
      Flexible: 30 + (Math.abs(roles.invGap) < 12 ? 14 : 0),
      Céder: preserve ? 44 + (weInv ? 12 : 0) : mustAct ? 10 : behind ? 38 : 22,
    };

    const combatScores = {
      "Engage Fort": mustAct && ahead && !ctx.cantEngage5v5 ? 42 : preserve && ctx.cantEngage5v5 ? 6 : bd ? 32 : 10,
      "Poker / Garder ses Distances": preserve || ctx.cantEngage5v5 || enInv ? 48 + roles.enemy.damage * 0.15 : 14,
    };

    const finishScores = {
      "Priorité de Combat": mustAct && ahead ? 38 : preserve ? 16 : bd ? 32 : 12,
      "Priorité d'Élimination": preserve || enInv || ctx.hasPickCore ? 44 : 18,
    };

    const morgardScores = {
      "Se Regrouper à 5": dual && ahead ? 40 : mustAct && ahead ? 34 : preserve ? 14 : 10,
      "Split 1-3-1": preserve && ctx.cantEngage5v5 ? 42 + splits.length * 10 : mustAct ? 16 : 28,
      "Split 1-4": 24 + splits.length * 8,
    };

    const defenseScores = {
      "Forcer le Combat": mustAct && ahead ? 32 : 6,
      "Défendre la Lane Pressée": preserve || behind || ctx.botThreat ? 46 : 12,
    };

    const closingScores = {
      Agressif: mustAct && ahead ? 38 : dual ? 28 : 8,
      Stable: preserve || weInv ? 42 : mustAct ? 12 : 30,
      Flexible: dual ? 32 : 24,
    };

    const waveScores = {
      "Priorité Ralliement": mustAct && ctx.hasPickCore ? 34 : preserve ? 26 : 28,
      "Priorité Vague": preserve || weInv ? 38 : dual ? 30 : 16,
    };

    const topSerpScores = {
      "Ne Pas Rejoindre": splits.some((s) => s.slot === "Top") ? 40 : preserve ? 12 : 8,
      "Toujours Rejoindre": mustAct && ctx.ourFront >= 1 ? 34 : 12,
      Flexible: dual ? 28 : 22,
    };

    const prepScores = {
      "Se Regrouper": mustAct && ahead ? 36 : preserve ? 14 : 22,
      "Split Push": preserve && splits.length ? 40 : mustAct ? 14 : 28,
      Flexible: dual ? 30 : 26,
    };

    const siegeScores = {
      Dive: mustAct && ahead && !ctx.cantEngage5v5 ? 30 : 8,
      "Poker / Garder ses Distances": preserve || ctx.cantEngage5v5 ? 38 : 16,
    };

    const map = {
      focusLane: focusScores,
      earlyJungle: jgScores,
      earlySerpent: serpentScores,
      topSerpent: topSerpScores,
      waveMgmt: waveScores,
      objectivePrep: prepScores,
      objectiveCombat: combatScores,
      objectiveFinish: finishScores,
      morgard: morgardScores,
      towerSiege: siegeScores,
      defense: defenseScores,
      closing: closingScores,
    };

    const tactics = {};
    const optionScores = {};
    for (const [key, sc] of Object.entries(map)) {
      const r = pickBestOption(key, sc);
      tactics[key] = {
        value: r.value,
        reason: tacticReason(key, r.value, roles, ctx),
        runnerUp: r.runnerUp,
        margin: r.margin,
      };
      optionScores[key] = r.scores;
    }

    const assign = splits.slice(0, tactics.morgard.value === "Split 1-3-1" ? 2 : 1);
    if (assign.length) {
      tactics.morgard.assign = assign;
      if (tactics.objectivePrep.value === "Split Push") tactics.objectivePrep.assign = assign;
    }

    return { tactics, optionScores, plan: roles.label, focus: roles.ourGoal };
  }

  function tacticReason(key, value, roles, ctx) {
    const parts = [roles.ourGoal || roles.label];
    if (roles.dualRole) parts.push("Double rôle — board + late");
    if (roles.invGap > 10) parts.push(`Inévitabilité +${roles.invGap.toFixed(0)}`);
    else if (roles.invGap < -10) parts.push(`Leur late +${(-roles.invGap).toFixed(0)}`);
    if (key === "earlyJungle" && value === "Farm/Couverture") parts.push("Préserver ressources");
    if (key === "earlyJungle" && value === "Gank") parts.push("Forcer avant leur scaling");
    if (ctx.jungler) parts.push(`JG ${ctx.jungler}`);
    return parts.slice(0, 3).join(" · ");
  }

  function predictMatch(ourComp, enemyComp, metaMap, byName) {
    const core = MC();
    if (!core) return { margin: 0, winProb: { our: 0.5, enemy: 0.5 } };

    const slots = SLOTS();
    const ourNames = slots.map((s) => ourComp[s]).filter(Boolean);
    const enemyNames = slots.map((s) => enemyComp[s]).filter(Boolean);
    if (ourNames.length < 5 || enemyNames.length < 5) {
      return { complete: false, ourCount: ourNames.length, enemyCount: enemyNames.length };
    }

    const ourAssign = slots.filter((s) => ourComp[s]).map((s) => ({ name: ourComp[s], slot: s }));
    const enemyAssign = slots.filter((s) => enemyComp[s]).map((s) => ({ name: enemyComp[s], slot: s }));

    let laneNet = 0;
    if (core.lanesFromComps) {
      const lanes = core.lanesFromComps(ourComp, enemyComp, metaMap);
      for (const slot of slots) {
        laneNet += (lanes[slot]?.score || 0) / 100;
      }
    }

    const ourEval = core.evaluateTeam(ourNames, {
      byName, metaMap, oppNames: enemyNames, oppComp: enemyComp,
      assignment: ourAssign, slotsLeft: 0,
    });
    const enemyEval = core.evaluateTeam(enemyNames, {
      byName, metaMap, oppNames: ourNames, oppComp: ourComp,
      assignment: enemyAssign, slotsLeft: 0,
    });

    const baseMargin = ourEval.total - enemyEval.total;
    const roles = assignRoles(ourNames, enemyNames, metaMap, byName, {
      laneNet, compMargin: baseMargin,
    });

    let margin = baseMargin;
    margin += roles.invGap * 1.8;
    margin += roles.tableGap * 1.2;

    if (roles.ourRole === ROLE.BEATDOWN && roles.enemyInevitability > roles.ourInevitability + 8) {
      margin += roles.our.speed * 1.5 - roles.enemy.removal * 1.2;
      if (roles.our.speed < roles.enemy.speed + 2) margin -= 22;
    } else if (roles.ourRole === ROLE.CONTROL && roles.ourInevitability > roles.enemyInevitability + 8) {
      margin += roles.our.inevitability * 0.9 + roles.our.removal * 0.8 - roles.enemy.speed * 1.0;
    }

    if (roles.dualRole) margin += 18;

    let winProb = { our: 0.5, enemy: 0.5 };
    if (core.winProbFromScores) {
      const ourAdj = ourEval.total + Math.max(0, margin) * 0.45;
      const enAdj = enemyEval.total + Math.max(0, -margin) * 0.45;
      winProb = core.winProbFromScores(ourAdj, enAdj);
    }

    return {
      complete: true,
      our: {
        score: Math.round(ourEval.total),
        breakdown: ourEval.breakdown,
        plan: roles.label,
        goal: roles.ourGoal,
        role: roles.ourRole,
        profile: roles.our,
        inevitability: Math.round(roles.ourInevitability),
      },
      enemy: {
        score: Math.round(enemyEval.total),
        breakdown: enemyEval.breakdown,
        plan: roles.enemyLabel,
        goal: roles.enemyGoal,
        role: roles.enemyRole,
        profile: roles.enemy,
        inevitability: Math.round(roles.enemyInevitability),
      },
      margin: Math.round(margin),
      winProb,
      roles,
      misassignmentWarning: roleMisassignmentWarning(roles),
    };
  }

  function roleMisassignmentWarning(roles) {
    if (roles.enemyInevitability > roles.ourInevitability + 12 &&
        roles.ourRole === ROLE.CONTROL && roles.invGap < -8) {
      return "Ils ont l'inévitabilité — jouer control = lose. Il faut beatdown.";
    }
    if (roles.ourInevitability > roles.enemyInevitability + 12 &&
        roles.ourRole === ROLE.BEATDOWN && roles.invGap > 10) {
      return "Tu as l'inévitabilité — ne race pas inutilement, préserve.";
    }
    if (roles.ourRole === ROLE.BEATDOWN && roles.our.damage > roles.enemy.damage + 10 &&
        roles.our.speed < roles.enemy.speed - 3 && roles.enemy.removal > roles.our.removal) {
      return "Race vs removal+tempo — weather d'abord (Flores).";
    }
    return null;
  }

  global.TFM2Beatdown = {
    ROLE,
    TACTIC_VALUES,
    compProfile,
    beatdownIndex,
    inevitabilityFromProfile,
    assignRoles,
    scorePickForRole,
    scoreBanForRole,
    banPlanHint,
    tacticsFromRoles,
    predictMatch,
    roleMisassignmentWarning,
  };
})(typeof window !== "undefined" ? window : globalThis);
