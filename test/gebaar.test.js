/* RTG Gebaren: de regels die je aan een scherm niet ziet, machinaal gehandhaafd.

   WAAROM DEZE TOETS BESTAAT. Een gebarenlaag faalt zelden luid. Hij faalt door
   een regel die net iets te breed is (en dan veegt een carrousel niet meer),
   door een knop in een link (en dan hoort een schermlezer iets wat er niet mag
   staan), of doordat de browser de veeg afpakt (en dan dooft hij na twee pixels
   -- lang genoeg om in een demo te werken). Dat zie je niet door te kijken.

   Wat deze toets NIET doet: smaak beoordelen. Alleen dingen die waar of onwaar
   zijn. Bij elke toets staat DE MUTATIE die hem hoort te laten zakken
   (LAT.md regel 2) -- een toets die je niet hebt zien zakken, is geen toets.

   Draai los: node --test test/gebaar.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const lees = (p) => fs.readFileSync(path.join(WORTEL, p), 'utf8');
const CSS = lees('public/shared/gebaar.css');
const JS = lees('public/shared/gebaar.js');
// commentaar eruit: dit blad LEGT de regels uit, en die zinnen noemen dus
// precies de dingen waar we hieronder op zoeken.
const CSSKAAL = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const JSKAAL = JS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('in rust raakt het blad geen enkel element van een scherm aan', () => {
  /* DE MUTATIE: verander `.gb-rij{touch-action:pan-y}` in `a{touch-action:pan-y}`.
     Dan legt deze laag zich over tweehonderdvijftig schermen heen die er niets
     om gevraagd hebben -- precies de fout die een gedeelde laag onbruikbaar
     maakt. Elke kiezer hier hoort te beginnen bij iets dat de laag ZELF maakt
     (.gb-...) of bij een klasse van de UI-kit die hij bewust oplicht. */
  const TOEGESTAAN = /^(\.gb-|html\.rtg-stil|:root|@|\.rtg-knop)/;
  const kiezers = CSSKAAL.split('}').map((brok) => {
    const i = brok.indexOf('{');
    return i < 0 ? [] : brok.slice(0, i).split(',').map((s) => s.trim()).filter(Boolean);
  }).flat();
  assert.ok(kiezers.length > 20, 'het blad hoort echt gelezen te zijn');
  for (const k of kiezers) {
    assert.match(k, TOEGESTAAN,
      'kiezer "' + k + '" pakt iets wat niet van de gebarenlaag is; in rust hoort dit blad niets te veranderen');
  }
});

test('de richtingsvergrendeling staat in het blad, niet alleen in de code', () => {
  /* DE MUTATIE: haal `touch-action:pan-y` van .gb-rij weg. De code blijft
     werken op een muis en zakt niet -- maar op een telefoon vecht elke veeg met
     het verticaal scrollen van de pagina en verliest hij. Dat is de soort fout
     die alleen op een echt toestel te zien is, dus hij hoort hier vast te staan. */
  assert.match(CSSKAAL, /\.gb-rij\s*\{[^}]*touch-action\s*:\s*pan-y/,
    '.gb-rij mist touch-action:pan-y -- zonder die regel is de veeg op een telefoon niet te winnen');
});

test('de lade draagt geen enkele echte knop, en de actielade alleen maar', () => {
  /* DE MUTATIE: maak in bouwLade() een <button> in plaats van een <span>.
     Het ziet er identiek uit en werkt met een muis. Maar bijna elke regel in dit
     huis is zelf een <a>, en een knop IN een link is ongeldige HTML: een
     schermlezer kondigt dan een knop aan binnen een link, en de tik erop
     navigeert bovendien.

     De afspraak is daarom: de lade is voor een HAND en is aria-hidden; de
     actielade is voor een TOETS en een schermlezer en heeft echte knoppen. */
  const bouw = JSKAAL.slice(JSKAAL.indexOf('function bouwLade'), JSKAAL.indexOf('function sluit'));
  assert.ok(bouw.length > 100, 'bouwLade() hoort gevonden te zijn');
  assert.ok(!/createElement\('button'\)/.test(bouw),
    'bouwLade() maakt een echte knop; in een <a> is dat ongeldige HTML en een knop-in-een-link voor een schermlezer');
  assert.match(bouw, /setAttribute\('aria-hidden', 'true'\)/,
    'de lade hoort aria-hidden te zijn: hij is het oppervlak voor de hand, niet voor de schermlezer');
  const knop = JSKAAL.slice(JSKAAL.indexOf('function knopVoor'), JSKAAL.indexOf('function groep'));
  assert.match(knop, /createElement\('button'\)/,
    'de actielade hoort WEL echte knoppen te maken -- dat is de weg voor toetsenbord en schermlezer');
});

test('een gebaar is nooit de enige weg naar een actie', () => {
  /* DE MUTATIE: haal de keydown-luisteraar weg. Alles blijft werken zolang je
     een hand hebt. WCAG 2.1.1 en 2.5.7 gaan precies over de mensen die dat niet
     hebben: geen enkele handeling mag alleen met slepen of alleen met een
     aanwijzer te doen zijn. Vier wegen horen te bestaan, en alle vier komen ze
     uit bij opendActielade(). */
  for (const weg of ['keydown', 'contextmenu', 'pointerdown', 'focusin']) {
    assert.match(JSKAAL, new RegExp("addEventListener\\('" + weg + "'"),
      'de weg via ' + weg + ' is weg; dan is het gebaar de enige ingang geworden');
  }
  assert.match(JSKAAL, /ArrowLeft[\s\S]{0,200}opendActielade/,
    'pijl links hoort de actielade te openen');
  assert.match(JSKAAL, /ContextMenu[\s\S]{0,120}opendActielade/,
    'de menutoets hoort de actielade te openen');
});

