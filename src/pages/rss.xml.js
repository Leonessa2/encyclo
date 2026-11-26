// Le flux RSS des articles vient du moteur (moteur/lib/flux_rss.mjs).
import { fluxPrincipal } from '../../moteur/lib/flux_rss.mjs';
export const GET = () => fluxPrincipal();
