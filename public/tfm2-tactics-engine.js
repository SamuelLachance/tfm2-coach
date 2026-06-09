/**
 * TFM2 Tactics Engine — guide jungle/objectifs (pré-match uniquement).
 * Source : tfm2-jungle-tactics-guide.json + tactiques-options (enum in-game).
 * Pas de tier-list comme logique primaire — « réglages que ta draft peut exécuter ».
 */
(function (global) {
  const MC = () => global.TFM2MatchCore;
  const SLOTS = MC()?.SLOTS || ["Top", "Jungle", "Mid", "Bot", "Support"];

  let GUIDE = null;
  let TACTIC_OPTIONS = null;

  const SCALE_CARRIES = new Set([
    "Tireur", "Chasseur de fléchettes empoisonnées", "Archer", "Fantôme", "Chasseur de boomerang",
  ]);
  const PEEL_SUPPORTS = new Set([
    "Prêtre", "Moine", "Porteur de bouclier", "Esprit gardien", "Pythonisse",
    "Androïde", "Enchanteur", "Barde",
  ]);
  const PICK_CORE = new Set([
    "Ninja", "Démon", "Clown", "Inquisiteur", "Chasseur", "Tueur à gages",
    "Exécuteur", "Mage des ombres", "Double lame", "Mage noir",
  ]);
  const SIDE_TRADE = new Set(["Pyromancien", "Chevalier de cavalerie", "Épéiste", "Soldat", "Vampire"]);
  const SPLIT_PUSHERS = new Set([
    "Vampire", "Pyromancien", "Chevalier de cavalerie", "Épéiste", "Berserker",
    "Soldat", "Ninja", "Clown", "Chasseur de boomerang",
  ]);
  const AGGRESSIVE_JG = new Set(["Lancier", "Combattant", "Berserker", "Briseur de siège"]);
  const SLOW_ENEMY_JG = new Set(["Ogre", "Fantôme", "Nécromancien", "Vampire", "Druide", "Maître du fouet"]);

  const TACTIC_ORDER = [
    "focusLane", "earlyJungle", "earlySerpent", "topSerpent", "waveMgmt",
    "objectivePrep", "objectiveCombat", "objectiveFinish", "morgard",
    "towerSiege", "defense", "closing",
  ];

  const OBJECTIVE_DECISION = {
    early_serpent_pressure: "contest",
    protect_scale: "delay",
    pick_before_morgard: "pick",
    side_pressure_trade: "trade",
    behind_stabilize: "defend",
    balanced: "flex",
  };

  const SERPEN_CHECKS = {
    jungler_alive: "Jungler vivant au timer",
    correct_side: "Bon côté / vision pit",
    lanes_mobile: "Lanes mobiles (pas stuck)",
    early_damage_cc: "Dégâts + CC early prêts",
    lanes_can_trade: "Lanes peuvent trader",
    peel_ready: "Peel prêt pour carry",
    backline_access: "Accès backline adverse",
    follow_up_cc: "Follow-up CC après pick",
  };

  function setGuide(data) {
    GUIDE = data && typeof data === "object" ? data : null;
  }

  function setTacticOptions(opts) {
    TACTIC_OPTIONS = opts && typeof opts === "object" ? opts : null;
  }

  function getGuide() {
    return GUIDE;
  }

  function heroJungleChampions() {
    return GUIDE?.heroJungleChampions || [
      "Lancier", "Ninja", "Chasseur de boomerang", "Berserker",
      "Combattant", "Chevalier de cavalerie", "Démon",
    ];
  }

  function jungleFit(name) {
    return GUIDE?.jungleChampionFit?.[name] || null;
  }

  function hasTag(name, tag, metaMap) {
    return MC()?.hasTag(name, tag, metaMap) || metaMap[name]?.tags?.includes(tag) || false;
  }

  function countTags(comp, metaMap, tag) {
    return SLOTS.filter((s) => comp[s] && hasTag(comp[s], tag, metaMap)).length;
  }

  function countFrontline(comp, metaMap) {
    let n = countTags(comp, metaMap, "frontline");
    for (const slot of SLOTS) {
      const name = comp[slot];
      if (!name || hasTag(name, "frontline", metaMap)) continue;
      if ((metaMap[name]?.draftProfile?.tankWeight ?? 0) >= 0.88) n += 1;
    }
    return n;
  }

  function compValues(comp) {
    return SLOTS.map((s) => comp[s]).filter(Boolean);
  }

  function detectHeavyFrontPeel(enemyComp) {
    const names = compValues(enemyComp);
    return names.includes("Porteur de bouclier") && names.includes("Infanterie lourde");
  }

  function lanesCanMove(lanes) {
    return lanes.Mid?.verdict !== "lose" && (lanes.Bot?.verdict !== "lose" || lanes.Top?.verdict !== "lose");
  }

  function lanePressure(lanes) {
    const w = { Top: 2.25, Jungle: 1.1, Mid: 1.0, Bot: 1.2, Support: 2.0 };
    let net = 0;
    for (const slot of SLOTS) {
      const lm = lanes[slot];
      if (!lm) continue;
      const weight = w[slot] || 1;
      if (lm.verdict === "win") net += weight;
      else if (lm.verdict === "lose") net -= weight;
    }
    return net;
  }

  function countLaneWins(lanes) {
    return SLOTS.filter((s) => lanes[s]?.verdict === "win").length;
  }

  function findCarry(comp, metaMap) {
    let best = null;
    for (const slot of ["Bot", "Mid", "Top"]) {
      const name = comp[slot];
      if (!name) continue;
      const dp = metaMap[name]?.draftProfile || {};
      const score = (dp.dpsWeight ?? 0) + (SCALE_CARRIES.has(name) ? 0.35 : 0) + (slot === "Bot" ? 0.15 : 0);
      if (!best || score > best.score) best = { name, slot, score };
    }
    return best;
  }

  function rankSplitters(comp, metaMap, lanes) {
    const out = [];
    for (const slot of SLOTS) {
      const name = comp[slot];
      if (!name || MC()?.SPLIT_EXCLUDE?.has(name)) continue;
      let score = 0;
      if (SPLIT_PUSHERS.has(name)) score += 50;
      if (MC()?.SPLITTERS?.has(name)) score += 40;
      if (hasTag(name, "split", metaMap)) score += 30;
      if (slot === "Top") score += 18;
      if (lanes[slot]?.verdict === "win") score += 12;
      else if (lanes[slot]?.verdict === "lose") score -= 18;
      if (score >= 36) out.push({ name, slot, score });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  function refineLanes(lanes, ourComp, enemyComp) {
    const out = { ...lanes };
    if (
      enemyComp.Bot === "Chevalier de cavalerie" &&
      ourComp.Bot &&
      SCALE_CARRIES.has(ourComp.Bot) &&
      out.Bot?.verdict !== "win"
    ) {
      out.Bot = {
        verdict: "lose",
        note: `${enemyComp.Bot} menace ${ourComp.Bot} — babysitter bot (guide).`,
      };
    }
    return out;
  }

  function gatherContext(ourComp, enemyComp, metaMap, championsByName) {
    let lanes = MC()?.lanesFromComps?.(ourComp, enemyComp, metaMap) || {};
    lanes = refineLanes(lanes, ourComp, enemyComp);

    const jungler = ourComp.Jungle;
    const jFit = jungleFit(jungler) || inferJungleFallback(jungler, metaMap);
    const ourFront = countFrontline(ourComp, metaMap);
    const enemyFront = countFrontline(enemyComp, metaMap);
    const ourPeel = countTags(ourComp, metaMap, "peel") + (compValues(ourComp).some((n) => PEEL_SUPPORTS.has(n)) ? 1 : 0);
    const ourScale = countTags(ourComp, metaMap, "scaling");
    const ourPoke = countTags(ourComp, metaMap, "poke");
    const ourPick = compValues(ourComp).filter((n) => PICK_CORE.has(n)).length;
    const laneNet = lanePressure(lanes);
    const laneWins = countLaneWins(lanes);
    const carry = findCarry(ourComp, metaMap);
    const botThreat = lanes.Bot?.verdict === "lose";
    const splits = rankSplitters(ourComp, metaMap, lanes);
    const heavyFront = detectHeavyFrontPeel(enemyComp);
    const cant5v5 = enemyFront >= 2 && ourFront <= 1;
    const canWin5v5 = ourFront >= 1 && ourFront >= enemyFront && laneWins >= 2 && laneNet >= 0;
    const behind = laneNet <= -2;
    const ahead = laneNet >= 2;
    const hasPick = ourPick >= 1 || PICK_CORE.has(jungler);
    const hasSide = compValues(ourComp).some((n) => SIDE_TRADE.has(n));
    const scaleBot = carry && SCALE_CARRIES.has(carry.name) && (ourPeel >= 1 || ourScale >= 1);

    let compMargin = 0;
    try {
      const cmp = global.TFM2Draft?.compareComps;
      if (cmp) {
        const r = cmp(ourComp, enemyComp, championsByName, metaMap);
        if (r?.complete) compMargin = r.margin || 0;
      }
    } catch (_) { /* ignore */ }

    const ourNames = compValues(ourComp);
    const shellDet = detectShell(ourNames);

    return {
      ourComp, enemyComp, metaMap, lanes, jungler, jFit, enemyJungler: enemyComp.Jungle,
      ourFront, enemyFront, ourPeel, ourScale, ourPoke, ourPick, laneNet, laneWins,
      carry, botThreat, splits, heavyFront, cant5v5, canWin5v5, behind, ahead: ahead || compMargin > 25,
      hasPick, hasSide, scaleBot, compMargin, shellDet, ourNames,
      lanesMobile: lanesCanMove(lanes),
      earlyCc: countTags(ourComp, metaMap, "engage") + countTags(ourComp, metaMap, "cc"),
      enemyJgSlow: enemyComp.Jungle && SLOW_ENEMY_JG.has(enemyComp.Jungle),
    };
  }

  function inferJungleFallback(jungler, metaMap) {
    if (hasTag(jungler, "aggressive_jungle", metaMap)) {
      return { earlyJungle: "Gank", style: "aggressive", serpent: "contest", label: "Jungle agressive" };
    }
    if (hasTag(jungler, "pick_jungle", metaMap) || hasTag(jungler, "assassin", metaMap)) {
      return { earlyJungle: "Gank", style: "pick", serpent: "after_advantage", label: "Jungle pick" };
    }
    if (hasTag(jungler, "farm_jungle", metaMap)) {
      return { earlyJungle: "Farm/Couverture", style: "safe", serpent: "delay", label: "Jungle farm" };
    }
    return { earlyJungle: "Farm/Couverture", style: "flex", serpent: "flexible", label: "Jungle flexible" };
  }

  function detectShell(names) {
    const DG = global.TFM2GuideDraftEngine || global.TFM2DraftGuide;
    if (!DG?.detectShell || !names?.length) return null;
    const det = DG.detectShell(names);
    if (!det || det.confidence < 0.35) return null;
    return det;
  }

  function scoreArchetypes(ctx) {
    const scores = {
      early_serpent_pressure: 0,
      protect_scale: 0,
      pick_before_morgard: 0,
      side_pressure_trade: 0,
      behind_stabilize: 0,
      balanced: 12,
    };

    if (ctx.behind || ctx.compMargin < -30) scores.behind_stabilize += 100;

    const j = ctx.jungler;
    const fit = ctx.jFit;

    if (AGGRESSIVE_JG.has(j) || fit?.style === "aggressive" || fit?.style === "engage") {
      scores.early_serpent_pressure += 35;
    }
    if (ctx.lanesMobile) scores.early_serpent_pressure += 25;
    if (ctx.ourFront >= 1 && ctx.earlyCc >= 1) scores.early_serpent_pressure += 20;
    if (ctx.ahead && !ctx.cant5v5) scores.early_serpent_pressure += 15;
    if (ctx.cant5v5 || ctx.heavyFront) scores.early_serpent_pressure -= 50;
    if (ctx.scaleBot) scores.early_serpent_pressure -= 30;

    if (ctx.scaleBot) scores.protect_scale += 45;
    if (ctx.ourScale >= 2) scores.protect_scale += 30;
    if (fit?.style === "safe" || fit?.serpent === "delay") scores.protect_scale += 22;
    if (ctx.botThreat) scores.protect_scale += 18;

    if (ctx.hasPick || fit?.style === "pick") scores.pick_before_morgard += 35;
    if (ctx.cant5v5) scores.pick_before_morgard += 28;
    if (ctx.canWin5v5) scores.pick_before_morgard -= 30;

    if (ctx.hasSide && ctx.ourPoke >= 1) scores.side_pressure_trade += 30;
    if (ctx.cant5v5 && ctx.splits.length) scores.side_pressure_trade += 35;
    if (fit?.serpent === "delay_trade") scores.side_pressure_trade += 20;
    if (ctx.canWin5v5) scores.side_pressure_trade -= 35;

    return scores;
  }

  function pickArchetype(ctx) {
    if (ctx.behind && ctx.compMargin < -20) return "behind_stabilize";

    const shell = ctx.shellDet?.shell;
    if (shell && ctx.shellDet.confidence >= 0.45) {
      const byId = GUIDE?.shellIdToArchetype?.[shell.id];
      if (byId) return byId;
      const byStyle = GUIDE?.shellStyleToArchetype?.[shell.style];
      if (byStyle) return byStyle;
    }

    const scores = scoreArchetypes(ctx);
    let best = "balanced";
    let bestScore = -Infinity;
    for (const [k, v] of Object.entries(scores)) {
      if (v > bestScore) {
        bestScore = v;
        best = k;
      }
    }
    return best;
  }

  function templateForArchetype(archetype) {
    const templates = GUIDE?.templates || [];
    const map = {
      early_serpent_pressure: "lancer_early_serpent",
      protect_scale: "sniper_protect_scale",
      pick_before_morgard: "ninja_demon_pick",
      side_pressure_trade: "pyro_cavalry_trade",
    };
    const id = map[archetype];
    return templates.find((t) => t.id === id || t.key === archetype.replace(/_.*/, "")) || null;
  }

  function tactic(value, reason, assign) {
    const o = { value, reason };
    if (assign?.length) o.assign = assign;
    return o;
  }

  function cloneTemplateTactics(template) {
    const raw = template?.tactics || {};
    const out = {};
    for (const key of TACTIC_ORDER) {
      if (raw[key]) out[key] = tactic(raw[key], `Template guide — ${template.label}`);
    }
    return out;
  }

  function buildFromQuickIndex(archetype) {
    const entry = GUIDE?.quickSettingsIndex?.find((e) => e.id === archetype);
    if (!entry) return {};
    const t = {};
    if (entry.earlyJungle) t.earlyJungle = tactic(entry.earlyJungle, entry.draftGoal);
    if (entry.earlySerpent) t.earlySerpent = tactic(entry.earlySerpent, entry.draftGoal);
    if (entry.objectiveCombat) t.objectiveCombat = tactic(entry.objectiveCombat, entry.draftGoal);
    return t;
  }

  function fillMissingSlots(ctx, tactics, archetype) {
    const tpl = templateForArchetype(archetype);
    const base = tpl ? cloneTemplateTactics(tpl) : {};
    for (const key of TACTIC_ORDER) {
      if (!tactics[key] && base[key]) tactics[key] = { ...base[key] };
    }

    const j = ctx.jungler;
    const fit = ctx.jFit;
    const splits = ctx.splits;

    if (!tactics.focusLane) {
      if (ctx.botThreat) tactics.focusLane = tactic("Focus Mid/Bot", "Lane bot menacée (guide).");
      else if (ctx.scaleBot) tactics.focusLane = tactic("Focus Mid/Bot", "Protéger carry bot (guide scale).");
      else if (archetype === "side_pressure_trade") tactics.focusLane = tactic("Focus Top/Mid", "Trade side (guide).");
      else tactics.focusLane = tactic("Toutes les Lanes", "Équilibre lanes (guide).");
    }

    if (!tactics.earlyJungle && fit?.earlyJungle) {
      let jg = fit.earlyJungle;
      if (jg === "Gank" && ctx.enemyJgSlow && AGGRESSIVE_JG.has(j)) jg = "Contre-Jungle";
      tactics.earlyJungle = tactic(jg, fit.label || fit.verify || j);
    }

    if (!tactics.topSerpent) {
      if (ctx.splits.some((s) => s.slot === "Top") || SPLIT_PUSHERS.has(ctx.ourComp.Top)) {
        tactics.topSerpent = tactic("Ne Pas Rejoindre", "Split top — pas group Serpent (guide).");
      } else if (tactics.earlySerpent?.value === "Toujours Essayer" && hasTag(ctx.ourComp.Top, "frontline", ctx.metaMap)) {
        tactics.topSerpent = tactic("Toujours Rejoindre", "Front top au Serpent (guide).");
      } else {
        tactics.topSerpent = tactic("Flexible", "Rejoindre si setup group (guide).");
      }
    }

    if (!tactics.waveMgmt) {
      if (archetype === "side_pressure_trade" || archetype === "protect_scale") {
        tactics.waveMgmt = tactic("Priorité Vague", "Push side / farm safe (guide).");
      } else if (tactics.earlySerpent?.value === "Toujours Essayer") {
        tactics.waveMgmt = tactic("Priorité Ralliement", "Group Serpent (guide Lancier).");
      } else {
        tactics.waveMgmt = tactic("Priorité Ralliement", "Vision mid + picks (guide).");
      }
    }

    if (!tactics.objectivePrep) {
      if (archetype === "side_pressure_trade" && splits.length) {
        tactics.objectivePrep = tactic("Split Push", "Trade map (guide Pyro/Cavalerie).", splits.slice(0, 2));
      } else if (tactics.earlySerpent?.value === "Toujours Essayer") {
        tactics.objectivePrep = tactic("Se Regrouper", "Setup Serpent groupé (guide).", []);
      } else {
        tactics.objectivePrep = tactic("Flexible", "Adapter vision (guide).", splits.slice(0, 1));
      }
    }

    if (!tactics.objectiveFinish) {
      if (tactics.objectiveCombat?.value?.includes("Poker") || ctx.hasPick) {
        tactics.objectiveFinish = tactic("Priorité d'Élimination", "Turn / carries (guide pick).");
      } else if (tactics.earlySerpent?.value === "Toujours Essayer") {
        tactics.objectiveFinish = tactic("Priorité de Combat", "Finir obj si zoned (guide Lancier).");
      } else {
        tactics.objectiveFinish = tactic("Priorité d'Élimination", "Carries avant objectif par défaut (guide).");
      }
    }

    if (!tactics.morgard) {
      if (archetype === "side_pressure_trade" && splits.length >= 2) {
        tactics.morgard = tactic("Split 1-3-1", "Conversion side (guide).", splits.slice(0, 2));
      } else if (archetype === "pick_before_morgard") {
        tactics.morgard = tactic("Split 1-4", "Surplus numérique (guide Ninja/Démon).", splits.slice(0, 1));
      } else if (archetype === "protect_scale") {
        tactics.morgard = tactic("Se Regrouper à 5", "Closing stable carry (guide Tireur).", []);
      } else {
        tactics.morgard = tactic(
          splits.length ? "Split 1-4" : "Se Regrouper à 5",
          "Morgard selon comp (guide).",
          splits.slice(0, 1)
        );
      }
    }

    if (!tactics.towerSiege) {
      tactics.towerSiege = tactic(
        ctx.ourPoke >= 1 || ctx.cant5v5 ? "Poker / Garder ses Distances" : "Dive",
        "Siège selon front/poke (guide)."
      );
    }

    if (!tactics.defense) {
      if (ctx.botThreat || ctx.scaleBot || ctx.behind || ctx.cant5v5) {
        tactics.defense = tactic("Défendre la Lane Pressée", "Éviter chain fights (guide).");
      } else if (archetype === "early_serpent_pressure" && ctx.ahead) {
        tactics.defense = tactic("Forcer le Combat", "Tempo ahead (guide Lancier).");
      } else {
        tactics.defense = tactic("Défendre la Lane Pressée", "Défaut safe (guide).");
      }
    }

    if (!tactics.closing) {
      if (archetype === "early_serpent_pressure" && ctx.ahead && !ctx.cant5v5) {
        tactics.closing = tactic("Agressif", "Convertir tempo (guide Lancier).");
      } else if (archetype === "protect_scale") {
        tactics.closing = tactic("Stable", "Scale carry (guide Tireur).");
      } else if (ctx.hasPick || ctx.cant5v5) {
        tactics.closing = tactic("Flexible", "Picks opportunistes (guide).");
      } else {
        tactics.closing = tactic("Flexible", "Adapter lead (guide).");
      }
    }

    return tactics;
  }

  function applyShellPatches(ctx, tactics) {
    const shell = ctx.shellDet?.shell;
    if (!shell || ctx.shellDet.confidence < 0.4) return tactics;
    const label = shell.labelFr || shell.id;
    const patches = { ...(shell.serpen?.tactics || {}), ...(shell.morgard?.tactics || {}) };
    for (const [key, val] of Object.entries(patches)) {
      if (!val || !TACTIC_ORDER.includes(key)) continue;
      tactics[key] = tactic(val, `${label} — shell draft-guide`, tactics[key]?.assign);
    }
    return tactics;
  }

  function enforceHardRules(ctx, tactics) {
    const vsHeavy = ctx.cant5v5 || ctx.heavyFront;
    if (vsHeavy && tactics.objectiveCombat?.value === "Engage Fort") {
      tactics.objectiveCombat = tactic("Poker / Garder ses Distances", "Engage interdit vs double front (guide).");
    }
    if (vsHeavy && tactics.earlySerpent?.value === "Toujours Essayer") {
      tactics.earlySerpent = tactic("Flexible", "Serpent flexible vs front lourd (guide).");
    }
    if (ctx.botThreat && tactics.focusLane?.value !== "Focus Mid/Bot") {
      tactics.focusLane = tactic("Focus Mid/Bot", "Bot menacé (guide Cavalerie).");
    }
    if (vsHeavy && tactics.closing?.value === "Agressif") {
      tactics.closing = tactic("Flexible", "Pas Agressif vs front lourd (guide).");
    }
    if (vsHeavy && tactics.defense?.value === "Forcer le Combat") {
      tactics.defense = tactic("Défendre la Lane Pressée", "Pas forcer 5v5 (guide).");
    }
    return tactics;
  }

  function validateEnum(tactics) {
    if (!TACTIC_OPTIONS) return tactics;
    for (const key of TACTIC_ORDER) {
      const t = tactics[key];
      if (!t?.value) continue;
      const allowed = TACTIC_OPTIONS[key]?.values;
      if (!allowed?.includes(t.value)) {
        const fallback = allowed?.[0];
        if (fallback) tactics[key] = tactic(fallback, `${t.reason} (valeur corrigée → enum in-game)`);
      }
    }
    return tactics;
  }

  function buildAvoid(ctx, tactics) {
    const avoid = [];
    const vsHeavy = ctx.cant5v5 || ctx.heavyFront;
    if (tactics.earlySerpent?.value === "Céder") {
      avoid.push({ setting: "Toujours Essayer (Serpent)", why: "Ne pas contest parce que l'objectif existe (guide)." });
    }
    if (tactics.objectiveCombat?.value?.includes("Poker") || vsHeavy) {
      avoid.push({
        setting: "Engage Fort",
        why: vsHeavy ? "Porteur + Infanterie — lose 5v5 (guide)." : "Comp pick/poke — Poker first (guide).",
      });
    }
    if (ctx.hasPick && tactics.morgard?.value === "Se Regrouper à 5") {
      avoid.push({ setting: "Se Regrouper à 5 (Morgard)", why: "Pick comp — surplus numérique d'abord (guide Ex.3)." });
    }
    return avoid;
  }

  function buildReviewChecklist(ctx, archetype, shellDet) {
    const list = [];
    const labels = GUIDE?.archetypeLabels || {};
    const rq = {
      early_serpent_pressure: "Pression early → Serpent ou retard jungle ennemi ?",
      protect_scale: "Survécu early sans céder toute la map ?",
      pick_before_morgard: "Picks avant objectif ou marche en 5v5 groupé ?",
      side_pressure_trade: "Trade suffisant ou snowball objectif ennemi ?",
      behind_stabilize: "Éviter chain fights — ajuster au prochain match.",
    };
    if (rq[archetype]) list.push({ text: rq[archetype], kind: "archetype" });
    if (ctx.jFit?.verify) list.push({ text: ctx.jFit.verify, kind: "jungler" });
    const tpl = templateForArchetype(archetype);
    if (tpl?.review) list.push({ text: tpl.review, kind: "template" });
    for (const c of shellDet?.shell?.serpen?.checks || []) {
      list.push({ text: SERPEN_CHECKS[c] || c, kind: "serpent" });
    }
    list.push({ text: "Serpent/Morgard → conversion (tours, or, reset) ?", kind: "conversion" });
    list.push({ text: "Jungler a-t-il suivi le niveau de risque voulu ?", kind: "review" });
    return list;
  }

  function buildWinPlan(ctx, archetype) {
    const parts = [];
    if (ctx.cant5v5) parts.push(`Éviter 5v5 — front ${ctx.ourFront} vs ${ctx.enemyFront}.`);
    if (ctx.scaleBot) parts.push("Protéger carry, delay Serpent.");
    if (ctx.hasPick) parts.push("Picks avant objectif.");
    if (ctx.hasSide && archetype === "side_pressure_trade") parts.push("Trade map — pas fight pit perdant.");
    if (ctx.shellDet?.shell?.labelFr) parts.push(`Shell : ${ctx.shellDet.shell.labelFr}.`);
    parts.push(GUIDE?.archetypeLabels?.[archetype] || archetype);
    return parts;
  }

  function recommend(ourComp, enemyComp, metaMap, championsByName) {
    const ctx = gatherContext(ourComp, enemyComp, metaMap, championsByName);
    const archetype = pickArchetype(ctx);
    const scores = scoreArchetypes(ctx);

    let tactics = buildFromQuickIndex(archetype);
    tactics = fillMissingSlots(ctx, tactics, archetype);
    tactics = applyShellPatches(ctx, tactics);
    tactics = enforceHardRules(ctx, tactics);
    tactics = validateEnum(tactics);

    const decisionKey = OBJECTIVE_DECISION[archetype] || "flex";
    const objDecision = GUIDE?.objectiveDecisionModel?.[decisionKey] || null;
    const tpl = templateForArchetype(archetype);
    const quickEntry = GUIDE?.quickSettingsIndex?.find((e) => e.id === archetype);
    const combatVal = tactics.objectiveCombat?.value;
    const finishVal = tactics.objectiveFinish?.value;
    const closingVal = tactics.closing?.value;

    const shellHints = ctx.shellDet?.shell
      ? {
          shell: ctx.shellDet.shell.labelFr || ctx.shellDet.shell.id,
          confidence: ctx.shellDet.confidence,
          style: ctx.shellDet.shell.style,
          serpen: ctx.shellDet.shell.serpen?.label || null,
          morgard: ctx.shellDet.shell.morgard?.label || null,
          serpenPlan: ctx.shellDet.shell.serpen?.plan || null,
          morgardPlan: ctx.shellDet.shell.morgard?.plan || null,
        }
      : null;

    return {
      lanes: ctx.lanes,
      tactics,
      archetype,
      archetypeLabel: GUIDE?.archetypeLabels?.[archetype] || archetype,
      archetypeScores: scores,
      objectiveDecision: decisionKey,
      objectiveDecisionDetail: objDecision,
      guideUrl: GUIDE?.guideUrl,
      quickIndex: GUIDE?.quickSettingsIndex || [],
      quickEntry,
      templateMatch: tpl,
      shellHints,
      jungleFitDetail: ctx.jFit
        ? { champion: ctx.jungler, ...ctx.jFit, hero: heroJungleChampions().includes(ctx.jungler) }
        : null,
      heroJungleFit: heroJungleChampions()
        .map((name) => ({ name, ...(GUIDE?.jungleChampionFit?.[name] || {}) }))
        .filter((r) => r.label),
      combatApproach: GUIDE?.objectiveCombatOptions?.find((o) => o.value === combatVal) || null,
      finishBehavior: GUIDE?.objectiveFinishBehaviors?.find((o) => o.value === finishVal) || null,
      morgardPlan: GUIDE?.morgardClosingPlans?.find(
        (p) => p.closing === closingVal || p.morgard === tactics.morgard?.value
      ) || null,
      reviewChecklist: buildReviewChecklist(ctx, archetype, ctx.shellDet),
      failureAdjustments: GUIDE?.failureAdjustments || [],
      winPlan: buildWinPlan(ctx, archetype),
      avoid: buildAvoid(ctx, tactics),
      splitPushers: ctx.splits.map((s) => s.name).slice(0, 3),
      profile: {
        gameModel: archetype,
        jungleFit: ctx.jFit?.label,
        ourFront: ctx.ourFront,
        enemyFront: ctx.enemyFront,
        cantEngage5v5: ctx.cant5v5,
        compMargin: ctx.compMargin,
        shellConfidence: ctx.shellDet?.confidence,
        shellId: ctx.shellDet?.shell?.id,
      },
      itemGuides: global.TFM2ItemGuide?.recommendGuides?.(ourComp, enemyComp, metaMap, ctx.lanes, ctx) || null,
    };
  }

  global.TFM2Tactics = {
    SLOTS,
    TACTIC_ORDER,
    OBJECTIVE_DECISION,
    SERPEN_CHECK_LABELS: SERPEN_CHECKS,
    setGuide,
    setTacticOptions,
    getGuide,
    recommend,
    gatherContext,
    scoreArchetypes,
    heroJungleChampions,
    jungleFit,
    templateForArchetype,
    detectShell,
  };
})(typeof window !== "undefined" ? window : globalThis);
