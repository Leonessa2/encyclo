// Moteur commun — fichier : moteur/lib/robots_txt.mjs   (partie 2b, 26/11/2026)
// Le `/robots.txt` des sites. Route du site : src/pages/robots.txt.js :
//   export const GET = () => robotsTxt();
// Lit `rechercheActive()` dans « #site/extensions » (absent = pas de recherche).
import { siteUrl } from './manifest.mjs';
import * as site from '#site/extensions';

// ⭐ ON N'INTERDIT QUE CE QUI N'EST PAS DU CONTENU, ET SEULEMENT S'IL EXISTE.
// Deux adresses sont explorables et n'apprennent rien a un moteur :
//   /api/          — routes calculees (mode serveur), jamais du contenu ;
//   /search-index.json — l'index de la recherche interne, du JSON brut.
// Chaque URL exploree pour rien est prise sur le budget d'exploration des
// ~7 900 URL qui, elles, doivent etre vues. On ne les liste que si le site les
// publie : un `Disallow` vers une adresse inexistante est du bruit.
//
// ⚠️ CORRIGE LE 30/07/2026 — la condition etait `priceEnabled() && searchEnabled()`.
// La conjonction n'avait de sens que tant que l'index n'existait QUE sur les
// sites de prix : `search-index.json` renvoyait `[]` ailleurs, donc l'interdire
// aurait ete du bruit, exactement comme le dit le commentaire ci-dessus.
// Depuis que l'index couvre l'editorial, le site à 5 langues SERT un JSON de 55 Ko — et
// avec l'ancienne condition il ne l'interdisait pas. Ce n'est pas une fuite
// (l'index est volontairement pauvre : nom, adresse, section, langue, tout
// deja public), c'est du budget d'exploration depense pour une adresse qui
// n'est pas une page, et un risque de la voir indexee comme telle.
// ⭐ La raison d'interdire n'a jamais ete « il y a des prix dedans », c'est
//    « ce n'est pas du contenu ». La condition devait donc porter sur
//    l'existence de l'index, pas sur la nature du site.
// 🔴 LOT 209 (avancé au 26/08) — LE CONTENT-SIGNAL VIT ICI DÉSORMAIS.
// Il vivait dans le robots.txt MANAGÉ de Cloudflare ; le jour où Preda a
// ouvert les robots IA (arbitrage 5 du train), le fichier managé est parti
// ENTIER — et l'interdiction d'entraînement avec lui. Mesuré le 26/08 :
// plus aucun Content-Signal servi. ⇒ on le grave dans NOTRE robots.txt,
// qui ne dépend d'aucun réglage du bord : lire et citer = oui,
// entraîner = non. Même valeur que celle que Cloudflare posait.
export async function robotsTxt() {
  const root = siteUrl();
  const interdits = ['/api/'];
  if (typeof site.rechercheActive === 'function' && site.rechercheActive()) interdits.push('/search-index.json');
  const regles = interdits.map((u) => `Disallow: ${u}`).join('\n');
  return new Response(
    `User-agent: *\nContent-Signal: search=yes,ai-train=no,use=reference\nAllow: /\n${regles}\n\nSitemap: ${root}/sitemap.xml\n`,
    { headers: { 'content-type': 'text/plain' } });
}
