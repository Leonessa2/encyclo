#!/usr/bin/env bash
# Moteur commun — fichier : moteur/bancs/envoi-essai.sh   (version 0.2.0)
#
# Essai complet de moteur/envoi/envoyer.sh SANS VPS : la « machine distante »
# est un dossier temporaire, servi par un vrai nginx avec
# moteur/envoi/nginx-site.conf (dont la racine est le lien `courant`).
# Scénarios :
#   A. premier envoi : le lien `courant` est créé, nginx sert ce commit ;
#   B. deuxième envoi : nginx sert le nouveau commit, les fichiers inchangés
#      ne sont pas recopiés (liens physiques vers la version d'avant) ;
#   C. vérification impossible : le lien revient sur la version d'avant, échec ;
#   D. ménage : seules les GARDER dernières versions restent, dont celle en ligne.
# Usage : moteur/bancs/envoi-essai.sh   (après la construction ; dist/ requis)
set -uo pipefail
RACINE="$(pwd)"
ICI="$RACINE/moteur/envoi"
[ -f "$RACINE/dist/index.html" ] || { echo "❌ pas de site construit (dist/) : banc creux"; exit 1; }
command -v nginx >/dev/null || { echo "❌ nginx introuvable : ce banc ne peut rien prouver sans lui"; exit 1; }
MIME=/etc/nginx/mime.types; [ -f "$MIME" ] || { echo "❌ $MIME introuvable"; exit 1; }

T="$(mktemp -d)"; ko=0
dit() { if [ "$1" = 0 ]; then echo "  ✅ $2"; else echo "  ❌ $2"; ko=$((ko+1)); fi; }
PORT=$((20000 + RANDOM % 2000))
DOSSIER="$T/vps/site"
mkdir -p "$DOSSIER" "$T"/{corps,proxy,fcgi,uwsgi,scgi}
sed -e "s#listen 80 default_server;#listen 127.0.0.1:$PORT default_server;#" \
    -e "s#root /srv/site/courant;#root $DOSSIER/courant;#" "$ICI/nginx-site.conf" > "$T/site.conf"
UTILISATEUR=""; [ "$(id -u)" = 0 ] && UTILISATEUR="user root;"
cat > "$T/nginx.conf" <<EOF
$UTILISATEUR
worker_processes 1; error_log $T/erreurs.log warn; pid $T/nginx.pid;
events { worker_connections 64; }
http { include $MIME; default_type application/octet-stream; access_log off;
  client_body_temp_path $T/corps; proxy_temp_path $T/proxy; fastcgi_temp_path $T/fcgi;
  uwsgi_temp_path $T/uwsgi; scgi_temp_path $T/scgi; include $T/site.conf; }
EOF
nginx -p "$T" -c "$T/nginx.conf" || { echo "❌ nginx ne démarre pas"; exit 1; }
trap 'nginx -p "$T" -c "$T/nginx.conf" -s stop 2>/dev/null; rm -rf "$T"' EXIT

envoyer() {  # $1 = faux commit, $2 = adresse de vérification
  rm -rf "$T/dist"; cp -a "$RACINE/dist" "$T/dist"
  ENVOI_ESSAI_LOCAL=1 ENVOI_ESSAIS=2 ENVOI_ATTENTE=1 GARDER=3 \
  DOSSIER="$DOSSIER" ADRESSE="$2" SITE_CONSTRUIT="$T/dist" GITHUB_SHA="$1" \
    bash "$ICI/envoyer.sh" > "$T/journal.txt" 2>&1
}
sert() { curl -fsS "http://127.0.0.1:$PORT/version.txt" | head -1; }
A=$(printf 'a%.0s' {1..40}); B=$(printf 'b%.0s' {1..40}); C=$(printf 'c%.0s' {1..40})

echo; echo "l'envoi au VPS fonctionne-t-il ? (essai local, nginx réel)"
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

echo
if [ $ko -eq 0 ]; then echo "✅ l'envoi fonctionne (essai local)."; else echo "⛔ $ko contrôle(s) en échec."; cat "$T/journal.txt"; fi
exit $(( ko > 0 ))
