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
  /* EERSTE VERSIE KEEK ALLEEN NAAR BREEDTE, en liet zes van de elf te brede
     schermen zonder aanwijzing achter: "411px" en verder niets. Dat komt doordat
     een element ook buiten beeld kan steken zonder zelf te breed te zijn -- iets
     op `left: 300px` met een breedte van 200 past prima en duwt de pagina toch
     open.

     Dus: wie steekt het verst RECHTS uit, en heeft zelf geen kind dat nog
     verder komt. Dat is de dwinger, en met die naam is een zakkende meting
     meteen bruikbaar in plaats van alleen waar. */
  var dwinger = null, verst = W + 2;
  var alles = document.querySelectorAll('body *');
  for (var i = 0; i < alles.length; i++) {
    var e = alles[i];
    if (!zichtbaar(e)) continue;
    var r = e.getBoundingClientRect();
    if (r.right <= W + 2) continue;
    var kindVerder = false, k = e.children;
    for (var j = 0; j < k.length; j++) if (k[j].getBoundingClientRect().right > r.right - 1) { kindVerder = true; break; }
    if (kindVerder) continue;
    if (r.right > verst) {
      verst = r.right;
      dwinger = merk(e) + ' (' + Math.round(r.width) + 'px breed, rechterrand op ' + Math.round(r.right) + ')';
    }
  }

  /* ---- 2. LEEG --------------------------------------------------------- */
  /* Een pagina die past kan nog steeds leeg zijn: Instant Reality verborg op
     telefoonmaat al zijn artikelen, en de breedtescan stond groen terwijl een
     mens een zwart vlak zag. Vandaar: staat er ergens werkelijk iets? */
  /* DRIE POGINGEN VERDER, EN ELKE VORIGE SNEUVELDE OP EEN ECHT SCHERM.

     1. Een lijst tags (main, section, .kaart, form, ...) -> 132 van de 514
        metingen leeg, want veel schermen bouwen hun inhoud in een div.
     2. De HOOGTE van het hoogste zichtbare element -> /apps/gast.html rood,
        terwijl dat de QR-landingspagina is die terecht een zin lang is.
     3. De tekst in <main> een laag diep -> 130 metingen leeg, en om drie
        verschillende redenen tegelijk: /apps/foundation/babyboek.html heeft
        helemaal geen <main>, /apps/camera.html heeft een <main> waarvan de
        kinderen nul hoog zijn terwijl de boodschap in een laag eronder staat,
        en de toegangspoort van de stichting is een overlay.

     Wat de vraag steeds al was: STAAT ER IETS LEESBAARS DAT GEEN SCHIL IS.
     Dus tellen we de tekst van alle zichtbare BLADEREN -- elementen zonder
     kinderen, zodat niets dubbel telt -- en laten we weg wat schil is:
     navigatie, koppen, voeten, en vaste balken.

     Een vaste balk telt niet mee, een vaste OVERLAY wel. Dat verschil is de
     hoogte: een balk is een strook, een poort bedekt het scherm. Zonder dat
     onderscheid zou "deze ruimte blijft nog dicht" -- een volwaardig antwoord
     aan een mens -- als leeg scherm gelden.

     EN DE DREMPEL LIGT LAAG, met opzet. Hij stond op veertig tekens en
     veroordeelde /apps/clips.html, dat netjes zegt "Dat was het voor nu -- de
     dagselectie is eindig; zo hoort het". Een goede lege staat IS kort. Wat
     deze meting hoort te vangen is NIETS, niet WEINIG: het scherm dat past,
     rendert en een mens een zwart vlak toont. Dat meet nul. */
  var SCHIL = 'nav,header,footer,aside,[role="navigation"],[role="banner"],[role="contentinfo"]';
  function isSchil(el) {
    if (el.closest && el.closest(SCHIL)) return true;
    for (var q = el; q && q !== document.body; q = q.parentElement) {
      var qs = getComputedStyle(q);
      if (qs.position !== 'fixed' && qs.position !== 'sticky') continue;
      /* een strook is schil, een poort is inhoud */
      if (q.getBoundingClientRect().height < H * 0.4) return true;
    }
    return false;
  }
  var tekst = '', beelden = 0;
  var bladeren = document.querySelectorAll('body *');
  for (var t = 0; t < bladeren.length; t++) {
    var bl = bladeren[t];
    if (bl.children.length) continue;          // alleen bladeren: geen dubbeltelling
    if (!zichtbaar(bl)) continue;
    if (isSchil(bl)) continue;
    var br = bl.getBoundingClientRect();
    if (br.bottom < 0 || br.top > H) continue; // buiten beeld telt niet mee
    if (/^(img|canvas|svg|video|picture)$/i.test(bl.tagName) ) {
      if (br.width * br.height >= 2000) beelden++;
      continue;
    }
    tekst += ' ' + (bl.textContent || '');
  }
  tekst = tekst.replace(/\s+/g, ' ').trim();
  var hoogste = tekst.length;

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
    /* HELEMAAL BUITEN BEELD IS GEEN GEBREK MAAR EEN BEDOELING. De eerste versie
       meldde 378 van de 514 metingen, en dat was op 189 schermen dezelfde knop:
       de SPRINGLINK op y -64..-33 (TOEGANKELIJK.md). Die hoort daar te staan tot
       iemand hem focust. Hetzelfde geldt voor een sticky die weggescrold is.

       Wat een echt gebrek is: een balk die WEL in beeld hoort en er half
       uitsteekt -- dan bestaat hij maar is hij niet te bereiken. Dus alleen
       elementen die het venster raken. */
    if (rr.bottom <= 0 || rr.top >= H) continue;
    if (rr.top >= -1 && rr.bottom <= H + 1) continue;   // netjes in beeld
    /* EEN GEPARKEERDE SHEET IS GEEN KAPOTTE BALK. /apps/navigatie.html houdt
       zijn routepaneel op translateY(102%) tot je het opent; daarvan steekt elf
       pixel het venster in, en dat is bedoeld en niet stuk. Hetzelfde geldt voor
       elke lade die net onder de rand wacht.

       Wat wel een gebrek is: een balk die zich grotendeels TOONT en er dan
       uitloopt -- dan denkt een mens dat hij hem kan gebruiken en kan hij er de
       helft niet van raken. Dus: minstens 24 pixels en een kwart van zijn eigen
       hoogte moet in beeld staan voordat dit meetelt. */
    var binnen = Math.min(rr.bottom, H) - Math.max(rr.top, 0);
    if (binnen < 24 || binnen < rr.height * 0.25) continue;
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
    ['button.hoofd, a.hoofd, [role="button"].hoofd', 'eigen merk (.hoofd op een knop)']
    /* HIER STOND EEN DERDE: "de enige zichtbare verzendknop". Die leek redelijk
       en raadde toch. Op /apps/app.html koos hij de verzendknop van het
       Rahul-veld (24x24) als hoofdhandeling van het BEGINSCHERM -- terwijl de
       handeling daar is: kies een wereld, en dat zijn er vier. Een scherm dat
       geen een handeling heeft die eruit springt, hoort dat te melden en niet
       een willekeurige knop tot norm verheven te krijgen.

       Sindsdien geldt alleen wat het scherm ZELF aanwijst (GRAMMATICA.md). */
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
    hoofd = gezien[0]; hoe = zoek[z][1];
  }

  var uit = {
    venster: W, hoogte: H, inhoud: inhoud, dwinger: inhoud > W + 2 ? dwinger : null,
    tekens: tekst.length, beelden: beelden, hoogsteBlok: Math.round(hoogste), balkenBuiten: balkenBuiten,
    leeg: tekst.length < 5 && beelden === 0,
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
