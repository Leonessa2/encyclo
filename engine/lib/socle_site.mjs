// Dépôt : Leonessa2/encyclo — fichier : engine/lib/socle_site.mjs  (lot 4, 26/11/2026)
//
// Le JavaScript commun des pages DU WIKI : le mécanisme et les morceaux
// génériques viennent du moteur (moteur/lib/socle_js.mjs, moteur/socle/) ; ce
// fichier déclare ce que le site y ajoute.
//   · servis : 40-favoris.js (⚠️ reste de veveprice, servi aujourd'hui sans
//     condition : le retirer changerait le site — au ménage du lot 7) et
//     70-figures.js (le bouton « télécharger cette figure ») ;
//   · débranchés (décision du 26/11 : gardés sur le disque jusqu'au lot 7,
//     jamais servis) : 30-membre.js, 45-alertes.js, 60-cote.js — comptes,
//     alertes et cotes de veveprice, jamais actifs sur le wiki.
// Mêmes fonctions qu'avant le rangement : socleJs(), moduleJs(nom), toutLeJs().
import { assemblerSocle } from '../../moteur/lib/socle_js.mjs';

const duSite = import.meta.glob('../../src/socle/*.js', { query: '?raw', import: 'default', eager: true });

// Lot 7 (27/11/2026) : les fichiers de veveprice (membre, favoris, alertes,
// cote) et les modules de src/socle/modules/ ont quitté le dépôt. Plus rien à
// débrancher ; la liste reste lue par le banc `entete`.
export const DEBRANCHES = [];

let cache = null;
export function socleJs() {
  if (!cache) cache = assemblerSocle({ duSite, debranches: DEBRANCHES });
  return cache;
}

export function toutLeJs() {
  return [socleJs()];
}
