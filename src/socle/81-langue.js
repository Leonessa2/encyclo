(function () {
  // Le sélecteur de langue replié du téléphone (thème « Coffre » v3).
  // La langue courante devient une puce « FR ⌄ » ; un toucher ouvre la liste
  // des autres langues, chacune écrite dans sa propre langue. Le thème ne
  // replie RIEN sans ce script : sans lui, les cinq langues restent visibles.
  // ⚠️ Le lien de la langue courante pointe vers la page elle-même : on
  // empêche sa navigation UNIQUEMENT quand la liste est repliée (téléphone).
  var NOMS = { en: 'English', fr: 'Français', es: 'Español', it: 'Italiano', de: 'Deutsch' };
  var ETROIT = window.matchMedia ? window.matchMedia('(max-width: 1099px)') : null;

  function monter() {
    var barre = document.querySelector('header.site .langbar');
    if (!barre || barre.querySelector('.langbar__liste')) return;
    var courant = barre.querySelector('a[aria-current]');
    if (!courant) return;
    var liste = document.createElement('span');
    liste.className = 'langbar__liste';
    var autres = barre.querySelectorAll('a:not([aria-current])');
    for (var i = 0; i < autres.length; i++) {
      var a = autres[i];
      var code = (a.getAttribute('hreflang') || '').slice(0, 2);
      if (NOMS[code]) a.setAttribute('data-nom', NOMS[code]);
      liste.appendChild(a);
    }
    barre.appendChild(liste);
    courant.setAttribute('aria-haspopup', 'true');

    function etroit() { return !ETROIT || ETROIT.matches; }
    function poser(ouvert) {
      barre.classList.toggle('langbar--ouverte', ouvert);
      courant.setAttribute('aria-expanded', String(ouvert));
    }
    function appliquer() {
      barre.classList.toggle('langbar--repliee', etroit());
      if (!etroit()) { poser(false); courant.removeAttribute('aria-expanded'); }
      else if (!courant.hasAttribute('aria-expanded')) courant.setAttribute('aria-expanded', 'false');
    }
    courant.addEventListener('click', function (e) {
      if (!etroit()) return;
      e.preventDefault();
      e.stopPropagation();
      poser(!barre.classList.contains('langbar--ouverte'));
    });
    document.addEventListener('click', function (e) {
      if (barre.classList.contains('langbar--ouverte') && !barre.contains(e.target)) poser(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && barre.classList.contains('langbar--ouverte')) { poser(false); courant.focus(); }
    });
    if (ETROIT && ETROIT.addEventListener) ETROIT.addEventListener('change', appliquer);
    appliquer();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monter);
  else monter();
})();
