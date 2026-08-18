/* HET RAAKVLAK: IS DEZE KNOP TE RAKEN MET EEN HAND DIE TRILT?

   WCAG 2.5.8 (AA, sinds 2.2) vraagt 24 bij 24 CSS-pixels voor alles wat je
   aanwijst. Dat is geen esthetische wens: onder die maat mist een hand met
   tremor, een duim op een rijdende trein, of iemand die zijn telefoon met een
   pink bedient. De a11y-keuring keek daar niet naar -- die meet structuur (alt,
   label, naam) en contrast, en allebei stonden op nul terwijl er 267 knoppen
   waren die je niet kon raken.

   DIT IS EEN DERDE RONDE EN GEEN DERDE POORT. Hij hoort bij scripts/a11y.js,
   draait op TELEFOONFORMAAT (390x844, want daar gaat 2.5.8 over) en levert zijn
   getal aan hetzelfde register, A11Y-INGELOGD.json.

   DE TWEE UITZONDERINGEN DIE WCAG ZELF MAAKT, en ze staan er allebei in:

     1. INLINE. Een link in een lopende zin wordt begrensd door de regelhoogte
        van de tekst eromheen; die uitzonderen is de bedoeling. De toets die dat
        onderscheidt: staat er in de ouder MEER tekst dan in de link zelf? Een
        link die in zijn eentje een alinea vult, is geen link IN een zin en valt
        er dus niet onder.
     2. ONZICHTBAAR. Wat niet in beeld staat, hoeft niet te raken te zijn. Dat
        gaat hier verder dan display:none: ook aria-hidden en opacity 0 tellen
        als weg.

   EN EEN DIE UIT EEN FOUT KOMT. Een pagina die binnenkomt met een schaal-
   animatie staat een halve seconde lang op 99,8% -- en dan meet een knop van
   precies 24 pixels er 23,96. De eerste ronde meldde zorgbalie.html om die reden,
   en er was niets mis. De ronde in a11y.js wacht daarom tot de animaties uit zijn
   voordat hij meet; deze module doet de meting zelf en gaat ervan uit dat de
   pagina stilstaat. */
'use strict';

const GRENS = 24; // CSS-pixels, WCAG 2.5.8 AA

/* De browserkant. Wordt als tekst in de pagina uitgevoerd (evaluate), dus geen
   require, geen closure over iets van hierbuiten -- alles wat hij nodig heeft
   staat in de functie zelf of komt als argument mee. */
function raakvlakInPagina(grens) {
  var G = grens || 24;
  var zichtbaar = function (el) {
    var s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
    if (!el.getClientRects().length) return false;
    for (var p = el; p; p = p.parentElement) {
      if (p.getAttribute && p.getAttribute('aria-hidden') === 'true') return false;
    }
    return true;
  };
  var adres = function (el) {
    var k = (el.className && typeof el.className === 'string' && el.className.trim())
      ? '.' + el.className.trim().split(/\s+/)[0] : '';
    var t = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '')
      .replace(/\s+/g, ' ').trim().slice(0, 24);
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : k) + (t ? ' "' + t + '"' : '');
  };
  /* De inline-uitzondering van WCAG 2.5.8: een link die door de regelhoogte van
     de tekst eromheen wordt begrensd. "Eromheen" is de maat -- staat er in de
     ouder niet meer dan in de link, dan is er geen zin en geldt hij niet. */
  var inLopendeTekst = function (el) {
    if (el.tagName !== 'A' || !el.parentElement) return false;
    if (!/^(P|LI|SPAN|SMALL|TD|DIV|EM|STRONG)$/.test(el.parentElement.tagName)) return false;
    var buiten = (el.parentElement.textContent || '').trim().length;
    var binnen = (el.textContent || '').trim().length;
    return buiten > binnen + 10;
  };

  var focusbaar = [].filter.call(
    document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])'),
    function (el) { return zichtbaar(el) && !el.disabled && el.tabIndex >= 0; });

  var klein = [];
  for (var i = 0; i < focusbaar.length; i++) {
    var el = focusbaar[i];
    var r = el.getBoundingClientRect();
    if (r.width >= G && r.height >= G) continue;
    if (inLopendeTekst(el)) continue;
    klein.push(adres(el) + '  ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  return { klein: klein, gekeken: focusbaar.length };
}

/* De bron die in de pagina wordt gezet, zelfde vorm als a11ykeuring.BRON. */
const BRON = raakvlakInPagina.toString() + '\nwindow.__a11yRaakvlak = raakvlakInPagina;\n';

/* HET OORDEEL, apart en puur, zodat het zonder browser te toetsen is -- dezelfde
   reden als velt() in a11ykeuring.js. Een poort die je nooit hebt zien dichtgaan
   is geen poort (LAT.md regel 9).

   De grens leeft in A11Y-INGELOGD.json en niet hier: wie ruimte nodig heeft moet
   dat in het register opschrijven, met een reden, en niet in de code wegwerken. */
function veltRaakvlak(gevonden, grens) {
  const g = Number(grens) || 0;
  if (gevonden > g) {
    return {
      faalt: true,
      melding: '\n[a11y] MISLUKT: ' + gevonden + ' raakvlak(ken) onder ' + GRENS + 'x' + GRENS +
        ' op telefoonformaat, de grens is ' + g + ' (WCAG 2.5.8). Er is er een BIJGEKOMEN.'
    };
  }
  if (gevonden < g) {
    return { faalt: false, melding: '\n[a11y] De raakvlakgrens kan strakker: ' + gevonden +
      ' tegen ' + g + ' in A11Y-INGELOGD.json.' };
  }
  return { faalt: false, melding: '' };
}

module.exports = { BRON, raakvlakInPagina, veltRaakvlak, GRENS };
