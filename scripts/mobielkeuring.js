'use strict';
/* DE MOBIELE RONDE: past dit scherm op een telefoon, en is het met één duim te
   bedienen?

   TWEE VRAGEN DIE HET HUIS NIET STELDE. De raakvlakronde ernaast
   (./raakvlakkeuring.js) meet of een knop van 24x24 te RAKEN is met een hand die
   trilt. Dat is de ondergrens van WCAG 2.5.8 en die staat op nul. Maar
   GRAMMATICA.md belooft iets anders en sterkers: "ik wil iets doen -> mijn duim
   vindt het onderaan". Daar hoort 44 pixels bij en een plek binnen bereik, en
   dat werd nergens gemeten. En de breedte -- loopt het scherm rechts buiten
   beeld? -- werd gemeten voor elf schermen uit de catalogus, van de 257.

   DRIE REGELS, EN ELK IS UIT TE LEGGEN.

     MAAT     de hoofdhandeling meet minstens 44x44. Niet 24: dat is de maat
              voor "raakbaar", niet voor "met een duim, terwijl je loopt".
     HOOG     zijn middelpunt ligt in de onderste 60% van het venster, of hij
              staat in een vaste balk onderaan. Boven die lijn moet een mens
              zijn telefoon in de hand verschuiven, en dat is precies het moment
              waarop mensen hem laten vallen.
     ZIJKANT  is de knop smal (minder dan 60% van de vensterbreedte), dan mag
              zijn middelpunt niet in het kwart aan de ANKERZIJDE liggen -- de
              kant waar de duim niet komt. Welke kant dat is hangt van de hand
              af (shared/hand.js), dus deze ronde draait twee keer.

   WAT DEZE RONDE BEWUST NIET DOET. Hij verzint geen duimboog met een straal in
   millimeters. Zo'n formule ziet er precies uit en is het niet: hij hangt af van
   handgrootte, toestelgrootte en hoe iemand vasthoudt, en niets daarvan weet dit
   huis. De drie regels hierboven zijn grof en verdedigbaar; een precieze boog
   zou een getal geven waar niemand op kan sturen.

   EN EEN SCHERM ZONDER AANGEWEZEN HOOFDHANDELING IS GEEN FOUT. Een lijst, een
   overzicht, een dagbriefing: daar is niet één ding het belangrijkst. Die
   schermen komen in een eigen categorie en niet op de foutenlijst -- anders
   wordt "wijs maar iets aan" de reparatie, en dat maakt geen enkel scherm beter.

   Levert BRON (de meting, als tekst voor evaluate) plus de drempels. Dezelfde
   vorm als ./raakvlakkeuring.js, zodat scripts/a11y.js ze allebei op dezelfde
   manier inhangt. */

const MAAT = 44;      // CSS-pixels: duimmaat voor de hoofdhandeling
const ONDER = 0.40;   // het middelpunt ligt onder deze fractie van de hoogte
const SMAL = 0.60;    // knoppen smaller dan dit deel van het venster tellen als smal
const ANKERKWART = 0.25; // het kwart aan de ankerzijde waar de duim niet komt

/* De browserkant. Wordt als tekst uitgevoerd (evaluate), dus geen require en
   geen closure over iets van hierbuiten: alles komt als argument mee. */
