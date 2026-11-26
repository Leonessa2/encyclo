# Changements du moteur

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
