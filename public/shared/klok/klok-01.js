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
    // De klok hangt niet lós voor de achtergrond. Drie zwarte schaduwen zetten
    // hem in de ruimte: een korte contactschaduw die de kast gewicht geeft, een
    // lange zachte eronder, en een brede halo die de achtergrond vlak om de kast
    // dempt -- daardoor loopt de gouden rand over in het donker in plaats van
    // eruit geknipt te staan. Bewust géén gekleurde gloed: die leest als neon.
    // Het zit op een pseudo-element (dus één keer berekend) en niet op een filter
    // over de bewegende wijzers; die zou elke seconde opnieuw moeten renderen.
    '.rtg-ring::before{content:"";position:absolute;inset:1.5%;border-radius:50%;pointer-events:none;' +
      'box-shadow:0 0.3rem 0.9rem rgba(0,0,0,0.5), 0 1.5rem 3rem rgba(0,0,0,0.5),' +
      '0 0 4.5rem rgba(0,0,0,0.55);}' +
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
