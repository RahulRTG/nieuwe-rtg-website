/* Het werkblad: je scherm zelf indelen, meerdere schermen op een scherm.

   Waar dit vandaan komt: een kantoorwerkplek is niet een pagina waar je
   doorheen scrolt, maar een bureau waar meerdere dingen tegelijk open liggen.
   Wie de personeelsplanning naast de weekcijfers wil, hoort niet te hoeven
   wisselen van tabblad.

   Het model is met opzet TEGELS en geen zwevende vensters:

   - zwevende vensters bestaan al (shared/vensters.js) en zijn goed voor even
     iets erbij pakken. Ze overlappen, en dat is precies wat je NIET wilt als
     twee schermen de hele dag naast elkaar moeten staan;
   - tegels vullen het beeld zonder gaten, en de verhouding zet je zelf door de
     scheiding te verslepen. Dat is "je scherm indelen".

   Vier vaste indelingen (1, 2 naast elkaar, 2 boven elkaar, 3, 4). De
   verhoudingen en de keuze per vlak blijven staan, per pagina, per toestel.

   HET EERSTE VLAK IS ALTIJD DE PAGINA ZELF. Niet een kopie in een iframe: de
   echte pagina verhuist erin. Anders zou je twee versies van hetzelfde scherm
   naast elkaar kunnen zetten die elkaars gegevens niet zien.

   Alleen op een bureaublad (>=1100px). Een pagina meldt zich aan met:

     RTGWerkblad.start({ schermen: [{ naam, url }, ... ], balk: element })

   Zonder die aanmelding gebeurt er niets. */
