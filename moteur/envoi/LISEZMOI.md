# Envoi d’un site au VPS (moteur 0.2.0)

Le site est **construit par GitHub Actions**. Le VPS ne construit rien : il
reçoit des fichiers et un serveur web les sert.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `regles.json` | LA source des règles de service : en-têtes de sécurité, cache, pages d'erreur |
| `nginx-site.conf` | ces règles pour nginx (le VPS) |
| `_headers` | ces règles pour les hébergeurs de fichiers (Cloudflare Pages et équivalents) ; copié dans le site construit, jamais servi par le VPS |
| `action.yml` | l'action GitHub « envoyer au VPS », appelée par le workflow du site |
| `envoyer.sh` | ce que fait l'action |

Bancs : `bancs/envoi.mjs` fait tourner un vrai nginx avec `nginx-site.conf` sur
le site construit et vérifie chaque adresse ; `bancs/envoi-essai.sh` joue un
envoi complet sur la machine elle-même (premier envoi, envoi suivant, échec de
vérification avec retour en arrière, ménage).

## Sur le VPS

```
<dossier du site>/
  versions/<date>-<commit>/   une version complète du site par envoi
  courant -> versions/…       lien RELATIF vers la version en ligne
```

- L'envoi écrit une nouvelle version, puis bascule `courant` d'un seul coup :
  un visiteur ne voit jamais un site à moitié envoyé.
- Les fichiers inchangés ne sont pas recopiés (liens physiques vers la
  version d'avant) : une version de plus coûte peu de place.
- Le serveur web sert `<dossier du site>/courant` ; dans le conteneur nginx,
  le dossier du site est monté en `/srv/site` (lecture seule) et
  `nginx-site.conf` devient `/etc/nginx/conf.d/default.conf`.
- Revenir en arrière à la main : remettre `courant` sur une version précédente
  (`ln -sfn versions/<version> courant.nouveau && mv -Tf courant.nouveau courant`).

## Réglages attendus dans le dépôt du site (GitHub > Settings > Secrets and variables > Actions)

| Nom | Sorte | Contenu |
|---|---|---|
| `VPS_CLE_SSH` | secret | clé privée du compte d'envoi |
| `VPS_HOTE` | variable | nom ou adresse du VPS |
| `VPS_PORT` | variable | port SSH (22 si absent) |
| `VPS_UTILISATEUR` | variable | compte d'envoi |
| `VPS_EMPREINTE` | variable | ligne `known_hosts` du VPS |
| `VPS_DOSSIER` | variable | dossier du site sur le VPS (chemin absolu) |
| `ADRESSE_VERIFICATION` | variable | adresse publique où vérifier l'envoi (`https://…`) |
| `ENVOI_VPS` | variable | `oui` pour allumer l'envoi ; toute autre valeur l'éteint |
