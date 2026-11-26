// Dépôt : Leonessa2/encyclo — fichier : engine/lib/seo_objet.mjs  (lot 4, 26/11/2026)
// La donnée structurée d'un OBJET avec son prix (fiches de veveprice). Sortie
// du moteur au rangement : un prix n'est pas une notion du moteur. Reste de
// veveprice, à retirer au ménage du lot 7.
import { coteFermee } from './cote.mjs';

// 🔴🔴 LOT 101 — `offers.price` ETAIT LA FUITE LA PLUS COUTEUSE DE TOUTES.
// Une donnee structuree n'est pas lue par un visiteur : elle est lue par les
// MOTEURS, recopiee dans les resultats de recherche, et conservee dans leur
// cache bien apres qu'on l'a retiree de la page. Ce champ servait le plancher
// courant a Google, en clair, sur 8 500 pages — c'est-a-dire le produit qu'on
// veut vendre, publie a l'endroit precis d'ou on ne peut plus le rappeler.
//
// ⭐⭐⭐ LE RETRAIT EST INCONDITIONNEL QUAND LA PORTE EST FERMEE, ET IL NE SE
// NEGOCIE PAS AVEC UN `<Gate>` : le JSON-LD n'a pas de rendu conditionnel, pas
// de CSS, pas de JavaScript. Il est dans le HTML ou il n'y est pas.
// ⭐ En pratique la ligne serait deja inerte — `item.floor` n'existe plus apres
// `projeter()`, donc le ternaire retomberait sur `{}`. ON GARDE QUAND MEME LE
// TEST DE LA PORTE : « ca se trouve inerte » et « c'est interdit » ne sont pas
// la meme chose, et c'est la premiere qui se defait au lot suivant sans bruit.
// ⛔ NE JAMAIS declarer un `offers` sans prix « pour garder la donnee riche » :
// une donnee structuree est une PROMESSE faite au moteur, et une offre sans
// montant est une promesse vide — Search Console la signale comme une erreur.
export const productLd = (item, url, brand) => ({
  '@context': 'https://schema.org', '@type': 'Product',
  name: item.qualifie || item.name, sku: item.uuid, url,
  brand: { '@type': 'Brand', name: item.brand || brand },
  category: item.series || undefined,
  ...(!coteFermee() && item.floor ? { offers: { '@type': 'Offer', price: item.floor, priceCurrency: 'USD', availability: (item.listings || 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url } } : {}),
});

