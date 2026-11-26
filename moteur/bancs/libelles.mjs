// Moteur commun — fichier : moteur/bancs/libelles.mjs   (moteur 0.6.0)
// Lancé par : outils/bancs.sh avant (rangement 2c, 26/11/2026)
//
// Les libellés d'interface vivent en deux endroits :
//   · moteur/i18n/<langue>.json — ceux que le moteur demande ET sait écrire
//     (texte qui ne parle d'aucun site : « Menu », « Accueil »…) ;
//   · le dictionnaire du site (réglage `moteur.dictionnaires` du manifeste) —
//     tout le reste, dont les libellés que le moteur demande sans pouvoir les
//     écrire, listés dans moteur/i18n/a-fournir.txt.
// `dict()` (moteur/lib/i18n.mjs) lit le moteur puis le site par-dessus.
//
// Ce banc vérifie, sans construire le site :
//   1. les fichiers du moteur sont lisibles et ont les mêmes clés dans toutes
//      ses langues, sans texte vide ;
//   2. chaque libellé demandé par le code du moteur est soit dans
//      moteur/i18n/, soit dans a-fournir.txt — et jamais dans les deux ;
//   3. le moteur ne garde aucun libellé qu'il ne demande plus ;
//   4. le site (variable SITE) fournit, dans chacune de ses langues
//      d'interface, tous les libellés de a-fournir.txt, et le moteur a ses
//      libellés dans ces mêmes langues ;
//   5. il affiche (sans échouer) les libellés du moteur que le site reformule.
// Un libellé absent ne casse pas la construction : le visiteur lirait le nom
// de la clé (« nav.menu ») à la place du texte. C'est ce que ce banc empêche.
//
// Usage : SITE=<site> node moteur/bancs/libelles.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const RACINE = process.env.PROJECT_ROOT || process.cwd();
const MOTEUR = join(RACINE, 'moteur');
const DOSSIER_M = join(MOTEUR, 'i18n');

