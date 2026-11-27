#!/usr/bin/env bash
# Dépôt : Leonessa2/encyclo — fichier : outils/choisir_cible.sh
# Lancé par : .github/workflows/construire.yml, juste après le checkout
# (essai séparé, 27/11/2026). Écrit « cible=essai|vrai » et « code=<commit> »
# dans GITHUB_OUTPUT et, pour le vrai site, place le code validé dans le
# dossier de travail.
#
#   EVENEMENT=push + REF=refs/heads/main      -> essai, code de main
#   EVENEMENT=workflow_dispatch               -> essai, code lancé
#   EVENEMENT=push + REF=refs/heads/en-ligne  -> vrai site, code de en-ligne
#        (refusé s'il n'est pas sur main) + derniers textes du Sheet
#   EVENEMENT=workflow_run (lecture du Sheet) -> vrai site, code de en-ligne
#        + derniers textes ; sans branche en-ligne : essai.
# Variables utiles aux contre-épreuves : MAIN (défaut origin/main),
# EN_LIGNE (défaut origin/en-ligne).
set -euo pipefail
MAIN="${MAIN:-origin/main}"
EN_LIGNE="${EN_LIGNE:-origin/en-ligne}"
SORTIE="${GITHUB_OUTPUT:-/dev/null}"
# Les seuls fichiers écrits par « Lire le Sheet » (lire-sheet.yml).
TEXTES=(sites/vevewiki/editorial public/og/vevewiki engine/data/lastmod.vevewiki.json)

poser_textes() {
  local chemins=()
  for c in "${TEXTES[@]}"; do
    git cat-file -e "$MAIN:$c" 2>/dev/null && chemins+=("$c")
  done
  [ ${#chemins[@]} -gt 0 ] && git checkout -q "$MAIN" -- "${chemins[@]}"
  echo "Textes du Sheet repris de $MAIN ($(git rev-parse --short "$MAIN"))."
}

code_valide() {  # $1 = référence validée ; la place dans le dossier de travail
  local e="$1"
  git merge-base --is-ancestor "$e^{commit}" "$MAIN" || {
    echo "::error title=Mise en ligne refusée::$e n'est pas sur main. Rien n'est envoyé."; exit 1; }
  git -c advice.detachedHead=false checkout -q "$e^{commit}"
  echo "Code validé : $e ($(git rev-parse --short HEAD))."
}

case "${EVENEMENT:?}" in
  push)
    case "${REF:?}" in
      refs/heads/en-ligne) code_valide "$EN_LIGNE"; poser_textes; cible=vrai ;;
      refs/heads/main) cible=essai ;;
      *) echo "::error::référence inattendue : $REF"; exit 1 ;;
    esac ;;
  workflow_run)
    if git rev-parse -q --verify "$EN_LIGNE^{commit}" >/dev/null; then
      code_valide "$EN_LIGNE"; poser_textes; cible=vrai
    else
      echo "::warning title=Aucune mise en ligne validée::pas de branche en-ligne : la lecture du Sheet part sur l'essai seulement."
      cible=essai
    fi ;;
  workflow_dispatch) cible=essai ;;
  *) echo "::error::événement inattendu : $EVENEMENT"; exit 1 ;;
esac
echo "cible=$cible" >> "$SORTIE"
echo "code=$(git rev-parse HEAD)" >> "$SORTIE"
echo "Cible : $cible"
git status --short | head -20
