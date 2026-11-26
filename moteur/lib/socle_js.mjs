// Moteur commun — fichier : moteur/lib/socle_js.mjs   (version 0.3.0)
// ═══════════════════════════════════════════════════════════════════════════
// LE JAVASCRIPT COMMUN DES PAGES — UN FICHIER, UNE FOIS, POUR TOUTES LES PAGES
// ═══════════════════════════════════════════════════════════════════════════
//
// Les petits scripts de toutes les pages sont assemblés en UN fichier, nommé
// d'après l'empreinte de son contenu (`/socle-<empreinte>.js`, gardé longtemps
// en cache) : un visiteur qui lit trois pages ne télécharge ce code qu'une fois.
// C'est le jumeau de `feuille_theme.mjs` (même chemin pour le CSS).
//
// QUI APPORTE QUOI :
//   · le moteur : `moteur/socle/*.js` (contact, menu, libellés, langue,
//     suggestion de langue) et leurs conditions (`CONDITIONS_MOTEUR`) ;
//   · le site : ses propres morceaux et leurs conditions, et la liste de ceux
//     qu'il garde sur le disque SANS les servir (`debranches`). Il appelle
//     `assemblerSocle()` et rend le résultat au moteur par `#site/extensions`
//     (fonction `socleJs`).
// L'ORDRE est celui des noms de fichiers (préfixes numériques : 10-, 20-…),
// morceaux du moteur et du site mêlés.
//
// ⛔ Deux scripts du gabarit ne sont PAS ici, et ce n'est pas un oubli : ceux
//    qui posent un attribut AVANT la première peinture (thème jour/nuit). Les
//    sortir rendrait leur effet dépendant d'une requête réseau : l'éclair blanc
//    au premier chargement revient.
// ⛔ `import.meta.glob` et non `readFileSync` : le texte est cousu dans le
//    paquet à la construction, et ne dépend d'aucun fichier présent plus tard.
// ⛔ Pas de repli silencieux : un nom inconnu, un doublon ou un débranché qui
//    n'existe pas LÈVENT. Un morceau perdu en silence, c'est une page qui
//    s'affiche parfaitement avec un bouton mort.

import { createHash } from 'node:crypto';
import { langueUiDansEntete } from './i18n.mjs';

const duMoteur = import.meta.glob('../socle/*.js', { query: '?raw', import: 'default', eager: true });

/** Les conditions des morceaux du moteur : absent = toujours servi. */
export const CONDITIONS_MOTEUR = {
  '55-langue.js': () => langueUiDansEntete(),
};

const nomDe = (cle) => cle.split('/').pop();

/** Un texte JS -> son nom de fichier servi. */
export function empaqueter(js) {
  const empreinte = createHash('sha256').update(js).digest('hex').slice(0, 12);
  return { empreinte, nom: `socle-${empreinte}.js`, href: `/socle-${empreinte}.js`, js, octets: Buffer.byteLength(js) };
}

/**
 * Assemble le socle d'un site.
 * @param {object} o
 * @param {Record<string,string>} o.duSite     glob `?raw` des morceaux du site (clé = chemin, valeur = texte)
 * @param {Record<string,Function>} o.conditions  conditions des morceaux du site (nom de fichier -> () => bool)
 * @param {string[]} o.debranches             morceaux du site gardés sur le disque, jamais servis
 */
export function assemblerSocle({ duSite = {}, conditions = {}, debranches = [] } = {}) {
  const moteur = Object.fromEntries(Object.entries(duMoteur).map(([k, v]) => [nomDe(k), v]));
  const site = Object.fromEntries(Object.entries(duSite).map(([k, v]) => [nomDe(k), v]));
  if (!Object.keys(moteur).length) throw new Error('[socle-js] aucun morceau du moteur (moteur/socle/) : motif du glob à revoir.');

  const doublons = Object.keys(site).filter((n) => n in moteur);
  if (doublons.length) throw new Error(`[socle-js] morceau(x) présent(s) dans le moteur ET dans le site : ${doublons.join(', ')}.`);
  const fantomes = debranches.filter((n) => !(n in site));
  if (fantomes.length) throw new Error(`[socle-js] débranché(s) introuvable(s) dans le site : ${fantomes.join(', ')}.`);
  const condInconnues = Object.keys(conditions).filter((n) => !(n in site));
  if (condInconnues.length) throw new Error(`[socle-js] condition(s) pour un morceau absent : ${condInconnues.join(', ')}.`);
  for (const [n, v] of [...Object.entries(moteur), ...Object.entries(site)]) {
    if (typeof v !== 'string') throw new Error(`[socle-js] ${n} : le glob ne rend pas de texte. Motif du glob à revoir.`);
  }

  const toutes = { ...CONDITIONS_MOTEUR, ...conditions };
  const morceaux = [];
  const retenus = [];
  for (const nom of [...Object.keys(moteur), ...Object.keys(site)].sort()) {
    if (debranches.includes(nom)) continue;
    const cond = toutes[nom];
    if (cond && !cond()) continue;
    morceaux.push(nom in moteur ? moteur[nom] : site[nom]);
    retenus.push(nom);
  }
  return { ...empaqueter(morceaux.join(';\n')), morceaux: retenus };
}
