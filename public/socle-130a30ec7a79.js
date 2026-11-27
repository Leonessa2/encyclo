
// Reassemble les adresses de contact cote navigateur (anti-aspirateur).
(function () {
  var els = document.querySelectorAll('.mail');
  for (var i = 0; i < els.length; i++) {
    var u = els[i].getAttribute('data-u'), d = els[i].getAttribute('data-d');
    if (!u || !d) continue;
    var a = u + String.fromCharCode(64) + d;
    var link = document.createElement('a');
    link.href = 'mai' + 'lto' + ':' + a;
    link.textContent = a;
    els[i].textContent = '';
    els[i].appendChild(link);
  }
})();
;

(function () {
  var b = document.getElementById('menu-b');
  var m = document.getElementById('menu-m');
  if (!b || !m) return;
  function poser(ouvert) {
    m.hidden = !ouvert;
    b.setAttribute('aria-expanded', String(ouvert));
    // 🔴 LOT 118 — LE VOILE DU TIROIR. `body[data-tiroir]::after` l'allume.
    // ⭐ UN SEUL ATTRIBUT POUR DEUX EFFETS (l'assombrissement ET
    //   `pointer-events`), posé au même instant que `hidden`. Deux
    //   interrupteurs pour un seul état finissent par diverger : un voile
    //   resté transparent MAIS cliquable intercepte tous les clics de la
    //   page en silence — c'est la panne de l'élément transparent du lot
    //   111, vue de l'autre côté.
    // ⛔ `document.body` et pas un nœud fabriqué ici : un élément ajouté par
    //   ce script survivrait à une erreur survenue entre deux gestes, et
    //   resterait affiché par-dessus la page sans plus rien pour le retirer.
    if (ouvert) document.body.setAttribute('data-tiroir', '1');
    else document.body.removeAttribute('data-tiroir');
  }
  b.addEventListener('click', function (e) {
    e.stopPropagation();
    poser(m.hidden);
  });
  // ⭐ Un clic AILLEURS referme. Sans ça, le menu reste ouvert par-dessus la
  // page et on croit avoir cliqué à côté d'un lien alors qu'on a cliqué sur
  // le voile invisible du menu.
  document.addEventListener('click', function (e) {
    if (!m.hidden && !m.contains(e.target) && e.target !== b) poser(false);
  });
  // 🔴 LOT 118 — UN LIEN DU TIROIR REFERME LE TIROIR.
  // ⭐ Ça n'a l'air de rien et ça se remarque tout de suite : sur les
  //   ancres internes (`/collections/#sets`) ou quand le navigateur restaure
  //   la page depuis son cache arrière/avant, la navigation ne recharge pas
  //   le document — le tiroir resterait ouvert par-dessus la page d'arrivée,
  //   voile compris. Un panneau qui survit à sa propre navigation ressemble
  //   à un écran figé. ⛔ Le `click` général au-dessus ne suffit pas : le
  //   lien est DANS `m`, donc `m.contains(e.target)` est vrai.
  m.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('a')) poser(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !m.hidden) { poser(false); b.focus(); }
  });
})();
;

