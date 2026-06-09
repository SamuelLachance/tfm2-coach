"""Profils champions TFM2 — tags, matchups, synergies, couleurs MTG (source unique)."""

from __future__ import annotations

import re
from typing import Any

TAGS: dict[str, list[str]] = {
    "Lancier": ["aggressive_jungle", "engage", "frontline"],
    "Berserker": ["aggressive_jungle", "split", "engage"],
    "Combattant": ["aggressive_jungle", "engage", "frontline"],
    "Briseur de siège": ["aggressive_jungle", "engage", "wave_clear"],
    "Inquisiteur": ["aggressive_jungle", "pick_jungle", "dive", "assassin"],
    "Clown": ["pick_jungle", "aggressive_jungle", "dive", "assassin"],
    "Ninja": ["pick_jungle", "dive", "assassin", "split"],
    "Démon": ["pick_jungle", "dive"],
    "Chasseur": ["pick_jungle", "dive", "assassin"],
    "Tueur à gages": ["pick_jungle", "assassin"],
    "Loup-garou": ["pick_jungle", "dive"],
    "Chevalier de cavalerie": ["aggressive_jungle", "engage", "split"],
    "Ogre": ["farm_jungle", "frontline", "scaling"],
    "Fantôme": ["farm_jungle", "scaling"],
    "Druide": ["farm_jungle", "split"],
    "Vampire": ["split", "scaling", "frontline"],
    "Tireur": ["scaling", "poke"],
    "Archer": ["scaling", "poke"],
    "Soldat": ["scaling", "poke", "frontline", "wave_clear", "split"],
    "Chasseur de fléchettes empoisonnées": ["poke", "scaling"],
    "Chasseur de boomerang": ["poke"],
    "Pyromancien": ["poke", "mage_burst", "wave_clear"],
    "Mage blanc": ["mage_burst", "poke", "wave_clear"],
    "Mage de glace": ["mage_burst", "engage", "wave_clear"],
    "Mage du vent": ["mage_burst", "poke", "wave_clear"],
    "Mage des ombres": ["mage_burst", "pick_jungle"],
    "Mage noir": ["mage_burst", "poke"],
    "Mage de foudre": ["mage_burst", "poke", "wave_clear"],
    "Bombardier": ["poke", "mage_burst", "wave_clear"],
    "Infanterie lourde": ["frontline", "engage"],
    "Porteur de bouclier": ["frontline", "peel"],
    "Androïde": ["frontline", "peel"],
    "Moine": ["peel", "frontline"],
    "Prêtre": ["peel"],
    "Pythonisse": ["peel", "mage_burst", "wave_clear"],
    "Mage de barrière": ["peel", "frontline"],
    "Exorciste": ["peel"],
    "Esprit gardien": ["peel"],
    "Invocateur d'esprit": ["peel"],
    "Exécuteur": ["poke", "frontline"],
    "Épéiste": ["engage", "split"],
    "Double lame": ["engage", "dive"],
    "Chevalier": ["frontline", "engage"],
    "Chevalier magique": ["frontline", "mage_burst"],
    "Guerrier de perche": ["frontline", "engage"],
    "Illusionniste": ["engage", "mage_burst", "wave_clear"],
    "Joueur": ["poke", "engage"],
    "Danseuse": ["scaling", "dive"],
    "Lame de Cirque": ["dive", "assassin"],
    "Jiangshi": ["frontline", "peel"],
    "Médecin de la peste": ["engage", "frontline"],
    "Nécromancien": ["scaling", "farm_jungle", "wave_clear"],
    "Chaman vaudou": ["mage_burst", "wave_clear"],
    "Enchanteur": ["peel", "scaling"],
    "Barde": ["peel"],
    "Chef": ["frontline", "wave_clear"],
    "Taoïste": ["peel"],
    "Prisonnier": ["frontline"],
    "Dokkaebi": ["engage"],
    "Maître du fouet": ["aggressive_jungle", "pick_jungle"],
}

TIER_VALUE = {"S": 5, "A": 4, "B": 3, "C": 2, "D": 1}

COLOR_ALLIED = [("W", "U"), ("U", "B"), ("B", "R"), ("R", "G"), ("G", "W")]
COLOR_ENEMY = [("W", "B"), ("W", "R"), ("U", "R"), ("U", "G"), ("B", "G")]

