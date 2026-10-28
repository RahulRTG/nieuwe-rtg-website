'use strict';
/* BETROUWBAARHEID.md par. 7, stap 1: van de knoppen die de proef niet kon
   aantikken, lag er bij 572 "iets overheen". Wat dat iets is -- een lade die een
   mens eerst dichttikt, of een balk die de knop voorgoed bedekt -- bepaalt of
   het een eigenschap van de proef is of een productdefect. appwerkt.js bewaart
   daarom het element uit de log van Playwright; deze toets houdt vast dat hij
   het juiste element leest. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { onderschepper } = require('../scripts/appwerkt');

test('het element dat de klik opving, als tag#id.klasse uit de log van Playwright', () => {
  assert.equal(onderschepper('  - <div class="edge-lade open" id="edgeLade">…</div> intercepts pointer events'),
    'div#edgeLade.edge-lade.open');
  assert.equal(onderschepper('<div role="dialog" class="modal"></div> intercepts pointer events'), 'div.modal');
});

test('bij een subtree telt de wortel die over de knop ligt, niet het kind', () => {
  assert.equal(onderschepper('<span class="label">Menu</span> from <nav id="schilbalk" class="rtg-balk vast">…</nav> subtree intercepts pointer events'),
    'nav#schilbalk.rtg-balk.vast');
});

test('geen element in de log is "onbekend", nooit een verzonnen naam', () => {
  assert.equal(onderschepper('Timeout 2500ms exceeded'), 'onbekend');
  assert.equal(onderschepper(''), 'onbekend');
});

/* Een weigering met een zin is pas een defect als het scherm die zin niet toont;
   daarvoor moet de zin eerst betrouwbaar uit het antwoord komen. */
test('de zin van een weigering komt uit {"error": ...}, en anders is er geen', () => {
  const { weigerZin } = require('../scripts/appwerkt');
  assert.equal(weigerZin('{"error":"Schrijf op wat er gebeurde."}'), 'Schrijf op wat er gebeurde.');
  assert.equal(weigerZin('{"error":"  "}'), null, 'een lege zin zegt de gebruiker niets');
  assert.equal(weigerZin('{"fout":"x"}'), null);
  assert.equal(weigerZin('<html>kapot</html>'), null, 'geen JSON is geen zin');
});

test('een lange weigering wordt als geheel gelezen, niet afgekapt', () => {
  const { weigerZin } = require('../scripts/appwerkt');
  const lang = JSON.stringify({ error: 'Hiervoor heb ik nog je paspoortgegevens nodig; dat vraag ik even.',
    soort: 'vlucht', ontbreekt: ['paspoortnummer', 'geldig tot', 'nationaliteit'], uitleg: 'x'.repeat(200) });
  assert.equal(weigerZin(lang), 'Hiervoor heb ik nog je paspoortgegevens nodig; dat vraag ik even.');
  assert.equal(weigerZin(lang.slice(0, 200)), null, 'zo zag de meter het vroeger: afgekapt is het geen JSON');
});

/* Een tik die in de limiet liep, zegt via de log van Playwright HOE ver hij
   kwam. "reden niet gemeld" verborg dat de tik vaak wel was verstuurd -- en dan
   staat de laag erachter open (zie de Escape na een mislukte tik in
   scripts/appwerkt.js). Traag is nooit "aangetikt": alle drie blijven een
   reden waarom de knop NIET is aangetikt. */
test('de reden van een mislukte tik: bekend, verstuurd-maar-niet-afgerond, of bezet', () => {
  const { klikReden } = require('../scripts/appwerkt');
  assert.equal(klikReden('Timeout\n - <div class="x"></div> intercepts pointer events'), 'intercepts pointer events');
  assert.equal(klikReden('Timeout 2500ms exceeded.\n - waiting for element to be visible, enabled and stable\n - element is visible, enabled and stable\n - scrolling into view if needed\n - done scrolling\n - performing click action'),
    'tik verstuurd maar niet afgerond binnen de limiet');
  assert.equal(klikReden('Timeout 2500ms exceeded.\n - attempting click action\n - waiting for element to be visible, enabled and stable'),
    'pagina antwoordde niet binnen de limiet');
  assert.equal(klikReden('Timeout 2500ms exceeded.\n - waiting for locator'), 'reden niet gemeld');
  assert.equal(klikReden(''), 'reden niet gemeld');
});

