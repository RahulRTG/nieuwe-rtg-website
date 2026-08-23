/* DE RAND VAN HET SCHERM -- een paneel, geen knop.

   Instellingen zijn geen inhoud; ze horen niet permanent in beeld. Ze komen
   daarom van de rand, zoals een besturingssysteem dat doet:

     vanaf de BOVENRAND omlaag slepen  -> het bedieningspaneel (instellingen)

   Hier zat ook een ONDERRAND: omhoog slepen riep Rahul op. Die is weg, en dat
   is een besluit over hoe het huis werkt. Rahul heeft nu overal dezelfde
   chatbalk (shared/metgezel.js), die je zelf klein of groot maakt. Een tweede
   manier om diezelfde balk op te roepen -- een gebaar dat je moet kennen, dat
   niets toont zolang je het niet doet, en dat op de onderrand van een telefoon
   met de systeembalk vecht -- maakte het niet beter maar onvoorspelbaarder.
   Een ding dat er altijd is, is meer waard dan twee dingen die hetzelfde doen.

   Er ligt geen laag over het scherm: we luisteren gewoon mee op document en
   kijken alleen of een aanraking of muisdruk in de buitenste 24 pixels begon.
   Wat daaronder ligt blijft dus gewoon werken -- een tik op de statusbalk is
   een tik op de statusbalk. Pas bij een echte haal (40 px de goede kant op)
   gaat het paneel open, en tijdens die haal verschijnt een dun gouden streepje
   aan die rand als enige aanwijzing.

   Zonder muis en zonder vinger moet het ook kunnen: er staan twee knoppen in
   de DOM die pas verschijnen als je er met Tab naartoe gaat, precies zoals de
   skip-link van het huis. Verder zijn ze onzichtbaar.

   De rand wordt alleen aangelegd als er iets te openen valt. Wat hij opent
   bouwt hij niet zelf: dat is shared/bediening.js of het bedieningspaneel van
   het leden-OS. */
