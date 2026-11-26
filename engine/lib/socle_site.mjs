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
import { assemblerSocle, empaqueter } from '../../moteur/lib/socle_js.mjs';

const duSite = import.meta.glob('../../src/socle/*.js', { query: '?raw', import: 'default', eager: true });
const modules = import.meta.glob('../../src/socle/modules/*.js', { query: '?raw', import: 'default', eager: true });

export const DEBRANCHES = ['30-membre.js', '45-alertes.js', '60-cote.js'];

let cache = null;
export function socleJs() {
  if (!cache) cache = assemblerSocle({ duSite, debranches: DEBRANCHES });
  return cache;
}

const cacheModules = new Map();
/** Un module de `src/socle/modules/` (fiches, rayons… de veveprice). Un nom
 *  inconnu LÈVE : sinon `<script src="/socle-.js">`, un 404 muet. */
export function moduleJs(nom) {
  if (cacheModules.has(nom)) return cacheModules.get(nom);
  const cle = `../../src/socle/modules/${nom}.js`;
  if (typeof modules[cle] !== 'string') {
    const dispo = Object.keys(modules).map((k) => k.split('/').pop().replace(/\.js$/, ''));
    throw new Error(`[socle-js] moduleJs('${nom}') ne désigne aucun fichier. `
      + `Modules disponibles : ${dispo.join(', ') || '(aucun)'}.`);
  }
  const v = empaqueter(modules[cle]);
  cacheModules.set(nom, v);
  return v;
}

/** Tout ce qui doit être écrit dans dist/ : le socle et TOUS les modules
 *  (un module écrit mais jamais demandé coûte quelques Ko ; un module demandé
 *  mais jamais écrit est un 404). */
export function toutLeJs() {
  const tout = [socleJs()];
  for (const cle of Object.keys(modules)) tout.push(moduleJs(cle.split('/').pop().replace(/\.js$/, '')));
  return tout;
}
