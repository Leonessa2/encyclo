// =============================================================================
//  test_menu_ouvert.mjs — AUCUNE MARQUE i18n À L'ÉCRAN, MENU OUVERT
//  Dépôt : Leonessa2/encyclo — engine/tools/test_menu_ouvert.mjs  (28/11/2026)
//      SITE=vevewiki npm run test:menu-ouvert      (après build + marquer:i18n)
//
//  Pourquoi ce banc. Le tiroir du téléphone (src/socle/82-tiroir.js) est
//  complété au PREMIER toucher du bouton menu : son texte n'existe pas dans le
//  HTML servi, et aucun banc qui lit `dist/` ne le voit. Le 28/11 il recopiait
//  l'`aria-label` de la bascule du moteur, posé à l'exécution depuis
//  `define:vars` — où les sentinelles i18n (U+0011..U+0013) deviennent du
//  TEXTE que `marquer_i18n` ne retire pas. Résultat à 375 px, en anglais :
//  « \u0011theme.toDark\u0012Switch to dark mode\u0013 » dans le menu.
//
//  Ce que le banc fait, pour chaque langue et quelques pages par langue :
//  ① exécute les scripts de la page (en ligne, puis le socle `defer`) dans un
//    DOM linkedom ; ② ouvre le menu (pointerdown + clic sur #menu-b) ;
//  ③ actionne le bouton Apparence du tiroir (le libellé change) ;
//  ④ refuse toute sentinelle — caractère brut OU échappement « \u0011 » —
//    dans le texte de la page et dans les attributs lus ou affichés
//    (aria-label, title, placeholder, alt).
//  ⛔ Un menu qui ne se complète pas est un ÉCHEC, pas un succès silencieux :
//    un banc qui n'ouvre rien ne mesure rien.
// =============================================================================
import process from 'node:process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));
const DIST = join(RACINE, 'dist');
const LANGUES = ['en', 'fr', 'es', 'it', 'de'];
const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
// Une sentinelle brute, ou son échappement JSON / JS resté en texte.
const SENTINELLE = /[\u0011-\u0013]|\\u001[123]|\\x1[123]/;

let ok = 0, ko = 0;
const dit = (b, quoi, detail = '') => {
  if (b) { ok += 1; console.log(`  ✅ ${quoi}`); }
  else { ko += 1; console.log(`  ❌ ${quoi}${detail ? ` — ${detail}` : ''}`); }
};
const fin = () => {
  console.log(`\n${ko === 0 ? '✅ menu ouvert : aucune marque i18n à l\'écran' : `❌ ${ko} contrôle(s) en échec`} (${ok + ko} contrôles)\n`);
  process.exit(ko === 0 ? 0 : 1);
};

let parseHTML;
try { ({ parseHTML } = await import('linkedom')); } catch { /* absent */ }
if (!parseHTML) { console.log('  ❌ linkedom absent — `npm i -D linkedom`'); process.exit(1); }
if (!existsSync(DIST)) { console.log('  ❌ dist/ absent — construire le site d\'abord'); process.exit(1); }

