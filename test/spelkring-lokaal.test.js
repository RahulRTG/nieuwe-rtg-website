/* DE LOKALE ONDERNEMERSKRING -- wie hier ooit een zaak had.

   Fase D. De naam trekt twee dingen aan die geen van beide mogen, en de meeste
   beweringen hieronder gaan daarover.

   Acht beweringen, en ze zijn alle acht stil terug te draaien:

   1. HIJ IS GEEN CONTACTENLIJST. Een potje geeft geen nieuw recht om iemand te
      bereiken -- die regel staat in kring.js en deze laag omzeilt hem niet.
   2. HIJ IS GEEN RANGLIJST. Geen bedrag, geen aantal-als-score, en de volgorde
      is de tijd en niet de prestatie.
   3. DE 18+-POORT GELDT, per persoon -- want hier staat wel een persoon in, en
      dat is het verschil met het stadsgeheugen.
   4. WIE HIER GEEN ZAAK HAD, KOMT NIET OP HET BORD.
   5. HET WORDT EEN KEER OPGESCHREVEN, ook als de partij twee keer afsluit.
   6. HIJ SLIJT OP DE KLOK VAN DE STAD en niet op de kalender.
   7. WIE STOPT GAAT VAN HET BORD; zijn eigen kant verdwijnt met hem.
   8. WIE ZIJN ZAAK DOORGAF STAAT EROP, ook al heeft hij aan het eind niets.

   Draai los: node --experimental-sqlite --test test/spelkring-lokaal.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const maakKring = require('../server/kern/spellen/ondernemerskring');

function opstelling(volwassenen) {
  const db = { data: {} };
  const groep = new Set(volwassenen || ['anna', 'boris', 'chris']);
  const K = maakKring({ db, save() {}, progressieMag: (h) => groep.has(h),
    GEEN_PROGRESSIE: 'Alleen voor 18-plus.' });
  return { db, K, cn: (h) => 'CN-' + h };
}
const potje = (vestigingen, uit, id = 'p1') => ({ id, status: 'klaar',
  spelers: Object.keys(vestigingen), variant: { stad: 'IJmuiden' },
  staat: { vestigingen, uit: uit || {} } });

/* ================= 1. geen contactenlijst ================= */

test('het bord geeft geen enkele manier om iemand te bereiken', () => {
  /* DE BELANGRIJKSTE TOETS VAN DEZE LAAG. kring.js zegt: een potje geeft geen
     nieuw recht om iemand te bereiken, want de wachtrij koppelt willekeurige
     spelers en de RTF-app bevat tieners die met opzet onvindbaar zijn. */
  const { K, cn } = opstelling();
  K.noteerKring(potje({ anna: [{ sector: 'horeca' }], boris: [{ sector: 'retail' }] }), cn);
  const b = K.beeld('IJmuiden', 'anna', cn);
  /* De uitleg BENOEMT wat hij niet is, dus die hoort er bij het scannen uit --
     anders zakt de toets op zijn eigen disclaimer. */
  const tekst = JSON.stringify(Object.assign({}, b, { uitleg: '' })).toLowerCase();
  for (const woord of ['uitnodig', 'bericht', 'chat', 'gesprek', 'vriend', 'handle', 'volgen'])
    assert.ok(!tekst.includes(woord), 'het bord biedt ' + woord);
  for (const l of b.leden) assert.deepEqual(Object.keys(l).sort(),
    ['campagnes', 'codenaam', 'doorgegeven', 'ik', 'sectoren'], 'geen veld waarmee je iemand aanspreekt');
  assert.match(b.uitleg, /geen contactenlijst/);
  /* En de module kent het begrip niet eens. */
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/ondernemerskring.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/'[^']*'/g, "''");
  for (const woord of ['zijnVrienden', 'sseToCustomer', 'chatStuur', 'gesprekMaak', 'nudge'])
    assert.ok(!bron.includes(woord), 'ondernemerskring.js raakt ' + woord + ' aan');
});

test('er staan codenamen op en geen handles', () => {
  const { K, cn } = opstelling();
  K.noteerKring(potje({ anna: [{ sector: 'horeca' }] }), cn);
  const b = K.beeld('IJmuiden', 'anna', cn);
  assert.equal(b.leden[0].codenaam, 'CN-anna');
  assert.ok(!JSON.stringify(b).includes('"anna"'), 'de handle hoort er niet in te staan');
});

