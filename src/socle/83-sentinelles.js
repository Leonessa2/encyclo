(function () {
  // Les libellés que le MOTEUR pose à l'exécution, sans sentinelles i18n.
  // Le gabarit du moteur (moteur/gabarits/Page.astro) passe certains libellés
  // par `define:vars` : Astro les écrit en JSON, les sentinelles U+0011..U+0013
  // deviennent du texte que `marquer_i18n` ne retire pas, et le navigateur les
  // affiche — la clé apparaît devant le texte (« theme.toDarkSwitch to… »).
  // Deux endroits les montrent au lecteur :
  //   · la bascule clair / sombre : `aria-label` et `title` (infobulle au
  //     survol, nom lu par les lecteurs d'écran), réécrits à chaque bascule ;
  //   · la recherche de l'en-tête (#palette-r) : « Aucun résultat ».
  // ⭐ Le vrai remède est un `nu()` sur ces `define:vars` dans le gabarit du
  //   moteur (charpente) ; ce script le supplée côté site et ne fait plus rien
  //   une fois le moteur corrigé. Il ne touche qu'à ces deux endroits.
  // ⚠️ `window.` partout, jamais de global nu : le banc i18n rejoue le socle
  //   dans un bac à sable où seul `window` existe.
  // Banc : engine/tools/test_menu_ouvert.mjs (menu et recherche, 5 langues).
  var RE = /[\u0011-\u0013]/;
  function net(s) {
    return String(s || '').replace(/\u0011[^\u0012]*\u0012/g, '').replace(/[\u0011-\u0013]/g, '');
  }
  function observer(cible, opts, rappel) {
    if (window.MutationObserver) new window.MutationObserver(rappel).observe(cible, opts);
  }

  // ① La bascule.
  var b = document.getElementById('bascule-theme');
  if (b) {
    var ATTRS = ['aria-label', 'title'];
    var attributs = function () {
      for (var i = 0; i < ATTRS.length; i++) {
        var v = b.getAttribute(ATTRS[i]);
        if (v && RE.test(v)) b.setAttribute(ATTRS[i], net(v));
      }
    };
    attributs();
    // Au clic (inscrit APRÈS le gestionnaire du moteur : son script en ligne
    // s'exécute avant le socle `defer`), et à toute autre réécriture.
    b.addEventListener('click', attributs);
    observer(b, { attributes: true, attributeFilter: ATTRS }, attributs);
  }

  // ② Les résultats de la recherche de l'en-tête.
  var r = document.getElementById('palette-r');
  var q = document.getElementById('palette-q');
  if (r) {
    var textes = function () {
      if (!RE.test(r.textContent)) return;
      var pile = [r];
      while (pile.length) {
        var n = pile.pop();
        if (n.nodeType === 3) { if (RE.test(n.nodeValue)) n.nodeValue = net(n.nodeValue); }
        else for (var c = n.firstChild; c; c = c.nextSibling) pile.push(c);
      }
    };
    observer(r, { childList: true, subtree: true, characterData: true }, textes);
    // Après la frappe (inscrit après `filtrer` du moteur, il passe derrière).
    if (q) q.addEventListener('input', textes);
  }
})();
