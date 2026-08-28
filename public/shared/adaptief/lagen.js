/* DE TIJDELIJKE LAGEN: lade, paneel en taakmodus -- en de stapel die er maar
   EEN toelaat.

   Drie vormen voor drie verschillende dingen, en het verschil zit in wat je
   ermee doet:

     lade       een keuze of een setje handelingen, boven op wat je las. Wat
                eronder ligt blijft zichtbaar, want je komt zo terug.
     paneel     bijzaak bij de hoofdzaak: eigenschappen, details, commentaar.
                Op tablet schuift hij van rechts in, op telefoon is hij het
                scherm -- dezelfde laag, twee vormen.
     taakmodus  een klus die het hele scherm verdient: presenteren, een
                formulier invullen, een lange bewerking. Alles eromheen wijkt.

   EEN DOMINANTE LAAG TEGELIJK, en dat is hier geen aanbeveling maar de code:
   open() sluit eerst wat er stond. Twee laden over elkaar is de vorm waarin een
   mens niet meer weet waar "terug" heen gaat, en dan gaat hij het scherm
   verlaten in plaats van de laag.

   DRIE MANIEREN OM ERUIT, en alle drie moeten werken: naar beneden vegen, naast
   de laag tikken, en de terugknop van het toestel. Die laatste is de reden dat
   hier met de geschiedenis wordt gewerkt -- een laag die de terugknop niet
   opvangt, laat die knop de hele app verlaten, en dat is op een telefoon het
   verschil tussen een venster sluiten en je werk kwijtraken.

   Levert window.RTGLagen. Werkt in het bovendocument en in een werkblad-frame:
   de laag hoort in het document waar de inhoud staat, want alleen daar weet
   iemand wat erin moet. */
