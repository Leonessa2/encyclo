// Moteur commun — fichier : moteur/bancs/moteur-neutre.mjs   (version 0.1.0)
//
// Le moteur ne connaît AUCUN site. Ce banc échoue si un fichier de moteur/
// contient le nom, le domaine, le Sheet ou une couleur de N'IMPORTE QUEL site.
//
// D'où viennent les valeurs interdites (jamais écrites ici, sinon le banc
// s'interdirait lui-même) :
//   · sites/<site>/manifest.yml, pour chaque site : site.domain, site.brand,
//     editorial.sheet_id, et toutes les couleurs de son bloc identity ;
//   · sites/reseau.txt : les domaines et noms de tout le réseau, y compris des
//     sites qui n'ont pas encore de dossier.
// Pour chaque domaine, son nom court (« exemple » pour exemple.com) est
// interdit aussi : il sert de nom de dossier et d'option --site.
//
// Il vérifie aussi :
//   · que le moteur ne dépend que de lui-même (aucun import relatif qui sort de
//     moteur/, sauf la lecture des thèmes par import.meta.glob), et ne touche
//     au site que par ses points d'entrée déclarés (#site/extensions, #site/socle) ;
//   · que chaque site qui déclare `moteur.version` déclare celle de moteur/VERSION.
//
// Exception assumée : le blanc et le noir purs (#fff, #ffffff, #000, #000000)
// ne comptent pas comme la couleur d'un site.
//
// Usage : node moteur/bancs/moteur-neutre.mjs [racine]
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml');
const RACINE = resolve(process.argv[2] || '.');
const MOTEUR = join(RACINE, 'moteur');
const SITES = join(RACINE, 'sites');

