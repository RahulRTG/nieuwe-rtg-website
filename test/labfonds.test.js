/* Het Lab-fonds (kern/labfonds.js): leden zamelen in voor het RTF Onderzoekslab,
   per locatie verdeeld, en beslissen gezamenlijk met de AI-scheidsrechter.
   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

function maak() {
  const db = { data: {} };
  return require('../server/kern/labfonds')({ db, save: () => {}, crypto, anthropic: null }).labfonds;
}

test('inzamelen per locatie + voorstel met steun van de scheidsrechter + gezamenlijk toekennen', () => {
  const lf = maak();
  assert.ok(lf.fonds('lid1').locaties.find(l => l.id === 'ibiza'), 'startlocatie Ibiza bestaat');

  const d = lf.doneer('lid1', 'Amber', 'ibiza', 1000);
  assert.equal(d.ok, true);
  assert.equal(d.locatie.pot, 1000);
  assert.equal(lf.fonds('lid1').mijnBijdrage, 1000);

  const v = lf.voorstelMaak('lid1', 'Amber', 'ibiza', 'Zonnepanelen strandtent',
    'Zonnepanelen op de gemeenschappelijke strandtent zodat de hele omgeving groener wordt.', 400);
  assert.equal(v.ok, true);
  assert.equal(v.voorstel.scheids.oordeel, 'steun');

  lf.stem('lid2', v.voorstel.id, 'voor');
  const b = lf.beslis(v.voorstel.id);
  assert.equal(b.voorstel.status, 'toegekend');
  assert.equal(b.locatie.pot, 600);
  assert.equal(b.locatie.uitgekeerd, 400);
});

test('de scheidsrechter raadt privaat gewin af', () => {
  const lf = maak();
  lf.doneer('a', 'A', 'amsterdam', 100);
  const v = lf.voorstelMaak('a', 'A', 'amsterdam', 'Iets voor mezelf', 'Ik wil dit prive voor mezelf gebruiken.', 50);
  assert.equal(v.voorstel.scheids.oordeel, 'afraden');
  assert.equal(lf.beslis(v.voorstel.id).voorstel.status, 'afgewezen');
});

test('meer dan de pot kan niet', () => {
  const lf = maak();
  lf.doneer('l', 'L', 'rotterdam', 10);
  const v = lf.voorstelMaak('l', 'L', 'rotterdam', 'Groot buurtplan', 'Een mooi plan voor het hele park en de omgeving.', 999);
  assert.equal(v.voorstel.scheids.oordeel, 'afraden');
  assert.equal(lf.beslis(v.voorstel.id).voorstel.status, 'afgewezen');
});

test('boardroom ziet het hele fonds', () => {
  const lf = maak();
  lf.doneer('x', 'X', 'ibiza', 20);
  const br = lf.boardroom();
  assert.equal(br.ok, true);
  assert.ok(br.locaties.length >= 3);
});
