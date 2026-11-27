#!/usr/bin/env bash
# Dépôt : Leonessa2/encyclo — fichier : outils/prendre_moteur.sh  (27/11/2026)
# Lancé par : .github/workflows/construire.yml et lire-sheet.yml, avant tout
# ce qui lit moteur/.
#
# Place le moteur commun dans moteur/, à la version figée par moteur.txt :
#   - télécharge le COMMIT écrit (pas une étiquette : un commit ne bouge pas) ;
#   - vérifie moteur/VERSION = « version » de moteur.txt ;
#   - vérifie « moteur.version » de sites/$SITE/manifest.yml = la même ;
#   sinon : arrêt, rien n'est construit.
# Aucun jeton : le dépôt du moteur est public.
#
# Pour essayer un moteur pas encore déposé (machine de travail seulement) :
#   MOTEUR_LOCAL=/chemin/vers/un/clone outils/prendre_moteur.sh
#   (le clone doit être AU commit de moteur.txt).
set -euo pipefail
cd "$(dirname "$0")/.."
lire() { sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*\([^[:space:]#]*\).*/\1/p" moteur.txt | head -1; }
DEPOT=$(lire depot); VERSION=$(lire version); COMMIT=$(lire commit)
[ -n "$DEPOT" ] && [ -n "$VERSION" ] && [[ "$COMMIT" =~ ^[0-9a-f]{40}$ ]] || {
  echo "::error title=moteur.txt illisible::il faut depot, version et un commit de 40 caractères."; exit 1; }

if git ls-files --error-unmatch moteur/VERSION >/dev/null 2>&1; then
  echo "::error title=moteur/ dans le dépôt::ce code contient encore moteur/ ; il ne doit plus être déposé ici."; exit 1
fi

# Déjà pris à ce commit (deuxième appel dans la même exécution) : rien à faire.
if [ -f .moteur-pris ] && [ "$(cat .moteur-pris)" = "$COMMIT" ] && [ -f moteur/VERSION ]; then
  :  # déjà en place
else
  rm -rf moteur .moteur-pris
  tmp=$(mktemp -d)
  if [ -n "${MOTEUR_LOCAL:-}" ]; then
    git -C "$tmp" init -q
    git -C "$tmp" fetch -q "$MOTEUR_LOCAL" "$COMMIT"
  else
    git -C "$tmp" init -q
    for essai in 1 2 3; do
      git -C "$tmp" fetch -q --depth 1 "https://github.com/$DEPOT" "$COMMIT" && break
      [ "$essai" = 3 ] && { echo "::error title=Moteur introuvable::$DEPOT @ $COMMIT"; exit 1; }
      sleep 5
    done
  fi
  [ "$(git -C "$tmp" rev-parse FETCH_HEAD)" = "$COMMIT" ] || { echo "::error::commit reçu différent de $COMMIT"; exit 1; }
  mkdir moteur
  git -C "$tmp" archive FETCH_HEAD | tar -x -C moteur
  rm -rf "$tmp"
  echo "$COMMIT" > .moteur-pris
fi

recu=$(tr -d '[:space:]' < moteur/VERSION)
[ "$recu" = "$VERSION" ] || { echo "::error title=Mauvaise version du moteur::moteur/VERSION = $recu, moteur.txt = $VERSION"; exit 1; }
if [ -n "${SITE:-}" ] && [ -f "sites/$SITE/manifest.yml" ]; then
  declare_site=$(awk '/^moteur:/{m=1;next} m&&/^[^[:space:]]/{m=0} m&&/version:/{gsub(/[" ]/,"",$2);print $2;exit}' "sites/$SITE/manifest.yml")
  [ "$declare_site" = "$VERSION" ] || { echo "::error title=Version du manifeste::sites/$SITE/manifest.yml déclare $declare_site, moteur.txt $VERSION"; exit 1; }
fi
echo "Moteur $VERSION pris de $DEPOT @ ${COMMIT:0:7} ($(find moteur -type f | wc -l) fichiers)."
