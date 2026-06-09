#!/usr/bin/env python3
"""Smoke test structure + logique guide (sans Node)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
guide = json.loads((ROOT / "public/data/tfm2-draft-guide.json").read_text(encoding="utf-8"))

shells = guide["compShells"]
assert len(shells) == 3, "exactement 3 shells"
assert "sniper_front_to_back" in shells
assert "archer_priest_kite" in shells
assert "ninja_executioner_dive" in shells

counters = guide["championCounters"]
assert len(counters) >= 21, f"table counters: {len(counters)}"

# Archer ≠ Tireur dans shell Sniper
sniper = shells["sniper_front_to_back"]
assert "Tireur" in sniper["champions"]
assert "Archer" not in sniper["champions"]
assert sniper.get("distinctFrom", {}).get("Archer")

# Chaîne Archer → Tireur → Joueur
chain = guide["replacementChains"]["Archer"]
assert chain[0] == "Tireur"
assert "Joueur" in chain

# Ban menaces dive vs front-to-back
dive_ban = guide["banPhilosophy"]["threats"]["dive_vs_backline"]
assert "Ninja" in dive_ban["ban"]
assert "sniper_front_to_back" in dive_ban["whenOurShell"]

# Contre-shell: dive → sniper
assert guide["shellCounters"]["dive_pick"] == "sniper_front_to_back"

# Checklist finale
assert len(guide["finalChecklist"]["items"]) >= 6

# Moteur JS présent
engine = ROOT / "public/tfm2-draft-engine.js"
assert engine.exists()
src = engine.read_text(encoding="utf-8")
for fn in ("scoreThreatBan", "scorePickCandidate", "recommendShell", "validateChecklist"):
    assert fn in src, f"missing {fn}"

print("SMOKE OK — guide v2, 3 shells, 21+ counters, engine présent")
