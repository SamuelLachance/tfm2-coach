#!/usr/bin/env python3
"""Build French guide JSON + markdown from guide_content_fr.py."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from guide_content_fr import GUIDE_META, SECTIONS  # noqa: E402

OUT = ROOT / "public" / "data" / "guide-fr.json"
DOCS = ROOT / "docs" / "guide-management-debutants-fr.md"


def build_guide() -> dict:
    return {**GUIDE_META, "sections": SECTIONS}


def render_markdown(guide: dict) -> str:
    lines = [
        f"# {guide['title']}",
        "",
        f"> {guide['subtitle']}",
        f"> Source : [{guide['sourceUrl']}]({guide['sourceUrl']})",
        f"> Auteur original : {guide['author']}",
        "",
        f"*{guide['disclaimer']}*",
        "",
    ]
    for sec in guide["sections"]:
        lines.append(f"## {sec['title']}")
        lines.append("")
        if sec.get("note"):
            lines.append(f"*{sec['note']}*")
            lines.append("")
        if sec.get("content"):
            lines.append(sec["content"])
            lines.append("")
        if sec.get("tiers"):
            for t in sec["tiers"]:
                lines.append(f"**{t['name']}** — {t['text']}")
                lines.append("")
        if sec.get("tactics"):
            for t in sec["tactics"]:
                lines.append(f"- **{t['name']}** — {t['text']}")
            lines.append("")
    return "\n".join(lines)


def main() -> None:
    guide = build_guide()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(guide, ensure_ascii=False, indent=2), encoding="utf-8")
    DOCS.parent.mkdir(parents=True, exist_ok=True)
    DOCS.write_text(render_markdown(guide), encoding="utf-8")
    print(f"Wrote {OUT} and {DOCS}")


if __name__ == "__main__":
    main()
