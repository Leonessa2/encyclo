// Dépôt : Leonessa2/encyclo — fichier : engine/lib/visuels_wiki.mjs  (28/11/2026)
// ═══════════════════════════════════════════════════════════════════════════
// LES VISUELS DU WIKI : quelques pièces phares par licence, résolues au build
// ═══════════════════════════════════════════════════════════════════════════
// Le wiki n'a pas de pages d'objets ; il montre des pièces pour INCARNER une
// licence, un palier de rareté, l'accueil. Ce fichier tient la liste COURTE
// et éditoriale de ces pièces, par leur NOM tel que le catalogue l'écrit.
//
// ⛔ L'adresse d'une image ne se devine pas (second identifiant, suffixe) :
// elle vient de l'index des vignettes déposé par le build
// (`lireVignettes()`, engine/lib/vignettes.mjs). Une pièce renommée ou sortie
// du catalogue n'est simplement pas affichée — jamais d'image cassée.
// ⭐ Les visuels sont servis par le CDN de VeVe, comme sur veveprice.
import { lireVignettes } from './vignettes.mjs';
import { sourcesImage } from './image_cdn.mjs';

/** Pièces phares par licence (clé = `licence` du Sheet des marques). */
export const PIECES_PAR_LICENCE = {
  marvel: ['Spider-Man Noir', 'Iron Man - Marvel Metallic Red', 'Spider-Man: Miles Morales - Animated', 'Deadpool – Ultimate Animated', 'Wolverine - Primal Strike'],
  'star-wars': ['Darth Vader Samurai - Wrath of the Dragon', 'Yoda - One With The Force'],
  disney: ['Stitch', 'Mickey Mouse Poster'],
  pixar: ['Buzz Lightyear – Wings Deployed', 'Nemo'],
  dc: ['#01 Eduardo Risso Batman', '#100 Todd McFarlane Batman'],
  '007': ['No Time To Die — Aston Martin DB5 (007 Interactive)'],
  ghostbusters: ['Ghostbusters I Logo - Platinum'],
};

/** Le mur de l'accueil, et la rotation de la « pièce du jour ». */
export const MUR_ACCUEIL = [
  'Darth Vader Samurai - Wrath of the Dragon', 'Stitch', 'Spider-Man Noir', 'Yoda - One With The Force',
  'Buzz Lightyear – Wings Deployed', 'Iron Man - Marvel Metallic Red', 'Mickey Mouse Poster',
  'Deadpool – Ultimate Animated', 'Nemo', 'Wolverine - Primal Strike', 'Ghostbusters I Logo - Platinum',
  '#01 Eduardo Risso Batman',
];
export const PIECE_DU_JOUR = [
  ['Spider-Man Noir', 'marvel'], ['Darth Vader Samurai - Wrath of the Dragon', 'star-wars'], ['Stitch', 'disney'],
  ['#01 Eduardo Risso Batman', 'dc'], ['Buzz Lightyear – Wings Deployed', 'pixar'], ['Yoda - One With The Force', 'star-wars'],
  ['Ghostbusters I Logo - Platinum', 'ghostbusters'], ['Iron Man - Marvel Metallic Red', 'marvel'],
];

/** Libellés des paliers et des éditions : le vocabulaire de VeVe, en anglais
 *  dans toutes les langues (ce sont les noms que l'app affiche). */
export const RARETE = { COMMON: 'Common', UNCOMMON: 'Uncommon', RARE: 'Rare', ULTRA_RARE: 'Ultra Rare', SECRET_RARE: 'Secret Rare', ARTIST_PROOF: 'Artist Proof' };
export const EDITION = { FE: 'First Edition', FA: 'First Appearance', CE: 'Con Exclusive' };

let parNom = null;
function index() {
  if (parNom) return parNom;
  parNom = new Map();
  for (const v of Object.values(lireVignettes())) {
    if (v && v.name && v.image && !parNom.has(v.name)) parNom.set(v.name, v);
  }
  return parNom;
}

/** Une pièce par son nom exact, prête à afficher ; `null` si absente. */
export function piece(nom) {
  const v = index().get(nom);
  if (!v) return null;
  return {
    nom: v.name,
    image: v.image,
    rarete: RARETE[v.rarity] || null,
    cleRarete: v.rarity || null,
    edition: EDITION[v.edition_type] || null,
  };
}

/** Les pièces phares d'une licence, dans l'ordre éditorial. */
export function piecesDe(licence, max = 5) {
  return (PIECES_PAR_LICENCE[licence] || []).map(piece).filter(Boolean).slice(0, max);
}

/** Les pièces d'une liste de noms, sans les absentes. */
export function pieces(noms) {
  return noms.map(piece).filter(Boolean);
}

/** `srcset` en largeurs : la vignette du CDN (132 px) et la grande image
 *  (660 px). Le navigateur prend la plus petite qui suffit — sur téléphone,
 *  une tuile de 80 px ne télécharge plus 30 Ko mais 5. `null` si le CDN
 *  n'offre pas de vignette pour cette famille d'image. */
export function srcsetPiece(url) {
  const v = sourcesImage(url, 60);
  return v.src && v.src !== url ? `${v.src} 132w, ${url} 660w` : null;
}

/** L'éventail de la bannière de chaque rubrique (ordinateur) : quatre pièces,
 *  les deux du milieu cerclées d'or. Mêmes règles : par NOM, absentes omises. */
export const BANNIERES = {
  glossary: ['Spider-Man Noir', '#01 Eduardo Risso Batman', 'Stitch', 'Yoda - One With The Force'],
  acronyms: ['Iron Man - Marvel Metallic Red', 'Ghostbusters I Logo - Platinum', 'Nemo', 'Wolverine - Primal Strike'],
  annuaire: ['Deadpool – Ultimate Animated', 'Mickey Mouse Poster', 'Buzz Lightyear – Wings Deployed', 'Spider-Man: Miles Morales - Animated'],
  history: ['#01 Eduardo Risso Batman', '#100 Todd McFarlane Batman', 'Darth Vader Samurai - Wrath of the Dragon', 'Stitch'],
  brands: ['Spider-Man Noir', 'Darth Vader Samurai - Wrath of the Dragon', 'Stitch', 'Buzz Lightyear – Wings Deployed'],
};
export function piecesBanniere(section) {
  return pieces(BANNIERES[section] || []).slice(0, 4);
}
