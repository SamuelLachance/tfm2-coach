#!/usr/bin/env python3
"""Parse TFM2 markdown files into champions.json for the coach web app."""

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILL_DIR = Path.home() / ".cursor" / "skills" / "teamfight-manager-2"
ABILITIES_MD = SKILL_DIR / "champions-abilities.md"
ICONS_MD = SKILL_DIR / "champions-icons.md"
OUTPUT = ROOT / "data" / "champions.json"
VALID_SLOTS = frozenset({"Top", "Jungle", "Mid", "Bot", "Support"})

META_SOURCES = (
    "Steam guide IA patch (3736370046) — tiers S–D ; "
    "TFM2 Wiki v0.4.11 (2026-06-09) — rôles draft ; "
    "DQ7 Ban-Pick / Personal Tier — positions viables"
)


def norm_name(s: str) -> str:
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode("ascii").lower().strip()


def parse_icons_table(text: str) -> dict[str, dict]:
    icons: dict[str, dict] = {}
    by_norm: dict[str, dict] = {}
    for line in text.splitlines():
        if not line.startswith("|") or "Nom UI (EN)" in line or "---" in line:
            continue
        parts = [p.strip() for p in line.strip("|").split("|")]
        if len(parts) < 4:
            continue
        en, fr_raw, grid, visual = parts[0], parts[1], parts[2], parts[3]
        fr = fr_raw.strip("*").strip()
        if not fr or fr == "Nom français":
            continue
        grid_match = re.match(r"([AB])\s*·\s*R(\d)-C(\d)", grid)
        entry = {
            "nameEn": en,
            "grid": grid,
            "gridSheet": grid_match.group(1) if grid_match else None,
            "gridRow": int(grid_match.group(2)) if grid_match else None,
            "gridCol": int(grid_match.group(3)) if grid_match else None,
            "visual": visual,
        }
        icons[fr] = entry
        by_norm[norm_name(fr)] = entry

    # Champion absent des grilles PNG
    by_norm.setdefault("mage de foudre", {
        "nameEn": "Lightning Mage",
        "grid": None,
        "gridSheet": None,
        "gridRow": None,
        "gridCol": None,
        "visual": "Éclairs / rayon (non visible sur grilles A/B)",
    })
    icons.setdefault("Mage de foudre", by_norm["mage de foudre"])

    return icons, by_norm


def parse_delimited(raw: str | None) -> list[str]:
    if not raw:
        return []
    out: list[str] = []
    for part in re.split(r"\s*·\s*", raw.strip()):
        item = part.strip()
        if item and item not in out:
            out.append(item)
    return out


def parse_slot_list(raw: str | None) -> list[str]:
    return [s for s in parse_delimited(raw) if s in VALID_SLOTS]


def parse_optimal_slots(positions: str | None) -> list[str]:
    if not positions:
        return []
    m = re.search(r"optimal\s*:\s*(.+?)(?:\s*$)", positions)
    return parse_slot_list(m.group(1)) if m else []


def parse_abilities(text: str) -> list[dict]:
    sections = re.split(r"\n## ", text)
    champions = []

    for section in sections[1:]:
        if section.startswith("Légende"):
            continue

        lines = section.strip().split("\n")
        name = lines[0].strip()
        body = "\n".join(lines[1:])

        def grab(label: str) -> str | None:
            m = re.search(rf"\*\*{re.escape(label)}\*\*\s*:\s*(.+)", body)
            return m.group(1).strip() if m else None

        type_match = grab("Type")
        positions = grab("Positions")
        raison = grab("Raison TFM2")
        stats = grab("Stats (Lv.1 → Lv.12)")
        worst = grab("Pires matchups")
        best = grab("Meilleurs pairings")
        build = grab("Build optimal")
        tier_meta = grab("Tier meta")
        tier_note = grab("Note tier")
        draft_job = grab("Rôle draft")
        role_tags = grab("Tags")
        viable_raw = grab("Viable")

        abilities = []
        for m in re.finditer(
            r"\*\*(Ability \d|Ultimate)\s*\(([^)]+)\)\*\*\s*\n(.+?)(?=\n\*\*(?:Ability|Ultimate)|\n---|\Z)",
            body,
            re.DOTALL,
        ):
            slot, meta, desc = m.group(1), m.group(2), m.group(3).strip()
            cd_match = re.search(r"([\d.]+s)", meta)
            abilities.append(
                {
                    "slot": slot,
                    "meta": meta.strip(),
                    "cooldown": cd_match.group(1) if cd_match else None,
                    "description": desc,
                }
            )

        slot_opts = parse_optimal_slots(positions)
        viable_slots = parse_slot_list(viable_raw)

        champions.append(
            {
                "id": re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"),
                "name": name,
                "type": type_match,
                "positions": positions,
                "optimalSlots": slot_opts,
                "viableSlots": viable_slots,
                "draftJob": draft_job,
                "roleTags": parse_delimited(role_tags),
                "raison": raison,
                "stats": stats,
                "worstMatchups": [x.strip() for x in worst.split("·")] if worst else [],
                "bestPairings": [x.strip() for x in best.split("·")] if best else [],
                "build": [x.strip() for x in build.split("·")] if build else [],
                "tierMeta": tier_meta.strip() if tier_meta else None,
                "tierNote": tier_note,
                "abilities": abilities,
            }
        )

    return champions


def main() -> None:
    abilities_text = ABILITIES_MD.read_text(encoding="utf-8")
    icons_text = ICONS_MD.read_text(encoding="utf-8")
    icons, by_norm = parse_icons_table(icons_text)
    champions = parse_abilities(abilities_text)

    for champ in champions:
        icon = icons.get(champ["name"]) or by_norm.get(norm_name(champ["name"]), {})
        champ["nameEn"] = icon.get("nameEn")
        champ["visual"] = icon.get("visual")
        champ["grid"] = icon.get("grid")
        champ["gridSheet"] = icon.get("gridSheet")
        champ["gridRow"] = icon.get("gridRow")
        champ["gridCol"] = icon.get("gridCol")
        icon_file = ROOT / "public" / "icons" / f"{champ['id']}.png"
        if icon_file.is_file():
            champ["icon"] = f"icons/{champ['id']}.png"

    payload = {
        "version": "2026-06-v0.4.11",
        "patchRef": "v0.4.11",
        "source": str(ABILITIES_MD),
        "sourceNotes": META_SOURCES,
        "championCount": len(champions),
        "champions": sorted(champions, key=lambda c: c["name"]),
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    public_out = ROOT / "public" / "data" / "champions.json"
    public_out.parent.mkdir(parents=True, exist_ok=True)
    public_out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(champions)} champions to {OUTPUT} and {public_out}")


if __name__ == "__main__":
    main()
