#!/usr/bin/env python3
"""Smoke test — guide JSON structure + enum alignment (no JS runtime)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUB = ROOT / "public" / "data"

meta = json.loads((PUB / "tactics-meta.json").read_text(encoding="utf-8"))
guide = json.loads((PUB / "tfm2-jungle-tactics-guide.json").read_text(encoding="utf-8"))
draft = json.loads((PUB / "tfm2-draft-guide.json").read_text(encoding="utf-8"))
opts = meta["tacticOptions"]

assert len(guide["quickSettingsIndex"]) == 5
assert len(guide["templates"]) == 4
assert len(guide["heroJungleChampions"]) == 7
assert len(guide["failureAdjustments"]) == 7
assert len(guide["objectiveCombatOptions"]) == 5
assert len(guide["morgardClosingPlans"]) == 5

for tpl in guide["templates"]:
    for key, val in tpl["tactics"].items():
        allowed = opts.get(key, {}).get("values", [])
        if val not in allowed and val != "Flexible":
            raise AssertionError(f"Template {tpl['id']} {key}={val!r} not in {allowed}")

shell = draft["compShells"]["sniper_front_to_back"]
assert guide["shellIdToArchetype"]["sniper_front_to_back"] == "early_serpent_pressure"
assert shell["slots"]["Jungle"] == "Lancier"

lancer_tpl = next(t for t in guide["templates"] if t["id"] == "lancer_early_serpent")
assert lancer_tpl["tactics"]["earlyJungle"] == "Gank"
assert lancer_tpl["tactics"]["earlySerpent"] == "Toujours Essayer"
assert lancer_tpl["tactics"]["objectiveCombat"] == "Engage Fort"

print("OK — smoke_tactics.py passed")
