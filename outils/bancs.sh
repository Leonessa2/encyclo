#!/usr/bin/env bash
# Dépôt : Leonessa2/encyclo — fichier : outils/bancs.sh
# Lancé par : .github/workflows/construire.yml (lot 3, 26/11/2026)
#
# Les bancs de test RETENUS pour le wiki, dans l'ordre du Dockerfile de
# veve-sites (d'où ils viennent). Usage : outils/bancs.sh avant | apres
#   avant = avant la construction ; apres = sur le site construit (dist/).
# Tous les bancs tournent, même si l'un échoue ; le code de sortie est 1 si au
# moins un a échoué (on juge au code de sortie, pas à l'affichage).
#
# Mesure du 26/11/2026 (SITE=vevewiki) : 56 bancs rejoués, tous verts sauf
# test:acces. Écartés ici, avec la raison :
#   acces, caisse, session, prefs, alertes, reserve, ventes, quotas, rayon,
#   projection, membre, marche, tuiles, adresses : fonctions de veveprice
#     (paliers payants, comptes, paiement, prix, pages comics) ;
#   plages, pages, series, tableau, fraicheur, promesses : « sans objet »
#     sur le wiki (ils le disent eux-mêmes) ;
#   nginx, dockerfile : configurations que le nouvel hébergement n'utilise
#     pas (à revoir au lot 4).
# Lot 4 : `analytics` reste — il contrôle la page /analytics/, pas Umami.
# Lot 4 : `sans-mesure` ajouté — aucune page ne charge de script de mesure.
set -u
PHASE="${1:-}"
: "${SITE:?SITE doit valoir vevewiki}"
case "$PHASE" in
  avant) LISTE="moteur-neutre memoire liens entrepot donnees blog figures fiches lastmod langues schema gabarits css-mort imports-orphelins cascade-aplatie renommage" ;;
  apres) LISTE="cles routes fuite phrases entete feuille titres opacite tiroir affichage analytics indexnow i18n sans-mesure envoi envoi-essai" ;;
  *) echo "Usage : $0 avant|apres"; exit 2 ;;
esac
echecs=()
for b in $LISTE; do
  case "$b" in
    css-mort|imports-orphelins|cascade-aplatie|sans-mesure|moteur-neutre) cmd=(node "moteur/bancs/$b.mjs") ;;
    liens|indexnow) cmd=(npm run --silent "test:$b") ;;
    envoi) cmd=(node moteur/bancs/envoi.mjs) ;;
    envoi-essai) cmd=(bash moteur/bancs/envoi-essai.sh) ;;
    *) cmd=(env WAREHOUSE_OFFLINE=1 npm run --silent "test:$b") ;;
  esac
  echo "::group::banc $b"
  "${cmd[@]}"; code=$?
  echo "::endgroup::"
  if [ $code -eq 0 ]; then echo "✅ $b"; else echo "❌ $b (code $code)"; echecs+=("$b"); fi
done
if [ ${#echecs[@]} -gt 0 ]; then
  echo "::error title=Bancs en échec (${PHASE})::${echecs[*]}"
  exit 1
fi
echo "Tous les bancs « $PHASE » sont verts."
