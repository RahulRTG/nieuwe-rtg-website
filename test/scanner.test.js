/* RTG Scanner (public/shared/scanner.js): de camera-bediening. De camera zelf
   (getUserMedia, BarcodeDetector) bestaat niet in Node, dus we toetsen de pure,
   camera-onafhankelijke kern: de grijswaarde-omzetting die elk frame ondergaat
   en de eigen-QR-terugval. We bouwen een RGBA-frame zoals een <canvas> dat geeft,
   halen het door grijs() + leesGrijs() en verwachten de tekst terug.
   Draai los: node --experimental-sqlite --test test/scanner.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const QR = require('../public/shared/qr');
const Scan = require('../public/shared/qrscan');
const Scanner = require('../public/shared/scanner');

// maak een RGBA-ImageData (zoals canvas.getImageData) uit een grijswaardebeeld
function naarRGBA(gray, w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, j = 0; i < w * h; i++, j += 4) { data[j] = data[j + 1] = data[j + 2] = gray[i]; data[j + 3] = 255; }
  return { data, width: w, height: h };
}

test('1. grijs(): RGBA -> luma klopt op bekende kleuren', () => {
  const img = { width: 3, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 255]) };
  const g = Scanner.grijs(img);
  assert.equal(g[0], 0, 'zwart -> 0');
  assert.equal(g[1], 255, 'wit -> 255');
  assert.ok(g[2] > 60 && g[2] < 100, 'zuiver rood -> ~76 luma (kreeg ' + g[2] + ')');
});

test('2. camera-pad: gerenderde QR als RGBA-frame -> tekst terug', () => {
  for (const s of ['RTG', 'zegel 18+ lid', 'ABC-123_xyz.']) {
    const qr = QR.encode(s, { ecc: 'M' });
    const beeld = Scan.render(qr.matrix, 6, 4);        // grijswaardebeeld met stille rand
    const rgba = naarRGBA(beeld.gray, beeld.w, beeld.h); // zoals canvas.getImageData
    const g = Scanner.grijs(rgba);                       // terug naar grijs, zoals de scanner doet
    const tekst = Scanner.leesGrijs(g, beeld.w, beeld.h);
    assert.equal(tekst, s, 'camera-pad las "' + s + '"');
  }
});

test('3. een zegel-achtig token via het camera-pad', () => {
  const crypto = require('crypto');
  const token = crypto.randomBytes(120).toString('base64url');
  const qr = QR.encode(token, { ecc: 'L' });
  const beeld = Scan.render(qr.matrix, 5, 6);
  const rgba = naarRGBA(beeld.gray, beeld.w, beeld.h);
  const tekst = Scanner.leesGrijs(Scanner.grijs(rgba), beeld.w, beeld.h);
  assert.equal(tekst, token, 'het volledige token kwam via het frame terug');
});

test('4. zonder camera: heeftNativeDetector is netjes false in Node, leesGrijs op ruis is null', () => {
  assert.equal(Scanner.heeftNativeDetector(), false);
  const ruis = new Uint8Array(60 * 60); ruis.fill(255);
  assert.equal(Scanner.leesGrijs(ruis, 60, 60), null);
});
