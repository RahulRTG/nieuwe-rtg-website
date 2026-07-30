/* RTG Office, het rekenblad: de vier dingen waarvoor men elders betaalt.

   FUNCTIES ZOEKEN. Er zijn ruim honderd functies. Een lijst die niemand kan
   vinden is geen functie maar een geheim, dus staat er een zoekvak dat de
   naam ín uw cel zet. Wie SOM typt vindt ook SUM.
   SORTEREN. Op de kolom waar u staat, over de rijen die u aanwijst.
   FILTEREN. Verbergt rijen die niet aan uw eis voldoen. Een filter hoort NIET
   bij het document -- hij wordt niet bewaard, want hij zegt hoe u nu kijkt,
   niet wat er staat. Sluit u het blad, dan staat alles er weer.
   GRAFIEK. Getekend met SVG, uit uw eigen cellen. Geen bibliotheek van een
   vreemde server: die zou de beveiligingsregels van de app niet eens halen.

   WAT SORTEREN WEL DOET EN EEN FILTER NIET: sorteren VERPLAATST uw cellen
   echt. Dat is ingrijpend, dus het gebeurt alleen op de rijen die u opgeeft
   en het staat er met zoveel woorden bij. */
(function () {
  'use strict';
  var M = window.RTGRekenmotor;

  function el(soort, klasse, wat) {
    var e = document.createElement(soort);
    if (klasse) e.className = klasse;
    if (wat != null) e.textContent = wat;
    return e;
  }
  function knop(naam, doe, titel) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'tb'; b.textContent = naam;
    if (titel) b.title = titel;
    b.addEventListener('click', doe);
    return b;
  }
  // Eén paneel tegelijk: twee open vensters over een raster is een rommeltje.
  var open = null;
  function paneel(titel) {
    sluit();
    var p = el('div', 'bladpaneel');
    var kop = el('div', 'bpkop');
    kop.appendChild(el('strong', null, titel));
    kop.appendChild(knop('Sluiten', sluit));
    p.appendChild(kop);
    document.body.appendChild(p);
    open = p;
    return p;
  }
  function sluit() { if (open && open.parentNode) open.parentNode.removeChild(open); open = null; }

  var refVan = function (s) { var m = /^([A-Z]+)(\d+)$/.exec(s || ''); return m ? { kol: m[1], rij: +m[2] } : null; };

  /* ---- de functies ---- */
  function functies(blad) {
    var p = paneel('Functies');
    var tabel = (window.RTGRekenfuncties && window.RTGRekenfuncties.tabel) || {};
    var namen = Object.keys(tabel).sort();
    var zoek = document.createElement('input');
    zoek.className = 'bpveld'; zoek.placeholder = 'Zoek een functie, bijvoorbeeld SOM of ZOEKEN';
    zoek.setAttribute('aria-label', 'Zoek een functie');
    p.appendChild(zoek);
    p.appendChild(el('p', 'bpstil', namen.length + ' functienamen, Nederlands en Engels door elkaar. ' +
      'Klik er een aan en hij staat in uw cel; u vult zelf aan wat ertussen moet.'));
    var lijst = el('div', 'bplijst');
    p.appendChild(lijst);
    function vul() {
      var q = zoek.value.trim().toUpperCase();
      lijst.textContent = '';
      var raak = namen.filter(function (n) { return !q || n.indexOf(q) >= 0; }).slice(0, 120);
      if (!raak.length) { lijst.appendChild(el('p', 'bpstil', 'Die naam ken ik niet.')); return; }
      raak.forEach(function (n) {
        lijst.appendChild(knop(n, function () {
          blad.zetFormule('=' + n + '(');
          sluit();
        }, 'Zet =' + n + '( in de cel'));
      });
    }
    zoek.addEventListener('input', vul);
    vul();
    zoek.focus();
  }

  /* ---- sorteren ----
     Op de kolom waar u staat. De rijen die meegaan geeft u zelf op, want het
     blad kan niet weten waar uw tabel ophoudt -- en gokken zou betekenen dat
     er cellen verschuiven die u er niet bij wilde. */
  function sorteren(blad) {
    if (!blad.mag()) return;
    var hier = refVan(blad.actief());
    if (!hier) return;
    var d = blad.data();
    var p = paneel('Sorteren op kolom ' + hier.kol);
    var van = velden(p, 'Van rij', hier.rij), tot = velden(p, 'Tot en met rij', d.rijen);
    p.appendChild(el('p', 'bpstil', 'De rijen worden echt verplaatst, met alle kolommen mee. ' +
      'Formules die naar een vaste cel wijzen, blijven naar diezelfde cel wijzen.'));
    var doe = function (omhoog) {
      return function () {
        var a = Math.max(1, +van.value || 1), b = Math.min(d.rijen, +tot.value || d.rijen);
        if (b <= a) return;
        var blok = [];
        for (var r = a; r <= b; r++) {
          var rij = {};
          for (var k = 0; k < d.kolommen; k++) {
            var ref = M.kolNaam(k) + r;
            rij[M.kolNaam(k)] = { w: d.cellen[ref], o: d.opmaak[ref] };
          }
          blok.push({ sleutel: blad.uitkomst(hier.kol + r), rij: rij });
        }
        // eerst onthouden wat er stond: een sortering is met Ctrl+Z een stap terug
        var groep = [];
        for (var r2 = a; r2 <= b; r2++) for (var k2 = 0; k2 < d.kolommen; k2++) {
          var ref2 = M.kolNaam(k2) + r2;
          groep.push({ ref: ref2, oud: d.cellen[ref2], opm: d.opmaak[ref2] || null });
        }
        blad.onthoud(groep);
        blok.sort(function (x, y) {
          var beide = M.isGetallig(x.sleutel) && M.isGetallig(y.sleutel);
          var p1 = beide ? M.getalVan(x.sleutel) : M.tekstVan(x.sleutel).toLowerCase();
          var p2 = beide ? M.getalVan(y.sleutel) : M.tekstVan(y.sleutel).toLowerCase();
          return (p1 < p2 ? -1 : p1 > p2 ? 1 : 0) * (omhoog ? 1 : -1);
        });
        blok.forEach(function (b2, i) {
          for (var k = 0; k < d.kolommen; k++) {
            var kol = M.kolNaam(k), ref = kol + (a + i), cel = b2.rij[kol];
            if (cel.w) d.cellen[ref] = cel.w; else delete d.cellen[ref];
            if (cel.o) d.opmaak[ref] = cel.o; else delete d.opmaak[ref];
          }
        });
        blad.vernieuw();
        sluit();
      };
    };
    var rij2 = el('div', 'bprij');
    rij2.appendChild(knop('A → Z / laag → hoog', doe(true)));
    rij2.appendChild(knop('Z → A / hoog → laag', doe(false)));
    p.appendChild(rij2);
  }

  function velden(p, naam, waarde) {
    var wrap = el('label', 'bplabel');
    wrap.appendChild(el('span', null, naam));
    var v = document.createElement('input');
    v.type = 'number'; v.min = '1'; v.className = 'bpveld'; v.value = String(waarde);
    wrap.appendChild(v);
    p.appendChild(wrap);
    return v;
  }

  /* ---- filteren ---- */
  function filteren(blad) {
    var hier = refVan(blad.actief());
    if (!hier) return;
    var d = blad.data();
    var p = paneel('Filter op kolom ' + hier.kol);
    var eis = document.createElement('input');
    eis.className = 'bpveld';
    eis.placeholder = 'Bijvoorbeeld >100, <=0, of een woord';
    eis.setAttribute('aria-label', 'Waar de rijen aan moeten voldoen');
    p.appendChild(eis);
    p.appendChild(el('p', 'bpstil', 'Rijen die er niet aan voldoen verdwijnen uit beeld, niet uit het ' +
      'document. De filter wordt niet bewaard: sluit u het blad, dan staat alles er weer.'));
    var rij = el('div', 'bprij');
    rij.appendChild(knop('Toepassen', function () {
      var F = window.RTGRekenfuncties;
      var raak = F.toets(eis.value, M);
      d.verborgen = {};
      for (var r = 1; r <= d.rijen; r++) {
        var w = blad.uitkomst(hier.kol + r);
        if (w !== '' && !raak(w)) d.verborgen[r] = true;
      }
      blad.hertekenen();
      sluit();
    }));
    rij.appendChild(knop('Filter eraf', function () {
      d.verborgen = null;
      blad.hertekenen();
      sluit();
    }));
    p.appendChild(rij);
  }

  window.RTGOfficeBladPro = {
    balk: function (host, blad) {
      var groep = el('span', 'groep');
      groep.appendChild(knop('Functies', function () { functies(blad); }, 'Zoek in alle functies'));
      if (window.RTGOfficeBladReeks) {
        groep.appendChild(knop('Doorvoeren', function () { window.RTGOfficeBladReeks.open(blad); },
          'Rol deze cel uit over een reeks; verwijzingen schuiven mee'));
      }
      groep.appendChild(knop('Sorteren', function () { sorteren(blad); }, 'Sorteer op deze kolom'));
      groep.appendChild(knop('Filter', function () { filteren(blad); }, 'Toon alleen rijen die voldoen'));
      if (window.RTGOfficeGrafiek) {
        groep.appendChild(knop('Grafiek', function () { window.RTGOfficeGrafiek.open(blad); },
          'Teken deze kolom'));
      }
      host.appendChild(groep);
    },
    // Het paneel en de veldjes zijn hier gemaakt; de grafiek gebruikt ze mee.
    // Twee keer hetzelfde venster bouwen zou twee keer hetzelfde onderhoud zijn.
    hulp: { el: el, knop: knop, paneel: paneel, sluit: sluit, velden: velden, refVan: refVan }
  };
})();
