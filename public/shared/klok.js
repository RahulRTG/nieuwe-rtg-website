/* De RTG-klok: EEN klok voor het hele besturingssysteem. Elke app die tijd
   toont gebruikt dit onderdeel, zodat de klok overal exact hetzelfde is:
   uren en minuten in Bodoni (het display-gezicht van het huis), seconden
   kleiner in hetzelfde gezicht, milliseconden als fijn goudaccent. De
   cijfers zijn tabulair (geen dansende breedtes) en lopen vloeiend mee op
   requestAnimationFrame; in een achtergrond-tabblad pauzeert dat vanzelf,
   en wie minder beweging wil (prefers-reduced-motion) ziet de
   milliseconden niet.

   De ring (data-rtg-klok="ring") is een verfijnde, ingetogen wijzerplaat in
   de taal van een klassiek chique horloge: slanke, gepolijste wijzers met
   een lume-kanaal, een fijne lollipop-secondewijzer, toegepaste indexen met
   lume-punten en een licht verdiepte plaat. Het GOUD staat vast (het
   huisgoud, altijd goud); de SFEER -- de fijne sunray en de accent-flens --
   ademt mee met de levende dagkleur van het palet. De weekdag (in de taal
   van de gebruiker) en de datum staan in identieke gouden kastjes: een
   kloppend geheel.

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
    // Twee sleutelkleuren: --klok-goud = het HUISGOUD (staat VAST), --klok-sfeer
    // = de levende dagkleur van het palet (hierin ademt de fijne sunray + flens).
    '.rtg-ring{position:relative;display:inline-flex;align-items:center;justify-content:center;width:16rem;height:16rem;max-width:74vw;max-height:74vw;' +
      '--klok-goud:var(--gold,#C9A24B);' +
      '--klok-sfeer:var(--dag-kleur,var(--s-accent-hel,var(--s-accent,#7F1634)));}' +
    '.rtg-ring svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}' +
    // fijne randen: een gouden haarlijn buiten, een witte lichtlijn, een
    // paletkleurige accent-flens
    '.rtg-ring .rr-rand{fill:none;stroke:var(--klok-goud);stroke-opacity:0.5;stroke-width:0.7;}' +
    '.rtg-ring .rr-rehaut{fill:none;stroke:#ffffff;stroke-opacity:0.05;stroke-width:0.6;}' +
    '.rtg-ring .rr-flens{fill:none;stroke:var(--klok-sfeer);stroke-opacity:0.3;stroke-width:0.7;}' +
    // de sunray-plaat: heel fijne stralen in de paletkleur (ingetogen)
    // de guilloché-golfplaat: fijne golflijntjes in de paletkleur (de sfeer)
    '.rtg-ring .rr-golf{stroke:var(--klok-sfeer);stroke-opacity:0.07;stroke-width:0.4;}' +
    // de minutenbaan: heel fijn, gouden accent op de vijf minuten
    '.rtg-ring .rr-min{stroke:#ffffff;stroke-opacity:0.26;stroke-width:0.55;}' +
    '.rtg-ring .rr-vijf{stroke:var(--klok-goud);stroke-opacity:0.85;stroke-width:1.0;}' +
    // toegepaste indexen in het vaste goud, met een lume-punt net erbinnen
    '.rtg-ring .rr-index{fill:var(--klok-goud);}' +
    '.rtg-ring .rr-lume{fill:var(--klok-lume,#E7E2CC);}' +
    // signatuur (fijn, ruim gespatieerd) en de kastjes voor dag en datum
    '.rtg-ring .rr-naam{fill:var(--klok-goud);font-family:Inter,system-ui,sans-serif;font-size:4.6px;font-weight:500;letter-spacing:0.12em;}' +
    '.rtg-ring .rr-venster{fill:var(--klok-venster,#050504);}' +
    '.rtg-ring .rr-vensterlijst{fill:none;stroke:var(--klok-goud);stroke-opacity:0.8;stroke-width:0.9;}' +
    ".rtg-ring .rr-datum{fill:var(--klok-datum,#EFE8D2);font-family:'Bodoni Moda',serif;font-size:7.4px;font-variant-numeric:tabular-nums;}" +
    ".rtg-ring .rr-dagtekst{fill:var(--klok-datum,#EFE8D2);font-family:'Bodoni Moda',serif;font-size:6.4px;letter-spacing:0.03em;}" +
    // de fijne gouden secondewijzer met lollipop
    '.rtg-ring .rr-sec{stroke:var(--klok-goud);stroke-width:0.5;stroke-linecap:round;}' +
    '.rtg-ring .rr-seccw{fill:var(--klok-goud);}' +
    '.rtg-ring .rr-seclolring{fill:var(--klok-venster,#050504);stroke:var(--klok-goud);stroke-width:0.7;}' +
    // de wijzerplaat zelf (de drie radiale stops) volgt het thema, zodat de klok
    // meekleurt i.p.v. altijd donker te blijven
    '.rtg-ring .rr-plaat-a{stop-color:var(--klok-plaat-a,#1E1B1A);}' +
    '.rtg-ring .rr-plaat-b{stop-color:var(--klok-plaat-b,#131110);}' +
    '.rtg-ring .rr-plaat-c{stop-color:var(--klok-plaat-c,#080807);}' +
    // vier thema's, elk een eigen wijzerplaat. Donker is de basis (geen attribuut,
    // dus de fallbacks hierboven). Champagne (parelmoer) is licht met donkere
    // datum; Bordeaux een diepe wijnrode plaat; pastel (RTF) een zacht blauw.
    ':root[data-pas-thema="parelmoer"] .rtg-ring{--klok-plaat-a:#FBF6EA;--klok-plaat-b:#F0E7D3;--klok-plaat-c:#E2D6BC;--klok-datum:#3A2E1A;--klok-venster:#EADFC6;--klok-lume:#B8993C;}' +
    ':root[data-pas-thema="bordeaux"] .rtg-ring{--klok-plaat-a:#3A1120;--klok-plaat-b:#260A16;--klok-plaat-c:#15040C;--klok-datum:#F2DEE4;--klok-venster:#0C0308;--klok-lume:#E7CFD6;}' +
    ':root[data-levend="pastel"] .rtg-ring{--klok-plaat-a:#1B2733;--klok-plaat-b:#111C27;--klok-plaat-c:#0A121B;--klok-datum:#DCE7F2;--klok-venster:#070D15;--klok-lume:#CFE0F0;}';
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

  /* ---- de RTG-ring: het verfijnde signatuurgezicht van de klok ----
     Ingetogen luxe: een licht verdiepte plaat met een fijne sunray, slanke
     applied indexen met lume-punten, en gepolijste, slanke wijzers met een
     lume-kanaal plus een fijne lollipop-secondewijzer. De weekdag (in de taal
     van de gebruiker) en de datum staan in identieke gouden kastjes -- dag
     onder twaalf uur, datum op drie uur. Het goud staat vast; de sunray en de
     accent-flens ademen mee met het palet. */
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

    // defs: plaatdiepte, gepolijst (champagne)goud, een randvignet voor de
    // verdieping, een zacht glashoogsel en een fijne slagschaduw
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML =
      '<radialGradient id="rr-plaat' + klokNr + '" cx="50%" cy="38%" r="70%">' +
        '<stop class="rr-plaat-a" offset="0%"/><stop class="rr-plaat-b" offset="68%"/>' +
        '<stop class="rr-plaat-c" offset="100%"/></radialGradient>' +
      '<linearGradient id="rr-goud' + klokNr + '" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0%" stop-color="#6B5320"/><stop offset="20%" stop-color="#C0A45A"/>' +
        '<stop offset="46%" stop-color="#F3E6BC"/><stop offset="50%" stop-color="#FBF4DA"/>' +
        '<stop offset="55%" stop-color="#E7D6A0"/><stop offset="82%" stop-color="#9C7E36"/>' +
        '<stop offset="100%" stop-color="#61491A"/></linearGradient>' +
      '<radialGradient id="rr-vig' + klokNr + '" cx="50%" cy="50%" r="52%">' +
        '<stop offset="0%" stop-color="rgba(0,0,0,0)"/><stop offset="76%" stop-color="rgba(0,0,0,0)"/>' +
        '<stop offset="100%" stop-color="rgba(0,0,0,0.45)"/></radialGradient>' +
      '<radialGradient id="rr-glans' + klokNr + '" cx="37%" cy="27%" r="60%">' +
        '<stop offset="0%" stop-color="rgba(255,251,240,0.11)"/>' +
        '<stop offset="52%" stop-color="rgba(255,251,240,0.015)"/>' +
        '<stop offset="100%" stop-color="rgba(255,251,240,0)"/></radialGradient>' +
      '<filter id="rr-schaduw' + klokNr + '" x="-25%" y="-25%" width="150%" height="150%">' +
        '<feDropShadow dx="0" dy="0.55" stdDeviation="0.6" flood-color="#000" flood-opacity="0.45"/></filter>';
    svg.appendChild(defs);

    // de plaat + een fijne guilloché-golfstructuur (Seamaster-taal) + randvignet
    maak('circle', { cx: 100, cy: 100, r: 97, fill: 'url(#rr-plaat' + klokNr + ')' });
    // de golfplaat: fijne horizontale golflijntjes, geklonken binnen de plaat,
    // in de paletkleur zodat de sfeer meeademt (het goud blijft goud)
    const golfClip = maak('clipPath', { id: 'rr-golf' + klokNr });
    const gc = document.createElementNS(NS, 'circle');
    for (const [k, v] of Object.entries({ cx: 100, cy: 100, r: 86 })) gc.setAttribute(k, v);
    golfClip.appendChild(gc);
    const golfG = maak('g', { 'clip-path': 'url(#rr-golf' + klokNr + ')' });
    for (let y = 13; y <= 187; y += 3.2) {
      let dd = 'M6 ' + y.toFixed(1);
      for (let x = 8; x <= 194; x += 3) dd += ' L' + x + ' ' + (y + Math.sin(x / 15 * P2) * 1.15).toFixed(2);
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', dd); p.setAttribute('class', 'rr-golf'); p.setAttribute('fill', 'none');
      golfG.appendChild(p);
    }
    maak('circle', { cx: 100, cy: 100, r: 97, fill: 'url(#rr-vig' + klokNr + ')', 'pointer-events': 'none' });
    // de randen
    maak('circle', { cx: 100, cy: 100, r: 97, class: 'rr-rand' });
    maak('circle', { cx: 100, cy: 100, r: 95, class: 'rr-rehaut' });
    maak('circle', { cx: 100, cy: 100, r: 84, class: 'rr-flens' });
    // de minutenbaan
    for (let m = 0; m < 60; m++) {
      const rad = m * 6 * Math.PI / 180, vijf = m % 5 === 0;
      const r1 = vijf ? 90.5 : 92.5, r2 = 94.5;
      maak('line', {
        x1: (100 + Math.sin(rad) * r1).toFixed(2), y1: (100 - Math.cos(rad) * r1).toFixed(2),
        x2: (100 + Math.sin(rad) * r2).toFixed(2), y2: (100 - Math.cos(rad) * r2).toFixed(2),
        class: vijf ? 'rr-vijf' : 'rr-min'
      });
    }
    // slanke toegepaste indexen op de twaalf uren (dubbel op twaalf), elk met
    // een fijne lume-punt net erbinnen
    for (let h = 0; h < 12; h++) {
      const a = h * 30 * Math.PI / 180, rIn = 81, rUit = 88;
      const dx = Math.sin(a), dy = -Math.cos(a), nx = -dy, ny = dx;
      const P = (r, o) => (100 + dx * r + nx * o).toFixed(2) + ' ' + (100 + dy * r + ny * o).toFixed(2);
      const baton = (o0, o1) => maak('path', { class: 'rr-index',
        d: 'M' + P(rIn, o0) + 'L' + P(rUit, o0) + 'L' + P(rUit, o1) + 'L' + P(rIn, o1) + 'Z' });
      if (h === 0) { baton(-2.0, -0.5); baton(0.5, 2.0); }   // dubbele index op 12
      else baton(-0.75, 0.75);
      // de lume-punt
      maak('circle', { cx: (100 + dx * 78).toFixed(2), cy: (100 + dy * 78).toFixed(2), r: 0.85, class: 'rr-lume' });
    }

    // de signatuur onder twaalf uur, op vaste breedte gecentreerd; iets lager
    // gezet zodat er meer lucht tussen de bovenrand en de naam staat
    const naam = maak('text', { x: 100, y: 46, class: 'rr-naam', 'text-anchor': 'middle',
      textLength: 78, lengthAdjust: 'spacing' });
    naam.textContent = 'RAHUL TRAVEL GROUP';

    /* Een gedeeld "kastje": een diep zwart venster met een fijne gouden lijst
       en een kijkgat (clip) voor de rol-omslag. Weekdag en datum krijgen EXACT
       hetzelfde kastje, zodat het een kloppend geheel is: de weekdag (in de
       taal van de gebruiker) onder twaalf uur, de datum op drie uur. */
    function kastje(cx, cy, w, h, id, tekstKlasse, tl) {
      const x = +(cx - w / 2).toFixed(2), y = +(cy - h / 2).toFixed(2);
      maak('rect', { x: x, y: y, width: w, height: h, rx: 1.4, class: 'rr-venster' });
      maak('rect', { x: x, y: y, width: w, height: h, rx: 1.4, class: 'rr-vensterlijst' });
      const clip = maak('clipPath', { id: id + klokNr });
      const cr = document.createElementNS(NS, 'rect');
      for (const [k, v] of Object.entries({ x: x, y: y, width: w, height: h, rx: 1.4 })) cr.setAttribute(k, v);
      clip.appendChild(cr);
      const g = maak('g', { 'clip-path': 'url(#' + id + klokNr + ')' });
      const t = document.createElementNS(NS, 'text');
      // exact verticaal centreren met dominant-baseline (niet met de hand raden)
      const at = { x: cx, y: cy, class: tekstKlasse, 'text-anchor': 'middle', 'dominant-baseline': 'central' };
      if (tl) { at.textLength = tl; at.lengthAdjust = 'spacingAndGlyphs'; }
      for (const [k, v] of Object.entries(at)) t.setAttribute(k, v);
      g.appendChild(t);
      return t;
    }
    // twee kastjes met dezelfde hoogte en verhouding: de weekdag onder twaalf
    // uur (breed, tekst past zich aan de taal aan), de datum op drie uur
    const dag = kastje(100, 61, 50, 10.5, 'rr-kd', 'rr-dagtekst', 42);
    const datumTekst = kastje(148, 100, 15.5, 10.5, 'rr-kv', 'rr-datum');

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

    // subtiel 3D: een zacht glashoogsel over de plaat (licht van linksboven),
    // net onder de wijzers
    maak('circle', { cx: 100, cy: 100, r: 87, fill: 'url(#rr-glans' + klokNr + ')', 'pointer-events': 'none' });

    /* ---- de wijzers: slank, gepolijst goud met een lume-kanaal ----
       Een fijne baton met een pale lume-strook in het midden, en een fijne
       slagschaduw eronder: ingetogen, precies, chic. De secondewijzer is dun
       met een lollipop en een klein tegengewicht. */
    const goud = 'url(#rr-goud' + klokNr + ')';
    function baton(len, tail, w) {
      const b = w / 2;
      return 'M' + (100 - b) + ' ' + (100 - len * 0.1).toFixed(2) +
        ' L' + (100 - b * 0.78) + ' ' + (100 - len) +
        ' L' + (100 + b * 0.78) + ' ' + (100 - len) +
        ' L' + (100 + b) + ' ' + (100 - len * 0.1).toFixed(2) +
        ' L' + (100 + b * 0.85) + ' ' + (100 + tail) +
        ' L' + (100 - b * 0.85) + ' ' + (100 + tail) + ' Z';
    }
    const wijzers = maak('g', { filter: 'url(#rr-schaduw' + klokNr + ')' });
    function wijzer(len, tail, w) {
      const g = document.createElementNS(NS, 'g');
      const body = document.createElementNS(NS, 'path');
      body.setAttribute('d', baton(len, tail, w)); body.setAttribute('fill', goud);
      body.setAttribute('stroke', '#3E2E0C'); body.setAttribute('stroke-width', '0.2');
      const lume = document.createElementNS(NS, 'line');
      lume.setAttribute('x1', 100); lume.setAttribute('y1', (100 - len + 3).toFixed(2));
      lume.setAttribute('x2', 100); lume.setAttribute('y2', (100 - len * 0.06).toFixed(2));
      lume.setAttribute('stroke', '#E7E2CC'); lume.setAttribute('stroke-width', (w * 0.4).toFixed(2));
      lume.setAttribute('stroke-linecap', 'round');
      g.append(body, lume);
      wijzers.appendChild(g);
      return g;
    }
    const uurW = wijzer(45, 10, 3.6);
    const minW = wijzer(71, 13, 2.7);
    // de secondewijzer: dun, met lollipop en tegengewicht
    const secG = document.createElementNS(NS, 'g');
    const secL = document.createElementNS(NS, 'line');
    secL.setAttribute('x1', 100); secL.setAttribute('y1', 116); secL.setAttribute('x2', 100); secL.setAttribute('y2', 14);
    secL.setAttribute('class', 'rr-sec');
    const secLol = document.createElementNS(NS, 'circle');
    secLol.setAttribute('cx', 100); secLol.setAttribute('cy', 30); secLol.setAttribute('r', 2.3); secLol.setAttribute('class', 'rr-seclolring');
    const secLolK = document.createElementNS(NS, 'circle');
    secLolK.setAttribute('cx', 100); secLolK.setAttribute('cy', 30); secLolK.setAttribute('r', 1.05); secLolK.setAttribute('class', 'rr-lume');
    const secCw = document.createElementNS(NS, 'circle');
    secCw.setAttribute('cx', 100); secCw.setAttribute('cy', 116); secCw.setAttribute('r', 1.9); secCw.setAttribute('class', 'rr-seccw');
    secG.append(secL, secLol, secLolK, secCw);
    wijzers.appendChild(secG);
    // de centrale kap
    maak('circle', { cx: 100, cy: 100, r: 2.9, fill: goud, stroke: '#3E2E0C', 'stroke-width': 0.2 });
    maak('circle', { cx: 100, cy: 100, r: 0.95, fill: '#191309' });

    el.textContent = '';
    el.append(svg);

    let vorigeDag = '', vorigeDatum = '', vorigeKalenderdag = '';
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
        else slaOm(datumTekst, dagNr, 10);
        vorigeDatum = dagNr;
      }
      // de weekdag in de taal van de gebruiker (paginataal, anders apparaattaal)
      const taal = document.documentElement.lang || navigator.language || 'nl';
      let wd; try { wd = d.toLocaleDateString(taal, { weekday: 'long' }); } catch (e) { wd = d.toLocaleDateString(undefined, { weekday: 'long' }); }
      const cap = wd ? wd.charAt(0).toUpperCase() + wd.slice(1) : '';
      const kalenderdag = d.toDateString();
      if (cap !== vorigeDag) {
        if (vorigeDag && kalenderdag !== vorigeKalenderdag) slaOm(dag, cap, 10);
        else dag.textContent = cap;
        vorigeDag = cap;
      }
      vorigeKalenderdag = kalenderdag;
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
