// Moteur commun — fichier : moteur/lib/plan_du_site.mjs   (partie 2b, 26/11/2026)
//
// LE PLAN DU SITE (`/sitemap.xml`). Le site le sert par une route d'une ligne :
//   src/pages/sitemap.xml.js : export const GET = () => planDuSite();
// Ce qui est commun est ici : accueil, pages légales, sections éditoriales,
// articles, étiquettes, langues et dates. Ce que seul le site connaît vient de
// « #site/extensions » (contrat : moteur/LISEZMOI.md) :
//   · dateDesDonnees()      date du jeu de données (repli des dates) ;
//   · adressesDuPlan(langs) ses adresses à lui, [{ p, langs }], placées après
//                           les sections éditoriales ;
//   · fichierDatesDuPlan()  chemin du journal des dates (voir plus bas).
// Chacun est facultatif : sans eux, le plan ne contient que le commun, daté du
// jour de la construction.
import { siteUrl, SITE } from './manifest.mjs';
import { locales, localize } from './i18n.mjs';
import { DOCS, languesLegales } from './legal.mjs';
import { activeSections, sectionMeta, languesDeSection, languesDuSite } from './editorial_pages.mjs';
import { postsFor, tagsFor, translationPaths, SEUIL_INDEX_TAG, languesBlog } from './blog.mjs';
import * as site from '#site/extensions';

// ⭐⭐ LE `lastmod` NE PEUT PAS ÊTRE « AUJOURD'HUI » POUR TOUT LE MONDE.
// Avant le 27/07 les 82 URL portaient la date du build : les mentions légales,
// inchangées depuis des mois, se déclaraient modifiées chaque matin. Un moteur
// apprend à ignorer un `lastmod` qui bouge partout tous les jours — et il ne
// vaut alors plus rien le jour où il dit vrai.
// Le journal des dates (un fichier par site, désigné par le site) donne, pour
// chaque famille et chaque adresse, la date de son dernier VRAI changement
// (empreinte du contenu, pas date de récolte). Format :
//   { "site": "<nom>", "sections": { "<famille>": { "d": "AAAA-MM-JJ" } },
//     "items": { "<adresse>": { "d": "AAAA-MM-JJ" } } }
// ⚠️ Repli volontaire sur la date du jeu de données si le fichier manque ou si
//    une clé est absente : un sitemap doit sortir, même dégradé. Le test
//    `test:lastmod` est là pour que le repli ne devienne pas la norme en
//    silence — c'est exactement ainsi qu'un défaut par repli s'installe.
import { readFileSync, existsSync } from 'node:fs';

function journalDesDates() {
  // 🔴 UN FICHIER PAR SITE, ET IL DIT À QUI IL APPARTIENT. Le 29/07/2026, un
  // seul fichier pour deux sites a donné à l'un les dates écrites pour l'autre.
  const p = typeof site.fichierDatesDuPlan === 'function' ? site.fichierDatesDuPlan() : null;
  if (!p || !existsSync(p)) {
    // ⭐ Bruyant, pas silencieux : le repli reste permis, mais il se voit dans
    //    le journal de build. Un repli muet est ce qui a cree le defaut.
    console.warn(`[sitemap] journal des dates absent (${p || 'aucun déclaré'}) — `
      + 'toutes les URL vont porter la date du jeu de données.');
    return { sections: {}, items: {} };
  }
  const d = JSON.parse(readFileSync(p, 'utf8'));
  if (d.site && d.site !== SITE) {
    // Ne peut arriver qu'en cas de fichier renomme a la main. On le dit fort :
    // publier les dates d'un autre site est pire que ne pas en publier.
    console.warn(`[sitemap] ${p} se declare appartenir a `
      + `« ${d.site} » — dates ignorees.`);
    return { sections: {}, items: {} };
  }
  const sections = Object.fromEntries(
    Object.entries(d.sections || {}).map(([k, v]) => [k, v.d]));
  const items = Object.fromEntries(
    Object.entries(d.items || {}).map(([k, v]) => [k, v.d]));
  return { sections, items };
}

