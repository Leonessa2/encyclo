// Dépôt : Leonessa2/encyclo — fichier : engine/lib/contenu.mjs  (lot 4, 26/11/2026)
//
// Le contenu éditorial DU WIKI : la lecture générique vient du moteur
// (moteur/lib/editorial.mjs) ; ce fichier y ajoute ce qui est propre au wiki :
//   · la chronologie (`history`) : dates canonisées, pour un tri juste ;
//   · les fiches de marque (`brands`) : compteurs calculés depuis l'entrepôt.
// Avant le lot 4, ces deux cas étaient écrits en dur dans le moteur.
// ⛔ Les pages du wiki lisent leur contenu ICI, pas directement dans le moteur :
//    sinon les fiches de marque perdraient leurs compteurs, sans erreur.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SITE } from '../../moteur/lib/manifest.mjs';
import { collection as collectionMoteur, canonDate } from '../../moteur/lib/editorial.mjs';

export * from '../../moteur/lib/editorial.mjs';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const norm = (v) => String(v ?? '').trim();

// -----------------------------------------------------------------------------
// Compteurs Brands — depuis l'ENTREPÔT (jamais le Sheet)
// -----------------------------------------------------------------------------
let _agg = null;
/** Agrégats par licence :
 *  `{ <licence>: {n_series, n_items, first_mint, first_drop, first_drop_source} }`.
 *
 *  ⭐⭐ DEUX DATES, DEUX FAITS (corrigé le 27/07/2026) — ne pas les confondre :
 *    • `first_mint`  = 1re FRAPPE on-chain. VeVe frappe dans son coffre AVANT
 *                      d'ouvrir le drop : médiane +2 j d'avance, jusqu'à +54 j.
 *    • `first_drop`  = 1re SORTIE PUBLIQUE (catalogue). C'est CELA qu'un lecteur
 *                      appelle « premier drop », et c'est ce que confirment les
 *                      annonces datées du blog officiel (vérifié 5 fois sur 5).
 *  `first_drop` peut être `null` quand le catalogue ne prouve rien : on retombe
 *  alors sur la frappe, et `compteurs_date` le dit (cf. mergeBrandCounters).
 *
 *  Priorité à l'artefact d'entrepôt `engine/data/licence_agregats.json` (produit
 *  par `outils/construire_licence_agregats.py` côté ScrapeurVeVe) ; à défaut,
 *  calcul depuis `getCatalogue()` + `alias_series_licence.json`.
 *  Aucune valeur inventée : licence absente = null. */
export async function licenceAgregats() {
  if (_agg) return _agg;
  for (const rel of ['engine/data/licence_agregats.json',
                     `sites/${SITE}/editorial/_licence_agregats.json`]) {
    const p = join(ROOT, rel);
    if (existsSync(p)) {
      _agg = JSON.parse(readFileSync(p, 'utf8'));
      return _agg;
    }
  }
  _agg = await computeAgregats();                  // repli : recalcul depuis l'entrepôt
  return _agg;
}

async function computeAgregats() {
  const aliasPath = join(ROOT, 'engine', 'data', 'alias_series_licence.json');
  if (!existsSync(aliasPath)) {
    console.warn('[editorial] ni licence_agregats.json ni alias : compteurs Brands indisponibles.');
    return {};
  }
  const alias = JSON.parse(readFileSync(aliasPath, 'utf8'));   // { serie: [licence, ...] }
  const { getCatalogue } = await import('../../engine/data/warehouse.mjs');
  const cat = await getCatalogue();
  const agg = {};
  const seriesByLic = {};                          // licence -> Set(series)
  for (const row of cat) {
    const serie = norm(row.series);
    const lics = alias[serie] || [];
    const rd = norm(row.release_date);
    for (const lic of lics) {
      // ⚠️ Ce repli lit le CATALOGUE : sa date est donc une date de SORTIE
      // (`first_drop`), pas une frappe. On ne remplit surtout pas `first_mint`
      // avec, sinon on recrée la confusion que l'artefact vient de lever.
      const a = (agg[lic] ||= { n_series: 0, n_items: 0, first_mint: '', first_drop: '', first_drop_source: 'catalogue' });
      a.n_items += 1;
      (seriesByLic[lic] ||= new Set()).add(serie);
      if (rd && (!a.first_drop || rd < a.first_drop)) a.first_drop = rd;
    }
  }
  for (const [lic, set] of Object.entries(seriesByLic)) agg[lic].n_series = set.size;
  return agg;
}

/** Injecte premier_drop / nb_series / nb_items depuis l'entrepôt et RETIRE les
 *  colonnes `*_auto` du Sheet (elles ne font jamais foi).
 *
 *  `premier_drop` prend la SORTIE PUBLIQUE (`first_drop`) et retombe sur la
 *  FRAPPE (`first_mint`) quand le catalogue ne prouve rien. `date_nature` dit
 *  laquelle des deux est affichée — le gabarit s'en sert pour l'étiqueter, parce
 *  qu'un wiki qui donne une date doit dire de quelle date il parle. */
function mergeBrandCounters(rec, agg) {
  const out = { ...rec };
  for (const k of Object.keys(out)) {
    if (k.endsWith('_auto')) delete out[k];        // le Sheet ne compte pas
  }
  const a = agg[norm(rec.licence)] || null;
  const drop = a && a.first_drop ? a.first_drop : '';
  out.premier_drop = drop || (a ? a.first_mint || '' : '');
  out.date_nature = !a || !out.premier_drop ? '' : (drop ? 'drop' : 'mint');
  out.nb_series = a ? a.n_series : '';
  out.nb_items = a ? a.n_items : '';
  out.compteurs_source = a ? 'entrepot' : 'absent';
  return out;
}


// -----------------------------------------------------------------------------
// Ce que le wiki ajoute, page par page
// -----------------------------------------------------------------------------
async function transformerWiki(page, items) {
  // Chronologie : dates canonisees -> le tri par chaine reste juste quel que
  // soit le format d'affichage du Sheet (cf. canonDate).
  if (page === 'history') {
    return items.map((r) => ({ ...r, date: canonDate(r.date, r.precision) }));
  }
  if (page === 'brands') {
    const agg = await licenceAgregats();
    return items.map((r) => mergeBrandCounters(r, agg));
  }
  return items;
}

export async function collection(page, lang, opts = {}) {
  return collectionMoteur(page, lang, { ...opts, transformer: transformerWiki });
}

export async function items(page, lang, opts) {
  return (await collection(page, lang, opts)).items;
}

/** Réinitialise les caches (tests). */
export function _reset() { _agg = null; }
