// Moteur commun — fichier : moteur/bancs/sans-mesure.mjs
// Lancé par : outils/bancs.sh apres (lot 4, 26/11/2026)
//
// Le wiki ne mesure plus son audience (Umami retiré au lot 4). Ce banc lit le
// site construit (dist/) et échoue si une page charge encore un script de
// mesure ou appelle l'ancien relais /stats/.
// Contre-épreuve : remettre le bloc `analytics:` dans le manifeste fait
// échouer la construction elle-même ; injecter `data-website-id` dans une page
// de dist/ fait rougir ce banc.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'dist');
if (!existsSync(DIST)) { console.log('❌ pas de dossier dist/ : banc creux'); process.exit(1); }

const pages = [];
const parcourir = (d) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) parcourir(p);
    else if (n.endsWith('.html')) pages.push(p);
  }
};
parcourir(DIST);
// Le banc doit d'abord prouver qu'il regarde quelque chose.
if (pages.length < 250) { console.log(`❌ seulement ${pages.length} pages HTML : banc creux`); process.exit(1); }

const MOTIFS = [/data-website-id/i, /["'(]\/stats\//, /\bstats\.[a-z0-9-]+\.[a-z]{2,}\//i, /umami/i, /plausible/i];
const fautes = [];
for (const p of pages) {
  const t = readFileSync(p, 'utf8');
  for (const m of MOTIFS) if (m.test(t)) fautes.push(`${p.slice(DIST.length)} : ${m}`);
}
console.log(`  ${pages.length} pages HTML lues`);
if (fautes.length) {
  console.log(`  ❌ ${fautes.length} trace(s) de mesure d'audience :`);
  for (const f of fautes.slice(0, 20)) console.log(`     ${f}`);
  process.exit(1);
}
console.log('  ✅ aucune page ne charge de script de mesure');
