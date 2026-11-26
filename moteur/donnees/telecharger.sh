#!/usr/bin/env bash
# Moteur commun — fichier : moteur/donnees/telecharger.sh
# Lancé par le workflow de construction du site (né au lot 3 du premier site).
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
# La LISTE est un réglage du site : sites/<site>/donnees.txt, une ligne par
# fichier « variable | fichier local | adresse », « # » = commentaire.
: "${SITE:?SITE doit désigner le dossier du site dans sites/}"
FICHIER_LISTE="${DONNEES_LISTE:-sites/$SITE/donnees.txt}"
[ -f "$FICHIER_LISTE" ] || { echo "::error::liste des données absente : $FICHIER_LISTE"; exit 1; }
LISTE=$(grep -v '^[[:space:]]*#' "$FICHIER_LISTE" | grep -v '^[[:space:]]*$')
[ -n "$LISTE" ] || { echo "::error::liste des données vide : $FICHIER_LISTE"; exit 1; }

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