HARD_COUNTERS: dict[tuple[str, str], int] = {
    ("Ninja", "Archer"): 28,
    ("Ninja", "Tireur"): 28,
    ("Ninja", "Chasseur de fléchettes empoisonnées"): 26,
    ("Chasseur", "Archer"): 24,
    ("Clown", "Archer"): 22,
    ("Chevalier de cavalerie", "Chasseur de fléchettes empoisonnées"): 26,
    ("Chevalier de cavalerie", "Tireur"): 22,
    ("Porteur de bouclier", "Clown"): 20,
    ("Moine", "Clown"): 18,
    ("Infanterie lourde", "Vampire"): 18,
    ("Mage de barrière", "Archer"): 20,
    ("Inquisiteur", "Pyromancien"): 16,
    ("Maître du fouet", "Nécromancien"): 14,
    ("Exorciste", "Nécromancien"): 16,
    ("Double lame", "Chasseur de fléchettes empoisonnées"): 24,
    ("Inquisiteur", "Mage noir"): 20,
}

HARD_SYNERGY: dict[tuple[str, str], int] = {
    ("Moine", "Chasseur de fléchettes empoisonnées"): 30,
    ("Androïde", "Tireur"): 26,
    ("Mage noir", "Clown"): 24,
    ("Prêtre", "Ogre"): 22,
    ("Porteur de bouclier", "Archer"): 22,
    ("Enchanteur", "Tireur"): 20,
    ("Combattant", "Moine"): 18,
    ("Pyromancien", "Infanterie lourde"): 16,
    ("Exécuteur", "Prêtre"): 18,
    ("Pythonisse", "Soldat"): 16,
    ("Barde", "Archer"): 20,
    ("Prêtre", "Bombardier"): 18,
}

FAMILY_COLORS: dict[str, tuple[int, int, int, int, int]] = {
    "tank_engage": (8, 3, 1, 7, 5),
    "tank_disengage": (9, 5, 1, 3, 6),
    "bruiser_teamfight": (4, 2, 3, 9, 6),
    "bruiser_split": (2, 4, 8, 5, 5),
    "mage_control": (3, 10, 2, 3, 6),
    "mage_dps": (2, 6, 5, 7, 4),
    "assassin_ad_pick": (1, 3, 9, 7, 4),
    "assassin_ap_pick": (1, 4, 9, 6, 4),
    "adc_hypercarry": (5, 3, 4, 2, 10),
    "adc_tempo": (3, 2, 3, 11, 5),
    "adc_poke": (4, 8, 2, 4, 6),
    "support_enchanter": (10, 4, 1, 2, 7),
    "support_engage": (5, 2, 2, 10, 5),
    "support_disengage": (9, 5, 1, 3, 6),
    "support_poke": (4, 7, 3, 5, 5),
    "jungle_defensive": (6, 5, 2, 4, 7),
    "jungle_offensive": (2, 3, 6, 10, 3),
    "global_pick": (3, 8, 4, 4, 5),
    "specialist": (3, 5, 5, 6, 5),
}

CHAMP_COLOR_OVERRIDES: dict[str, tuple[int, int, int, int, int]] = {
    "Moine": (4, 2, -2, -2, 0),
    "Porteur de bouclier": (5, 1, -2, -2, 0),
    "Androïde": (4, 2, -1, -2, 1),
    "Prêtre": (6, 2, -2, -2, 2),
    "Enchanteur": (5, 3, -2, -1, 1),
    "Barde": (5, 4, -2, 0, 1),
    "Ninja": (-2, 1, 5, 4, -2),
    "Clown": (-2, 0, 6, 5, -3),
    "Chasseur": (-1, 1, 5, 4, -3),
    "Inquisiteur": (-1, 0, 5, 5, -3),
    "Lame de Cirque": (-2, 0, 6, 5, -3),
    "Tueur à gages": (-1, 1, 6, 4, -4),
    "Pyromancien": (-1, 4, 1, 4, -2),
    "Mage noir": (0, 5, 3, 3, -3),
    "Mage des ombres": (-1, 4, 5, 2, -4),
    "Nécromancien": (-1, 3, 5, 2, 1),
    "Archer": (2, 3, 0, 1, 4),
    "Tireur": (2, 2, 0, 2, 4),
    "Chasseur de fléchettes empoisonnées": (1, 4, 2, 2, 3),
    "Vampire": (1, 2, 4, 3, 0),
    "Ogre": (3, 1, 1, 3, 4),
    "Fantôme": (2, 4, 3, 2, 1),
    "Chevalier de cavalerie": (2, 1, 2, 5, 0),
    "Lancier": (3, 1, 0, 5, 3),
    "Berserker": (1, 1, 3, 6, 1),
    "Bombardier": (0, 4, 2, 5, -3),
    "Exorciste": (5, 3, 2, 1, 1),
    "Dokkaebi": (1, 2, 2, 6, 1),
    "Danseuse": (-1, 2, 3, 4, 0),
    "Maître du fouet": (0, 2, 4, 6, -4),
}