(function () {
  // ═══════════════════════════════════════════════════════════════════════
  // ❤️ L'ACCÈS UNIQUE AUX FAVORIS — et les trois lecteurs passent par lui
  // ═══════════════════════════════════════════════════════════════════════
  // ⭐⭐⭐ POURQUOI UN SEUL ACCÈS, ET POURQUOI IL EST ICI.
  // Le lot 140-1 vient de payer la forme inverse : trois lectures
  // indépendantes de `plages:`, toutes JUSTES, qui ont divergé le jour où une
  // seule a appris une règle de plus. Les favoris ont exactement trois
  // lecteurs — le bouton ★ (ce fichier), la page `/favoris/` et la tuile du
  // tableau de bord (`src/socle/modules/favoris.js`). Trois `fetch` seraient
  // trois occasions de traiter le 401 différemment.
  //
  // 🔴🔴 ET IL NE POUVAIT PAS VIVRE DANS `src/socle/modules/`, C'EST MESURÉ :
  // le socle est émis dans le `<head>` (Base.astro l. 651), un module de
  // composant dans le `<body>` ; les deux sont `defer`, donc exécutés DANS
  // L'ORDRE DU DOCUMENT. Un accès rangé dans `modules/` s'exécuterait APRÈS ce
  // fichier, qui ne pourrait pas l'appeler. L'accès est donc dans le socle, et
  // les modules l'y trouvent — jamais l'inverse.
  //
  // ⚖️ ARBITRAGE PREDA ③ DU 12/08 — ON PART PROPRE. `vp_fav` est MORT : plus
  // une lecture, plus une écriture, aucun versement des favoris locaux
  // existants. Une clé morte ne se laisse pas traîner « au cas où » : tant
  // qu'elle est lue quelque part, il y a deux sources de vérité pour la même
  // question. ⚠️ Le coût est assumé et il porte sur des VISITEURS : qui avait
  // mis des pièces de côté sans compte les perd, sans message.
  var API = '/api/favoris';

  // ⭐⭐ « SUIS-JE CONNECTÉ ? » SE LIT SUR L'ATTRIBUT `data-membre`, PAS SUR LE
  // COOKIE. C'est le mécanisme du lot 98, et `30-membre.js` dit pourquoi :
  // relire le cookie ici donnerait une SECONDE source de vérité pour une seule
  // question, et le jour où les deux divergeraient l'écran se contredirait.
  // ⛔ ET C'EST AUSSI CE QUI ÉVITE UN APPEL RÉSEAU SUR 3 097 PAGES : sans cette
  // porte, chaque fiche vue par un anonyme déclencherait un `/api/favoris` que
  // Cloudflare ne peut pas mettre en cache. Un accès unique doit aussi savoir
  // ne pas s'ouvrir.
  function membre() { return document.documentElement.hasAttribute('data-membre'); }

  var enCache = null;   // ⭐ une seule lecture par page, mémorisée
  function req(methode, corps) {
    return fetch(API, {
      method: methode,
      // ⚠️ Le cookie de session voyage, sinon la route rend 401 à un membre.
      credentials: 'same-origin',
      headers: corps ? { 'content-type': 'application/json' } : undefined,
      body: corps ? JSON.stringify(corps) : undefined,
    }).then(function (r) {
      // ⭐⭐⭐ TROIS RÉPONSES, ET ELLES NE SE CONFONDENT PAS.
      //   401 → il n'y a personne : liste vide, et c'est une VÉRITÉ.
      //   503 → on ne sait pas : on LÈVE, et l'appelant garde ce qu'il
      //         affiche. ⛔ Rendre `{}` ici ferait afficher « aucun favori » à
      //         quelqu'un qui en a trente, et le clic suivant écraserait la
      //         vraie liste par la fausse.
      if (r.status === 401) return { connecte: false, favoris: {} };
      if (!r.ok) throw new Error('favoris: HTTP ' + r.status);
      return r.json().then(function (j) {
        return { connecte: true, favoris: (j && j.favoris) || {} };
      });
    });
  }

  window.vpFav = {
    connecte: membre,
    // ⭐ Paresseuse ET mémorisée : deux lecteurs sur la même page (le bouton ★
    //   d'une fiche et rien d'autre, aujourd'hui) ne font qu'un aller-retour.
    liste: function () {
      if (!membre()) return Promise.resolve({ connecte: false, favoris: {} });
      if (!enCache) enCache = req('GET', null);
      return enCache;
    },
    poser: function (uuid, chemin, nom) {
      enCache = req('POST', { uuid: uuid, path: chemin || '', nom: nom || '' });
      return enCache;
    },
    retirer: function (uuid) {
      enCache = req('DELETE', { uuid: uuid });
      return enCache;
    },
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ★ LE BOUTON — premier lecteur de l'accès ci-dessus
  // ═══════════════════════════════════════════════════════════════════════
  // ⚖️ ARBITRAGE PREDA ④ DU 12/08 : le ★ est INVISIBLE tant qu'on n'est pas
  // connecté. ⛔ MAIS IL RESTE ÉMIS DANS LE HTML POUR TOUT LE MONDE, et seule
  // la CSS le masque (`html:not([data-membre]) .socle__fav`, Base.astro).
  // ⭐⭐⭐ CE N'EST PAS UN DÉTAIL D'IMPLÉMENTATION : `test_membre` §5 compte
  // AUTANT DE CŒURS QUE D'ENVELOPPES `.carte-h`, PAGE PAR PAGE. Le rendre
  // conditionnel au build ferait rougir ce banc sur toutes les pages de
  // vitrine — et le banc aurait raison, puisque la règle CSS qui le stylise
  // attendrait un émetteur disparu.
  var boutons = document.querySelectorAll('[data-fav]');
  if (!boutons.length) return;

  function peindre(b, on) {
    b.setAttribute('aria-pressed', String(on));
    var l = b.getAttribute(on ? 'data-l-on' : 'data-l-off');
    if (l) { b.setAttribute('aria-label', l); b.setAttribute('title', l); b.setAttribute('data-l', l); }
  }

  var etat = {};
  window.vpFav.liste().then(function (r) {
    etat = r.favoris;
    boutons.forEach(function (b) { peindre(b, !!etat[b.getAttribute('data-fav')]); });
  }).catch(function () { /* 503 : on laisse les boutons dans leur état de repos */ });

  boutons.forEach(function (b) {
    var u = b.getAttribute('data-fav');
    b.addEventListener('click', function () {
      // ⚖️ ARBITRAGE PREDA ② : AUCUN FAVORI POSSIBLE AVANT LA CONNEXION. Le
      // bouton est déjà invisible pour un anonyme ; ce garde couvre le cas où
      // il serait atteint autrement (clavier sur un `display:none` levé par
      // une extension, script). ⛔ On ne pose rien « en attendant » : ce
      // serait rouvrir la source locale qu'on vient de fermer.
      if (!window.vpFav.connecte()) return;
      var on = !etat[u];
      // ⭐ ON PEINT D'ABORD. L'aller-retour dure ce qu'il dure ; un bouton qui
      //   ne réagit qu'au retour du réseau se fait cliquer deux fois.
      peindre(b, on);
      var p = on
        ? window.vpFav.poser(u, b.getAttribute('data-fav-path'), b.getAttribute('data-fav-nom'))
        : window.vpFav.retirer(u);
      p.then(function (r) {
        etat = r.favoris;
        // ⛔ ET ON REPEINT SUR LA RÉPONSE, pas sur l'intention : si le plafond
        //    a refusé, le ★ doit revenir en arrière plutôt que mentir.
        peindre(b, !!etat[u]);
      }).catch(function () { peindre(b, !on); });
    });
  });
})();
;

(function () {
  var LANGUE_PIVOT = 'en';
  var m = document.cookie.match(/(?:^|;\s*)vp_langue=([a-z]{2})/);
  var lang = m && m[1];
  if (!lang || lang === LANGUE_PIVOT) return;

  // ⛔⛔ ON N'ÉCHANGE QUE SUR UNE PAGE SERVIE DANS LA LANGUE PIVOT.
  // ⚠️ CE N'EST PAS UNE PRÉCAUTION THÉORIQUE : le réseau fait DEUX sites, et
  // le site à cinq langues, lui, génère vraiment `/fr/`, `/es/`, `/de/`, `/it/`. Sans cette
  // ligne, quelqu'un qui lit `/fr/glossary/` avec un cookie `es` verrait sa
  // page française réécrite en espagnol par-dessus — un site qui se traduit
  // deux fois, dans le mauvais sens.
  // ⭐ Elle protège aussi les pages membre du site de prix : elles sont rendues à
  // la demande, DÉJÀ dans la bonne langue et sans aucun marquage. Le garde est
  // redondant là-bas, et c'est très bien : *un garde-fou qui ne sert que dans
  // le cas qu'on n'avait pas prévu est exactement celui qui manque le jour J.*
  if ((document.documentElement.getAttribute('lang') || '') !== LANGUE_PIVOT) return;

  var CLE = 'vp-i18n-' + lang;

  // ═══════════════════════════════════════════════════════════════════════
  // ⭐⭐ REMPLIR UN GABARIT TRADUIT — la moitié cliente des libellés à variables
  // ═══════════════════════════════════════════════════════════════════════
  // `marquer_i18n.mjs` a extrait les valeurs au build et les a posées dans
  // `data-i18n-v` (voir sa section « LES LIBELLÉS À VARIABLES »). Ici on les
  // réinjecte dans le gabarit de la langue choisie.
  // ⛔ ON REND `null` DÈS QU'UN JETON N'A PAS SA VALEUR. Poser un texte où il
  //   reste un `{n}` ou un `%s` visible serait pire que l'anglais : le lecteur
  //   verrait la mécanique. *Un texte anglais juste vaut mieux qu'un texte
  //   français faux* — c'est la même règle qu'au marquage.
  function remplir(gabarit, vals) {
    var manque = false;
    var pos = 0;
    var out = String(gabarit).replace(/\{(\w+)\}|%s/g, function (tout, nom) {
      var cle = nom !== undefined ? nom : String(pos++);
      var v = vals[cle];
      if (v === undefined || v === null) { manque = true; return tout; }
      return nombreLocal(String(v));
    });
    return manque ? null : out;
  }

  // ⚠️ ET LES NOMBRES CHANGENT DE SÉPARATEUR D'UNE LANGUE À L'AUTRE. Le texte
  //   anglais porte « 2,758 » ; un lecteur français lit « 2 758 ». Traduire la
  //   phrase en laissant le nombre à l'anglaise donnerait un français qui sonne
  //   faux au milieu d'une phrase correcte.
  // ⛔⛔ MAIS ON N'Y TOUCHE QUE SUR UNE FORME CERTAINE : au moins un groupe
  //   « ,ddd ». Sans cette exigence, « 2026 » (une année) deviendrait « 2 026 »
  //   et une référence comme « 176 » serait reformatée pour rien. La borne
  //   basse protège plus que la haute ici : dans le doute, on ne touche pas.
  function nombreLocal(x) {
    if (!/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(x)) return x;
    var n = Number(x.replace(/,/g, ''));
    if (!isFinite(n)) return x;
    try { return n.toLocaleString(lang); } catch (e) { return x; }
  }

  function echanger(d) {
    if (!d) return;
    var n = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < n.length; i++) {
      var e = n[i];
      if (e.hasAttribute('data-i18n-var')) {
        // ⭐ Un libellé à variables SANS `data-i18n-v` reste anglais, et c'est
        //   volontaire : le marquage a refusé de le découper (jetons collés,
        //   littéral vide) plutôt que de deviner. On ne redevine pas ici.
        var brut = e.getAttribute('data-i18n-v');
        if (!brut) continue;
        var vals;
        try { vals = JSON.parse(brut); } catch (x) { continue; }
        var g = d[e.getAttribute('data-i18n')];
        if (g === undefined) continue;
        var rempli = remplir(g, vals);
        if (rempli !== null) e.textContent = rempli;
        continue;
      }
      var v = d[e.getAttribute('data-i18n')];
      // ⚠️ `!== undefined` et pas un test de vérité : une traduction
      // légitimement vide effacerait le texte anglais si on la refusait ici,
      // et une chaîne vide est falsy. Le cas est rare — il est arrivé.
      // ⛔ UN GABARIT NE S'ÉCHANGE PAS TEL QUEL. `movers.capped` vaut
      // « Showing the top %s… » : le gabarit anglais a DÉJÀ été rempli au
      // build (`.replace('%s', …)`), la traduction ne l'est pas. L'écrire
      // afficherait « %s » à l'écran — un texte français FAUX vaut moins
      // qu'un texte anglais juste.
      // ⚠️ `\u007B` ET PAS UNE ACCOLADE LITTÉRALE. `test:gabarits` compte les
      // accolades du corps pour repérer un gabarit mal fermé ; une accolade
      // seule dans une chaîne JavaScript le fait rougir — 304 ouvertes, 303
      // fermées. ⛔ On corrige LE CODE, pas le banc : il a raison de ne pas
      // savoir lire le JavaScript, c'est un compteur, et un compteur qu'on
      // apprend à taire ne compte plus rien.
      if (v !== undefined && !/%s|\u007B/.test(v)) e.textContent = v;
    }
    // ── LES ATTRIBUTS. 3 924 libellés sur 10 919 vivent dans un `title=`,
    // un `aria-label=` ou un `alt=` — 36 % du total, mesuré. Les laisser en
    // anglais aurait donné une page française dont chaque infobulle parle
    // anglais, **y compris pour un lecteur d'écran**.
    // ⛔ `marquer_i18n.mjs` n'y note que les libellés qui occupent TOUTE la
    // valeur : un attribut mixte reste anglais plutôt que d'être écrasé.
    var a = document.querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < a.length; j++) {
      var paires = a[j].getAttribute('data-i18n-attr').split(' ');
      for (var p = 0; p < paires.length; p++) {
        var c = paires[p].indexOf(':');
        if (c < 1) continue;
        var w = d[paires[p].slice(c + 1)];
        if (w !== undefined) a[j].setAttribute(paires[p].slice(0, c), w);
      }
    }
    // ⭐ On corrige aussi l'attribut `lang` du document. Sans lui, un lecteur
    // d'écran lit du français avec une voix anglaise — l'interface serait
    // traduite pour l'œil et pas pour l'oreille.
    document.documentElement.setAttribute('lang', lang);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 🔴🔴🔴⭐⭐⭐ AFFICHER DEPUIS LE CACHE, PUIS REVALIDER — TOUJOURS.
  // ═════════════════════════════════════════════════════════════════════════
  //
  // ⛔⛔ CE QUI ÉTAIT ÉCRIT ICI JUSQU'AU 25/08/2026, ET POURQUOI C'ÉTAIT GRAVE :
  //
  //     if (cache) { echanger(cache); return; }   // ⛔ ON NE REVENAIT JAMAIS
  //
  // Le dictionnaire était rangé UNE FOIS chez le visiteur, puis relu
  // indéfiniment. Aucune version, aucune date, aucune revalidation. ⇒ Toute
  // clé ajoutée après la première visite d'un lecteur restait ANGLAISE chez
  // lui, **pour toujours**. Et le défaut s'aggravait à chaque lot : le
  // dictionnaire grossit, les caches des fidèles ne bougent plus.
  //
  // 🔬 MESURÉ LE 25/08 SUR UNE CAPTURE DE PREDA (`/collectibles/`, cookie fr) :
  //   une même rangée de boutons portait « Tout » et « pas encore de fiche » en
  //   français, « With a page » et « Filters » en anglais. Les trois maillons
  //   du site étaient pourtant sains — dépôt, `/i18n/fr.json` servi (231 clés,
  //   les quatre présentes), gabarit. Le coupable était le `localStorage` du
  //   navigateur, et lui seul.
  //
  // ⭐⭐⭐ CE DÉFAUT EST INVISIBLE PARTOUT OÙ ON REGARDE D'HABITUDE : la CI,
  //   `curl`, un navigateur neuf et une fenêtre privée partent tous d'un cache
  //   VIDE — donc tous voient la traduction correcte. Seul un navigateur qui a
  //   DÉJÀ visité le site est touché, c'est-à-dire exactement le lecteur
  //   fidèle. *Un instrument qui ne garde pas d'état ne peut pas voir un défaut
  //   d'état.*
  //
  // ⭐ LE COÛT DE LA REVALIDATION EST QUASI NUL, ET C'EST MESURÉ, PAS SUPPOSÉ :
  //   `/i18n/fr.json` est servi en `cache-control: public, max-age=0,
  //   must-revalidate` AVEC un `etag` (relevé le 25/08, `cf-cache-status: HIT`).
  //   Le navigateur envoie donc une requête CONDITIONNELLE et reçoit un 304 —
  //   quelques centaines d'octets, pas les 4 127 o du corps gzip.
  //   ⛔ Si un jour ces en-têtes passaient à `immutable` ou à un `max-age` long,
  //   cette revalidation redeviendrait muette et le défaut reviendrait EN
  //   SILENCE. C'est `test:cache` qui borne ce risque, pas ce fichier.
  //
  // ⚠️ ON COMPARE LE TEXTE BRUT, PAS L'OBJET. Re-sérialiser pour comparer
  //   dépendrait de l'ordre des clés et déclencherait un échange inutile à
  //   chaque page. Le texte est ce qu'on a rangé, c'est donc ce qu'on compare.
  var cache = null;
  try { cache = localStorage.getItem(CLE); } catch (e) { cache = null; }
  if (cache) {
    // ⛔ UN CACHE ILLISIBLE SE JETTE, IL NE FAIT PAS TOMBER LA PAGE. Un
    //   `localStorage` tronqué (quota atteint en cours d'écriture) rendrait
    //   `JSON.parse` throw, et le `fetch` plus bas ne partirait jamais.
    try { echanger(JSON.parse(cache)); } catch (e) { cache = null; }
  }

  fetch('/i18n/' + lang + '.json', { credentials: 'omit' })
    .then(function (r) { return r.ok ? r.text() : null; })
    .then(function (txt) {
      if (!txt || txt === cache) return; // rien n'a bougé : aucun travail DOM
      var d;
      // ⛔ UN DICTIONNAIRE ILLISIBLE NE DOIT PAS ÉCRASER CELUI QUI MARCHE.
      try { d = JSON.parse(txt); } catch (e) { return; }
      // ⛔ ON ÉCHANGE AVANT DE RANGER. Si `localStorage` est plein ou refusé
      // (navigation privée), la page doit quand même être traduite : ranger
      // d'abord ferait dépendre l'affichage d'un stockage qui n'est pas
      // garanti. C'est le même principe que « prouver l'écriture ne prouve
      // pas la lecture », pris dans l'autre sens.
      echanger(d);
      try { localStorage.setItem(CLE, txt); } catch (e) { /* tant pis */ }
    })
    .catch(function () { /* le cache a déjà servi ; sinon la page reste en anglais */ });
})();
;
// ⚠️ Moteur commun — src/socle/56-suggestion.js   (FICHIER NEUF — lot 212)
// ═══════════════════════════════════════════════════════════════════════════
//  LA SUGGESTION DE LANGUE — UNE INFOBULLE SOUS LE BOUTON, PLUS UN BANDEAU
// ═══════════════════════════════════════════════════════════════════════════
//
// 🖼️ DEMANDE DE PREDA (01/09) : « améliorer la suggestion de langue, avec
// plutôt une info-bulle qui apparaît sous le bouton langue si l'utilisateur est
// dans une autre langue que celui du site ».
//
// 🔬 CE QUE LA MESURE A TROUVÉ AVANT D'ÉCRIRE UNE LIGNE — et ce n'était pas
// qu'une affaire de place. Le bandeau avait DEUX défauts plus graves que sa
// forme, et aucun banc ne pouvait les voir.
//
// ① IL COMPARAIT LA LANGUE DU FICHIER, PAS CELLE QUE LA PERSONNE VOIT.
//    L'ancien code faisait `navigator.language` contre `lang`. Or le site de prix est
//    pré-généré : `lang` vaut « en » sur 3 097 pages sur 3 097. Un lecteur qui
//    avait choisi le français trois semaines plus tôt se voyait donc proposer
//    « ce site est aussi disponible en Français » — sur un site déjà en
//    français. La langue vue vit dans le COOKIE, et nulle part ailleurs.
//    ⭐⭐⭐ *Un test qui n'a jamais eu de raison de rougir n'est pas prudent, il
//    est aveugle.* Celui-ci était vrai à chaque exécution.
//
// ② SA LISTE ÉTAIT VIDE SUR 168 PAGES SUR 178 (mesuré sur `dist/`).
//    Elle se dérivait des ADRESSES de la page — et le site de prix n'a d'adresses
//    traduites que sur le blog. Le mécanisme était servi partout et ne pouvait
//    s'exécuter nulle part ailleurs. On lit maintenant DEUX sources :
//      · `data-ui`  — les langues d'INTERFACE, jamais vides : de quoi proposer
//                     sur tout le site ;
//      · `data-adr` — les ADRESSES, quand la page en a : de quoi emmener le
//                     lecteur sur l'ARTICLE traduit et pas sur des menus.
//    *Deux questions, deux sources.* Les confondre, c'est ce qui a produit un
//    composant mort — la même faute que le compteur « Tout » du même lot.
//
// ③ ET SA PLACE COÛTAIT 72 px DU PREMIER ÉCRAN MOBILE (44 px + 2 × 14 de
//    marge), en tête de `<main>`, au-dessus du fil d'ariane — sur le même
//    premier écran que ce lot dégage par ailleurs. Une infobulle ancrée sous le
//    bouton dit la même chose sans déplacer une ligne, et le dit là où la main
//    va cliquer.
//
// ⛔⛔ LE BANDEAU N'EST PAS SUPPRIMÉ, IL DEVIENT LE REPLI. Le socle sert les
// 15 sites du réseau, et `themes/encyclopedie/theme.css` habille `#langsuggest`
// en propre (l. 242 et l. 583, la seconde pour l'impression). Un site sans
// `#langue-ui` — le site à cinq langues en est un, il n'a pas `langues_dans: compte` — n'a
// aucun bouton sous lequel s'ancrer. *Un composant du socle ne se remplace pas,
// il se double.*
//
// ⚠️ CE FICHIER DOIT ÊTRE DÉCLARÉ DANS `ORDRE`, dans `engine/lib/socle_js.mjs`.
// Le §4 de ce fichier LÈVE si le dossier et la liste divergent — c'est voulu,
// et c'est ce qui empêche un module d'être déposé sans jamais s'exécuter.

