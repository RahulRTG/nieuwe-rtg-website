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
      'color:var(--gold,#C9A24B);margin-left:0.22em;min-width:3.6ch;text-align:left;align-self:center;}' +
    '@media (prefers-reduced-motion: reduce){.rtg-klok .km{display:none;}}' +
    // het ring-gezicht: de rode signatuur, de dubbele haarlijn-rand en goud
    '.rtg-ring{position:relative;display:inline-flex;align-items:center;justify-content:center;width:16rem;height:16rem;max-width:74vw;max-height:74vw;}' +
    '.rtg-ring svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}' +
    '.rtg-ring .rr-rand{fill:none;stroke:currentColor;stroke-opacity:0.22;stroke-width:0.7;}' +
    '.rtg-ring .rr-rehaut{fill:none;stroke:currentColor;stroke-opacity:0.1;stroke-width:0.7;}' +
    '.rtg-ring .rr-min{stroke:currentColor;stroke-opacity:0.16;stroke-width:0.7;}' +
    '.rtg-ring .rr-vijf{stroke:var(--gold,#C9A24B);stroke-opacity:0.7;stroke-width:1.1;}' +
    '.rtg-ring .rr-naam{fill:var(--gold,#C9A24B);font-family:Inter,system-ui,sans-serif;font-size:5.2px;font-weight:400;}' +
    '.rtg-ring .rr-venster{fill:rgba(0,0,0,0.4);stroke:currentColor;stroke-opacity:0.25;stroke-width:0.7;}' +
    ".rtg-ring .rr-datum{fill:var(--gold,#C9A24B);font-family:'Bodoni Moda',serif;font-size:8.6px;font-variant-numeric:tabular-nums;}" +
    '.rtg-ring .rr-wijzer{fill:var(--gold,#C9A24B);filter:drop-shadow(0 0 5px color-mix(in srgb, var(--gold,#C9A24B) 70%, transparent));}' +
    // de cijfers exact in het midden: naam en datumvenster staan er
    // symmetrisch omheen, zodat alles even ver van elkaar en de rand staat.
    // Het goud-accent van de milliseconden telt NIET mee voor het centreren
    // (het staat absoluut, rechts van de seconden), zodat HH:MM:SS precies op
    // dezelfde as staat als RAHUL TRAVEL GROUP en de datum, en niet naar links
    // verschuift door de breedte van het accent.
    '.rtg-ring .rr-kern{position:relative;text-align:center;}' +
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
    // de signatuur: alleen de naam, in het goud van het huis, op vaste
    // breedte (textLength) exact gecentreerd
    const naam = maak('text', { x: 100, y: 41.5, class: 'rr-naam', 'text-anchor': 'middle',
      textLength: 86, lengthAdjust: 'spacing' });
    naam.textContent = 'RAHUL TRAVEL GROUP';
    // het datumvenster op zes uur: breder dan hoog, zoals bij een echt horloge
    const venster = maak('rect', { x: 91.5, y: 150, width: 17, height: 11, rx: 1.5, class: 'rr-venster' });
    const datumTekst = maak('text', { x: 100, y: 158.6, class: 'rr-datum', 'text-anchor': 'middle' });
    // de gouden veger: een klein juweel, exact in het midden van de streepband
    const wijzer = maak('circle', { cx: 100, cy: 8, r: 2.2, class: 'rr-wijzer' });
    const kern = document.createElement('div');
    kern.className = 'rr-kern';
    const tijd = document.createElement('div');
    kern.append(tijd);
    el.textContent = '';
    el.append(svg, kern);
    /* Het passwerk: de plaat meet zichzelf op en zet de VIER luchtruimtes
       exact gelijk (rehaut -> naam -> cijfers -> venster -> rehaut), met de
       echte tekstmaten van dit toestel (getBBox/getBoundingClientRect), niet
       met aannames. Zo klopt het op elke schermdichtheid en elk font, zoals
       bij een echt horloge waar alles is opgemeten. */
    const REHAUT = 87.5;
    let kernSchuif = 0; // opgeteld, zodat een tweede meetronde bijstelt in plaats van overschrijft
    function passenwerk() {
      try {
        const rr = el.getBoundingClientRect();
        if (!rr.height) return; // nog niet in beeld; de volgende poging komt
        const schaal = 200 / rr.height;                    // px -> plaatmaat
        const bbN = naam.getBBox();
        const bbK = kern.getBoundingClientRect();
        const kH = bbK.height * schaal;
        const vH = 11;
        const lucht = (2 * REHAUT - bbN.height - kH - vH) / 4;
        // de naam: bovenkant exact een luchtmaat onder de rehaut
        const naamY = Number(naam.getAttribute('y')) + ((100 - REHAUT + lucht) - bbN.y);
        naam.setAttribute('y', naamY.toFixed(2));
        // de cijfers: exact een luchtmaat onder de naam
        const wilKTop = (100 - REHAUT) + lucht + bbN.height + lucht;
        const kTop = (bbK.top - rr.top) * schaal; // inclusief de huidige verschuiving
        kernSchuif += (wilKTop - kTop) / schaal;
        kern.style.transform = 'translateY(' + kernSchuif.toFixed(2) + 'px)';
        // het venster: exact een luchtmaat onder de cijfers (en dus ook
        // exact een luchtmaat boven de onderrand)
        const vTop = wilKTop + kH + lucht;
        venster.setAttribute('y', vTop.toFixed(2));
        datumTekst.setAttribute('y', (vTop + vH / 2 + 3.1).toFixed(2));
      } catch (e) { /* meten mag nooit de klok breken */ }
    }
    // meten zodra de fonts er echt zijn (Bodoni laadt asynchroon), en een
    // keer daarna voor het geval de plaat pas later in beeld kwam
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(passenwerk));
    setTimeout(passenwerk, 1200);
    const cijfers = maakCijfers(tijd);
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
