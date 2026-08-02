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
      // Drie schaduwen, want de wijzers liggen niet op één hoogte boven de plaat:
      // de uurwijzer onderop werpt een korte, harde schaduw, de minutenwijzer
      // ligt daarboven, de secondewijzer bovenop en werpt de langste en zachtste.
      // Juist dat hoogteverschil maakt van drie platte vormen een gestapeld
      // uurwerk. De richting volgt het glashoogsel (rr-glans, linksboven), dus
      // alles valt naar rechtsonder -- één lichtbron voor de hele wijzerplaat.
      // filterUnits="userSpaceOnUse": met een gebied op de objectBoundingBox is
      // 25% van een haardunne secondewijzer een fractie van een eenheid, en
      // knipt de wijzer zijn eigen schaduw weg.
      '<filter id="rr-schaduw' + klokNr + '" filterUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">' +
        '<feDropShadow dx="0.5" dy="0.6" stdDeviation="0.5" flood-color="#000" flood-opacity="0.55"/></filter>' +
      '<filter id="rr-schaduwm' + klokNr + '" filterUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">' +
        '<feDropShadow dx="0.9" dy="1.1" stdDeviation="0.8" flood-color="#000" flood-opacity="0.5"/></filter>' +
      '<filter id="rr-schaduws' + klokNr + '" filterUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">' +
        '<feDropShadow dx="1.4" dy="1.7" stdDeviation="1.15" flood-color="#000" flood-opacity="0.42"/></filter>';
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

