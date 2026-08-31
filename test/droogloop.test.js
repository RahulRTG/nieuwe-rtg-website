/* De droogloop beproefd op zijn twee eigen aannames: dat hij het VERSCHIL ziet,
   en dat hij huishouding van domein scheidt. Niet op de server -- die draait in
   het instrument zelf en kost een minuut; hier staan de twee functies waar de
   uitslag op leunt, plus de vorm van het register dat hij schrijft.

   Elke toets hieronder is een keer met opzet laten zakken (LAT.md regel 2); waar
   dat iets opleverde, staat het erbij. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { verschil, isSpoor, SPOREN, STANDAARDPLAN } = require('../scripts/droogloop');

test('1 verschil noemt alleen wat werkelijk bewoog', () => {
  const d = verschil({ a: '1/10', b: '2/20' }, { a: '1/10', b: '3/25' });
  assert.deepStrictEqual(d, ['b']);
});

test('2 een collectie die erbij komt of verdwijnt telt ook', () => {
  assert.deepStrictEqual(verschil({ a: 1 }, { a: 1, nieuw: 0 }), ['nieuw']);
  assert.deepStrictEqual(verschil({ a: 1, weg: 3 }, { a: 1 }), ['weg']);
});

/* MUTATIE. De eerste versie las db.json, dat in een verse datamap NIET bestaat,
   en gaf dan `null` -- waarop de droogloop stil "0 collecties" meldde terwijl er
   een agenda-item bij kwam. Een beeld dat er niet is, mag nooit als "er
   veranderde niets" langskomen; daarom geeft verschil() dan null en geen []. */
test('3 zonder beeld is de uitslag niet-te-zeggen en geen lege lijst', () => {
  assert.strictEqual(verschil(null, { a: 1 }), null);
  assert.strictEqual(verschil({ a: 1 }, null), null);
});

/* MUTATIE. Haal `ver` uit het beeld en tel alleen rijen: dan bewoog kv nooit.
   Deze toets houdt vast dat een gelijk aantal met een andere versie WEL telt. */
test('4 een gelijk gebleven lengte met een nieuwe versie telt als beweging', () => {
  assert.deepStrictEqual(verschil({ 'store.db:agendas': '4/120' }, { 'store.db:agendas': '5/120' }),
    ['store.db:agendas']);
});

test('5 de huishoudsporen worden herkend, met of zonder bestandsvoorvoegsel', () => {
  assert.ok(isSpoor('apiSpoor'));
  assert.ok(isSpoor('store.db:handelingLog'));
  assert.ok(!isSpoor('store.db:agendas'));
  /* geen prefixtreffer: een collectie die met een spoornaam BEGINT is niet dat spoor */
  assert.ok(!isSpoor('store.db:apiSpoorArchief'));
});

test('6 de sporenlijst is niet leeg en bevat geen domeincollectie', () => {
  assert.ok(SPOREN.length >= 3);
  assert.ok(!SPOREN.includes('agendas'), 'agendas is een gevolg van de handeling, geen huishouding');
});

test('7 het standaardplan noemt alleen paden en geen HTTP-werkwoord of host', () => {
  for (const s of STANDAARDPLAN.stappen) {
    assert.match(s.capability, /^\/api\//);
    assert.ok(!/https?:/.test(s.capability));
  }
});

/* De uitslag is een register en wordt gelezen; zakt deze toets, dan is hij van
   vorm veranderd zonder dat iemand het merkte. */
test('8 DROOGLOOP.json draagt zijn grenzen en telt onbekend niet als goed', () => {
  const b = path.join(__dirname, '..', 'DROOGLOOP.json');
  if (!fs.existsSync(b)) return; // nog niet gedraaid: dat is geen fout van deze toets
  const u = JSON.parse(fs.readFileSync(b, 'utf8'));
  assert.ok(u.grenzen.length >= 4);
  assert.ok(u.telling.voorspellingBeoordeeld + u.telling.voorspellingOnbekend === u.telling.stappen,
    'elke stap is beoordeeld of uitdrukkelijk onbeoordeeld; er valt er geen tussenuit');
  assert.ok(u.telling.voorspellingKlopt <= u.telling.voorspellingBeoordeeld);
  for (const s of u.stappen) {
    assert.ok(Array.isArray(s.domein) && Array.isArray(s.sporen));
    assert.strictEqual(s.domein.length + s.sporen.length, s.gewijzigd.length);
  }
});

/* MUTATIE DIE NIET BEET. Toets 4 hield vast dat een gelijke lengte met een
   nieuwe versie meetelt, maar toetste `verschil` -- niet het BEELD. Haalde je
   `ver` uit opslagBeeld weg, dan bleef de hele suite groen terwijl kv weer
   onzichtbaar werd. Deze toets bouwt daarom een echte kv-tabel en schrijft
   dezelfde waarde met een hoger versienummer terug. */
test('9 het beeld ziet een schrijfronde die de lengte niet verandert', () => {
  const { DatabaseSync } = require('node:sqlite');
  const os = require('os');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-droogloop-toets-'));
  const db = new DatabaseSync(path.join(map, 'store.db'));
  db.exec('CREATE TABLE kv (key TEXT PRIMARY KEY, val TEXT, ver INTEGER NOT NULL DEFAULT 0)');
  db.exec("INSERT INTO kv VALUES ('agendas','[1,2]',4)");
  const { opslagBeeld } = require('../scripts/droogloop');
  const voor = opslagBeeld(map);
  db.exec("UPDATE kv SET val='[3,4]', ver=5 WHERE key='agendas'");
  const na = opslagBeeld(map);
  db.close();
  fs.rmSync(map, { recursive: true, force: true });
  assert.deepStrictEqual(verschil(voor, na), ['store.db:agendas'],
    'gelijke lengte, andere inhoud: zonder het versienummer is dit onzichtbaar');
});
