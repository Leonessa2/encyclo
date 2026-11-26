// Les flux RSS par langue viennent du moteur (moteur/lib/flux_rss.mjs).
import { languesDesFlux, fluxDeLangue } from '../../../moteur/lib/flux_rss.mjs';
export const getStaticPaths = () => languesDesFlux();
export const GET = ({ params }) => fluxDeLangue(params.locale);
