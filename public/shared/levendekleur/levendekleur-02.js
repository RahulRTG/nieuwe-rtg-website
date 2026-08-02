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
        'body,[data-levendegrond],[data-levend-thema],.card,.os-tegel,.tkc,.topbar,.tabbar,.os-aibalk{transition:background-color .8s ease,color .8s ease,border-color .8s ease;}}';
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
  /* De grond-markering werd elk beeldframe met een documentbrede
     attribuut-selector opgezocht -- ook op de pagina's die hem helemaal niet
     hebben. Nu onthouden we het element; alleen als het er (nog) niet is of
     uit de DOM verdween kijken we opnieuw, hooguit twee keer per seconde. */
  var grondEl = null, grondGezocht = 0;
  function verf() {
    if (grondEl && !grondEl.isConnected) grondEl = null;
    if (!grondEl) {
      var t0 = nowMs();
      if (t0 - grondGezocht < 500) return;
      grondGezocht = t0;
      grondEl = d.querySelector('[data-levendegrond]');
      if (!grondEl) return;
    }
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

  /* ---- de vier standen (stil / rustig / normaal / levendig).
     Dit stond als een zwevende pil linksonder op elk scherm, samen met de
     themakiezer, de taalknop en het vraagteken -- vier losse knopjes op
     dezelfde vierkante centimeter. Ze staan nu bij elkaar in het
     bedieningspaneel (shared/bediening.js), dat ze via RTGBeweging bedient.
     Het leden-OS had zijn eigen schuif in het paneel en houdt die. ---- */
  var STANDEN = [{ w: 0, n: 'Stil' }, { w: 30, n: 'Rustig' }, { w: 62, n: 'Normaal' }, { w: 100, n: 'Levendig' }];

  // continu, maar zuinig: rAF pauzeert vanzelf als het tabblad weg is, we
  // kijken tien keer per seconde (de ademhaling doet 8-20 seconden over een
  // cyclus, dus dat is al onzichtbaar glad) en we schrijven alleen bij een
  // echte verandering (de tint schuift heel traag).
  var loopt = false, lusT = 0;
  function lus(t) {
    w.requestAnimationFrame(lus);
    if (t - lusT < 100) return;
    lusT = t;
    verf();
  }
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
    bPas();
    zorgStijl(); verf();
    if (!loopt && w.requestAnimationFrame) { loopt = true; w.requestAnimationFrame(lus); }
  }

  // als het thema verandert, meteen opnieuw verven (de familie is dan anders)
  function familie() { vorige = ''; verf(); }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();

  w.RTGLevend = { palet: palet, verf: verf, familie: familie };
  // de beweging (snelheid/intensiteit) is los te bedienen: met de vier vaste
  // standen vanuit het bedieningspaneel, of met een eigen schuif zoals het
  // leden-OS die heeft
  w.RTGBeweging = { standen: STANDEN, waarde: bWaarde, factor: bFactor, niveau: bNiveau, zet: bZet };
})(window, document);
