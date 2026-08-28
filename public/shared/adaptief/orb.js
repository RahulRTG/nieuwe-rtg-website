/* DE ORB: de gouden ingang rechts in het dock, en waarom hij niets mag beslissen.

   WAT HIJ WORDT. Rechts in het dock staat Rahul. Een tik opent zijn vraagveld --
   dat blijft zo (WERELD.md: de balk die je hebt verandert van taak, er komt geen
   paneel overheen). Lang drukken doet wat lang drukken overal in dit huis doet:
   uitleggen. Hier betekent dat: "wat kan ik hier eigenlijk?"

   En dan staat er niet een lijst met alles wat RTG kan. Er staat wat HIER kan,
   afgeleid uit de capabilities die dit scherm zelf heeft aangemeld.

   DE GRENDEL, EN HIJ IS HET HELE PUNT. De orb mag VOORSTELLEN. Wat er
   daadwerkelijk gebeurt, loopt langs precies dezelfde weg als een tik in het
   dock:

     de capability moet bestaan       (het scherm heeft hem aangemeld)
     de verhindering moet weg zijn    (beleid, classificatie, bevoegdheid, bewijs)
     het gewicht moet worden voldaan  (bevestigen, een reden, een mens)

   Er is dus geen route waarlangs "vraag het aan Rahul" iets doet wat je met je
   duim niet had gemogen. Dat is geen extra veiligheidslaag maar het ONTBREKEN
   van een tweede weg -- en dat is sterker, want een tweede weg is precies wat er
   over een jaar vergeten wordt bij te werken.

   DRIE DINGEN DIE HIJ NIET DOET.

   1. Hij verzint geen handelingen. Wat niet is aangemeld, staat er niet. Een
      voorstel dat nergens op slaat is erger dan geen voorstel: het leert een lid
      dat de suggesties niet te vertrouwen zijn, en daarna leest hij ze niet meer.
   2. Hij verbergt geen verhinderde handeling. Die staat er juist WEL, met zijn
      reden -- want "kan ik dit hier?" met als antwoord stilte is precies de
      vraag die deze laag moest oplossen.
   3. Hij maakt niets af wat een mens hoort af te maken. Een `plechtig`
      handeling die je hier aantikt, komt op dezelfde twee lades uit als vanuit
      het dock (GELD.md: geld verlaat het huis nooit vanzelf; CLAUDE.md: de AI
      belooft en verleent nooit zelf toegang).

   Levert window.RTGOrb. */