/* ================= 2. geen ranglijst ================= */

test('er staat geen bedrag op en de volgorde is de tijd, niet de prestatie', () => {
  const { K, cn } = opstelling();
  /* Chris begint als eerste, anna als laatste -- met de grootste zaak. */
  K.noteerKring(potje({ chris: [{ sector: 'horeca' }] }, {}, 'p1'), cn);
  K.noteerKring(potje({ boris: [{ sector: 'retail' }] }, {}, 'p2'), cn);
  K.noteerKring(potje({ anna: [{ sector: 'hotel' }, { sector: 'hotel' }, { sector: 'hotel' }] }, {}, 'p3'), cn);
  const b = K.beeld('IJmuiden', null, cn);
  assert.deepEqual(b.leden.map(l => l.codenaam), ['CN-chris', 'CN-boris', 'CN-anna'],
    'oudste eerst: een geschiedenis en geen wedstrijd');
  const tekst = JSON.stringify(Object.assign({}, b, { uitleg: '' }));
  assert.ok(!/\d{4,}/.test(tekst), 'geen bedragen: ' + tekst);
  for (const woord of ['vermogen', 'omzet', 'winst', 'plaats', 'rang', 'score'])
    assert.ok(!tekst.includes(woord), 'het bord noemt ' + woord);
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/ondernemerskring.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  for (const veld of ['geld', 'vermogen', 'omzet'])
    assert.ok(!bron.includes(veld), 'ondernemerskring.js leest ' + veld);
});

/* ================= 3. de grens, per persoon ================= */

test('onder de achttien komt er niets op het bord, en de rest wel', () => {
  const { K, cn } = opstelling(['anna']);        // alleen anna is volwassen
  K.noteerKring(potje({ anna: [{ sector: 'horeca' }], boris: [{ sector: 'retail' }] }), cn);
  const b = K.beeld('IJmuiden', null, cn);
  assert.deepEqual(b.leden.map(l => l.codenaam), ['CN-anna'], 'de grens geldt per PERSOON');
});

test('hij kent de poort echt, en dat is het verschil met het stadsgeheugen', () => {
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/ondernemerskring.js'), 'utf8');
  assert.ok(bron.includes('progressieMag'), 'hier staat wel een persoon in, dus geldt de poort');
  /* Het stadsgeheugen NOEMT de poort in zijn kop -- om uit te leggen waarom hij
     er buiten valt -- maar gebruikt hem nergens. Dat is het verschil, en het is
     de code en niet het commentaar die het waarmaakt. */
  const stad = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/stadsgeheugen.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!stad.includes('progressieMag'), 'en daar niet, want daar staat er geen in');
});

/* ================= 4, 5, 8. wie er op komt ================= */

test('wie hier geen zaak had, komt niet op het bord', () => {
  const { K, cn } = opstelling();
  K.noteerKring(potje({ anna: [{ sector: 'horeca' }], boris: [] }), cn);
  assert.deepEqual(K.beeld('IJmuiden', null, cn).leden.map(l => l.codenaam), ['CN-anna']);
});

test('wie zijn zaak doorgaf staat erop, ook al heeft hij aan het eind niets', () => {
  /* De valkuil: aan het eind van de campagne heeft een vertrekker nul
     vestigingen, en dan zou juist de mens uit hoofdstuk 9 van het bord vallen. */
  const { K, cn } = opstelling();
  K.noteerKring(potje({ anna: [], boris: [{ sector: 'horeca' }] },
    { anna: { maand: 20, naar: 'boris', overgedragen: 2 } }), cn);
  const namen = K.beeld('IJmuiden', null, cn).leden;
  assert.equal(namen.length, 2);
  assert.equal(namen.find(l => l.codenaam === 'CN-anna').doorgegeven, true);
  assert.equal(namen.find(l => l.codenaam === 'CN-boris').doorgegeven, false);
});

test('een partij komt maar een keer op het bord', () => {
  const { K, cn } = opstelling();
  const p = potje({ anna: [{ sector: 'horeca' }] });
  assert.ok(K.noteerKring(p, cn));
  assert.equal(K.noteerKring(p, cn), null, 'de tweede keer gebeurt er niets');
  assert.equal(K.beeld('IJmuiden', null, cn).potjes, 1);
});

