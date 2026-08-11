    /* Vervolg van klok-01: het glas en de rest van de ringstijl. Geknipt omdat
       deel 01 met de glaslagen over de 10 KB-grens ging. De knip ligt midden in
       een stringconcatenatie -- deel 01 eindigt op een + en dit deel maakt hem
       af; de bundel plakt ze weer aaneen tot exact hetzelfde bestand. */
    /* HET GLAS. De klok had een slagschaduw en dus gewicht, maar geen
       oppervlak: hij las als een tekening van een horloge en niet als een
       horloge. Twee lagen erbij, allebei nauwelijks zichtbaar -- dat is de
       bedoeling (MATERIAAL.md: maximaal 2-3% oppervlakteschittering, geen
       zichtbare zware gradient).

       1. Een lichtval over het kristal, linksboven, die heel langzaam
          verschuift. Een horloge staat nooit precies stil onder een lamp.
       2. Een binnenschaduw langs de bovenrand: de kast werpt schaduw op de
          wijzerplaat. Dat is wat een plaat DIEPTE geeft in plaats van vlakheid.

       Beide staan boven de wijzerplaat maar onder de wijzers zou mooier zijn;
       dat kan hier niet zonder de SVG te herbouwen, en op deze sterkte is het
       verschil niet te zien. Eerlijk opgeschreven zodat niemand het later voor
       een vergissing aanziet. */
    '.rtg-ring::after{content:"";position:absolute;inset:1.5%;border-radius:50%;pointer-events:none;' +
      'z-index:2;' +
      'background:' +
        'radial-gradient(ellipse 62% 48% at 28% 20%,rgba(255,255,255,0.055) 0%,rgba(255,255,255,0.02) 42%,rgba(255,255,255,0) 68%),' +
        'linear-gradient(160deg,rgba(255,255,255,0.03) 0%,rgba(255,255,255,0) 38%);' +
      'box-shadow:inset 0 0.06rem 0.5rem rgba(0,0,0,0.38), inset 0 -0.04rem 0.3rem rgba(255,255,255,0.03);' +
      'animation:rtgGlas 24s ease-in-out infinite alternate;}' +
    '@keyframes rtgGlas{from{transform:translate(0,0);}to{transform:translate(1.2%,0.8%);}}' +
    '@media (prefers-reduced-motion:reduce){.rtg-ring::after{animation:none;}}' +
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
    ':root[data-levend="pastel"] .rtg-ring{--klok-plaat-a:#1B2733;--klok-plaat-b:#111C27;--klok-plaat-c:#0A121B;--klok-datum:#DCE7F2;--klok-venster:#070D15;--klok-lume:#CFE0F0;}' +

    /* ---------------------------------------------- de klok per RTG-thema --
       "Ieder zijn eigen klok die erbij past." Een wijzerplaat is hier geen
       kleurtje maar HETZELFDE MATERIAAL als de grond waarop de klok ligt: de
       drie stops zijn het hoogsel, de basis en de diepte van dat materiaal.
       Daarom staan hier geen hexcodes maar de tokens uit rtg-materiaal.css --
       verzin ik ze hier opnieuw, dan drijven klok en thema uit elkaar zonder
       dat iemand het merkt (dat is hier al eens gebeurd met een verzonnen
       champagne).

       Wat per thema WEL een besluit is, is de leeskleur op de plaat en het
       goud. Op champagne mag de logotoon zelf (donker op licht); op de drie
       donkere materialen leest alleen het hoogsel --gold-tekst goed genoeg.
       Dat is dezelfde regel die rtg-themas.css voor de rest van het scherm
       aanhoudt, hier alleen toegepast op een rond vlak. */
    ':root[data-rtg-thema="champagne"] .rtg-ring{' +
      '--klok-plaat-a:var(--pearl-hoog);--klok-plaat-b:var(--pearl-basis);--klok-plaat-c:var(--pearl-diep);' +
      '--klok-datum:var(--op-pearl);--klok-venster:var(--pearl-diep);' +
      '--klok-goud:var(--gold-basis);--klok-lume:var(--gold-diep);}' +
    ':root[data-rtg-thema="onyx"] .rtg-ring{' +
      '--klok-plaat-a:var(--onyx-hoog);--klok-plaat-b:var(--onyx-basis);--klok-plaat-c:var(--onyx-diep);' +
      '--klok-datum:var(--op-onyx);--klok-venster:var(--onyx-diep);' +
      '--klok-goud:var(--gold-tekst);--klok-lume:var(--op-onyx);}' +
    /* Fluweel begint bij de BASIS en niet bij het hoogsel. Met --bordeaux-hoog
       (#9E1C40) in het hart werd de plaat rood in plaats van wijn, en dat is
       precies wat MATERIAAL.md verbiedt: fluweel absorbeert licht en lijkt
       bijna zwart tot er licht op valt. De rand gaat daarom nog een stap
       dieper dan --bordeaux-diep -- afgeleid uit die toon, niet verzonnen. */
    ':root[data-rtg-thema="bordeaux"] .rtg-ring{' +
      '--klok-plaat-a:var(--bordeaux-basis);--klok-plaat-b:var(--bordeaux-diep);' +
      '--klok-plaat-c:color-mix(in srgb,var(--bordeaux-diep) 62%,#000);' +
      '--klok-datum:var(--op-bordeaux);--klok-venster:var(--bordeaux-diep);' +
      '--klok-goud:var(--gold-tekst);--klok-lume:var(--op-bordeaux);}' +
    ':root[data-rtg-thema="royal"] .rtg-ring{' +
      '--klok-plaat-a:var(--royal-hoog);--klok-plaat-b:var(--royal-basis);--klok-plaat-c:var(--royal-diep);' +
      '--klok-datum:var(--op-royal);--klok-venster:var(--royal-diep);' +
      '--klok-goud:var(--gold-tekst);--klok-lume:var(--op-royal);}';
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
