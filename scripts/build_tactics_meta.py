#!/usr/bin/env python3
"""Build champion tactical metadata for the tactics recommender."""

import json
from pathlib import Path

from jungle_tactics_guide import JUNGLE_GUIDE
from tfm2_profiles import infer_tags

ROOT = Path(__file__).resolve().parent.parent
CHAMPIONS_JSON = ROOT / "data" / "champions.json"
MTG_JSON = ROOT / "data" / "mtg-colors.json"
TACTIC_OPTIONS = {
    "focusLane": {
        "label": "Focus de Lane",
        "values": ["Focus Top/Mid", "Focus Mid/Bot", "Toutes les Lanes"],
    },
    "earlyJungle": {
        "label": "Style de Jungle Précoce",
        "values": ["Gank", "Farm/Couverture", "Contre-Jungle"],
    },
    "earlySerpent": {
        "label": "Tentative de Serpent Précoce",
        "values": ["Flexible", "Toujours Essayer", "Céder"],
    },
    "topSerpent": {
        "label": "Top Laner au Serpent Précoce",
        "values": ["Flexible", "Toujours Rejoindre", "Ne Pas Rejoindre"],
    },
    "waveMgmt": {
        "label": "Gestion des Vagues de Sbires",
        "values": ["Priorité Ralliement", "Priorité Vague"],
    },
    "objectivePrep": {
        "label": "Préparation d'Objectif",
        "values": ["Split Push", "Flexible", "Se Regrouper"],
    },
    "objectiveCombat": {
        "label": "Stratégie de Combat d'Objectif",
        "values": ["Engage Fort", "Poker / Garder ses Distances"],
    },
    "objectiveFinish": {
        "label": "Finalisation d'Objectif",
        "values": ["Priorité d'Élimination", "Priorité de Combat"],
    },
    "morgard": {
        "label": "Utilisation du Buff Morgard",
        "values": ["Split 1-3-1", "Se Regrouper à 5", "Split 1-4"],
    },
    "towerSiege": {
        "label": "Siège de Tour",
        "values": ["Poker / Garder ses Distances", "Dive"],
    },
    "defense": {
        "label": "Tactiques Défensives",
        "values": ["Forcer le Combat", "Défendre la Lane Pressée"],
    },
    "closing": {
        "label": "Conclusion de Partie",
        "values": ["Agressif", "Stable", "Flexible"],
    },
}


FAMILY_LABELS = {
    "tank_engage": "Tank engage",
    "tank_disengage": "Tank disengage",
    "bruiser_teamfight": "Bruiser teamfight",
    "bruiser_split": "Bruiser split",
    "mage_control": "Mage contrôle",
    "mage_dps": "Mage DPS",
    "assassin_ad_pick": "Assassin AD pick",
    "assassin_ap_pick": "Assassin AP pick",
    "adc_hypercarry": "ADC hypercarry",
    "adc_short_allin": "ADC all-in",
    "adc_poke": "ADC poke",
    "adc_tempo": "ADC tempo",
    "support_enchanter": "Support enchanter",
    "support_engage": "Support engage",
    "support_poke": "Support poke",
    "support_disengage": "Support disengage",
    "jungle_defensive": "Jungle défensive",
    "jungle_offensive": "Jungle offensive",
    "jungle_hypercarry": "Jungle hypercarry",
    "global_pick": "Pick global",
    "specialist": "Spécialiste",
    "ovni": "Ovni",
}

