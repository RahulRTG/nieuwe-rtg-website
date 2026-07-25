/* De rekenmotor van RTG Office. Deze draait in de browser, dus we laden het
   bestand hier los in en rekenen erop -- zonder server, zonder scherm.

   Waarom deze test bestaat: de motor rekende eerder met Function(), en dat
   werkt in Node prima maar niet in de browser, waar de beveiligingsregels van
   de app het uitvoeren van tekst als code (terecht) blokkeren. Elke formule
   gaf daardoor #FOUT op het scherm terwijl alles hier groen stond. De motor
   rekent nu zelf; deze test bewaakt dat er nooit meer een eval in sluipt.
   Draai los: node --experimental-sqlite --test test/office-blad.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const BRON = path.join(__dirname, '..', 'public', 'apps', 'office', 'blad.js');

function maakBlad(inhoud) {
  const zaal = {};
  global.window = zaal;
  global.document = { querySelector() { return null; }, addEventListener() {} };
  delete require.cache[require.resolve(BRON)];
  require(BRON);
  const stuk = () => ({ textContent: '', value: '', disabled: false,
    addEventListener() {}, focus() {}, select() {} });
  const b = zaal.RTGOfficeBlad.maak({
    tabel: { innerHTML: '', querySelectorAll: () => [], querySelector: () => null },
    refVak: stuk(), invoer: stuk(), voet: stuk(), onWijzig() {}
  });
  b.laad(inhoud, true);
  return b;
}
/* De csv-uitvoer terug uitpakken naar cellen: precies wat een mens in het
   blad ziet, per rij en per kolom. */
function cellen(b) {
  return b.naarCsv().split('\n').map(r => r.replace(/^"|"$/g, '').split('","'));
}
const kolom = (b, i) => cellen(b).map(r => r[i]);
const kolomA = b => kolom(b, 0);

test('1. de motor rekent zonder eval; er staat geen Function-aanroep meer in', () => {
  const bron = fs.readFileSync(BRON, 'utf8');
  assert.ok(!/\beval\s*\(/.test(bron), 'geen eval in de rekenmotor');
  assert.ok(!/\bnew\s+Function\s*\(|[^.\w]Function\s*\(\s*['"]/.test(bron),
    'en geen Function() die tekst als code draait');
});

test('2. rekenkunde, voorrang en haakjes', () => {
  const b = maakBlad({ cellen: {
    A1: '=2+3*4', A2: '=(2+3)*4', A3: '=10/4', A4: '=-3+1', A5: '=2*(3+(4-1))'
  }, opmaak: {}, rijen: 5, kolommen: 1 });
  assert.deepEqual(kolomA(b), ['14', '20', '2.5', '-2', '12']);
});

test('3. celverwijzingen en de bereikfuncties', () => {
  const b = maakBlad({ cellen: {
    A1: '10', A2: '20', A3: '30',
    B1: '=SOM(A1:A3)', B2: '=GEM(A1:A3)', B3: '=MIN(A1:A3)', B4: '=MAX(A1:A3)',
    B5: '=AANTAL(A1:A3)', B6: '=A1+A2*2'
  }, opmaak: {}, rijen: 6, kolommen: 2 });
  const kolomB = b.naarCsv().split('\n').map(r => r.split('","')[1].replace(/"$/, ''));
  assert.deepEqual(kolomB, ['60', '20', '10', '30', '3', '50']);
});

test('4. AFRONDEN en ALS, met tekst die zijn hoofdletters houdt', () => {
  const b = maakBlad({ cellen: {
    A1: '=AFRONDEN(10/3;2)', A2: '=ALS(5>3;"Boven";"Onder")', A3: '=ALS(5<3;"Boven";"Onder")',
    A4: '=ALS(2=2;10;20)'
  }, opmaak: {}, rijen: 4, kolommen: 1 });
  assert.deepEqual(kolomA(b), ['3.33', 'Boven', 'Onder', '10']);
});

test('5. de motor houdt zich staande bij onzin', () => {
  const b = maakBlad({ cellen: {
    A1: '=1/0', A2: '=alert(1)', A3: '=)(', A4: '=A4', A5: '=SOM(B1:B2'
  }, opmaak: {}, rijen: 5, kolommen: 1 });
  const uit = kolomA(b);
  assert.equal(uit[0], '#DEEL/0', 'delen door nul heeft een eigen melding');
  assert.equal(uit[1], '#FOUT', 'een functieaanroep is gewoon fout, geen code');
  assert.equal(uit[2], '#FOUT');
  assert.equal(uit[3], '#LUS', 'een cel die naar zichzelf wijst loopt niet vast');
  assert.equal(uit[4], '#FOUT', 'een half getypte formule is gewoon fout');

  // en een fout reist mee omhoog: een som over een kapotte cel liegt niet
  const c = maakBlad({ cellen: { A1: '=1/0', A2: '=SOM(A1:A1)' }, opmaak: {}, rijen: 2, kolommen: 1 });
  assert.equal(kolomA(c)[1], '#DEEL/0', 'de melding komt uit de cel eronder mee');
});

test('6. de opmaak maakt van een uitkomst een leesbaar bedrag', () => {
  const b = maakBlad({ cellen: { A1: '1234.5', A2: '=A1*2', A3: '0.215', A4: '-99' },
    opmaak: { A1: 'geld', A2: 'geld', A3: 'procent', A4: 'geld' }, rijen: 4, kolommen: 1 });
  assert.deepEqual(kolomA(b), ['€ 1.234,50', '€ 2.469,00', '21,5%', '-€ 99,00']);
});
