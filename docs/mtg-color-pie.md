# Magic: The Gathering — Color Pie (référence coach)

Source principale : [Color — MTG Wiki](https://mtg.fandom.com/wiki/Color) (Wizards / Comprehensive Rules).

Ce document alimente `public/mtg-color-pie.js`, le scoring draft (`draft-engine.js`) et les profils Python (`tfm2_profiles.py`, `build_mtg_colors.py`).

---

## Roue WUBRG

Ordre horaire : **W → U → B → R → G → W**

| Code | Nom | Philosophie (Rosewater) | Axes gameplay |
|------|-----|-------------------------|---------------|
| W | Blanc | Paix par la structure | protection, weenies, taxes, mass wipe égalisateur |
| U | Bleu | Perfection par la connaissance | draw, counter, bounce, contrôle |
| B | Noir | Pouvoir par l'opportunité | removal, sacrifice, -N/-N, tutor |
| R | Rouge | Liberté par l'action | burn, haste, destruction artefact/terrain |
| G | Vert | Croissance par l'acceptation | grosses créatures, ramp, trample, naturalize |

**Colorless** : absence de couleur (artefacts, Eldrazi) — pas de philosophie propre.

---

## Relations sur la roue

- **Alliées (adjacentes)** : idéologies proches, synergies naturelles.
- **Ennemies (non-adjacentes, 2 crans)** : oppositions philosophiques fortes.

### 5 paires alliées → Guildes Ravnica

| Paire | Guilde |
|-------|--------|
| WU | Azorius |
| UB | Dimir |
| BR | Rakdos |
| RG | Gruul |
| GW | Selesnya |

### 5 paires ennemies → Duals (Strixhaven / lore)

| Paire | Nom courant |
|-------|-------------|
| WB | Silverquill (Orzhov en Ravnica) |
| WR | Boros |
| UR | Izzet |
| UG | Simic |
| BG | Golgari |

---

## Combinaisons multicolores (pas seulement des paires)

Un objet MTG peut être **mono**, **multicolore** (2+), ou **incolore**. « Multicolored » n'est pas une couleur (CR 105.4).

### 2 couleurs

- **Guild** = paire alliée (score draft élevé : identité claire).
- **Enemy dual** = paire ennemie (tension créative, score intermédiaire).

### 3 couleurs — Shards (Alara, arcs alliés)

| Shard | Couleurs |
|-------|----------|
| Bant | GWU |
| Esper | WUB |
| Grixis | UBR |
| Jund | BRG |
| Naya | RGW |

### 3 couleurs — Wedges (Tarkir, ennemi central)

| Wedge | Couleurs |
|-------|----------|
| Abzan | WBG |
| Sultai | BGU |
| Temur | GUR |
| Jeskai | URW |
| Mardu | RWB |

### 4 et 5 couleurs

- **4 couleurs** : identités Commander 2016 (Artifice, Chaos, Aggression, Altruism, Growth).
- **5 couleurs (WUBRG)** : tout le spectre — difficile à manier sans plan ; pénalisé en draft coach si dispersé.

---

## Règles Comprehensive (extrait)

- CR 105.2 : couleur = symboles de mana du coût (ou indicateur / CDA).
- CR 105.5 : une **color pair** = exactement deux des cinq couleurs (10 paires au total).
- Effet « devient [couleur] » **remplace** les couleurs précédentes sauf « in addition ».

---

## Implémentation coach (draft)

Chaque champion a une **color identity** sur 24 points (W+U+B+R+G = 24).

### Détection d'équipe

1. Somme des vecteurs couleur de l'équipe.
2. Couleurs **actives** (seuil ~12 % du total).
3. `detectCombination()` → mono / guild / enemy_dual / shard / wedge / tricolor / four / five.

### Scoring

| Signal | Effet |
|--------|-------|
| Même couleur | +10 |
| Paire alliée | +16 |
| Paire ennemie | −24 |
| Alignement guild/shard/wedge de l'identité champion | +26 à +38 |
| 5 couleurs sans plan | −18 et conflit UI |

### Priorités draft (TFM2)

1. Synergies / pairings abilities  
2. Famille MTG + **combinaison** (guild → shard/wedge)  
3. Counter Top / Support  

LoL : familles + trinité + harmonie couleur sur la même base WUBRG.

---

## Fichiers du projet

| Fichier | Rôle |
|---------|------|
| `public/mtg-color-pie.js` | Roue, guildes, shards, wedges, scoring |
| `public/draft-engine.js` | Délègue à `MTGColorPie` si chargé |
| `public/data/mtg-colors.json` | Identités champions + meta paires |
| `scripts/build_mtg_colors.py` | Génère le JSON |
| `scripts/tfm2_profiles.py` | `COLOR_ALLIED` / `COLOR_ENEMY` pour profils |

---

## Notes design

- Les **enemy duals** peuvent fonctionner (tension dramatique) — moins bonus qu'une guilde mais pas interdit.
- **Color bleed** (carte hors pie) ≠ identité champion : les profils restent sur l'archétype principal.
- Individualisme : une couleur dominante ne définit pas tout un personnage ; les 24 points capturent les nuances.
