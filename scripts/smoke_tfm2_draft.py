#!/usr/bin/env python3
"""Smoke test — draft LoL-style (draft-core + blind pick), guide non primaire."""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
public = ROOT / "public"

engine = public / "draft-engine.js"
core = public / "draft-core.js"
src = engine.read_text(encoding="utf-8")
core_src = core.read_text(encoding="utf-8")

assert "TFM2DraftCore" in src, "draft-engine must use TFM2DraftCore"
assert "TFM2GuideDraftEngine" not in src, "guide engine must not be primary in draft-engine"
assert "BLIND_PICK_SLOTS" in src, "LoL blind pick order missing"
assert "preferredBlindSlot" in src, "LoL blind slot helper missing"
assert core_src.find("guide: 0") >= 0 or "guide: 0," in core_src, "guide layer must be disabled"

index = (ROOT / "public/index.html").read_text(encoding="utf-8")
assert "draft-core.js" in index, "index must load draft-core.js"
assert "tfm2-draft-engine.js" not in index, "guide engine script should not load on draft page"

champs = json.loads((public / "data/champions.json").read_text(encoding="utf-8"))
assert champs["championCount"] >= 50, "champion pool"
for field in ("bestPairings", "worstMatchups", "tierMeta", "colorIdentity"):
    sample = champs["champions"][0]
    assert field in sample, f"champion data missing {field}"

js_smoke = ROOT / "scripts/smoke-tfm2-draft.js"
if js_smoke.exists():
    try:
        proc = subprocess.run(
            ["node", str(js_smoke)],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=45,
            check=False,
        )
        if proc.returncode != 0:
            print(proc.stdout)
            print(proc.stderr, file=sys.stderr)
            raise AssertionError(f"smoke-tfm2-draft.js failed (exit {proc.returncode})")
        print(proc.stdout.strip())
    except FileNotFoundError:
        print("SKIP node smoke — node not installed")

print("SMOKE OK — LoL-style TFM2 draft")
