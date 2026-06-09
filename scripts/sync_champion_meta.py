#!/usr/bin/env python3
"""Sync champion positions, tiers, draft roles & tags from researched meta (2026-06).

Sources:
  - Steam guide IA patch (guide_content_fr / id=3736370046) — tiers S–D
  - TFM2 Wiki tier-list v0.4.11 (2026-06-09) — draft jobs Frontline/Engage/Carry/Control/Support
  - DQ7 Reimagined Ban-Pick & Personal Tier guides — positions & viable lanes
  - teamfightmanager.com — role-by-role signals (May 2026)
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from guide_content_fr import SECTIONS  # noqa: E402

ABILITIES_MD = Path.home() / ".cursor" / "skills" / "teamfight-manager-2" / "champions-abilities.md"

SLOTS = ("Top", "Jungle", "Mid", "Bot", "Support")

# draftJob: frontline | engage | carry | control | support
# tier: override only when cross-source justified (else None → keep Steam guide tier)
CHAMPION_META: dict[str, dict] = {
    "Androïde": {
        "draftJob": "support",
        "optimal": ["Support"],
        "viable": ["Top", "Mid"],
        "tags": ["frontline", "peel"],
        "tier": None,
        "tierNote": None,
        "raison": "Boucliers alliés + téléport peel ; aucun besoin d'or/XP.",
    },
    "Archer": {
        "draftJob": "carry",
        "optimal": ["Bot"],
        "viable": ["Mid", "Top"],
        "tags": ["scaling", "poke"],
        "tier": None,
        "tierNote": "Beaucoup plus jouable avec l'IA ; ult one-shot. Positionnement empêche de monter plus haut.",
    },
    "Barde": {
        "draftJob": "support",
        "optimal": ["Support"],
        "viable": ["Mid"],
        "tags": ["peel"],
        "tier": None,
        "tierNote": "Seulement draft 5 statiques spell-DPS ; sinon trop niche.",
    },
    "Berserker": {
        "draftJob": "frontline",
        "optimal": ["Top", "Jungle"],
        "viable": ["Mid"],
        "tags": ["aggressive_jungle", "split", "engage"],
        "tier": None,
        "tierNote": "Fort mais inutile vs 3+ cibles qui se battent.",
    },
    "Bombardier": {
        "draftJob": "carry",
        "optimal": ["Bot"],
        "viable": ["Mid", "Top", "Jungle"],
        "tags": ["poke", "mage_burst", "wave_clear"],
        "tier": None,
        "tierNote": "Gros dégâts, bon TF, farm rapide, jouable sur toute position sauf Support ; demande un minimum de positionnement.",
    },
    "Briseur de siège": {
        "draftJob": "engage",
        "optimal": ["Top"],
        "viable": ["Jungle"],
        "tags": ["aggressive_jungle", "engage", "wave_clear"],
        "tier": None,
        "tierNote": "Ganks dès lvl 1, burst TF en survivant. Difficile sous mass CC.",
    },
    "Chaman vaudou": {
        "draftJob": "control",
        "optimal": ["Mid"],
        "viable": ["Support"],
        "tags": ["mage_burst", "wave_clear"],
        "tier": None,
        "tierNote": "Jamais réalisé malgré 12 buffs d'affilée.",
    },
    "Chasseur": {
        "draftJob": "engage",
        "optimal": ["Jungle"],
        "viable": ["Mid", "Top"],
        "tags": ["pick_jungle", "dive", "assassin"],
        "tier": None,
        "tierNote": "Assassin agréable ; ult aide les TF ; 3 dash intégrés = punissable.",
    },
    "Chasseur de boomerang": {
        "draftJob": "carry",
        "optimal": ["Bot"],
        "viable": ["Mid", "Top"],
        "tags": ["poke"],
        "tier": None,
        "tierNote": "Relativement stable ; les autres se positionnent mieux → relativité, pas perte absolue de puissance.",
    },
    "Chasseur de fléchettes empoisonnées": {
        "draftJob": "carry",
        "optimal": ["Support", "Bot"],
        "viable": ["Mid"],
        "tags": ["poke", "scaling"],
        "tier": None,
        "tierNote": "Énorme gain de positionnement, gros dégâts, peut « saler » la game (rare). Cible prioritaire #3.",
    },
    "Chef": {
        "draftJob": "support",
        "optimal": ["Support"],
        "viable": ["Top"],
        "tags": ["frontline", "wave_clear"],
        "tier": None,
        "tierNote": "Faible à toutes les phases.",
    },
    "Chevalier": {
        "draftJob": "frontline",
        "optimal": ["Top", "Support"],
        "viable": ["Mid"],
        "tags": ["frontline", "engage"],
        "tier": "B",
        "tierNote": "Tank stable ; wiki v0.4.11 B+ frontline — meilleur avec 2 fronts en TF.",
    },
    "Chevalier de cavalerie": {
        "draftJob": "frontline",
        "optimal": ["Jungle", "Top", "Bot"],
        "viable": ["Mid", "Support"],
        "tags": ["aggressive_jungle", "engage", "split"],
        "tier": None,
        "tierNote": "Gros dégâts early, excellent TF sous ult. Ordre : Jungle → Top → Bot → Mid → Support.",
    },
    "Chevalier magique": {
        "draftJob": "frontline",
        "optimal": ["Mid", "Top"],
        "viable": ["Jungle"],
        "tags": ["frontline", "mage_burst"],
        "tier": "B",
        "tierNote": "Bruiser/mage menaçant ; wiki B+ — vulnérable mass stun et burst.",
    },
    "Clown": {
        "draftJob": "engage",
        "optimal": ["Jungle", "Mid"],
        "viable": ["Top"],
        "tags": ["pick_jungle", "aggressive_jungle", "dive", "assassin"],
        "tier": None,
        "tierNote": "Mid burst, quasi toujours 1 kill ; situatif : max 1 front, ennemis squishy.",
    },
    "Combattant": {
        "draftJob": "frontline",
        "optimal": ["Top", "Support"],
        "viable": ["Jungle", "Mid"],
        "tags": ["aggressive_jungle", "engage", "frontline"],
        "tier": None,
        "tierNote": "Contre la majorité des héros ; DPS + survie → montée en A.",
    },
    "Danseuse": {
        "draftJob": "carry",
        "optimal": ["Bot"],
        "viable": ["Mid", "Top"],
        "tags": ["scaling", "dive"],
        "tier": None,
        "tierNote": "Lane IA prudente → plus faible. 3 premiers kills critiques.",
    },
    "Démon": {
        "draftJob": "engage",
        "optimal": ["Jungle"],
        "viable": ["Mid", "Top"],
        "tags": ["pick_jungle", "dive"],
        "tier": None,
        "tierNote": "Crits + survie ; très vulnérable aux stuns → pas S.",
    },
    "Dokkaebi": {
        "draftJob": "frontline",
        "optimal": ["Top"],
        "viable": ["Jungle"],
        "tags": ["engage"],
        "tier": None,
        "tierNote": "Fort early, TF difficile ; espace = menace.",
    },
    "Double lame": {
        "draftJob": "engage",
        "optimal": ["Jungle", "Top"],
        "viable": ["Mid"],
        "tags": ["engage", "dive"],
        "tier": None,
        "tierNote": "Toujours excellent en lane, gros dégâts, ne meurt plus autant après les patchs.",
    },
    "Druide": {
        "draftJob": "control",
        "optimal": ["Top", "Jungle"],
        "viable": ["Mid"],
        "tags": ["farm_jungle", "split"],
        "tier": None,
        "tierNote": "Jouable partout, meilleur Top ; micro-contrôle joueur = très fort.",
    },
    "Enchanteur": {
        "draftJob": "support",
        "optimal": ["Support"],
        "viable": ["Mid"],
        "tags": ["peel", "scaling"],
        "tier": None,
        "tierNote": "Deep late, picks isolés.",
    },
    "Épéiste": {
        "draftJob": "frontline",
        "optimal": ["Top", "Jungle"],
        "viable": ["Mid"],
        "tags": ["engage", "split", "wave_clear"],
        "tier": None,
        "tierNote": "Bon early ; l'IA réalise l'ult en 5v5. Lane faible sans CC.",
    },
    "Esprit gardien": {
        "draftJob": "support",
        "optimal": ["Support"],
        "viable": ["Mid"],
        "tags": ["peel"],
        "tier": None,
        "tierNote": "Trois sorts faibles vs Pythonisse / Mage de barrière.",
    },
    "Exécuteur": {
        "draftJob": "engage",
        "optimal": ["Jungle", "Top"],
        "viable": ["Mid"],
        "tags": ["poke", "frontline"],
        "tier": None,
        "tierNote": "B en contrepick S-tier ; D seul ; B en draft anti.",
    },
    "Exorciste": {
        "draftJob": "support",
        "optimal": ["Support"],
        "viable": ["Mid"],
        "tags": ["peel"],
        "tier": None,
        "tierNote": "Sort 1 et ult faibles ; slot mieux utilisé ailleurs.",
    },
    "Fantôme": {
        "draftJob": "control",
        "optimal": ["Jungle"],
        "viable": ["Mid", "Top"],
        "tags": ["farm_jungle", "scaling"],
        "tier": None,
        "tierNote": "Moins d'erreurs ; moins puni sur HP. Fort seulement bonne draft.",
    },
    "Guerrier de perche": {
        "draftJob": "frontline",
        "optimal": ["Top", "Jungle"],
        "viable": ["Mid"],
        "tags": ["frontline", "engage"],
        "tier": None,
        "tierNote": "Fort mais catch plus fréquent avec IA.",
    },
    "Illusionniste": {
        "draftJob": "control",
        "optimal": ["Mid", "Support"],
        "viable": ["Top"],
        "tags": ["engage", "mage_burst", "wave_clear"],
        "tier": None,
        "tierNote": "IA meilleure sur sorts et position ; bon contrôle ; ult en mêlée = TF gagnable.",
    },
    "Infanterie lourde": {
        "draftJob": "frontline",
        "optimal": ["Top"],
        "viable": ["Jungle"],
        "tags": ["frontline", "engage"],
        "tier": None,
        "tierNote": "Stable, favori perso. Ult repousse 5 ennemis sous buff Morgard.",
    },
    "Inquisiteur": {
        "draftJob": "engage",
        "optimal": ["Jungle"],
        "viable": ["Mid", "Top"],
        "tags": ["aggressive_jungle", "pick_jungle", "dive", "assassin"],
        "tier": None,
        "tierNote": "Le plus fort quand tu domines ; gros dégâts, snowball.",
    },
    "Invocateur d'esprit": {
        "draftJob": "support",
        "optimal": ["Support"],
        "viable": ["Mid"],
        "tags": ["peel"],
        "tier": None,
        "tierNote": "Pas assez fort vs autres supports ; aurait été haut B si meta Top inchangée.",
    },
    "Jiangshi": {
        "draftJob": "support",
        "optimal": ["Top", "Support"],
        "viable": ["Mid"],
        "tags": ["frontline", "peel"],
        "tier": "B",
        "tierNote": "Complément peel ; wiki v0.4.11 B+ support — jamais solo carry.",
    },
    "Joueur": {
        "draftJob": "control",
        "optimal": ["Bot", "Mid"],
        "viable": ["Top"],
        "tags": ["poke", "engage"],
        "tier": None,
        "tierNote": "Moins fort : l'IA se positionne mieux ; fort en TF/contrôle.",
    },
    "Lame de Cirque": {
        "draftJob": "engage",
        "optimal": ["Jungle"],
        "viable": ["Mid", "Top"],
        "tags": ["dive", "assassin"],
        "tier": None,
        "tierNote": "Excellent burst, lane agréable, scale bien en late.",
    },
    "Lancier": {
        "draftJob": "engage",
        "optimal": ["Jungle", "Top"],
        "viable": ["Mid"],
        "tags": ["aggressive_jungle", "engage", "frontline"],
        "tier": None,
        "tierNote": "Bon lane, burst range, DPS constant ; tempo Serpent/objectifs.",
    },
    "Loup-garou": {
        "draftJob": "engage",
        "optimal": ["Jungle"],
        "viable": ["Top"],
        "tags": ["pick_jungle", "dive"],
        "tier": None,
        "tierNote": "Plus fort avec l'IA ; faible TF comme Berserker.",
    },
    "Mage blanc": {
        "draftJob": "control",
        "optimal": ["Mid"],
        "viable": ["Support"],
        "tags": ["mage_burst", "poke", "wave_clear"],
        "tier": None,
        "tierNote": "Sort 1 : gros dégâts + farm ; ult la plus forte des mages si bien réalisée.",
    },
    "Mage de barrière": {
        "draftJob": "support",
        "optimal": ["Support"],
        "viable": ["Mid"],
        "tags": ["peel", "frontline"],
        "tier": None,
        "tierNote": "Contre la plupart des projectiles ; faible vs mêlée. Meilleur support après Pythonisse.",
    },
    "Mage de foudre": {
        "draftJob": "control",
        "optimal": ["Mid"],
        "viable": ["Top"],
        "tags": ["mage_burst", "poke", "wave_clear"],
        "tier": None,
        "tierNote": "Bon lane, ult faible ; surtout double-tank draft.",
    },
    "Mage de glace": {
        "draftJob": "control",
        "optimal": ["Mid"],
        "viable": ["Support"],
        "tags": ["mage_burst", "engage", "wave_clear"],
        "tier": None,
        "tierNote": "2e–3e mage ; énorme dégâts TF ; anti-dive.",
    },
    "Mage des ombres": {
        "draftJob": "control",
        "optimal": ["Mid"],
        "viable": ["Jungle"],
        "tags": ["mage_burst", "pick_jungle"],
        "tier": None,
        "tierNote": "Top mages avec Mage de glace. Énorme dégâts, stun, combo Double lame.",
    },
    "Mage du vent": {
        "draftJob": "control",
        "optimal": ["Mid"],
        "viable": ["Support"],
        "tags": ["mage_burst", "poke", "wave_clear"],
        "tier": None,
        "tierNote": "Toujours le mage #1. Ult game-winning en TF aligné.",
    },
    "Mage noir": {
        "draftJob": "control",
        "optimal": ["Mid"],
        "viable": ["Support"],
        "tags": ["mage_burst", "poke"],
        "tier": None,
        "tierNote": "IA plus smart ; outclassé lane/TF par d'autres mages.",
    },
    "Maître du fouet": {
        "draftJob": "carry",
        "optimal": ["Bot"],
        "viable": ["Top", "Mid"],
        "tags": ["aggressive_jungle", "pick_jungle"],
        "tier": None,
        "tierNote": "DPS incomparable ; ult ≈ +1 kill ; dégâts % PV max.",
    },
    "Médecin de la peste": {
        "draftJob": "support",
        "optimal": ["Support"],
        "viable": ["Mid"],
        "tags": ["engage", "frontline"],
        "tier": None,
        "tierNote": "Jouable post-patch ; ult peut ruiner ; besoin 5 strong en mêlée groupée.",
    },
    "Moine": {
        "draftJob": "support",
        "optimal": ["Support", "Mid"],
        "viable": ["Top"],
        "tags": ["peel", "frontline"],
        "tier": "B",
        "tierNote": "Bruiser engage AoE ; wiki v0.4.11 B+ support — occupe slot des meilleurs supports.",
    },
    "Nécromancien": {
        "draftJob": "control",
        "optimal": ["Mid", "Support"],
        "viable": ["Top"],
        "tags": ["scaling", "farm_jungle", "wave_clear"],
        "tier": None,
        "tierNote": "Injouable avant buffs ; nerf goules ; comp mono-DPS only.",
    },
    "Ninja": {
        "draftJob": "engage",
        "optimal": ["Jungle"],
        "viable": [],
        "tags": ["pick_jungle", "dive", "assassin", "split"],
        "tier": None,
        "tierNote": "Le plus fort des A ; jungle only — peut solo 3 kills au retournement.",
    },
    "Ogre": {
        "draftJob": "frontline",
        "optimal": ["Top", "Jungle"],
        "viable": ["Mid"],
        "tags": ["farm_jungle", "frontline", "scaling"],
        "tier": None,
        "tierNote": "Joueur agressif only ; fort tank mais faible si la team ne joue pas autour.",
    },
    "Porteur de bouclier": {
        "draftJob": "support",
        "optimal": ["Support"],
        "viable": ["Top"],
        "tags": ["frontline", "peel"],
        "tier": None,
        "tierNote": "Tank stable, bonne survie, c'est tout.",
    },
    "Prêtre": {
        "draftJob": "support",
        "optimal": ["Support"],
        "viable": ["Mid"],
        "tags": ["peel"],
        "tier": None,
        "tierNote": "Sustain scaling ; Steam D car Pythonisse Mid > Mage glace/vent pour fronts immortels.",
    },
    "Prisonnier": {
        "draftJob": "frontline",
        "optimal": ["Top", "Jungle"],
        "viable": [],
        "tags": ["frontline"],
        "tier": None,
        "tierNote": "Chair à canon.",
    },
    "Pyromancien": {
        "draftJob": "carry",
        "optimal": ["Mid"],
        "viable": ["Top", "Bot"],
        "tags": ["poke", "mage_burst", "wave_clear"],
        "tier": None,
        "tierNote": "Chute avec l'IA ; lane et dégâts OK, moins dominant qu'avant.",
    },
    "Pythonisse": {
        "draftJob": "control",
        "optimal": ["Support"],
        "viable": ["Mid"],
        "tags": ["peel", "mage_burst", "wave_clear"],
        "tier": None,
        "tierNote": "Du plus faible au plus fort support ; ~20k dégâts + ~40k soins par game.",
    },
    "Soldat": {
        "draftJob": "carry",
        "optimal": ["Top", "Bot"],
        "viable": ["Jungle", "Mid"],
        "tags": ["scaling", "poke", "frontline", "wave_clear", "split"],
        "tier": None,
        "tierNote": "Avec bons front lanes : quasi impossible à tuer, DPS énorme ; ult dévaste.",
    },
    "Taoïste": {
        "draftJob": "support",
        "optimal": ["Support", "Mid"],
        "viable": [],
        "tags": ["peel"],
        "tier": None,
        "tierNote": "Disable agréable mais pas worth un slot sur 5.",
    },
    "Tireur": {
        "draftJob": "carry",
        "optimal": ["Bot", "Top"],
        "viable": ["Mid"],
        "tags": ["scaling", "poke"],
        "tier": None,
        "tierNote": "Meilleur B perso ; scaling carry — besoin 2–3 fronts.",
    },
    "Tueur à gages": {
        "draftJob": "carry",
        "optimal": ["Jungle", "Bot"],
        "viable": ["Mid"],
        "tags": ["pick_jungle", "assassin"],
        "tier": None,
        "tierNote": "Du plus faible au ~#2 A : gros DPS, peu d'erreurs ; très fort carry.",
    },
    "Vampire": {
        "draftJob": "control",
        "optimal": ["Top", "Mid"],
        "viable": ["Jungle"],
        "tags": ["split", "scaling", "frontline"],
        "tier": None,
        "tierNote": "Toujours le roi du late ; l'IA combo ult Infanterie + sorts.",
    },
}


def steam_tier_map() -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {}
    for sec in SECTIONS:
        tid = sec.get("id", "")
        if not tid.startswith("tier-"):
            continue
        letter = tid.replace("tier-", "").upper()
        for entry in sec.get("tiers", []):
            out[entry["name"]] = {
                "tier": letter,
                "note": entry["text"].replace("**", ""),
            }
    return out


def format_positions(optimal: list[str]) -> str:
    opt = " · ".join(optimal)
    return f"Toutes · optimal : {opt}"


def format_viable(viable: list[str], optimal: list[str]) -> str | None:
    extra = [s for s in viable if s not in optimal]
    if not extra:
        return None
    return " · ".join(extra)


def inject_field(section: str, label: str, value: str | None) -> str:
    section = re.sub(rf"\n\*\*{re.escape(label)}\*\*[^\n]*", "", section)
    if not value:
        return section
    block = f"**{label}** : {value}\n"
    if "**Type**" in section:
        return section.replace("**Type**", block + "**Type**", 1)
    if "**Tier meta**" in section:
        return section.replace("**Tier meta**", block + "**Tier meta**", 1)
    return block + section


def grab_field(section: str, label: str) -> str | None:
    m = re.search(rf"\*\*{re.escape(label)}\*\*\s*:\s*(.+)", section)
    return m.group(1).strip() if m else None


def update_section(name: str, section: str, steam: dict[str, dict[str, str]]) -> str:
    meta = CHAMPION_META.get(name)
    if not meta:
        return section

    st = steam.get(name, {})
    tier = meta.get("tier") or st.get("tier", "C")
    note = meta.get("tierNote") or st.get("note", "")
    existing_raison = grab_field(section, "Raison TFM2")

    section = re.sub(r"\n\*\*Tier meta\*\*[^\n]*", "", section)
    section = re.sub(r"\n\*\*Note tier\*\*[^\n]*", "", section)
    section = re.sub(r"\n\*\*Rôle draft\*\*[^\n]*", "", section)
    section = re.sub(r"\n\*\*Tags\*\*[^\n]*", "", section)
    section = re.sub(r"\n\*\*Viable\*\*[^\n]*", "", section)
    section = re.sub(r"\n\*\*Positions\*\*[^\n]*", "", section)
    section = re.sub(r"\n\*\*Raison TFM2\*\*[^\n]*", "", section)

    positions = format_positions(meta["optimal"])
    viable = format_viable(meta.get("viable", []), meta["optimal"])
    tags = " · ".join(meta.get("tags", []))
    draft_job = meta["draftJob"]

    block = (
        f"**Tier meta** : {tier}\n"
        f"**Note tier** : {note}\n"
        f"**Rôle draft** : {draft_job}\n"
        f"**Tags** : {tags}\n"
        f"**Positions** : {positions}\n"
    )
    if viable:
        block += f"**Viable** : {viable}\n"
    raison = meta.get("raison") or existing_raison or ""
    block += f"**Raison TFM2** : {raison}\n"

    if "**Type**" in section:
        section = section.replace("**Type**", block + "**Type**", 1)
    else:
        section = block + section

    return section


def update_legend(text: str) -> str:
    additions = (
        "**Rôle draft** : Frontline · Engage · Carry · Control · Support (wiki TFM2 v0.4.11).\n\n"
        "**Tags** : archétypes tactiques (carry, peel, engage, poke, dive, frontline, etc.).\n\n"
        "**Viable** : postes secondaires jouables (buffs moins optimaux).\n\n"
    )
    if "**Rôle draft**" in text.split("---", 1)[0]:
        return text
    return text.replace("**Build optimal**", additions + "**Build optimal**", 1)


def main() -> None:
    text = ABILITIES_MD.read_text(encoding="utf-8")
    text = update_legend(text)
    steam = steam_tier_map()

    sections = re.split(r"(?=\n## )", text)
    out: list[str] = []
    updated = 0
    missing: list[str] = []

    for section in sections:
        m = re.search(r"^## (.+)$", section.strip(), re.M)
        if not m or m.group(1).startswith("Légende"):
            out.append(section)
            continue
        name = m.group(1).strip()
        if name not in CHAMPION_META:
            missing.append(name)
            out.append(section)
            continue
        out.append(update_section(name, section, steam))
        updated += 1

    ABILITIES_MD.write_text("".join(out), encoding="utf-8")
    print(f"Updated {updated} champions in {ABILITIES_MD}")
    if missing:
        print(f"WARNING: no meta for: {missing}")
    if len(CHAMPION_META) != updated:
        extra = set(CHAMPION_META) - {re.search(r"^## (.+)$", s.strip(), re.M).group(1).strip()
                                        for s in out if re.search(r"^## (.+)$", s.strip(), re.M)}
        print(f"WARNING: meta entries without section: {sorted(extra)}")


if __name__ == "__main__":
    main()
