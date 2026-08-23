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
      'gap:0.5rem;flex-wrap:wrap;background:none;border:0;box-shadow:none;padding:0.3rem 0.6rem;' +
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
    '#rtg-cookie span{color:light-dark(#5C5952,#B4AFA6);}' +
    /* de twee klikbare woorden dragen alleen een onderlijn, geen vlak */
    '#rtg-cookie a,#rtg-cookie button{background:none;border:0;padding:0;margin:0;cursor:pointer;' +
      'font:inherit;color:light-dark(#3A3733,#EDE9E1);text-decoration:none;' +
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
  var plaats = function () {
    document.body.appendChild(el);
    meetRuimte();
    if (window.requestAnimationFrame) window.requestAnimationFrame(meetRuimte);
    window.addEventListener('resize', meetRuimte);
  };
  if (document.body) plaats(); else document.addEventListener('DOMContentLoaded', plaats);
})();
