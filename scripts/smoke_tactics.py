#!/usr/bin/env python3
"""Smoke test — guide JSON + tactics engine scenarios (structure + node runtime)."""
import json
import os
import subprocess
import sys
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
assert len(opts) == 12, "expected 12 tactic settings"

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

# Run JS engine scenarios
node_script = ROOT / "scripts" / "smoke-tactics.js"
node_bin = Path(os.environ.get("NODE_BIN", "C:/Program Files/nodejs/node.exe"))
if not node_bin.exists():
    node_bin = Path("node")
proc = subprocess.run(
    [str(node_bin), str(node_script)],
    cwd=str(ROOT),
    capture_output=True,
    text=True,
    check=False,
)
if proc.returncode != 0:
    print(proc.stdout)
    print(proc.stderr, file=sys.stderr)
    raise SystemExit(proc.returncode)

print(proc.stdout.strip())
print("OK — smoke_tactics.py passed")
