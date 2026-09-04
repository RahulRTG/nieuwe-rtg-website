/* HET HERSTELQUORUM: klopt de rekenkant, en klopt vooral wat er NIET uit komt.

   Dit is het bestand waar een fout niet opvalt door te falen maar door te
   slagen: een quorum dat met een deel te openen is, doet in elke gewone proef
   precies wat je hoopt. De helft van de beweringen hieronder is daarom negatief.

   Draai los: node --test test/herstelquorum.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const q = require('../server/kern/herstelquorum');

test('1. elk paar van de drie delen herstelt hetzelfde geheim', () => {
  const m = q.munt();
  assert.equal(m.delen.length, 3);
  const [a, b, c] = m.delen;
  const ab = q.quorumSamen(a, b), bc = q.quorumSamen(b, c), ca = q.quorumSamen(c, a);
  assert.ok(ab && bc && ca, 'alle drie de paren leveren een geheim');
  assert.deepEqual(ab, bc, 'paar 1+2 en 2+3 leveren hetzelfde');
  assert.deepEqual(bc, ca, 'en 3+1 ook');
  assert.equal(ab.length, q.BLOK, 'van de afgesproken lengte');
  for (const [x, y] of [[a, b], [b, c], [c, a]])
    assert.equal(q.quorumKlopt(x, y, m.verifier), true, 'en elk paar klopt bij de verifier');
});

test('2. de volgorde van de twee delen doet er niet toe', () => {
  const m = q.munt();
  assert.equal(q.quorumKlopt(m.delen[1], m.delen[0], m.verifier), true);
  assert.equal(q.quorumKlopt(m.delen[2], m.delen[1], m.verifier), true);
});

test('3. hetzelfde deel twee keer is GEEN quorum', () => {
  const m = q.munt();
  for (const d of m.delen) {
    assert.equal(q.quorumSamen(d, d), null, 'twee keer hetzelfde deel levert niets');
    assert.equal(q.quorumKlopt(d, d, m.verifier), false,
      'anders zou een verdubbeld deel op een quorum lijken en is de drempel 1 in plaats van 2');
  }
});

test('4. delen uit twee verschillende quorums passen niet op elkaar', () => {
  const een = q.munt(), twee = q.munt();
  assert.equal(q.quorumKlopt(een.delen[0], twee.delen[1], een.verifier), false);
  assert.equal(q.quorumKlopt(een.delen[0], twee.delen[1], twee.verifier), false);
});

test('5. een verminkt deel wordt geweigerd en werpt nooit', () => {
  const m = q.munt();
  const stuk = [
    '', 'onzin', 'RTGH1-4-' + 'a'.repeat(86), 'RTGH1-1-!!!',
    m.delen[0].slice(0, -4), m.delen[0] + 'AA', m.delen[0].replace('RTGH1', 'RTGH2'),
    null, undefined, 12345, {}
  ];
  for (const s of stuk) {
    assert.doesNotThrow(() => q.leesDeel(s), 'een typefout is geen storing');
    assert.equal(q.leesDeel(s), null, 'en levert niets op: ' + String(s).slice(0, 20));
    assert.equal(q.quorumKlopt(s, m.delen[1], m.verifier), false);
  }
});

test('6. de verifier verraadt het geheim niet, en verschilt per quorum', () => {
  const m = q.munt();
  assert.match(m.verifier, /^[0-9a-f]{64}$/, 'een hex-HMAC en geen sleutelmateriaal');
  const geheim = q.quorumSamen(m.delen[0], m.delen[1]);
  assert.ok(!m.verifier.includes(geheim.toString('hex').slice(0, 16)),
    'het geheim staat er niet letterlijk in');
  assert.notEqual(m.verifier, q.munt().verifier, 'twee quorums delen geen verifier');
  /* En de delen zelf staan er ook niet in -- een verifier is geen vierde deel. */
  for (const d of m.delen) assert.ok(!m.verifier.includes(d.slice(8, 24)));
});

test('7. een enkel deel laat het geheim ONBEPAALD -- de eigenlijke belofte', () => {
  /* Deel 1 draagt (x, y) en mist z. Het geheim is x^y^z, dus voor elke mogelijke
     z bestaat er een geheim. Wie alleen deel 1 heeft en z raadt, moet de
     verifier kunnen halen; dat lukt per definitie alleen met de echte z.

     De toets kan geen informatietheoretisch bewijs leveren -- dat is wiskunde en
     geen meting -- maar hij kan wel het gedrag vastpinnen dat eruit volgt: een
     willekeurige gok voor het derde blok komt er niet doorheen. Zou iemand de
     vorm ooit veranderen zodat een deel meer draagt dan de helft, dan zakt dit. */
  const m = q.munt();
  const echt = q.quorumSamen(m.delen[0], m.delen[1]);
  let raak = 0;
  for (let i = 0; i < 200; i++) {
    const gok = crypto.randomBytes(q.BLOK);
    if (q.verifier(gok) === m.verifier) raak++;
    assert.notDeepEqual(gok, echt);
  }
  assert.equal(raak, 0, 'tweehonderd gokken, nul treffers');
});

test('8. munt() geeft het geheim zelf nooit terug', () => {
  const m = q.munt();
  assert.deepEqual(Object.keys(m).sort(), ['delen', 'verifier'],
    'wie het geheim wil, heeft twee delen nodig -- ook de aanroeper');
});