def infer_tags(name: str, champ: dict) -> set[str]:
    tags = set(TAGS.get(name, []))
    t = (champ.get("type") or "").lower()
    if "assassin" in t:
        tags.update({"assassin", "dive"})
    if "mage" in t:
        tags.add("mage_burst")
    if "support" in t:
        tags.add("peel")
    if "guerrier" in t and "frontline" not in tags:
        tags.add("frontline")
    if "distance" in t or "à distance" in t:
        tags.update({"poke", "scaling"})
    return tags


def ability_text(champ: dict) -> str:
    return " ".join(a.get("description", "") for a in champ.get("abilities", []))


def parse_stats(stats: str | None) -> dict[str, int]:
    if not stats:
        return {}
    out: dict[str, int] = {}
    for key, pattern in [
        ("hp", r"HP\s*(\d+)\s*→\s*(\d+)"),
        ("ad", r"AD\s*(\d+)\s*→\s*(\d+)"),
        ("pm", r"PM\s*(\d+)\s*→\s*(\d+)"),
        ("arm", r"Arm\s*(\d+)\s*→\s*(\d+)"),
        ("rm", r"RM\s*(\d+)\s*→\s*(\d+)"),
        ("range", r"Portée\s*(\d+)"),
        ("ms", r"MS\s*(\d+)\s*→\s*(\d+)"),
    ]:
        m = re.search(pattern, stats)
        if not m:
            continue
        out[key] = int(m.group(2) if "→" in pattern and m.lastindex and m.lastindex >= 2 else m.group(1))
    return out


def parse_ratios(text: str) -> tuple[int, int]:
    ad = sum(int(m) for m in re.findall(r"(\d+)\s*%\s*AD", text, re.I))
    ad += sum(int(m) for m in re.findall(r"(\d+)\s*%\s*des dégâts d'attaque", text, re.I))
    ap = sum(int(m) for m in re.findall(r"(\d+)\s*%\s*PM", text, re.I))
    ap += sum(int(m) for m in re.findall(r"(\d+)\s*%\s*(?:Puissance|puissance)", text, re.I))
    return ad, ap


