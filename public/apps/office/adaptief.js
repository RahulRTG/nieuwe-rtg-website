/* RTG OFFICE OP EEN TELEFOON: dezelfde handelingen, opnieuw samengesteld.

   DE KERNKEUZE, EN HIJ IS BELANGRIJKER DAN HIJ ERUITZIET. Deze laag bouwt GEEN
   tweede knoppenset. Hij leest de werkbalk die er al staat -- #tekstTools,
   #bladTools, de dia-kolom -- en maakt van elke knop daarin een capability. De
   handeling zelf blijft precies één keer geïmplementeerd: in tekst.js, blad.js
   en pres.js, waar hij hoort.

   Waarom dat zo moet: een tweede implementatie voor "vet" is een tweede vet. Ze
   zijn een week gelijk, en daarna niet meer -- en dan is de vraag welke van de
   twee de echte is (LAT.md regel 4). Wat hier gebeurt is dat de knop op een
   andere plek wordt AANGEBODEN, niet dat hij wordt nagebouwd.

   Gevolg dat je gratis krijgt: wie morgen een knop aan de werkbalk toevoegt,
   heeft hem op een telefoon meteen ook. Er is niets bij te werken.

   WAT ER OVER DE GRENS GAAT. Dit document draait in een werkblad-frame van RTG
   Command; de balk staat in het bovendocument. shared/adaptief/brug.js brengt de
   declaraties en de context omhoog en de handelingen terug omlaag. Deze laag
   weet daar niets van -- hij praat alleen met het register.

   DE SELECTIE MOET WORDEN VASTGEHOUDEN, en dat is hier duur geleerd. Tik je op
   een knop in de balk van het BOVENdocument, dan verliest dit frame de focus, en
   dan doet document.execCommand niets: er is geen actieve selectie meer om vet
   te maken. De knop reageerde dus zichtbaar niet. Vandaar dat het bereik wordt
   bewaard en vlak voor de handeling wordt teruggezet. */
