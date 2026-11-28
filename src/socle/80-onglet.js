(function () {
  // L'onglet de la rubrique courante. Le moteur ne pose pas `aria-current`
  // sur la navigation principale ; le thème peint l'onglet actif en encre
  // pleine à partir de cet attribut. Un lien correspond si le chemin de la
  // page COMMENCE par le sien (« /fr/brands/dc/ » ouvre l'onglet « Marques »).
  function marquer() {
    var liens = document.querySelectorAll('.nav__liens a[href], .deplie__m a[href]');
    var ici = location.pathname;
    for (var i = 0; i < liens.length; i++) {
      var a = liens[i];
      var p = a.getAttribute('href');
      if (p && p.length > 4 && ici.indexOf(p) === 0) a.setAttribute('aria-current', 'page');
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', marquer);
  else marquer();
})();
