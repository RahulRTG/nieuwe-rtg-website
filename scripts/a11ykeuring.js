/* Eigen toegankelijkheids-keuring, i.p.v. axe-core. Draait in de browser (via
   Playwright, in scripts/a11y.js) op de vlaggenschip-pagina's.

   Bewust een NAUWE deelverzameling, en bewust conservatief: we falen alleen op
   ONDUBBELZINNIGE structurele fouten -- een afbeelding zonder alt, een veld
   zonder enig label, een knop/link zonder toegankelijke naam, geen lang op
   <html>, een lege <title> -- precies de dingen die axe ook als serious/critical
   markeert. Omdat we alleen aanslaan als er GEEN enkele naamgevings-/label-manier
   is, blijven de (al schone) pagina's stil: we onder-melden liever dan vals
   alarm. Kleurcontrast telt sinds de contrastronde OOK fataal: de heuristiek meet
   alleen tekst met een dekkende voorgrondkleur op een oplosbare, SOLIDE
   achtergrond, en juist de twijfelgevallen (lagen, gradients) slaat hij al niet
   aan. Wat overblijft is geen meetverschil met axe maar een leesbaarheidsfout.
   Zie velt() onderaan; het oordeel staat daar apart zodat het te toetsen is.

   De browsercode wordt als BRON-string geïnjecteerd; de pure helpers zijn apart
   exporteerbaar zodat test/a11ykeuring.test.js ze in Node kan toetsen. */
'use strict';

/* ---------- pure helpers (ook in Node testbaar) ---------- */
/* TWEE SCHRIJFWIJZEN, EN DE TWEEDE KOSTTE EEN HALVE MEETRONDE.

   getComputedStyle geeft kleuren normaal terug als `rgb()` of `rgba()`. Maar
   zodra er een `color-mix(in srgb, ...)` in het spel is -- en dit huis gebruikt
   die veel -- serialiseert Chrome hem als `color(srgb 0.90 0.78 0.29 / 0.16)`.
   Die vorm werd hier niet herkend, en dat was erger dan hem niet ondersteunen:
   een verloop met zulke stops leverde een HALVE stoplijst op, en daarmee een
   grond die nergens op sloeg. Gemeten gevolg: 104 koppen die als
   licht-op-licht werden gemeld terwijl ze gewoon leesbaar zijn.

   Een meter mag iets niet kunnen. Hij mag het niet half kunnen. */
