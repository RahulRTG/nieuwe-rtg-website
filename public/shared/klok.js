/* De RTG-klok: EEN klok voor het hele besturingssysteem. Elke app die tijd
   toont gebruikt dit onderdeel, zodat de klok overal exact hetzelfde is:
   uren en minuten in Bodoni (het display-gezicht van het huis), seconden
   kleiner in hetzelfde gezicht, milliseconden als fijn goudaccent. De
   cijfers zijn tabulair (geen dansende breedtes) en lopen vloeiend mee op
   requestAnimationFrame; in een achtergrond-tabblad pauzeert dat vanzelf,
   en wie minder beweging wil (prefers-reduced-motion) ziet de
   milliseconden niet.

   De ring (data-rtg-klok="ring") is een echte, onbetaalbare wijzerplaat:
   het GOUD staat vast (het huisgoud, altijd goud), de SFEER -- de fijne
   sunray-plaat en de accent-flens -- ademt mee met de levende dagkleur van
   het palet. Zo blijft het goud goud terwijl de rest met het huis meekleurt.

   Gebruik: geef een element het attribuut data-rtg-klok (de klok) of
   data-rtg-datum (de lange datum in de taal van de pagina); dit script
   vindt ze zelf. Bestaande id's blijven werken; alleen de vulling komt
   voortaan van hier. */
