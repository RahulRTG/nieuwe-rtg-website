/* OMHOOG TREKKEN IS OVERAL: MEER. En dat is het enige wat je hoeft te weten.

   WAT DIT VERVANGT. Een gewone app leert je vier plekken waar "meer" kan zitten:
   het driepuntjesmenu, de zijbalk, het tandwiel en een modaal venster. Vier
   vormen voor één bedoeling, en welke het is verschilt per scherm. Hier is het
   één beweging, in twee trappen:

     een kleine veeg omhoog   het uitgebreide gereedschap van waar je bent
     verder omhoog            de volledige werkmodus: alles, gegroepeerd

   Dat is dezelfde beweging in Docs, in Sheets, in Geld en in HR. Wie hem één keer
   leert, kent hem in het hele huis -- en dat is wat een grammatica moet doen.

   DE TWEEDE TRAP IS GEEN ANDERE INHOUD, MAAR MEER RUIMTE. Wie doorschuift krijgt
   niet plotseling andere handelingen; hij krijgt dezelfde handelingen met hun
   groepen eromheen en ruimte om te lezen. Zou de tweede trap iets ANDERS tonen,
   dan is het geen diepte maar een tweede menu, en dan zijn we terug bij vier
   plekken.

   EN HET DOCK ZAKT NIET WEG. De verleiding is groot om tijdens het scrollen het
   hele dock te laten verdwijnen -- dat staat mooi. Maar de eerste zin van deze
   grammatica is "ik wil iets doen, mijn duim vindt het onderaan", en een dock dat
   weg is op het moment dat je leest, breekt precies die zin. Wat hier wél wijkt
   is de CHROME: de trust rail zakt in en de naam van het blad valt weg. De
   handelingen blijven staan waar ze stonden.

   Levert window.RTGDiepte. */
