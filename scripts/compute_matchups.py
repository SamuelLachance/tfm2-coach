#!/usr/bin/env python3
"""Recalcule profils draft + couleurs MTG. Préserve worstMatchups/bestPairings curatés (skill TFM2)."""

from __future__ import annotations

import json
from pathlib import Path

from tfm2_profiles import (
    build_color_identity,
    build_draft_profile,
    build_profile,
    counter_score,
    synergy_score,
)

ROOT = Path(__file__).resolve().parent.parent
CHAMPIONS_JSON = ROOT / "data" / "champions.json"
PUBLIC_CHAMPIONS = ROOT / "public" / "data" / "champions.json"


def top_n(scores: dict[str, float], n: int = 5, min_score: float = 8.0) -> list[str]:
    ranked = sorted(scores.items(), key=lambda x: (-x[1], x[0]))
    return [name for name, val in ranked if val >= min_score][:n]


def main() -> None:
    data = json.loads(CHAMPIONS_JSON.read_text(encoding="utf-8"))
    champs = data["champions"]

    # Couleurs MTG (réutilise draftProfile existant pour affiner)
    for champ in champs:
        p = build_profile(champ)
        champ["colorIdentity"] = build_color_identity(champ, p)
        p["color_identity"] = champ["colorIdentity"]

    profiles = {c["name"]: build_profile(c) for c in champs}
    for c in champs:
        profiles[c["name"]]["color_identity"] = c.get("colorIdentity")

    names = list(profiles.keys())
    counter_matrix: dict[str, dict[str, float]] = {n: {} for n in names}
    synergy_matrix: dict[str, dict[str, float]] = {n: {} for n in names}

    for a_name in names:
        a = profiles[a_name]
        for b_name in names:
            if a_name == b_name:
                continue
            b = profiles[b_name]
            counter_matrix[a_name][b_name] = counter_score(a, b)
            synergy_matrix[a_name][b_name] = synergy_score(a, b)

    for champ in champs:
        name = champ["name"]
        beaten_by = {other: counter_matrix[other][name] for other in names if other != name}
        pairs = {other: synergy_matrix[name][other] for other in names if other != name}
        computed_worst = top_n(beaten_by, 5, min_score=10.0)
        computed_best = top_n(pairs, 5, min_score=12.0)
        champ["computedWorstMatchups"] = computed_worst
        champ["computedBestPairings"] = computed_best
        # Les listes curatées (skill markdown) priment sur le calcul générique tag-based.
        if not champ.get("worstMatchups"):
            champ["worstMatchups"] = computed_worst
        if not champ.get("bestPairings"):
            champ["bestPairings"] = computed_best

        p = profiles[name]
        champ["draftProfile"] = build_draft_profile(p)

    data["matchupVersion"] = "2026-06-mtg"
    data["champions"] = sorted(champs, key=lambda c: c["name"])

    for path in (CHAMPIONS_JSON, PUBLIC_CHAMPIONS):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Recalculated matchups + colors for {len(champs)} champions")
    clown = next(c for c in champs if c["name"] == "Clown")
    print(f"  Clown worst: {clown['worstMatchups']}")
    print(f"  Clown best:  {clown['bestPairings']}")
    print(f"  Clown color: {clown['colorIdentity']['identity']}")


if __name__ == "__main__":
    main()
