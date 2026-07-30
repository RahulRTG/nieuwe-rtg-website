/* DE RANDEN VAN HET SCHERM -- twee panelen, geen knoppen.

   Instellingen en Rahul zijn geen inhoud; ze horen niet permanent in beeld.
   Ze komen daarom van de rand, zoals een besturingssysteem dat doet:

     vanaf de BOVENRAND omlaag slepen  -> het bedieningspaneel (instellingen)
     vanaf de ONDERRAND omhoog slepen  -> de chatbalk van Rahul

   Er ligt geen laag over het scherm: we luisteren gewoon mee op document en
   kijken alleen of een aanraking of muisdruk in de buitenste 24 pixels begon.
   Wat daaronder ligt blijft dus gewoon werken -- een tik op de statusbalk is
   een tik op de statusbalk. Pas bij een echte haal (40 px de goede kant op)
   gaat het paneel open, en tijdens die haal verschijnt een dun gouden streepje
   aan die rand als enige aanwijzing.

   Zonder muis en zonder vinger moet het ook kunnen: er staan twee knoppen in
   de DOM die pas verschijnen als je er met Tab naartoe gaat, precies zoals de
   skip-link van het huis. Verder zijn ze onzichtbaar.

   Elke rand wordt alleen aangelegd als er iets te openen valt. Wat de randen
   openen, bouwen ze niet zelf -- boven is dat shared/bediening.js of het
   bedieningspaneel van het leden-OS, onder is dat de chatbalk van Rahul die
   shared/metgezel.js al in de pagina heeft staan. */
