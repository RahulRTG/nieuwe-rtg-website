/* DE LESCODE ALS DEELLINK EN QR (besluit B20, RELEASEKANDIDAAT.md), zonder browser.

   De browserweg zelf staat in test/lesdeellink.e2e.js. Hier wat zonder browser
   vast te leggen is:
   1. de link: alleen een VOLLEDIGE lescode (128 bits), en de code staat in het
      FRAGMENT -- nooit in pad of query;
   2. de QR die het bord tekent, leest via de eigen scanner terug als precies die
      link (geen tweede codec, geen extern pakket);
   3. het wis-script bovenaan leren.html, in een nagebootste browser: een geldige
      code gaat in geheugen, ELK #les=-fragment gaat uit de adresbalk (ook een
      ongeldig), en een ander fragment blijft staan;
   4. de volgorde in leren.html: referrer-meta en wis-script staan voor elk
      extern script en elke stylesheet; het intikveld kan de volledige code aan;
   5. op HTTP-niveau draagt leren.html Referrer-Policy: no-referrer.

   Draai los: node --test test/lesdeel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const Deel = require('../public/apps/foundation/lesdeel');
const QR = require('../public/shared/qr');
const Scan = require('../public/shared/qrscan');
const Scanner = require('../public/shared/scanner');
const { startServer, stop } = require('./helper');

const LEREN = path.join(__dirname, '..', 'public', 'apps', 'foundation', 'leren.html');
const BORD = path.join(__dirname, '..', 'public', 'apps', 'foundation', 'bord.html');
const code = () => 'LES.' + crypto.randomBytes(16).toString('hex').toUpperCase();

test('1. de link draagt alleen een volledige lescode, en alleen in het fragment', () => {
  const c = code();
  const l = Deel.link('https://rtg.example/', c);
  const u = new URL(l);
  assert.equal(u.pathname, '/apps/foundation/leren.html');
  assert.equal(u.search, '', 'nooit in de query');
  assert.equal(u.hash, '#les=' + c);
  assert.equal(u.pathname.includes('LES.'), false, 'nooit in het pad');
  for (const fout of ['', 'LES.ABC', c.toLowerCase(), c + 'A', c.slice(0, -1), 'LESLR.' + c.slice(4), c.replace('LES.', 'LES-')]) {
    assert.throws(() => Deel.link('https://rtg.example', fout), /volledige lescode/, 'geweigerd: ' + fout);
  }
});

test('2. de QR van het bord leest terug als precies de deellink', () => {
  const l = Deel.link('https://rahultravelgroup.example', code());
  const qr = QR.encode(l, { ecc: 'M' }); // dezelfde instelling als RTGQRteken.teken
  const beeld = Scan.render(qr.matrix, 6, 4);
  const rgba = { width: beeld.w, height: beeld.h, data: new Uint8ClampedArray(beeld.w * beeld.h * 4) };
  for (let i = 0; i < beeld.w * beeld.h; i++) {
    rgba.data[i * 4] = rgba.data[i * 4 + 1] = rgba.data[i * 4 + 2] = beeld.gray[i]; rgba.data[i * 4 + 3] = 255;
  }
  assert.equal(Scanner.leesGrijs(Scanner.grijs(rgba), beeld.w, beeld.h), l);
});

function wisScript() {
  const html = fs.readFileSync(LEREN, 'utf8');
  const m = /<script>\s*([\s\S]*?__RTG_LESCODE[\s\S]*?)<\/script>/.exec(html);
  assert.ok(m, 'leren.html draagt het wis-script');
  return m[1];
}
function draai(hash) {
  const geschiedenis = [];
  const venster = {
    location: { hash, pathname: '/apps/foundation/leren.html', search: '' },
    history: { replaceState: (s, t, url) => geschiedenis.push(url) }
  };
  venster.window = venster;
  vm.runInNewContext(wisScript(), venster);
  return { code: venster.__RTG_LESCODE, geschiedenis };
}

test('3. het wis-script: code in geheugen, fragment uit de adresbalk', () => {
  const c = code();
  let r = draai('#les=' + c);
  assert.equal(r.code, c);
  assert.deepEqual(r.geschiedenis, ['/apps/foundation/leren.html'], 'het adres verliest het fragment');
  r = draai('#les=' + c.toLowerCase());
  assert.equal(r.code, c, 'kleine letters worden de canonieke code');
  r = draai('#les=LES.ABCDEF');
  assert.equal(r.code, undefined, 'een halve code komt niet in geheugen');
  assert.deepEqual(r.geschiedenis, ['/apps/foundation/leren.html'], 'maar wordt wel gewist');
  r = draai('#vandaag');
  assert.equal(r.code, undefined);
  assert.deepEqual(r.geschiedenis, [], 'een ander fragment blijft staan');
});

test('4. leren.html: eerst referrer-meta en wissen, dan pas een verzoek; het veld kan de hele code aan', () => {
  const html = fs.readFileSync(LEREN, 'utf8');
  const eersteVerzoek = Math.min(html.search(/<script[^>]+src=/), html.search(/<link[^>]+href=/));
  const meta = html.search(/<meta name="referrer" content="no-referrer">/);
  const wis = html.indexOf('history.replaceState');
  assert.ok(meta > 0 && meta < eersteVerzoek, 'de referrer-meta staat voor het eerste verzoek');
  assert.ok(wis > 0 && wis < eersteVerzoek, 'het wis-script staat voor het eerste verzoek');
  const veld = /<input[^>]*id="lCode"[^>]*>/.exec(html)[0];
  assert.ok(Number(/maxlength="(\d+)"/.exec(veld)[1]) >= code().length, 'het intikveld kan de volledige code aan');
  assert.match(fs.readFileSync(BORD, 'utf8'), /<script src="lesdeel\.js" defer><\/script>/, 'het bord laadt de deelknop');
});

test('5. leren.html draagt op HTTP-niveau Referrer-Policy: no-referrer', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lesdeel-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const r = await fetch(base + '/apps/foundation/leren.html');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
    await r.text();
    const ander = await fetch(base + '/apps/foundation/bord.html');
    assert.equal(ander.headers.get('referrer-policy'), 'strict-origin-when-cross-origin', 'de regel is smal');
    await ander.text();
  } finally {
    await stop(child);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
