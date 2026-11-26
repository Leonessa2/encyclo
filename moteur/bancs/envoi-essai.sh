#!/usr/bin/env bash
# Moteur commun — fichier : moteur/bancs/envoi-essai.sh   (version 0.4.0)
#
# Essai complet de l'envoi SANS VPS. La « machine distante » est un dossier
# temporaire :
#   · servi par l'IMAGE NGINX FIGÉE du VPS (moteur/envoi/image-nginx.txt),
#     montée comme sur le VPS (dossier du site en lecture seule dans /srv/site,
#     moteur/envoi/nginx-site.conf comme configuration) ;
#   · gardé par le VRAI moteur/envoi/serveur/recevoir-site.sh, lancé avec la
#     commande exactement comme SSH la lui passerait (commande forcée).
# Scénarios :
#   A. premier envoi : le lien `courant` est créé, nginx sert ce commit ;
#   B. deuxième envoi : nginx sert le nouveau commit, les fichiers inchangés
#      ne sont pas recopiés (liens physiques vers la version d'avant) ;
#   C. vérification impossible : le lien revient sur la version d'avant, échec ;
#   D. ménage : seules les GARDER dernières versions restent, dont celle en ligne ;
#   E. ce que la clé ne peut PAS faire : chaque demande hors du contrat est refusée.
# Usage : moteur/bancs/envoi-essai.sh   (après la construction ; dist/ requis)
set -uo pipefail
RACINE="$(pwd)"
ICI="$RACINE/moteur/envoi"
SERVEUR="$ICI/serveur/recevoir-site.sh"
IMAGE="$(tr -d '[:space:]' < "$ICI/image-nginx.txt")"
[ -f "$RACINE/dist/index.html" ] || { echo "❌ pas de site construit (dist/) : banc creux"; exit 1; }
command -v docker >/dev/null && docker version >/dev/null 2>&1 || { echo "❌ Docker introuvable : ce banc ne peut rien prouver sans lui"; exit 1; }
command -v rsync >/dev/null || { echo "❌ rsync introuvable"; exit 1; }
docker image inspect "$IMAGE" >/dev/null 2>&1 || timeout 180 docker pull -q "$IMAGE" >/dev/null || { echo "❌ image $IMAGE introuvable"; exit 1; }

T="$(mktemp -d)"; ko=0
dit() { if [ "$1" = 0 ]; then echo "  ✅ $2"; else echo "  ❌ $2"; ko=$((ko+1)); fi; }
PORT=$((20000 + RANDOM % 2000)); NOM="envoi-essai-$PORT"
DOSSIER="$T/vps/site"
mkdir -p "$DOSSIER"; chmod -R a+rX "$T"
docker run -d --rm --name "$NOM" -p "127.0.0.1:$PORT:80" \
  -v "$DOSSIER:/srv/site:ro" -v "$ICI/nginx-site.conf:/etc/nginx/conf.d/default.conf:ro" "$IMAGE" >/dev/null \
  || { echo "❌ nginx ne démarre pas"; exit 1; }
trap 'docker stop -t 2 "$NOM" >/dev/null 2>&1; rm -rf "$T"' EXIT
for i in $(seq 1 50); do curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.2; done

envoyer() {  # $1 = faux commit, $2 = adresse de vérification
  rm -rf "$T/dist"; cp -a "$RACINE/dist" "$T/dist"; chmod -R a+rX "$T/dist"
  ENVOI_ESSAI_LOCAL=1 ENVOI_ESSAI_DOSSIER="$DOSSIER" ENVOI_ESSAIS=2 ENVOI_ATTENTE=1 GARDER=3 \
  ADRESSE="$2" SITE_CONSTRUIT="$T/dist" GITHUB_SHA="$1" \
    bash "$ICI/envoyer.sh" > "$T/journal.txt" 2>&1
}
sert() { curl -fsS "http://127.0.0.1:$PORT/version.txt" | head -1; }
serveur() { SSH_ORIGINAL_COMMAND="$1" sh "$SERVEUR" "$DOSSIER" > "$T/serveur.txt" 2>&1; }
A=$(printf 'a%.0s' {1..40}); B=$(printf 'b%.0s' {1..40}); C=$(printf 'c%.0s' {1..40})

echo; echo "l'envoi au VPS fonctionne-t-il ? (essai local : $IMAGE, recevoir-site.sh réel)"
echo; echo "A. premier envoi"
envoyer "$A" "http://127.0.0.1:$PORT"; dit $? "l'envoi réussit"
[ "$(sert)" = "$A" ]; dit $? "nginx sert le commit envoyé"
[ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/")" = 200 ]; dit $? "l'accueil est servi à travers le lien courant"
sleep 1

