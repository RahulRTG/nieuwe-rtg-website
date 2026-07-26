  // ---- toepassen ----
  var STIJL_ID = 'levendegrond-stijl';
  /* Onzichtbaar zachte overgangen. We registreren de kleur-custom-properties als
     echte <color> (@property), zodat de browser ELKE waarde-sprong zelf vloeiend
     interpoleert -- of dat nu de trage levende drift is (de tint schuift in hele
     kleine stapjes) of een themawissel (wit <-> donker <-> standaard). Daardoor
     zie je met het blote oog nooit een kleur "omklappen"; het glijdt.
     - de levende was schuift heel traag: een lange, lineaire smoothing (~3s)
     - de thematokens wisselen in een keer: een korte, zachte kruisvervaging
     Wie bewegingsarm wil (prefers-reduced-motion) krijgt gewoon directe wissels. */
  var LEVEND_KLEUR = ['--levend-top', '--levend-onder', '--levend-basis'];
  function zorgStijl() {
    if (d.getElementById(STIJL_ID)) return;
    var st = d.createElement('style'); st.id = STIJL_ID;
    // alleen de levende was-kleuren registreren als <color> (die zet deze motor
    // zelf, niemand leunt op een var()-terugval); de thematokens NIET registreren,
    // anders zou hun initiele waarde de var(--card,#fallback) overal overrulen.
    var reg = LEVEND_KLEUR.map(function (n) {
      var init = n === '--levend-basis' ? '#0C0C0B' : 'transparent';
      return '@property ' + n + '{syntax:"<color>";inherits:true;initial-value:' + init + ';}';
    }).join('');
    var levendTrans = LEVEND_KLEUR.map(function (n) { return n + ' 3s linear'; }).join(',');
    st.textContent = reg +
      '[data-levendegrond]{background:' +
        'radial-gradient(150% 80% at 50% -8%, var(--levend-top), transparent 60%),' +
        'radial-gradient(132% 72% at 50% 116%, var(--levend-onder), transparent 62%),' +
        'var(--levend-basis) !important;}' +
      '@media (prefers-reduced-motion: no-preference){' +
        // de levende drift: elke minieme tint-sprong wordt over 3s uitgesmeerd, dus
        // je ziet de kleur nooit "verspringen" -- hij glijdt onmerkbaar
        ':root{transition:' + levendTrans + ';}' +
        // de themawissel (wit <-> donker <-> standaard): een zachte kruisvervaging
        // van de grote vlakken en de kaarten (achtergrond + tekst + randen), veilig
        // via gewone properties -- geen @property, dus var(--token,#fallback) blijft heel
        'body,[data-levendegrond],[data-levend-thema],.card,.os-tegel,.tkc,.topbar,.tabbar,.os-dock{transition:background-color .8s ease,color .8s ease,border-color .8s ease;}}';
    (d.head || d.documentElement).appendChild(st);
  }

  function rtfWereld() { try { return /\/apps\/foundation\//.test(w.location.pathname); } catch (e) { return false; } }
  function familieNu() {
    var el = d.documentElement;
    var vast = el.getAttribute('data-levend');
    if (vast && FAMILIES[vast]) return vast;
    // de RTFoundation-app draait op een eigen familie: pastelblauw
    if (rtfWereld()) return 'pastel';
    var pas = el.getAttribute('data-pas-thema');
    if (pas === 'parelmoer') return 'champagne';
    // standaard (geen attribuut) valt terug op donker; zonder pas-thema is de
    // huiskleur Bordeaux (rood), zodat de grond meteen rood is voordat het thema-
    // script het attribuut zet
    if (pas === 'bordeaux' || pas == null) return 'bordeaux';
    return 'donker';
  }

  var vorige = '', fase = 0, laatstT = 0;
  function nowMs() { try { return w.performance && w.performance.now ? w.performance.now() : Date.now(); } catch (e) { return Date.now(); } }
  function verf() {
    if (!d.querySelector('[data-levendegrond]')) return;
    zorgStijl();
    // de ademhaling: de fase loopt sneller door naarmate de beweging hoger staat
    var beweeg = bFactor();
    var t = nowMs(); var dt = laatstT ? Math.min(0.2, (t - laatstT) / 1000) : 0; laatstT = t;
    fase += dt * (0.10 + beweeg * 0.35) * 2 * Math.PI; // ~8-20s per cyclus
    var sh = beweeg > 0 ? Math.sin(fase) : 0;
    var p = palet(familieNu(), null, beweeg, sh);
    var sleutel = p.top + '|' + p.onder + '|' + p.basis;
    if (sleutel === vorige) return; // niets veranderd: geen schrijf naar het scherm
    vorige = sleutel;
    var r = d.documentElement.style;
    r.setProperty('--levend-top', p.top);
    r.setProperty('--levend-onder', p.onder);
    r.setProperty('--levend-basis', p.basis);
  }

  /* ---- het knopje: een pil die door vier standen loopt (stil / rustig /
     normaal / levendig). Linksonder, boven de themakiezer als die er is. ---- */
  var STANDEN = [{ w: 0, n: 'Stil' }, { w: 30, n: 'Rustig' }, { w: 62, n: 'Normaal' }, { w: 100, n: 'Levendig' }];
  function bMerk() {
    var el = d.getElementById('bewegingKnop'); if (!el) return;
    var lab = el.querySelector('.bw-label'); if (lab) lab.textContent = bNiveau().charAt(0).toUpperCase() + bNiveau().slice(1);
  }
  function bStijl() {
    if (d.getElementById('bewegingCss')) return;
    var st = d.createElement('style'); st.id = 'bewegingCss';
    st.textContent =
      '#bewegingKnop{position:fixed;left:max(14px,env(safe-area-inset-left,0px));z-index:9990;' +
        'bottom:calc(64px + env(safe-area-inset-bottom,0px));display:inline-flex;align-items:center;gap:.45rem;' +
        'padding:.4rem .7rem .4rem .55rem;border-radius:999px;cursor:pointer;font-family:Inter,system-ui,sans-serif;' +
        'font-size:.7rem;font-weight:600;letter-spacing:.02em;color:var(--txt,#F4F1EC);' +
        'background:color-mix(in srgb, var(--card,#151312) 82%, transparent);' +
        'border:1px solid var(--line,rgba(255,255,255,.14));box-shadow:0 10px 30px rgba(0,0,0,.4);' +
        'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);}' +
      '#bewegingKnop svg{flex:0 0 auto;color:var(--gold,#A98F1C);}' +
      '#bewegingKnop:focus-visible{outline:2px solid var(--gold,#A98F1C);outline-offset:2px;}' +
      '@media print{#bewegingKnop{display:none;}}';
    (d.head || d.documentElement).appendChild(st);
  }
  function bouwKnop() {
    if (d.getElementById('bewegingKnop') || !d.body) return;
    // op het leden-OS zit de beweging in het bedieningspaneel (een schuif), dus
    // daar geen zwevend knopje dat de tabbalk zou overlappen
    if (d.getElementById('osCcScrim')) return;
    bStijl();
    var b = d.createElement('button'); b.id = 'bewegingKnop'; b.type = 'button';
    b.setAttribute('aria-label', 'Snelheid en intensiteit van de beweging');
    b.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M4 12a8 8 0 0 1 8-8"/><path d="M7.5 12a4.5 4.5 0 0 1 4.5-4.5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>' +
      '<span class="bw-label"></span>';
    b.addEventListener('click', function () {
      var v = bWaarde(), i = 0;
      for (var k = 0; k < STANDEN.length; k++) if (Math.abs(STANDEN[k].w - v) <= 8) { i = k; break; }
      bZet(STANDEN[(i + 1) % STANDEN.length].w);
    });
    d.body.appendChild(b);
    bMerk();
  }

  // continu, maar zuinig: rAF pauzeert vanzelf als het tabblad weg is, en we
  // schrijven alleen bij een echte verandering (de tint schuift heel traag).
  var loopt = false;
  function lus() { verf(); w.requestAnimationFrame(lus); }
  function start() {
    // in de RTFoundation-app hangen we de grond vanzelf aan de schil, zodat de
    // pastelblauwe was op elke RTF-pagina meekleurt zonder dat elke pagina een
    // eigen markering nodig heeft
    if (rtfWereld()) {
      // markeer de RTF-wereld op <html> zodat ook de klok en andere onderdelen
      // de pastelblauwe familie via CSS kunnen oppakken
      if (!d.documentElement.getAttribute('data-levend')) d.documentElement.setAttribute('data-levend', 'pastel');
      if (!d.querySelector('[data-levendegrond]')) {
        var doel = d.getElementById('shell') || d.body;
        if (doel) doel.setAttribute('data-levendegrond', '');
      }
    }
    bPas(); bouwKnop();
    zorgStijl(); verf();
    if (!loopt && w.requestAnimationFrame) { loopt = true; w.requestAnimationFrame(lus); }
  }

  // als het thema verandert, meteen opnieuw verven (de familie is dan anders)
  function familie() { vorige = ''; verf(); }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();

  w.RTGLevend = { palet: palet, verf: verf, familie: familie };
  // de beweging (snelheid/intensiteit) is ook los te bedienen, bv. vanuit een
  // eigen schuif in het bedieningspaneel
  w.RTGBeweging = { waarde: bWaarde, factor: bFactor, niveau: bNiveau, zet: bZet };
})(window, document);
