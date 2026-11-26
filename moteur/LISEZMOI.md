# Moteur commun des sites statiques

Version : voir `VERSION` (0.4.1). Historique : `CHANGEMENTS.md`.
Règles : `RESEAU.md`, section « Le moteur commun des sites ».

Le moteur ne connaît **aucun site**. Tout ce qui est propre à un site
(nom, domaine, couleurs, langues, Sheet, libellés) vient de son dossier
`sites/<site>/` et de la variable `SITE`. Le banc `bancs/moteur-neutre.mjs`
fait échouer la construction si un nom, un domaine, un Sheet ou une couleur
de n'importe quel site apparaît ici, ou si le moteur importe un fichier
hors de ce dossier.

## Ce qu'il contient (0.4.1)

| Dossier | Rôle |
|---|---|
| `editorial/` | lire le Google Sheet éditorial d'un site (`lire_sheet.py`, en lecture seule) et son banc hors réseau |
| `donnees/` | télécharger les fichiers du scrapeur ; garder la dernière bonne copie, avec sa vraie date |
| `gabarits/` | `Page.astro` : le gabarit de toutes les pages (en-tête, menu, langues, jour/nuit, pied de page, référencement), avec deux emplacements pour le site |
| `lib/` | réglages du site, langues et libellés, contenu éditorial, blog, référencement et données structurées, textes légaux, aperçus de partage, protection anti-robots, feuille de thème, assemblage du JavaScript commun |
| `socle/` | le JavaScript commun des pages : contact, menu, libellés, choix et suggestion de langue |
| `legal/` | textes légaux en 5 langues, avec les réglages du site à la place des noms |
| `outils/` | marquage des textes traduisibles après la construction |
| `envoi/` | règles de service (en-têtes, cache, 404/500) pour nginx et pour les hébergeurs de fichiers ; action « envoyer au VPS » — voir `envoi/LISEZMOI.md` |
| `bancs/` | contrôles valables pour tout site |

## Ce qu'un site doit fournir

- `sites/<site>/manifest.yml`, avec le bloc :
  ```yaml
  moteur:
    version: "0.4.1"          # = moteur/VERSION
    dictionnaires: <dossier>  # où sont les libellés du site (<langue>.json)
  ```
- `sites/<site>/donnees.txt` : la liste des fichiers du scrapeur qu'il lit
  (si le site lit des données).
- `sites/reseau.txt` : les noms et domaines de tout le réseau (pour
  `moteur-neutre`).

## Ce que le site prête au moteur (points d'entrée)

Le moteur ne touche au code du site que par deux noms, déclarés dans le
`package.json` du site (champ `imports`) ; le banc `moteur-neutre` refuse tout
autre chemin.

| Point d'entrée | Ce que le moteur y cherche | Si c'est absent |
|---|---|---|
| `#site/extensions` | `figureParId(id, langue, légende)` : tracer une figure de données dans un article | les `![…](figure:id)` restent du texte |
| | `rechercheActive()` : la recherche du site est-elle réelle ? | pas de recherche déclarée à Google |
| | `publiePrix()` : le site publie-t-il des prix ? | « non » |
| `#site/socle` | `socleJs()` : le JavaScript commun des pages, assemblé par `assemblerSocle()` (`lib/socle_js.mjs`) avec les morceaux du site | **obligatoire** |

Gabarit : le site enveloppe `gabarits/Page.astro` dans son propre gabarit,
lui passe toutes ses propriétés, et peut remplir deux emplacements :
`tete` (dans le `<head>`) et `debut-corps` (avant l'en-tête).

## Pas encore dans le moteur

Les dictionnaires de libellés (partie 2b) et les bancs de `engine/tools/`
(partie 2c). Le vérificateur d'images naîtra directement ici.