(function (w, d) {
  'use strict';
  if (w.RTGRanden) return;

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

  /* Zes pagina's (mall, hotels, uitgaan, reisbureau, gemeente, overheid) hebben
     hun eigen Rahul: een knop #rahulFab met een blad #rahulSheet ernaast, elk
     met dezelfde inline code. Die knop zweefde permanent rechtsonder. We bouwen
     hem niet na en we knippen die zes scripts niet stuk -- we nemen het paar
     over: de knop gaat weg (met !important, zodat het eigen script hem niet
     terugzet bij sluiten) en zijn klik wordt wat de onderrand aanroept.
     Alleen de losse knop van die pagina's, nooit de chatbalk van
     shared/rahul-mond.js -- die deelt de id maar is geen .rahulfab. */
  function adopteerEigen() {
    var fab = d.querySelector('button#rahulFab.rahulfab');
    if (!fab || (w.RTGRahul && w.RTGRahul.open)) return null;
    if (!d.getElementById('rndFabWeg')) {
      var s = d.createElement('style'); s.id = 'rndFabWeg';
      s.textContent = 'button#rahulFab.rahulfab{display:none !important;}';
      (d.head || d.documentElement).appendChild(s);
    }
    w.RTGRahul = w.RTGRahul || {};
    w.RTGRahul.open = function () { fab.click(); };
    w.RTGRahul.sluit = function () { var x = d.getElementById('rahulSluit'); if (x) x.click(); };
    return w.RTGRahul.open;
  }

  function rahulDoel() {
    // de pagina mag zelf zijn eigen Rahul aanwijzen
    var eigen = d.querySelector('[data-rahul-open]');
    if (eigen) return function () { eigen.click(); };
    var over = adopteerEigen();
    if (over) return over;
    // de gedeelde chatbalk (shared/metgezel.js) staat op bijna elke pagina
    if (w.RTGRahul && w.RTGRahul.open) return w.RTGRahul.open;
    // het leden-OS: Rahul is daar een eigen app in het dock
    var tab = d.querySelector('.os-dock [data-tab="ai"], .tabbar button[data-tab="ai"]');
    if (tab) return function () { tab.click(); };
    return null;
  }
  function openOnder() { var f = rahulDoel(); if (!f) return false; f(); return true; }

  /* ---- de dunne hint tijdens het slepen ---- */
  function stijl() {
    if (d.getElementById('rndCss')) return;
    var s = d.createElement('style'); s.id = 'rndCss';
    s.textContent =
      '.rnd-hint{position:fixed;left:50%;transform:translateX(-50%);z-index:9994;height:4px;border-radius:999px;' +
        'background:var(--gold,#A98F1C);opacity:0;transition:opacity .12s,width .08s;pointer-events:none;width:44px;}' +
      '.rnd-hint.boven{top:calc(env(safe-area-inset-top,0px) + 6px);}' +
      '.rnd-hint.onder{bottom:calc(env(safe-area-inset-bottom,0px) + 6px);}' +
      '.rnd-hint.aan{opacity:.85;}' +
      /* alleen zichtbaar voor wie er met Tab naartoe gaat -- zoals de skip-link */
      '.rnd-toets{position:fixed;left:.6rem;top:-4rem;z-index:9996;background:var(--gold,#A98F1C);color:#0C0C0B;' +
        'border:none;border-radius:0 0 10px 10px;padding:.5rem .9rem;font:700 .8rem Inter,system-ui,sans-serif;' +
        'cursor:pointer;transition:top .15s;}' +
      '.rnd-toets:focus{top:0;}' +
      '.rnd-toets.onder{top:auto;bottom:-4rem;border-radius:10px 10px 0 0;transition:bottom .15s;}' +
      '.rnd-toets.onder:focus{bottom:0;top:auto;}' +
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

  function toetsknop(tekst, waar, doe) {
    var b = d.createElement('button');
    b.type = 'button'; b.className = 'rnd-toets' + (waar === 'onder' ? ' onder' : '');
    b.textContent = tekst;
    b.addEventListener('click', doe);
    return b;
  }

  /* ---- het gebaar ---- */
  function start() {
    if (!d.body) return;
    var boven = kanBoven();
    var onder = !!rahulDoel();
    if (!boven && !onder) return;
    stijl();

    var hBoven = boven ? hint('boven') : null;
    var hOnder = hint('onder');
    if (boven) d.body.appendChild(toetsknop(T('rnd.bov', 'Instellingen openen'), 'boven', openBoven));
    /* De chatbalk komt van shared/metgezel.js, die met defer laadt en dus later
       klaar kan zijn dan wij. We zetten de toetsenbordknop daarom pas neer als
       Rahul er echt is, en kijken nog een paar keer of hij alsnog verschijnt.
       Het randgebaar zelf hangt er altijd; die zoekt zijn doel op het moment
       dat je haalt, en doet niets als er niets te openen valt. */
    var ondKnop = function () {
      if (d.querySelector('.rnd-toets.onder')) return true;
      if (!rahulDoel()) return false;
      onder = true;
      d.body.appendChild(toetsknop(T('rnd.ond', 'Rahul openen'), 'onder', openOnder));
      return true;
    };
    if (!ondKnop()) { var n = 0, tik = setInterval(function () { if (ondKnop() || ++n > 10) clearInterval(tik); }, 800); }

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

    /* De home-pil van het OS (shared/osbar.js) staat middenonder en is zelf al
       een omhoog-veeg: naar het bureaublad, of de app wegleggen. Dat is de
       telefoon-afspraak en die laten we staan. Wie daarnaast langs de onderrand
       omhoog haalt, krijgt Rahul. Twee betekenissen voor één rand mag, zolang
       ze niet op dezelfde plek zitten. */
    var opPil = function (t) { return !!(t && t.closest && t.closest('.os-thuis-pill')); };

    d.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      gedaan = false;
      if (boven && e.clientY <= RAND) { bezig = 'boven'; y0 = e.clientY; }
      else if (e.clientY >= w.innerHeight - RAND && !opPil(e.target)) { bezig = 'onder'; y0 = e.clientY; }
      else bezig = null;
    }, { passive: true });

    var stop = function () {
      if (hBoven) { hBoven.classList.remove('aan'); hBoven.style.width = '44px'; }
      if (hOnder) { hOnder.classList.remove('aan'); hOnder.style.width = '44px'; }
      bezig = null;
    };

    d.addEventListener('pointermove', function (e) {
      if (!bezig || gedaan) return;
      var welke = bezig;
      var dy = welke === 'boven' ? (e.clientY - y0) : (y0 - e.clientY);
      var h = welke === 'boven' ? hBoven : hOnder;
      if (h) {
        h.classList.toggle('aan', dy > 6);
        h.style.width = Math.min(120, 44 + Math.max(0, dy)) + 'px';
      }
      if (dy < HAAL) return;
      gedaan = true; stop();
      // eerst openen, dan pas de slik aanzetten: sommige panelen worden met een
      // eigen klik geopend, en die mag de slik natuurlijk niet opeten
      if (welke === 'boven') openBoven(); else openOnder();
      slikKlik();
    }, { passive: true });

    d.addEventListener('pointerup', stop, { passive: true });
    d.addEventListener('pointercancel', stop, { passive: true });

    w.RTGRanden = { boven: openBoven, onder: openOnder };
  }

  // achteraan in de rij: de panelen die we openen moeten er eerst zijn
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { setTimeout(start, 60); });
  else setTimeout(start, 60);
})(window, document);
