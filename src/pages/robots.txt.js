// Le robots.txt vient du moteur (moteur/lib/robots_txt.mjs).
import { robotsTxt } from '../../moteur/lib/robots_txt.mjs';
export const GET = () => robotsTxt();