(function () {
  var boite = document.getElementById('langsuggest');
  // ⭐ LE GARDE. Le socle part sur toutes les pages des 15 sites ; ce conteneur
  // vient de `Base.astro` et existe partout, mais un site futur pourrait ne pas
  // l'émettre. Sans lui, il n'y a rien à câbler et on sort.
  if (!boite) return;

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // ⭐ ON NE PROPOSE RIEN À QUI A DÉJÀ RÉPONDU — dans un sens ou dans l'autre.
    // ═══════════════════════════════════════════════════════════════════════
    // `langChoice` : la personne a suivi la suggestion. `langDismiss` : elle
    // l'a refusée. Les deux clés sont celles de l'ancien code, à l'identique —
    // ⛔ les renommer aurait REPROPOSÉ la bulle à tous ceux qui l'avaient déjà
    // écartée, une fois, le jour du déploiement. Un état conservé chez le
    // visiteur ne se renomme pas sans le lui redemander.
    if (localStorage.getItem('langChoice') || localStorage.getItem('langDismiss')) return;

    var nav = (navigator.language || '').slice(0, 2).toLowerCase();
    if (!/^[a-z]{2}$/.test(nav)) return;

    // ⭐⭐ LA LANGUE VUE = LE COOKIE. Absent ⇒ « en » — exactement la convention
    // de `55-langue.js`, qui EFFACE le cookie pour revenir au pivot plutôt que
    // d'y écrire « en ». Deux lectures d'un même réglage doivent retomber sur
    // la même valeur, sinon l'une des deux ment un jour sur deux.
    var mc = document.cookie.match(/(?:^|;\s*)vp_langue=([a-z]{2})/);
    var vue = (mc && mc[1]) || 'en';
    if (nav === vue) return;

    function lire(attr) {
      // ⛔ Un JSON illisible ne doit pas emporter le reste du socle. Le `try`
      // englobant suffirait, mais il ferait aussi taire les deux autres blocs :
      // une donnée abîmée doit coûter la suggestion, pas la page.
      try { return JSON.parse(boite.getAttribute(attr) || '[]'); } catch (e) { return []; }
    }
    var ui = lire('data-ui').filter(function (s) { return s.l === nav; })[0];
    // ⭐ ON NE PROPOSE PAS UNE LANGUE QU'ON NE PARLE PAS. Un lecteur japonais
    // n'a rien à faire d'une bulle ; sans ce filtre elle s'ouvrirait vide.
    if (!ui) return;
    var adr = lire('data-adr').filter(function (s) { return s.l === nav; })[0];

    var txt = boite.getAttribute('data-txt') || '';
    var non = boite.getAttribute('data-non') || '';

    // ═══════════════════════════════════════════════════════════════════════
    // ALLER — poser le cookie, PUIS partir.
    // ═══════════════════════════════════════════════════════════════════════
    // ⭐⭐ LE COOKIE D'ABORD DANS LES DEUX CAS. Naviguer sans lui ferait arriver
    // sur l'article français dans une interface anglaise, le temps que
    // `50-i18n.js` s'exécute — un clignotement sur la seule page où l'on vient
    // précisément de demander le français.
    // ⛔ ET C'EST LA MÊME ÉCRITURE QUE `55-langue.js` : `path=/`, un an,
    // `SameSite=Lax`, pas de `Secure` (refusé en HTTP local, donc mort dans la
    // seule configuration où on peut regarder le sélecteur à l'œil).
    function aller() {
      localStorage.setItem('langChoice', nav);
      if (nav === 'en') document.cookie = 'vp_langue=; path=/; max-age=0; samesite=lax';
      else document.cookie = 'vp_langue=' + nav + '; path=/; max-age=31536000; samesite=lax';
      // ⛔ `assign` et non `replace` : le bouton « précédent » doit ramener à
      // l'article d'où l'on vient. `replace` effacerait l'étape.
      if (adr) window.location.assign(adr.h); else window.location.reload();
    }

    function bouton(libelle, principal, action) {
      var b = document.createElement('button');
      b.type = 'button';
      // ⛔ `textContent`, jamais `innerHTML`. L'ancien bandeau concaténait le
      // nom de langue dans une chaîne de balisage ; on ne recopie pas une
      // faiblesse en déménageant, même quand la donnée est de chez nous.
      b.textContent = libelle;
      if (!principal) b.setAttribute('data-non', '');
      b.addEventListener('click', action);
      return b;
    }

    var hote = document.querySelector('#langue-ui .globe__m');

    if (hote) {
      // ── LA FORME DEMANDÉE : une infobulle dans le menu du bouton ──────────
      // ⚠️ ELLE VIT DANS `.globe__m`, LE MENU DÉJÀ POSITIONNÉ (`position:absolute`,
      // `top:calc(100% + 6px)`, `right:0`). Écrire un placement à côté aurait
      // donné une SECONDE définition de la position de ce panneau, à tenir
      // d'accord avec la première à chaque retouche de l'en-tête. Le menu sait
      // déjà où il est ; on lui ajoute une section, on ne le double pas.
      var bulle = document.createElement('div');
      bulle.className = 'globe__sugg';
      var p = document.createElement('p');
      p.textContent = txt + ' ' + ui.n;
      bulle.appendChild(p);
      var acts = document.createElement('span');
      acts.appendChild(bouton(ui.n, true, aller));
      acts.appendChild(bouton(non, false, function () {
        localStorage.setItem('langDismiss', '1');
        bulle.remove();
      }));
      bulle.appendChild(acts);
      hote.appendChild(bulle);
      // ⭐⭐⭐ ET ON OUVRE LE MENU. Une infobulle repliée dans un `<details>`
      // fermé est une infobulle que PERSONNE NE VOIT : le code s'exécute, le
      // nœud existe, le banc le trouve — et l'écran ne montre rien. C'est un
      // banc muet, mais en CSS, et c'est la forme la plus difficile à
      // diagnostiquer. Une ligne suffit à ne pas s'y mettre.
      var det = document.getElementById('langue-ui');
      if (det) det.open = true;
    } else {
      // ── LE REPLI : le bandeau d'origine, pour un site sans `#langue-ui` ────
      var t = document.createElement('span');
      t.textContent = txt + ' ' + ui.n + ' — ';
      boite.appendChild(t);
      boite.appendChild(bouton(ui.n, true, aller));
      boite.appendChild(bouton(non, false, function () {
        localStorage.setItem('langDismiss', '1');
        boite.style.display = 'none';
      }));
      boite.style.display = 'block';
    }
  } catch (e) {}
})();
;
(function () {
  // Une classe sur <html> : le seul élément qui existe déjà quand un script du
  // <head> s'exécute. C'est elle qui révèle les boutons, via le CSS.
  document.documentElement.classList.add('js');

  function telecharger(bouton) {
    var bloc = bouton.closest('.fig');
    var svg = bloc && bloc.querySelector('svg');
    if (!svg) return;
    bouton.setAttribute('aria-busy', 'true');
    var boite = svg.viewBox && svg.viewBox.baseVal;
    var L = (boite && boite.width) || svg.clientWidth || 900;
    var H = (boite && boite.height) || svg.clientHeight || 400;
    var ECHELLE = 2;
    var xml = new XMLSerializer().serializeToString(svg);
    var url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    var img = new Image();
    img.onload = function () {
      var c = document.createElement('canvas');
      c.width = L * ECHELLE; c.height = H * ECHELLE;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(function (png) {
        bouton.removeAttribute('aria-busy');
        if (!png) return;
        var a = document.createElement('a');
        a.href = URL.createObjectURL(png);
        a.download = (bloc.getAttribute('data-fig-nom') || 'figure') + '.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      }, 'image/png');
    };
    img.onerror = function () { URL.revokeObjectURL(url); bouton.removeAttribute('aria-busy'); };
    img.src = url;
  }

  // Écouteur DÉLÉGUÉ sur `document`, attaché tout de suite : il n'a pas besoin
  // que les boutons existent, seulement que le clic remonte jusqu'ici.
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('.fig .fig-dl');
    if (b) { e.preventDefault(); telecharger(b); }
  });
})();
