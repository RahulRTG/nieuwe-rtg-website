  /* ------------------------------------------------------------- stijl */
  /* De vormtaal van het bedieningspaneel (shared/bediening.js): een blad dat
     van onderen opkomt, donker, met een gouden accent. Bewust dezelfde vorm --
     het is hetzelfde soort ding, en twee soorten bladen naast elkaar is weer
     een device erbij. */
  function stijl() {
    if (d.getElementById('amnCss')) return;
    var s = d.createElement('style'); s.id = 'amnCss';
    s.textContent =
      /* de knop zelf */
      '.amn-knop{position:relative;background:none;border:none;padding:0;cursor:pointer;' +
        'color:var(--muted,#8A8680);width:34px;height:34px;flex-shrink:0;' +
        'display:flex;align-items:center;justify-content:center;}' +
      '.amn-knop svg{width:21px;height:21px;stroke:currentColor;fill:none;' +
        'stroke-width:1.7;stroke-linecap:round;}' +
      '.amn-knop:hover{color:var(--txt,#F7F5F1);}' +
      '.amn-knop:focus-visible{outline:2px solid var(--gold,#857007);outline-offset:3px;border-radius:8px;}' +
      /* zwevend, voor de paar pagina\'s zonder eigen kopbalk */
      '.amn-knop.amn-zweef{position:fixed;z-index:9970;' +
        'top:calc(env(safe-area-inset-top,0px) + .55rem);' +
        'right:calc(env(safe-area-inset-right,0px) + .7rem);' +
        'width:38px;height:38px;border-radius:12px;color:#EDE9E3;' +
        'background:rgba(18,16,15,.72);border:1px solid rgba(255,255,255,.14);' +
        'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}' +
      /* het blad */
      '.amn-scrim{position:fixed;inset:0;z-index:9994;display:none;' +
        'align-items:flex-end;justify-content:center;background:rgba(6,5,5,.62);' +
        'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}' +
      '.amn-scrim.amn-open{display:flex;}' +
      '.amn-blad{width:min(430px,100%);max-height:86vh;overflow-y:auto;' +
        'background:linear-gradient(180deg,#151312,#0C0C0B);color:#F4F1EC;' +
        'border:1px solid var(--line,rgba(255,255,255,.14));border-bottom:none;' +
        'border-radius:20px 20px 0 0;' +
        'padding:.7rem 1.1rem calc(env(safe-area-inset-bottom,0px) + 1.1rem);' +
        'font-family:Inter,system-ui,sans-serif;box-shadow:0 -18px 50px rgba(0,0,0,.5);}' +
      '@media (min-width:640px){.amn-scrim{align-items:center;}' +
        '.amn-blad{border-radius:20px;border-bottom:1px solid var(--line,rgba(255,255,255,.14));}}' +
      '.amn-greep{width:38px;height:4px;border-radius:999px;margin:0 auto .7rem;' +
        'background:rgba(255,255,255,.18);}' +
      '.amn-kop{display:flex;align-items:baseline;justify-content:space-between;gap:.8rem;}' +
      '.amn-kop b{font-family:"Bodoni Moda",Georgia,serif;font-weight:500;font-size:1.2rem;' +
        'letter-spacing:-.01em;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '.amn-x{background:none;border:none;color:#8A8680;font-size:1rem;cursor:pointer;padding:.3rem .1rem;}' +
      '.amn-x:hover{color:#F4F1EC;}' +
      '.amn-sectie{color:#8A8680;font-size:.6rem;letter-spacing:.16em;text-transform:uppercase;' +
        'margin:1.1rem 0 .5rem;}' +
      /* de tegels: de functies van deze app, twee op een rij */
      '.amn-rooster{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;}' +
      '.amn-tegel{display:flex;align-items:center;gap:.55rem;text-align:left;cursor:pointer;' +
        'background:rgba(255,255,255,.04);border:1px solid var(--line,rgba(255,255,255,.12));' +
        'border-radius:14px;padding:.7rem .75rem;color:#F4F1EC;font:inherit;font-size:.82rem;' +
        'line-height:1.25;min-height:52px;}' +
      '.amn-tegel:hover{border-color:color-mix(in srgb, var(--gold,#857007) 55%, ' +
        'var(--line,rgba(255,255,255,.12)));}' +
      '.amn-tegel span{min-width:0;overflow:hidden;text-overflow:ellipsis;}' +
      '.amn-tegel svg,.amn-rij svg{width:17px;height:17px;flex-shrink:0;stroke:var(--gold,#857007);' +
        'fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;}' +
      /* de vaste rijen: overal hetzelfde, dus een lijst en geen tegels */
      '.amn-lijst{display:flex;flex-direction:column;}' +
      '.amn-rij{display:flex;align-items:center;gap:.7rem;width:100%;cursor:pointer;' +
        'background:none;border:none;border-top:1px solid var(--line,rgba(255,255,255,.1));' +
        'padding:.85rem .1rem;color:#F4F1EC;font:inherit;font-size:.88rem;text-align:left;}' +
      '.amn-lijst .amn-rij:first-child{border-top:none;}' +
      '.amn-rij:hover{color:#fff;}' +
      '.amn-rij em{font-style:normal;margin-left:auto;color:#8A8680;font-size:.72rem;' +
        'font-variant-numeric:tabular-nums;}' +
      '.amn-tegel:focus-visible,.amn-rij:focus-visible{outline:2px solid var(--gold,#857007);' +
        'outline-offset:2px;border-radius:10px;}' +
      '.amn-leeg{color:#8A8680;font-size:.78rem;line-height:1.5;margin:0;}';
    (d.head || d.documentElement).appendChild(s);
  }

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

