# Changements du moteur

## 0.3.0 — 26/11/2026

- **Gabarit de page** (`gabarits/Page.astro`), **blog** (`lib/blog.mjs`),
  **référencement** (`lib/seo.mjs`), **JavaScript commun** (`lib/socle_js.mjs`
  et `socle/`) entrent dans le moteur.
- Ce qui était propre aux sites de prix n'y entre pas (comptes, avatar,
  inscription, alertes, cote, bandeau « vu », lien vers la méthode des prix,
  donnée structurée d'un objet avec son prix).
- **Points d'entrée du site** : `#site/extensions` (facultatif) et
  `#site/socle` (obligatoire) — voir `LISEZMOI.md`.
- Le JavaScript commun s'assemble dans l'ordre des noms de fichiers ; le site
  ajoute ses morceaux et déclare ceux qu'il garde sans les servir.
- `moteur-neutre` : ne saute plus un fichier pour un caractère nul (il en
  sautait un en 0.1.0 et 0.2.0 : `lib/markdown.mjs`, qui était neutre) ;
  refuse tout point d'entrée non déclaré.
- **Ce que les sites doivent adapter** : déclarer `#site/extensions` et
  `#site/socle` dans leur `package.json` ; envelopper `gabarits/Page.astro`
  dans leur gabarit ; importer le blog et le référencement depuis le moteur.

## 0.2.0 — 26/11/2026

- **Servir et envoyer** (`envoi/`) : les règles de service d'un site statique
  (`regles.json` : en-têtes de sécurité, cache, pages 404 et 500), traduites
  pour nginx (`nginx-site.conf`) et pour les hébergeurs de fichiers
  (`_headers`) ; l'action « envoyer au VPS » (`action.yml`, `envoyer.sh`) :
  nouvelle version dans `versions/`, bascule d'un coup du lien `courant`,
  vérification de la page servie, retour en arrière sinon, ménage.
- Par rapport à l'ancienne configuration nginx du premier site : redirection
  « /dossier » → « /dossier/ » relative (avant : vers http://), un seul
  Cache-Control sur les fichiers statiques, 404 au lieu de 403 pour un dossier
  sans page, en-têtes de sécurité sur toutes les réponses.
- Bancs `envoi.mjs` (nginx réel, chaque adresse du site) et `envoi-essai.sh`
  (envoi complet sur la machine elle-même).
- **Ce que les sites doivent adapter** : copier `envoi/_headers` dans le site
  construit ; avoir nginx et rsync sur la machine des bancs ; pour envoyer,
  les réglages listés dans `envoi/LISEZMOI.md`.

## 0.1.0 — 26/11/2026

Première version, née dans le dépôt du premier site qui l'utilise.

- Lecture du Sheet éditorial (`editorial/`), téléchargement des données du
  scrapeur avec dernière bonne copie (`donnees/`), réglages, langues, contenu
  éditorial, textes légaux (`lib/`, `legal/`), marquage des textes
  traduisibles (`outils/`), bancs communs (`bancs/`).
- **Ce que les sites doivent adapter** :
  - la variable `SITE` est obligatoire (plus de site par défaut) ;
  - le manifeste déclare `moteur.version` et `moteur.dictionnaires` ;
  - la liste des fichiers du scrapeur est dans `sites/<site>/donnees.txt` ;
  - ce qu'une page ajoute au contenu lu (dates, compteurs…) se passe à
    `collection(page, langue, { transformer })` : le moteur ne connaît aucune
    page par son nom.
- Nouveau banc `bancs/moteur-neutre.mjs`.
