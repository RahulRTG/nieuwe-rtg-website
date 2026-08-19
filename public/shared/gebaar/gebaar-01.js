/* RTG Gebaren -- deel 1: de kern, de tekens en het licht.

   WAT DEZE LAAG IS. Een regel in dit huis is een plank met twee laden eronder.
   Veeg naar links en de rechterlade komt tevoorschijn, veeg naar rechts en de
   linker. Veeg door en de eerste actie van die lade gebeurt. Houd vast, klik
   rechts of druk de menutoets en je krijgt dezelfde acties als lijst.

   WAAROM HIJ GEDEELD IS EN NIET PER SCHERM. Acht werelden die elk hun eigen
   veeg verzinnen, zijn acht bedieningen die net anders zijn -- en een gebaar dat
   per scherm iets anders betekent is erger dan geen gebaar (LAT.md regel 4). De
   drempel, de haptiek, de terugweg en de toetsenbordweg staan hier EEN keer.

   WAT EEN SCHERM ZELF DOET: zeggen WELKE acties een regel draagt. Niets meer.

     RTGGebaar.zet(rij, { titel:'Nieuw document', links:[...], rechts:[...] });
     RTGGebaar.lijst(container, '.reis', function (rij) { return {...}; });

   Een actie is { naam, teken, sig, doe, borg }. doe(rij) mag een functie
   teruggeven; dat is de TERUGWEG, en die verschijnt dan als terugdraai-melding.
   borg:true betekent: deze gaat nooit op een veeg, alleen op vasthouden.

   IN RUST DOET DEZE LAAG NIETS. Geen element erbij, geen stijl erover. Alles
   wordt gemaakt op het moment dat een hand of een toets erom vraagt, en weer
   opgeruimd als de lade dichtgaat. */
(function () {
  'use strict';
  if (window.RTGGebaar) return;

  var d = document;
  var rustig = function () {
    try {
      return matchMedia('(prefers-reduced-motion: reduce)').matches ||
        d.documentElement.classList.contains('rtg-stil');
    } catch (e) { return false; }
  };
  var en = function () {
    try {
      return (localStorage.getItem('rtg_lang') || d.documentElement.lang || 'nl').indexOf('en') === 0;
    } catch (e) { return false; }
  };
  /* Twee talen zonder een taaltabel op te tuigen: deze laag heeft acht woorden.
     Staat RTGi18n er wel, dan wint die -- de laag is geen tweede taalrail. */
  function T(sleutel, nl, eng) {
    if (window.RTGi18n && window.RTGi18n.t) return window.RTGi18n.t(sleutel, nl);
    return en() ? eng : nl;
  }

  /* Het blad hoort bij de laag en niet bij de pagina: een scherm dat gebaren
     wil, hoeft geen <link> te onthouden. Een keer, en alleen als hij er nog
     niet staat. */
  if (!d.querySelector('link[href="/shared/gebaar.css"]')) {
    var l = d.createElement('link');
    l.rel = 'stylesheet'; l.href = '/shared/gebaar.css';
    (d.head || d.documentElement).appendChild(l);
  }

  /* ------------------------------------------------------------- tekens --
     Eigen set, 24x24 grid, een lijndikte (ONTWERP.md par. 13). Ze staan hier en
     niet in shared/glyf.js omdat die set over APPS gaat (bellen, salon, wallet)
     en deze over HANDELINGEN. Twee sets met elk een eigen onderwerp is geen
     dubbeling; dezelfde handeling in twee sets tekenen zou dat wel zijn. */
  var TEKEN = {
    openen:   '<path d="M5 12h14M13 6l6 6-6 6"/>',
    kenmerk:  '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
    delen:    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
    uitstel:  '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    gereed:   '<path d="M20 6L9 17l-5-5"/>',
    rahul:    '<path d="M12 3l2.1 5.4L19.5 10l-5.4 2.1L12 17.5 9.9 12.1 4.5 10l5.4-1.6z"/>',
    archief:  '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>',
    ingrijp:  '<path d="M12 9v4M12 17h.01M10.3 3.9L2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
    meer:     '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>'
  };
  function svg(naam) {
    var p = TEKEN[naam] || TEKEN.openen;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }

  /* ---------------------------------------------------------- de kaartenbak --
     WeakMap en geen data-attribuut: een actie is een FUNCTIE, en die past niet
     in een attribuut zonder hem in een string te persen en later te evalueren.
     Weak, dus een rij die uit het scherm verdwijnt neemt zijn acties mee. */
  var boek = new WeakMap();
  var lijsten = [];   // {wortel, kiezer, bouwer}

  function actiesVan(rij) {
    if (boek.has(rij)) return boek.get(rij);
    for (var i = 0; i < lijsten.length; i++) {
      var s = lijsten[i];
      if (s.wortel.contains(rij) && rij.matches(s.kiezer)) {
        var a = normaliseer(s.bouwer(rij));
        if (a) boek.set(rij, a);
        return a;
      }
    }
    return null;
  }

  /* Een lade zonder acties is een lege lade, en die hoort niet open te gaan.
     Hier valt hij weg, en niet drie lagen dieper met een halve animatie. */
  function schoon(l) {
    return (l || []).filter(function (a) { return a && a.naam && typeof a.doe === 'function'; });
  }
  function normaliseer(a) {
    if (!a) return null;
    var links = schoon(a.links), rechts = schoon(a.rechts);
    if (!links.length && !rechts.length) return null;
    return { titel: a.titel || '', links: links, rechts: rechts };
  }

  /* De klasse moet er staan VOOR de eerste aanraking: touch-action wordt door de
     browser gelezen op het moment dat de vinger neerkomt, niet daarna. Een rij
     die zijn klasse pas bij pointerdown krijgt, veegt die ene keer dus niet --
     en dat is precies het soort fout dat je zelf nooit ziet omdat de tweede
     poging wel werkt. */
  function merk(wortel, kiezer) {
    var r = wortel.querySelectorAll(kiezer);
    for (var i = 0; i < r.length; i++) merkEen(r[i]);   // merkEen staat in deel 4
  }

  /* --------------------------------------------------- licht volgt de hand --
     MATERIAAL.md: licht is een eigenschap van het materiaal, geen effect. Onder
     een fijne aanwijzer weet het vlak waar de hand is, en het blad zet daar EEN
     lichtpunt neer -- geborsteld metaal heeft een richting, glitter heeft er
     tien. Dit is geen tweede truc naast de veeg maar dezelfde gedachte: het
     materiaal reageert op licht, of dat licht nu een vinger is of een muis.

     Een luisteraar op het document en niet honderd op de knoppen, gedempt op
     een animatieframe. Op een telefoon staat hij helemaal uit: daar hangt geen
     hand boven het glas, en dan is dit alleen batterij. */
  var fijn = false;
  try { fijn = matchMedia('(hover:hover) and (pointer:fine)').matches; } catch (e) {}
  if (fijn) {
    var wacht = false, laatst = null;
    d.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || rustig()) return;
      laatst = e;
      if (wacht) return;
      wacht = true;
      requestAnimationFrame(function () {
        wacht = false;
        var t = laatst && laatst.target;
        var el = t && t.closest && t.closest('.rtg-knop,.gb-rij');
        if (!el) return;
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        el.style.setProperty('--gb-lx', ((laatst.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        el.style.setProperty('--gb-ly', ((laatst.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      });
    }, { passive: true });
  }
