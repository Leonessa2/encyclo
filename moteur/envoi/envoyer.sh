#!/usr/bin/env bash
# Moteur commun — fichier : moteur/envoi/envoyer.sh   (version 0.9.0)
#
# Envoie un site construit au VPS, bascule le lien `courant`, vérifie la page
# servie, revient en arrière si elle ne porte pas ce commit, garde les
# dernières versions. Appelé par moteur/envoi/action.yml (voir son en-tête).
#
# ⛔ Sur le VPS, la clé d'envoi ne peut lancer QUE moteur/envoi/serveur/
#    recevoir-site.sh (commande forcée) : ce script ne fait que lui demander
#    « preparer », la réception rsync, « basculer », « revenir », « menage ».
#    Le dossier du site est fixé côté serveur, pas ici.
#
# Réglages (variables) : HOTE PORT UTIL ADRESSE SITE_CONSTRUIT GARDER GITHUB_SHA ;
# ADRESSE peut contenir PLUSIEURS adresses séparées par des espaces (le domaine
# et son adresse de test, par exemple) : TOUTES doivent servir ce commit, sinon
# retour à la version d'avant.
# clé et empreinte déjà posées dans ~/.ssh par l'action.
#
# ENVOI_ESSAI_LOCAL=1 : mode d'ESSAI du banc. Pas de VPS : une fausse connexion
# lance le VRAI recevoir-site.sh sur le dossier ENVOI_ESSAI_DOSSIER, avec la
# commande exactement comme SSH la lui passerait. Jamais utilisé par l'action.
set -euo pipefail
: "${ADRESSE:?}" "${SITE_CONSTRUIT:?}" "${GITHUB_SHA:?}"
GARDER="${GARDER:-5}"
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "${ENVOI_ESSAI_LOCAL:-0}" = "1" ]; then
  : "${ENVOI_ESSAI_DOSSIER:?}"
  FAUX_SSH="$(mktemp)"
  cat > "$FAUX_SSH" <<EOF
#!/usr/bin/env bash
shift   # l'hôte, comme ssh le recevrait
SSH_ORIGINAL_COMMAND="\$*" exec sh "$ICI/serveur/recevoir-site.sh" "$ENVOI_ESSAI_DOSSIER"
EOF
  chmod +x "$FAUX_SSH"
  trap 'rm -f "$FAUX_SSH"' EXIT
  SSH="$FAUX_SSH"
  CIBLE="essai"
else
  : "${HOTE:?}" "${UTIL:?}"
  SSH="ssh -i $HOME/.ssh/envoi -p ${PORT:-22} -o UserKnownHostsFile=$HOME/.ssh/known_hosts_envoi -o StrictHostKeyChecking=yes -o BatchMode=yes -o ConnectTimeout=20"
  CIBLE="$UTIL@$HOTE"
fi
distant() { $SSH "$CIBLE" "$1"; }

ID="$(date -u +%Y%m%d-%H%M%S)-${GITHUB_SHA::7}"
printf '%s\n%s\n' "$GITHUB_SHA" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$SITE_CONSTRUIT/version.txt"

AVANT="$(distant preparer | sed -n 's/^en_ligne=//p')"
echo "Version en ligne avant l'envoi : ${AVANT:-aucune}"
LIEN=()
[ -n "$AVANT" ] && LIEN=(--link-dest=../../courant/)   # fichiers inchangés : non recopiés

rsync -a --delete ${LIEN[@]+"${LIEN[@]}"} -e "$SSH" "$SITE_CONSTRUIT/" "$CIBLE:versions/$ID/"
distant "basculer $ID" >/dev/null
echo "Lien basculé : courant -> versions/$ID"

ADRESSES="$(printf '%s' "$ADRESSE" | tr -s '[:space:]' ' ' | sed -e 's/^ //' -e 's/ $//')"
[ -n "$ADRESSES" ] || { echo "::error::aucune adresse de vérification"; exit 1; }
rate=""
for adr in $ADRESSES; do
  adr="${adr%/}"; ok=""
  for essai in $(seq 1 "${ENVOI_ESSAIS:-6}"); do
    servi="$(curl -fsS --max-time 20 -H 'Cache-Control: no-cache' "$adr/version.txt?v=$ID" 2>/dev/null | head -1 || true)"
    if [ "$servi" = "$GITHUB_SHA" ]; then ok=1; break; fi
    echo "Essai $essai : $adr sert « ${servi:-rien} », pas encore ce commit."
    sleep "${ENVOI_ATTENTE:-10}"
  done
  if [ -n "$ok" ]; then echo "✅ $adr sert le commit $GITHUB_SHA (version $ID)."; else rate="$rate $adr"; fi
done
if [ -n "$rate" ]; then
  if [ -n "$AVANT" ]; then
    distant "revenir $AVANT" >/dev/null
    echo "::error title=Envoi annulé::ne sert pas ce commit :$rate. Lien remis sur $AVANT."
  else
    echo "::error title=Envoi non vérifié::ne sert pas ce commit :$rate (première version : rien à remettre)."
  fi
  exit 1
fi

echo "Versions gardées :"; distant "menage $GARDER"