def build_profile(champ: dict) -> dict:
    name = champ["name"]
    tags = infer_tags(name, champ)
    text = ability_text(champ).lower()
    stats = parse_stats(champ.get("stats"))
    ad_ratio, ap_ratio = parse_ratios(ability_text(champ))
    type_l = (champ.get("type") or "").lower()

    hp = stats.get("hp", 2000)
    arm = stats.get("arm", 80)
    rm = stats.get("rm", 50)
    rng = stats.get("range", 30)

    squish = hp < 1900 and arm < 100
    tanky = hp >= 2200 or arm >= 120 or "frontline" in tags
    super_tank = hp >= 2400 and arm >= 130

    return {
        "name": name,
        "tags": tags,
        "type": type_l,
        "tier": TIER_VALUE.get(champ.get("tierMeta") or "C", 2),
        "ad_ratio": ad_ratio,
        "ap_ratio": ap_ratio,
        "hp": hp,
        "arm": arm,
        "rm": rm,
        "range": rng,
        "squish": squish,
        "tanky": tanky,
        "super_tank": super_tank,
        "assassin": "assassin" in tags or "assassin" in type_l,
        "mage": "mage_burst" in tags or "mage" in type_l,
        "support": "support" in type_l or "peel" in tags,
        "marksman": any(x in type_l for x in ("marksman", "archer", "tireur", "à distance", "artillerie")),
        "warrior": "guerrier" in type_l,
        "dash": bool(re.search(r"dash|téléport|charge|saut|se déplace", text)),
        "stun": bool(re.search(r"étourdi|étourdit|stun", text)),
        "root": bool(re.search(r"enracin|root|immobilis", text)),
        "knockup": bool(re.search(r"projet|en l'air|knock", text)),
        "silence": "silence" in text,
        "heal": bool(re.search(r"soin|heal|régén|restaure", text)),
        "shield": bool(re.search(r"bouclier|shield", text)),
        "anti_heal": name == "Exécuteur" or "réduction soins" in text or "anti-heal" in text,
        "poke": "poke" in tags or rng >= 55,
        "engage": "engage" in tags or bool(re.search(r"charge|engage|knock", text)),
        "dive": "dive" in tags,
        "scaling": "scaling" in tags,
        "split": "split" in tags,
        "wave_clear": "wave_clear" in tags or bool(re.search(r"tous les ennemis|zone|cercle", text)),
        "peel": "peel" in tags,
        "frontline": "frontline" in tags,
        "pick": "pick_jungle" in tags or "assassin" in tags,
        "optimal_bot": "Bot" in (champ.get("optimalSlots") or []),
        "optimal_sup": "Support" in (champ.get("optimalSlots") or []),
        "optimal_jg": "Jungle" in (champ.get("optimalSlots") or []),
        "color_identity": champ.get("colorIdentity"),
    }


def clamp_colors(w: int, u: int, b: int, r: int, g: int) -> tuple[int, int, int, int, int]:
    vals = [max(0, v) for v in (w, u, b, r, g)]
    total = sum(vals)
    if total == 0:
        return (5, 5, 5, 5, 4)
    if total == 24:
        return tuple(vals)  # type: ignore
    scaled = [max(0, round(v * 24 / total)) for v in vals]
    diff = 24 - sum(scaled)
    order = sorted(range(5), key=lambda i: scaled[i], reverse=True)
    i = 0
    while diff != 0:
        idx = order[i % 5]
        if diff > 0:
            scaled[idx] += 1
            diff -= 1
        elif scaled[idx] > 0:
            scaled[idx] -= 1
            diff += 1
        i += 1
    return tuple(scaled)  # type: ignore


def dominant_colors(w: int, u: int, b: int, r: int, g: int, top_n: int = 2) -> list[str]:
    pairs = [("W", w), ("U", u), ("B", b), ("R", r), ("G", g)]
    pairs.sort(key=lambda x: x[1], reverse=True)
    return [c for c, v in pairs[:top_n] if v >= 4]


def identity_label(dominant: list[str]) -> str:
    if not dominant:
        return "WUBRG"
    if len(dominant) == 1:
        return dominant[0]
    return "".join(dominant[:2])


def infer_color_family(profile: dict) -> str:
    tags = profile["tags"]
    if profile["support"] or ("peel" in tags and profile["tanky"]):
        if profile["engage"]:
            return "support_engage"
        if profile["poke"]:
            return "support_poke"
        return "support_enchanter" if profile["heal"] or profile["shield"] else "support_disengage"
    if profile["assassin"] or profile["pick"]:
        return "assassin_ap_pick" if profile["ap_ratio"] > profile["ad_ratio"] else "assassin_ad_pick"
    if profile["marksman"]:
        if profile["poke"]:
            return "adc_poke"
        return "adc_hypercarry" if profile["scaling"] else "adc_tempo"
    if profile["mage"]:
        return "mage_control" if profile["poke"] or profile["wave_clear"] else "mage_dps"
    if profile["tanky"] or profile["super_tank"]:
        return "tank_engage" if profile["engage"] else "tank_disengage"
    if profile["split"]:
        return "bruiser_split"
    if profile["warrior"] or profile["frontline"]:
        return "bruiser_teamfight"
    if "farm_jungle" in tags:
        return "jungle_defensive"
    if "aggressive_jungle" in tags or "pick_jungle" in tags:
        return "jungle_offensive"
    if profile["poke"]:
        return "global_pick"
    return "specialist"