FAMILY_COMP_TYPES = {
    "tank_engage": ["teamfight_engage"],
    "tank_disengage": ["poke_disengage"],
    "bruiser_teamfight": ["teamfight_engage"],
    "bruiser_split": ["split_push"],
    "mage_control": ["poke_siege", "poke_disengage"],
    "mage_dps": ["lane_tempo", "all_in"],
    "assassin_ad_pick": ["pick_global", "all_in"],
    "assassin_ap_pick": ["pick_global", "all_in"],
    "adc_hypercarry": ["hypercarry"],
    "adc_short_allin": ["all_in"],
    "adc_poke": ["poke_siege", "poke_disengage"],
    "adc_tempo": ["lane_tempo"],
    "support_enchanter": ["hypercarry"],
    "support_engage": ["teamfight_engage", "all_in"],
    "support_poke": ["poke_siege", "poke_disengage"],
    "support_disengage": ["poke_disengage"],
    "jungle_defensive": ["hypercarry", "poke_disengage"],
    "jungle_offensive": ["lane_tempo", "all_in"],
    "jungle_hypercarry": ["hypercarry"],
    "global_pick": ["pick_global"],
    "specialist": ["lane_tempo"],
    "ovni": ["pick_global"],
}

COMP_GUIDE = {
    "poke_siege": {"label": "Poke / Siege", "teamfight": "Pression à distance sur objectifs"},
    "poke_disengage": {"label": "Poke + Disengage", "teamfight": "Poke puis retrait — pas de 5v5 forcé"},
    "teamfight_engage": {"label": "Teamfight / Engage", "teamfight": "5v5 groupé sur Serpent/Morgard"},
    "split_push": {"label": "Split push", "teamfight": "Pression side + 4 mid"},
    "hypercarry": {"label": "Hypercarry", "teamfight": "Front-to-back, peel total"},
    "lane_tempo": {"label": "Lane tempo", "teamfight": "Snowball early avant scale adverse"},
    "all_in": {"label": "All-in / Catch", "teamfight": "CC lock + burst coordonné"},
    "pick_global": {"label": "Pick / Global", "teamfight": "Vision profonde, punir rotations"},
}

OUT = ROOT / "public" / "data" / "tactics-meta.json"


def resolve_comp_types(family_key: str) -> list[str]:
    return FAMILY_COMP_TYPES.get(family_key, [])[:2]


def main() -> None:
    data = json.loads(CHAMPIONS_JSON.read_text(encoding="utf-8"))
    mtg = json.loads(MTG_JSON.read_text(encoding="utf-8")) if MTG_JSON.exists() else {}

    champions = {}
    for c in data["champions"]:
        tags = infer_tags(c["name"], c)
        ci = c.get("colorIdentity") or mtg.get("champions", {}).get(c["name"]) or {}
        fam = ci.get("family") or ""
        champions[c["name"]] = {
            "id": c["id"],
            "type": c.get("type"),
            "tags": sorted(tags),
            "build": c.get("build", []),
            "tierMeta": c.get("tierMeta"),
            "tierNote": c.get("tierNote"),
            "worstMatchups": c.get("worstMatchups", []),
            "bestPairings": c.get("bestPairings", []),
            "draftProfile": c.get("draftProfile"),
            "colorIdentity": ci,
            "family": fam,
            "familyLabel": FAMILY_LABELS.get(fam, fam),
            "compTypes": resolve_comp_types(fam),
        }

    payload = {
        "version": "2026-06",
        "tacticOptions": TACTIC_OPTIONS,
        "slots": ["Top", "Jungle", "Mid", "Bot", "Support"],
        "jungleGuide": JUNGLE_GUIDE,
        "compGuide": {"compTypes": COMP_GUIDE},
        "mtgColors": {
            "version": mtg.get("version"),
            "totalPoints": mtg.get("totalPoints", 24),
            "colors": mtg.get("colors", {}),
            "pairs": mtg.get("pairs", {}),
        },
        "champions": champions,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    also = ROOT / "data" / "tactics-meta.json"
    also.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    for name in ("jungle-tactics-guide.json", "tfm2-jungle-tactics-guide.json"):
        jungle_out = ROOT / "public" / "data" / name
        jungle_out.write_text(json.dumps(JUNGLE_GUIDE, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote tactics meta for {len(champions)} champions (MTG: {bool(mtg)})")
    print("Wrote jungle-tactics-guide.json + tfm2-jungle-tactics-guide.json")


if __name__ == "__main__":
    main()
