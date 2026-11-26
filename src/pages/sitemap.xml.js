// Le plan du site vient du moteur (moteur/lib/plan_du_site.mjs). Ce que le wiki
// y ajoute (fiches, date des données) passe par engine/lib/extensions.mjs.
import { planDuSite } from '../../moteur/lib/plan_du_site.mjs';
export const GET = () => planDuSite();
