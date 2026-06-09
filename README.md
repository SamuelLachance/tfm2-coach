# TFM2 Coach Dashboard

Interface web pour consulter rapidement les fiches champions Teamfight Manager 2 (abilities, matchups, pairings).

## Démarrage

```powershell
cd C:\Users\Admin\Projects\tfm2-coach
python scripts/apply_tiers.py
python scripts/parse_champions.py
python scripts/parse_items.py
python scripts/build_tactics_meta.py
python scripts/build_guide_fr.py
python -m http.server 8080 --directory public
```

Ouvrir : **http://localhost:8080**

| Onglet | Fonction |
|--------|----------|
| **Champions** | Fiches, **tier S–D**, matchups, builds |
| **Objets** | Catalogue tier 1–5 |
| **Tactiques** | Comp vs comp → réglages optimaux in-game |
| **Guide** | Management débutants (Steam FR) |

## Mise à jour des données

Les données proviennent des fichiers markdown du skill TFM2 :

- `~/.cursor/skills/teamfight-manager-2/champions-abilities.md` (abilities + **tier meta** + **build optimal**)
- `~/.cursor/skills/teamfight-manager-2/champions-icons.md`
- `~/.cursor/skills/teamfight-manager-2/items.md`

Après modification des `.md`, relancer :

```powershell
python scripts/apply_tiers.py
python scripts/parse_champions.py
```

- **Filtres** : tier meta (S/A/B/C/D), slot optimal, type
- **Badge tier** : coin de chaque carte + bandeau coloré en haut
- **Fiche détail** : section « Tier meta » avec note explicative

## Structure

```
tfm2-coach/
├── docs/
│   └── guide-management-debutants-fr.md   # Guide Steam traduit (FR)
├── data/champions.json      # données générées
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── data/champions.json  # copie servie au navigateur
└── scripts/parse_champions.py
```
