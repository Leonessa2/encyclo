#!/usr/bin/env bash
# Dépôt : Leonessa2/encyclo — fichier : outils/donnees_scrapeur.sh
# Lancé par : .github/workflows/construire.yml (lot 3, 26/11/2026)
#
# Télécharge les fichiers publiés par le scrapeur dont la construction a besoin,
# dans .donnees/ (gardé d'une exécution à l'autre par le cache de GitHub).
#  - fichier frais et valide  -> il remplace l'ancien ;
#  - échec ou fichier invalide -> on GARDE la dernière bonne copie, avec sa date,
#    et on le signale (avertissement), sans faire échouer la construction ;
#  - aucune copie du tout     -> avertissement ; la construction ira chercher
#    le fichier elle-même (seul cas où elle peut encore échouer : tout premier
#    passage pendant une panne du scrapeur).
# `curl -R` cale la date du fichier sur celle de la release : la date affichée
# reste la vraie date de la donnée.
# Sortie : variables *_URL=file://… pour la construction, et un état lisible.
set -u
DOSSIER="${DONNEES_DOSSIER:-.donnees}"
mkdir -p "$DOSSIER"
J=https://github.com/Leonessa2/jetonveve/releases/download
S=https://github.com/Leonessa2/scrapeur-veve/releases/download
# variable | fichier local | adresse de la release
LISTE="CATALOGUE_URL|catalogue.csv.gz|$J/catalogue/catalogue.csv.gz
PRICES_URL|prices.csv.gz|$J/prices-full/prices.csv.gz
BASELINES_URL|prices_baselines.csv.gz|$J/prices-full/prices_baselines.csv.gz
RELEVES_URL|releves.csv|$J/etat-floor-watch/releves.csv
EXTREMES_STACKR_URL|extremes_stackr.csv|$J/etat-floor-watch/extremes_stackr.csv
OMI_USD_URL|omi_usd.csv|$J/etat-floor-watch/omi_usd.csv
FICHES_STACKR_URL|fiches_stackr.csv|$J/etat-fiches-stackr/fiches_stackr.csv
VENTES_URL|ventes_stackr.csv|$S/etat-ventes-stackr/ventes_stackr.csv"

# Contre-épreuve : DONNEES_PANNE=1 simule un scrapeur qui ne publie plus
# (toutes les adresses deviennent injoignables).
if [ "${DONNEES_PANNE:-0}" = "1" ]; then
  echo "::warning title=Panne simulée::Les téléchargements du scrapeur sont volontairement coupés pour ce passage."
  LISTE=$(printf '%s\n' "$LISTE" | sed 's#https://github.com/#https://panne-simulee.invalid/#')
fi

ENV_SORTIE="${GITHUB_ENV:-/dev/null}"
SORTIE="${GITHUB_OUTPUT:-/dev/null}"
frais=0; anciens=0; absents=0
: > "$DOSSIER/etat.txt"

valide() {  # un fichier non vide, lisible, avec au moins une ligne d'en-tête et une ligne
  local f="$1"
  [ -s "$f" ] || return 1
  if [[ "$f" == *.gz ]]; then
    gzip -t "$f" 2>/dev/null || return 1
    [ "$(gzip -dc "$f" | head -2 | wc -l)" -ge 2 ] || return 1
  else
    [ "$(head -2 "$f" | wc -l)" -ge 2 ] || return 1
  fi
}

while IFS='|' read -r var fichier url; do
  cible="$DOSSIER/$fichier"
  tmp="$cible.nouveau"
  rm -f "$tmp"
  if curl -fsSL -R --retry 2 --max-time 300 -o "$tmp" "$url" && valide "$tmp"; then
    mv -f "$tmp" "$cible"
    etat="frais"; frais=$((frais+1))
  else
    rm -f "$tmp"
    if [ -f "$cible" ] && valide "$cible"; then
      etat="ANCIENNE COPIE"; anciens=$((anciens+1))
      echo "::warning title=Donnée du scrapeur en retard::$fichier n'a pas pu être téléchargé ; on garde la dernière bonne copie, du $(date -u -r "$cible" '+%d/%m/%Y %H:%M UTC')."
    else
      etat="ABSENT"; absents=$((absents+1))
      echo "::warning title=Donnée du scrapeur absente::$fichier : ni téléchargement ni copie. La construction ira le chercher elle-même."
    fi
  fi
  if [ -f "$cible" ]; then
    echo "$var=file://$(cd "$DOSSIER" && pwd)/$fichier" >> "$ENV_SORTIE"
    date_f=$(date -u -r "$cible" '+%d/%m/%Y %H:%M UTC')
  else
    date_f="—"
  fi
  printf '%-26s %-15s %s\n' "$fichier" "$etat" "$date_f" | tee -a "$DOSSIER/etat.txt"
done <<< "$LISTE"

echo "Bilan : $frais frais, $anciens ancienne(s) copie(s), $absents absent(s)."
[ "$frais" -gt 0 ] && echo "rafraichi=true" >> "$SORTIE" || echo "rafraichi=false" >> "$SORTIE"
exit 0