function kleur(s) {
  if (!s) return null;
  const t = String(s);
  const m = t.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const d = m[1].split(',').map(x => parseFloat(x.trim()));
    if (d.length < 3 || d.some((n, i) => i < 3 && isNaN(n))) return null;
    return [d[0], d[1], d[2], d.length >= 4 ? d[3] : 1];
  }
  /* color(srgb r g b / a): kanalen lopen van 0 tot 1. Alleen srgb -- een andere
     ruimte omrekenen is een eigen wetenschap en hoort niet stilzwijgend te
     gebeuren. */
  const c = t.match(/color\(\s*srgb\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*(?:\/\s*([0-9.]+%?))?\s*\)/i);
  if (c) {
    const a = c[4] == null ? 1 : (String(c[4]).endsWith('%') ? parseFloat(c[4]) / 100 : parseFloat(c[4]));
    return [Math.round(c[1] * 255), Math.round(c[2] * 255), Math.round(c[3] * 255), isNaN(a) ? 1 : a];
  }
  return null;
}
function luminantie(rgb) {
  const a = rgb.slice(0, 3).map(v => {
    v = v / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function ratio(fg, bg) {
  const l1 = luminantie(fg), l2 = luminantie(bg);
  const licht = Math.max(l1, l2), donker = Math.min(l1, l2);
  return (licht + 0.05) / (donker + 0.05);
}
function grootTekst(px, gewicht) {
  return px >= 24 || (px >= 18.66 && Number(gewicht) >= 700);
}
// Toegankelijke naam (conservatief): niet-lege string als ER EEN naam is.
function naam(el) {
  if (!el || !el.getAttribute) return '';
  const al = (el.getAttribute('aria-label') || '').trim(); if (al) return al;
  const lb = el.getAttribute('aria-labelledby');
  if (lb && typeof document !== 'undefined') {
    let t = '';
    lb.split(/\s+/).forEach(id => { const r = document.getElementById(id); if (r) t += ' ' + (r.textContent || ''); });
    if (t.trim()) return t.trim();
  }
  const txt = (el.textContent || '').trim(); if (txt) return txt;
  const title = (el.getAttribute('title') || '').trim(); if (title) return title;
  if (el.querySelector) {
    const img = el.querySelector('img[alt]'); if (img && (img.getAttribute('alt') || '').trim()) return img.getAttribute('alt').trim();
    if (el.querySelector('svg [aria-label], svg title, [aria-label]')) return 'grafisch';
  }
  if (el.value != null && String(el.value).trim()) return String(el.value).trim();
  return '';
}
function mistAlt(img) {
  const rol = (img.getAttribute('role') || '');
  if (rol === 'presentation' || rol === 'none') return false;
  if (img.getAttribute('aria-hidden') === 'true') return false;
  return !img.hasAttribute('alt');
}
function mistNaam(el) {
  if (el.getAttribute('aria-hidden') === 'true') return false;
  return !naam(el);
}
function mistLabel(veld) {
  const tag = veld.tagName;
  const type = (veld.getAttribute('type') || '').toLowerCase();
  if (tag === 'INPUT' && ['hidden', 'submit', 'button', 'reset', 'image'].indexOf(type) >= 0) return false;
  if (veld.getAttribute('aria-hidden') === 'true') return false;
  if ((veld.getAttribute('aria-label') || '').trim()) return false;
  if (veld.getAttribute('aria-labelledby')) return false;
  if ((veld.getAttribute('title') || '').trim()) return false;
  // placeholder telt mee voor de toegankelijke naam (accname-algoritme), net als bij axe:
  // een veld met alleen een placeholder is geen serious/critical label-overtreding.
  if ((veld.getAttribute('placeholder') || '').trim()) return false;
  // .labels dekt zowel <label for=id> als een omhullende <label> -- geen selector-
  // string met de (onbekende) id nodig, dus ook geen escaping-valkuil.
  if (veld.labels && veld.labels.length) return false;
  if (veld.closest && veld.closest('label')) return false;
  return true;
}

/* ---------- browser-only helpers ---------- */
function zichtbaar(el) {
  const s = getComputedStyle(el);
  if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false;
  if (parseFloat(s.opacity) === 0) return false;
  if (!el.getClientRects().length) return false;
  let p = el;
  while (p) { if (p.getAttribute && p.getAttribute('aria-hidden') === 'true') return false; p = p.parentElement; }
  return true;
}
/* ---------- de grond onder de tekst ----------

   HIER STOND EEN POORT DIE 38% VAN DE TEKST MAT, en dat wist niemand.

   De vorige versie gaf op zodra er ergens in de keten een verloop stond:
   "gradient: niet te berekenen -> overslaan". Dat was voorzichtig en het klonk
   verstandig. Gemeten over alle 258 schermen in twee thema's: 1884
   tekstelementen werden gewogen en 3042 werden overgeslagen -- alle 3042 om
   diezelfde reden. En de oorzaak was er maar EEN: de themalaag geeft `body` een
   verloop (--onyx-glans en broers), dus vrijwel elke tekst op elk scherm viel
   erbuiten. "Contrast: 0 van 259" ging daarmee over een minderheid van de
   tekst, en niemand die dat getal las kon dat weten.

   Wat er nu staat REKENT DE GROND UIT in plaats van op te geven:

   1. LAGEN. Van het element omhoog, per element eerst de achtergrondkleur en
      daarboven de achtergrondafbeelding (dat is de schildervolgorde). Zodra een
      laag dekt, is alles eronder onzichtbaar en stopt het.
   2. VERLOPEN worden hun kleurstops. Een verloop is geen kleur maar een reeks,
      dus levert het meer dan een kandidaat.
   3. DOORZICHTIGE LAGEN worden over elkaar gemengd, met dezelfde som die de
      browser gebruikt.
   4. HET OORDEEL VALT OP DE ONGUNSTIGSTE. Tekst over een verloop staat op elke
      toon ervan; hij hoort dus overal leesbaar te zijn, niet gemiddeld.

   WAT ER NOG STEEDS WORDT OVERGESLAGEN, en dat blijft eerlijk: een `url()` als
   achtergrond (een foto -- daar valt niets van te rekenen zonder de pixels), en
   een keten die tot de wortel doorzichtig blijft. Die twee geven null, precies
   zoals vroeger. Alleen zijn het er nu een handvol in plaats van drieduizend.

   NAGEREKEND OP 20 AUGUSTUS 2026, want "een handvol" was een schatting en die
   hoort hier niet te staan. Over alle schermen in drie thema's, 5977
   tekstelementen: de `url()`-grond is 663 keer de reden (11,1%) en de keten die
   tot de wortel doorzichtig blijft NUL keer -- die reden stond dus jarenlang op
   papier zonder ooit te zijn voorgekomen. De echte blinde vlek zat aan de
   andere kant, bij de VOORGROND, en staat nu bij keurInPagina() uitgeschreven. */

function mengOver(voor, achter) {
  const a = voor[3] == null ? 1 : voor[3];
  if (a >= 1) return [voor[0], voor[1], voor[2]];
  return [0, 1, 2].map(i => Math.round(a * voor[i] + (1 - a) * achter[i]));
}
/* EEN ACHTERGRONDAFBEELDING KAN MEER DAN EEN LAAG ZIJN, en die staan op elkaar.
   `background-image` mag een rij zijn, gescheiden door komma's BUITEN de
   haakjes, en de eerste ligt bovenop. Dat onderscheid is geen muggenzifterij:
   de eerste versie hiervan gooide alle kleurstops van alle lagen op een hoop, en
   meldde daardoor de hero van bestellen.html als wit-op-bijna-wit. Die hero is
   een lichte glans OVER een dekkend bordeauxverloop; de glans dekt niets, het
   verloop eronder dekt alles, en samengeklonterd zag het er onleesbaar uit
   terwijl er niets mis was. Een meter die vals alarm slaat is erger dan geen
   meter -- dan leert iedereen hem negeren. */
function laagStukken(bi) {
  const uit = []; let diep = 0, start = 0;
  for (let i = 0; i < bi.length; i++) {
    const c = bi[i];
    if (c === '(') diep++;
    else if (c === ')') diep--;
    else if (c === ',' && diep === 0) { uit.push(bi.slice(start, i)); start = i + 1; }
  }
  uit.push(bi.slice(start));
  return uit.map(x => x.trim()).filter(Boolean);
}
function verloopStops(laag) {
  if (!laag || laag === 'none') return null;
  if (!/gradient\(/.test(laag)) return null;          // url(): niet te berekenen
  /* Een kleurruimte die deze lezer niet kent, maakt de hele laag onmeetbaar.
     Half lezen levert een grond op die nergens op slaat -- zie de kop bij
     kleur(). Liever niets weten dan iets verzinnen. */
  if (/\b(hsla?|hwb|lab|lch|oklab|oklch)\s*\(/i.test(laag)) return null;
  if (/color\(\s*(?!srgb\b)/i.test(laag)) return null;
  const m = laag.match(/rgba?\([^)]+\)|color\([^)]+\)|\btransparent\b/gi) || [];
  /* `transparent` blijft buiten kleur(): die functie weigert met opzet alles wat
     geen rgb is (zie test/a11ykeuring.test.js), en die afspraak is meer waard
     dan dit ene gemak. Hier is het gewoon zwart met alfa nul. */
  const k = m.map((x) => (/^transparent$/i.test(x) ? [0, 0, 0, 0] : kleur(x))).filter(Boolean);
  if (k.length !== m.length) return null;             // een stop die niet te lezen was
  return k.length ? k : null;
}
const dektHelemaal = (stops) => stops.every(k => (k[3] == null ? 1 : k[3]) >= 1);
/* Alleen de uitersten. Wat tussen de lichtste en de donkerste toon ligt kan
   nooit ongunstiger zijn dan een van die twee, dus meer kandidaten dragen niets
   bij -- en houden de combinaties klein als er lagen op elkaar staan. */
function uitersten(kleuren) {
  if (!kleuren || kleuren.length <= 1) return kleuren || [];
  let licht = kleuren[0], donker = kleuren[0];
  for (const k of kleuren) {
    if (luminantie(k) > luminantie(licht)) licht = k;
    if (luminantie(k) < luminantie(donker)) donker = k;
  }
  return licht === donker ? [licht] : [licht, donker];
}
/* EEN ::after DIE HET HELE VLAK BEDEKT, IS EEN LAAG. Een voorouderwandeling
   ziet alleen elementen, en dit huis legt zijn waas graag in een pseudo-element:
   `.hero:after{position:absolute;inset:0;background:linear-gradient(...)}` met de
   tekst op z-index 1 erboven. De keuring meldde die hero daardoor als wit op
   licht oranje, terwijl er een donkere waas tussen zit die hem gewoon leesbaar
   maakt. Dat kostte een onnodige verdonkering van dat scherm voordat ik het
   doorhad -- een vals alarm laat je iets repareren dat niet stuk is.

   Alleen een pseudo die het vlak ECHT bedekt telt mee: absoluut gepositioneerd
   met alle vier de zijden op nul. Een waas die maar een hoek raakt, laat de rest
   van de tekst op de oude grond staan, en dan is de oude grond de eerlijke. */
function pseudoLagen(el, welke) {
  const s = getComputedStyle(el, welke);
  if (!s || !s.content || s.content === 'none') return null;
  if (s.position !== 'absolute' && s.position !== 'fixed') return null;
  if (['top', 'right', 'bottom', 'left'].some((k) => parseFloat(s[k]) !== 0)) return null;
  const uit = [];
  const bi = s.backgroundImage;
  if (bi && bi !== 'none') {
    for (const laag of laagStukken(bi)) {
      const st = verloopStops(laag);
      if (!st) return null;
      uit.push({ kandidaten: uitersten(st), dekt: dektHelemaal(st) });
      if (dektHelemaal(st)) return uit;
    }
  }
  const c = kleur(s.backgroundColor);
  if (c && c[3] > 0) uit.push({ kandidaten: [c], dekt: c[3] >= 1 });
  return uit.length ? uit : null;
}
function gronden(el) {
  const lagen = [];                  // van boven (het element) naar beneden
  let p = el, dekt = false;
  while (p && p.nodeType === 1) {
    const s = getComputedStyle(p);
    /* de pseudo's van dit element liggen BOVEN zijn eigen achtergrond */
    if (p !== el) {
      for (const welke of ['::after', '::before']) {
        const pl = pseudoLagen(p, welke);
        if (pl) for (const l of pl) { lagen.push(l.kandidaten); if (l.dekt) { dekt = true; break; } }
        if (dekt) break;
      }
      if (dekt) break;
    }
    const bi = s.backgroundImage;
    if (bi && bi !== 'none') {
      /* Van boven naar beneden door de lagen van dit element. Zodra er een dekt,
         is alles eronder onzichtbaar -- ook de achtergrondkleur van hetzelfde
         element en alles bij de ouders. */
      for (const laag of laagStukken(bi)) {
        const st = verloopStops(laag);
        if (!st) return null;        // een afbeelding: hier stopt de meting eerlijk
        lagen.push(uitersten(st));
        if (dektHelemaal(st)) { dekt = true; break; }
      }
      if (dekt) break;
    }
    const c = kleur(s.backgroundColor);
    if (c && c[3] > 0) {
      lagen.push([c]);
      if (c[3] >= 1) { dekt = true; break; }
    }
    p = p.parentElement;
  }
  if (!dekt || !lagen.length) return null;
  let uit = lagen[lagen.length - 1].map(k => [k[0], k[1], k[2]]);
  for (let i = lagen.length - 2; i >= 0; i--) {
    const nieuw = [];
    for (const basis of uit) for (const k of lagen[i]) nieuw.push(mengOver(k, basis));
    uit = uitersten(nieuw.map(k => [k[0], k[1], k[2], 1])).map(k => [k[0], k[1], k[2]]);
  }
  return uit.length ? uit : null;
}
/* DE LETTER OVER DE GROND. Een aparte functie en geen paar regels in de lus,
   om precies een reden: hier zit sinds 20 augustus de menging van een
   halfdoorzichtige VOORGROND in, en een som die de poort laat zakken of slagen
   hoort in Node na te rekenen te zijn (test/a11ykeuring.test.js). In de lus
   kan dat niet -- daar zit een browser omheen.

   Per grondkandidaat wordt de letter EERST over die grond gemengd en pas daarna
   gewogen. Dat is niet hetzelfde als een keer mengen en dan vergelijken: over
   een verloop levert dezelfde letter per toon een andere kleur op, en de
   ongunstigste van die combinaties telt. */
function opGrond(fg, kandidaten) {
  let beste = null;
  for (const k of kandidaten) {
    const inkt = mengOver(fg, k);            // EEN keer mengen, en hier
    const r = ratio(inkt, k);
    if (!beste || r < beste.verhouding) beste = { verhouding: r, grond: k, inkt: inkt };
  }
  return beste;
}
/* De oude naam blijft bestaan voor wie een enkele kleur wil: de ongunstigste
   kandidaat kan hij niet kiezen zonder de voorgrond te kennen, dus hij geeft de
   eerste. Binnen de keuring wordt gronden() gebruikt, niet dit. */
function achtergrond(el) {
  const g = gronden(el);
  return g && g.length ? g[0] : null;
}
/* WAAR staat het? Een contrastmelding zonder plaats is niet te repareren: je
   weet dat er ergens op de pagina iets te bleek is, en dan begint het zoeken.
   Deze regel geeft het element een adres dat een mens kan volgen -- tag, id of
   klasse, plus de eerste woorden van de tekst zelf. */
function adres(el) {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? '#' + el.id : '';
  const kl = !id && el.classList.length ? '.' + Array.prototype.slice.call(el.classList, 0, 2).join('.') : '';
  const tekst = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return tag + id + kl + (tekst ? ' "' + tekst + '"' : '');
}
function keurInPagina() {
  const structureel = {};
  const contrast = {};
  /* `el` mag ontbreken (een paginabrede bevinding als een missende <title>
     heeft geen element), maar waar hij er WEL is, gaat het adres mee. Dat deed
     alleen de contrastmelding hieronder, en de kop van adres() legt precies uit
     waarom dat nodig is -- alleen gold dat argument net zo goed voor een
     structurele overtreding. Een keuring die "1 formulierveld zonder label" op
     een pagina met veertig velden meldt, laat de vinder zoeken; dat kostte hier
     een ronde. Hoogstens drie voorbeelden, zelfde grens als bij contrast. */
  const tel = (bak, id, help, el) => {
    bak[id] = bak[id] || { id: id, help: help, aantal: 0, waar: [] };
    bak[id].aantal++;
    if (el && bak[id].waar.length < 3) bak[id].waar.push(adres(el));
  };

  document.querySelectorAll('img').forEach(img => { if (zichtbaar(img) && mistAlt(img)) tel(structureel, 'afbeelding-alt', 'Afbeelding zonder alt-tekst', img); });
  document.querySelectorAll('button, [role="button"]').forEach(el => { if (zichtbaar(el) && mistNaam(el)) tel(structureel, 'knop-naam', 'Knop zonder toegankelijke naam', el); });
  document.querySelectorAll('a[href]').forEach(el => { if (zichtbaar(el) && mistNaam(el)) tel(structureel, 'link-naam', 'Link zonder toegankelijke naam', el); });
  document.querySelectorAll('input, select, textarea').forEach(el => { if (zichtbaar(el) && mistLabel(el)) tel(structureel, 'veld-label', 'Formulierveld zonder label', el); });
  const html = document.documentElement;
  if (!html.getAttribute('lang')) tel(structureel, 'html-taal', '<html> zonder lang-attribuut');
  if (!(document.title || '').trim()) tel(structureel, 'titel', 'Document zonder <title>');

  /* DE EERSTE TABSTOP SPRINGT NAAR DE INHOUD (WCAG 2.4.1, Bypass Blocks).

     Elk scherm hier draagt dezelfde schil: een balk, een wereldkiezer, een
     app-menu, de Rahul-tab. Wie met het toetsenbord werkt loopt daar op ELK
     scherm opnieuw doorheen voordat hij bij de inhoud is -- gemeten op drie
     schermen: 15, 11 en 4 tabs. shared/basis.js zet daarom een springlink als
     eerste element van de body.

     WAAROM DIT HIER STAAT EN NIET ALS BRONREGEL IN check.js. Een bronregel kan
     hoogstens zien DAT de code bestaat. Deze keuring kijkt naar wat de browser
     werkelijk als eerste tabstop aanbiedt, en dat is de belofte zelf. Hij vangt
     dus ook het geval dat een scherm zijn eigen element vooraan zet, of dat de
     link wel bestaat maar buiten de tabvolgorde valt.

     TWEE UITZONDERINGEN, ALLEBEI GEMETEN EN GEEN NAMENLIJST. Een eerste ronde
     over alle 259 schermen meldde er 57, en geen van die 57 was een defect:

     53x EEN OPEN MODAAL. De RTFoundation-schermen zetten een <dialog
         aria-modal> met "Kies een profiel" zodra je geen gezinsprofiel hebt. Een
         modaal HOORT de tabvolgorde over te nemen -- alles erbuiten is inert, de
         springlink dus ook. Op die 53 stond hij er wel degelijk (gemeten:
         springlink=JA, modaal=JA). Een regel die daar afgaat, vraagt om een
         springlink die de browser met opzet onbereikbaar maakt.
      4x EEN DEUR DIE DE HELE PAGINA IS. kantoren, kassa, payroll en societeit
         vervangen bij weigering het HELE document door section.rtgdeur -- de
         basis-laag staat daarna niet eens meer in de DOM (gemeten:
         basisGeladen=false). Er is dan geen herhaalde schil om over te slaan;
         de deur is de inhoud. Zelfde geval als /site/404.html, dat de gedeelde
         laag nooit laadt.

     DE VOORWAARDE MEET DE HERHAALDE SCHIL ZELF, en dat is de tweede poging. De
     eerste keek of shared/basis.js als <script src> in de DOM stond -- en dat
     leverde overal `false` op, ook op schermen waar de springlink er gewoon was.
     De regel stond daarmee op ELK scherm uit, en de nulmeting betekende niets.
     Dat kwam alleen aan het licht door de mutatie (springNaarInhoud uitzetten en
     kijken of de keuring hem mist): die bleef groen, en een regel die onder zijn
     eigen mutatie groen blijft, meet niets.

     Nu is de voorwaarde het ding waar WCAG 2.4.1 werkelijk over gaat: staan er
     focusbare elementen VOOR de inhoud? Dat is de herhaalde schil, en dat is
     precies wat een springlink overslaat. Geen inhoud (de vier deur-schermen),
     of niets ervoor (het 404-scherm), dan is er ook niets over te slaan. */
  const hoofd = document.querySelector('main, [role="main"], #main');
  if (hoofd) {
    const tabbaar = [];
    document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')
      .forEach(el => { if (zichtbaar(el) && !el.disabled && el.tabIndex >= 0) tabbaar.push(el); });
    // wat staat er VOOR de inhoud (en niet erin)? dat is de schil
    const ervoor = tabbaar.filter(el => !hoofd.contains(el) &&
      (hoofd.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) !== 0);
    const eerste = tabbaar[0];
    const inModaal = eerste && eerste.closest('dialog[open],[aria-modal="true"]');
    if (ervoor.length >= 3 && eerste && !inModaal) {
      const href = eerste.tagName === 'A' ? (eerste.getAttribute('href') || '') : '';
      const doel = /^#./.test(href) ? document.getElementById(href.slice(1)) : null;
      if (!doel) {
        tel(structureel, 'springlink',
          'De eerste tabstop springt niet naar de inhoud, en er staan ' + ervoor.length +
          ' focusbare elementen voor de inhoud (WCAG 2.4.1)', eerste);
      }
    }
  }

  /* WAT DE POORT WEEGT, TELT DE POORT ZELF. Dit stond als los getal in
     TOEGANKELIJK.md en in A11Y-INGELOGD.json ("83%"), met de hand geteld, en het
     was mis: de echte dekking was 56% en de grootste blinde vlek stond er niet
     eens bij. Een cijfer over de meting hoort uit de meting te komen, anders
     veroudert het zonder dat iemand het merkt (LAT.md regel 4). */
  const dekking = { gemeten: 0, url: 0, onzichtbaar: 0, alfanul: 0 };

  // contrast (fataal): alleen elementen met eigen zichtbare tekst en een oplosbare, solide achtergrond
  document.querySelectorAll('body *').forEach(el => {
    const eigenTekst = Array.prototype.some.call(el.childNodes, n => n.nodeType === 3 && n.textContent.trim());
    if (!eigenTekst) return;
    if (!zichtbaar(el)) { dekking.onzichtbaar++; return; }
    const s = getComputedStyle(el);
    if (parseFloat(s.opacity) < 1) { dekking.onzichtbaar++; return; }   // half-transparante intro-tekst
    /* EEN HALFDOORZICHTIGE LETTER IS OOK EEN LETTER, en dat is de reparatie van
       20 augustus 2026. Hieronder stond \`fg[3] < 1\` en dan return: elke tekst met
       een alfa in zijn kleur ging ongewogen langs de poort. Gemeten over alle
       schermen in drie thema's: 1968 van de 5977 tekstelementen, 32,9%. Dat is
       geen randgeval maar de grootste blinde vlek die er was -- groter dan de
       \`url()\`-gronden (11,1%) en groter dan de reden die hier op papier stond
       ("een keten die tot de wortel doorzichtig blijft", in werkelijkheid NUL).
       En het is precies de groep waar de zachte tonen van dit huis in wonen:
       \`--rtg-muted\` en \`--rtg-soft\` staan als \`rgba(...)\` in de themalaag, dus
       de poort keek langs de tekst waar hij het hardst nodig was.

       Rekenen kan gewoon: de browser doet er hetzelfde mee als met een
       doorzichtige achtergrondlaag, en die som staat al in mengOver(). Per
       grondkandidaat wordt de letter EERST over die grond gemengd en pas daarna
       gewogen -- niet eenmaal over de eerste kandidaat, want over een verloop
       verschilt de gemengde letter per toon.

       Wat hier nog wel stopt: alfa NUL. Dat is geen bleke letter maar een
       onzichtbare, en die wordt in dit huis (en overal) gebruikt om tekst door
       een achtergrond te laten tekenen (\`background-clip:text\`). Daar valt geen
       verhouding van te maken die iets betekent, dus zwijgt de poort erover --
       dezelfde afspraak als bij een foto als grond. */
    const fg = kleur(s.color); if (!fg || !(fg[3] == null || fg[3] > 0)) { dekking.alfanul++; return; }
    /* De ONGUNSTIGSTE grond telt. Tekst over een verloop staat op elke toon
       ervan, dus hij hoort overal leesbaar te zijn en niet gemiddeld. */
    const kandidaten = gronden(el); if (!kandidaten || !kandidaten.length) { dekking.url++; return; }
    dekking.gemeten++;
    const uit = opGrond(fg, kandidaten);
    const laagst = uit.verhouding, bg = uit.grond, voor = uit.inkt;
    const drempel = grootTekst(parseFloat(s.fontSize), s.fontWeight) ? 3 : 4.5;
    if (laagst < drempel - 0.05) {
      tel(contrast, 'contrast', 'Te laag kleurcontrast (' + Math.round(laagst * 100) / 100 + ':1)');
      // hoogstens drie voorbeelden: genoeg om het te vinden, niet genoeg om
      // het log onleesbaar te maken
      if (contrast.contrast.waar.length < 3)
        contrast.contrast.waar.push(adres(el) + ' -- ' + s.color +
          ((fg[3] == null || fg[3] >= 1) ? '' : ' = rgb(' + voor.join(', ') + ')') +
          ' op rgb(' + bg.slice(0, 3).join(', ') + ')');
    }
  });

  return { overtredingen: Object.values(structureel), contrast: Object.values(contrast), dekking };
}

const BRON = [kleur, luminantie, ratio, grootTekst, naam, mistAlt, mistNaam, mistLabel, zichtbaar,
  mengOver, laagStukken, verloopStops, uitersten, pseudoLagen, gronden, opGrond, achtergrond, adres, keurInPagina]
  .concat([]) // dektHelemaal is een pijlfunctie en gaat als tekst mee, hieronder
  .map(f => f.toString()).join('\n\n') +
  '\nconst dektHelemaal = ' + dektHelemaal.toString() + ';\n' +
  '\nwindow.__a11yKeur = keurInPagina;\n';

/* HET OORDEEL, apart en puur, zodat het toetsbaar is zonder browser.

   Dit stond als twee losse if-regels onder in scripts/a11y.js, en daarmee was
   de enige manier om te bewijzen dat de poort dichtslaat: een echte pagina met
   een echt contrastgat bouwen. Een poort die je nooit hebt zien dichtgaan is
   geen poort (LAT.md regel 9), dus hoort het oordeel hier bij de andere pure
   helpers -- test/a11ykeuring.test.js komt er in Node bij. */
function velt(structureel, contrast) {
  const melding = [];
  if (structureel) melding.push('\n[a11y] MISLUKT: ' + structureel + ' structurele overtreding(en).');
  if (contrast) melding.push('\n[a11y] MISLUKT: ' + contrast + ' contrastovertreding(en). ' +
    'Dit is sinds de contrastronde fataal: de keuring meet alleen tekst met een oplosbare, ' +
    'solide achtergrond, dus dit is geen meetverschil maar een leesbaarheidsfout.');
  return { faalt: structureel > 0 || contrast > 0, melding };
}

module.exports = { BRON, kleur, luminantie, ratio, grootTekst, naam, mistAlt, mistNaam, mistLabel, velt,
  mengOver, laagStukken, verloopStops, uitersten, dektHelemaal, opGrond };
