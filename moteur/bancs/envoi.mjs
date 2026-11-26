// Moteur commun — fichier : moteur/bancs/envoi.mjs   (version 0.4.0)
//
// Les règles de service (moteur/envoi/regles.json) sont-elles vraiment
// appliquées ? Ce banc :
//   1. vérifie que moteur/envoi/_headers dit la même chose que les règles ;
//   2. lance un VRAI nginx avec moteur/envoi/nginx-site.conf, qui sert le site
//      construit (dist/) à travers un lien « courant », comme sur le VPS ;
//   3. demande CHAQUE fichier de dist/, chaque dossier avec et sans « / »,
//      une adresse absente, un dossier sans page et /_headers, et compare
//      code, Cache-Control, en-têtes de sécurité, redirections et types.
// nginx tourne dans l'IMAGE FIGÉE de moteur/envoi/image-nginx.txt, la même que
// sur le VPS. Il échoue si Docker est absent : sans lui, il ne prouverait rien.
//
// Usage : node moteur/bancs/envoi.mjs   (après la construction)
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { join, resolve, relative, extname, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import http from 'node:http';

const RACINE = resolve(process.argv[2] || '.');
const DIST = join(RACINE, 'dist');
const ENVOI = join(RACINE, 'moteur', 'envoi');
const R = JSON.parse(readFileSync(join(ENVOI, 'regles.json'), 'utf8'));

let ko = 0;
const fautes = [];
const dit = (ok, titre, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${titre}${detail ? `   — ${detail}` : ''}`);
  if (!ok) ko++;
};

console.log('\nles règles de service sont-elles appliquées ?');

// ── 0. le banc regarde-t-il quelque chose ? ────────────────────────────────
console.log('\n0. le banc regarde-t-il vraiment quelque chose ?');
if (!existsSync(DIST)) { console.log('  ❌ pas de dossier dist/ : banc creux'); process.exit(1); }
const fichiers = [];
const parcourir = (d) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) parcourir(p); else fichiers.push('/' + relative(DIST, p).split('\\').join('/'));
  }
};
parcourir(DIST);
const pages = fichiers.filter((f) => f.endsWith('/index.html'));
dit(pages.length >= 250, `${fichiers.length} fichiers, dont ${pages.length} pages`);

// Ce que les règles attendent pour une adresse servie avec succès.
const EXT = new Set(R.cache.statiques.extensions.map((e) => '.' + e));
const cacheAttendu = (chemin) => {
  if (R.cache.icones?.chemins.includes(chemin)) return R.cache.icones.valeur;
  if (R.cache.index.chemins.includes(chemin)) return R.cache.index.valeur;
  if (EXT.has(extname(chemin).toLowerCase())) return R.cache.statiques.valeur;
  return R.cache.pages.valeur;
};

// ── 1. _headers dit-il la même chose ? ─────────────────────────────────────
console.log('\n1. moteur/envoi/_headers dit la même chose que les règles');
const blocs = {};
let courant = null;
for (const brute of readFileSync(join(ENVOI, '_headers'), 'utf8').split('\n')) {
  if (/^\s*#/.test(brute) || !brute.trim()) continue;
  if (!/^\s/.test(brute)) { courant = brute.trim(); blocs[courant] = blocs[courant] || {}; continue; }
  if (/^!\s*/.test(brute.trim()) && courant) { blocs[courant]['!' + brute.trim().slice(1).trim()] = true; continue; }
  const m = brute.trim().match(/^([^:]+):\s*(.*)$/);
  if (m && courant) blocs[courant][m[1]] = m[2];
}
const tout = blocs['/*'] || {};
dit(Object.entries(R.securite).every(([k, v]) => tout[k] === v) && Object.keys(tout).length === Object.keys(R.securite).length,
  'les en-têtes de sécurité valent pour tout le site (/*), et rien d\'autre n\'y est posé');
dit(R.cache.statiques.extensions.every((e) => blocs[`/*.${e}`]?.['Cache-Control'] === R.cache.statiques.valeur),
  `fichiers statiques : ${R.cache.statiques.extensions.length} extensions à « ${R.cache.statiques.valeur} »`);
dit(R.cache.index.chemins.every((c) => blocs[c]?.['Cache-Control'] === R.cache.index.valeur),
  `index : ${R.cache.index.chemins.join(', ')} à « ${R.cache.index.valeur} »`);
const icones = R.cache.icones?.chemins || [];
dit(icones.every((c) => blocs[c]?.['Cache-Control'] === R.cache.icones.valeur && blocs[c]?.['!Cache-Control']),
  `icônes : ${icones.join(', ')} à « ${R.cache.icones?.valeur} », valeur de 30 jours retirée (« ! Cache-Control »)`);
const enTrop = Object.keys(blocs).filter((b) => b !== '/*' && !R.cache.index.chemins.includes(b) && !icones.includes(b)
  && !R.cache.statiques.extensions.some((e) => b === `/*.${e}`));
dit(enTrop.length === 0, 'aucune règle en plus de celles de regles.json', enTrop.join(', '));
const copie = join(DIST, '_headers');
dit(existsSync(copie) && readFileSync(copie).equals(readFileSync(join(ENVOI, '_headers'))),
  'dist/_headers est la copie exacte de moteur/envoi/_headers');

// ── 2. nginx, pour de vrai : la MÊME image que sur le VPS ──────────────────
console.log('\n2. nginx sert le site construit selon les règles');
const IMAGE = readFileSync(join(ENVOI, 'image-nginx.txt'), 'utf8').trim();
dit(/^nginx:[0-9.]+-alpine@sha256:[0-9a-f]{64}$/.test(IMAGE), `image figée : ${IMAGE.split('@')[0]}`, IMAGE);
const docker = (args, opts = {}) => spawnSync('docker', args, { encoding: 'utf8', timeout: 180000, ...opts });
const dv = docker(['version', '--format', '{{.Server.Version}}']);
if (dv.error || dv.status !== 0) { dit(false, 'Docker est disponible', 'introuvable : ce banc ne peut rien prouver sans lui'); process.exit(1); }
if (docker(['image', 'inspect', IMAGE]).status !== 0) {
  const p = docker(['pull', '-q', IMAGE]);
  if (p.status !== 0) { dit(false, `image ${IMAGE} téléchargée`, (p.stderr || '').trim()); process.exit(1); }
}
// Le dossier du site comme sur le VPS : versions/<id>/ et le lien relatif `courant`.
const tmp = mkdtempSync(join(tmpdir(), 'envoi-'));
const SITE = join(tmp, 'site');
spawnSync('mkdir', ['-p', join(SITE, 'versions')]);
spawnSync('cp', ['-a', DIST, join(SITE, 'versions', 'essai')]);
symlinkSync('versions/essai', join(SITE, 'courant'));
spawnSync('chmod', ['-R', 'a+rX', tmp]);
const site = readFileSync(join(ENVOI, 'nginx-site.conf'), 'utf8');
const montages = ['-v', `${SITE}:/srv/site:ro`, '-v', `${join(ENVOI, 'nginx-site.conf')}:/etc/nginx/conf.d/default.conf:ro`];
const t = docker(['run', '--rm', ...montages, IMAGE, 'nginx', '-t']);
dit(t.status === 0, 'la configuration est acceptée par nginx', t.status === 0 ? (t.stderr.match(/nginx\/[0-9.]+/) || [IMAGE])[0] : t.stderr.trim().split('\n').pop());
if (t.status !== 0) process.exit(1);
const PORT = 18000 + Math.floor(Math.random() * 2000);
const NOM = `envoi-banc-${PORT}`;
const lancer = docker(['run', '-d', '--rm', '--name', NOM, '-p', `127.0.0.1:${PORT}:80`, ...montages, IMAGE]);
if (lancer.status !== 0) { dit(false, 'nginx démarre', lancer.stderr.trim()); process.exit(1); }
const arreter = () => {
  docker(['stop', '-t', '2', NOM]);
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
};

const agent = new http.Agent({ keepAlive: true, maxSockets: 16 });
const demander = (chemin) => new Promise((ok, ko2) => {
  const req = http.get({ host: '127.0.0.1', port: PORT, path: encodeURI(chemin), agent }, (res) => {
    const morceaux = [];
    res.on('data', (c) => morceaux.push(c));
    res.on('end', () => ok({ code: res.statusCode, h: res.headers, brut: res.rawHeaders, corps: Buffer.concat(morceaux) }));
  });
  req.on('error', ko2);
  req.setTimeout(10000, () => req.destroy(new Error('délai dépassé')));
});
const nbEntete = (r, nom) => r.brut.filter((x, i) => i % 2 === 0 && x.toLowerCase() === nom.toLowerCase()).length;
const securiteOk = (r) => Object.entries(R.securite).every(([k, val]) => r.h[k.toLowerCase()] === val && nbEntete(r, k) === 1);

try {
  // attendre que nginx réponde
  let pret = false;
  for (let i = 0; i < 50 && !pret; i++) {
    try { await demander('/'); pret = true; } catch { await new Promise((z) => setTimeout(z, 100)); }
  }
  dit(pret, `nginx répond (port local ${PORT})`);
  if (!pret) throw new Error('nginx ne répond pas');

  // 2a. chaque fichier du site
  const servis = fichiers.filter((f) => !R.jamais_servis.includes(f));
  const resultats = [];
  for (let i = 0; i < servis.length; i += 16) {
    resultats.push(...await Promise.all(servis.slice(i, i + 16).map(async (f) => [f, await demander(f)])));
  }
  const malServis = [];
  for (const [f, r] of resultats) {
    const attendu = cacheAttendu(f);
    const pb = [];
    if (r.code !== 200) pb.push(`code ${r.code}`);
    if (r.h['cache-control'] !== attendu || nbEntete(r, 'Cache-Control') !== 1) pb.push(`Cache-Control « ${r.h['cache-control']} » (${nbEntete(r, 'Cache-Control')}×), attendu « ${attendu} »`);
    if (!securiteOk(r)) pb.push('en-têtes de sécurité');
    if (r.h.expires) pb.push('Expires en plus');
    if (f.endsWith('.html') && r.h['content-type'] !== 'text/html; charset=utf-8') pb.push(`type ${r.h['content-type']}`);
    if (pb.length) malServis.push(`${f} : ${pb.join(' ; ')}`);
  }
  dit(malServis.length === 0, `${resultats.length} fichiers servis selon les règles`, malServis.length ? `${malServis.length} écart(s)` : '');
  malServis.slice(0, 30).forEach((x) => console.log(`     ${x}`));

  // 2b. les dossiers : « /x/ » sert la page, « /x » redirige vers « /x/ » (relatif)
  const dossiers = pages.map((p) => p.slice(0, -'index.html'.length)).filter((d) => d !== '/');
  const pbDossiers = [];
  for (let i = 0; i < dossiers.length; i += 16) {
    await Promise.all(dossiers.slice(i, i + 16).map(async (d) => {
      const a = await demander(d);
      if (a.code !== 200 || a.h['cache-control'] !== R.cache.pages.valeur || !securiteOk(a)) pbDossiers.push(`${d} : ${a.code}`);
      const sans = d.slice(0, -1);
      const b = await demander(sans);
      if (b.code !== 301 || b.h.location !== encodeURI(d) || !securiteOk(b)) pbDossiers.push(`${sans} : ${b.code} → ${b.h.location}`);
    }));
  }
  dit(pbDossiers.length === 0, `${dossiers.length} dossiers : « /x/ » sert la page, « /x » redirige vers « /x/ » sans nom de domaine`,
    pbDossiers.length ? `${pbDossiers.length} écart(s)` : '');
  pbDossiers.slice(0, 20).forEach((x) => console.log(`     ${x}`));
  const accueil = await demander('/');
  dit(accueil.code === 200 && accueil.h['cache-control'] === R.cache.pages.valeur && securiteOk(accueil), 'l\'accueil « / » est servi');

  // 2c. les erreurs
  const page404 = readFileSync(join(DIST, R.erreurs['404'].slice(1)));
  const verif404 = (r) => r.code === 404 && r.corps.equals(page404) && securiteOk(r)
    && r.h['cache-control'] === R.cache.pages.valeur && nbEntete(r, 'Cache-Control') === 1;
  for (const chemin of ['/cette-adresse-n-existe-pas/', '/cette-adresse-n-existe-pas', '/absent.css', '/absent.png', '/sitemap-absent.xml']) {
    const r = await demander(chemin);
    dit(verif404(r), `adresse absente « ${chemin} » → 404 avec la page 404`, `${r.code}, Cache-Control « ${r.h['cache-control']} »`);
  }
  const sansPage = [...new Set(fichiers.map((f) => dirname(f)))].filter((d) => d !== '/' && !fichiers.includes(`${d}/index.html`));
  if (sansPage.length) {
    const r = await demander(`${sansPage[0]}/`);
    dit(verif404(r), `dossier sans page « ${sansPage[0]}/ » → 404 (pas 403)`, `${r.code}`);
  }
  for (const c of R.jamais_servis) {
    const r = await demander(c);
    dit(r.code === 404, `« ${c} » n'est jamais servi`, `${r.code}`);
  }
  const r500 = await demander(R.erreurs['500']);
  dit(r500.code === 200 && /error_page 500 502 503 504 \/500\.html;/.test(site), 'la page 500 existe et nginx s\'en sert pour les erreurs du serveur');

  // 2d. quelques types
  for (const [f, type] of [['/sitemap.xml', 'text/xml'], ['/robots.txt', 'text/plain'], ['/search-index.json', 'application/json']]) {
    if (!fichiers.includes(f)) continue;
    const r = (resultats.find(([x]) => x === f) || [])[1];
    dit(r && String(r.h['content-type']).startsWith(type), `${f} servi en ${type}`, r && r.h['content-type']);
  }
} catch (e) {
  dit(false, 'le banc est allé au bout', e.message);
} finally {
  agent.destroy();
  arreter();
}

console.log(ko ? `\n⛔ ${ko} contrôle(s) en échec.` : '\n✅ les règles de service sont appliquées.');
process.exit(ko ? 1 : 0);
