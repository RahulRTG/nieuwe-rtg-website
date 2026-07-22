/* De RTG-klok: EEN klok voor het hele besturingssysteem. Elke app die tijd
   toont gebruikt dit onderdeel, zodat de klok overal exact hetzelfde is:
   uren en minuten in Bodoni (het display-gezicht van het huis), seconden
   kleiner in hetzelfde gezicht, milliseconden als fijn goudaccent. De
   cijfers zijn tabulair (geen dansende breedtes) en lopen vloeiend mee op
   requestAnimationFrame; in een achtergrond-tabblad pauzeert dat vanzelf,
   en wie minder beweging wil (prefers-reduced-motion) ziet de
   milliseconden niet.

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
    // het ring-gezicht: de rode signatuur, de dubbele haarlijn-rand en goud.
    // --klok-goud laat het goud MEE VEREN met de kleuren van de pagina: het
    // meng het huisgoud met de levende dagkleur (of het seizoensaccent), zodat
    // de klok in de RTG-kleurenroulatie meedraait. Buiten een paletpagina valt
    // hij netjes terug op het vaste goud.
    '.rtg-ring{position:relative;display:inline-flex;align-items:center;justify-content:center;width:16rem;height:16rem;max-width:74vw;max-height:74vw;' +
      '--klok-goud:color-mix(in srgb, var(--dag-kleur, var(--s-accent-hel, var(--gold,#C9A24B))) 55%, var(--gold,#C9A24B));}' +
    '.rtg-ring svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}' +
    '.rtg-ring .rr-rand{fill:none;stroke:currentColor;stroke-opacity:0.22;stroke-width:0.7;}' +
    '.rtg-ring .rr-rehaut{fill:none;stroke:currentColor;stroke-opacity:0.1;stroke-width:0.7;}' +
    '.rtg-ring .rr-min{stroke:currentColor;stroke-opacity:0.16;stroke-width:0.7;}' +
    '.rtg-ring .rr-vijf{stroke:var(--klok-goud,var(--gold,#C9A24B));stroke-opacity:0.7;stroke-width:1.1;}' +
    '.rtg-ring .rr-naam{fill:var(--klok-goud,var(--gold,#C9A24B));font-family:Inter,system-ui,sans-serif;font-size:5.2px;font-weight:400;}' +
    '.rtg-ring .rr-venster{fill:rgba(0,0,0,0.4);stroke:currentColor;stroke-opacity:0.25;stroke-width:0.7;}' +
    ".rtg-ring .rr-datum{fill:var(--klok-goud,var(--gold,#C9A24B));font-family:'Bodoni Moda',serif;font-size:8.6px;font-variant-numeric:tabular-nums;}" +
    // de weekdag, tussen de naam en de tijd, in EXACT dezelfde stijl als de
    // datum: hetzelfde levende goud, hetzelfde Bodoni-gezicht en dezelfde maat
    ".rtg-ring .rr-dag{fill:var(--klok-goud,var(--gold,#C9A24B));font-family:'Bodoni Moda',serif;font-size:8.6px;}" +
    '.rtg-ring .rr-wijzer{fill:var(--klok-goud,var(--gold,#C9A24B));filter:drop-shadow(0 0 5px color-mix(in srgb, var(--klok-goud,var(--gold,#C9A24B)) 70%, transparent));}' +
    // het binnenwerk: radertjes, onrust en echappement, als door een geskeletteerde
    // plaat heen; gedempt goud, zodat het beweegt zonder de cijfers te storen
    '.rtg-ring .rr-rad{fill:var(--klok-goud,var(--gold,#C9A24B));fill-opacity:0.16;stroke:var(--klok-goud,var(--gold,#C9A24B));stroke-opacity:0.5;stroke-width:0.5;}' +
    '.rtg-ring .rr-spaak{stroke:var(--klok-goud,var(--gold,#C9A24B));stroke-opacity:0.45;stroke-width:0.7;}' +
    '.rtg-ring .rr-as{fill:var(--klok-goud,var(--gold,#C9A24B));fill-opacity:0.75;}' +
    '.rtg-ring .rr-onrust{fill:none;stroke:var(--klok-goud,var(--gold,#C9A24B));stroke-opacity:0.6;stroke-width:1.1;}' +
    '.rtg-ring .rr-spiraal{fill:none;stroke:var(--klok-goud,var(--gold,#C9A24B));stroke-opacity:0.45;stroke-width:0.35;}' +
    // de cijfers exact in het midden: naam en datumvenster staan er
    // symmetrisch omheen, zodat alles even ver van elkaar en de rand staat.
    // Het goud-accent van de milliseconden telt NIET mee voor het centreren
    // (het staat absoluut, rechts van de seconden), zodat HH:MM:SS precies op
    // dezelfde as staat als RAHUL TRAVEL GROUP en de datum, en niet naar links
    // verschuift door de breedte van het accent.
    // de wijzerplaat is altijd donker, dus de cijfers krijgen een vaste heldere
    // inkt (niet de paginakleur, die overdag donker wordt en zou wegvallen);
    // het goud-accent van de milliseconden houdt zijn eigen levende goud
    '.rtg-ring .rr-kern{position:relative;text-align:center;color:#F4F1EC;}' +
    '.rtg-ring .rr-kern .rtg-klok{font-size:2.05rem;justify-content:center;position:relative;}' +
    '.rtg-ring .rr-kern .km{position:absolute;left:100%;top:50%;transform:translateY(-50%);margin-left:0.22em;align-self:auto;}';
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

  /* ---- de RTG-ring: het signatuurgezicht van de klok ----
     Helemaal opnieuw getekend als een echte wijzerplaat, met de signatuur
     voorop: alleen RAHUL TRAVEL GROUP, voluit in het goud van het huis,
     onder twaalf uur. De plaat zelf is diep en stil:
     een dubbele haarlijn-rand (rehaut) met daartussen de minuutbaan van
     zestig fijne streepjes en gouden accenten op de vijf minuten, een
     wijzerplaat met zachte diepte, de Bodoni-cijfers in het midden, een
     datumvenster op zes uur, en de GOUDEN secondewijzer die als een klein
     juweel over de rand zweeft (op de milliseconden; wie minder beweging
     wil krijgt een wijzer die per seconde verspringt). */
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
    // de wijzerplaat: zachte diepte van binnen naar buiten
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = '<radialGradient id="rr-plaat" cx="50%" cy="42%" r="65%">' +
      '<stop offset="0%" stop-color="#1B1817"/><stop offset="72%" stop-color="#141211"/>' +
      '<stop offset="100%" stop-color="#0C0C0B"/></radialGradient>';
    svg.appendChild(defs);
    maak('circle', { cx: 100, cy: 100, r: 97, fill: 'url(#rr-plaat)' });
    // een maatsysteem als bij een echt horloge, alles op vaste afstanden:
    // rand r=97, streepband 94.5 tot 89.5 (minuut precies 2.5, vijf precies
    // het dubbele: 5.0), rehaut r=87.5 (2.0 onder de vijf-streep), en de
    // veger exact in het midden van de band (r=92.0)
    maak('circle', { cx: 100, cy: 100, r: 97, class: 'rr-rand' });
    maak('circle', { cx: 100, cy: 100, r: 87.5, class: 'rr-rehaut' });
    for (let m = 0; m < 60; m++) {
      const rad = m * 6 * Math.PI / 180, vijf = m % 5 === 0;
      const r1 = vijf ? 89.5 : 92.0, r2 = 94.5;
      maak('line', {
        x1: (100 + Math.sin(rad) * r1).toFixed(2), y1: (100 - Math.cos(rad) * r1).toFixed(2),
        x2: (100 + Math.sin(rad) * r2).toFixed(2), y2: (100 - Math.cos(rad) * r2).toFixed(2),
        class: vijf ? 'rr-vijf' : 'rr-min'
      });
    }
    /* ---- het binnenwerk: hier is echt tijd aan gespild ----
       Linksonder een raderwerk van drie in elkaar grijpende tandwielen; het
       grote wiel is het secondewiel (een omwenteling per minuut, gelijk met
       de gouden veger), de volgende draaien tegengesteld en sneller, precies
       volgens hun tandverhouding, zoals in een echt uurwerk. Rechtsonder het
       kloppende hart: de onrust die heen en weer slaat (3 Hz) op een
       spiraalveer, met daarnaast het echappementswiel dat per halve slag een
       tand doorklikt. Alles rekent op de kloktijd zelf, dus het loopt nooit
       uit de pas; wie minder beweging wil, ziet het binnenwerk stilstaan. */
    const P2 = Math.PI * 2;
    const pt = (r, a) => (r * Math.sin(a)).toFixed(2) + ' ' + (-r * Math.cos(a)).toFixed(2);
    function tandPad(r, tanden, punt) {
      const ri = r * (punt ? 0.68 : 0.8);
      let p = '';
      for (let i = 0; i < tanden; i++) {
        const a0 = (i / tanden) * P2, stap = P2 / tanden;
        p += (i ? 'L' : 'M') + pt(ri, a0) + 'L' + pt(ri, a0 + stap * 0.22) +
          'L' + pt(r, a0 + stap * (punt ? 0.44 : 0.32)) + 'L' + pt(r, a0 + stap * (punt ? 0.5 : 0.68)) +
          'L' + pt(ri, a0 + stap * 0.78);
      }
      return p + 'Z';
    }
    function rad(cx, cy, r, tanden, punt) {
      const g = maak('g', { transform: 'translate(' + cx + ' ' + cy + ')' });
      const pad = document.createElementNS(NS, 'path');
      pad.setAttribute('d', tandPad(r, tanden, punt));
      pad.setAttribute('class', 'rr-rad');
      g.appendChild(pad);
      for (let s = 0; s < 3; s++) {
        const a = s * P2 / 3, l = document.createElementNS(NS, 'line');
        const b = pt(r * 0.62, a).split(' ');
        l.setAttribute('x1', 0); l.setAttribute('y1', 0); l.setAttribute('x2', b[0]); l.setAttribute('y2', b[1]);
        l.setAttribute('class', 'rr-spaak');
        g.appendChild(l);
      }
      const as = document.createElementNS(NS, 'circle');
      as.setAttribute('r', Math.max(1, r * 0.12)); as.setAttribute('class', 'rr-as');
      g.appendChild(as);
      return { g, cx, cy };
    }
    // het raderwerk linksonder: 18, 12 en 8 tanden, netjes in elkaar grijpend
    const rad1 = rad(52, 122, 13, 18);
    const rad2 = rad(71.5, 133, 8.6, 12);
    const rad3 = rad(84.5, 141.5, 5.8, 8);
    // de onrust rechtsonder: balansring met dubbele spaak en de spiraalveer
    const onrust = maak('g', { transform: 'translate(147 123)' });
    const balans = document.createElementNS(NS, 'g');
    const ring = document.createElementNS(NS, 'circle');
    ring.setAttribute('r', 10.5); ring.setAttribute('class', 'rr-onrust');
    balans.appendChild(ring);
    for (const a of [0, Math.PI / 2]) {
      const l = document.createElementNS(NS, 'line');
      const p1 = pt(10.5, a).split(' '), p2 = pt(10.5, a + Math.PI).split(' ');
      l.setAttribute('x1', p1[0]); l.setAttribute('y1', p1[1]); l.setAttribute('x2', p2[0]); l.setAttribute('y2', p2[1]);
      l.setAttribute('class', 'rr-spaak');
      balans.appendChild(l);
    }
    const spiraal = document.createElementNS(NS, 'path');
    let sp = 'M0 0';
    for (let i = 1; i <= 96; i++) { const a = i / 96 * P2 * 3.5, r = 0.6 + 6.2 * i / 96; sp += 'L' + pt(r, a); }
    spiraal.setAttribute('d', sp); spiraal.setAttribute('class', 'rr-spiraal');
    balans.appendChild(spiraal);
    const nav = document.createElementNS(NS, 'circle');
    nav.setAttribute('r', 1.3); nav.setAttribute('class', 'rr-as');
    balans.appendChild(nav);
    onrust.appendChild(balans);
    // het echappementswiel tussen de onrust en het raderwerk, met puntige tanden
    const echap = rad(131.5, 138.5, 6.2, 15, true);
    // de signatuur: alleen de naam, in het goud van het huis, op vaste
    // breedte (textLength) exact gecentreerd
    const naam = maak('text', { x: 100, y: 41.5, class: 'rr-naam', 'text-anchor': 'middle',
      textLength: 86, lengthAdjust: 'spacing' });
    naam.textContent = 'RAHUL TRAVEL GROUP';
    /* De dag- en datumschijf draaien als bij een echt horloge OM: om 00:00
       rolt het oude cijfer omhoog het venster uit en komt het nieuwe eronder
       vandaan. Daarvoor krijgen beide een eigen kijkgat (clipPath), zodat de
       rollende schijf buiten het venster onzichtbaar blijft. */
    const klokNr = (maakRing.nr = (maakRing.nr || 0) + 1);
    const clipDag = maak('clipPath', { id: 'rr-kd' + klokNr });
    const clipDagRect = document.createElementNS(NS, 'rect');
    for (const [k, v] of Object.entries({ x: 40, y: 48, width: 120, height: 12 })) clipDagRect.setAttribute(k, v);
    clipDag.appendChild(clipDagRect);
    // de weekdag: tussen de naam en de tijd, natuurlijk gecentreerd (net als de
    // datum, geen opgelegde breedte), in de taal van de pagina (verf vult hem)
    const dagGroep = maak('g', { 'clip-path': 'url(#rr-kd' + klokNr + ')' });
    const dag = document.createElementNS(NS, 'text');
    for (const [k, v] of Object.entries({ x: 100, y: 55, class: 'rr-dag', 'text-anchor': 'middle' })) dag.setAttribute(k, v);
    dagGroep.appendChild(dag);
    // het datumvenster op zes uur: breder dan hoog, zoals bij een echt horloge
    const venster = maak('rect', { x: 91.5, y: 150, width: 17, height: 11, rx: 1.5, class: 'rr-venster' });
    const clipDatum = maak('clipPath', { id: 'rr-kv' + klokNr });
    const clipDatumRect = document.createElementNS(NS, 'rect');
    for (const [k, v] of Object.entries({ x: 91.5, y: 150, width: 17, height: 11, rx: 1.5 })) clipDatumRect.setAttribute(k, v);
    clipDatum.appendChild(clipDatumRect);
    const datumGroep = maak('g', { 'clip-path': 'url(#rr-kv' + klokNr + ')' });
    const datumTekst = document.createElementNS(NS, 'text');
    for (const [k, v] of Object.entries({ x: 100, y: 158.6, class: 'rr-datum', 'text-anchor': 'middle' })) datumTekst.setAttribute(k, v);
    datumGroep.appendChild(datumTekst);
    /* De omslag zelf: het oude cijfer schuift omhoog het kijkgat uit, het
       nieuwe komt van onderen mee, met een korte demping aan het eind, zoals
       een datumschijf die op zijn plek valt. Wie minder beweging wil
       (prefers-reduced-motion) ziet een directe wissel, ook precies om 00:00. */
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
    // de gouden veger: een klein juweel, exact in het midden van de streepband
    const wijzer = maak('circle', { cx: 100, cy: 8, r: 2.2, class: 'rr-wijzer' });
    const kern = document.createElement('div');
    kern.className = 'rr-kern';
    const tijd = document.createElement('div');
    kern.append(tijd);
    el.textContent = '';
    el.append(svg, kern);
    /* Het passwerk: de plaat meet zichzelf op en zet de VIJF luchtruimtes
       exact gelijk (rehaut -> naam -> weekdag -> cijfers -> venster -> rehaut),
       met de echte tekstmaten van dit toestel (getBBox/getBoundingClientRect),
       niet met aannames. Zo klopt het op elke schermdichtheid en elk font,
       zoals bij een echt horloge waar alles is opgemeten. */
    const REHAUT = 87.5;
    let kernSchuif = 0; // opgeteld, zodat een tweede meetronde bijstelt in plaats van overschrijft
    function passenwerk() {
      try {
        const rr = el.getBoundingClientRect();
        if (!rr.height) return; // nog niet in beeld; de volgende poging komt
        const schaal = 200 / rr.height;                    // px -> plaatmaat
        const bbN = naam.getBBox();
        const bbD = dag.getBBox();
        const bbK = kern.getBoundingClientRect();
        const kH = bbK.height * schaal;
        const vH = 11;
        const lucht = (2 * REHAUT - bbN.height - bbD.height - kH - vH) / 5;
        // de naam: bovenkant exact een luchtmaat onder de rehaut
        const naamTop = (100 - REHAUT) + lucht;
        naam.setAttribute('y', (Number(naam.getAttribute('y')) + (naamTop - bbN.y)).toFixed(2));
        // de weekdag: exact een luchtmaat onder de naam; het kijkgat van de
        // dagschijf schuift mee, strak om de tekstband heen
        const dagTop = naamTop + bbN.height + lucht;
        dag.setAttribute('y', (Number(dag.getAttribute('y')) + (dagTop - bbD.y)).toFixed(2));
        clipDagRect.setAttribute('y', (dagTop - 0.8).toFixed(2));
        clipDagRect.setAttribute('height', (bbD.height + 1.6).toFixed(2));
        // de cijfers: exact een luchtmaat onder de weekdag
        const wilKTop = dagTop + bbD.height + lucht;
        const kTop = (bbK.top - rr.top) * schaal; // inclusief de huidige verschuiving
        kernSchuif += (wilKTop - kTop) / schaal;
        kern.style.transform = 'translateY(' + kernSchuif.toFixed(2) + 'px)';
        // het venster: exact een luchtmaat onder de cijfers (en dus ook
        // exact een luchtmaat boven de onderrand)
        const vTop = wilKTop + kH + lucht;
        venster.setAttribute('y', vTop.toFixed(2));
        clipDatumRect.setAttribute('y', vTop.toFixed(2));
        datumTekst.setAttribute('y', (vTop + vH / 2 + 3.1).toFixed(2));
      } catch (e) { /* meten mag nooit de klok breken */ }
    }
    // meten zodra de fonts er echt zijn (Bodoni laadt asynchroon), en een
    // keer daarna voor het geval de plaat pas later in beeld kwam
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(passenwerk));
    setTimeout(passenwerk, 1200);
    const cijfers = maakCijfers(tijd);
    let vorigeDag = '', vorigeDatum = '', vorigeKalenderdag = '';
    return d => {
      cijfers(d);
      /* De datum verspringt niet stilletjes: precies om 00:00 slaat de schijf
         om, met de rol door het venster. De allereerste keer (en na een
         taalwissel) staat hij er direct, zonder theater. */
      const dagNr = String(d.getDate());
      if (dagNr !== vorigeDatum) {
        if (vorigeDatum === '') datumTekst.textContent = dagNr;
        else slaOm(datumTekst, dagNr, 12);
        vorigeDatum = dagNr;
      }
      // de weekdag in de taal van de pagina, met een hoofdletter; bij de
      // dagovergang rolt hij mee met de datumschijf, bij een taalwissel
      // wisselt hij direct
      const taal = document.documentElement.lang || 'nl';
      let wd; try { wd = d.toLocaleDateString(taal, { weekday: 'long' }); } catch (e) { wd = d.toLocaleDateString(undefined, { weekday: 'long' }); }
      const cap = wd ? wd.charAt(0).toUpperCase() + wd.slice(1) : '';
      const kalenderdag = d.toDateString();
      if (cap !== vorigeDag) {
        if (vorigeDag && kalenderdag !== vorigeKalenderdag) slaOm(dag, cap, 11);
        else dag.textContent = cap;
        vorigeDag = cap;
      }
      vorigeKalenderdag = kalenderdag;
      const sec = d.getSeconds() + (RUSTIG ? 0 : d.getMilliseconds() / 1000);
      wijzer.setAttribute('transform', 'rotate(' + (sec * 6) + ' 100 100)');
      /* het binnenwerk draait mee op de kloktijd: het secondewiel loopt
         gelijk met de veger, de volgende raderen tegengesteld op hun
         tandverhouding (18:12:8), de onrust slaat op 3 Hz en het
         echappement klikt zes tanden per seconde door */
      if (!RUSTIG) {
        const tt = d.getTime() / 1000;
        const a1 = sec * 6;
        rad1.g.setAttribute('transform', 'translate(' + rad1.cx + ' ' + rad1.cy + ') rotate(' + a1.toFixed(2) + ')');
        rad2.g.setAttribute('transform', 'translate(' + rad2.cx + ' ' + rad2.cy + ') rotate(' + (-a1 * 1.5).toFixed(2) + ')');
        rad3.g.setAttribute('transform', 'translate(' + rad3.cx + ' ' + rad3.cy + ') rotate(' + (a1 * 2.25).toFixed(2) + ')');
        balans.setAttribute('transform', 'rotate(' + (42 * Math.sin(tt * P2 * 3)).toFixed(2) + ')');
        echap.g.setAttribute('transform', 'translate(' + echap.cx + ' ' + echap.cy + ') rotate(' + ((Math.floor(tt * 6) % 15) * -24) + ')');
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