test('alleen een verdwenen of geblokkeerde knop krijgt eenmaal een schone tegenproef', () => {
  const { redenVoorSchoneTegenproef } = require('../scripts/appwerkt');
  for (const reden of ['intercepts pointer events', 'element is outside of the viewport', 'element is not visible',
    'element is not stable', 'pagina antwoordde niet binnen de limiet']) {
    assert.equal(redenVoorSchoneTegenproef(reden), true, reden);
  }
  assert.equal(redenVoorSchoneTegenproef('element is not enabled'), false,
    'een echt uitgeschakelde bediening mag door heropenen niet groen worden');
  assert.equal(redenVoorSchoneTegenproef('tik verstuurd maar niet afgerond binnen de limiet'), false,
    'een onzekere mutatie mag nooit automatisch opnieuw worden verstuurd');
});

test('een geometrisch bewegende bediening gebruikt uitsluitend de echte toetsenbordroute als terugval', () => {
  const bron = require('node:fs').readFileSync(require('node:path').join(__dirname, '../scripts/appwerkt.js'), 'utf8');
  assert.match(bron, /async function tikAlsGebruiker[\s\S]{0,1500}element is not stable[\s\S]{0,1500}keyboard\.press\('Enter'\)/);
  assert.doesNotMatch(bron, /async function tikAlsGebruiker[\s\S]{0,1800}dispatchEvent\(['"]click/,
    'de meter mag een klik niet rechtstreeks in het DOM veinzen');
});

test('een expliciete bedieningsidentiteit blijft gelijk wanneer alleen de zichtbare status wijzigt', () => {
  const bron = require('node:fs').readFileSync(require('node:path').join(__dirname, '../scripts/appwerkt.js'), 'utf8');
  const stabieleMerken = bron.match(/return bron \? \[el\.tagName, bron\]\.join\('\|'\)/g) || [];
  assert.equal(stabieleMerken.length, 4,
    'inventarisatie, replay en controle moeten dezelfde stabiele bronidentiteit gebruiken');
});

test('kortlevende bevestigingen, beleid en documentacties verklaren zichzelf aan de bedieningsmeter', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const lees = (bestand) => fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');
  assert.match(lees('public/apps/mijn-relaties.html'), /sluitToestemmingen[\s\S]{0,120}data-hoofdactie/);
  assert.match(lees('public/shared/social-intelligence-data.js'), /sociaal-beleid-[\s\S]{0,120}data-hoofdactie/);
  assert.match(lees('public/shared/social-intelligence-deck.js'), /rtgSocialRahulSubmit[\s\S]{0,120}data-hoofdactie/);
  assert.match(lees('public/apps/office/app/app-02a2.js'), /office-fase-[\s\S]{0,120}data-hoofdactie/);
  assert.match(lees('public/shared/gebaar/gebaar-04.js'), /data-hoofdactie/);
});

test('de replaygrens groeit begrensd mee met onafhankelijke resterende bediening', () => {
  const { herstelgrens } = require('../scripts/appwerkt');
  assert.equal(herstelgrens(0), 32);
  assert.equal(herstelgrens(1), 32);
  assert.equal(herstelgrens(2), 64);
  assert.equal(herstelgrens(4), 128);
  assert.equal(herstelgrens(40), 128, 'de meter kan nooit onbeperkt blijven herhalen');
});

test('een herstelbare locatiekeuze telt niet als gesloten toegangsdeur', () => {
  const { POORTEN } = require('../scripts/appwerkt');
  assert.ok(POORTEN.includes('#poort.zien:not([data-poort-soort="locatie"])'));
  assert.ok(!POORTEN.includes('#poort.zien'),
    'de generieke selector zou Navigatie na een geweigerde locatie ten onrechte afsluiten');
});
