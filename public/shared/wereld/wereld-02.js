
  /* ---------- de merken op de ring ----------
     Elk merk is een ECHTE knop. Dat is geen nettigheid: dit is de voordeur van
     het hele platform, en een voordeur die alleen met een vinger opengaat is
     voor een deel van de leden geen voordeur. Tabben, Enter en een schermlezer
     werken dus allemaal, en elk gebaar hieronder heeft verderop een toets die
     hetzelfde doet.

     De merken hangen NIET in de draaiende bezel maar los in de kring, en hun
     plaats wordt per beeld uitgerekend. Dat scheelt een tegendraai per merk (de
     glyf moet rechtop blijven; een gekantelde glyf is een sierletter en geen
     teken dat je in een oogopslag herkent) en het houdt de meetkunde op EEN
     plek: plaats(). */
  var STRAAL = 41;     // procent van de kring -- gelijk aan de haarlijn in de svg

  function maakMerk(item, i) {
    var b = d.createElement('button');
    b.type = 'button';
    b.className = 'os-wm';
    b.dataset.i = String(i);
    b.setAttribute('aria-label', item.naam);
    var teken = item.teken && item.teken();
    if (teken) b.appendChild(teken);
    else {
      var mono = d.createElement('span');
      mono.textContent = item.naam.replace(/^RTG /, '').slice(0, 2);
      b.appendChild(mono);
    }
    /* Tikken doet twee dingen, en welke hangt af van waar je staat. Op een merk
       dat NIET op twaalf uur staat reis je ernaartoe -- dat is wat je bedoelt
       als je een ander merk aanwijst. Staat het er al, dan open je het. Zo is
       er geen aparte "open"-knop nodig en kost reizen nooit per ongeluk een
       paginawissel. */
    b.addEventListener('click', function () {
      /* EEN SLEEP EINDIGT NIET IN EEN TIK. Laat je de ring los met je vinger op
         een merk, dan stuurt de browser daar netjes een click achteraan -- en
         dan draai je even aan de bezel en sta je ineens in een andere app. De
         sleeplaag zet st.gesleept, en die geldt voor ELKE knop in de kring, niet
         alleen voor de kern. Dit stond eerst alleen op de kern, en dat was de
         helft van de maatregel. */
      if (st.gesleept) return;
      if (Number(b.dataset.i) !== st.actief) { naar(Number(b.dataset.i)); return; }
      open();
    });
    return b;
  }

  /* De ring opnieuw vullen: bij het aanzetten, en bij elke wissel tussen de
     werelden en de onderdelen van een wereld. */
  function vulRing() {
    var items = ringItems();
    st.merken.forEach(function (m) { m.remove(); });
    st.merken = items.map(function (item, i) {
      var m = maakMerk(item, i);
      el.kring.appendChild(m);
      return m;
    });
    tekenStreepjes(items.length);
    plaats();
  }

  /* De streepjes op de bezel: een per stand, en ze draaien mee. Ze worden hier
     GETEKEND naar het aantal standen en niet als vaste acht overgetikt -- komt
     er ooit een negende wereld bij, dan klopt de verdeling vanzelf. */
  function tekenStreepjes(n) {
    if (!el.boog) return;
    el.boog.textContent = '';
    if (!n) return;
    var ns = 'http://www.w3.org/2000/svg';
    for (var i = 0; i < n; i++) {
      var a = (i * (360 / n) - 90) * Math.PI / 180;
      var p = d.createElementNS(ns, 'line');
      p.setAttribute('x1', (50 + 45.5 * Math.cos(a)).toFixed(2));
      p.setAttribute('y1', (50 + 45.5 * Math.sin(a)).toFixed(2));
      p.setAttribute('x2', (50 + 47.6 * Math.cos(a)).toFixed(2));
      p.setAttribute('y2', (50 + 47.6 * Math.sin(a)).toFixed(2));
      p.setAttribute('stroke', 'var(--line)');
      p.setAttribute('stroke-width', '0.5');
      p.setAttribute('stroke-linecap', 'round');
      el.boog.appendChild(p);
    }
  }

  /* De enige plek waar de meetkunde staat. Alles wat draait leest hier zijn
     positie uit st.hoek, dus er is geen tweede plaats waar "waar staat merk
     drie" beantwoord wordt. */
  function plaats() {
    var n = st.merken.length;
    if (!n || !el.kring) return;
    var stap = 360 / n;
    for (var i = 0; i < n; i++) {
      var a = (i * stap + st.hoek - 90) * Math.PI / 180;
      var m = st.merken[i];
      m.style.left = (50 + STRAAL * Math.cos(a)).toFixed(3) + '%';
      m.style.top = (50 + STRAAL * Math.sin(a)).toFixed(3) + '%';
      m.style.transform = 'translate(-50%,-50%)';
    }
    if (el.boog) el.boog.setAttribute('transform', 'rotate(' + st.hoek.toFixed(2) + ' 50 50)');

    /* Welke wereld staat er op twaalf uur? Dat volgt uit de hoek en wordt niet
       apart bijgehouden: twee plekken die dezelfde waarheid bewaren lopen uit
       elkaar zodra iemand er een vergeet bij te werken (LAT.md regel 4). */
    var nieuw = ((-Math.round(st.hoek / stap)) % n + n) % n;
    if (nieuw !== st.actief) { st.actief = nieuw; toonNaam(); }
    for (var j = 0; j < n; j++) st.merken[j].dataset.actief = (j === st.actief ? 'ja' : 'nee');
  }

  /* De naam onder de klok, en eronder EEN geteld feit. Wat er staat is echt
     geteld en niet verzonnen: hoeveel onderdelen deze wereld voor JOUW pas
     draagt. CANVAS.md is er hard over dat een stand die niet gemeten kan
     worden, niet getoond hoort te worden -- dus hier geen "Operationeel" dat
     altijd groen is. */
  function toonNaam() {
    var it = huidige();
    if (!el.naam || !it) return;
    el.naam.textContent = it.naam;
    if (!el.sub) return;
    if (st.diep) {
      el.sub.textContent = (st.werelden[st.wereldIdx] || {}).naam || '';
    } else {
      var n = (it.delen || []).length;
      el.sub.textContent = n ? (n + (n === 1 ? ' onderdeel' : ' onderdelen')) : '';
    }
  }

  /* ---------- draaien ----------
     De ring eased naar zijn doel in EEN rAF-lus, en die lus draagt ook de
     levende grond (zie deel 4). Twee lussen naast elkaar zouden hetzelfde
     beeldframe twee keer betalen. */
  function loop() {
    st.haak = null;
    var verschil = st.doel - st.hoek;
    if (Math.abs(verschil) < 0.04) { st.hoek = st.doel; plaats(); }
    else { st.hoek += verschil * 0.2; plaats(); vraagFrame(); }
    grondFrame();
  }
  function vraagFrame() { if (!st.haak && st.aan) st.haak = w.requestAnimationFrame(loop); }

  // naar een stand toe. Bewegingsarm springt hij er meteen heen: de stand
  // veranderen is de functie, het draaien is de versiering.
  function naar(i) {
    var n = st.merken.length;
    if (!n) return;
    var stap = 360 / n;
    /* De KORTSTE weg, en niet altijd met de klok mee. Zonder deze stap draait
       de ring van stand 7 naar stand 0 helemaal terug langs alle zes ertussen,
       terwijl je buurman naast je stond. */
    var rondjes = Math.round(st.doel / 360);
    var kandidaten = [-i * stap + rondjes * 360, -i * stap + (rondjes + 1) * 360, -i * stap + (rondjes - 1) * 360];
    st.doel = kandidaten.reduce(function (a, b) {
      return Math.abs(b - st.hoek) < Math.abs(a - st.hoek) ? b : a;
    });
    if (RUSTIG || sleepStil()) { st.hoek = st.doel; plaats(); grondFrame(); }
    else vraagFrame();
  }
  function sleepStil() { return !!(w.RTGBeweging && w.RTGBeweging.factor && w.RTGBeweging.factor() === 0); }