let ko = 0;
const dit = (ok, titre, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${titre}${detail ? `   — ${detail}` : ''}`);
  if (!ok) ko++;
};
const lireJson = (f) => JSON.parse(readFileSync(f, 'utf8'));

// ── 1. Les fichiers du moteur ────────────────────────────────────────────────
console.log('\n1. Les libellés du moteur');
const languesM = existsSync(DOSSIER_M)
  ? readdirSync(DOSSIER_M).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort()
  : [];
dit(languesM.length > 0, 'moteur/i18n/ contient des langues', languesM.join(', ') || 'aucune');
const dicM = {};
for (const l of languesM) {
  try { dicM[l] = lireJson(join(DOSSIER_M, `${l}.json`)); dit(true, `${l}.json lisible`, `${Object.keys(dicM[l]).length} libellés`); }
  catch (e) { dit(false, `${l}.json lisible`, e.message); dicM[l] = {}; }
}
const clesM = new Set(Object.values(dicM).flatMap((d) => Object.keys(d)));
for (const l of languesM) {
  const manque = [...clesM].filter((k) => !(k in dicM[l]));
  const vides = Object.entries(dicM[l]).filter(([, v]) => typeof v !== 'string' || v.trim() === '').map(([k]) => k);
  dit(manque.length === 0 && vides.length === 0, `${l}.json : toutes les clés, aucun texte vide`,
    [manque.length ? `manque ${manque.join(', ')}` : '', vides.length ? `vide ${vides.join(', ')}` : ''].filter(Boolean).join(' · '));
}

const fichierAF = join(DOSSIER_M, 'a-fournir.txt');
const aFournir = existsSync(fichierAF)
  ? readFileSync(fichierAF, 'utf8').split('\n').map((x) => x.replace(/#.*/, '').trim()).filter(Boolean)
  : null;
dit(aFournir !== null, 'moteur/i18n/a-fournir.txt existe', aFournir ? `${aFournir.length} libellés à fournir par le site` : 'absent');
const setAF = new Set(aFournir || []);
const doublesAF = (aFournir || []).filter((k, i, a) => a.indexOf(k) !== i);
dit(doublesAF.length === 0, 'a-fournir.txt : aucune clé en double', doublesAF.join(', '));

// ── 2. Ce que le code du moteur demande ──────────────────────────────────────
console.log('\n2. Les libellés demandés par le code du moteur');
const sources = [];
const parcourir = (d) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { if (n !== 'bancs' && n !== 'node_modules') parcourir(p); }
    else if (/\.(astro|mjs|js)$/.test(n)) sources.push(p);
  }
};
parcourir(MOTEUR);
// Les commentaires citent des clés d'autres sites (« t(lang,'analytics.title') ») :
// on les retire avant de lire. `//` n'est un commentaire qu'en début de ligne
// ou après un blanc (une adresse « https:// » n'est pas coupée).
const sansCommentaires = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/(^|[\s;{}(])\/\/.*$/gm, '$1');

// Le vocabulaire connu (moteur + site) sert à reconnaître une clé écrite hors
// d'un appel `t()` (ex. moteur/lib/feuille_theme.mjs : 'theme.toDark').
const SITE = process.env.SITE || '';
let dossierSite = null;
let languesSite = [];
let erreurSite = '';
if (!SITE) erreurSite = 'variable SITE absente';
else {
  try {
    const I18N = await import(join(MOTEUR, 'lib', 'i18n.mjs'));
    dossierSite = I18N.dossierDictionnaires();
    languesSite = I18N.languesInterface();
  } catch (e) { erreurSite = e.message; }
}
const dicS = {};
for (const l of languesSite) {
  try { dicS[l] = lireJson(join(dossierSite, `${l}.json`)); }
  catch (e) { dicS[l] = null; }
}
const vocab = new Set([...clesM, ...setAF, ...Object.values(dicS).flatMap((d) => Object.keys(d || {}))]);

// Clés que le moteur COMPARE sans les afficher : elles désignent une entrée
// que le site écrit lui-même. `nav.blog` = l'entrée « articles » du menu du
// manifeste (`nav:`), que moteur/gabarits/Page.astro masque dans les langues
// sans articles. Son texte est un libellé du menu du site.
const COMPAREES = new Set(['nav.blog']);

const demandes = new Map();      // clé -> fichiers
const gabarits = new Map();      // préfixe dynamique (`x.${…}`) -> fichiers
const noter = (m, k, f) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(relative(RACINE, f)); };
for (const f of sources) {
  const s = sansCommentaires(readFileSync(f, 'utf8'));
  for (const m of s.matchAll(/\bt\(\s*[\w$.]+\s*,\s*(['"`])([^'"`]+)\1/g)) {
    if (m[1] === '`' && m[2].includes('${')) noter(gabarits, m[2].split('${')[0], f);
    else noter(demandes, m[2], f);
  }
  for (const m of s.matchAll(/(['"])([a-z][\w]*(?:\.[\w]+)+)\1/g)) {
    if (vocab.has(m[2]) && !COMPAREES.has(m[2])) noter(demandes, m[2], f);
  }
}
// Les clés composées : `legal.desc.${doc}` -> une par page légale du moteur.
for (const [pref, ou] of gabarits) {
  if (pref === 'legal.desc.') {
    const docs = new Set(Object.keys(lireJson(join(MOTEUR, 'legal', 'en.json'))).map((k) => k.split('.')[0]));
    for (const d of docs) for (const f of ou) noter(demandes, `${pref}${d}`, join(RACINE, f));
    dit(docs.size > 0, `« ${pref}\${…} » : une clé par page légale du moteur`, [...docs].sort().join(', '));
  } else {
    dit(false, `« ${pref}\${…} » : clé composée que ce banc ne sait pas déplier`, [...ou].join(', '));
  }
}
dit(demandes.size > 10, `${demandes.size} libellés demandés, lus dans ${sources.length} fichiers du moteur`);

const orphelines = [...demandes.keys()].filter((k) => !clesM.has(k) && !setAF.has(k));
dit(orphelines.length === 0, 'chaque libellé demandé est dans moteur/i18n/ ou dans a-fournir.txt',
  orphelines.map((k) => `${k} (${[...demandes.get(k)].join(', ')})`).join(' · '));
const lesDeux = [...clesM].filter((k) => setAF.has(k));
dit(lesDeux.length === 0, 'aucun libellé à la fois écrit par le moteur et laissé au site', lesDeux.join(', '));

// ── 3. Rien de mort dans le moteur ───────────────────────────────────────────
console.log('\n3. Le moteur ne garde que ce qu\'il demande');
const mortsM = [...clesM].filter((k) => !demandes.has(k));
dit(mortsM.length === 0, 'aucun libellé de moteur/i18n/ sans demandeur', mortsM.join(', '));
const mortsAF = [...setAF].filter((k) => !demandes.has(k));
dit(mortsAF.length === 0, 'aucune ligne de a-fournir.txt sans demandeur', mortsAF.join(', '));

// ── 4. Le site fournit sa part ───────────────────────────────────────────────
console.log(`\n4. Le site « ${SITE || '?'} » fournit sa part`);
dit(!erreurSite, 'réglages du site lus', erreurSite || `dictionnaire : ${relative(RACINE, dossierSite)} · langues d'interface : ${languesSite.join(', ')}`);
for (const l of languesSite) {
  const d = dicS[l];
  if (!d) { dit(false, `${l}.json du site lisible`); continue; }
  const manque = [...setAF].filter((k) => typeof d[k] !== 'string' || d[k].trim() === '');
  dit(manque.length === 0, `${l} : le site écrit les ${setAF.size} libellés à fournir`, manque.join(', '));
  dit(languesM.includes(l), `${l} : le moteur a ses libellés dans cette langue`,
    languesM.includes(l) ? '' : `moteur/i18n/${l}.json absent : ${clesM.size} libellés retomberaient en langue par défaut`);
}

// ── 5. Reformulations (information) ──────────────────────────────────────────
const reform = [];
for (const l of languesSite) for (const k of clesM) if (dicS[l] && k in dicS[l]) reform.push(`${l}:${k}`);
console.log(`\n5. Libellés du moteur reformulés par le site : ${reform.length}${reform.length ? ` (${reform.join(', ')})` : ''}`);

console.log('');
if (ko) { console.log(`❌ libellés : ${ko} contrôle(s) en échec`); process.exit(1); }
console.log(`✅ libellés : moteur ${clesM.size} · à fournir par le site ${setAF.size} · tout est en place`);
