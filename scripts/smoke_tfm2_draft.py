#!/usr/bin/env python3
"""Smoke test structure + logique guide Safe vs Scaling (sans Node requis)."""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
guide = json.loads((ROOT / "public/data/tfm2-draft-guide.json").read_text(encoding="utf-8"))

shells = guide["compShells"]
assert len(shells) == 6, f"6 shells attendus, got {len(shells)}"
for sid in (
    "sniper_front_to_back",
    "archer_priest_kite",
    "ninja_executioner_dive",
    "safe_objective",
    "sniper_scaling",
    "anti_scaling",
):
    assert sid in shells, f"missing shell {sid}"

# Safe vs Scaling guide sections
assert "pickTypes" in guide
assert "safe_blind" in guide["pickTypes"]
assert "Tireur" in guide["pickTypes"]["scaling_carry"]["champions"]
assert "championLabels" in guide
assert len(guide["championLabels"]) >= 18, f"championLabels: {len(guide['championLabels'])}"
assert "decisionTable" in guide and len(guide["decisionTable"]) >= 8
assert "trapRiskRules" in guide and len(guide["trapRiskRules"]) >= 4
assert "aiAdaptationPatterns" in guide
assert "scalingRules" in guide
assert "sniperStates" in guide
assert "safePickJobs" in guide

counters = guide["championCounters"]
assert len(counters) >= 21, f"table counters: {len(counters)}"

# Archer ≠ Tireur dans shell Sniper
sniper = shells["sniper_front_to_back"]
assert "Tireur" in sniper["champions"]
assert "Archer" not in sniper["champions"]
assert sniper.get("distinctFrom", {}).get("Archer")

# Safe objective shell
safe_obj = shells["safe_objective"]
assert "Lancier" in safe_obj["champions"]
assert "Prêtre" in safe_obj["champions"]
assert safe_obj["serpen"]["plan"] == "fight_early"

# Chaîne Archer → Tireur → Joueur
chain = guide["replacementChains"]["Archer"]
assert chain[0] == "Tireur"
assert "Joueur" in chain

# Ban menaces dive vs front-to-back
dive_ban = guide["banPhilosophy"]["threats"]["dive_vs_backline"]
assert "Ninja" in dive_ban["ban"]
assert "sniper_front_to_back" in dive_ban["whenOurShell"]

# Contre-shell: dive → sniper, scaling → anti_scaling
assert guide["shellCounters"]["dive_pick"] == "sniper_front_to_back"
assert guide["shellCounters"]["scaling_front_to_back"] == "anti_scaling"

# Checklist finale
assert len(guide["finalChecklist"]["items"]) >= 6

# Moteur JS présent avec nouvelles fonctions Safe/Scaling
engine = ROOT / "public/tfm2-draft-engine.js"
assert engine.exists()
src = engine.read_text(encoding="utf-8")
for fn in (
    "scoreThreatBan",
    "scorePickCandidate",
    "recommendShell",
    "validateChecklist",
    "analyzeDraftSituation",
    "evaluateTrapRisks",
    "getPickMeta",
    "analyzeSessionPatterns",
    "getSniperDraftState",
):
    assert fn in src, f"missing {fn}"

# Logique Node (first pick safe, Tireur sans peel)
js_smoke = ROOT / "scripts/smoke-tfm2-draft.js"
if js_smoke.exists():
    try:
        proc = subprocess.run(
            ["node", str(js_smoke)],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        if proc.returncode != 0:
            print(proc.stdout)
            print(proc.stderr, file=sys.stderr)
            raise AssertionError(f"smoke-tfm2-draft.js failed (exit {proc.returncode})")
        print(proc.stdout.strip())
    except FileNotFoundError:
        print("SKIP node smoke — node not installed")

print("SMOKE OK — guide v3, 6 shells, Safe vs Scaling, engine présent")
