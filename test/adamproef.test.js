/* DE ADAMPROEF -- de vierde keten, en de strengste eis aan een bevinding.

   scripts/adamproef.js legt een keten af rond een zeventienjarige zonder
   RTG-account: van een doel naar een mogelijkheid die hij zelf ziet. Dit
   bestand bewaakt het INSTRUMENT en niet de keten zelf -- die draait tegen een
   wegwerpserver en duurt daar minuten.

   WAAROM DE EISEN HIER HOGER LIGGEN DAN BIJ test/ritproef.test.js. De stand
   `openBekend` is een uitweg: een schakel die aantoonbaar niet sluit, met een
   uitgeschreven reden, telt niet als defect. Bij een rit is de verleiding om
   daar een zinnetje in te zetten beperkt. Bij een keten over een MENS is hij
   groot -- "dat is nu eenmaal zo" leest daar makkelijk als een besluit. Toets 3
   eist daarom dat elke reden drie dingen zegt: WAT er ontbreekt, WAAROM dat
   vandaag zo is, en WIE erover gaat. Een reden zonder die drie is een etiket.

   Draai los: node --test test/adamproef.test.js
   De keten zelf: npm run adamproef */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'adamproef.js'), 'utf8');
const lees = (n) => JSON.parse(fs.readFileSync(path.join(WORTEL, n), 'utf8'));

test('0. de proef zakt op een open schakel zonder reden, en niet op een bevinding', () => {
  assert.match(bron, /uit\.sluit = .*t\.open === 0 && t\.stuk === 0 && t\.gebroken === 0 && t\.openBekend === 0/,
    'sluit hoort ALLE slechte uitkomsten te tellen, openBekend inbegrepen');
  assert.match(bron, /process\.exit\(u\.sluitMetBevinding \? 0 : 1\)/,
    'zonder foutcode op een echte open schakel is dit een meting en geen proef');
  assert.match(bron, /uit\.sluitMetBevinding =/,
    'er is geen apart veld voor "loopt door, met een bevinding" -- dan wordt het een samengesteld cijfer');
});

test('1. de proef draait op een wegwerpserver, met de werkgever als demo-zaak', () => {
  assert.match(bron, /require\('\.\/lib\/wegwerpserver'\)/);
  assert.match(bron, /DEMO_SUPPLIER: WERKGEVER/, 'zonder deze omgeving logt de proef in bij de verkeerde zaak');
  assert.doesNotMatch(bron, /localhost:3000|127\.0\.0\.1:3000/);
});

test('2. de leeftijd wordt gerekend en niet ingetypt', () => {
  /* Een vaste geboortedatum in een keten die OVER leeftijd gaat, verloopt: over
     een jaar is Adam achttien en meet dezelfde proef stilletjes iets anders.
     Dat is de gevaarlijkste soort verval, want er zakt niets. */
  assert.match(bron, /function geborenJaarGeleden/,
    'de geboortedatum hoort uit een berekening te komen');
  assert.doesNotMatch(bron, /geboortedatum: '20\d\d-/,
    'er staat een vaste geboortedatum in de proef; die verloopt zonder dat iets zakt');
});

test('3. elke openBekend-schakel zegt WAT, WAAROM en WIE', () => {
  const j = lees('ADAMPROEF.json');
  const bevindingen = j.schakels.filter(s => s.stand === 'openBekend');
  /* GEEN BEVINDINGEN IS HIER GEEN LEGE TOETS, MAAR EEN ANDERE EIS. Sinds 23
     september sluit de keten helemaal (ARBEID.md par. 7a), en dan zegt deze
     toets niets over redenen -- er zijn er geen. Wat hij dan wel moet vasthouden
     is dat de keten ook echt sluit: zonder bevindingen en zonder `sluit` zou een
     open schakel zonder reden hier stil doorheen lopen. */
  if (!bevindingen.length) {
    assert.equal(j.sluit, true, 'geen enkele bevinding, en toch sluit de keten niet');
    assert.equal((j.bevindingen || []).length, 0);
    return;
  }
  assert.equal(bevindingen.length, (j.bevindingen || []).length,
    'de bevindingenlijst loopt niet gelijk met de schakels');
  for (const s of bevindingen) {
    assert.ok(s.bekend && s.bekend.length > 150,
      'schakel ' + s.nr + ': de reden is te kort om een bevinding te zijn in plaats van een etiket');
    assert.match(s.bekend, /WAT ONTBREEKT/,
      'schakel ' + s.nr + ': de reden zegt niet WAT er ontbreekt');
    assert.match(s.bekend, /WAAROM/,
      'schakel ' + s.nr + ': de reden zegt niet WAAROM dat vandaag zo is');
    assert.match(s.bekend, /WIE EROVER GAAT/,
      'schakel ' + s.nr + ': de reden zegt niet wie hierover gaat -- dan is er geen adres voor het besluit');
    /* Een bevinding hoort te wijzen naar code of een document, anders is hij
       niet na te trekken en dus niet te weerleggen. */
    assert.match(s.bekend, /\.js|\.md/,
      'schakel ' + s.nr + ': de reden noemt geen bestand; dan is hij niet na te trekken');
    assert.ok((s.ziet || s.antwoord),
      'schakel ' + s.nr + ': een bevinding hoort te zeggen wat er WEL gemeten is');
  }
});

