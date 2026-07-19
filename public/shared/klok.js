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
    '.rtg-ring .rr-streep{stroke:currentColor;stroke-opacity:0.35;stroke-width:1.4;}' +
    ".rtg-ring .rr-monogram{fill:var(--gold,#C9A24B);font-family:'Bodoni Moda',serif;font-size:13px;letter-spacing:3.5px;}" +
    '.rtg-ring .rr-wijzer{fill:var(--gold,#C9A24B);filter:drop-shadow(0 0 6px color-mix(in srgb, var(--gold,#C9A24B) 65%, transparent));}' +
    '.rtg-ring .rr-kern{text-align:center;}' +
    '.rtg-ring .rr-kern .rtg-klok{font-size:2.6rem;}';
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
     Een dunne bordeaux haarlijn-cirkel met een GOUDEN secondewijzer die er
     mechanisch omheen zweeft (de sweep van een automatisch horloge; daarom
     lopen de milliseconden mee), fijne streepjes op de kwartieren, de
     Bodoni-cijfers in het midden en het RTG-monogram op twaalf uur. Zie je
     die ring, dan denk je RTG. Wie minder beweging wil, krijgt een wijzer
     die per seconde verspringt. */
  function maakRing(el) {
    el.classList.add('rtg-ring');
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.setAttribute('aria-hidden', 'true');
    const cirkel = document.createElementNS(NS, 'circle');
    cirkel.setAttribute('cx', '100'); cirkel.setAttribute('cy', '100'); cirkel.setAttribute('r', '96');
    cirkel.setAttribute('class', 'rr-ring');
    svg.appendChild(cirkel);
    for (const hoek of [90, 180, 270]) { // kwartier-streepjes (12 uur draagt het monogram)
      const lijn = document.createElementNS(NS, 'line');
      const rad = hoek * Math.PI / 180;
      lijn.setAttribute('x1', 100 + Math.sin(rad) * 90); lijn.setAttribute('y1', 100 - Math.cos(rad) * 90);
      lijn.setAttribute('x2', 100 + Math.sin(rad) * 96); lijn.setAttribute('y2', 100 - Math.cos(rad) * 96);
      lijn.setAttribute('class', 'rr-streep');
      svg.appendChild(lijn);
    }
    const monogram = document.createElementNS(NS, 'text');
    monogram.setAttribute('x', '100'); monogram.setAttribute('y', '22');
    monogram.setAttribute('class', 'rr-monogram'); monogram.setAttribute('text-anchor', 'middle');
    monogram.textContent = 'RTG';
    svg.appendChild(monogram);
    const wijzer = document.createElementNS(NS, 'circle'); // de gouden veger
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
