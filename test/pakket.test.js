/* RTG Bedrijfspakketten: een lid kiest zijn bedrijfstype en krijgt de juiste
   indeling voor de eigen zaak. De catalogus is pure data; de interne
   RTG-kantoorfuncties (afdelingen/boardroom) blijven bedrijfsgeheim en komen
   hier niet voor. Draai los:
   node --experimental-sqlite --test test/pakket.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { typenLijst, advies, TYPEN } = require('../server/kern/pakketten');

test('typen: tech en horeca staan er in elk geval in', () => {
  const ids = typenLijst().map(t => t.id);
  assert.ok(ids.includes('tech'), 'tech-onderneming');
  assert.ok(ids.includes('horeca'), 'horeca-ondernemer');
  assert.ok(ids.length >= 4, 'een echte spreiding aan bedrijfstypen');
  for (const t of typenLijst()) { assert.ok(t.naam && t.kort, 'naam en korte omschrijving'); }
});

test('advies: elk type levert een volledig pakket', () => {
  for (const t of TYPEN) {
    const a = advies(t.id);
    assert.ok(a, t.id);
    assert.ok(a.werkplekken.length >= 3, t.id + ' heeft werkplekken');
    assert.ok(a.apps.length >= 1, t.id + ' heeft werk-apps');
    assert.ok(a.technieken.length >= 3, t.id + ' heeft technieken');
    assert.ok(a.indeling.length >= 3, t.id + ' heeft een plattegrond');
    assert.ok(a.huur && a.huur.kantoor, t.id + ' heeft een huur-advies');
    // elke techniek heeft een naam en uitleg (voor de QR-kaart)
    for (const tk of a.technieken) { assert.ok(tk.id && tk.naam && tk.wat, t.id + ' techniek volledig'); }
  }
});

test('advies: een onbekend type geeft niets', () => {
  assert.equal(advies('bestaatniet'), null);
  assert.equal(advies(''), null);
});

test('beroepsgeheim: de module raakt de interne RTG-kantoorlaag niet aan', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'pakketten.js'), 'utf8');
  assert.ok(!/afdelingen|boardroom/i.test(bron), 'geen verwijzing naar de interne kantoorfuncties');
  // en de teksten lekken geen interne cijfers
  for (const t of TYPEN) {
    const a = advies(t.id);
    const tekst = JSON.stringify(a).toLowerCase();
    assert.ok(!/marge|commissie/.test(tekst), t.id + ' noemt geen marges of commissies');
  }
});
