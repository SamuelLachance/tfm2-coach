#!/usr/bin/env python3
"""Build MTG color identity (W/U/B/R/G, sum=24) for all TFM2 champions."""

from __future__ import annotations

import json
from pathlib import Path

from tfm2_profiles import build_color_identity, build_profile

ROOT = Path(__file__).resolve().parent.parent
CHAMPIONS_JSON = ROOT / "data" / "champions.json"
PUBLIC_CHAMPIONS = ROOT / "public" / "data" / "champions.json"
OUT_PATHS = [
    ROOT / "data" / "mtg-colors.json",
    ROOT / "public" / "data" / "mtg-colors.json",
]

COLOR_META = {
    "W": {"label": "Blanc", "labelEn": "White", "philosophy": "Structure & altruisme", "hex": "#f5f0dc"},
    "U": {"label": "Bleu", "labelEn": "Blue", "philosophy": "Connaissance & contrôle", "hex": "#4a9fd4"},
    "B": {"label": "Noir", "labelEn": "Black", "philosophy": "Pouvoir & sacrifice", "hex": "#6b6b7a"},
    "R": {"label": "Rouge", "labelEn": "Red", "philosophy": "Liberté & destruction", "hex": "#e05238"},
    "G": {"label": "Vert", "labelEn": "Green", "philosophy": "Croissance & tradition", "hex": "#3d9e5a"},
}

# Adjacent = allied (Ravnica guilds) · non-adjacent = enemy (10 pairs total, CR 105.5)
COLOR_PAIRS = {
    "allied": [["W", "U"], ["U", "B"], ["B", "R"], ["R", "G"], ["G", "W"]],
    "enemy": [["W", "B"], ["W", "R"], ["U", "R"], ["U", "G"], ["B", "G"]],
}


def main() -> None:
    data = json.loads(CHAMPIONS_JSON.read_text(encoding="utf-8"))
    champions: dict[str, dict] = {}

    for c in data["champions"]:
        profile = build_profile(c)
        ci = build_color_identity(c, profile)
        c["colorIdentity"] = ci
        champions[c["name"]] = ci

    data["mtgVersion"] = "2026-06-tfm2"
    for path in (CHAMPIONS_JSON, PUBLIC_CHAMPIONS):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    out = {
        "version": "2026-06-tfm2",
        "source": "tfm2_profiles — familles archétype + overrides TFM2",
        "totalPoints": 24,
        "colors": COLOR_META,
        "pairs": COLOR_PAIRS,
        "champions": champions,
    }

    for path in OUT_PATHS:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Wrote {path} ({len(champions)} champions)")

    bad = [n for n, c in champions.items() if sum(c[k] for k in "WUBRG") != 24]
    if bad:
        raise SystemExit(f"Color sum != 24: {bad[:5]}")


if __name__ == "__main__":
    main()