(() => {
  if (window.RTGKlok) return;

  const stijl = document.createElement('style');
  stijl.id = 'rtg-klok-stijl';
  stijl.textContent =
    '.rtg-klok{display:inline-flex;align-items:baseline;font-variant-numeric:tabular-nums;white-space:nowrap;}' +
    ".rtg-klok .ku{font-family:'Bodoni Moda',serif;font-weight:400;letter-spacing:0.02em;}" +
    ".rtg-klok .ks{font-family:'Bodoni Moda',serif;font-weight:400;font-size:0.5em;opacity:0.85;margin-left:0.1em;}" +
    '.rtg-klok .km{font-family:Inter,system-ui,sans-serif;font-weight:400;font-size:0.26em;letter-spacing:0.08em;' +
      'color:var(--klok-goud,var(--gold,#C9A24B));margin-left:0.22em;min-width:3.6ch;text-align:left;align-self:center;}' +
    '@media (prefers-reduced-motion: reduce){.rtg-klok .km{display:none;}}' +
    // Het ring-gezicht. Twee sleutelkleuren:
    //   --klok-goud  = het HUISGOUD, staat VAST (altijd goud, ongeacht het palet)
    //   --klok-sfeer = de levende dagkleur van het palet; hierin ademt "de rest"
    //                  (de sunray-plaat, de accent-flens) met het huis mee.
    '.rtg-ring{position:relative;display:inline-flex;align-items:center;justify-content:center;width:16rem;height:16rem;max-width:74vw;max-height:74vw;' +
      '--klok-goud:var(--gold,#C9A24B);' +
      '--klok-sfeer:var(--dag-kleur,var(--s-accent-hel,var(--s-accent,#7F1634)));}' +
    '.rtg-ring svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}' +
    // de rand + rehaut: een gouden buitenring, een fijne witte lichtlijn, en
    // een accent-flens die met het palet meekleurt
    '.rtg-ring .rr-rand{fill:none;stroke:var(--klok-goud);stroke-opacity:0.55;stroke-width:0.9;}' +
    '.rtg-ring .rr-rehaut{fill:none;stroke:#ffffff;stroke-opacity:0.06;stroke-width:0.7;}' +
    '.rtg-ring .rr-flens{fill:none;stroke:var(--klok-sfeer);stroke-opacity:0.34;stroke-width:0.9;}' +
    // de sunray-plaat: fijne stralen vanuit het midden, in de paletkleur
    '.rtg-ring .rr-sun{stroke:var(--klok-sfeer);stroke-opacity:0.08;stroke-width:0.35;}' +
    '.rtg-ring .rr-sun2{stroke:var(--klok-sfeer);stroke-opacity:0.03;stroke-width:0.35;}' +
    // de minutenbaan: fijne lichtlijntjes, gouden accent op de vijf minuten
    '.rtg-ring .rr-min{stroke:#ffffff;stroke-opacity:0.22;stroke-width:0.7;}' +
    '.rtg-ring .rr-vijf{stroke:var(--klok-goud);stroke-opacity:0.9;stroke-width:1.25;}' +
    // toegepaste facet-indexen (goud, met een lichte bovenfacet)
    '.rtg-ring .rr-index{fill:var(--klok-goud);}' +
    '.rtg-ring .rr-indexlicht{fill:#fff8e0;fill-opacity:0.55;}' +
    // de signatuur en de weekdag, in het vaste goud (Inter resp. Bodoni)
    '.rtg-ring .rr-naam{fill:var(--klok-goud);font-family:Inter,system-ui,sans-serif;font-size:5.2px;font-weight:500;letter-spacing:0.06em;}' +
    // de dag- en datumvensters: identieke "kastjes" -- diep zwart met een
    // toegepaste gouden lijst -- zodat de weekdag en de datum een geheel zijn
    '.rtg-ring .rr-venster{fill:#050504;}' +
    '.rtg-ring .rr-vensterlijst{fill:none;stroke:var(--klok-goud);stroke-opacity:0.85;stroke-width:1.1;}' +
    ".rtg-ring .rr-datum{fill:#F1E9D4;font-family:'Bodoni Moda',serif;font-size:8.6px;font-variant-numeric:tabular-nums;}" +
    ".rtg-ring .rr-dagtekst{fill:#F1E9D4;font-family:'Bodoni Moda',serif;font-size:7.2px;}" +
    // de gouden secondewijzer als een fijn juweel over de plaat
    '.rtg-ring .rr-sec{stroke:var(--klok-goud);stroke-width:0.7;stroke-linecap:round;}' +
    '.rtg-ring .rr-seccw{fill:var(--klok-goud);}' +
    // de gangreserve-subwijzerplaat op negen uur
    '.rtg-ring .rr-sub{fill:none;stroke:#ffffff;stroke-opacity:0.08;stroke-width:0.6;}' +
    '.rtg-ring .rr-res{fill:none;stroke:var(--klok-goud);stroke-opacity:0.3;stroke-width:0.5;}' +
    '.rtg-ring .rr-resvol{fill:none;stroke:var(--klok-goud);stroke-opacity:0.75;stroke-width:0.9;}' +
    '.rtg-ring .rr-reswijzer{stroke:var(--klok-goud);stroke-opacity:0.9;stroke-width:0.8;stroke-linecap:round;}' +
    '.rtg-ring .rr-as{fill:var(--klok-goud);}' +
    // de polijst-ribbel over de wijzers (het lichtvangertje)
    '.rtg-ring .rr-ribbel{stroke:#fff7dc;stroke-opacity:0.7;stroke-linecap:round;fill:none;}';
  document.head.appendChild(stijl);

  const twee = n => String(n).padStart(2, '0');
  const RUSTIG = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- de cijfers: HH:MM groot, :SS kleiner, .mmm als goudaccent ---- */
  function maakCijfers(el) {
    el.classList.add('rtg-klok');
    el.textContent = '';
    const u = document.createElement('span'); u.className = 'ku';
    const s = document.createElement('span'); s.className = 'ks';
    const m = document.createElement('span'); m.className = 'km';
    el.append(u, s, m);
    let vorigeMinuut = '', vorigeSec = '';
    return d => {
      const uur = twee(d.getHours()) + ':' + twee(d.getMinutes());
      if (uur !== vorigeMinuut) { u.textContent = uur; vorigeMinuut = uur; }
      const sec = ':' + twee(d.getSeconds());
      if (sec !== vorigeSec) { s.textContent = sec; vorigeSec = sec; }
      m.textContent = '.' + String(d.getMilliseconds()).padStart(3, '0');
    };
  }

  /* ---- de RTG-ring: het onbetaalbare signatuurgezicht van de klok ----
     Een echte, rustige wijzerplaat op haute-horlogerie-niveau: onder twaalf
     uur de signatuur RAHUL TRAVEL GROUP, daaronder de weekdag, een datum-
     venster met een gouden lijst op zes uur en een verzonken gangreserve op
     negen uur. In het midden gefacetteerde dauphine-wijzers met een
     gepolijste ribbel die het licht vangt. Het goud staat vast; de fijne
     sunray-plaat en de accent-flens ademen mee met het palet. Subtiel 3D:
     een zachte glasbolling en een fijne slagschaduw onder de wijzers. */
  function maakRing(el) {
    el.classList.add('rtg-ring');
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.setAttribute('aria-hidden', 'true');
    const maak = (naam, at) => {
      const n = document.createElementNS(NS, naam);
      for (const [k, v] of Object.entries(at)) n.setAttribute(k, v);
      svg.appendChild(n);
      return n;
    };
    const P2 = Math.PI * 2;
    const pt = (r, a) => (r * Math.sin(a)).toFixed(2) + ' ' + (-r * Math.cos(a)).toFixed(2);
    const klokNr = (maakRing.nr = (maakRing.nr || 0) + 1);

    // defs: plaatdiepte, gepolijst goud (met heldere ribbel), een index-goud,
    // een zacht glashoogsel en een fijne slagschaduw (subtiel 3D)
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML =
      '<radialGradient id="rr-plaat' + klokNr + '" cx="50%" cy="40%" r="68%">' +
        '<stop offset="0%" stop-color="#201C1B"/><stop offset="70%" stop-color="#131110"/>' +
        '<stop offset="100%" stop-color="#090908"/></radialGradient>' +
      '<linearGradient id="rr-goud' + klokNr + '" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0%" stop-color="#5E4614"/><stop offset="18%" stop-color="#B4913E"/>' +
        '<stop offset="45%" stop-color="#F7E9B4"/><stop offset="50%" stop-color="#FFF8DD"/>' +
        '<stop offset="55%" stop-color="#EAD693"/><stop offset="82%" stop-color="#9A7A2E"/>' +
        '<stop offset="100%" stop-color="#57420F"/></linearGradient>' +
      '<linearGradient id="rr-goudkop' + klokNr + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#FFF4CE"/><stop offset="45%" stop-color="#E7CE86"/>' +
        '<stop offset="100%" stop-color="#8A6A22"/></linearGradient>' +
      '<radialGradient id="rr-glans' + klokNr + '" cx="37%" cy="28%" r="62%">' +
        '<stop offset="0%" stop-color="rgba(255,251,240,0.13)"/>' +
        '<stop offset="52%" stop-color="rgba(255,251,240,0.02)"/>' +
        '<stop offset="100%" stop-color="rgba(255,251,240,0)"/></radialGradient>' +
      '<filter id="rr-schaduw' + klokNr + '" x="-25%" y="-25%" width="150%" height="150%">' +
        '<feDropShadow dx="0" dy="0.7" stdDeviation="0.8" flood-color="#000" flood-opacity="0.5"/></filter>';
    svg.appendChild(defs);

    // de plaat
    maak('circle', { cx: 100, cy: 100, r: 97, fill: 'url(#rr-plaat' + klokNr + ')' });
    // de sunray-plaat: fijne stralen vanuit het midden, in de paletkleur
    // (afwisselend twee sterktes voor een zachte schittering) -- onder alles
    for (let i = 0; i < 120; i++) {
      const a = i / 120 * P2, b = pt(20, a).split(' '), e = pt(86, a).split(' ');
      maak('line', { x1: b[0], y1: b[1], x2: e[0], y2: e[1], class: i % 2 ? 'rr-sun' : 'rr-sun2' });
    }
    // de rand + rehaut + accent-flens
    maak('circle', { cx: 100, cy: 100, r: 97, class: 'rr-rand' });
    maak('circle', { cx: 100, cy: 100, r: 95, class: 'rr-rehaut' });
    maak('circle', { cx: 100, cy: 100, r: 84.5, class: 'rr-flens' });
    // de minutenbaan
    for (let m = 0; m < 60; m++) {
      const rad = m * 6 * Math.PI / 180, vijf = m % 5 === 0;
      const r1 = vijf ? 89.5 : 92.0, r2 = 94.5;
      maak('line', {
        x1: (100 + Math.sin(rad) * r1).toFixed(2), y1: (100 - Math.cos(rad) * r1).toFixed(2),
        x2: (100 + Math.sin(rad) * r2).toFixed(2), y2: (100 - Math.cos(rad) * r2).toFixed(2),
        class: vijf ? 'rr-vijf' : 'rr-min'
      });
    }
    // toegepaste facet-indexen op de twaalf uren (dubbel op twaalf), met een
    // lichte bovenfacet zodat ze echt opgezet lijken
    for (let h = 0; h < 12; h++) {
      const a = h * 30 * Math.PI / 180, rIn = 80.5, rUit = 87.5;
      const dx = Math.sin(a), dy = -Math.cos(a), nx = -dy, ny = dx;
      const halfB = h % 3 === 0 ? 1.9 : 1.4;
      const P = (r, o) => (100 + dx * r + nx * o).toFixed(2) + ' ' + (100 + dy * r + ny * o).toFixed(2);
      const teken = (o0, o1) => {
        maak('path', { class: 'rr-index', d: 'M' + P(rIn, o0) + 'L' + P(rUit, o0) + 'L' + P(rUit, o1) + 'L' + P(rIn, o1) + 'Z' });
        // smalle lichte facet langs de ene flank
        maak('path', { class: 'rr-indexlicht', d: 'M' + P(rIn, o0) + 'L' + P(rUit, o0) + 'L' + P(rUit, o0 + 0.5) + 'L' + P(rIn, o0 + 0.5) + 'Z' });
      };
      if (h === 0) { teken(-2.4, -0.6); teken(0.6, 2.4); }   // dubbele index op 12
      else teken(-halfB, halfB);
    }

    // de signatuur onder twaalf uur, op vaste breedte gecentreerd
    const naam = maak('text', { x: 100, y: 40, class: 'rr-naam', 'text-anchor': 'middle',
      textLength: 84, lengthAdjust: 'spacing' });
    naam.textContent = 'RAHUL TRAVEL GROUP';

    /* Een gedeeld "kastje": een diep zwart venster met een toegepaste gouden
       lijst en een kijkgat (clip) voor de rol-omslag. Weekdag en datum krijgen
       EXACT hetzelfde kastje, zodat de plaat een kloppend geheel is: de weekdag
       (in de taal van de gebruiker) onder twaalf uur, de datum op drie uur, en
       daartegenover de gangreserve op negen uur. */
    function kastje(cx, cy, w, h, id, tekstKlasse, tl) {
      const x = +(cx - w / 2).toFixed(2), y = +(cy - h / 2).toFixed(2);
      maak('rect', { x: x, y: y, width: w, height: h, rx: 1.6, class: 'rr-venster' });
      maak('rect', { x: x, y: y, width: w, height: h, rx: 1.6, class: 'rr-vensterlijst' });
      const clip = maak('clipPath', { id: id + klokNr });
      const cr = document.createElementNS(NS, 'rect');
      for (const [k, v] of Object.entries({ x: x, y: y, width: w, height: h, rx: 1.6 })) cr.setAttribute(k, v);
      clip.appendChild(cr);
      const g = maak('g', { 'clip-path': 'url(#' + id + klokNr + ')' });
      const t = document.createElementNS(NS, 'text');
      const at = { x: cx, y: (cy + h * 0.33).toFixed(2), class: tekstKlasse, 'text-anchor': 'middle' };
      if (tl) { at.textLength = tl; at.lengthAdjust = 'spacingAndGlyphs'; }
      for (const [k, v] of Object.entries(at)) t.setAttribute(k, v);
      g.appendChild(t);
      return t;
    }
    // de weekdag onder twaalf uur (breed kastje, tekst past zich aan de taal aan)
    const dag = kastje(100, 57, 58, 13, 'rr-kd', 'rr-dagtekst', 50);
    // de datum op drie uur (tegenover de gangreserve op negen uur)
    const datumTekst = kastje(147, 100, 17, 12, 'rr-kv', 'rr-datum');

    function slaOm(tekstEl, nieuw, hoogte) {
      if (RUSTIG || !tekstEl.isConnected) { tekstEl.textContent = nieuw; return; }
      const oud = tekstEl.cloneNode(true);
      tekstEl.parentNode.appendChild(oud);
      tekstEl.textContent = nieuw;
      const start = performance.now(), duur = 520;
      (function rol(t) {
        const p = Math.min(1, (t - start) / duur);
        const e = 1 - Math.pow(1 - p, 3);
        oud.setAttribute('transform', 'translate(0 ' + (-hoogte * e).toFixed(2) + ')');
        tekstEl.setAttribute('transform', 'translate(0 ' + (hoogte * (1 - e)).toFixed(2) + ')');
        if (p < 1) requestAnimationFrame(rol);
        else { oud.remove(); tekstEl.removeAttribute('transform'); }
      })(start);
    }

    /* ---- de gangreserve: een verzonken subwijzerplaat op negen uur ----
       De veer van het huis (shared/uurwerk.js) houdt over ALLE pagina's heen
       bij hoe ver het werk is opgewonden. Het boogje beslaat 230 graden:
       links leeg, rechts vol; de gevulde boog groeit mee met de wijzer. */
    const RES_A = 115 * Math.PI / 180;
    const resBoog = (a0, a1, r) => {
      const groot = (a1 - a0) > Math.PI ? 1 : 0;
      return 'M' + pt(r, a0) + 'A' + r + ' ' + r + ' 0 ' + groot + ' 1 ' + pt(r, a1);
    };
    const resG = maak('g', { transform: 'translate(53 100)' });
    const resRing = document.createElementNS(NS, 'circle');
    resRing.setAttribute('r', 11.5); resRing.setAttribute('class', 'rr-sub');
    resG.appendChild(resRing);
    const resDeel = (klasse, d) => {
      const q = document.createElementNS(NS, 'path');
      q.setAttribute('class', klasse); q.setAttribute('d', d);
      resG.appendChild(q);
      return q;
    };
    resDeel('rr-res', resBoog(-RES_A, RES_A, 9));
    for (let i = 0; i <= 4; i++) {
      const a = -RES_A + i / 4 * 2 * RES_A, l = document.createElementNS(NS, 'line');
      const b1 = pt(7.7, a).split(' '), b2 = pt(9, a).split(' ');
      l.setAttribute('x1', b1[0]); l.setAttribute('y1', b1[1]); l.setAttribute('x2', b2[0]); l.setAttribute('y2', b2[1]);
      l.setAttribute('class', 'rr-res');
      resG.appendChild(l);
    }
    const resVol = resDeel('rr-resvol', '');
    const resWijzer = document.createElementNS(NS, 'line');
    resWijzer.setAttribute('x1', 0); resWijzer.setAttribute('y1', 1.4);
    resWijzer.setAttribute('x2', 0); resWijzer.setAttribute('y2', -6.6);
    resWijzer.setAttribute('class', 'rr-reswijzer');
    resG.appendChild(resWijzer);
    const resAs = document.createElementNS(NS, 'circle');
    resAs.setAttribute('r', 0.9); resAs.setAttribute('class', 'rr-as');
    resG.appendChild(resAs);

    // subtiel 3D: een zacht glashoogsel over de plaat (licht van linksboven),
    // net onder de wijzers -- geeft diepte zonder op te vallen
    maak('circle', { cx: 100, cy: 100, r: 87, fill: 'url(#rr-glans' + klokNr + ')', 'pointer-events': 'none' });

    /* ---- de wijzers: gefacetteerde dauphine-wijzers op de exacte tijd ----
       Een gepolijst gouden lichaam met een heldere ribbel in het midden die
       het licht vangt, en een fijne slagschaduw eronder: zo lijken ze net
       boven de plaat te zweven. */
    const goud = 'url(#rr-goud' + klokNr + ')';
    // een dauphine: breed rond de basis, taps naar een punt aan de tip
    function dauphine(len, tail, w) {
      const b = w / 2;
      return 'M100 ' + (100 - len).toFixed(2) +
        ' L' + (100 + b) + ' ' + (100 - len * 0.34).toFixed(2) +
        ' L' + (100 + b * 0.5) + ' ' + (100 + tail).toFixed(2) +
        ' L' + (100 - b * 0.5) + ' ' + (100 + tail).toFixed(2) +
        ' L' + (100 - b) + ' ' + (100 - len * 0.34).toFixed(2) + ' Z';
    }
    const wijzers = maak('g', { filter: 'url(#rr-schaduw' + klokNr + ')' });
    function wijzer(len, tail, w) {
      const g = document.createElementNS(NS, 'g');
      const body = document.createElementNS(NS, 'path');
      body.setAttribute('d', dauphine(len, tail, w)); body.setAttribute('fill', goud);
      body.setAttribute('stroke', '#3E2E0C'); body.setAttribute('stroke-width', '0.25');
      const ribbel = document.createElementNS(NS, 'line');
      ribbel.setAttribute('x1', 100); ribbel.setAttribute('y1', (100 - len + 1).toFixed(2));
      ribbel.setAttribute('x2', 100); ribbel.setAttribute('y2', (100 + tail * 0.4).toFixed(2));
      ribbel.setAttribute('class', 'rr-ribbel'); ribbel.setAttribute('stroke-width', (w * 0.14).toFixed(2));
      g.append(body, ribbel);
      wijzers.appendChild(g);
      return g;
    }
    const uurW = wijzer(46, 11, 5.4);
    const minW = wijzer(72, 14, 3.9);
    // de secondewijzer: dun, met een klein tegengewicht
    const secG = document.createElementNS(NS, 'g');
    const secL = document.createElementNS(NS, 'line');
    secL.setAttribute('x1', 100); secL.setAttribute('y1', 118); secL.setAttribute('x2', 100); secL.setAttribute('y2', 9);
    secL.setAttribute('class', 'rr-sec');
    const secCw = document.createElementNS(NS, 'circle');
    secCw.setAttribute('cx', 100); secCw.setAttribute('cy', 118); secCw.setAttribute('r', 2.2); secCw.setAttribute('class', 'rr-seccw');
    secG.append(secL, secCw);
    wijzers.appendChild(secG);
    // de centrale kap (gepolijst goud met een donker hart)
    maak('circle', { cx: 100, cy: 100, r: 3.2, fill: goud, stroke: '#3E2E0C', 'stroke-width': 0.25 });
    maak('circle', { cx: 100, cy: 100, r: 1.05, fill: '#191309' });

    el.textContent = '';
    el.append(svg);

    let vorigeDag = '', vorigeDatum = '', vorigeKalenderdag = '', vorigeResHoek = -999;
    return d => {
      // de wijzers exact op de tijd (uur uit minuten, minuut uit seconden)
      const ms = RUSTIG ? 0 : d.getMilliseconds();
      const s = d.getSeconds() + ms / 1000;
      const m = d.getMinutes() + s / 60;
      const h = (d.getHours() % 12) + m / 60;
      uurW.setAttribute('transform', 'rotate(' + (h * 30).toFixed(3) + ' 100 100)');
      minW.setAttribute('transform', 'rotate(' + (m * 6).toFixed(3) + ' 100 100)');
      secG.setAttribute('transform', 'rotate(' + (s * 6).toFixed(3) + ' 100 100)');
      /* de datum verspringt niet stilletjes: precies om 00:00 rolt de schijf
         om. De eerste keer (en na een taalwissel) staat hij er direct. */
      const dagNr = String(d.getDate());
      if (dagNr !== vorigeDatum) {
        if (vorigeDatum === '') datumTekst.textContent = dagNr;
        else slaOm(datumTekst, dagNr, 11);
        vorigeDatum = dagNr;
      }
      // de weekdag in de taal van de gebruiker (paginataal, anders de
      // apparaattaal), met een hoofdletter
      const taal = document.documentElement.lang || navigator.language || 'nl';
      let wd; try { wd = d.toLocaleDateString(taal, { weekday: 'long' }); } catch (e) { wd = d.toLocaleDateString(undefined, { weekday: 'long' }); }
      const cap = wd ? wd.charAt(0).toUpperCase() + wd.slice(1) : '';
      const kalenderdag = d.toDateString();
      if (cap !== vorigeDag) {
        if (vorigeDag && kalenderdag !== vorigeKalenderdag) slaOm(dag, cap, 11);
        else dag.textContent = cap;
        vorigeDag = cap;
      }
      vorigeKalenderdag = kalenderdag;
      // de gangreserve volgt de veer van het huis (RTGUurwerk); zonder die
      // laag staat hij vol, zoals een horloge vers van de bank
      const uw = window.RTGUurwerk;
      const res = uw ? uw.reserve() : 1;
      const resHoek = -115 + 230 * res;
      if (Math.abs(resHoek - vorigeResHoek) > 0.4) {
        resWijzer.setAttribute('transform', 'rotate(' + resHoek.toFixed(1) + ')');
        resVol.setAttribute('d', res > 0.004 ? resBoog(-RES_A, resHoek * Math.PI / 180, 9) : '');
        vorigeResHoek = resHoek;
      }
    };
  }

  /* ---- de klok: compacte cijfers, of de ring (data-rtg-klok="ring") ---- */
  function maakKlok(el) {
    if (!el || el.dataset.rtgKlokActief) return;
    el.dataset.rtgKlokActief = '1';
    const verf = el.dataset.rtgKlok === 'ring' ? maakRing(el) : maakCijfers(el);
    (function stap() {
      verf(new Date());
      requestAnimationFrame(stap);
    })();
  }

  /* ---- de lange datum eronder, in de taal van de pagina ---- */
  function maakDatum(el) {
    if (!el || el.dataset.rtgDatumActief) return;
    el.dataset.rtgDatumActief = '1';
    const verf = () => {
      const taal = document.documentElement.lang || 'nl';
      try { el.textContent = new Date().toLocaleDateString(taal, { weekday: 'long', day: 'numeric', month: 'long' }); }
      catch (e) { el.textContent = new Date().toLocaleDateString(); }
    };
    verf();
    /* De lange datum slaat ECHT om 00:00 om: de timer mikt precies op
       middernacht en zet zichzelf daarna opnieuw voor de volgende nacht.
       Komt het tabblad terug uit de slaap (de timer kan dan gemist zijn),
       dan zet visibilitychange de datum meteen recht. */
    (function plan() {
      const nu = new Date();
      const middernacht = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() + 1, 0, 0, 0, 200);
      setTimeout(() => { verf(); plan(); }, Math.max(500, middernacht - nu));
    })();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) verf(); });
    // volgt de taalkiezer: zodra de pagina van taal wisselt (rtglang), staat de
    // lange datum meteen in de nieuwe taal, niet pas bij de volgende ronde
    window.addEventListener('rtglang', verf);
  }

  function alles() {
    document.querySelectorAll('[data-rtg-klok]').forEach(maakKlok);
    document.querySelectorAll('[data-rtg-datum]').forEach(maakDatum);
  }

  window.RTGKlok = { maakKlok, maakDatum, alles };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', alles);
  else alles();
})();