def build_color_identity(champ: dict, profile: dict | None = None) -> dict[str, Any]:
    p = profile or build_profile(champ)
    fam = infer_color_family(p)
    base = FAMILY_COLORS.get(fam, FAMILY_COLORS["specialist"])
    override = CHAMP_COLOR_OVERRIDES.get(champ["name"], (0, 0, 0, 0, 0))
    w, u, b, r, g = clamp_colors(*(a + o for a, o in zip(base, override)))

    dp = champ.get("draftProfile") or {}
    if dp.get("tankWeight", 0) > 0.7:
        w, g = w + 1, g + 1
    if dp.get("dpsWeight", 0) > 0.75 and dp.get("squishy"):
        b, r = b + 1, r + 1
    w, u, b, r, g = clamp_colors(w, u, b, r, g)

    dom = dominant_colors(w, u, b, r, g)
    return {
        "W": w,
        "U": u,
        "B": b,
        "R": r,
        "G": g,
        "dominant": dom,
        "identity": identity_label(dom),
        "vector": [w / 24, u / 24, b / 24, r / 24, g / 24],
        "family": fam,
    }


def get_dominant(ci: dict | None) -> list[str]:
    if not ci:
        return []
    return ci.get("dominant") or dominant_colors(
        ci.get("W", 0), ci.get("U", 0), ci.get("B", 0), ci.get("R", 0), ci.get("G", 0)
    )


def pair_color_score(d1: list[str], d2: list[str]) -> float:
    if not d1 or not d2:
        return 0.0
    allied = 0
    enemy = 0
    for x, y in COLOR_ALLIED:
        if (x in d1 and y in d2) or (y in d1 and x in d2):
            allied += 1
    for x, y in COLOR_ENEMY:
        if x in d1 and y in d2:
            enemy += 1
    return allied * 12.0 - enemy * 18.0


def color_counter_bonus(attacker: dict, defender: dict) -> float:
    """Bonus si les couleurs de l'attaquant counter philosophiquement le défenseur."""
    aci = attacker.get("color_identity")
    dci = defender.get("color_identity")
    if not aci or not dci:
        return 0.0
    ad = get_dominant(aci)
    dd = get_dominant(dci)
    s = 0.0
    for x, y in COLOR_ENEMY:
        if x in ad and y in dd:
            s += 14.0
        if y in ad and x in dd:
            s -= 8.0
    return s


def color_synergy_bonus(a: dict, b: dict) -> float:
    aci = a.get("color_identity")
    bci = b.get("color_identity")
    if not aci or not bci:
        return 0.0
    return pair_color_score(get_dominant(aci), get_dominant(bci)) * 0.55


def counter_score(attacker: dict, defender: dict) -> float:
    s = 0.0
    at, de = attacker, defender

    if de["assassin"] or de["dive"]:
        if at["peel"] or at["shield"]:
            s += 26
        if at["heal"] and at["support"]:
            s += 18
        if at["name"] in {"Porteur de bouclier", "Moine", "Androïde", "Exorciste", "Fantôme", "Jiangshi"}:
            s += 20

    if at["assassin"] or at["dive"]:
        if de["squish"] and not de["shield"]:
            s += 22
        if de["marksman"] or (de["scaling"] and de["mage"]):
            s += 18
        if de["support"] and not de["tanky"]:
            s += 12
        if at["dash"] and not (de["stun"] or de["root"]):
            s += 14

    if (at["stun"] or at["root"] or at["knockup"]) and de["dash"] and de["assassin"]:
        s += 30
    if at["root"] and de["dash"]:
        s += 16

    if at["tanky"] and de["mage"] and de["name"] != "Mage du vent":
        s += 24
        if at["engage"]:
            s += 10

    if at["mage"] and de["assassin"] and at["range"] >= de["range"]:
        s += 14

    if at["warrior"]:
        if de["assassin"]:
            s += 20
        if de["tanky"] and at["ad_ratio"] >= 150:
            s += 12

    if (at["marksman"] or at["scaling"]) and at["ad_ratio"] >= 100 and de["super_tank"]:
        s += 16

    if at["anti_heal"] and de["heal"]:
        s += 32

    if at["peel"] and (at["shield"] or at["heal"]) and de["dive"]:
        s += 18

    if at["poke"] and at["range"] >= 50 and de["range"] <= 35 and not de["tanky"]:
        s += 14

    if at["engage"] and de["poke"] and de["squish"]:
        s += 12

    if at["wave_clear"] and de["split"] and not de["wave_clear"]:
        s += 8

    if de["squish"] and at["tier"] >= de["tier"] + 1:
        s += 6

    s += HARD_COUNTERS.get((at["name"], de["name"]), 0)

    if at["ad_ratio"] > at["ap_ratio"] and de["ap_ratio"] > de["ad_ratio"] and de["squish"]:
        s += 8

    s += color_counter_bonus(at, de)
    return s


