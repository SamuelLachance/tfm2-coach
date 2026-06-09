#!/usr/bin/env python3
"""Insert Tier meta + Note tier into champions-abilities.md from guide_content_fr."""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from guide_content_fr import SECTIONS  # noqa: E402

ABILITIES_MD = Path.home() / ".cursor" / "skills" / "teamfight-manager-2" / "champions-abilities.md"

TIER_MAP: dict[str, dict[str, str]] = {}
for sec in SECTIONS:
    tid = sec.get("id", "")
    if not tid.startswith("tier-"):
        continue
    letter = tid.replace("tier-", "").upper()
    if letter == "D":
        letter = "D"
    for entry in sec.get("tiers", []):
        name = entry["name"]
        text = entry["text"].replace("**", "")
        TIER_MAP[name] = {"tier": letter, "note": text}


def inject_tier(section: str, tier: str, note: str) -> str:
    section = re.sub(r"\n\*\*Tier meta\*\*[^\n]*", "", section)
    section = re.sub(r"\n\*\*Note tier\*\*[^\n]*", "", section)
    block = f"**Tier meta** : {tier}\n**Note tier** : {note}\n"
    if "**Type**" in section:
        return section.replace("**Type**", block + "**Type**", 1)
    return section


def main() -> None:
    text = ABILITIES_MD.read_text(encoding="utf-8")
    if "**Tier meta**" not in text.split("---", 1)[0]:
        legend_insert = (
            "**Tier meta** : classement S / A / B / C / D (guide IA patch — voir [tactiques-jungle-objectifs.md](tactiques-jungle-objectifs.md)).\n\n"
            "**Note tier** : résumé de puissance et contexte meta pour ce champion.\n\n"
        )
        text = text.replace("**Build optimal**", legend_insert + "**Build optimal**", 1)

    sections = re.split(r"(?=\n## )", text)
    out: list[str] = []
    count = 0

    for section in sections:
        m = re.search(r"^## (.+)$", section.strip(), re.M)
        if not m or m.group(1).startswith("Légende"):
            out.append(section)
            continue

        name = m.group(1).strip()
        info = TIER_MAP.get(name)
        if info:
            section = inject_tier(section, info["tier"], info["note"])
            count += 1
        out.append(section)

    ABILITIES_MD.write_text("".join(out), encoding="utf-8")
    print(f"Updated tier for {count} champions ({len(TIER_MAP)} in tier map)")


if __name__ == "__main__":
    main()
