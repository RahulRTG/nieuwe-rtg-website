/* RTG QR-scanner (public/shared/qrscan.js): de beeld-decoder. We renderen een
   met onze eigen codec gemaakte QR naar een pixelbeeld (met stille rand) en
   halen dat door decodeImage -- die de zoekpatronen vindt, de rastermaat bepaalt,
   de modules sampelt en via de codec decodeert. Zo is de hele scan-keten
   (beeld -> tekst) te toetsen zonder camera.
   Draai los: node --experimental-sqlite --test test/qrscan.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const QR = require('../public/shared/qr');
const Scan = require('../public/shared/qrscan');

test('1. beeld -> tekst: gerenderde QR wordt weer gelezen (meerdere schalen)', () => {
  for (const s of ['RTG', 'hallo wereld', 'ABC-123_xyz', '18+ lid business']) {
    for (const schaal of [4, 6, 8]) {
      const qr = QR.encode(s, { ecc: 'M' });
      const beeld = Scan.render(qr.matrix, schaal, 4);
      const uit = Scan.decodeImage(beeld.gray, beeld.w, beeld.h);
      assert.ok(uit, 'gedecodeerd (schaal ' + schaal + ', "' + s + '")');
      assert.equal(uit.tekst, s, 'tekst klopt (schaal ' + schaal + ')');
    }
  }
});

test('2. een zegel-achtig token (hogere versie) door de scanner', () => {
  const crypto = require('crypto');
  const token = crypto.randomBytes(140).toString('base64url');
  const qr = QR.encode(token, { ecc: 'L' });
  const beeld = Scan.render(qr.matrix, 5, 6);
  const uit = Scan.decodeImage(beeld.gray, beeld.w, beeld.h);
  assert.ok(uit, 'token-QR gedecodeerd (v' + qr.versie + ')');
  assert.equal(uit.tekst, token, 'het volledige token kwam via het beeld terug');
});

test('3. een beeld zonder QR levert netjes null (geen crash)', () => {
  const leeg = new Uint8Array(80 * 80); leeg.fill(255);
  assert.equal(Scan.decodeImage(leeg, 80, 80), null);
});