export async function planDuSite() {
  const dateDonnees = typeof site.dateDesDonnees === 'function' ? await site.dateDesDonnees() : Date.now();
  const lastmod = new Date(dateDonnees).toISOString().slice(0, 10);
  const { sections: S, items: I } = journalDesDates();
  const recent = (...c) => c.filter(Boolean).sort().pop() || lastmod;

  // Chaque famille d'URL est datée par ce qui la fait VRAIMENT changer.
  const dateDe = (p) => {
    // ⭐⭐ LA DATE PROPRE À L'ADRESSE D'ABORD. Sans elle, des centaines de
    // fiches partagent une seule date de famille, qui bouge dès qu'une seule
    // bouge : autant dire « tout a changé aujourd'hui », tous les jours.
    if (I[p]) return I[p];
    if (p === '/') return recent(...Object.values(S));          // l'accueil bouge dès que quoi que ce soit bouge
    if (p.startsWith('/legal/')) return recent(S.legal);
    const sec = p.split('/')[1];
    // Une fiche d'entité affiche des chiffres calculés : elle dépend de sa
    // section ET des données. Une page d'index de section, non.
    const estFiche = p.split('/').filter(Boolean).length > 1;
    return estFiche ? recent(S[sec], S.donnees) : recent(S[sec]);
  };
  const root = siteUrl();
  const { active } = locales();
  // ⭐⭐ CHAQUE ADRESSE PORTE SES LANGUES. Avant le 28/07 le sitemap croisait
  // toutes les adresses avec `active` : le jour ou une langue etait ajoutee au
  // manifeste, il declarait /es/brands/ et /es/history/ — des URL qui ne sont
  // pas construites. Un sitemap qui liste des 404 est pire qu'un sitemap
  // incomplet : il apprend au moteur a se mefier de TOUT le fichier.
  // Une section n'est publiee que dans les langues ou elle est traduite
  // (moteur/lib/langues.mjs) ; la liste vient de la MEME fonction que les
  // routes et que les hreflang du gabarit, donc les trois ne peuvent pas
  // diverger.
  const langsSite = languesDuSite();
  const paths = [{ p: '/', langs: langsSite }];
  for (const d of DOCS) paths.push({ p: `/legal/${d}/`, langs: languesLegales(langsSite) });
  // Pages editoriales (wiki) : leurs sections actives.
  for (const sec of activeSections()) {
    paths.push({ p: sectionMeta(sec, active[0]).path, langs: languesDeSection(sec) });
  }
  // Les adresses propres au site (fiches, pages de données…), dans leurs langues.
  if (typeof site.adressesDuPlan === 'function') {
    for (const x of await site.adressesDuPlan(langsSite, active[0])) paths.push(x);
  }
  const entries = [];
  for (const { p, langs } of paths) {
    const alts = langs.map((a) => `<xhtml:link rel="alternate" hreflang="${a}" href="${root}${localize(a, p)}"/>`).join('');
    for (const l of langs) {
      entries.push(`<url><loc>${root}${localize(l, p)}</loc><lastmod>${dateDe(p)}</lastmod>${alts}</url>`);
    }
  }
  // Articles et themes : le slug DIFFERE selon la langue -> chaque entree
  // porte ses propres alternates, calcules depuis translationKey.
  // L'index d'articles n'est declare QUE dans les langues qui ont vraiment des
  // articles : ailleurs la page est en noindex, l'annoncer serait contradictoire.
  // 🔴 LOT 120 — LE PLAN DU SITE SUIT LE BLOG, PLUS `active`.
  //    `active` ne contient plus qu'`en` : ce sont les langues qui ont une
  //    adresse sur le SITE. Le blog garde `en` + `fr`. Continuer à boucler sur
  //    `active` ici aurait retiré du plan les articles français — qui EXISTENT
  //    et sont générés. ⭐⭐⭐ *Un plan du site qui omet des pages réelles est
  //    pire qu'un plan absent : il affirme que ces pages n'existent pas.*
  //    ⛔ Et l'inverse est vrai aussi : ce lot RETIRE du plan les ~9 300 URL
  //    localisées du site, parce qu'elles n'existent plus. Les deux moitiés
  //    comptent — annoncer ce qui n'existe pas, et taire ce qui existe.
  const langsBlog = await languesBlog();
  const langsAvecArticles = [];
  for (const l of langsBlog) { if ((await postsFor(l)).length) langsAvecArticles.push(l); }
  // ⭐ L'index d'articles est daté par son article le plus récent, pas par le
  // build : c'est la seule chose qui le fait vraiment changer.
  const datesArticles = [];
  for (const l of langsBlog) {
    for (const p of await postsFor(l)) {
      datesArticles.push(new Date(p.data.updated || p.data.date).toISOString().slice(0, 10));
    }
  }
  const dateBlog = datesArticles.sort().pop() || lastmod;
  for (const l of langsAvecArticles) {
    const alts = langsAvecArticles.map((a) => `<xhtml:link rel="alternate" hreflang="${a}" href="${root}${localize(a, '/blog/')}"/>`).join('');
    entries.push(`<url><loc>${root}${localize(l, '/blog/')}</loc><lastmod>${dateBlog}</lastmod>${alts}</url>`);
  }
  for (const l of langsBlog) {
    for (const p of await postsFor(l)) {
      const tp = await translationPaths(p.data.translationKey);
      const alts = Object.keys(tp).map((a) => `<xhtml:link rel="alternate" hreflang="${a}" href="${root}${localize(a, tp[a])}"/>`).join('');
      entries.push(`<url><loc>${root}${localize(l, `/blog/${p.slug}/`)}</loc><lastmod>${new Date(p.data.updated || p.data.date).toISOString().slice(0,10)}</lastmod>${alts}</url>`);
    }
    for (const x of await tagsFor(l)) {
      // ⭐⭐ MEME SEUIL QUE BlogTag.astro, ET IL EST *LU*, PAS RECOPIE.
      // Une etiquette sous le seuil est rendue en `noindex` : l'annoncer au
      // sitemap revient a demander a Google de visiter une page qu'on lui
      // interdit d'indexer. C'est le defaut mesure le 29/07/2026 (10 pages).
      // ⭐ `tagsFor` rend deja le compte (`x.n`) : aucun recalcul ici, on lit
      // la valeur d'amont. La page, elle, continue d'exister pour le lecteur.
      if (x.n < SEUIL_INDEX_TAG) continue;
      entries.push(`<url><loc>${root}${localize(l, `/blog/tag/${x.tag}/`)}</loc><lastmod>${lastmod}</lastmod></url>`);
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'content-type': 'application/xml' } });
}
