# Moteur commun des sites statiques

Version : voir `VERSION` (0.2.0). Historique : `CHANGEMENTS.md`.
Règles : `RESEAU.md`, section « Le moteur commun des sites ».

Le moteur ne connaît **aucun site**. Tout ce qui est propre à un site
(nom, domaine, couleurs, langues, Sheet, libellés) vient de son dossier
`sites/<site>/` et de la variable `SITE`. Le banc `bancs/moteur-neutre.mjs`
fait échouer la construction si un nom, un domaine, un Sheet ou une couleur
de n'importe quel site apparaît ici, ou si le moteur importe un fichier
hors de ce dossier.

## Ce qu'il contient (0.2.0)

| Dossier | Rôle |
|---|---|
| `editorial/` | lire le Google Sheet éditorial d'un site (`lire_sheet.py`, en lecture seule) et son banc hors réseau |
| `donnees/` | télécharger les fichiers du scrapeur ; garder la dernière bonne copie, avec sa vraie date |
| `lib/` | réglages du site, langues et libellés, contenu éditorial, textes légaux, aperçus de partage, protection anti-robots, feuille de thème |
| `legal/` | textes légaux en 5 langues, avec les réglages du site à la place des noms |
| `outils/` | marquage des textes traduisibles après la construction |
| `envoi/` | règles de service (en-têtes, cache, 404/500) pour nginx et pour les hébergeurs de fichiers ; action « envoyer au VPS » — voir `envoi/LISEZMOI.md` |
| `bancs/` | contrôles valables pour tout site |

## Ce qu'un site doit fournir

- `sites/<site>/manifest.yml`, avec le bloc :
  ```yaml
  moteur:
    version: "0.2.0"          # = moteur/VERSION
    dictionnaires: <dossier>  # où sont les libellés du site (<langue>.json)
  ```
- `sites/<site>/donnees.txt` : la liste des fichiers du scrapeur qu'il lit
  (si le site lit des données).
- `sites/reseau.txt` : les noms et domaines de tout le réseau (pour
  `moteur-neutre`).

## Pas encore dans le moteur

Le gabarit de page, le référencement, le blog et les petits scripts communs
dépendent encore de code propre à un site : ils y entreront une fois démêlés.
Le vérificateur d'images naîtra directement ici.
