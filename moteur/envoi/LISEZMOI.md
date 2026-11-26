# Envoi d’un site au VPS (moteur 0.4.0)

Le site est **construit par GitHub Actions**. Le VPS ne construit rien : il
reçoit des fichiers et un serveur web les sert.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `regles.json` | LA source des règles de service : en-têtes de sécurité, cache, pages d'erreur |
| `nginx-site.conf` | ces règles pour nginx (le VPS) |
| `image-nginx.txt` | l'image nginx **figée** (version + empreinte), la même pour les bancs et pour le VPS |
| `_headers` | ces règles pour les hébergeurs de fichiers (Cloudflare Pages et équivalents) ; copié dans le site construit, jamais servi par le VPS |
| `action.yml` | l'action GitHub « envoyer au VPS », appelée par le workflow du site |
| `envoyer.sh` | ce que fait l'action |
| `serveur/recevoir-site.sh` | **sur le VPS** : la seule commande que la clé d'envoi peut lancer |

Bancs : `bancs/envoi.mjs` fait tourner l'image figée avec `nginx-site.conf` sur
le site construit et vérifie chaque adresse ; `bancs/envoi-essai.sh` joue des
envois complets à travers le vrai `recevoir-site.sh` (premier envoi, envoi
suivant, échec de vérification avec retour en arrière, ménage) et vérifie
que la clé ne peut rien faire d'autre (12 refus).

## Sur le VPS

```
<dossier du site>/
  versions/<date>-<commit>/   une version complète du site par envoi
  courant -> versions/…       lien RELATIF vers la version en ligne
```

- **La clé d'envoi est limitée par une commande forcée** :
  ```
  command="/usr/local/bin/recevoir-site <dossier du site>",restrict ssh-ed25519 AAAA… envoi-<site>
  ```
  `recevoir-site` (copie de `serveur/recevoir-site.sh`) ne sait que : recevoir
  une version par rsync dans `versions/`, basculer `courant`, revenir sur une
  version existante, faire le ménage, dire l'état. Le dossier du site est
  écrit dans cette ligne, côté serveur : l'envoi ne le choisit pas.
  Il refuse une version qui contient un lien symbolique.
  Prérequis : Linux avec les outils GNU (Ubuntu, Debian), rsync.
- L'envoi écrit une nouvelle version, puis bascule `courant` d'un seul coup :
  un visiteur ne voit jamais un site à moitié envoyé.
- Les fichiers inchangés ne sont pas recopiés (liens physiques vers la
  version d'avant) : une version de plus coûte peu de place.
- Le serveur web sert `<dossier du site>/courant` : conteneur de l'image de
  `image-nginx.txt`, dossier du site monté en `/srv/site` **en lecture seule**,
  `nginx-site.conf` monté en `/etc/nginx/conf.d/default.conf`.
- Revenir en arrière à la main, sur le VPS, en tant que compte d'envoi :
  `SSH_ORIGINAL_COMMAND="revenir versions/<version>" recevoir-site <dossier>`.

## Réglages attendus dans le dépôt du site (GitHub > Settings > Secrets and variables > Actions)

| Nom | Sorte | Contenu |
|---|---|---|
| `VPS_CLE_SSH` | secret | clé privée du compte d'envoi |
| `VPS_HOTE` | variable | nom ou adresse du VPS |
| `VPS_PORT` | variable | port SSH (22 si absent) |
| `VPS_UTILISATEUR` | variable | compte d'envoi |
| `VPS_EMPREINTE` | variable | ligne `known_hosts` du VPS |
| `ADRESSE_VERIFICATION` | variable | adresse publique où vérifier l'envoi (`https://…`) |
| `ENVOI_VPS` | variable | `oui` pour allumer l'envoi ; toute autre valeur l'éteint |
