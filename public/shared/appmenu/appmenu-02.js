/* de stijl van het bedieningspaneel */
  /* De vormtaal van het bedieningspaneel (shared/bediening.js): een blad dat
     van onderen opkomt, donker, met een gouden accent. Bewust dezelfde vorm --
     het is hetzelfde soort ding, en twee soorten bladen naast elkaar is weer
     een device erbij. */
  function laadAppmenuPresentatie(pad) {
    if (document.documentElement.hasAttribute('data-ds')) return;
    if (document.getElementById('rtgDsRuntimeCss')) return;
    var appmenuStijlLink = document.createElement('link');
    appmenuStijlLink.id = 'rtgDsRuntimeCss';
    appmenuStijlLink.rel = 'stylesheet';
    appmenuStijlLink.href = pad;
    document.head.appendChild(appmenuStijlLink);
  }

  function stijl() { laadAppmenuPresentatie('/ds/rtg-ds.css'); }

  /* ------------------------------------------------------------ tekens */
  /* Een handvol lijntekeningen, in dezelfde taal als de rest van het OS
     (1.6 lijndikte, ronde uiteinden). Meer iconen dan dit hoeft niet: wat
     geen eigen teken heeft krijgt de neutrale stip. */
  var TEKEN = {
    thuis: 'M4 11l8-7 8 7M6 10v9h12v-9',
    terug: 'M15 5l-7 7 7 7',
    /* Instellingen krijgt de schuifjes en niet nog een keer drie streepjes:
       dat is het teken van de menuknop zelf, en een rij die eruitziet als de
       knop waarmee je hem opende zegt niets. */
    instel: 'M4 8h16M4 16h16M9 6v4M15 14v4',
    bel: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
    rahul: 'M20.5 11.6a8.2 8.2 0 0 1-8.7 8.2L4 21l1.3-3.6a8.2 8.2 0 1 1 15.2-5.8z',
    zoek: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.6-3.6',
    deel: 'M12 15V4M8.5 7.5L12 4l3.5 3.5M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5',
    scan: 'M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M4 12h16',
    zegel: 'M12 3l7 3v5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6l7-3zM9 12l2 2 4-4',
    kantoor: 'M4 20V8l8-4 8 4v12M9 20v-5h6v5',
    vol: 'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3',
    uit: 'M12 3v9M6.6 7a8 8 0 1 0 10.8 0',
    stip: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'
  };
  function teken(naam) {
    var svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    var p = d.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', TEKEN[naam] || TEKEN.stip);
    svg.appendChild(p);
    return svg;
  }
