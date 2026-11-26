#!/usr/bin/env bash
# Moteur commun — fichier : moteur/envoi/envoyer.sh   (version 0.2.0)
#
# Envoie un site construit au VPS, bascule le lien `courant`, vérifie la page
# servie, revient en arrière si elle ne porte pas ce commit, garde les
# dernières versions. Appelé par moteur/envoi/action.yml (voir son en-tête).
#
# Réglages (variables) : HOTE PORT UTIL DOSSIER ADRESSE SITE_CONSTRUIT GARDER,
# GITHUB_SHA ; clé et empreinte déjà posées dans ~/.ssh par l'action.
#
# ENVOI_ESSAI_LOCAL=1 : mode d'ESSAI du banc. La « machine distante » est la
# machine elle-même (DOSSIER local, pas de SSH) et l'adresse peut être
# http://127.0.0.1:… Jamais utilisé par l'action.
set -euo pipefail
: "${DOSSIER:?}" "${ADRESSE:?}" "${SITE_CONSTRUIT:?}" "${GITHUB_SHA:?}"
GARDER="${GARDER:-5}"

if [ "${ENVOI_ESSAI_LOCAL:-0}" = "1" ]; then
  distant() { bash -c "$1"; }
  CIBLE=""
  RSYNC_E=()
else
  : "${HOTE:?}" "${UTIL:?}"
  SSH="ssh -i $HOME/.ssh/envoi -p ${PORT:-22} -o UserKnownHostsFile=$HOME/.ssh/known_hosts_envoi -o StrictHostKeyChecking=yes -o BatchMode=yes -o ConnectTimeout=20"
  distant() { $SSH "$UTIL@$HOTE" "$1"; }
  CIBLE="$UTIL@$HOTE:"
  RSYNC_E=(-e "$SSH")
fi

ID="$(date -u +%Y%m%d-%H%M%S)-${GITHUB_SHA::7}"
printf '%s\n%s\n' "$GITHUB_SHA" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$SITE_CONSTRUIT/version.txt"

distant "mkdir -p '$DOSSIER/versions'"
AVANT="$(distant "readlink '$DOSSIER/courant' 2>/dev/null || true")"
echo "Version en ligne avant l'envoi : ${AVANT:-aucune}"
LIEN=()
if distant "test -d '$DOSSIER/courant/'"; then LIEN=(--link-dest="$DOSSIER/courant/"); fi

rsync -a --delete ${LIEN[@]+"${LIEN[@]}"} ${RSYNC_E[@]+"${RSYNC_E[@]}"} "$SITE_CONSTRUIT/" "$CIBLE$DOSSIER/versions/$ID/"
distant "test -f '$DOSSIER/versions/$ID/index.html' && test -f '$DOSSIER/versions/$ID/version.txt'"
basculer() { distant "ln -sfn '$1' '$DOSSIER/courant.nouveau' && mv -Tf '$DOSSIER/courant.nouveau' '$DOSSIER/courant'"; }
basculer "versions/$ID"
echo "Lien basculé : courant -> versions/$ID"

ok=""
for essai in $(seq 1 "${ENVOI_ESSAIS:-6}"); do
  servi="$(curl -fsS --max-time 20 -H 'Cache-Control: no-cache' "$ADRESSE/version.txt?v=$ID" 2>/dev/null | head -1 || true)"
  if [ "$servi" = "$GITHUB_SHA" ]; then ok=1; break; fi
  echo "Essai $essai : l'adresse sert « ${servi:-rien} », pas encore ce commit."
  sleep "${ENVOI_ATTENTE:-10}"
done
if [ -z "$ok" ]; then
  if [ -n "$AVANT" ]; then
    basculer "$AVANT"
    echo "::error title=Envoi annulé::$ADRESSE ne sert pas ce commit. Lien remis sur $AVANT."
  else
    echo "::error title=Envoi non vérifié::$ADRESSE ne sert pas ce commit (première version : rien à remettre)."
  fi
  exit 1
fi
echo "✅ $ADRESSE sert le commit $GITHUB_SHA (version $ID)."

distant "cd '$DOSSIER/versions' && ls -1 | sort | head -n -$GARDER | while read -r v; do [ \"versions/\$v\" = \"\$(readlink ../courant)\" ] || rm -rf -- \"\$v\"; done"
echo "Versions gardées :"; distant "ls -1 '$DOSSIER/versions' | sort | tail -n $GARDER"
