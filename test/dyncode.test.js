/* Dynamische gesloten RTG-code (kern/dyncode.js): kort houdbare, HMAC-onder-
   tekende tokens die alleen ons systeem maakt en verifieert. npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function maakModule() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dyncode-'));
  return require('../server/kern/dyncode')({ crypto, dataDir: dir });
}

test('een verse code round-trip: soort en code komen terug', () => {
  const dc = maakModule();
  const c = dc.maak({ soort: 'kas', code: 'A1B2C3', ttlMs: 5000 });
  assert.ok(c.token.startsWith('RTG1.'), 'draagt het RTG1-voorvoegsel');
  const r = dc.lees(c.token);
  assert.equal(r.ok, true);
  assert.equal(r.soort, 'kas');
  assert.equal(r.code, 'A1B2C3');
});

test('een vreemde (niet-RTG1) tekst wordt geweigerd', () => {
  const dc = maakModule();
  assert.equal(dc.lees('https://voorbeeld/iets').ok, false);
  assert.equal(dc.lees('rtg:kas:ABC').ok, false);
  assert.equal(dc.lees('').ok, false);
});

test('geknoei aan de handtekening of body wordt betrapt', () => {
  const dc = maakModule();
  const c = dc.maak({ soort: 'entree', code: 'IBIZA', ttlMs: 5000 });
  assert.equal(dc.lees(c.token.slice(0, -2) + 'zz').ok, false, 'kapotte handtekening');
  const p = c.token.split('.');
  const anderBody = Buffer.from('kas|GRATIS|zzzzz|0000').toString('base64url');
  assert.equal(dc.lees('RTG1.' + anderBody + '.' + p[2]).ok, false, 'body vervangen -> handtekening klopt niet');
});

test('een code van een ANDERE sleutel (andere node) wordt geweigerd', () => {
  const a = maakModule(), b = maakModule();     // twee losse sleutels
  const c = a.maak({ soort: 'kas', code: 'X', ttlMs: 5000 });
  assert.equal(b.lees(c.token).ok, false, 'alleen de eigen node verifieert de eigen code');
});

test('een verlopen code wordt geweigerd (dynamisch)', () => {
  const dc = maakModule();
  const c = dc.maak({ soort: 'pas', code: 'Q', ttlMs: 1000 });
  const echt = Date.now;
  try {
    Date.now = () => c.exp + 1;                  // tijd voorbij het verval
    const r = dc.lees(c.token);
    assert.equal(r.ok, false);
    assert.equal(r.reden, 'verlopen');
  } finally { Date.now = echt; }
});

test('onbekende soort kan niet gemaakt worden', () => {
  const dc = maakModule();
  assert.throws(() => dc.maak({ soort: 'geheim', code: 'x' }));
});