echo; echo "B. deuxième envoi"
V1="$(readlink "$DOSSIER/courant")"
envoyer "$B" "http://127.0.0.1:$PORT"; dit $? "l'envoi réussit"
[ "$(sert)" = "$B" ]; dit $? "nginx sert le nouveau commit"
V2="$(readlink "$DOSSIER/courant")"
[ -n "$V1" ] && [ -n "$V2" ] && [ "$V1" != "$V2" ] && [ -f "$DOSSIER/$V1/index.html" ] && [ -f "$DOSSIER/$V2/index.html" ] \
  && [ "$(stat -c %i "$DOSSIER/$V1/index.html")" = "$(stat -c %i "$DOSSIER/$V2/index.html")" ]
dit $? "les fichiers inchangés ne sont pas recopiés (même fichier sur le disque)"
sleep 1

echo; echo "C. la vérification échoue"
envoyer "$C" "http://127.0.0.1:1"; code=$?
[ $code -eq 1 ]; dit $? "l'envoi échoue (code $code)"
[ -n "$V2" ] && [ "$(readlink "$DOSSIER/courant")" = "$V2" ]; dit $? "le lien est revenu sur la version d'avant"
[ "$(sert)" = "$B" ]; dit $? "nginx sert toujours le commit d'avant"
grep -q "Envoi annulé" "$T/journal.txt"; dit $? "le journal dit que l'envoi est annulé"
sleep 1

echo; echo "D. ménage (3 versions gardées)"
for x in d e f; do envoyer "$(printf "$x%.0s" {1..40})" "http://127.0.0.1:$PORT" || true; sleep 1; done
n=$(ls -1 "$DOSSIER/versions" | wc -l)
[ "$n" = 3 ]; dit $? "3 versions restent ($n)"
L="$(readlink "$DOSSIER/courant")"; [ -n "$L" ] && [ -f "$DOSSIER/$L/index.html" ]; dit $? "la version en ligne en fait partie"
[ "$(sert)" = "$(printf 'f%.0s' {1..40})" ]; dit $? "nginx sert le dernier commit envoyé"

echo; echo "E. ce que la clé d'envoi ne peut pas faire"
EN_LIGNE="$(readlink "$DOSSIER/courant")"; AVANT_E="$(ls -1 "$DOSSIER/versions" | sort | tr '\n' ' ')"
refus() {  # $1 = commande demandée, $2 = libellé
  serveur "$1"; local c=$?
  [ $c -ne 0 ] && grep -q "refusé" "$T/serveur.txt"; dit $? "refusé : $2"
}
refus "rm -rf /" "une commande quelconque"
refus "sh -c id" "un interpréteur"
refus "rsync --server --sender -logDtpre.iLsfxCIvu . /etc/" "lire des fichiers du serveur (rsync --sender)"
refus "rsync --server -logDtpre.iLsfxCIvu . ../../tmp/x/" "écrire hors de versions/"
refus "rsync --server -logDtpre.iLsfxCIvu . versions/../../x/" "un nom de version piégé"
refus "rsync --server -logDtpre.iLsfxCIvu --link-dest /etc/ . versions/20260101-000000-abcdef0/" "un --link-dest ailleurs"
refus "rsync --server -logDtpre.iLsfxCIvu . $EN_LIGNE/" "écraser une version existante"
refus "basculer ../x" "basculer vers un nom invalide"
refus "revenir /etc" "revenir vers une cible hors de versions/"
refus "revenir versions/20260101-000000-abcdef0" "revenir vers une version inexistante"
refus "menage 0" "un ménage qui effacerait tout"
mkdir -p "$DOSSIER/versions/20260101-000000-abcdef0"; echo x > "$DOSSIER/versions/20260101-000000-abcdef0/index.html"
echo x > "$DOSSIER/versions/20260101-000000-abcdef0/version.txt"; ln -s /etc/passwd "$DOSSIER/versions/20260101-000000-abcdef0/piege.txt"
refus "basculer 20260101-000000-abcdef0" "basculer vers une version qui contient un lien symbolique"
rm -rf "$DOSSIER/versions/20260101-000000-abcdef0"
[ "$(readlink "$DOSSIER/courant")" = "$EN_LIGNE" ] && [ "$(ls -1 "$DOSSIER/versions" | sort | tr '\n' ' ')" = "$AVANT_E" ]
dit $? "après tous ces refus, rien n'a bougé (même version en ligne, mêmes versions)"
serveur "etat"; dit $? "« etat » répond"

echo
if [ $ko -eq 0 ]; then echo "✅ l'envoi fonctionne et la clé ne peut rien d'autre (essai local)."; else echo "⛔ $ko contrôle(s) en échec."; cat "$T/journal.txt" "$T/serveur.txt"; fi
exit $(( ko > 0 ))
