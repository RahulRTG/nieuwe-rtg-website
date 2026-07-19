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
    // het ring-gezicht: de rode signatuur, de dubbele haarlijn-rand en goud
    '.rtg-ring{position:relative;display:inline-flex;align-items:center;justify-content:center;width:16rem;height:16rem;max-width:74vw;max-height:74vw;}' +
    '.rtg-ring svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}' +
    '.rtg-ring .rr-rand{fill:none;stroke:currentColor;stroke-opacity:0.22;stroke-width:0.7;}' +
    '.rtg-ring .rr-rehaut{fill:none;stroke:currentColor;stroke-opacity:0.1;stroke-width:0.7;}' +
    '.rtg-ring .rr-min{stroke:currentColor;stroke-opacity:0.16;stroke-width:0.7;}' +
    '.rtg-ring .rr-vijf{stroke:var(--gold,#C9A24B);stroke-opacity:0.7;stroke-width:1.1;}' +
    '.rtg-ring .rr-naam{fill:var(--gold,#C9A24B);font-family:Inter,system-ui,sans-serif;font-size:5.4px;font-weight:600;}' +
    '.rtg-ring .rr-venster{fill:rgba(0,0,0,0.4);stroke:currentColor;stroke-opacity:0.25;stroke-width:0.7;}' +
    ".rtg-ring .rr-datum{fill:var(--gold,#C9A24B);font-family:'Bodoni Moda',serif;font-size:10.5px;font-variant-numeric:tabular-nums;}" +
    '.rtg-ring .rr-wijzer{fill:var(--gold,#C9A24B);filter:drop-shadow(0 0 5px color-mix(in srgb, var(--gold,#C9A24B) 70%, transparent));}' +
    '.rtg-ring .rr-kern{position:relative;text-align:center;margin-top:0.9rem;}' +
    '.rtg-ring .rr-kern.rtg-klok{font-size:2.05rem;}' +
    '.rtg-ring .rr-kern .km{align-self:baseline;}';
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
    // de dubbele haarlijn-rand (rehaut) met de minuutbaan ertussen
    maak('circle', { cx: 100, cy: 100, r: 97, class: 'rr-rand' });
    maak('circle', { cx: 100, cy: 100, r: 88.5, class: 'rr-rehaut' });
    for (let m = 0; m < 60; m++) {
      const rad = m * 6 * Math.PI / 180, vijf = m % 5 === 0;
      const r1 = vijf ? 90.5 : 92.8, r2 = 95.4;
      maak('line', {
        x1: (100 + Math.sin(rad) * r1).toFixed(2), y1: (100 - Math.cos(rad) * r1).toFixed(2),
        x2: (100 + Math.sin(rad) * r2).toFixed(2), y2: (100 - Math.cos(rad) * r2).toFixed(2),
        class: vijf ? 'rr-vijf' : 'rr-min'
      });
    }
    // de signatuur: alleen de naam, in het goud van het huis, op vaste
    // breedte (textLength) zodat hij exact gecentreerd en rustig gespreid is
    const naam = maak('text', { x: 100, y: 45, class: 'rr-naam', 'text-anchor': 'middle',
      textLength: 86, lengthAdjust: 'spacing' });
    naam.textContent = 'RAHUL TRAVEL GROUP';
    // het datumvenster op zes uur
    maak('rect', { x: 91, y: 148, width: 18, height: 15, rx: 2, class: 'rr-venster' });
    const datumTekst = maak('text', { x: 100, y: 159.2, class: 'rr-datum', 'text-anchor': 'middle' });
    // de gouden veger: een klein juweel op de rand
    const wijzer = maak('circle', { cx: 100, cy: 7, r: 2.6, class: 'rr-wijzer' });
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