test('4. een 5xx wordt nooit als bevinding weggeschreven', () => {
  /* De deur-regel accepteert een 4xx als meetuitslag: dit huis weigert met
     opzet en legt uit. Een 5xx of een 0 is iets dat stuk is, en een proef die
     dat als "bekend" zou tellen, schrijft een crash weg als een besluit. */
  assert.match(bron, /r\.status >= 400 && r\.status < 500/,
    'de deur-regel begrenst niet op 4xx; dan kan een storing als bevinding langskomen');
});

test('5. het register sluit en telt op', () => {
  const j = lees('ADAMPROEF.json');
  const t = j.telling;
  assert.equal(t.gesloten + t.open + t.openBekend + t.stuk, t.schakels, 'de schakelstanden tellen niet op');
  assert.equal(t.gehouden + t.gebroken, t.storingen, 'de storingstanden tellen niet op');
  assert.ok(t.schakels >= 11 && t.storingen >= 8, 'te weinig schakels of storingen');
  assert.equal(t.open, 0, 'er staat een schakel open zonder reden -- draai npm run adamproef en repareer of verklaar');
  assert.equal(t.stuk, 0);
  assert.equal(t.gebroken, 0);
  assert.equal(j.sluitMetBevinding, true);
  assert.ok(j.grens && j.grens.length > 80, 'het register draagt geen uitgeschreven grens');
});

test('6. de proef zet zijn wereld klaar en zegt dat erbij', () => {
  const j = lees('ADAMPROEF.json');
  assert.ok(j.wereld && j.wereld.gezin && j.wereld.adam,
    'de seed heeft geen gezin; wie dat klaarzet zonder het te melden, verbergt de opstelling');
});

test('7. de vierde keten telt mee in de ketenvorm', () => {
  /* Dezelfde eis als test/toelatingsproef.test.js: een keten die niet in
     KETENVORM.json staat, maakt het gedeelde-vorm-cijfer stil optimistischer. */
  const { KETENS } = require('../scripts/ketenvorm');
  assert.ok(KETENS.some(k => k.register === 'ADAMPROEF.json'),
    'scripts/ketenvorm.js kent de adamproef niet; dan meet hij drie ketens en zegt vier');
  const j = lees('KETENVORM.json');
  assert.equal(j.telling.ketens, KETENS.length, 'het register loopt achter op de ketenlijst');
});

test('8. de proeven delen geen module -- de vorm wordt gevonden, niet verklaard', () => {
  for (const naam of ['adamproef', 'ritproef', 'tafelproef', 'toelatingsproef']) {
    const b = fs.readFileSync(path.join(WORTEL, 'scripts', naam + '.js'), 'utf8');
    assert.doesNotMatch(b, /require\(.*(lib\/keten|lib\/ketenvorm|lib\/proefvorm)/,
      naam + ' hangt aan een gedeelde ketenmodule; dan meet ketenvorm.js zijn eigen aanname (de Asset-fout)');
  }
});

test('9. een meting verandert de toestand niet', () => {
  /* Dezelfde eis als bij de ritproef: een zie-functie die schrijft, meet zijn
     eigen ingreep. Hier zijn de schrijfroutes die van de sollicitatiestroom. */
  const { zonderCommentaar } = require('../scripts/lib/bron');
  const kaal = zonderCommentaar(bron);
  const blokken = [...kaal.matchAll(/async \((?:r)?\) => \{([\s\S]*?)return \{/g)].map(m => m[1]);
  assert.ok(blokken.length >= 4, 'geen zie-functies gevonden; dan bewaakt deze toets niets');
  for (const b of blokken)
    assert.doesNotMatch(b, /rtf\/solliciteer|apply\/decide|supplier\/vacature|gezin\/profiel\/maak/,
      'een zie-functie roept een schrijfroute aan; dan meet de proef zijn eigen ingreep');
});
