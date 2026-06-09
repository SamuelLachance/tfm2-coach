#!/usr/bin/env python3
"""Insert **Build optimal** lines into champions-abilities.md."""

import re
from pathlib import Path

ABILITIES_MD = Path.home() / ".cursor" / "skills" / "teamfight-manager-2" / "champions-abilities.md"

BUILDS: dict[str, str] = {
    "Androïde": "Forteresse imprenable · Voile d'annihilation · Fragment de corne du géant",
    "Archer": "Souverain de la tempête · Jugement final du seigneur de guerre · Lame perforante",
    "Barde": "Voile d'annihilation · Souverain de la tempête · Fragment de corne du géant",
    "Berserker": "Souverain de la tempête · Jugement final du seigneur de guerre · Fragment de corne du géant",
    "Bombardier": "Prophète de l'abîme · Bâton du sorcier · Cristal chrono",
    "Briseur de siège": "Jugement final du seigneur de guerre · Fragment de corne du géant · Forteresse imprenable",
    "Chaman vaudou": "Prophète de l'abîme · Bâton du sorcier · Orbe vital",
    "Chasseur": "Jugement final du seigneur de guerre · Souverain de la tempête · Lame perforante",
    "Chasseur de boomerang": "Souverain de la tempête · Jugement final du seigneur de guerre · Lame perforante",
    "Chasseur de fléchettes empoisonnées": "Souverain de la tempête · Jugement final du seigneur de guerre · Lame de vol de vie",
    "Chef": "Fragment de corne du géant · Forteresse imprenable · Voile d'annihilation",
    "Chevalier": "Forteresse imprenable · Fragment de corne du géant · Jugement final du seigneur de guerre",
    "Chevalier de cavalerie": "Jugement final du seigneur de guerre · Souverain de la tempête · Fragment de corne du géant",
    "Chevalier magique": "Prophète de l'abîme · Voile d'annihilation · Fragment de corne du géant",
    "Clown": "Prophète de l'abîme · Cristal chrono · Bâton du sorcier",
    "Combattant": "Jugement final du seigneur de guerre · Forteresse imprenable · Fragment de corne du géant",
    "Danseuse": "Souverain de la tempête · Jugement final du seigneur de guerre · Lame perforante",
    "Démon": "Souverain de la tempête · Jugement final du seigneur de guerre · Lame perforante",
    "Dokkaebi": "Jugement final du seigneur de guerre · Fragment de corne du géant · Forteresse imprenable",
    "Double lame": "Jugement final du seigneur de guerre · Souverain de la tempête · Lame perforante",
    "Druide": "Prophète de l'abîme · Fragment de corne du géant · Voile d'annihilation",
    "Enchanteur": "Voile d'annihilation · Fragment de corne du géant · Prophète de l'abîme",
    "Épéiste": "Jugement final du seigneur de guerre · Forteresse imprenable · Lame de vol de vie",
    "Esprit gardien": "Voile d'annihilation · Fragment de corne du géant · Prophète de l'abîme",
    "Exécuteur": "Jugement final du seigneur de guerre · Lame perforante · Lame de vol de vie",
    "Exorciste": "Prophète de l'abîme · Voile d'annihilation · Fragment de corne du géant",
    "Fantôme": "Souverain de la tempête · Jugement final du seigneur de guerre · Lame perforante",
    "Guerrier de perche": "Forteresse imprenable · Fragment de corne du géant · Jugement final du seigneur de guerre",
    "Illusionniste": "Prophète de l'abîme · Cristal chrono · Bâton du sorcier",
    "Infanterie lourde": "Forteresse imprenable · Fragment de corne du géant · Voile d'annihilation",
    "Inquisiteur": "Jugement final du seigneur de guerre · Souverain de la tempête · Lame perforante",
    "Invocateur d'esprit": "Prophète de l'abîme · Bâton du sorcier · Voile d'annihilation",
    "Jiangshi": "Fragment de corne du géant · Forteresse imprenable · Voile d'annihilation",
    "Joueur": "Jugement final du seigneur de guerre · Souverain de la tempête · Lame perforante",
    "Lame de Cirque": "Jugement final du seigneur de guerre · Souverain de la tempête · Lame perforante",
    "Lancier": "Jugement final du seigneur de guerre · Forteresse imprenable · Fragment de corne du géant",
    "Loup-garou": "Jugement final du seigneur de guerre · Souverain de la tempête · Lame de vol de vie",
    "Mage blanc": "Prophète de l'abîme · Bâton du sorcier · Cristal chrono",
    "Mage de barrière": "Voile d'annihilation · Fragment de corne du géant · Prophète de l'abîme",
    "Mage de foudre": "Prophète de l'abîme · Bâton du sorcier · Cristal chrono",
    "Mage de glace": "Prophète de l'abîme · Bâton du sorcier · Cristal chrono",
    "Mage des ombres": "Prophète de l'abîme · Bâton du sorcier · Cristal chrono",
    "Mage du vent": "Prophète de l'abîme · Cristal chrono · Bâton du sorcier",
    "Mage noir": "Prophète de l'abîme · Cristal chrono · Bâton du sorcier",
    "Maître du fouet": "Souverain de la tempête · Jugement final du seigneur de guerre · Lame perforante",
    "Médecin de la peste": "Prophète de l'abîme · Voile d'annihilation · Fragment de corne du géant",
    "Moine": "Voile d'annihilation · Fragment de corne du géant · Forteresse imprenable",
    "Nécromancien": "Prophète de l'abîme · Bâton du sorcier · Cristal chrono",
    "Ogre": "Fragment de corne du géant · Forteresse imprenable · Voile d'annihilation",
    "Porteur de bouclier": "Forteresse imprenable · Fragment de corne du géant · Voile d'annihilation",
    "Prêtre": "Voile d'annihilation · Fragment de corne du géant · Prophète de l'abîme",
    "Prisonnier": "Forteresse imprenable · Fragment de corne du géant · Jugement final du seigneur de guerre",
    "Pyromancien": "Prophète de l'abîme · Bâton du sorcier · Cristal chrono",
    "Pythonisse": "Prophète de l'abîme · Fragment de corne du géant · Voile d'annihilation",
    "Soldat": "Souverain de la tempête · Jugement final du seigneur de guerre · Lame perforante",
    "Taoïste": "Voile d'annihilation · Prophète de l'abîme · Fragment de corne du géant",
    "Tireur": "Souverain de la tempête · Jugement final du seigneur de guerre · Lame perforante",
    "Tueur à gages": "Jugement final du seigneur de guerre · Souverain de la tempête · Lame perforante",
    "Vampire": "Prophète de l'abîme · Fragment de corne du géant · Bâton du sorcier",
    "Ninja": "Jugement final du seigneur de guerre · Lame perforante · Souverain de la tempête",
}