def synergy_score(a: dict, b: dict) -> float:
    s = 0.0

    if (a["peel"] or a["support"]) and (b["marksman"] or b["scaling"]):
        s += 28
    if a["frontline"] and b["poke"]:
        s += 22
    if a["frontline"] and b["mage"]:
        s += 18

    if (a["engage"] or a["knockup"]) and (b["mage"] or b["assassin"] or b["wave_clear"]):
        s += 24
    if a["root"] and b["assassin"]:
        s += 26
    if a["stun"] and b["ad_ratio"] >= 150:
        s += 16

    if a["pick"] and b["mage"] and b["root"]:
        s += 20

    if a["optimal_sup"] and b["optimal_bot"]:
        s += 14
    if a["support"] and b["marksman"]:
        s += 20

    if a["poke"] and b["poke"]:
        s += 12
    if a["split"] and b["pick"]:
        s += 14

    if a["optimal_jg"] and a["pick"] and b["mage"]:
        s += 12

    if (a["peel"] or a["shield"]) and b["tier"] >= 4:
        s += 8

    s += HARD_SYNERGY.get((a["name"], b["name"]), 0)
    s += HARD_SYNERGY.get((b["name"], a["name"]), 0) * 0.85

    if a["tier"] >= 3 and b["tier"] >= 3:
        s += 4

    s += color_synergy_bonus(a, b)
    return s


def build_draft_profile(p: dict) -> dict:
    total_r = p["ad_ratio"] + p["ap_ratio"]
    if total_r > 0:
        ad_share = round(p["ad_ratio"] / total_r, 3)
        ap_share = round(p["ap_ratio"] / total_r, 3)
    elif p["mage"]:
        ad_share, ap_share = 0.0, 1.0
    elif p["marksman"] or p["assassin"]:
        ad_share, ap_share = 1.0, 0.0
    else:
        ad_share, ap_share = 0.5, 0.5

    dps = min(total_r / 320, 1.0)
    if p["assassin"] or p["mage"]:
        dps += 0.22
    if p["marksman"]:
        dps += 0.28
    if p["support"] and total_r < 100:
        dps -= 0.45
    if p["tanky"] and total_r < 100 and not p["mage"] and not p["assassin"]:
        dps -= 0.2
    dps = round(max(0.0, min(1.25, dps * (1.06 if p["tier"] >= 4 else 1.0))), 2)

    tank = 0.0
    if p["super_tank"]:
        tank += 0.95
    elif p["tanky"]:
        tank += 0.68
    if p["frontline"]:
        tank += 0.2
    if p["hp"] >= 2000:
        tank += 0.08
    if p["arm"] >= 110:
        tank += 0.1
    if p["rm"] >= 80:
        tank += 0.06
    if p["squish"]:
        tank -= 0.42
    if p["assassin"]:
        tank -= 0.16
    if p["marksman"]:
        tank -= 0.14
    if p["mage"] and p["squish"]:
        tank -= 0.1
    if p["support"] and p["peel"] and p["tanky"]:
        tank += 0.1
    tank = round(max(0.0, min(1.25, tank)), 2)

    damage_type = "AP" if p["ap_ratio"] > p["ad_ratio"] else "AD" if p["ad_ratio"] > 0 else "Mixed"
    if damage_type != "Mixed" and ad_share >= 0.25 and ap_share >= 0.25:
        damage_type = "Mixed"

    return {
        "damage": damage_type,
        "squishy": p["squish"],
        "tanky": p["tanky"],
        "range": "long" if p["range"] >= 50 else "mid" if p["range"] >= 40 else "melee",
        "adRatio": p["ad_ratio"],
        "apRatio": p["ap_ratio"],
        "adShare": ad_share,
        "apShare": ap_share,
        "dpsWeight": dps,
        "tankWeight": tank,
    }
