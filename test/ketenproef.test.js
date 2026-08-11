/* DE KETENPROEF (scripts/lib/ketenproef.js) -- de acht velden en de zevenstappenlat.

   WAAROM DIT LOS GETOETST WORDT. De ketenronde start twaalf servers en duurt
   minuten; daar komt nooit een mutatie bij. Maar de REGELS die van ruwe
   waarnemingen een oordeel maken, zijn precies waar een fout onzichtbaar in kan
   zitten -- en dat is hier ook meteen gebeurd: de eerste versie van
   isStilVerlies() liet het ergste geval erlangs.

   Draai los: node --test test/ketenproef.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { beoordeel, isStilVerlies, voldoetAanLat, LAT,
  GEEN, TERUGGEDRAAID, BLIJVEND } = require('../scripts/lib/ketenproef');

const schoon = { schrijfStatus: 200, zichtbaarVoorHerstart: true, blijftNaHerstart: true,
  ledgerKlopt: true, auditSpoor: true, retryGafTweedeEffect: false, startteOp: true };
const oordeel = (met, extra) => beoordeel({ schoon, met: { ...schoon, ...met },
  verraadSloegToe: true, herhaalbaar: true, ...extra });

/* ---------- de drie toestanden ---------- */

test('blijft na herstart = BLIJVEND', () => {
  assert.equal(oordeel({}).toestandWijziging, BLIJVEND);
});

test('wel gezien, na herstart weg = TERUGGEDRAAID', () => {
  assert.equal(oordeel({ blijftNaHerstart: false }).toestandWijziging, TERUGGEDRAAID);
});

test('nooit gezien en niets over = GEEN', () => {
  assert.equal(oordeel({ zichtbaarVoorHerstart: false, blijftNaHerstart: false }).toestandWijziging, GEEN);
});

/* ---------- stil verlies: de ergste uitkomst ---------- */

test('OK met niets blijvend is STIL VERLIES -- ook als het even zichtbaar was', () => {
  /* Dit is de fout die de eerste ronde blootlegde. De eerste versie eiste
     toestandWijziging === GEEN, en liet TERUGGEDRAAID erlangs -- terwijl dat
     precies het geval is: de gebruiker kreeg een bevestiging en is zijn werk
     kwijt. */
  const o = oordeel({ schrijfStatus: 200, blijftNaHerstart: false });
  assert.equal(o.clientAntwoord, 'OK');
  assert.equal(o.toestandWijziging, TERUGGEDRAAID);
  assert.equal(isStilVerlies(o), true);
});

test('OK met niets gebeurd is ook STIL VERLIES', () => {
  assert.equal(isStilVerlies(oordeel({ zichtbaarVoorHerstart: false, blijftNaHerstart: false })), true);
});

test('FAIL met niets blijvend is GEEN stil verlies maar een nette weigering', () => {
  const o = oordeel({ schrijfStatus: 500, zichtbaarVoorHerstart: false, blijftNaHerstart: false });
  assert.equal(isStilVerlies(o), false);
  assert.equal(o.rollback, 'PROVEN');
});

test('OK met een blijvende wijziging is gewoon goed', () => {
  assert.equal(isStilVerlies(oordeel({})), false);
});

/* ---------- rollback ---------- */

test('rollback is PROVEN als de aanroeper nee kreeg en er niets bleef staan', () => {
  assert.equal(oordeel({ schrijfStatus: 503, blijftNaHerstart: false }).rollback, 'PROVEN');
});

test('rollback is NIET als de aanroeper nee kreeg en het toch blijft staan', () => {
  /* De handler schreef en meldde daarna een fout. Statuscode klopt, database niet. */
  assert.equal(oordeel({ schrijfStatus: 500, blijftNaHerstart: true }).rollback, 'NIET');
});

