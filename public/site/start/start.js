(function (wortel, maak) {
  'use strict';
  var api = maak();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (wortel && wortel.document) api.start(wortel, wortel.document);
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var DAGDELEN = ['ochtend', 'middag', 'avond', 'nacht'];
  var BEELDEN = {
    ochtend: {
      hero: 'images/start/dagdelen/hero-ochtend.jpg',
      living: 'campagne/palacio.jpg',
      travel: 'campagne/jet.jpg',
      work: 'campagne/kyoto-suite.jpg',
      foundation: 'campagne/bamboe.jpg'
    },
    middag: {
      hero: 'images/start/dagdelen/hero-middag.jpg',
      living: 'campagne/onsen.jpg',
      travel: 'campagne/riad.jpg',
      work: 'campagne/palacio.jpg',
      foundation: 'campagne/hero.jpg'
    },
    avond: {
      hero: 'images/start/dagdelen/hero-avond.jpg',
      living: 'campagne/kyoto-suite.jpg',
      travel: 'campagne/kaiseki.jpg',
      work: 'campagne/jet.jpg',
      foundation: 'campagne/riad.jpg'
    },
    nacht: {
      hero: 'images/start/dagdelen/hero-nacht.jpg',
      living: 'campagne/riad.jpg',
      travel: 'campagne/bamboe.jpg',
      work: 'campagne/onsen.jpg',
      foundation: 'campagne/kaiseki.jpg'
    }
  };

  function dagdeelVoorUur(uur) {
    var h = Number(uur);
    if (!Number.isFinite(h)) h = 0;
    h = ((h % 24) + 24) % 24;
    if (h >= 5 && h < 12) return 'ochtend';
    if (h >= 12 && h < 18) return 'middag';
    if (h >= 18 && h < 23) return 'avond';
    return 'nacht';
  }

  function beeldsetVoorDagdeel(dagdeel) {
    return BEELDEN[DAGDELEN.indexOf(dagdeel) === -1 ? 'avond' : dagdeel];
  }

  function start(w, d) {
    if (d.documentElement.hasAttribute('data-startpagina-actief')) return;
    d.documentElement.setAttribute('data-startpagina-actief', '');

    /* De openbare voordeur gebruikt wel dezelfde taalkeuze en signatuurmond,
       maar niet de ingelogde Rahul-commandtab. Dit voorkomt dat die appmodule
       op een GitHub-projectpad als root-absoluut hulpmiddel wordt opgehaald. */
    w.__rahulTabStandaard = true;

    var meta = function (naam) {
      var el = d.querySelector('meta[name="' + naam + '"]');
      return el ? el.content : '';
    };
    var assetBasis = new URL((meta('rtg-asset-base') || './public').replace(/\/?$/, '/'), d.baseURI);
    var appBasis = new URL(meta('rtg-app-base') || 'https://app.rahultravelgroup.com/', d.baseURI);
    var assetUrl = function (pad) { return new URL(String(pad).replace(/^\//, ''), assetBasis).href; };

    d.querySelectorAll('[data-app-path]').forEach(function (link) {
      link.href = new URL(link.getAttribute('data-app-path'), appBasis).href;
    });

    var heroLagen = [d.getElementById('heroPhotoA'), d.getElementById('heroPhotoB')].filter(Boolean);
    var actieveHero = 0;
    var huidigDagdeel = null;
    var wisselNummer = 0;

    function laadBeeld(url) {
      return new Promise(function (klaar) {
        var proef = new Image();
        var af = function (gelukt) { proef.onload = proef.onerror = null; klaar(gelukt); };
        proef.onload = function () { af(true); };
        proef.onerror = function () { af(false); };
        proef.src = url;
        if (proef.complete) af(proef.naturalWidth > 0);
      });
    }

    function zetHero(url, eersteKeer, nummer) {
      if (!heroLagen.length) return Promise.resolve(false);
      var huidig = heroLagen[actieveHero];
      if (huidig && huidig.src === url && huidig.naturalWidth) return Promise.resolve(true);
      return laadBeeld(url).then(function (gelukt) {
        if (!gelukt || nummer !== wisselNummer) return false;
        if (eersteKeer || !huidig || !huidig.getAttribute('src')) {
          huidig.src = url;
          huidig.classList.add('is-active');
          return true;
        }
        var volgendeIndex = (actieveHero + 1) % heroLagen.length;
        var volgende = heroLagen[volgendeIndex];
        volgende.src = url;
        volgende.classList.add('is-active');
        huidig.classList.remove('is-active');
        actieveHero = volgendeIndex;
        return true;
      });
    }

    function zetKaarten(set, eersteKeer, nummer) {
      var fotos = Array.from(d.querySelectorAll('[data-world-photo]'));
      var werk = fotos.map(function (foto) {
        var sleutel = foto.getAttribute('data-world-photo');
        var url = assetUrl(set[sleutel]);
        if (foto.src === url && foto.naturalWidth) return Promise.resolve({ foto: foto, url: url, gelukt: true });
        return laadBeeld(url).then(function (gelukt) { return { foto: foto, url: url, gelukt: gelukt }; });
      });
      if (!eersteKeer) fotos.forEach(function (foto) { foto.closest('.world-card').classList.add('is-changing'); });
      return Promise.all(werk).then(function (resultaten) {
        if (nummer !== wisselNummer) return;
        resultaten.forEach(function (r) {
          if (r.gelukt) r.foto.src = r.url;
          r.foto.closest('.world-card').classList.remove('is-changing');
        });
      });
    }

    function zetDagdeel(dagdeel, eersteKeer) {
      var gekozen = DAGDELEN.indexOf(dagdeel) === -1 ? 'avond' : dagdeel;
      var heroGeladen = heroLagen.some(function (laag) {
        return laag.getAttribute('src') && laag.naturalWidth > 0;
      });
      if (!eersteKeer && gekozen === huidigDagdeel && heroGeladen) return Promise.resolve(gekozen);
      huidigDagdeel = gekozen;
      var nummer = ++wisselNummer;
      var set = beeldsetVoorDagdeel(gekozen);
      d.documentElement.setAttribute('data-dagdeel', gekozen);
      return Promise.all([
        zetHero(assetUrl(set.hero), eersteKeer, nummer),
        zetKaarten(set, eersteKeer, nummer)
      ]).then(function () { return gekozen; });
    }

    function kijkNaarKlok() {
      return zetDagdeel(dagdeelVoorUur(new Date().getHours()), huidigDagdeel === null);
    }

    kijkNaarKlok();
    var klok = w.setInterval(kijkNaarKlok, 60000);
    if (klok && klok.unref) klok.unref();
    d.addEventListener('visibilitychange', function () { if (!d.hidden) kijkNaarKlok(); });

    var menu = d.getElementById('mobileNav');
    var menuKnop = d.getElementById('menuButton');
    var sluitKnop = d.getElementById('menuClose');
    var achtergrond = d.getElementById('menuBackdrop');
    var vorigeFocus = null;
    function sluitMenu() {
      if (!menu || menu.hidden) return;
      menu.hidden = true;
      achtergrond.hidden = true;
      d.body.classList.remove('menu-open');
      menuKnop.setAttribute('aria-expanded', 'false');
      if (vorigeFocus) vorigeFocus.focus();
    }
    function openMenu() {
      if (!menu) return;
      vorigeFocus = d.activeElement;
      menu.hidden = false;
      achtergrond.hidden = false;
      d.body.classList.add('menu-open');
      menuKnop.setAttribute('aria-expanded', 'true');
      var eerste = menu.querySelector('a,button');
      if (eerste) eerste.focus();
    }
    if (menuKnop) menuKnop.addEventListener('click', openMenu);
    if (sluitKnop) sluitKnop.addEventListener('click', sluitMenu);
    if (achtergrond) achtergrond.addEventListener('click', sluitMenu);
    if (menu) menu.querySelectorAll('a').forEach(function (link) { link.addEventListener('click', sluitMenu); });
    d.addEventListener('keydown', function (event) { if (event.key === 'Escape') sluitMenu(); });

    d.querySelectorAll('[data-language-button],#languageButton').forEach(function (knop) {
      knop.addEventListener('click', function () {
        if (w.RTGi18n && typeof w.RTGi18n.openModal === 'function') w.RTGi18n.openModal();
      });
    });

    var jaar = d.getElementById('currentYear');
    if (jaar) jaar.textContent = String(new Date().getFullYear());

    w.RTGStart = {
      dagdeelVoorUur: dagdeelVoorUur,
      beeldsetVoorDagdeel: beeldsetVoorDagdeel,
      verversDagdeel: kijkNaarKlok
    };
  }

  return { dagdeelVoorUur: dagdeelVoorUur, beeldsetVoorDagdeel: beeldsetVoorDagdeel, start: start };
});
