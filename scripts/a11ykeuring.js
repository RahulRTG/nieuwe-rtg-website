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
function kleur(s) {
  if (!s) return null;
  const m = String(s).match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const d = m[1].split(',').map(x => parseFloat(x.trim()));
  if (d.length < 3 || d.some((n, i) => i < 3 && isNaN(n))) return null;
  return [d[0], d[1], d[2], d.length >= 4 ? d[3] : 1];
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
function achtergrond(el) {
  let p = el;
  while (p && p.nodeType === 1) {
    const s = getComputedStyle(p);
    if (s.backgroundImage && s.backgroundImage !== 'none') return null; // gradient/afbeelding: niet te berekenen -> overslaan
    const c = kleur(s.backgroundColor);
    if (c && c[3] === 1) return c;
    p = p.parentElement;
  }
  return null;
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

  // contrast (fataal): alleen elementen met eigen zichtbare tekst en een oplosbare, solide achtergrond
  document.querySelectorAll('body *').forEach(el => {
    const eigenTekst = Array.prototype.some.call(el.childNodes, n => n.nodeType === 3 && n.textContent.trim());
    if (!eigenTekst || !zichtbaar(el)) return;
    const s = getComputedStyle(el);
    if (parseFloat(s.opacity) < 1) return;                 // half-transparante intro-tekst: overslaan
    const fg = kleur(s.color); if (!fg || fg[3] < 1) return;
    const bg = achtergrond(el); if (!bg) return;
    const drempel = grootTekst(parseFloat(s.fontSize), s.fontWeight) ? 3 : 4.5;
    if (ratio(fg, bg) < drempel - 0.05) {
      tel(contrast, 'contrast', 'Te laag kleurcontrast (' + Math.round(ratio(fg, bg) * 100) / 100 + ':1)');
      // hoogstens drie voorbeelden: genoeg om het te vinden, niet genoeg om
      // het log onleesbaar te maken
      if (contrast.contrast.waar.length < 3)
        contrast.contrast.waar.push(adres(el) + ' -- ' + s.color + ' op rgb(' + bg.slice(0, 3).join(', ') + ')');
    }
  });

  return { overtredingen: Object.values(structureel), contrast: Object.values(contrast) };
}

const BRON = [kleur, luminantie, ratio, grootTekst, naam, mistAlt, mistNaam, mistLabel, zichtbaar, achtergrond, adres, keurInPagina]
  .map(f => f.toString()).join('\n\n') + '\nwindow.__a11yKeur = keurInPagina;\n';

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

module.exports = { BRON, kleur, luminantie, ratio, grootTekst, naam, mistAlt, mistNaam, mistLabel, velt };
