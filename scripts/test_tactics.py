#!/usr/bin/env python3
"""Validate tactics rules on known matchup (skill tactiques-options.md)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
meta = json.loads((ROOT / "public/data/tactics-meta.json").read_text(encoding="utf-8"))["champions"]

# Template "scale" from app.js — vs Porteur + Infanterie
OUR = {
    "Top": "Vampire", "Jungle": "Clown", "Mid": "Mage noir",
    "Bot": "Chasseur de fléchettes empoisonnées", "Support": "Moine",
}
ENEMY = {
    "Top": "Infanterie lourde", "Jungle": "Maître du fouet", "Mid": "Mage de glace",
    "Bot": "Chevalier de cavalerie", "Support": "Porteur de bouclier",
}


def count_tag(comp, tag):
    return sum(1 for v in comp.values() if tag in (meta.get(v, {}).get("tags") or []))


def main():
    our_front = count_tag(OUR, "frontline")
    en_front = count_tag(ENEMY, "frontline")
    cant_engage = en_front >= 2 and our_front <= 1
    print("Our front:", our_front, "| Enemy front:", en_front)
    print("cantEngage5v5:", cant_engage)
    assert cant_engage, "Expected bad 5v5 vs Porteur+Infanterie"
    print("OK — should recommend Poker, Split, Focus Mid/Bot, Defend lane")
    print("Bot matchup: carry squish vs Chevalier cavalerie → Focus Mid/Bot")


if __name__ == "__main__":
    main()