(function (w, d) {
  'use strict';
  if (w.RTGOrb) return;

  var LANG = 480;

  function root() { return d.getElementById('rtgCommand'); }
  function mond() { var r = root(); return r && r.querySelector('.cmd-mondknop'); }

  /* Wat er te doen valt, gesplitst in wat kan en wat niet kan. Beide lijsten
     staan er; het verschil is dat de tweede zijn reden draagt. */
  function voorstellen() {
    var A = w.RTGAdaptief;
    if (!A) return { kan: [], niet: [] };
    var items = A.voorNu();
    return {
      kan: items.filter(function (x) { return !x.verhinderd; }),
      niet: items.filter(function (x) { return !!x.verhinderd; })
    };
  }

  function kopje(lijf, tekst) {
    var p = d.createElement('p');
    p.className = 'lg-kopje';
    p.textContent = tekst;
    lijf.appendChild(p);
  }

  function rij(lijf, it) {
    var r = d.createElement('button');
    r.type = 'button';
    r.className = 'lg-rij' + (it.verhinderd ? ' verhinderd' : '');
    if (it.verhinderd) r.setAttribute('aria-label', it.naam + ', niet beschikbaar. Tik voor de reden.');
    var t = d.createElement('span');
    t.className = 'lg-teken';
    t.textContent = it.label && it.label.length <= 3 ? it.label : '';
    r.appendChild(t);
    r.appendChild(d.createTextNode(it.naam));
    /* HET GEWICHT STAAT ERBIJ, en dat is geen versiering. Wie leest dat iets
       "vraagt bevestiging" weet vooraf waar hij aan begint; wie dat pas merkt als
       de lade opengaat, heeft het gevoel dat de software hem tegenhoudt. */
    if (!it.verhinderd && it.gewicht && it.gewicht !== 'licht') {
      var g = d.createElement('span');
      g.className = 'orb-weegt';
      g.textContent = it.gewicht === 'terug' ? 'terug te draaien' : 'vraagt bevestiging';
      r.appendChild(g);
    }
    r.onclick = function () {
      w.RTGLagen.sluit();
      /* Precies dezelfde weg als een tik in het dock. Geen kortere. */
      w.setTimeout(function () {
        if (it.verhinderd && w.RTGWaarom) { w.RTGWaarom.leguit(it); return; }
        if (w.RTGGewicht) { w.RTGGewicht.voer(it); return; }
        if (w.RTGAdaptief) w.RTGAdaptief.doe(it.id);
      }, 60);
    };
    lijf.appendChild(r);
  }

  function open() {
    var A = w.RTGAdaptief, L = w.RTGLagen;
    if (!A || !L) return false;
    var v = voorstellen();
    if (!v.kan.length && !v.niet.length) return false;
    var waar = A.context().titel;
    L.lade({
      titel: waar ? ('Hier: ' + waar) : 'Wat kan hier',
      inhoud: function (lijf) {
        if (v.kan.length) {
          kopje(lijf, 'Dit kan hier');
          v.kan.forEach(function (it) { rij(lijf, it); });
        }
        if (v.niet.length) {
          kopje(lijf, 'Dit kan hier niet');
          v.niet.forEach(function (it) { rij(lijf, it); });
        }
        /* En de eerlijke ondergrens: dit is wat het SCHERM heeft aangemeld, niet
           wat RTG allemaal kan. Wie dat niet weet, leest een korte lijst als een
           arm systeem in plaats van als een precies systeem. */
        var p = d.createElement('p');
        p.className = 'orb-voet';
        p.textContent = 'Dit is wat dit scherm hier aanbiedt. Vraag het gewoon als u iets anders zoekt.';
        lijf.appendChild(p);
      }
    });
    return true;
  }

  /* ------------------------------------------------------------- het haakje --
     Lang drukken opent de voorstellen; de klik die daarop volgt wordt
     tegengehouden, anders opent het vraagveld er meteen overheen. Dat laatste is
     een klassieke: een gebaar dat werkt en tegelijk het gebaar eronder afvuurt,
     leest als een scherm dat op hol slaat. */
  function haak() {
    var m = mond();
    if (!m || m._orb) return;
    m._orb = 1;
    var klok = null, ging = false;
    m.addEventListener('pointerdown', function (e) {
      ging = false;
      /* Houd de aanwijzer aan de orb vast. Tijdens het inschuiven van rail en
         dock kan de knop een paar pixels verplaatsen; zonder capture levert de
         browser dan pointerleave en wordt een echte lange druk geannuleerd. */
      try { m.setPointerCapture(e.pointerId); } catch (fout) {}
      klok = w.setTimeout(function () { klok = null; ging = open(); }, LANG);
    });
    ['pointerup', 'pointercancel'].forEach(function (n) {
      m.addEventListener(n, function () { if (klok) { w.clearTimeout(klok); klok = null; } });
    });
    m.addEventListener('click', function (e) {
      if (!ging) return;
      ging = false;
      e.preventDefault();
      e.stopPropagation();
    }, true);
    /* Een tweede weg ernaartoe die geen gebaar vraagt: de aria-beschrijving zegt
       dat hij er is. Wie niet kan vasthouden, komt bij dezelfde lijst via het
       vraagveld -- daar is "wat kan hier" gewoon een vraag. */
    m.setAttribute('aria-description', 'Tik om te vragen; houd vast voor wat hier kan.');
  }

  if (w.RTGAdaptief) w.RTGAdaptief.opContext(haak);
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', haak);
  else haak();

  w.RTGOrb = { open: open, voorstellen: voorstellen, haak: haak };
})(window, document);