/** Ce qu'un lecteur voit ou entend : le texte, et les attributs affichés / lus. */
function marquesVisibles(document) {
  const vus = [];
  // Le texte AFFICHÉ : sans le contenu des <script>, <style>, <template>,
  // <noscript> du <body>, qu'aucun lecteur ne voit (le moteur y garde ses
  // libellés en JSON : c'est la source du défaut, pas son affichage).
  let texte = '';
  if (document.body) {
    const copie = document.body.cloneNode(true);
    for (const e of copie.querySelectorAll('script, style, template, noscript')) e.remove();
    texte = copie.textContent;
  }
  const m = SENTINELLE.exec(texte);
  if (m) vus.push(`texte : « ${JSON.stringify(texte.slice(Math.max(0, m.index - 30), m.index + 50)).slice(1, -1)} »`);
  for (const a of ATTRS) {
    for (const e of document.querySelectorAll(`[${a}]`)) {
      const v = e.getAttribute(a) || '';
      if (SENTINELLE.test(v)) vus.push(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}[${a}] : « ${JSON.stringify(v).slice(1, -1).slice(0, 80)} »`);
    }
  }
  return vus;
}

console.log('\n0. Le détecteur n\'est pas aveugle (contre-épreuves fabriquées)');
{
  const { document } = parseHTML('<html><body><p>ok</p><button aria-label="Switch">x</button></body></html>');
  dit(marquesVisibles(document).length === 0, 'témoin propre : rien de signalé');
  document.querySelector('p').textContent = '\u0011theme.toDark\u0012Switch to dark mode\u0013';
  dit(marquesVisibles(document).length === 1, 'sentinelle BRUTE dans le texte : signalée');
  document.querySelector('p').textContent = 'ok';
  document.querySelector('button').setAttribute('aria-label', '\\u0011theme.toDark\\u0012Switch\\u0013');
  dit(marquesVisibles(document).length === 1, 'sentinelle ÉCHAPPÉE dans un aria-label : signalée');
}

/** Les pages jugées dans une langue : accueil, rubriques, blog, un article. */
function pagesDe(lang) {
  const pre = lang === 'en' ? '' : `/${lang}`;
  const chemins = ['/', '/glossary/', '/brands/', '/history/', '/blog/'];
  const blog = join(DIST, ...pre.split('/').filter(Boolean), 'blog');
  if (existsSync(blog)) {
    const art = readdirSync(blog, { withFileTypes: true }).find((d) => d.isDirectory() && d.name !== 'tag');
    if (art) chemins.push(`/blog/${art.name}/`);
  }
  return chemins.map((c) => ({ url: pre + c, f: join(DIST, ...(pre + c).split('/').filter(Boolean), 'index.html') }))
    .filter((p) => existsSync(p.f));
}

/** Les scripts de la page, dans l'ordre du navigateur : en ligne, puis `defer`. */
function scriptsDe(document) {
  const enLigne = [], differes = [];
  for (const s of document.querySelectorAll('script')) {
    const type = s.getAttribute('type');
    if (type && !/javascript|module/.test(type)) continue;   // ld+json & co
    const src = s.getAttribute('src');
    if (!src) { enLigne.push(s.textContent); continue; }
    if (!/^\/socle-[a-f0-9]+\.js$/.test(src)) continue;        // mesure & co : pas les nôtres
    const f = join(DIST, src.slice(1));
    if (existsSync(f)) differes.push(readFileSync(f, 'utf8'));
  }
  return [...enLigne, ...differes];
}

async function ouvrir(url, html) {
  const { document, window } = parseHTML(html);
  Object.defineProperty(document, 'cookie', { get: () => '', set: () => {}, configurable: true });
  const stockage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const location = { pathname: url, search: '', hash: '', href: 'https://vevewiki.com' + url };
  const media = () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  window.matchMedia = media; window.location = location; window.localStorage = stockage;
  const navigator = { language: 'en-US', languages: ['en-US'], userAgent: 'banc' };
  // L'index de recherche est servi depuis dist/ ; le reste répond 404.
  const fetch = (u) => {
    const f = join(DIST, String(u).replace(/^\//, '').split('?')[0]);
    if (/search-index\.json$/.test(String(u)) && existsSync(f)) {
      const corps = readFileSync(f, 'utf8');
      return Promise.resolve({ ok: true, status: 200, text: async () => corps, json: async () => JSON.parse(corps) });
    }
    return Promise.resolve({ ok: false, status: 404, text: async () => '', json: async () => ({}) });
  };
  // linkedom n'a pas <dialog>.showModal : la recherche du moteur s'en passerait.
  const palette = document.getElementById('palette');
  if (palette) {
    palette.showModal = function () { this.setAttribute('open', ''); };
    palette.close = function () { this.removeAttribute('open'); };
  }
  for (const src of scriptsDe(document)) {
    try {
      new Function('window', 'document', 'localStorage', 'location', 'navigator', 'fetch', 'matchMedia', src)(
        window, document, stockage, location, navigator, fetch, media);
    } catch { /* un script du moteur peut exiger le vrai navigateur : seul le résultat compte */ }
  }
  document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await new Promise((r) => setTimeout(r, 10));
  const bouton = document.getElementById('menu-b');
  if (bouton) {
    bouton.dispatchEvent(new window.Event('pointerdown'));
    bouton.dispatchEvent(new window.Event('click', { bubbles: true }));
  }
  await new Promise((r) => setTimeout(r, 10));
  return { document, window, bouton };
}

let pagesVues = 0, marquees = 0;
for (const lang of LANGUES) {
  console.log(`\n${lang.toUpperCase()} — menu ouvert`);
  const pages = pagesDe(lang);
  dit(pages.length >= 5, `${pages.length} page(s) trouvée(s) dans dist/`);
  for (const p of pages) {
    const html = readFileSync(p.f, 'utf8');
    if (html.includes('data-i18n')) marquees += 1;
    const { document, window, bouton } = await ouvrir(p.url, html);
    pagesVues += 1;
    const tiroir = document.getElementById('menu-m');
    const rempli = !!(tiroir && tiroir.querySelector('.tiroir__tete'));
    dit(!!bouton && rempli, `${p.url} : le menu s'ouvre et le tiroir est complété`,
      !bouton ? 'pas de bouton #menu-b' : 'tiroir jamais complété (82-tiroir.js)');
    let vus = marquesVisibles(document);
    // Le libellé Apparence change quand on bascule : on le relit après.
    const theme = tiroir && tiroir.querySelector('.tiroir__theme');
    if (theme) {
      theme.dispatchEvent(new window.Event('click', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 10));
      vus = vus.concat(marquesVisibles(document).map((v) => 'après bascule, ' + v));
    }
    dit(vus.length === 0, `${p.url} : aucune marque i18n à l'écran ni dans un attribut lu`, vus.slice(0, 3).join(' · '));

    // La recherche de l'en-tête, sans résultat : son message est un libellé
    // du moteur posé à l'exécution — le même chemin que le défaut du tiroir.
    const declencheur = document.querySelector('[data-ouvrir-palette]');
    const champ = document.getElementById('palette-q');
    const resultats = document.getElementById('palette-r');
    if (declencheur && champ && resultats) {
      declencheur.dispatchEvent(new window.Event('click', { bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 20));
      champ.value = 'zqxjwvkq';
      champ.dispatchEvent(new window.Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 20));
      const message = resultats.textContent.trim();
      dit(message.length > 0, `${p.url} : la recherche sans résultat affiche son message`, 'rien d\'affiché — la recherche ne s\'est pas ouverte');
      const vusR = marquesVisibles(document);
      dit(vusR.length === 0, `${p.url} : « ${message.replace(/[\u0011-\u0013]/g, '␑').slice(0, 40)} » sans marque i18n`, vusR.slice(0, 2).join(' · '));
    }
  }
}

console.log('\n·  Portée de la mesure');
if (marquees === 0) {
  console.log('  ⚠️  INDÉCIDABLE — aucune page marquée : build sans I18N_MARQUAGE=1 ou `marquer:i18n` non joué.' +
    ' Sans sentinelles, ce banc ne peut rien prendre en défaut.');
} else {
  console.log(`  ·  ${marquees}/${pagesVues} page(s) jugée(s) portent le marquage i18n`);
}
fin();