(function (w, d) {
  'use strict';
  if (w.RTGLagen) return;

  var huidig = null, geduwd = false, teller = 0, terugFocus = null;

  function el(tag, klasse, ouder) {
    var e = d.createElement(tag);
    if (klasse) e.className = klasse;
    if (ouder) ouder.appendChild(e);
    return e;
  }

  /* De inhoud komt binnen als knooppunt of als bouwer. Een bouwer krijgt het
     lijf mee en mag er zelf in schrijven; dat scheelt de aanroeper een
     losse createElement-dans voor iets wat toch maar één plek heeft. */
  function vul(lijf, inhoud) {
    if (!inhoud) return;
    if (typeof inhoud === 'function') { try { inhoud(lijf); } catch (e) {} return; }
    if (inhoud.nodeType === 1) { lijf.appendChild(inhoud); return; }
    lijf.textContent = String(inhoud);
  }

  /* -------------------------------------------------------- de focusval --
     Een laag die het scherm afdekt maar de focus niet vasthoudt, laat een
     toetsenbord- of schermlezergebruiker achter de laag verder tabben: hij
     bedient dan wat hij niet ziet. Terug naar waar hij vandaan kwam hoort er
     net zo goed bij -- anders staat de focus na het sluiten op <body> en begint
     het tabben weer bovenaan de pagina. */
  var TABBAAR = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
    'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function opToets(e) {
    if (!huidig) return;
    if (e.key === 'Escape') { e.preventDefault(); sluit(); return; }
    if (e.key !== 'Tab') return;
    var kan = huidig.vak.querySelectorAll(TABBAAR);
    if (!kan.length) return;
    var eerste = kan[0], laatste = kan[kan.length - 1];
    if (e.shiftKey && d.activeElement === eerste) { e.preventDefault(); laatste.focus(); }
    else if (!e.shiftKey && d.activeElement === laatste) { e.preventDefault(); eerste.focus(); }
  }

  /* ------------------------------------------------------------- vegen --
     Alleen naar BENEDEN, en alleen vanaf de greep of de kop. Een veeg midden in
     de inhoud is scrollen; die afvangen maakt een lade die je niet kunt lezen.
     Onder de drempel veert hij terug -- een laag die bij twee pixels al dichtgaat
     leest als een laag die vanzelf wegvalt. */
  function haakVeeg(laag) {
    var vak = laag.vak, start = 0, bezig = false;
    function neer(e) {
      if (!e.target.closest('.lg-greep,.lg-kop')) return;
      start = e.touches ? e.touches[0].clientY : e.clientY; bezig = true;
      vak.style.transition = 'none';
    }
    function schuif(e) {
      if (!bezig) return;
      var y = (e.touches ? e.touches[0].clientY : e.clientY) - start;
      if (y < 0) y = 0;
      vak.style.transform = 'translateY(' + y + 'px)';
    }
    function los(e) {
      if (!bezig) return;
      bezig = false;
      vak.style.transition = '';
      var y = parseFloat((vak.style.transform.match(/translateY\(([-\d.]+)px\)/) || [0, 0])[1]) || 0;
      vak.style.transform = '';
      if (y > 90) sluit();
      else if (e && e.preventDefault) e.preventDefault();
    }
    vak.addEventListener('touchstart', neer, { passive: true });
    vak.addEventListener('touchmove', schuif, { passive: true });
    vak.addEventListener('touchend', los);
  }

  /* --------------------------------------------------------- de opbouw --
     Eén bouwer voor de drie soorten: ze verschillen in stijl en in wat de kop
     draagt, niet in wat ze zijn. Twee bouwers zouden twee focusvallen en twee
     sluitwegen geven, en dan is er over een maand één die het niet meer doet. */
  function bouw(soort, spec) {
    sluit(true);                          // één dominante laag tegelijk
    var o = spec || {};
    terugFocus = d.activeElement;
    var wortel = el('div', 'rtg-laag rtg-laag-' + soort);
    wortel.setAttribute('data-soort', soort);
    var doek = el('div', 'lg-doek', wortel);
    var vak = el('section', 'lg-vak', wortel);
    vak.setAttribute('role', 'dialog');
    vak.setAttribute('aria-modal', 'true');
    if (o.titel) vak.setAttribute('aria-label', o.titel);
    if (soort === 'lade') el('div', 'lg-greep', vak).setAttribute('aria-hidden', 'true');
    if (o.titel || soort !== 'lade') {
      var kop = el('header', 'lg-kop', vak);
      var t = el('h2', 'lg-titel', kop);
      t.textContent = o.titel || '';
      var x = el('button', 'lg-sluit', kop);
      x.type = 'button';
      x.setAttribute('aria-label', o.sluitLabel || 'Sluiten');
      x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      x.onclick = function () { sluit(); };
    }
    var lijf = el('div', 'lg-lijf', vak);
    vul(lijf, o.inhoud);
    if (o.klaar) {
      var voet = el('footer', 'lg-voet', vak);
      var kn = el('button', 'lg-klaar', voet);
      kn.type = 'button';
      kn.textContent = o.klaarLabel || 'Klaar';
      kn.onclick = function () { var f = o.klaar; sluit(); if (typeof f === 'function') f(); };
    }
    d.body.appendChild(wortel);
    d.body.classList.add('rtg-laag-open');
    huidig = { wortel: wortel, vak: vak, lijf: lijf, soort: soort, opSluit: o.opSluit };
    doek.onclick = function () { sluit(); };
    if (soort === 'lade') haakVeeg(huidig);
    d.addEventListener('keydown', opToets, true);
    /* De terugknop. try/catch omdat pushState kan weigeren (een strak
       zandbak-frame), en dan sluiten tap, veeg en Escape hem alsnog -- maar
       roepen we later geen history.back() aan die het venster zou verlaten. */
    geduwd = false;
    if (w.history && w.history.pushState) {
      try { w.history.pushState({ rtgLaag: ++teller }, ''); geduwd = true; } catch (e) { geduwd = false; }
    }
    /* Openen in de volgende tel, zodat de overgang begint vanaf de dichte
       stand; in dezelfde tel staat hij er al open en beweegt er niets. */
    w.requestAnimationFrame(function () {
      wortel.classList.add('open');
      var eerste = vak.querySelector('[autofocus]') || vak.querySelector(TABBAAR) || vak;
      if (!vak.hasAttribute('tabindex')) vak.setAttribute('tabindex', '-1');
      try { eerste.focus({ preventScroll: true }); } catch (e) { eerste.focus(); }
    });
    return huidig;
  }

  /* Wegnemen en sluiten zijn twee dingen: sluit() is wat een mens doet (en die
     gaat via de geschiedenis terug), weg() is wat er daarna gebeurt. Zonder dat
     onderscheid zou de terugknop twee stappen terugzetten -- één van ons en één
     van de browser -- en dan verlaat hij het werkblad. */
  function weg() {
    if (!huidig) return;
    var h = huidig;
    huidig = null;
    d.removeEventListener('keydown', opToets, true);
    d.body.classList.remove('rtg-laag-open');
    h.wortel.classList.remove('open');
    var f = terugFocus; terugFocus = null;
    w.setTimeout(function () { if (h.wortel.parentNode) h.wortel.remove(); }, 260);
    if (f && f.focus) { try { f.focus({ preventScroll: true }); } catch (e) {} }
    if (typeof h.opSluit === 'function') { try { h.opSluit(); } catch (e) {} }
  }
  function sluit(stil) {
    if (!huidig) return;
    if (geduwd && !stil) { geduwd = false; w.history.back(); return; }  // popstate doet weg()
    geduwd = false;
    weg();
  }
  w.addEventListener('popstate', function () { if (huidig) { geduwd = false; weg(); } });

  w.RTGLagen = {
    lade: function (spec) { return bouw('lade', spec); },
    paneel: function (spec) { return bouw('paneel', spec); },
    taak: function (spec) { return bouw('taak', spec); },
    sluit: function () { sluit(); },
    open: function () { return !!huidig; },
    soort: function () { return huidig ? huidig.soort : ''; },
    lijf: function () { return huidig ? huidig.lijf : null; }
  };
})(window, document);
