/* De themakiezer: EEN systeem, vier standen, op de materialen.

   Hier stonden er twee. shared/thema.js kende donker/licht en werd door een
   pagina geladen; shared/rosthema.js kende parelmoer/standaard/bordeaux en werd
   door twintig pagina's geladen -- en ze schreven in DEZELFDE sleutel
   (rtg_thema) met een ander vocabulaire. Wie in het paneel "Champagne" koos,
   zag op het beginscherm "donker". Twee plekken die een waarheid vasthouden
   (LAT.md regel 4), uit elkaar gelopen.

   Deze laag gebruikt een eigen sleutel en laat de oude twee met rust, zodat een
   pagina die nog niet om is niets merkt. Migreren gebeurt pagina voor pagina;
   zolang dat loopt is er geen moment waarop beide half werken. */
(function (w, d) {
  'use strict';
  var KEY = 'rtg_thema_v2';
  var THEMAS = [
    { id: 'champagne', naam: 'Champagne', materiaal: 'parelmoer', kleur: '#F4F0E9' },
    { id: 'onyx', naam: 'Onyx', materiaal: 'pianolak', kleur: '#0C0C0B' },
    { id: 'bordeaux', naam: 'Bordeaux', materiaal: 'fluweel', kleur: '#4A0C1E' },
    { id: 'royal', naam: 'Royal', materiaal: 'satijn', kleur: '#101E3F' }
  ];
  function geldig(t) { for (var i = 0; i < THEMAS.length; i++) if (THEMAS[i].id === t) return t; return null; }
  function huidig() { try { return geldig(localStorage.getItem(KEY)) || 'onyx'; } catch (e) { return 'onyx'; } }
  /* WELKE KLEUR RAAKT DE SYSTEEMBALK ECHT?

     Hier stond `meta.setAttribute('content', th.kleur)`: de meta kreeg de kleur
     uit de THEMAS-lijst hierboven. Dat is maar een van de twee kleursystemen van
     dit huis. Het tweede is de WERELD-skin (rtg-heritage.css), en die schildert
     op sommige schermen een heel andere grond -- LivingOS is in heritage met
     opzet de lichte kamer (--rtg-world-bg:#f4f0e8) terwijl het thema onyx
     (#0C0C0B) is. De meta beloofde dan zwart terwijl de bovenrand creme was:
     gemeten op 39 ledenschermen, met een verschil tot 17,4:1. iOS Safari en
     Android Chrome tinten de balk rond de pagina met deze waarde, dus het lid
     kreeg een zwarte balk strak tegen een creme pagina -- geen overgang maar een
     snijlijn.

     De meta leest daarom niet langer een lijst maar de GROND die de bovenrand
     werkelijk draagt, in de volgorde waarin die grond ontstaat:

       1. de Edge-schil, als die er is: zijn balken vullen de veilige zone en
          hun grond komt uit --edge-bg;
       2. anders de wereld-skin op de body (--rtg-world-bg);
       3. anders het thema zelf, zoals voorheen.

     Wat er NIET gebeurt: raden. Levert een van die twee tokens iets op dat geen
     kleur is (een verloop, een lege waarde), dan valt hij door naar de volgende.
     CSS.supports is de toets; een meta met een ongeldige waarde wordt door de
     browser stil genegeerd en dan staat er weer iets anders dan er lijkt. */
  function kleurig(v) {
    if (!v) return false;
    try { return w.CSS && w.CSS.supports ? w.CSS.supports('color', v) : /^#|^rgb|^hsl/.test(v); }
    catch (e) { return false; }
  }
  /* NIET DE TOKEN, MAAR DE VERF. Deze functie las eerst --edge-bg. Dat leek
     logisch en was fout: op /apps/app.html gaf die token #090809 terwijl de balk
     aantoonbaar #F4F0E8 schilderde -- de grond van .rtg-edge-top wordt daar door
     een andere regel gezet dan door de color-mix() op die token. Wie een token
     leest, leest een BEDOELING; de browser weet wat er werkelijk staat.
     getComputedStyle().backgroundColor is de enige bron die niet kan liegen.

     De doorzichtigheid gaat eraf: die balk staat op 94% en een theme-color met
     doorzichtigheid betekent niets -- de systeembalk heeft niets om doorheen te
     kijken. De kleur zelf is wat het oog ziet. */
  function ontleed(v) {
    v = String(v || '').trim();
    var m = v.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if (m) return [Math.round(m[1] * 255), Math.round(m[2] * 255), Math.round(m[3] * 255)];
    m = v.match(/rgba?\(([^)]+)\)/);
    if (m) {
      var p = m[1].split(/[,\s\/]+/).filter(Boolean).map(Number);
      if (p.length >= 3 && p.slice(0, 3).every(function (x) { return isFinite(x); })) return p.slice(0, 3);
    }
    return null;
  }
  function geschilderd(el) {
    if (!el) return null;
    var rgb = ontleed(getComputedStyle(el).backgroundColor);
    if (!rgb) return null;
    return 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
  }
  function bovenrand(th) {
    /* 1. de Edge-balk vult de veilige zone; wat HIJ schildert is de bovenrand */
    var uit = geschilderd(d.querySelector('.rtg-edge-top'));
    if (uit) return uit;
    /* 2. anders de wereld-skin op de body, als token (die schildert de body) */
    if (d.body) {
      var wbg = String(getComputedStyle(d.body).getPropertyValue('--rtg-world-bg') || '').trim();
      if (kleurig(wbg)) return wbg;
      var bg = geschilderd(d.body);
      if (bg) return bg;
    }
    /* 3. anders het thema zelf, zoals voorheen */
    return th.kleur;
  }
  function pas(t) {
    var th = THEMAS.filter(function (x) { return x.id === t; })[0] || THEMAS[1];
    d.documentElement.setAttribute('data-rtg-thema', th.id);
    var meta = d.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', bovenrand(th));
    /* De levende kleur opnieuw laten rekenen: hij ademt door over elk thema
       heen, alleen met een andere sterkte (zie --rtg-dagsterkte). */
    if (w.RTGLevend && w.RTGLevend.familie) { try { w.RTGLevend.familie(); } catch (e) {} }
  }
  function zet(t) { try { localStorage.setItem(KEY, geldig(t) || 'onyx'); } catch (e) {} pas(geldig(t) || 'onyx'); }
  pas(huidig());
  /* EN OPNIEUW ZODRA DIE GROND BESTAAT. Deze module draait vroeg; de Edge-schil
     en de wereld-skin worden erna door ander script op de body gezet. Een meta
     die alleen bij het laden is gerekend, staat dan alsnog op de verkeerde
     kleur. Vandaar dezelfde vorm als shared/cookie.js: kijken naar de
     attributen die de grond bepalen, en niets doen zolang er niets verandert. */
  /* GEEN LUS. Twee dingen die er bijna in kwamen en die hier hard staan:
     `data-rtg-thema` en `style` horen NIET in de filter hieronder. pas() zet
     zelf `data-rtg-thema` op de wortel, dus die eerste maakt van de waarnemer
     een oneindige lus; en de ademende dagkleur (shared/seizoen.js) herschrijft
     `style` op elke getekende milliseconde, dus die tweede laat hem op elk
     frame hertellen. Allebei geprobeerd, allebei liep de meting vast. De vlag
     hieronder is het tweede slot: pas() kan tijdens een hertelling geen tweede
     hertelling uitlokken, wat er verder ook aan attributen verschuift. */
  var bezig = false;
  function hertel() {
    if (bezig) return;
    bezig = true;
    try { pas(huidig()); } finally { bezig = false; }
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', hertel);
  else hertel();
  /* DE WAARNEMER KIJKT NAAR DE HELE BOOM EN NIET ALLEEN NAAR DE BODY.
     Gemeten op /apps/app.html: op t=1918ms bestaat de Edge-balk en is hij donker
     (--edge-bg #090809); op t=3434ms rolt Edge 2 uit en wordt hij creme
     (#f4f0e8). Een waarnemer die alleen de body-attributen volgde, miste die
     tweede stap -- de meta bleef op rgb(9,8,9) staan terwijl de balk creme was.
     Dat de functie klopte en alleen het sein ontbrak, is apart nagegaan:
     bovenrand() gaf op dat moment rgb(244,240,232), en een handmatige mutatie op
     de body zette de meta meteen goed.

     Vandaar `subtree` -- de schil verandert zijn eigen attributen, niet die van
     de body. De filter blijft dezelfde korte lijst, dus dit kost een handvol
     hertellingen per pagina en geen waarneming per toetsaanslag. En window.load
     erbij als vangnet, want een schil die na alles nog een keer verft, verandert
     misschien helemaal geen attribuut. */
  try {
    var kijker = new MutationObserver(hertel);
    var start = function () {
      if (!d.documentElement) return;
      kijker.observe(d.documentElement, { attributes: true, subtree: true,
        attributeFilter: ['data-rtg-world', 'data-rtg-skin', 'data-rtg-edge-ready',
          'data-rtg-edge-2', 'data-rtg-edge-2-rendered', 'data-rtg-edge-2-state',
          'data-rtg-eigenvlak'] });
    };
    start();
  } catch (e) { /* zonder waarnemer blijft de meting van het laadmoment staan */ }
  w.addEventListener('load', function () { hertel(); requestAnimationFrame(hertel); });
  w.RTGThemas = { themas: THEMAS, huidig: huidig, zet: zet, bovenrand: bovenrand };
})(window, document);