(function (w, d) {
  'use strict';
  if (w.RTGDiepte) return;

  var EERSTE = 44;      // vanaf hier: het uitgebreide gereedschap
  var TWEEDE = 150;     // vanaf hier: de volledige werkmodus
  var RUST = 1400;      // zo lang na de laatste beweging is het weer stil

  var knoppen = null, rustklok = 0;

  function root() { return d.getElementById('rtgCommand'); }
  function balk() { var r = root(); return r && r.querySelector('.cmd-balk'); }

  function bouwer() {
    if (knoppen) return knoppen;
    if (!w.RTGAdaptiefBalkKnoppen) return null;
    knoppen = w.RTGAdaptiefBalkKnoppen({
      items: function () { return (w.RTGAdaptief && w.RTGAdaptief.voorNu()) || []; },
      titel: function () { return (w.RTGAdaptief && w.RTGAdaptief.context().titel) || 'Handelingen'; }
    });
    return knoppen;
  }

  /* ------------------------------------------------------------ de trappen -- */
  function eerste() {
    var k = bouwer();
    if (k) k.openLade();
  }
  /* De volledige werkmodus. Dezelfde handelingen, met hun groepen als kopjes en
     ruimte eromheen -- en met een sluitknop die zegt "Klaar", want dit is een
     modus waar je uit stapt en geen menu dat je wegklikt. */
  function tweede() {
    var A = w.RTGAdaptief, L = w.RTGLagen, k = bouwer();
    if (!A || !L || !k) return;
    var items = A.voorNu();
    if (!items.length) return;
    L.taak({
      titel: A.context().titel || 'Alle handelingen',
      klaarLabel: 'Klaar',
      klaar: function () {},
      inhoud: function (lijf) {
        var groep = null;
        items.forEach(function (it) {
          var naam = it.groep || 'Handelingen';
          if (naam !== groep) {
            groep = naam;
            var kop = d.createElement('p');
            kop.className = 'lg-kopje';
            kop.textContent = naam;
            lijf.appendChild(kop);
          }
          var r = d.createElement('button');
          r.type = 'button';
          r.className = 'lg-rij' + (it.verhinderd ? ' verhinderd' : '');
          if (it.verhinderd) r.setAttribute('aria-label', it.naam + ', niet beschikbaar. Tik voor de reden.');
          if (it.aan !== undefined) r.setAttribute('aria-pressed', it.aan ? 'true' : 'false');
          var t = d.createElement('span');
          t.className = 'lg-teken';
          t.textContent = it.label || '';
          r.appendChild(t);
          r.appendChild(d.createTextNode(it.naam));
          r.onclick = function () {
            L.sluit();
            if (w.RTGGewicht) w.RTGGewicht.voer(it);
            else A.doe(it.id);
          };
          lijf.appendChild(r);
        });
      }
    });
  }

  /* --------------------------------------------------------------- de veeg --
     Hij begint op de balk zelf en niet op een knop: een duim die op "vet" staat
     is aan het mikken, niet aan het slepen. Vandaar dat een veeg die op een knop
     begint pas meetelt als hij écht omhoog gaat -- de drempel doet dat werk,
     want een tik verplaatst nul pixels.

     Terwijl je trekt loopt het dock mee omhoog. Zonder die terugkoppeling is het
     een gebaar dat je moet geloven, en dan gebruikt niemand het. */
  function haak(b) {
    if (!b || b._diepte) return;
    b._diepte = 1;
    var y0 = 0, bezig = false, ver = 0, gevangen = false, pid = null;
    var GRIJP = 8;
    function neer(e) {
      if (b.classList.contains('vraagt')) return;         // Rahul heeft de balk
      y0 = e.clientY; bezig = true; ver = 0; gevangen = false; pid = e.pointerId;
      b.style.transition = 'none';
    }
    function beweeg(e) {
      if (!bezig) return;
      ver = y0 - e.clientY;
      /* DE AANWIJZER WORDT PAS GEVANGEN ALS DIT ECHT EEN SLEEP IS, en dat is hier
         twee keer misgegaan.

         Zonder vangst stopt de meting op de rand van de balk: omhoog trekken
         betekent per definitie dat je duim hem verlaat (48px hoog, tweede trap op
         150), en dan gaat pointermove naar het element eronder. De tweede trap
         was daarmee niet te halen.

         Maar vangen op pointerdown is nog erger: dan stal de balk de tik van elke
         knop erin. Een handeling aantikken deed niets meer -- het gebaar had de
         bediening opgegeten. Vandaar de drempel: onder acht pixels is het een tik
         en blijft de balk overal vanaf. */
      if (!gevangen && ver > GRIJP) {
        gevangen = true;
        try { b.setPointerCapture(e.pointerId); } catch (x) {}
      }
      if (ver <= 0) { b.style.transform = ''; b.dataset.trek = ''; return; }
      /* Meebewegen met weerstand: de eerste pixels volgen, daarna loopt het
         langzamer -- zo voelt de tweede trap verder weg dan de eerste, wat hij
         ook is. */
      var mee = ver < EERSTE ? ver : EERSTE + (ver - EERSTE) * 0.35;
      b.style.transform = 'translateY(' + (-Math.min(mee, 90)) + 'px)';
      b.dataset.trek = ver >= TWEEDE ? 'twee' : (ver >= EERSTE ? 'een' : '');
    }
    function los() {
      if (!bezig) return;
      bezig = false;
      /* DE VANGST WORDT EXPLICIET LOSGELATEN. De browser doet dat bij pointerup
         ook zelf, maar "meestal ook zelf" is geen toestand om op te bouwen: een
         vangst die blijft hangen maakt het VOLGENDE gebaar onmogelijk, en dat is
         een fout die pas bij de tweede keer optreedt -- precies het soort dat
         niemand tijdens het bouwen ziet. */
      if (gevangen && pid !== null) { try { b.releasePointerCapture(pid); } catch (x) {} }
      gevangen = false; pid = null;
      b.style.transition = '';
      b.style.transform = '';
      b.dataset.trek = '';
      if (ver >= TWEEDE) tweede();
      else if (ver >= EERSTE) eerste();
      ver = 0;
    }
    b.addEventListener('pointerdown', neer);
    b.addEventListener('pointermove', beweeg);
    /* pointerleave staat er niet meer bij: met vangst hoort hij niet te vuren, en
       vuurt hij toch, dan zou hij het gebaar halverwege afkappen. */
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { b.addEventListener(n, los); });
  }

  /* -------------------------------------------------------------- de rust --
     Wie leest of typt is bezig; dan zakt de chrome in. Wie stopt, krijgt hem
     terug. Er staat geen knop voor: een instelling voor iets wat vanzelf hoort
     te gaan, is een instelling te veel. */
  function bezig() {
    var b = balk();
    if (!b) return;
    b.dataset.bezig = '1';
    if (rustklok) w.clearTimeout(rustklok);
    rustklok = w.setTimeout(function () { rustklok = 0; if (balk()) balk().dataset.bezig = ''; }, RUST);
  }

  function start() {
    var b = balk();
    if (b) haak(b);
  }
  /* De werktafel wordt opnieuw opgebouwd zodra de stand wisselt, dus haken we
     opnieuw aan zodra de context beweegt -- goedkoop, want haak() slaat een balk
     over die hij al kent. */
  if (w.RTGAdaptief) w.RTGAdaptief.opContext(start);
  d.addEventListener('rtg-blad-beweegt', bezig);
  d.addEventListener('scroll', bezig, { passive: true, capture: true });
  d.addEventListener('input', bezig, true);
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();

  w.RTGDiepte = { eerste: eerste, tweede: tweede, bezig: bezig, start: start,
    DREMPELS: { eerste: EERSTE, tweede: TWEEDE } };
})(window, document);