test('twee campagnes in dezelfde stad geven een regel en niet twee', () => {
  const { K, cn } = opstelling();
  K.noteerKring(potje({ anna: [{ sector: 'horeca' }] }, {}, 'p1'), cn);
  K.noteerKring(potje({ anna: [{ sector: 'hotel' }] }, {}, 'p2'), cn);
  const l = K.beeld('IJmuiden', null, cn).leden;
  assert.equal(l.length, 1);
  assert.equal(l[0].campagnes, 2);
  assert.deepEqual(l[0].sectoren.sort(), ['horeca', 'hotel'], 'wat hij deed komt erbij');
});

test('een campagne zonder stad hoort bij geen enkel bord', () => {
  const { K, cn } = opstelling();
  const p = potje({ anna: [{ sector: 'horeca' }] });
  p.variant = { vorm: 'bord' };
  assert.equal(K.noteerKring(p, cn), null);
});

/* ================= 6. slijten op de klok van de stad ================= */

test('een naam zakt van het bord na genoeg campagnes, niet na genoeg dagen', () => {
  const { K, db, cn } = opstelling();
  K.noteerKring(potje({ anna: [{ sector: 'horeca' }] }, {}, 'p1'), cn);
  assert.equal(K.beeld('IJmuiden', null, cn).leden.length, 1);
  /* De stad speelt door zonder haar. */
  for (let i = 0; i < maakKring.SLIJTAGE_POTJES; i++)
    K.noteerKring(potje({ boris: [{ sector: 'retail' }] }, {}, 'q' + i), cn);
  const namen = K.beeld('IJmuiden', null, cn).leden.map(l => l.codenaam);
  assert.ok(!namen.includes('CN-anna'), 'na genoeg campagnes is ze van het bord');
  assert.ok(namen.includes('CN-boris'), 'en wie meedeed staat er nog');
  /* En het is echt de klok van de STAD: er staat geen datum in de opslag. */
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(JSON.stringify(db.data.ondernemerskring)),
    'geen kalender in de opslag');
});

test('elke stad heeft zijn eigen bord', () => {
  const { K, cn } = opstelling();
  const p = potje({ anna: [{ sector: 'horeca' }] }, {}, 'p1');
  K.noteerKring(p, cn);
  const q = potje({ boris: [{ sector: 'retail' }] }, {}, 'p2');
  q.variant = { stad: 'Zandvoort' };
  K.noteerKring(q, cn);
  assert.deepEqual(K.beeld('IJmuiden', null, cn).leden.map(l => l.codenaam), ['CN-anna']);
  assert.deepEqual(K.beeld('Zandvoort', null, cn).leden.map(l => l.codenaam), ['CN-boris']);
  assert.deepEqual(K.beeld('Atlantis', null, cn).leden, [], 'een stad zonder bord is leeg en niet stuk');
});

/* ================= 7. wie stopt ================= */

test('wie stopt gaat van elk bord af', () => {
  const { K, cn } = opstelling();
  K.noteerKring(potje({ anna: [{ sector: 'horeca' }], boris: [{ sector: 'retail' }] }), cn);
  const r = K.stoptErmee('CN-anna');
  assert.equal(r.weg, 1);
  assert.deepEqual(K.beeld('IJmuiden', null, cn).leden.map(l => l.codenaam), ['CN-boris'],
    'zijn eigen kant verdwijnt met hem, die van de ander blijft');
});

test('je ziet op het bord welke naam van jou is', () => {
  const { K, cn } = opstelling();
  K.noteerKring(potje({ anna: [{ sector: 'horeca' }], boris: [{ sector: 'retail' }] }), cn);
  const b = K.beeld('IJmuiden', 'boris', cn);
  assert.equal(b.ik, 'CN-boris');
  assert.equal(b.leden.find(l => l.codenaam === 'CN-boris').ik, true);
  assert.equal(b.leden.find(l => l.codenaam === 'CN-anna').ik, false);
  /* Maar een tiener ziet zichzelf er niet op, want hij staat er niet op. */
  const jong = opstelling([]);
  jong.K.noteerKring(potje({ anna: [{ sector: 'horeca' }] }), jong.cn);
  assert.equal(jong.K.beeld('IJmuiden', 'anna', jong.cn).ik, null);
});
