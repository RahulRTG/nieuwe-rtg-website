/* Cookiemelding voor de site en de apps. RTG gebruikt alleen functionele
   opslag (ingelogd blijven, voorkeuren), geen tracking en geen cookies van
   derden; daarom is dit een eerlijke melding met een knop, geen
   toestemmingsmuur. Eén keer bevestigen is genoeg (localStorage). */
(function () {
  var SLEUTEL = 'rtg_cookieinfo_v1';
  /* Een Work OS-surface deelt dezelfde herkomst en dezelfde opslag met de
     buitenschil. Eén melding buiten de surface is daarom volledig; iedere
     iframe opnieuw laten melden gaf dubbele regels boven op de onderbalk. */
  try { if (window.self !== window.top) return; } catch (e) { return; }
  try { if (localStorage.getItem(SLEUTEL)) return; } catch (e) { return; }

  var en = false;
  try { en = (window.RTGi18n && RTGi18n.lang === 'en') || /^en/.test(navigator.language || ''); } catch (e) {}
  /* HEEL MINIMAAL, en dat is hier ook het eerlijkste.
     Dit was een kaart: een omkaderd vlak van 440px met een slagschaduw, drie
     regels tekst en een witte pilknop. Op de poort nam dat een kwart van het
     scherm en trok het meer aandacht dan de kennismaking met Rahul zelf --
     terwijl de mededeling is dat we juist NIETS doen. Een toestemmingsmuur
     hoort groot te zijn; een mededeling niet.
     Wat er overblijft is een regel: de zin, en twee woorden om op te klikken.
     Geen kader, geen schaduw, geen knopvlak. */
  var T = en
    ? { txt: 'Functional storage only', ok: 'Fine', privacy: 'Privacy' }
    : { txt: 'Alleen functionele opslag', ok: 'Prima', privacy: 'Privacy' };

  var stijl = document.createElement('style');
  stijl.textContent =
    '#rtg-cookie{position:fixed;left:50%;bottom:max(0.6rem,env(safe-area-inset-bottom));transform:translateX(-50%);' +
      'z-index:9999;width:max-content;max-width:min(92vw,34rem);display:flex;align-items:baseline;justify-content:center;' +
      /* EEN EIGEN VLAK, en dat is een besluit van 24 augustus 2026. Hier stond
         background:none, en daardoor was haar grond onvoorspelbaar: op salon en
         sociaal ligt er een lichte balk achter een bijna zwarte pagina, en geen
         enkele inktkleur haalt beide. Vier meetpogingen liepen daarop stuk. Een
         mededeling die de wet vraagt, hoort niet af te hangen van wat er
         toevallig achter ligt. Het vlak is dekkend en volgt het materiaal (zie
         kiesInkt in deel 02); een dunne bovenlijn geeft hem zijn rand, en verder
         niets -- geen hoek, geen schaduw, geen knopvorm om de twee woorden. */
      'gap:0.5rem;flex-wrap:wrap;border:0;border-top:1px solid var(--rtg-cookie-lijn);' +
      'background:var(--rtg-cookie-vlak);box-shadow:none;padding:0.55rem 0.9rem;' +
      'font-family:var(--rtg-interface,Inter,system-ui,sans-serif);font-size:0.7rem;line-height:1.4;' +
      'letter-spacing:0.01em;text-align:center;}' +
    /* DE MELDING DRAAGT background:none EN ERFT DUS DE PAGINAGROND, en daarom
       kan hier geen enkele vaste kleur staan. Tot 22 augustus 2026 stond er een
       lichte ivoortint: op een licht thema gaf dat 1,03:1 -- onzichtbare tekst
       onder een juridische mededeling, en precies daar waar hij het meest telt.
       De huistokens waren de eerste reparatie en bleken niet genoeg: op de drie
       juridische pagina's en op /site/404.html wordt rtg-themas.css helemaal
       niet geladen, dus vielen --rtg-soft en --rtg-txt terug op hun donkere
       basiswaarde boven een lichte grond. light-dark() hangt niet aan een
       stylesheet maar aan color-scheme, en die staat wel overal goed: dark voor
       elk thema (rtg-themas.css regel 15), light voor champagne, en licht als
       standaard op een pagina zonder thema -- wat die pagina's ook zijn.
       Gemeten: 6,51:1 licht en 8,97:1 donker. */
    '#rtg-cookie span{color:var(--rtg-cookie-zacht);}' +
    /* de twee klikbare woorden dragen alleen een onderlijn, geen vlak */
    '#rtg-cookie a,#rtg-cookie button{background:none;border:0;padding:0;margin:0;cursor:pointer;' +
      'font:inherit;color:var(--rtg-cookie-inkt);text-decoration:none;' +
      'border-bottom:1px solid rgba(244,240,233,0.28);}' +
    '#rtg-cookie a:hover,#rtg-cookie button:hover,' +
    '#rtg-cookie a:focus-visible,#rtg-cookie button:focus-visible{color:var(--gold-tekst,#C0A544);' +
      'border-bottom-color:var(--gold-tekst,#C0A544);}' +
    /* Work OS heeft een vaste onderbalk; de melding staat erboven en laat alle
       softwarebediening bereikbaar. */
    'body[data-rtg-schil="standaard"] #rtg-cookie{bottom:calc(66px + env(safe-area-inset-bottom,0px));}' +
    /* op een licht thema draait alleen de inkt om; de vorm blijft dezelfde */
    ':root[data-rtg-thema="champagne"] #rtg-cookie span{color:rgba(26,23,19,0.58);}' +
    ':root[data-rtg-thema="champagne"] #rtg-cookie a,' +
    ':root[data-rtg-thema="champagne"] #rtg-cookie button{color:rgba(26,23,19,0.86);' +
      'border-bottom-color:rgba(26,23,19,0.3);}' +
    /* de ruimte die de balk zelf inneemt, onder de inhoud gelegd */
    'body{padding-bottom:calc(var(--rtg-eigen-voet,0px) + var(--rtg-cookieruimte,0px) + var(--ws-ruimte,0px));}';
  document.head.appendChild(stijl);

  var el = document.createElement('div');
  el.id = 'rtg-cookie';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', en ? 'Cookie notice' : 'Cookiemelding');
  var p = document.createElement('span');
  p.textContent = T.txt;
  var a = document.createElement('a');
  a.href = '/apps/juridisch/privacy.html';
  a.textContent = T.privacy;
  var knop = document.createElement('button');
  knop.type = 'button';
  knop.textContent = T.ok;
  /* EEN VASTE BALK MOET ZIJN EIGEN RUIMTE RESERVEREN.

     Deze melding staat position:fixed onderaan en nam nergens ruimte in. Op
     elke pagina van het huis lag hij daarmee over de laatste regels heen:
     op foundation/vrienden.html stond "Functional storage only · Privacy ·
     Fine" dwars door de laatste zin van een verhaal, en op een telefoon is
     dat precies de plek waar de inhoud ophoudt. Niemand merkt dat, want de
     pagina scrollt gewoon door -- de onderste regels zijn alleen nooit
     helemaal te lezen.

     De hoogte staat niet vast (de tekst breekt op smalle schermen), dus hij
     wordt gemeten en als variabele op <html> gezet. Weg is weg: bij het
     wegklikken gaat de ruimte mee, anders staat er een lege strook onderaan
     die niemand meer kan verklaren. */
  var RUIMTE = '--rtg-cookieruimte';
  function meetRuimte() {
    if (!el.isConnected) return;
    var h = Math.ceil(el.getBoundingClientRect().height) + 12;
    document.documentElement.style.setProperty(RUIMTE, h + 'px');
  }
  function geefRuimteTerug() {
    document.documentElement.style.removeProperty(RUIMTE);
  }

  knop.addEventListener('click', function () {
    try { localStorage.setItem(SLEUTEL, new Date().toISOString()); } catch (e) {}
    el.remove();
    geefRuimteTerug();
  });
  el.appendChild(p); el.appendChild(a); el.appendChild(knop);
  /* DE GROND METEN IN PLAATS VAN HEM AAN TE NEMEN. Deze melding draagt
     background:none. Vier aannames sneuvelden: een vaste inkt (1,03:1 op licht),
     de huistokens (bestaan niet op /site/404.html en de juridische pagina's),
     light-dark() (er zijn pagina's met thema onyx EN een eigen lichte grond) en
     de opklim langs de ouders (die geeft de body, terwijl een fixed melding over
     iets anders hangt). Volgorde: het punt achter haarzelf, anders de opklim,
     anders de buurtekst -- lichte tekst = donkere grond, zoals
     shared/rahul-tab/inkt.js. Met een waarnemer erop, want de grond staat soms
     pas na haar vast. */
  function helderheid(rgb) {
    var k = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
  }
  /* De stapel achter de melding zelf; haarzelf en haar kinderen overslaan. */
  function stapelAchter() {
    if (!document.elementsFromPoint) return [];
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return [];
    var alles = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2) || [];
    return alles.filter(function (n) { return n !== el && !el.contains(n); });
  }
  /* Een vaste balk achter haar dekt zij niet af: dan gaat zij erboven staan. Dat
     was ook waarom haar grond niet klopte -- op salon lag er een lichte balk
     achter een bijna zwarte pagina. */
  function tilBovenBalk() {
    /* Klimmen, want het eerste element achter haar is meestal een KNOP in de
       balk en niet de balk zelf. */
    for (var n = stapelAchter()[0]; n && n.nodeType === 1; n = n.parentElement) {
      var b = n.getBoundingClientRect();
      if (getComputedStyle(n).position !== 'fixed') continue;
      if (b.bottom >= innerHeight - 2 && b.height > 24 && b.height < innerHeight / 2) {
        el.style.bottom = 'calc(' + Math.ceil(b.height) + 'px + max(0.6rem, env(safe-area-inset-bottom,0px)))';
        return;
      }
    }
  }
  function kiesInkt() {
    /* HET VLAK IS ALTIJD ONYX, EN DAT IS MET OPZET NIET GEMETEN. Zodra deze
       melding haar eigen dekkende vlak draagt, is de vraag "hoe donker is het
       eronder" niet meer relevant voor haar leesbaarheid -- alleen nog voor haar
       uiterlijk. En juist daar was de meting wisselvallig: op een lichte pagina
       koos zij soms toch de donkere stand, omdat wat er achter haar ligt per
       scherm en per moment verschilt. Een mededeling die de wet vraagt hoort er
       overal hetzelfde uit te zien, dus staat zij vast: een onyx strook met
       ivoren inkt, 8,97:1 en 16,16:1. Dat volgt ook het stark zwart/wit ritme uit
       CLAUDE.md, en het maakt deze melding onafhankelijk van elk thema.
       De meting hieronder blijft wel bestaan: zij bepaalt of de melding boven een
       vaste balk moet staan, en dat is een plaatsvraag en geen kleurvraag. */
    el.style.setProperty('--rtg-cookie-vlak', '#0C0C0B');
    el.style.setProperty('--rtg-cookie-lijn', '#2A2724');
    el.style.setProperty('--rtg-cookie-zacht', '#B4AFA6');
    el.style.setProperty('--rtg-cookie-inkt', '#EDE9E1');
  }
  var plaats = function () {
    document.body.appendChild(el);
    tilBovenBalk(); kiesInkt();
    meetRuimte();
    if (window.requestAnimationFrame) window.requestAnimationFrame(function () { tilBovenBalk(); kiesInkt(); meetRuimte(); });
    /* En hij blijft kijken: de grond komt soms van een script, na haar. */
    if (window.MutationObserver) {
      var kijker = new MutationObserver(kiesInkt);
      kijker.observe(document.documentElement, { attributes: true, attributeFilter: ['data-rtg-thema', 'class', 'style'] });
      kijker.observe(document.body, { attributes: true, attributeFilter: ['data-rtg-eigenvlak', 'data-rtg-vlak', 'class', 'style'] });
    }
    window.addEventListener('resize', meetRuimte);
  };
  if (document.body) plaats(); else document.addEventListener('DOMContentLoaded', plaats);
})();
