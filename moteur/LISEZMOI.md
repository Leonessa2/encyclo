# Moteur commun des sites statiques

Version : voir `VERSION` (0.5.0). Historique : `CHANGEMENTS.md`.
Règles : `RESEAU.md`, section « Le moteur commun des sites ».

Le moteur ne connaît **aucun site**. Tout ce qui est propre à un site
(nom, domaine, couleurs, langues, Sheet, libellés) vient de son dossier
`sites/<site>/` et de la variable `SITE`. Le banc `bancs/moteur-neutre.mjs`
fait échouer la construction si un nom, un domaine, un Sheet ou une couleur
de n'importe quel site apparaît ici, ou si le moteur importe un fichier
hors de ce dossier.

## Ce qu'il contient (0.5.0)

| Dossier | Rôle |
|---|---|
| `editorial/` | lire le Google Sheet éditorial d'un site (`lire_sheet.py`, en lecture seule) et son banc hors réseau |
| `donnees/` | télécharger les fichiers du scrapeur ; garder la dernière bonne copie, avec sa vraie date |
| `gabarits/` | `Page.astro` : le gabarit de toutes les pages (en-tête, menu, langues, jour/nuit, pied de page, référencement), avec deux emplacements pour le site ; `pages/` : les pages communes — articles, liste d'articles, étiquettes, pages légales, 404 et 500 |
| `lib/` | réglages du site, langues et libellés, contenu éditorial, blog, référencement et données structurées, plan du site, flux RSS, robots.txt, textes légaux, aperçus de partage, protection anti-robots, feuille de thème, assemblage du JavaScript commun |
| `socle/` | le JavaScript commun des pages : contact, menu, libellés, choix et suggestion de langue |
| `legal/` | textes légaux en 5 langues, avec les réglages du site à la place des noms |
| `outils/` | marquage des textes traduisibles après la construction |
| `envoi/` | règles de service (en-têtes, cache, 404/500) pour nginx et pour les hébergeurs de fichiers ; action « envoyer au VPS » — voir `envoi/LISEZMOI.md` |
| `bancs/` | contrôles valables pour tout site |

## Ce qu'un site doit fournir

- `sites/<site>/manifest.yml`, avec le bloc :
  ```yaml
  moteur:
    version: "0.5.0"          # = moteur/VERSION
    dictionnaires: <dossier>  # où sont les libellés du site (<langue>.json)
  ```
- `sites/<site>/donnees.txt` : la liste des fichiers du scrapeur qu'il lit
  (si le site lit des données).
- `sites/reseau.txt` : les noms et domaines de tout le réseau (pour
  `moteur-neutre`).

## Ce que le site prête au moteur (points d'entrée)

Le moteur ne touche au code du site que par trois noms, déclarés dans le
`package.json` du site (champ `imports`) ; le banc `moteur-neutre` refuse tout
autre chemin.

| Point d'entrée | Ce que le moteur y cherche | Si c'est absent |
|---|---|---|
| `#site/extensions` | `figureParId(id, langue, légende)` : tracer une figure de données dans un article | les `![…](figure:id)` restent du texte |
| | `rechercheActive()` : la recherche du site est-elle réelle ? | pas de recherche déclarée à Google |
| | `publiePrix()` : le site publie-t-il des prix ? | « non » |
| | `fichesCitees(identifiants)` : les fiches citées par un article (`items`), `[{ path, name, series }]` | aucun panneau « objets cités » |
| | `illustrationEtat(usage)` : l'image des pages 404 et 500, `{ src, width, height, cle }` | pages d'erreur sans image |
| | `dateDesDonnees()` : date du jeu de données, repli des dates du plan du site | date de la construction |
| | `adressesDuPlan(langues, langue)` : les adresses propres au site, `[{ p, langs }]`, ajoutées au plan du site après les sections | le plan ne contient que le commun |
| | `fichierDatesDuPlan()` : chemin du journal des dates du plan (format dans `lib/plan_du_site.mjs`) | toutes les adresses à la date des données, avec un avertissement |
| `#site/socle` | `socleJs()` : le JavaScript commun des pages, assemblé par `assemblerSocle()` (`lib/socle_js.mjs`) avec les morceaux du site | **obligatoire** |

| `#site/gabarit` | le gabarit du site (qui enveloppe `gabarits/Page.astro`) : les pages communes s'affichent dedans | **obligatoire** |

Gabarit : le site enveloppe `gabarits/Page.astro` dans son propre gabarit,
lui passe toutes ses propriétés, et peut remplir deux emplacements :
`tete` (dans le `<head>`) et `debut-corps` (avant l'en-tête).

## Les routes que le site garde

Astro ne lit les adresses que dans `src/pages/` du site. Chaque page commune y
a donc une route de quelques lignes, qui choisit ses langues et appelle le
moteur : `404.astro`, `500.astro`, `blog/…`, `legal/[doc].astro`,
`rss.xml.js`, `sitemap.xml.js`, `robots.txt.js` (et leurs versions
`[locale]/`). Exemple : `export const GET = () => planDuSite();`.

## Pas encore dans le moteur

Les dictionnaires de libellés (partie 2c) et les bancs de `engine/tools/`
(partie 2d). Le vérificateur d'images naîtra directement ici.
