#!/usr/bin/env python3
"""Parse items.md into items.json for the coach web app."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILL_DIR = Path.home() / ".cursor" / "skills" / "teamfight-manager-2"
ITEMS_MD = SKILL_DIR / "items.md"
OUTPUT = ROOT / "data" / "items.json"


def section_after(text: str, header: str) -> str:
    idx = text.find(header)
    if idx == -1:
        return ""
    chunk = text[idx + len(header) :]
    nxt = re.search(r"\n## [^#]", chunk)
    return chunk[: nxt.start()] if nxt else chunk


def parse_champ_list(raw: str) -> list[str]:
    names = re.findall(r"\*\*([^*]+)\*\*", raw)
    if names:
        return [n.strip() for n in names]
    return [p.strip() for p in raw.split("·") if p.strip()]


def parse_tier5_sections(text: str) -> list[dict]:
    chunk = section_after(text, "## Tier 5")
    items = []
    pattern = (
        r"### (.+?)\n\n"
        r"\*\*Type\*\* : (.+?)\n"
        r"\*\*Stats\*\* : (.+?)\n"
        r"(?:\*\*Passif\*\* : (.+?)\n\n)?"
        r"\*\*Champions typiques\*\* : (.+?)"
        r"(?=\n\n---|\Z)"
    )
    for m in re.finditer(pattern, chunk, re.DOTALL):
        name, typ, stats, passive, champs = m.groups()
        items.append(
            {
                "name": name.strip(),
                "tier": 5,
                "cost": 2000,
                "type": typ.strip(),
                "stats": stats.strip(),
                "passive": passive.strip() if passive else None,
                "typicalChampions": parse_champ_list(champs),
            }
        )
    return items


def parse_tier_table(text: str, tier: int, cost: int) -> list[dict]:
    header = "## Tier 1" if tier == 1 else "## Tier 2"
    chunk = section_after(text, header)
    items = []

    for line in chunk.splitlines():
        if not line.startswith("| **"):
            continue
        parts = [p.strip() for p in line.strip("|").split("|")]
        if len(parts) < 2 or parts[0] == "Objet":
            continue
        name = parts[0].strip("*").strip()
        entry: dict = {"name": name, "tier": tier, "cost": cost, "stats": parts[1]}
        if tier == 2:
            entry["passive"] = parts[2] if len(parts) > 2 and parts[2] != "—" else None
        items.append(entry)
    return items


def main() -> None:
    text = ITEMS_MD.read_text(encoding="utf-8")
    tier1 = parse_tier_table(text, 1, 500)
    tier2 = parse_tier_table(text, 2, 1000)
    tier5 = parse_tier5_sections(text)

    payload = {
        "version": "2026-06",
        "source": str(ITEMS_MD),
        "rules": {
            "maxItems": 3,
            "tierCosts": {"1": 500, "2": 1000, "5": 2000},
        },
        "items": tier1 + tier2 + tier5,
        "tier5Count": len(tier5),
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    public_out = ROOT / "public" / "data" / "items.json"
    public_out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(payload['items'])} items ({len(tier5)} tier 5) to {OUTPUT}")


if __name__ == "__main__":
    main()
