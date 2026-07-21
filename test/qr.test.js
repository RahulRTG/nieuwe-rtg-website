/* RTG QR-codec (public/shared/qr.js): eigen QR encode + decode. Getoetst met
   (1) een externe grondwaarheid -- de Reed-Solomon EC-codewoorden van het ISO-
   voorbeeld "01234567" -- en (2) een encode->decode round-trip over veel invoer
   en lengtes, wat meerdere QR-versies afdwingt. Zonder scanner is dit de manier
   om de codec waterdicht te controleren.
   Draai los: node --experimental-sqlite --test test/qr.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const QR = require('../public/shared/qr');

test('1. Reed-Solomon: bekende ISO-vector "01234567" (v1-M) klopt op de byte', () => {
  // de 16 data-codewoorden van "01234567" op versie 1, niveau M (uit de spec)
  const data = [16, 32, 12, 86, 97, 128, 236, 17, 236, 17, 236, 17, 236, 17, 236, 17];
  const ec = QR.rsEC(data, 10);
  assert.deepEqual(ec, [165, 36, 212, 193, 237, 54, 199, 135, 44, 85], 'EC-codewoorden gelijk aan de spec');
});

test('2. round-trip byte-modus over vele lengtes (dwingt meerdere versies af)', () => {
  const alfabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.';
  for (const lvl of ['L', 'M']) {
    for (let len = 1; len <= 200; len += 17) {
      let s = '';
      for (let i = 0; i < len; i++) s += alfabet[(i * 7 + len) % alfabet.length];
      const qr = QR.encode(s, { ecc: lvl });
      const terug = QR.decode(qr);
      assert.equal(terug.tekst, s, 'round-trip len=' + len + ' niveau=' + lvl + ' (v' + qr.versie + ')');
    }
  }
});

test('3. round-trip numerieke modus', () => {
  for (const s of ['01234567', '8675309', '000', '12345678901234567890']) {
    const qr = QR.encode(s);
    assert.equal(QR.decode(qr).tekst, s, 'numeriek ' + s);
  }
});

test('4. een zegel-achtig token (~230 tekens base64url) past en round-trript', () => {
  const crypto = require('crypto');
  const token = crypto.randomBytes(170).toString('base64url'); // ~227 tekens
  const qr = QR.encode(token, { ecc: 'L' });
  assert.ok(qr.versie >= 8, 'zo veel data vraagt een hogere versie (v' + qr.versie + ')');
  assert.equal(QR.decode(qr).tekst, token, 'het volledige token kwam heel terug');
});

test('5. unicode (UTF-8) round-trript', () => {
  const s = 'Zegel: 18+ · lid · café ✓ 日本';
  const qr = QR.encode(s, { ecc: 'M' });
  assert.equal(QR.decode(qr).tekst, s, 'utf-8 heel terug');
});

test('6. de matrix heeft de juiste maat en dekt de zoekpatronen (donkere hoeken)', () => {
  const qr = QR.encode('RTG');
  assert.equal(qr.matrix.length, qr.size);
  assert.equal(qr.matrix[0][0], 1, 'zoekpatroon linksboven begint donker');
  assert.equal(qr.matrix[0][qr.size - 1], 1, 'zoekpatroon rechtsboven');
  assert.equal(qr.matrix[qr.size - 1][0], 1, 'zoekpatroon linksonder');
});