def inject_build(section: str, build: str) -> str:
    section = re.sub(r"\n\*\*Build optimal\*\*[^\n]*", "", section)
    line = f"**Build optimal** : {build}"
    lines = section.splitlines(keepends=True)
    out: list[str] = []
    inserted = False
    for ln in lines:
        out.append(ln)
        if not inserted and ln.strip().startswith("**Meilleurs pairings**"):
            out.append(line + "\n")
            inserted = True
    if not inserted:
        for i, ln in enumerate(out):
            if ln.strip().startswith("**Ability 1"):
                out.insert(i, line + "\n\n")
                inserted = True
                break
    return "".join(out)


def main() -> None:
    text = ABILITIES_MD.read_text(encoding="utf-8")
    sections = re.split(r"(?=\n## )", text)
    out: list[str] = []
    count = 0

    for section in sections:
        m = re.search(r"^## (.+)$", section.strip(), re.M)
        if not m or m.group(1).startswith("Légende"):
            out.append(section)
            continue

        name = m.group(1).strip()
        build = BUILDS.get(name)
        if build:
            section = inject_build(section, build)
            count += 1
        out.append(section)

    ABILITIES_MD.write_text("".join(out), encoding="utf-8")
    print(f"Updated builds for {count} champions in {ABILITIES_MD}")


if __name__ == "__main__":
    main()
