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
    ".rtg-klok .ku{font-family:'Bodoni Moda',serif;font-weight:600;letter-spacing:0.01em;}" +
    ".rtg-klok .ks{font-family:'Bodoni Moda',serif;font-weight:500;font-size:0.5em;opacity:0.85;margin-left:0.1em;}" +
    '.rtg-klok .km{font-family:Inter,system-ui,sans-serif;font-weight:500;font-size:0.26em;letter-spacing:0.08em;' +
      'color:var(--gold,#C9A24B);margin-left:0.22em;min-width:3.6ch;text-align:left;align-self:center;}' +
    '@media (prefers-reduced-motion: reduce){.rtg-klok .km{display:none;}}' +
    // het ring-gezicht: bordeaux haarlijn, gouden veger, monogram op twaalf
    '.rtg-ring{position:relative;display:inline-flex;align-items:center;justify-content:center;width:15.5rem;height:15.5rem;max-width:72vw;max-height:72vw;}' +
    '.rtg-ring svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}' +
    '.rtg-ring .rr-ring{fill:none;stroke:var(--burgundy,#7F1634);stroke-opacity:0.85;stroke-width:1.4;}' +
    '.rtg-ring .rr-bezel{fill:none;stroke:currentColor;stroke-opacity:0.16;stroke-width:1;}' +
    '.rtg-ring .rr-schroef{fill:currentColor;fill-opacity:0.28;}' +
    '.rtg-ring .rr-tapblok{fill:currentColor;fill-opacity:0.012;}' +
    '.rtg-ring .rr-min{stroke:currentColor;stroke-opacity:0.18;stroke-width:0.8;}' +
    '.rtg-ring .rr-vijf{stroke:var(--gold,#C9A24B);stroke-opacity:0.55;stroke-width:1.2;}' +
    '.rtg-ring .rr-venster{fill:rgba(0,0,0,0.35);stroke:var(--gold,#C9A24B);stroke-opacity:0.4;stroke-width:0.8;}' +
    ".rtg-ring .rr-datum{fill:var(--gold,#C9A24B);font-family:'Bodoni Moda',serif;font-size:10.5px;font-variant-numeric:tabular-nums;}" +
    ".rtg-ring .rr-monogram{fill:var(--gold,#C9A24B);font-family:'Bodoni Moda',serif;font-size:13px;letter-spacing:3.5px;}" +
    '.rtg-ring .rr-wijzer{fill:var(--gold,#C9A24B);filter:drop-shadow(0 0 6px color-mix(in srgb, var(--gold,#C9A24B) 65%, transparent));}' +
    '.rtg-ring .rr-kern{text-align:center;}' +
    '.rtg-ring .rr-kern.rtg-klok{font-size:2.05rem;}';
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
     Een subtiele mix van de grote horlogetaal, maar echt RTG-eigen:
     - een achthoekige haarlijn-bezel om de ronde wijzerplaat, met acht
       fijne schroefjes op de hoeken (de taal van de Royal Oak, in fluister),
     - een minuutbaan van zestig fijne streepjes met gouden accenten op de
       vijf minuten, en een datumvenster op drie uur (de taal van Rolex),
     - een heel zachte tapisserie-structuur in het hart,
     - en het RTG-anker dat alles draagt: de bordeaux ring, de GOUDEN
       secondewijzer die er mechanisch omheen zweeft (op de milliseconden),
       de Bodoni-cijfers in het midden en het monogram op twaalf uur.
     Wie minder beweging wil, krijgt een wijzer die per seconde verspringt. */
  function maakRing(el) {
    el.classList.add('rtg-ring');
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.setAttribute('aria-hidden', 'true');
    // de achthoekige bezel met schroefjes op de hoeken
    const acht = [];
    for (let i = 0; i < 8; i++) {
      const rad = (i * 45 + 22.5) * Math.PI / 180;
      acht.push([100 + Math.sin(rad) * 99, 100 - Math.cos(rad) * 99]);
    }
    const bezel = document.createElementNS(NS, 'polygon');
    bezel.setAttribute('points', acht.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '));
    bezel.setAttribute('class', 'rr-bezel');
    svg.appendChild(bezel);
    for (const [x, y] of acht) {
      const schroef = document.createElementNS(NS, 'circle');
      schroef.setAttribute('cx', x.toFixed(1)); schroef.setAttribute('cy', y.toFixed(1)); schroef.setAttribute('r', '1.5');
      schroef.setAttribute('class', 'rr-schroef');
      svg.appendChild(schroef);
    }
    // de zachte tapisserie in het hart (een fijn ruitraster, nauwelijks daar)
    const patroon = document.createElementNS(NS, 'pattern');
    patroon.setAttribute('id', 'rr-tap'); patroon.setAttribute('width', '7'); patroon.setAttribute('height', '7');
    patroon.setAttribute('patternUnits', 'userSpaceOnUse'); patroon.setAttribute('patternTransform', 'rotate(45)');
    const blokje = document.createElementNS(NS, 'rect');
    blokje.setAttribute('width', '5.4'); blokje.setAttribute('height', '5.4');
    blokje.setAttribute('class', 'rr-tapblok');
    patroon.appendChild(blokje);
    svg.appendChild(patroon);
    const hart = document.createElementNS(NS, 'circle');
    hart.setAttribute('cx', '100'); hart.setAttribute('cy', '100'); hart.setAttribute('r', '88');
    hart.setAttribute('fill', 'url(#rr-tap)');
    svg.appendChild(hart);
    // de bordeaux ring, het anker
    const cirkel = document.createElementNS(NS, 'circle');
    cirkel.setAttribute('cx', '100'); cirkel.setAttribute('cy', '100'); cirkel.setAttribute('r', '96');
    cirkel.setAttribute('class', 'rr-ring');
    svg.appendChild(cirkel);
    // de minuutbaan: zestig fijne streepjes, goud op de vijf minuten
    for (let m = 0; m < 60; m++) {
      if (m === 0) continue; // twaalf uur draagt het monogram
      const rad = m * 6 * Math.PI / 180;
      const vijf = m % 5 === 0;
      const lijn = document.createElementNS(NS, 'line');
      const r1 = vijf ? 89.5 : 92.5;
      lijn.setAttribute('x1', (100 + Math.sin(rad) * r1).toFixed(2)); lijn.setAttribute('y1', (100 - Math.cos(rad) * r1).toFixed(2));
      lijn.setAttribute('x2', (100 + Math.sin(rad) * 96).toFixed(2)); lijn.setAttribute('y2', (100 - Math.cos(rad) * 96).toFixed(2));
      lijn.setAttribute('class', vijf ? 'rr-vijf' : 'rr-min');
      svg.appendChild(lijn);
    }
    // het datumvenster op drie uur
    const venster = document.createElementNS(NS, 'rect');
    venster.setAttribute('x', '91.5'); venster.setAttribute('y', '150'); venster.setAttribute('width', '17'); venster.setAttribute('height', '15');
    venster.setAttribute('rx', '2'); venster.setAttribute('class', 'rr-venster');
    svg.appendChild(venster);
    const datumTekst = document.createElementNS(NS, 'text');
    datumTekst.setAttribute('x', '100'); datumTekst.setAttribute('y', '161.2');
    datumTekst.setAttribute('class', 'rr-datum'); datumTekst.setAttribute('text-anchor', 'middle');
    svg.appendChild(datumTekst);
    // het monogram op twaalf uur
    const monogram = document.createElementNS(NS, 'text');
    monogram.setAttribute('x', '100'); monogram.setAttribute('y', '22');
    monogram.setAttribute('class', 'rr-monogram'); monogram.setAttribute('text-anchor', 'middle');
    monogram.textContent = 'RTG';
    svg.appendChild(monogram);
    // de gouden veger
    const wijzer = document.createElementNS(NS, 'circle');
    wijzer.setAttribute('cx', '100'); wijzer.setAttribute('cy', '4'); wijzer.setAttribute('r', '3.4');
    wijzer.setAttribute('class', 'rr-wijzer');
    svg.appendChild(wijzer);
    const kern = document.createElement('div');
    kern.className = 'rr-kern';
    el.textContent = '';
    el.append(svg, kern);
    const cijfers = maakCijfers(kern);
    return d => {
      cijfers(d);
      datumTekst.textContent = String(d.getDate());
      const sec = d.getSeconds() + (RUSTIG ? 0 : d.getMilliseconds() / 1000);
      wijzer.setAttribute('transform', 'rotate(' + (sec * 6) + ' 100 100)');
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
    setInterval(verf, 30000);
  }

  function alles() {
    document.querySelectorAll('[data-rtg-klok]').forEach(maakKlok);
    document.querySelectorAll('[data-rtg-datum]').forEach(maakDatum);
  }

  window.RTGKlok = { maakKlok, maakDatum, alles };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', alles);
  else alles();
})();
