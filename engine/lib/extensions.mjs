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

// ── Pages communes du moteur (partie 2b du rangement, 26/11/2026) ───────────
import { dataset } from './dataset.mjs';

// Un article cite des objets par leur identifiant (`items`) : le moteur affiche
// leur nom, leur série et un lien. Seul le wiki sait les retrouver.
export async function fichesCitees(ids) {
  const ds = await dataset();
  const parId = new Map(ds.items.map((i) => [i.uuid, i]));
  return ids.map((u) => parId.get(u)).filter(Boolean);
}

// L'illustration des pages d'erreur (404, 500) : { src, width, height, cle }.
// Lot 7 (27/11/2026) : plus d'illustration Floora (mascotte de veveprice) sur
// les pages 404 et 500 ; le moteur rend alors ces pages sans image.

// ── Plan du site (moteur/lib/plan_du_site.mjs) ─────────────────────────────
import { join } from 'node:path';
import { SITE } from '../../moteur/lib/manifest.mjs';
import { languesDeSection } from '../../moteur/lib/editorial_pages.mjs';
import { ficheSections, fichesDe, cheminFiche } from './editorial_entries.mjs';
import { priceEnabled } from './features.mjs';

// Date du jeu de données : repli des dates du plan.
export async function dateDesDonnees() { return (await dataset()).updatedAt; }

// Journal des dates, tenu par engine/tools/lastmod.py (familles éditoriales) et
// engine/tools/lastmod-prix.mjs (fiches de prix). ⚠️ process.cwd(), jamais
// import.meta.url : ce dernier ne survit pas au regroupement des fichiers par
// Astro (piège payé le 27/07 : le chemin ne résolvait plus, en silence).
export const fichierDatesDuPlan = () =>
  join(process.env.PROJECT_ROOT || process.cwd(), 'engine', 'data', `lastmod.${SITE}.json`);

// Les adresses du wiki, placées après ses sections éditoriales.
export async function adressesDuPlan(langsSite, langue) {
  const paths = [];
  // Les FICHES : une adresse par entite qui a passe le seuil, dans les langues
  // de LEUR section (meme slug partout).
  for (const sec of ficheSections()) {
    const langs = languesDeSection(sec);
    for (const f of await fichesDe(sec, langue)) paths.push({ p: cheminFiche(sec, f.slug), langs });
  }
  // Pages de PRIX : uniquement si le site en publie (jamais le wiki
  // aujourd'hui ; reste de veveprice, retiré au lot 7).
  if (priceEnabled()) {
    const ds = await dataset();
    for (const p of ['/collections/']) paths.push({ p, langs: langsSite });
    for (const i of ds.items) paths.push({ p: i.path, langs: langsSite });
    for (const c of ds.collections.values()) paths.push({ p: `/collection/${c.slug}/`, langs: langsSite });
  }
  return paths;
}