(function (w, d) {
  'use strict';
  if (w.RTGRanden) return;

  /* Alle Foundation-schermen laden deze module al. Dat maakt dit de ene,
     bestaande ingang voor de nieuwe Foundation-rand, zonder tientallen
     pagina's ieder hun eigen kopie van de navigatie te geven. */
  function startFoundationEdge() {
    var pad = w.location.pathname, wereld = null;
    if (pad.indexOf('/apps/foundation/') === 0 || (pad === '/apps/office.html' && new URLSearchParams(w.location.search).get('werk') === 'rtf')) wereld = 'foundation';
    else if (['/apps/leven.html','/apps/geld.html','/apps/maison.html','/apps/table.html','/apps/garderobe.html','/apps/veilig.html'].includes(pad)) wereld = 'living';
    else if (['/apps/kantoor.html','/apps/kantoren.html','/apps/personeel.html','/apps/agenda.html','/apps/office.html','/apps/rtmail.html','/apps/bestanden.html','/apps/sitemaker.html','/apps/browser.html','/apps/rtgone.html','/apps/onderneming.html','/apps/magnaat.html','/apps/backoffice.html','/apps/command.html','/apps/rtgschool.html'].includes(pad)) wereld = 'work';
    if (!wereld) return false;
    if (new URLSearchParams(w.location.search).get('embed') === '1') {
      d.body.classList.add('rtg-edge-embed');
      d.body.dataset.rtgWorld = wereld;
      var ingebedBlad = d.createElement('link'); ingebedBlad.rel = 'stylesheet';
      ingebedBlad.href = '/shared/rtg-edge-system.css'; d.head.appendChild(ingebedBlad);
      return true;
    }
    var link = d.createElement('link'); link.rel = 'stylesheet'; link.href = '/shared/rtg-edge-system.css'; d.head.appendChild(link);
    function laad(bron, klaar) {
      var script = d.createElement('script'); script.src = bron; script.onload = klaar; d.head.appendChild(script);
    }
    laad('/shared/rtg-edge-worlds.js', function () {
      laad('/shared/rtg-edge-icons.js', function () {
        laad('/shared/rtg-edge-library.js', function () {
          laad('/shared/rtg-edge-system.js', function () {
            var cfg = w.RTGEdgeWorlds[wereld];
            var huidig = cfg.all.find(function (item) {
              try { return new URL(item[3], location.href).pathname === location.pathname; } catch (fout) { return false; }
            });
            w.RTGEdge.start({ world: wereld, context: { scope: cfg.kort, title: huidig ? huidig[1] : d.title,
          tool: huidig ? huidig[0] : '', actie: huidig && huidig[0] === 'foundation-home' ? 'Open Campus' : 'Ga verder' },
          onAction: function () {
            var knop = d.querySelector('main .knop:not([disabled]),main .campus-ingang,main [data-primary]');
            if (knop) knop.click();
          } });
          });
        });
      });
    });
    return true;
  }
  if (startFoundationEdge() && new URLSearchParams(w.location.search).get('embed') === '1') return;

  var RAND = 24;   // hoe dicht bij de rand een haal mag beginnen
  var HAAL = 40;   // hoeveel pixels de goede kant op voordat hij opengaat

  var T = function (k, nl) { return (w.RTGi18n && w.RTGi18n.t) ? w.RTGi18n.t(k, nl) : nl; };

  /* ---- wat er te openen valt ----
     Niets hiervan bouwen we zelf; we wijzen alleen aan wat er al is. */
  function openBoven() {
    if (w.RTGBediening && w.RTGBediening.aanwezig && w.RTGBediening.open) { w.RTGBediening.open(); return true; }
    var cc = d.getElementById('osCcBtn');           // het leden-OS heeft zijn eigen paneel
    if (cc) { cc.click(); return true; }
    return false;
  }
  function kanBoven() {
    return !!((w.RTGBediening && w.RTGBediening.aanwezig) || d.getElementById('osCcBtn'));
  }


  /* ---- de dunne hint tijdens het slepen ---- */
  function stijl() {
    if (d.getElementById('rndCss')) return;
    var s = d.createElement('style'); s.id = 'rndCss';
    s.textContent =
      '.rnd-hint{position:fixed;left:50%;transform:translateX(-50%);z-index:9994;height:4px;border-radius:999px;' +
        'background:var(--gold,#A98F1C);opacity:0;transition:opacity .12s,width .08s;pointer-events:none;width:44px;}' +
      '.rnd-hint.boven{top:calc(env(safe-area-inset-top,0px) + 6px);}' +
      '.rnd-hint.aan{opacity:.85;}' +
      /* Alleen zichtbaar voor wie er met Tab naartoe gaat -- zoals de skip-link.
         Vaste kleuren, niet uit de paginavariabelen: zwart op goud haalt
         4,02:1 (AA vraagt 4,5), wit op bordeaux 10,2. */
      '.rnd-toets{position:fixed;left:.6rem;top:-4rem;z-index:9996;background:#7F1634;color:#FFFFFF;' +
        'border:none;border-radius:0 0 10px 10px;padding:.5rem .9rem;font:700 .8rem Inter,system-ui,sans-serif;' +
        'cursor:pointer;transition:top .15s;}' +
      '.rnd-toets:focus{top:0;}' +
      '@media print{.rnd-hint,.rnd-toets{display:none;}}';
    (d.head || d.documentElement).appendChild(s);
  }

  function hint(waar) {
    var el = d.createElement('div');
    el.className = 'rnd-hint ' + waar;
    el.setAttribute('aria-hidden', 'true');
    d.body.appendChild(el);
    return el;
  }

  function toetsknop(tekst, doe) {
    var b = d.createElement('button');
    b.type = 'button'; b.className = 'rnd-toets';
    b.textContent = tekst;
    b.addEventListener('click', doe);
    return b;
  }

  /* ---- het gebaar ---- */
  function start() {
    if (!d.body) return;
    var boven = kanBoven();
    if (!boven) return;
    stijl();

    var hBoven = hint('boven');
    d.body.appendChild(toetsknop(T('rnd.bov', 'Instellingen openen'), openBoven));

    var bezig = null, y0 = 0, gedaan = false;

    /* Een geslaagde haal moet de klik eronder slikken. De buitenste 24 px is op
       veel schermen ook de onderbalk of de statusbalk; zonder dit opent het
       paneel en volgt daarna alsnog de knop waar je toevallig op begon (op
       Kantoren sprong het scherm zo naar een heel andere app). We luisteren
       eenmalig in de vangfase -- een gewone tik op die balk blijft dus werken,
       alleen de klik die bij het slepen hoort niet. */
    function slikKlik() {
      var eenmalig = function (e) {
        d.removeEventListener('click', eenmalig, true);
        e.preventDefault(); e.stopPropagation();
      };
      d.addEventListener('click', eenmalig, true);
      setTimeout(function () { d.removeEventListener('click', eenmalig, true); }, 700);
    }


    d.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      gedaan = false;
      if (e.clientY <= RAND) { bezig = 'boven'; y0 = e.clientY; }
      else bezig = null;
    }, { passive: true });

    var stop = function () {
      hBoven.classList.remove('aan'); hBoven.style.width = '44px';
      bezig = null;
    };

    d.addEventListener('pointermove', function (e) {
      if (!bezig || gedaan) return;
      var dy = e.clientY - y0;
      hBoven.classList.toggle('aan', dy > 6);
      hBoven.style.width = Math.min(120, 44 + Math.max(0, dy)) + 'px';
      if (dy < HAAL) return;
      gedaan = true; stop();
      // eerst openen, dan pas de slik aanzetten: sommige panelen worden met een
      // eigen klik geopend, en die mag de slik natuurlijk niet opeten
      openBoven();
      slikKlik();
    }, { passive: true });

    d.addEventListener('pointerup', stop, { passive: true });
    d.addEventListener('pointercancel', stop, { passive: true });

    w.RTGRanden = { boven: openBoven };
  }

  // achteraan in de rij: de panelen die we openen moeten er eerst zijn
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { setTimeout(start, 60); });
  else setTimeout(start, 60);
})(window, document);