(function (w, d) {
  'use strict';
  var A = w.RTGAdaptief;
  if (!A) return;

  function $(s) { return d.querySelector(s); }
  function zichtbaar(el) { return !!(el && el.offsetParent !== null); }

  /* Welke handelingen vooraan staan, per soort en per stand. De rest volgt in
     dezelfde volgorde als de werkbalk -- niets valt weg, er wordt alleen
     gesorteerd. Wat niet in de balk past staat achter ⋯ in de lade. */
  var VOORAAN = {
    'office.tekst': {
      selectie: ['bold', 'italic', 'formatBlock<h2>', 'link', 'hiliteColor', 'underline'],
      rust: ['delen', 'fase', 'undo', 'redo', 'insertUnorderedList', 'formatBlock<h1>', 'tabel']
    },
    'office.blad': { selectie: [], rust: ['delen', 'fase'] },
    'office.pres': { selectie: [], rust: ['presenteren', 'delen'] }
  };

  /* De sleutel van een werkbalkknop. data-cmd plus data-waarde, want vier
     knoppen delen `formatBlock` en verschillen alleen in het blok. */
  function sleutel(b) {
    if (b.dataset.doe) return b.dataset.doe;
    if (b.dataset.op !== undefined) return 'op:' + (b.dataset.op || 'geen');
    if (b.dataset.groei) return 'groei:' + b.dataset.groei;
    return (b.dataset.cmd || '') + (b.dataset.waarde || '');
  }
  function naamVan(b) {
    return b.getAttribute('title') || b.getAttribute('aria-label') || (b.textContent || '').trim() || 'Handeling';
  }
  function labelVan(b) {
    var t = (b.textContent || '').trim();
    return t.length && t.length <= 6 ? t : naamVan(b).slice(0, 2);
  }

  /* ------------------------------------------------------- de selectie --
     Bewaren bij elke wijziging, terugzetten vlak voor de handeling. Alleen
     bereiken BINNEN het vel: een cursor in het titelveld is geen documentbereik,
     en die terugzetten zou vet op de titel plakken. */
  var bewaard = null;
  function velTekst() { return $('#tekst'); }
  d.addEventListener('selectionchange', function () {
    var vel = velTekst();
    if (!vel || !zichtbaar(vel)) return;
    var s = d.getSelection();
    if (!s || !s.rangeCount) return;
    var r = s.getRangeAt(0);
    if (!vel.contains(r.commonAncestorContainer)) return;
    bewaard = r.cloneRange();
    meld();
  });
  function herstel() {
    var vel = velTekst();
    if (!vel || !bewaard) return;
    try {
      vel.focus({ preventScroll: true });
      var s = d.getSelection();
      s.removeAllRanges();
      s.addRange(bewaard);
    } catch (e) {}
  }

  /* Een knop indrukken zoals een mens dat doet. tekst.js luistert op mousedown
     (anders is de selectie al weg), blad.js op click. Allebei sturen is veilig:
     geen enkele knop luistert op allebei, en een echte muisklik levert ze ook
     allebei. */
  function tik(b) {
    if (!b) return;
    ['mousedown', 'mouseup', 'click'].forEach(function (soort) {
      b.dispatchEvent(new w.MouseEvent(soort, { bubbles: true, cancelable: true, view: w }));
    });
  }

  /* --------------------------------------------------- declareren en melden --
     De vormen zijn voor élke werkbalkknop dezelfde, en dat is geen luiheid: een
     werkbalkknop IS per definitie iets wat op bureau in de werkbalk staat, met
     een contextmenu erachter, en op een klein scherm in de selectiebalk met de
     lade als uitgebreide vorm. Wijkt een handeling daarvan af, dan declareert
     hij zichzelf apart -- zoals presenteren hieronder. */
  function declareerBalk(bron, host) {
    var uit = [];
    Array.prototype.forEach.call(host.querySelectorAll('.tb'), function (b) {
      var id = bron + '.' + sleutel(b);
      A.declareer({ id: id, naam: naamVan(b), label: labelVan(b), groep: 'Opmaak',
        telefoon: ['selectiebalk', 'lade'], tablet: ['selectiepopover', 'werkbalk'],
        bureau: ['werkbalk', 'contextmenu'],
        doe: function () { herstel(); tik(b); } });
      uit.push({ id: id, knop: b, sleutel: sleutel(b) });
    });
    return uit;
  }

  /* De volgorde: eerst wat vooraan hoort, dan de rest zoals hij in de werkbalk
     stond. Een handeling twee keer in de rij zetten is geen nadruk maar een
     dubbele knop, vandaar de `gehad`-set. */
  function ordenen(bron, knoppen, stand) {
    var wens = (VOORAAN[bron] || {})[stand] || [], gehad = {}, uit = [];
    wens.forEach(function (s) {
      knoppen.forEach(function (k) {
        if (k.sleutel !== s || gehad[k.id]) return;
        gehad[k.id] = 1; uit.push(k.id);
      });
    });
    knoppen.forEach(function (k) { if (!gehad[k.id]) { gehad[k.id] = 1; uit.push(k.id); } });
    return uit;
  }

  /* De STAND van een knop komt van de knop zelf: tekst.js zet daar `aan` op
     zodra de cursor in vette tekst staat (standBij). Die niet overnemen zou
     betekenen dat de balk grijs blijft terwijl vet aanstaat -- en dan zegt de
     balk iets anders dan het document. */
  function standen(knoppen) {
    var uit = {};
    knoppen.forEach(function (k) {
      var s = { aan: k.knop.classList.contains('aan') };
      /* De inhoud van de bevestiging hoort bij dit MOMENT en niet bij de
         declaratie: welke classificatie er aan dit stuk hangt kan straks anders
         zijn. Hij rijdt dus mee met de context. */
      if (k.bevestiging) s.bevestiging = k.bevestiging;
      uit[k.id] = s;
    });
    return uit;
  }

  function titel() {
    var t = $('.balk input.titel');
    return (t && t.value) || 'Document';
  }
  function erIsSelectie() {
    var s = d.getSelection(), vel = velTekst();
    return !!(s && vel && s.rangeCount && !s.isCollapsed && vel.contains(s.getRangeAt(0).commonAncestorContainer));
  }

  /* De presentatie heeft geen werkbalk om uit te lezen: zijn bediening staat in
     de dia-kolom, en presenteren is een taakmodus. Eigen onderwerp, eigen
     bestand (office/adaptief-pres.js). */
  var pres = w.RTGOfficeAdaptiefPres ? w.RTGOfficeAdaptiefPres({ tik: tik }) : null;
  /* De toestand van het document zelf -- opslag, classificatie, meelezers -- en de
     twee handelingen die zwaarder wegen dan een werkbalkknop. Eigen bestand, want
     dat is een ander onderwerp dan een werkbalk uitlezen. */
  var staat = w.RTGOfficeAdaptiefStaat ? w.RTGOfficeAdaptiefStaat({ tik: tik }) : null;

  /* ------------------------------------------------------------- melden --
     Eén functie die kijkt wat er op het scherm staat en dat doorgeeft. Het
     register slikt een gelijke melding stil (dezelfde sleutel), dus dit mag zo
     vaak aangeroepen worden als er iets kán zijn veranderd. */
  function meld() {
    var tools = null, bron = '', knoppen = [], stand = 'rust';
    if (zichtbaar($('#tekstTools'))) { tools = $('#tekstTools'); bron = 'office.tekst'; }
    else if (zichtbaar($('#bladTools'))) { tools = $('#bladTools'); bron = 'office.blad'; }
    if (tools) {
      knoppen = declareerBalk(bron, tools);
      if (bron === 'office.tekst' && erIsSelectie()) stand = 'selectie';
    } else if (zichtbaar($('#presWrap'))) {
      bron = 'office.pres';
      knoppen = pres ? pres.caps() : [];
    }
    /* De documenthandelingen komen erbij zodra er een document open is -- maar
       NIET tijdens een selectie: wie tekst heeft aangewezen is aan het opmaken,
       en "Delen" tussen vet en cursief is een handeling uit een andere laag die
       precies op de verkeerde plek staat. */
    if (bron && staat && stand !== 'selectie') knoppen = knoppen.concat(staat.caps());
    if (!bron || !knoppen.length) { A.wisContext(); return; }
    A.context({ bron: bron, titel: titel(), acties: ordenen(bron, knoppen, stand),
      selectie: stand === 'selectie', staat: standen(knoppen),
      rail: staat ? staat.rail() : [] });
  }

  /* WANNEER MELDEN. Niet op een tijdklok maar op wat er echt gebeurt: een ander
     document open (het scherm wisselt), typen, en de selectie die verschuift
     (die haakt hierboven al aan selectionchange).

     De waarnemer kijkt naar het WERKVLAK en niet naar één element: welk soort
     document open is, is te zien aan welk vak zichtbaar wordt gemaakt, en dat
     gebeurt met een stijlwijziging vanuit app.js. */
  function start() {
    var vak = $('#docWrap') || $('main') || d.body;
    if (w.MutationObserver) {
      new w.MutationObserver(function () { meld(); })
        .observe(vak, { attributes: true, childList: true, subtree: true, attributeFilter: ['style', 'class'] });
    }
    d.addEventListener('input', meld, true);
    d.addEventListener('click', function () { w.setTimeout(meld, 0); }, true);
    meld();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();
})(window, document);
