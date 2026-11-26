#!/bin/sh
# Moteur commun — fichier : moteur/envoi/serveur/recevoir-site.sh   (version 0.4.1)
#
# LA SEULE CHOSE QUE LA CLÉ D'ENVOI PEUT FAIRE SUR LE VPS.
# Installé sur le VPS (par exemple /usr/local/bin/recevoir-site, propriétaire
# root, droits 755), et imposé à la clé d'envoi comme COMMANDE FORCÉE dans
# ~envoi-sites/.ssh/authorized_keys :
#
#   command="/usr/local/bin/recevoir-site /srv/sites/<site>",restrict ssh-ed25519 AAAA… envoi-<site>
#
# Le dossier du site est écrit ICI, côté serveur : celui qui envoie ne le
# choisit pas. Quoi que demande la connexion, ce script ne sait faire que :
#   rsync (réception seule)  recevoir une version dans versions/<id>/
#   preparer                 créer versions/ si besoin ; dire la version en ligne
#   basculer <id>            faire pointer `courant` sur versions/<id>, d'un coup
#   revenir versions/<id>    remettre `courant` sur une version existante
#   menage <n>               garder les n dernières versions (jamais celle en ligne)
#   etat                     lister les versions et dire celle en ligne
# Tout le reste est refusé (code 1), sans rien exécuter.
#
# <id> = AAAAMMJJ-HHMMSS-<7 caractères hexadécimaux du commit>.
# Écrit en sh simple (POSIX) : il tourne sur n'importe quel Linux.
set -eu

DOSSIER="${1:-}"
case "$DOSSIER" in
  /*) ;;
  *) echo "recevoir-site : dossier du site absent ou relatif (à régler dans authorized_keys)" >&2; exit 1 ;;
esac
[ -d "$DOSSIER" ] || { echo "recevoir-site : $DOSSIER n'existe pas" >&2; exit 1; }
cd "$DOSSIER"

refuser() { echo "recevoir-site : refusé — $1" >&2; exit 1; }
id_valide() { printf '%s\n' "$1" | grep -Eq '^[0-9]{8}-[0-9]{6}-[0-9a-f]{7}$'; }
en_ligne() { readlink courant 2>/dev/null || true; }
# Une version ne doit contenir AUCUN lien symbolique : sinon un lien vers un
# fichier du serveur, déposé par qui volerait la clé, serait servi par nginx.
sans_lien() { [ -z "$(find "$1" -type l -print -quit)" ] || refuser "$1 contient un lien symbolique"; }
pointer() {   # $1 = versions/<id> ; bascule d'un seul coup (renommage)
  ln -sfn "$1" courant.nouveau
  mv -Tf courant.nouveau courant
}

# La commande demandée par la connexion (jamais exécutée telle quelle).
set -f   # pas d'expansion de * ou ? dans ce qui suit
# shellcheck disable=SC2086
set -- ${SSH_ORIGINAL_COMMAND:-}
set +f
[ $# -ge 1 ] || refuser "aucune commande"

case "$1" in
  rsync)
    # SEULE forme acceptée : celle qu'envoie `rsync -a --delete [--link-dest=…]`
    # de moteur/envoi/envoyer.sh (rsync 3.2.7 des machines GitHub, mesuré le
    # 26/11/2026), dans cet ordre exact :
    #   rsync --server -logDtpre.<capacités> --delete [--link-dest ../../courant/] . versions/<id>/
    # -logDtpr = -a ; « e. » ouvre la liste des capacités du protocole (pas des
    # options) : lettres connues seulement. Toute autre option (-K, -L, -k,
    # --temp-dir, --partial-dir…) est refusée. Si rsync change un jour cette
    # forme, l'envoi échoue sans rien toucher : adapter ICI et dans
    # moteur/bancs/envoi-essai.sh.
    [ "${2:-}" = "--server" ] || refuser "rsync sans --server"
    printf '%s\n' "${3:-}" | grep -Eq '^-logDtpre\.[iLsfxCIvu]*$' || refuser "option rsync inattendue : ${3:-}"
    drapeaux="$3"
    [ "${4:-}" = "--delete" ] || refuser "rsync sans --delete, ou option inattendue : ${4:-}"
    shift 4
    lien=""
    if [ "${1:-}" = "--link-dest" ]; then
      [ "${2:-}" = "../../courant/" ] || refuser "--link-dest inattendu"
      lien="--link-dest ../../courant/"
      shift 2
    fi
    [ $# -eq 2 ] || refuser "rsync : arguments en trop ou manquants"
    [ "${1:-}" = "." ] || refuser "rsync : source inattendue"
    cible="${2:-}"
    case "$cible" in versions/*/) ;; *) refuser "rsync : destination hors de versions/" ;; esac
    id="${cible#versions/}"; id="${id%/}"
    id_valide "$id" || refuser "rsync : nom de version invalide : $id"
    [ -d versions ] || refuser "versions/ absent : lancer « preparer » d'abord"
    [ ! -e "versions/$id" ] || refuser "la version $id existe déjà"
    # shellcheck disable=SC2086
    exec rsync --server "$drapeaux" --delete $lien . "versions/$id/"
    ;;
  preparer)
    [ $# -eq 1 ] || refuser "preparer ne prend pas d'argument"
    mkdir -p versions
    echo "en_ligne=$(en_ligne)"
    ;;
  basculer)
    [ $# -eq 2 ] && id_valide "$2" || refuser "basculer <id>"
    [ -f "versions/$2/index.html" ] && [ -f "versions/$2/version.txt" ] || refuser "versions/$2 incomplète"
    sans_lien "versions/$2"
    avant="$(en_ligne)"
    pointer "versions/$2"
    echo "avant=$avant"
    echo "en_ligne=versions/$2"
    ;;
  revenir)
    [ $# -eq 2 ] || refuser "revenir versions/<id>"
    id="${2#versions/}"
    [ "versions/$id" = "$2" ] && id_valide "$id" || refuser "revenir : cible invalide : $2"
    [ -f "versions/$id/index.html" ] || refuser "revenir : versions/$id incomplète"
    sans_lien "versions/$id"
    pointer "versions/$id"
    echo "en_ligne=versions/$id"
    ;;
  menage)
    [ $# -eq 2 ] && printf '%s\n' "$2" | grep -Eq '^([1-9]|1[0-9]|20)$' || refuser "menage <1 à 20>"
    actuelle="$(en_ligne)"
    ls -1 versions | sort | head -n "-$2" | while read -r v; do
      id_valide "$v" || continue
      [ "versions/$v" = "$actuelle" ] && continue
      rm -rf -- "versions/$v"
    done
    ls -1 versions | sort
    ;;
  etat)
    [ $# -eq 1 ] || refuser "etat ne prend pas d'argument"
    echo "en_ligne=$(en_ligne)"
    ls -1 versions 2>/dev/null | sort
    ;;
  *)
    refuser "commande inconnue : $1"
    ;;
esac
