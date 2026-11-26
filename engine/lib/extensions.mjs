// Dépôt : Leonessa2/encyclo — fichier : engine/lib/extensions.mjs  (lot 4, 26/11/2026)
//
// CE QUE LE WIKI PRÊTE AU MOTEUR. Le moteur l'importe sous le nom
// « #site/extensions » (déclaré dans package.json, champ `imports`) : c'est le
// seul chemin par lequel le moteur touche du code du site (avec « #site/socle »,
// réservé au gabarit : il ne se charge que pendant la construction). Le contrat (ce que le
// moteur peut y chercher, et ce qu'il fait si c'est absent) est dans
// moteur/LISEZMOI.md.

// Les figures de données dans les articles : `![légende](figure:id)`.
export { figureParId } from './figures.mjs';

// La recherche est-elle réelle sur ce site ? (donnée structurée SearchAction)
export { searchEnabled as rechercheActive } from './features.mjs';
// Ce site publie-t-il des prix ? (sert au titre d'accueil de secours)
export { priceEnabled as publiePrix } from './features.mjs';