let ko = 0;
const dit = (ok, titre, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${titre}${detail ? `   — ${detail}` : ''}`);
  if (!ok) ko++;
};

// ── 0. le banc regarde-t-il quelque chose ? ────────────────────────────────
const fichiers = [];
const parcourir = (d) => {
  for (const n of readdirSync(d)) {
    if (n === 'node_modules' || n === '__pycache__') continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) parcourir(p); else fichiers.push(p);
  }
};
if (!existsSync(MOTEUR)) { console.log('❌ pas de dossier moteur/ : banc creux'); process.exit(1); }
parcourir(MOTEUR);

const interdits = [];          // { valeur, regex, origine }
const ajouter = (valeur, origine, { mot = false } = {}) => {
  const v = String(valeur || '').trim();
  if (!v) return;
  const echappe = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\? /g, '[\\s_-]?');
  const re = mot ? new RegExp(`(?<![0-9a-z])${echappe}(?![0-9a-z])`, 'i') : new RegExp(echappe, 'i');
  interdits.push({ valeur: v, re, origine });
};
const ajouterDomaine = (d, origine) => {
  const dom = String(d || '').trim().toLowerCase();
  if (!dom) return;
  ajouter(dom, origine);
  const parties = dom.split('.');
  const court = parties.length >= 2 ? parties[parties.length - 2] : parties[0];
  ajouter(court, origine);
};

const sites = existsSync(SITES)
  ? readdirSync(SITES).filter((n) => existsSync(join(SITES, n, 'manifest.yml'))) : [];
const BLANC_NOIR = new Set(['#fff', '#ffffff', '#000', '#000000']);
let nCouleurs = 0;
for (const s of sites) {
  const m = yaml.load(readFileSync(join(SITES, s, 'manifest.yml'), 'utf8')) || {};
  const o = `sites/${s}/manifest.yml`;
  ajouter(s, o);
  ajouterDomaine(m.site?.domain, o);
  ajouter(m.site?.brand, o);
  ajouter(m.editorial?.sheet_id, o);
  const couleurs = new Set(yaml.dump(m.identity || {}).match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) || []);
  for (const c of couleurs) {
    if (BLANC_NOIR.has(c.toLowerCase())) continue;
    ajouter(c, o, { mot: true }); nCouleurs++;
  }
}
const RESEAU = join(SITES, 'reseau.txt');
let nReseau = 0;
if (existsSync(RESEAU)) {
  for (const brute of readFileSync(RESEAU, 'utf8').split('\n')) {
    const l = brute.replace(/#.*/, '').trim();
    if (!l) continue;
    nReseau++;
    if (/\s/.test(l) || !/\./.test(l)) ajouter(l, 'sites/reseau.txt');
    if (!/\s/.test(l)) ajouterDomaine(l.includes('.') ? l : `${l}.x`, 'sites/reseau.txt');
  }
}

console.log('\nle moteur est-il neutre ?');
console.log('\n0. le banc regarde-t-il vraiment quelque chose ?');
dit(fichiers.length >= 10, `${fichiers.length} fichiers dans moteur/`);
dit(sites.length >= 1, `${sites.length} site(s) lus dans sites/ (${sites.join(', ')})`);
dit(nReseau >= 10, `${nReseau} lignes lues dans sites/reseau.txt`);
dit(nCouleurs >= 5, `${nCouleurs} couleurs de sites à refuser`);

// ── 1. aucune valeur propre à un site ──────────────────────────────────────
console.log('\n1. aucun nom, domaine, Sheet ou couleur de site dans moteur/');
// ⛔ Un fichier n'est sauté QUE par son extension : un caractère nul dans un
//    fichier de code le faisait passer pour binaire, donc ignorer (0.1.0).
const BINAIRES = /\.(png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|gz|zip|pdf)$/i;
const fautes = [];
for (const f of fichiers) {
  let t;
  try { t = readFileSync(f, 'utf8'); } catch { continue; }
  if (BINAIRES.test(f)) continue;   // images, polices : pas du texte
  const lignes = t.split('\n');
  for (let i = 0; i < lignes.length; i++) {
    for (const it of interdits) {
      if (it.re.test(lignes[i])) fautes.push(`${relative(RACINE, f)}:${i + 1} « ${it.valeur} » (${it.origine})`);
    }
  }
  // le nom du fichier lui-même
  for (const it of interdits) if (it.re.test(relative(MOTEUR, f))) fautes.push(`${relative(RACINE, f)} : nom de fichier « ${it.valeur} »`);
}
dit(fautes.length === 0, fautes.length ? `${fautes.length} trace(s) trouvée(s)` : `${interdits.length} valeurs interdites, aucune trouvée`);
for (const x of fautes) console.log(`     ${x}`);

// ── 2. le moteur ne dépend que de lui-même ─────────────────────────────────
console.log('\n2. le moteur ne dépend que de lui-même');
const sorties = [];
const MOTIF = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]+)\1/g;
for (const f of fichiers.filter((x) => /\.(mjs|js|astro|ts)$/.test(x))) {
  const t = readFileSync(f, 'utf8');
  for (const m of t.matchAll(MOTIF)) {
    const cible = resolve(dirname(f), m[2]);
    if (!(cible + sep).startsWith(MOTEUR + sep)) sorties.push(`${relative(RACINE, f)} → ${m[2]}`);
  }
}
dit(sorties.length === 0, sorties.length ? `${sorties.length} import(s) hors de moteur/` : 'aucun import ne sort de moteur/');
for (const x of sorties) console.log(`     ${x}`);
// Les seuls chemins par lesquels le moteur touche du code du site : les
// points d'entrée déclarés (moteur/LISEZMOI.md), résolus par le package.json
// du site. Tout autre « #… » serait une dépendance cachée.
const ENTREES = new Set(['#site/extensions', '#site/socle']);
const autresEntrees = [];
for (const f of fichiers.filter((x) => /\.(mjs|js|astro|ts)$/.test(x))) {
  for (const m of readFileSync(f, 'utf8').matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(#[^'"]+)\1/g)) {
    if (!ENTREES.has(m[2])) autresEntrees.push(`${relative(RACINE, f)} → ${m[2]}`);
  }
}
dit(autresEntrees.length === 0, `seuls les points d'entrée déclarés du site sont utilisés (${[...ENTREES].join(', ')})`);
for (const x of autresEntrees) console.log(`     ${x}`);

// ── 3. la version déclarée par chaque site ─────────────────────────────────
console.log('\n3. la version du moteur');
const VERSION = existsSync(join(MOTEUR, 'VERSION')) ? readFileSync(join(MOTEUR, 'VERSION'), 'utf8').trim() : '';
dit(/^\d+\.\d+\.\d+$/.test(VERSION), `moteur/VERSION = « ${VERSION} »`);
for (const s of sites) {
  const m = yaml.load(readFileSync(join(SITES, s, 'manifest.yml'), 'utf8')) || {};
  const v = m.moteur?.version;
  if (v === undefined) { console.log(`  ⏸️  ${s} : n'utilise pas le moteur (pas de moteur.version)`); continue; }
  dit(String(v) === VERSION, `${s} déclare la version ${v}`, String(v) === VERSION ? '' : `moteur/VERSION dit ${VERSION}`);
}

console.log(ko ? `\n⛔ ${ko} contrôle(s) en échec.` : '\n✅ le moteur est neutre.');
process.exit(ko ? 1 : 0);
