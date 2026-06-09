from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public"
NEW = "Filtre par role, recherche, puis icone champion (style LoL)"

for name in ("index.html", "app.js"):
    p = ROOT / name
    t = p.read_text(encoding="utf-8")
    import re
    t2 = re.sub(r"Clique une lane, puis un champion ci-dessous \(A . Z\)", NEW, t)
    t2 = re.sub(r"choisis un champion dans la liste", "choisis un champion", t2)
    if t2 != t:
        p.write_text(t2, encoding="utf-8")
        print(f"updated {name}")
    else:
        print(f"no change {name}")