test('rollback is NVT bij een geslaagd antwoord -- daar valt niets terug te draaien', () => {
  /* Zou hier PROVEN staan, dan telt elke geslaagde oproep mee als bewijs van een
     werkende rollback, en dat getal is dan niets waard. */
  assert.equal(oordeel({ schrijfStatus: 200 }).rollback, 'NVT');
});

/* ---------- client-antwoord ---------- */

test('een verzoek dat niet aankwam telt als FAIL', () => {
  /* Status 0: de server lag. Voor de aanroeper is dat geen bevestiging, en dat
     is wat telt. */
  assert.equal(oordeel({ schrijfStatus: 0 }).clientAntwoord, 'FAIL');
  assert.equal(oordeel({ schrijfStatus: null }).clientAntwoord, 'FAIL');
});

test('204 telt als OK', () => {
  assert.equal(oordeel({ schrijfStatus: 204 }).clientAntwoord, 'OK');
});

/* ---------- ongemeten blijft ongemeten ---------- */

test('een niet-gemeten invariant heet ONGEMETEN en niet GELDIG', () => {
  const o = oordeel({ ledgerKlopt: null, auditSpoor: null, retryGafTweedeEffect: null });
  assert.equal(o.ledgerInvariant, 'ONGEMETEN');
  assert.equal(o.audit, 'ONGEMETEN');
  assert.equal(o.retryVeilig, 'ONGEMETEN');
});

test('een gebroken grootboek heet GEBROKEN', () => {
  assert.equal(oordeel({ ledgerKlopt: false }).ledgerInvariant, 'GEBROKEN');
});

/* ---------- de zevenstappenlat ---------- */

test('een volledig gemeten scenario haalt de lat', () => {
  const uit = voldoetAanLat(oordeel({ blijftNaHerstart: false, schrijfStatus: 500 }));
  assert.equal(uit.voldoet, true, 'mist: ' + uit.ontbreekt.join(', '));
});

test('een verraad dat niet toesloeg, haalt de lat niet', () => {
  const o = beoordeel({ schoon, met: schoon, verraadSloegToe: false, herhaalbaar: true });
  const uit = voldoetAanLat(o);
  assert.equal(uit.voldoet, false);
  assert.ok(uit.ontbreekt.includes('aantoonbaar toegeslagen'));
});

test('een onzichtbaar verraad haalt de lat niet', () => {
  const uit = voldoetAanLat(oordeel({}));   // niets wijkt af van schoon
  assert.equal(uit.voldoet, false);
  assert.ok(uit.ontbreekt.includes('zichtbaar'));
});

test('een onherhaalbaar scenario haalt de lat niet', () => {
  const o = beoordeel({ schoon, met: { ...schoon, blijftNaHerstart: false },
    verraadSloegToe: true, herhaalbaar: false });
  assert.ok(voldoetAanLat(o).ontbreekt.includes('reproduceerbaar'));
});

test('zonder enige invariantmeting haalt een scenario de lat niet', () => {
  /* Zichtbaar en herhaalbaar is niet genoeg: als niemand naar het grootboek of
     het auditspoor heeft gekeken, is er geen uitspraak over de veiligheid. */
  const o = oordeel({ blijftNaHerstart: false, schrijfStatus: 500,
    ledgerKlopt: null, auditSpoor: null });
  assert.ok(voldoetAanLat(o).ontbreekt.includes('invariant beoordeeld'));
});

test('de lat heeft precies de zeven stappen die zijn afgesproken', () => {
  assert.deepEqual(LAT.map(l => l.stap), ['injecteerbaar', 'aantoonbaar toegeslagen',
    'zichtbaar', 'reproduceerbaar', 'businessuitkomst gemeten', 'invariant beoordeeld',
    'rollback beoordeeld']);
});

test('wat ontbreekt is een werklijst en geen enkel woord', () => {
  const o = beoordeel({ schoon, met: schoon, verraadSloegToe: false, herhaalbaar: false });
  const uit = voldoetAanLat(o);
  assert.ok(uit.ontbreekt.length >= 3, 'een scenario dat niets haalt hoort alles op te sommen');
});