function mobielInPagina(opt) {
  var MAAT = opt.maat, ONDER = opt.onder, SMAL = opt.smal, KWART = opt.kwart;
  var links = opt.hand === 'links';
  var W = document.documentElement.clientWidth;
  var H = window.innerHeight;

  function zichtbaar(el) {
    if (!el || el.hidden) return false;
    var s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    if (el.closest && el.closest('[aria-hidden="true"]')) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function naam(el) {
    var t = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ');
    return t.slice(0, 60) || el.tagName.toLowerCase();
  }
  function merk(el) {
    return el.tagName.toLowerCase()
      + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : '')
      + (el.id ? '#' + el.id : '');
  }

  /* ---- 1. BREEDTE ------------------------------------------------------ */
  var inhoud = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
  /* De DWINGER: het breedste element dat zelf geen te breed kind heeft. Dat is
     wie de pagina openduwt, en die naam maakt een zakkende meting meteen
     bruikbaar in plaats van alleen waar. */
  var dwinger = null;
  var alles = document.querySelectorAll('body *');
  for (var i = 0; i < alles.length; i++) {
    var e = alles[i], r = e.getBoundingClientRect();
    if (r.width <= W + 2) continue;
    var teBreedKind = false, k = e.children;
    for (var j = 0; j < k.length; j++) if (k[j].getBoundingClientRect().width > W + 2) { teBreedKind = true; break; }
    if (teBreedKind) continue;
    dwinger = merk(e) + ' (' + Math.round(r.width) + 'px)';
    break;
  }

  /* ---- 2. LEEG --------------------------------------------------------- */
  /* Een pagina die past kan nog steeds leeg zijn: Instant Reality verborg op
     telefoonmaat al zijn artikelen, en de breedtescan stond groen terwijl een
     mens een zwart vlak zag. Vandaar: staat er ergens werkelijk iets? */
  var hoogste = 0;
  var blokken = document.querySelectorAll('body main, body section, body article, body .kaart, body form, body table, body ul');
  for (var b = 0; b < blokken.length; b++) {
    if (!zichtbaar(blokken[b])) continue;
    var hb = blokken[b].getBoundingClientRect().height;
    if (hb > hoogste) hoogste = hb;
  }

  /* ---- 3. VASTE BALKEN BLIJVEN IN BEELD -------------------------------- */
  var balkenBuiten = [];
  var kandidaten = document.querySelectorAll('body *');
  for (var v = 0; v < kandidaten.length; v++) {
    var el = kandidaten[v];
    if (!zichtbaar(el)) continue;
    var st = getComputedStyle(el);
    if (st.position !== 'fixed' && st.position !== 'sticky') continue;
    var rr = el.getBoundingClientRect();
    if (rr.height < 24 || rr.height > H) continue;      // geen overlay over het hele scherm
    if (rr.top >= -1 && rr.bottom <= H + 1) continue;   // netjes in beeld
    balkenBuiten.push(merk(el) + ' y ' + Math.round(rr.top) + '..' + Math.round(rr.bottom) + ' bij ' + H);
    if (balkenBuiten.length >= 5) break;
  }

  /* ---- 4. DE HOOFDHANDELING ------------------------------------------- */
  /* De volgorde IS de definitie, en hij loopt van "het scherm wijst het zelf
     aan" naar "het scherm laat het aan ons over". Wat er onderaan uit komt is
     geen gok: bij niets gevonden zeggen we dat, en dat is de bevinding. */
  var hoofd = null, hoe = '';
  var zoek = [
    ['[data-hoofdactie]', 'aangewezen (data-hoofdactie)'],
    /* `.hoofd` ALLEEN op iets wat je werkelijk aanraakt. Die klasse is in dit
       huis overladen: op /apps/geld-command.html draagt een KAART van 350x236
       met "96% match" hem, en die als hoofdhandeling meten levert een getal op
       dat nergens over gaat. Een knop, een link of iets met role=button is
       ondubbelzinnig; een div niet. */
    ['button.hoofd, a.hoofd, [role="button"].hoofd', 'eigen merk (.hoofd op een knop)'],
    ['button[type="submit"], input[type="submit"]', 'verzendknop']
  ];
  for (var z = 0; z < zoek.length && !hoofd; z++) {
    var lijst = document.querySelectorAll(zoek[z][0]);
    var gezien = [];
    for (var q = 0; q < lijst.length; q++) if (zichtbaar(lijst[q])) gezien.push(lijst[q]);
    /* MEER DAN EEN VERZENDKNOP IS GEEN AANWIJZING MAAR EEN GOK. Een scherm met
       drie formulieren heeft geen hoofdhandeling die uit de opmaak volgt; daar
       de eerste van pakken zou een willekeurige knop tot norm verheffen. Voor
       een EXPLICIET merk geldt dat niet: wie er twee aanwijst, wijst aan. */
    if (!gezien.length) continue;
    if (z === 2 && gezien.length > 1) { hoe = 'meerdere verzendknoppen, geen aanwijzing'; break; }
    hoofd = gezien[0]; hoe = zoek[z][1];
  }

  var uit = {
    venster: W, hoogte: H, inhoud: inhoud, dwinger: dwinger,
    hoogsteBlok: Math.round(hoogste), balkenBuiten: balkenBuiten,
    hoofd: null, hoe: hoe || 'geen', gebreken: []
  };

  if (!hoofd) return uit;

  var hr = hoofd.getBoundingClientRect();
  var st2 = getComputedStyle(hoofd);
  var inVasteBalk = false;
  for (var p = hoofd; p && p !== document.body; p = p.parentElement) {
    var ps = getComputedStyle(p);
    if (ps.position === 'fixed' || ps.position === 'sticky') {
      if (p.getBoundingClientRect().bottom > H * 0.75) { inVasteBalk = true; break; }
    }
  }
  var midX = hr.left + hr.width / 2, midY = hr.top + hr.height / 2;
  uit.hoofd = {
    merk: merk(hoofd), naam: naam(hoofd),
    breed: Math.round(hr.width), hoog: Math.round(hr.height),
    x: Math.round(midX), y: Math.round(midY), inVasteBalk: inVasteBalk,
    positie: st2.position
  };

  if (hr.width < MAAT || hr.height < MAAT) {
    uit.gebreken.push('maat ' + Math.round(hr.width) + 'x' + Math.round(hr.height) + ', hoort ' + MAAT);
  }
  if (!inVasteBalk && midY < H * ONDER) {
    uit.gebreken.push('staat op y ' + Math.round(midY) + ' van ' + H + ', boven de duimlijn');
  }
  if (hr.width < W * SMAL) {
    /* De ankerzijde is de kant waar de duim NIET komt: rechts voor een
       linkshandige, links voor een rechtshandige. */
    var inAnkerkwart = links ? (midX > W * (1 - KWART)) : (midX < W * KWART);
    if (inAnkerkwart) {
      uit.gebreken.push('smalle knop op x ' + Math.round(midX) + ' van ' + W + ', in het kwart aan de ankerzijde');
    }
  }
  return uit;
}

const BRON = 'window.__mobielKeur = ' + mobielInPagina.toString() + ';';

module.exports = { BRON, MAAT, ONDER, SMAL, ANKERKWART };
