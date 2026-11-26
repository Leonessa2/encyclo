// Moteur commun — fichier : moteur/lib/flux_rss.mjs   (partie 2b, 26/11/2026)
//
// LES FLUX RSS DES ARTICLES. Le site les sert par deux routes d'une ligne :
//   src/pages/rss.xml.js           : export const GET = () => fluxPrincipal();
//   src/pages/[locale]/rss.xml.js  : getStaticPaths = languesDesFlux,
//                                    GET = ({ params }) => fluxDeLangue(params.locale)
import { postsFor, languesBlog } from './blog.mjs';
import { manifest, siteUrl } from './manifest.mjs';
import { locales, localize, t, nu, pick } from './i18n.mjs';

// 🔴🔴🔴 CORRECTIF J-1 (07/09, 18:25Z) — `nu()` AUTOUR DE CHAQUE `t()`, ET
// C'EST UN DÉFAUT SERVI QUI L'A DEMANDÉ, MESURÉ SUR LA PRODUCTION.
// ═══════════════════════════════════════════════════════════════════════════
// Le lot J a mis deux `t()` dans ce fichier. Vingt minutes après le déploiement,
// `/rss.xml` servait :
//     <title><nom du site> — ⟨sent⟩blog.title⟨sent⟩Articles⟨sent⟩</title>
// Sous `I18N_MARQUAGE=1` — que le Dockerfile pose — `t()` rend son libellé
// ENTOURÉ DE SENTINELLES et PRÉFIXÉ de sa clé. L'étape `marquer:i18n` les
// retire ensuite… **des fichiers `.html` uniquement**. Un `.xml` n'est jamais
// balayé : les sentinelles partaient telles quelles chez les lecteurs de flux.
// ⭐⭐⭐ *Ce n'est pas `t()` qui est en cause, c'est le fait de l'employer HORS
// d'une page HTML* — la même faute que `set:html={t(…)}`, par une autre porte.
// ⇒ `nu()` ici, et un banc qui balaie DÉSORMAIS les `.xml` de `dist/`.
// ⛔ Ne pas « retirer les sentinelles au build » : elles servent à `marquer:i18n`.
//
// 🔴🔴 LOT J, POINT A-⑧ — LE FLUX NE PORTE PLUS LA PROMESSE DU SITE.
// ═══════════════════════════════════════════════════════════════════════════
// Il servait `site.tagline` en `<description>` : « The VeVe catalogue, with
// floor price tracking for members ». Un flux RSS ne contient QUE des articles
// — aucun montant, aucun suivi de plancher — et le HTML public n'en contient
// pas davantage. La promesse était donc fausse à l'endroit exact où elle est
// la plus difficile à reprendre : ⭐⭐ **un flux est RECOPIÉ par des
// agrégateurs qui ne repasseront pas.** Une description corrigée dans six mois
// resterait fausse chez eux pour toujours.
// ⭐ Le titre du canal gagne « — Articles » pour la même raison : le nom du site
//   tout seul, dans un lecteur de flux, laisse croire que tout le site y passe.
// ⛔ `pick(m.site.tagline)` n'est PAS remplacé par une chaîne écrite ici : la
//    description du flux est une clé i18n, donc traduite dans les cinq langues
//    comme le reste. Une chaîne nue serait sortie en anglais partout (P30).

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function fluxPrincipal() {
  const m = manifest();
  const root = siteUrl();
  const lang = locales().def;
  const posts = await postsFor(lang);
  const items = posts.map((p) => `<item><title>${esc(p.data.title)}</title><link>${root}${localize(lang, `/blog/${p.slug}/`)}</link><guid isPermaLink="true">${root}${localize(lang, `/blog/${p.slug}/`)}</guid><pubDate>${new Date(p.data.date).toUTCString()}</pubDate><description>${esc(p.data.description)}</description></item>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(m.site.brand)} — ${esc(nu(t(lang, 'blog.title')))}</title>
<link>${root}${localize(lang, '/blog/')}</link>
<description>${esc(nu(t(lang, 'blog.feed.desc')))}</description>
<language>${lang}</language>
<atom:link href="${root}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>
`;
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
}

// Un flux RSS sans le moindre article est un fichier que des lecteurs vont
// interroger tous les jours pour rien. Meme regle que l'index.
export async function languesDesFlux() {
  const { def } = locales();
  return (await languesBlog()).filter((l) => l !== def).map((l) => ({ params: { locale: l } }));
}

export async function fluxDeLangue(lang) {
  const m = manifest();
  const root = siteUrl();
  const posts = await postsFor(lang);
  const items = posts.map((p) => `<item><title>${esc(p.data.title)}</title><link>${root}${localize(lang, `/blog/${p.slug}/`)}</link><guid isPermaLink="true">${root}${localize(lang, `/blog/${p.slug}/`)}</guid><pubDate>${new Date(p.data.date).toUTCString()}</pubDate><description>${esc(p.data.description)}</description></item>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(m.site.brand)}</title>
<link>${root}${localize(lang, '/blog/')}</link>
<description>${esc(pick(m.site.tagline, lang))}</description>
<language>${lang}</language>
<atom:link href="${root}/${lang}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>
`;
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
}
