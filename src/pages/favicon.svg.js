// Dépôt : Leonessa2/encyclo — fichier : src/pages/favicon.svg.js  (28/11/2026)
// Le favicon du wiki : le globe en puzzle, version simplifiée pour les petites
// tailles (public/logo-icone.svg ; le logo complet est public/logo.svg).
// ⚠️ Il remplace l'ancien favicon dérivé du manifeste (initiales sur un carré
// de couleur), qui affichait « VW » sur un fond de la couleur des liens.
// ⚠️ Chemin pris depuis la racine du dépôt (le build s'y lance), pas depuis
// `import.meta.url` : une fois groupé, ce module ne vit plus dans src/pages/.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fichier = join(process.cwd(), 'public', 'logo-icone.svg');

export function GET() {
  const svg = readFileSync(fichier, 'utf8');
  return new Response(svg, { headers: { 'content-type': 'image/svg+xml' } });
}
