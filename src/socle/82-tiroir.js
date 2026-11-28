(function () {
  // Le panneau latéral du téléphone (thème « Coffre » v3).
  // Le moteur fournit le bouton `#menu-b`, le panneau `#menu-m` (les six
  // rubriques) et son comportement (socle 20-menu.js : ouvrir, fermer au
  // clic ailleurs, à Échap, au choix d'un lien). Ce script ne fait que le
  // COMPLÉTER avec ce que la page porte déjà ailleurs :
  //   · un en-tête (le mot-symbole et un bouton Fermer) ;
  //   · le lien Accueil, au-dessus des rubriques ;
  //   · les langues (copiées de la barre du haut) ;
  //   · l'apparence (le bouton relaie la bascule du moteur) ;
  //   · les liens légaux du pied de page.
  // Les titres de groupe sont lus dans la page (pied de page) : rien n'est
  // traduit ici, sauf « Accueil » et « Fermer », que la page ne porte pas seuls.
  var MOTS = {
    fr: ['Accueil', 'Fermer', 'Langue', 'Apparence'], en: ['Home', 'Close', 'Language', 'Appearance'],
    es: ['Inicio', 'Cerrar', 'Idioma', 'Apariencia'], it: ['Home', 'Chiudi', 'Lingua', 'Aspetto'],
    de: ['Startseite', 'Schließen', 'Sprache', 'Darstellung'],
  };
  function monter() {
    var panneau = document.getElementById('menu-m');
    var bouton = document.getElementById('menu-b');
    if (!panneau || !bouton || panneau.querySelector('.tiroir__tete')) return;
    var langue = (document.documentElement.lang || 'en').slice(0, 2);
    var m = MOTS[langue] || MOTS.en;
    var premier = panneau.firstChild;
    function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }
    function titre(txt) { return el('p', 'tiroir__groupe', txt); }

    // En-tête : le mot-symbole (copié de la marque) et Fermer.
    var tete = el('div', 'tiroir__tete');
    var nom = document.querySelector('header.site .marque__t');
    var b = el('b');
    // « VeVe » et « Wiki » collés, comme dans la marque (l'espace du gabarit saute).
    if (nom) b.innerHTML = nom.innerHTML.replace(/\s+</, '<');
    var fermer = el('button', 'tiroir__fermer', '×');
    fermer.type = 'button';
    fermer.setAttribute('aria-label', m[1]);
    fermer.addEventListener('click', function () { bouton.click(); bouton.focus(); });
    tete.appendChild(b); tete.appendChild(fermer);
    panneau.insertBefore(tete, premier);

    // Accueil, puis les rubriques (déjà là), sous le titre « Explorer » du pied.
    var marque = document.querySelector('header.site .marque');
    var colonnes = document.querySelectorAll('footer.site .site-f__cols h2');
    if (colonnes[1]) panneau.insertBefore(titre(colonnes[1].textContent.trim()), premier);
    if (marque) {
      var accueil = el('a', 'tiroir__accueil', m[0]);
      accueil.href = marque.getAttribute('href');
      if (location.pathname === accueil.getAttribute('href')) accueil.setAttribute('aria-current', 'page');
      panneau.insertBefore(accueil, premier);
    }

    // Langues.
    var langues = document.querySelectorAll('header.site .langbar a');
    if (langues.length > 1) {
      panneau.appendChild(titre(m[2]));
      var bloc = el('div', 'tiroir__langues');
      for (var i = 0; i < langues.length; i++) {
        var a = el('a', null, langues[i].textContent.trim());
        a.href = langues[i].getAttribute('href');
        a.hreflang = langues[i].getAttribute('hreflang') || '';
        if (langues[i].hasAttribute('aria-current')) a.setAttribute('aria-current', 'true');
        bloc.appendChild(a);
      }
      panneau.appendChild(bloc);
    }

    // Apparence : relaie la bascule du moteur (elle reste la seule source).
    var bascule = document.getElementById('bascule-theme');
    if (bascule) {
      panneau.appendChild(titre(m[3]));
      var theme = el('button', 'tiroir__theme', bascule.getAttribute('aria-label') || '');
      theme.type = 'button';
      theme.addEventListener('click', function () {
        bascule.click();
        theme.textContent = bascule.getAttribute('aria-label') || '';
      });
      panneau.appendChild(theme);
    }

    // Liens légaux du pied de page.
    var legaux = document.querySelectorAll('footer.site .legal-links a');
    if (legaux.length) {
      if (colonnes[2]) panneau.appendChild(titre(colonnes[2].textContent.trim()));
      var liste = el('div', 'tiroir__liens');
      for (var j = 0; j < legaux.length; j++) {
        var l = el('a', null, legaux[j].textContent.trim());
        l.href = legaux[j].getAttribute('href');
        liste.appendChild(l);
      }
      panneau.appendChild(liste);
    }
    panneau.setAttribute('role', 'dialog');
    panneau.setAttribute('aria-label', (nom && nom.textContent.trim()) || 'Menu');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monter);
  else monter();
})();
