#!/usr/bin/env python3
"""Smoke-test draft pick ranking (structure vs supports)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
meta = json.loads((ROOT / "public/data/tactics-meta.json").read_text(encoding="utf-8"))
champs = json.loads((ROOT / "public/data/champions.json").read_text(encoding="utf-8"))

ENCHANTERS = {
    "Moine", "Porteur de bouclier", "Androïde", "Prêtre", "Enchanteur", "Barde",
    "Pythonisse", "Exorciste", "Esprit gardien", "Invocateur d'esprit", "Taoïste",
    "Jiangshi", "Mage de barrière",
}
DAMAGE_TAGS = {"scaling", "marksman", "mage_burst", "burst", "assassin"}


def has_tag(name, tag):
    return tag in (meta.get(name, {}).get("tags") or [])


def is_dedicated_support(name):
    m = meta.get(name, {})
    dp = m.get("draftProfile") or {}
    fam = (m.get("colorIdentity") or {}).get("family") or ""
    tags = m.get("tags") or []
    if has_tag(name, "wave_clear") and has_tag(name, "mage_burst"):
        return False
    if has_tag(name, "scaling") or has_tag(name, "marksman"):
        return False
    if has_tag(name, "frontline") and (dp.get("tankWeight") or 0) >= 0.5:
        return False
    if fam.startswith("support_"):
        return True
    if (dp.get("dpsWeight") or 1) <= 0.15 and has_tag(name, "peel"):
        return True
    return False


def count_supports(names):
    return sum(1 for n in names if is_dedicated_support(n))


def main():
    supports = [n for n in meta if is_dedicated_support(n)]
    print(f"Dedicated supports: {len(supports)}")
    print("Examples:", ", ".join(supports[:12]))

    allies = ["Prêtre", "Barde"]
    cands = []
    for c in champs:
        n = c["name"]
        if n in allies:
            continue
        pen = 0
        if is_dedicated_support(n):
            pen -= 150 + count_supports(allies) * 50
        if has_tag(n, "wave_clear") and not any(has_tag(a, "wave_clear") for a in allies):
            pen += 60
        cands.append((pen, n, is_dedicated_support(n)))
    cands.sort(reverse=True)
    print("\nAfter Prêtre+Barde — top 10 by structure heuristic:")
    for s, n, sup in cands[:10]:
        print(f"  {n}: {s}{' [SUP]' if sup else ''}")


if __name__ == "__main__":
    main()