test('de browser mag de veeg niet afpakken met een sleeplink', () => {
  /* DIT IS EEN GEMETEN FOUT EN GEEN VOORZORG. Zonder deze regel stuurt Chromium
     na twee pixels een dragstart over de <a>, kaapt de aanwijzer en levert een
     pointercancel: de lade opende 10 pixels en bevroor. Gemeten in een echte
     browser, niet beredeneerd.

     DE MUTATIE: haal de dragstart-luisteraar weg. Op een telefoon merk je niets
     (daar bestaat geen sleeplink) en op een muis dooft elke veeg. */
  assert.match(JSKAAL, /addEventListener\('dragstart'[\s\S]{0,200}preventDefault/,
    'dragstart wordt niet meer tegengehouden -- dan pakt de browser elke muisveeg over een link af');
});

test('doorvegen raakt nooit een actie die vasthouden vraagt', () => {
  /* DE MUTATIE: haal `&& !g.acties[g.kant][0].borg` uit de drempeltoets. Dan
     kan een onomkeerbare actie op een misveeg gebeuren -- en dat is precies wat
     'borg' hoort te verhinderen. */
  assert.match(JSKAAL, /breedte\s*>=\s*g\.drempel\s*&&\s*!g\.acties\[g\.kant\]\[0\]\.borg/,
    'de drempel sluit borg-acties niet meer uit; dan voert een misveeg iets uit dat niet terug kan');
});

test('de drempel ligt voorbij de volle lade en voorbij de halve regel', () => {
  /* DE MUTATIE: zet de drempel op g.breed. Dan voert elke veeg die de lade net
     helemaal opent meteen de eerste actie uit, en is "even kijken wat er staat"
     onmogelijk geworden. */
  assert.match(JSKAAL, /g\.drempel\s*=\s*Math\.max\(g\.breed\s*\+\s*\d+,\s*g\.rij\.offsetWidth\s*\*\s*0?\.\d+\)/,
    'de drempel is geen maximum van (volle lade + marge) en (deel van de regel) meer');
});

test('minder beweging betekent geen beweging, niet minder bediening', () => {
  /* DE MUTATIE: laat de laag onder prefers-reduced-motion de gebaren helemaal
     uitzetten. Dat lijkt netjes en is het niet: wie beweging uitzet, vraagt om
     rust en niet om minder functies. Alleen de OVERGANGEN gaan uit. */
  assert.match(CSSKAAL, /@media \(prefers-reduced-motion:reduce\)[\s\S]{0,220}transition:none/,
    'de overgangen gaan niet uit bij prefers-reduced-motion');
  assert.match(CSSKAAL, /html\.rtg-stil[\s\S]{0,240}transition:none/,
    'de eigen rust-instelling van een lid (html.rtg-stil) zet de overgangen niet uit');
  assert.ok(!/prefers-reduced-motion[\s\S]{0,200}display\s*:\s*none\s*;?\s*\}[\s\S]{0,40}\.gb-lade/.test(CSSKAAL),
    'de lade zelf hoort niet te verdwijnen als iemand minder beweging vraagt');
});

test('de tijdlijn links van een regel schuift niet mee', () => {
  /* DE MUTATIE: haal de data-gb-vast-lus weg, of zet --gb-inzet op .reis terug
     naar nul. De regel veegt dan zijn eigen tijdlijn weg: de stip verdwijnt
     onder de lade en de doorlopende lijn breekt bij precies die ene regel. */
  assert.match(JS, /pos === 'absolute'[\s\S]{0,120}data-gb-vast/,
    'absoluut gepositioneerde kinderen worden niet meer vastgezet -- de stip veegt mee');
  assert.match(CSSKAAL, /\.gb-lade\[data-kant="links"\]\{left:var\(--gb-inzet/,
    'de linkerlade houdt geen rekening meer met --gb-inzet');
  assert.match(lees('public/shared/rtg-wereld.css'), /--gb-inzet\s*:/,
    '.reis zegt niet meer waar zijn tijdlijn ligt');
  assert.match(lees('public/shared/canvas.css'), /--gb-inzet\s*:[\s\S]{0,40}--gb-marge\s*:/,
    '.cv-wat zegt niet meer waar zijn stip en zijn lijn liggen');
});

test('elk raakvlak in de lade en de actielade haalt de 24 pixels', () => {
  /* De harde poort uit TOEGANKELIJK.md: 0 van 259 schermen mag zakken op een
     raakvlak kleiner dan 24x24 op telefoonformaat.
     DE MUTATIE: zet de min-height van een knop in de actielade op 20px. */
  assert.match(CSSKAAL, /\.gb-blad menu button\{[^}]*min-height:44px/,
    'een knop in de actielade is kleiner dan 44px hoog geworden');
  assert.match(CSSKAAL, /\.gb-greep\{[^}]*width:28px;height:28px/,
    'de greep is onder de 24x24 gezakt');
  assert.match(CSSKAAL, /\.gb-terug button\{[^}]*min-height:24px/,
    'de terugdraai-knop is onder de 24 pixels gezakt');
});

test('de terugdraai-melding wordt voorgelezen', () => {
  /* Doorvegen VOERT UIT. Wie het scherm niet ziet, hoort dan niets gebeuren --
     tenzij de melding een role heeft die een schermlezer oppikt.
     DE MUTATIE: haal role="status" weg. */
  assert.match(JSKAAL, /gb-terug[\s\S]{0,160}setAttribute\('role', 'status'\)/,
    'de terugdraai-melding draagt geen role=status meer');
});