(function (root) {
  'use strict';
  if (root.RTGWerkblad) return;

  var INDELINGEN = {
    een: { naam: '1', kolommen: 1, rijen: 1, vlakken: 1 },
    naast: { naam: '2 naast', kolommen: 2, rijen: 1, vlakken: 2 },
    boven: { naam: '2 boven', kolommen: 1, rijen: 2, vlakken: 2 },
    drie: { naam: '3', kolommen: 2, rijen: 2, vlakken: 3 },
    vier: { naam: '4', kolommen: 2, rijen: 2, vlakken: 4 }
  };
  var VOLGORDE = ['een', 'naast', 'boven', 'drie', 'vier'];

  var schermen = [], blad = null, balk = null, eigen = null, eigenOuder = null, eigenNa = null;
  var staat = { indeling: 'een', kolom: [1, 1], rij: [1, 1], keuze: ['', '', '', ''] };
  var SLEUTEL = 'rtg_werkblad_' + location.pathname.replace(/[^a-z0-9]/gi, '_');

  function bureau() {
    try { return root.matchMedia('(min-width: 1100px)').matches; } catch (e) { return false; }
  }
  function lees() {
    try {
      var v = JSON.parse(localStorage.getItem(SLEUTEL) || 'null');
      if (v && INDELINGEN[v.indeling]) staat = {
        indeling: v.indeling,
        kolom: Array.isArray(v.kolom) && v.kolom.length === 2 ? v.kolom : [1, 1],
        rij: Array.isArray(v.rij) && v.rij.length === 2 ? v.rij : [1, 1],
        keuze: Array.isArray(v.keuze) ? v.keuze.slice(0, 4) : ['', '', '', '']
      };
    } catch (e) {}
    while (staat.keuze.length < 4) staat.keuze.push('');
  }
  function bewaar() { try { localStorage.setItem(SLEUTEL, JSON.stringify(staat)); } catch (e) {} }

  /* ---------- de knoppenrij ---------- */
  function tekenBalk() {
    if (!balk) return;
    balk.innerHTML = '<span class="wb-kop">Indeling</span>' + VOLGORDE.map(function (id) {
      return '<button class="wb-k" type="button" data-wb="' + id + '" aria-pressed="' +
        (staat.indeling === id) + '">' + INDELINGEN[id].naam + '</button>';
    }).join('');
    balk.querySelectorAll('[data-wb]').forEach(function (b) {
      b.addEventListener('click', function () {
        staat.indeling = b.dataset.wb; bewaar(); teken();
      });
    });
  }

  /* ---------- het blad ---------- */
  function zorgBlad() {
    if (blad) return blad;
    blad = document.createElement('div');
    blad.className = 'wb-blad';
    document.body.appendChild(blad);
    document.body.classList.add('wb-aan');
    return blad;
  }

  /* De kopbalk van de pagina blijft staan, en het blad begint eronder.

     Dit moest zo. Het blad lag eerst over het HELE venster, en de kopbalk van de
     pagina staat op position:fixed -- die bleef dus over alle vlakken heen
     liggen en dekte de keuzelijst van het tweede vlak af. Bovendien hangt de
     indelings-knoppenrij juist IN die kopbalk; wegnemen kan dus niet.
     Dus: de kopbalk is de bovenrand van het werkblad, en de vlakken beginnen
     daaronder.

     Wat hier NIET gebeurt: andere vaste hoekjes van de pagina (de paletknop, een
     cookiebalk) verplaatsen. Die horen bij de bezoeker en niet bij de indeling,
     en ze verbergen zou betekenen dat je een keuze voor iemand wegneemt. Ze
     liggen dus over een vlak, net zoals ze op de gewone pagina over de tekst
     liggen. */
  function zetBovenrand() {
    var onder = 0;
    /* We nemen de ONDERKANT van de buitenste vaste laag boven de knoppenrij,
       niet de hoogte van de eerste die we tegenkomen. Die eerste is hier de
       <nav> BINNEN de kopbalk (36px), en de kopbalk zelf is hoger; met die 36
       vielen de keuzelijsten van de bovenste vlakken alsnog achter de balk. Dus
       doorlopen tot body en de laagste onderrand pakken. */
    var el = balk || document.querySelector('body > header');
    while (el && el !== document.body) {
      try {
        var st = root.getComputedStyle(el);
        if (st.position === 'fixed' || st.position === 'sticky') {
          onder = Math.max(onder, Math.round(el.getBoundingClientRect().bottom));
        }
      } catch (e) {}
      el = el.parentElement;
    }
    document.documentElement.style.setProperty('--wb-top', Math.max(0, onder) + 'px');
  }

  /* De eigen pagina verhuist het eerste vlak in, en we onthouden waar hij
     vandaan kwam zodat "1 vlak" hem netjes terug kan zetten. */
  function pakEigen() {
    if (eigen) return eigen;
    eigen = document.querySelector('main') || document.body.querySelector('main, .wrap, #main');
    if (!eigen) return null;
    eigenOuder = eigen.parentNode;
    eigenNa = eigen.nextSibling;
    return eigen;
  }
  function zetEigenTerug() {
    if (!eigen || !eigenOuder) return;
    if (eigenNa && eigenNa.parentNode === eigenOuder) eigenOuder.insertBefore(eigen, eigenNa);
    else eigenOuder.appendChild(eigen);
  }

  function vlakKop(i) {
    var kop = document.createElement('div');
    kop.className = 'wb-kopbalk';
    var kies = document.createElement('select');
    kies.setAttribute('aria-label', 'Welk scherm in vlak ' + (i + 1));
    kies.innerHTML = (i === 0 ? '<option value="">Deze pagina</option>' : '<option value="">Leeg</option>') +
      schermen.map(function (s) {
        return '<option value="' + s.url + '"' + (staat.keuze[i] === s.url ? ' selected' : '') + '>' + s.naam + '</option>';
      }).join('');
    kies.addEventListener('change', function () { staat.keuze[i] = kies.value; bewaar(); teken(); });
    kop.appendChild(kies);
    if (staat.keuze[i]) {
      var los = document.createElement('button');
      los.type = 'button'; los.textContent = 'Los venster';
      los.title = 'Dit scherm als apart venster openen (voor een tweede monitor)';
      los.addEventListener('click', function () { root.open(staat.keuze[i], '_blank', 'noopener,width=1200,height=900'); });
      kop.appendChild(los);
    }
    return kop;
  }

  function teken() {
    if (!bureau()) return;
    var ind = INDELINGEN[staat.indeling] || INDELINGEN.een;
    tekenBalk();
    if (!pakEigen()) return;

    if (ind.vlakken === 1) {
      // terug naar de gewone pagina: geen blad, geen grepen, niets in de weg
      if (blad) { zetEigenTerug(); blad.remove(); blad = null; }
      document.body.classList.remove('wb-aan');
      return;
    }
    var b = zorgBlad();
    zetBovenrand();
    b.innerHTML = '';
    b.style.gridTemplateColumns = ind.kolommen === 2 ? staat.kolom[0] + 'fr ' + staat.kolom[1] + 'fr' : '1fr';
    b.style.gridTemplateRows = ind.rijen === 2 ? staat.rij[0] + 'fr ' + staat.rij[1] + 'fr' : '1fr';

    for (var i = 0; i < ind.vlakken; i++) {
      var v = document.createElement('div');
      v.className = 'wb-vlak';
      // bij drie vlakken loopt het derde over de volle breedte onderaan
      if (ind.vlakken === 3 && i === 2) v.style.gridColumn = '1 / -1';
      v.appendChild(vlakKop(i));
      if (i === 0 && !staat.keuze[0]) {
        v.classList.add('wb-eigen');
        v.appendChild(eigen);
      } else if (staat.keuze[i]) {
        var f = document.createElement('iframe');
        f.src = staat.keuze[i];
        f.title = 'Scherm in vlak ' + (i + 1);
        v.appendChild(f);
      } else {
        var leeg = document.createElement('div');
        leeg.style.cssText = 'flex:1;display:grid;place-items:center;color:#8A8680;font-size:.8rem;font-family:Inter,system-ui,sans-serif;';
        leeg.textContent = 'Kies hierboven een scherm.';
        v.appendChild(leeg);
      }
      b.appendChild(v);
    }
    // staat de eigen pagina niet in vlak 1 (iemand koos daar iets anders),
    // dan hoort hij terug op zijn oude plek en niet nergens
    if (staat.keuze[0] && eigen && !b.contains(eigen)) zetEigenTerug();
    grepen(b, ind);
  }

  /* ---------- de grepen tussen de vlakken ----------
     Slepen verandert de fr-verhouding, niet de pixels: zo blijft de indeling
     kloppen als het venster van maat verandert. */
  function grepen(b, ind) {
    if (ind.kolommen === 2) maakGreep(b, 'x', ind);
    if (ind.rijen === 2) maakGreep(b, 'y', ind);
  }
  function maakGreep(b, as, ind) {
    var g = document.createElement('div');
    g.className = 'wb-greep wb-greep-' + as;
    g.setAttribute('role', 'separator');
    g.setAttribute('aria-label', as === 'x' ? 'Breedte van de vlakken' : 'Hoogte van de vlakken');
    var zetPlek = function () {
      var deel = as === 'x' ? staat.kolom : staat.rij;
      var pct = deel[0] / (deel[0] + deel[1]) * 100;
      if (as === 'x') g.style.left = pct + '%'; else g.style.top = pct + '%';
    };
    zetPlek();
    b.appendChild(g);

    var neer = null;
    g.addEventListener('pointerdown', function (e) {
      neer = true; g.classList.add('wb-sleept');
      try { g.setPointerCapture(e.pointerId); } catch (er) {}
    });
    g.addEventListener('pointermove', function (e) {
      if (!neer) return;
      var r = b.getBoundingClientRect();
      var f = as === 'x' ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height;
      f = Math.max(0.15, Math.min(0.85, f));      // nooit een vlak wegdrukken
      var deel = as === 'x' ? staat.kolom : staat.rij;
      deel[0] = Math.round(f * 100) / 100; deel[1] = Math.round((1 - f) * 100) / 100;
      b.style[as === 'x' ? 'gridTemplateColumns' : 'gridTemplateRows'] = deel[0] + 'fr ' + deel[1] + 'fr';
      zetPlek();
      e.preventDefault();
    });
    var los = function () { if (neer) { neer = null; g.classList.remove('wb-sleept'); bewaar(); } };
    g.addEventListener('pointerup', los);
    g.addEventListener('pointercancel', los);
    if (ind.vlakken === 3 && as === 'y') { /* het derde vlak ligt onder; de greep klopt */ }
  }

  root.RTGWerkblad = {
    start: function (opties) {
      var o = opties || {};
      schermen = (o.schermen || []).filter(function (s) { return s && s.naam && s.url; });
      balk = o.balk || null;
      if (!bureau()) { if (balk) balk.hidden = true; return false; }
      lees();
      teken();
      /* Wisselt iemand van breed naar smal (venster kleiner, tweede monitor
         weg), dan valt het blad weg en staat de pagina er weer gewoon. */
      try {
        root.matchMedia('(min-width: 1100px)').addEventListener('change', function (m) {
          if (!m.matches && blad) { zetEigenTerug(); blad.remove(); blad = null; document.body.classList.remove('wb-aan'); }
          else if (m.matches) teken();
        });
      } catch (e) {}
      return true;
    },
    indeling: function (id) { if (INDELINGEN[id]) { staat.indeling = id; bewaar(); teken(); } },
    INDELINGEN: INDELINGEN
  };
})(typeof self !== 'undefined' ? self : this);
