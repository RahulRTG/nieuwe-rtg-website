/* De drie deuren van de toestelrekenlaag, tegen een ECHTE server (LAT.md regel
   17: een nagemaakte app bewijst het handlergedrag en niet de montage).

   Wat hier vastligt:
     - /toestel/cel draagt als enige 'wasm-unsafe-eval', en ALTIJD samen met
       connect-src 'none'. De ene zonder de andere is precies de versoepeling
       die dit huis niet wil: rekenen mag, bellen niet.
     - zonder manifest zegt de server dat er niets is uitgerold, met de reden,
       en geen leeg succes;
     - een artefact heet naar zijn hash, komt met Range, en is onveranderlijk.
   Draai los: node --test test/toestel-routes.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toestel-'));
const TOESTEL = path.join(TMP, 'toestel');
const BYTES = Buffer.from('proefartefact voor de toestelrekenlaag, met genoeg bytes om te knippen');
const SHA = crypto.createHash('sha256').update(BYTES).digest('hex');
let srv;

test.before(async () => {
  fs.mkdirSync(path.join(TOESTEL, 'artefacten'), { recursive: true });
  fs.writeFileSync(path.join(TOESTEL, 'artefacten', SHA), BYTES);
  srv = await startServer({ env: { RTG_DATA_DIR: TMP, RTG_TOESTEL_DIR: TOESTEL, SMTP_URL: '' } });
});
test.after(async () => { if (srv) await stop(srv); fs.rmSync(TMP, { recursive: true, force: true }); });

test('1. de cel draagt wasm-unsafe-eval alleen samen met connect-src none', async () => {
  const r = await fetch(srv.base + '/toestel/cel');
  assert.equal(r.status, 200);
  const csp = r.headers.get('content-security-policy');
  const deel = (n) => ((new RegExp('(?:^|;)\\s*' + n + '(\\s[^;]*)').exec(csp) || [])[1] || '').trim();
  assert.match(deel('script-src'), /'wasm-unsafe-eval'/);
  assert.equal(deel('connect-src'), "'none'", 'rekenen mag, bellen niet');
  assert.equal(deel('default-src'), "'none'");
  assert.doesNotMatch(deel('script-src'), /unsafe-inline|'unsafe-eval'/);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const html = await r.text();
  assert.match(html, /<script src="\/toestel\/cel\.js"><\/script>/);
  assert.doesNotMatch(html, /<script>(?!<\/)/, 'geen inline script in de cel');
});

test('1b. het celscript mag door een cel zonder origin geladen worden, en alleen dat bestand', async () => {
  const r = await fetch(srv.base + '/toestel/cel.js');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cross-origin-resource-policy'), 'cross-origin');
  assert.match(await r.text(), /UITVOERDERS/);
  const gewoon = await fetch(srv.base + '/shared/toestel/poorten.js');
  assert.equal(gewoon.headers.get('cross-origin-resource-policy'), 'same-origin', 'de rest van het huis blijft same-origin');
});

test('2. een gewone pagina krijgt wasm-unsafe-eval niet', async () => {
  const r = await fetch(srv.base + '/apps/app.html');
  const csp = r.headers.get('content-security-policy') || '';
  assert.ok(csp.length > 0);
  assert.doesNotMatch(csp, /wasm-unsafe-eval/);
});

test('3. zonder manifest zegt de server dat er niets is uitgerold', async () => {
  const r = await fetch(srv.base + '/toestel/manifest.json');
  assert.equal(r.status, 404);
  const d = await r.json();
  assert.deepEqual(d.artefacten, []);
  assert.match(d.reden, /geen ondertekend manifest/);
});

test('4. met manifest geeft de server de regels ongewijzigd door', async () => {
  const regel = { id: 'proef', sha256: SHA, grootte: BYTES.length, handtekening: 'x', sleutel: 'k' };
  fs.writeFileSync(path.join(TOESTEL, 'manifest.json'), JSON.stringify({ versie: 1, artefacten: [regel] }));
  const d = await (await fetch(srv.base + '/toestel/manifest.json')).json();
  assert.deepEqual(d.artefacten, [regel], 'de server controleert niet en verandert niets; dat doet de browser');
  fs.rmSync(path.join(TOESTEL, 'manifest.json'));
});

test('5. GET /toestel/artefact/:sha: een artefact heet naar zijn hash, komt met Range en is onveranderlijk', async () => {
  const heel = await fetch(srv.base + '/toestel/artefact/' + SHA);
  assert.equal(heel.status, 200);
  assert.match(heel.headers.get('cache-control'), /immutable/);
  assert.equal(heel.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await heel.arrayBuffer()), BYTES);
  const stuk = await fetch(srv.base + '/toestel/artefact/' + SHA, { headers: { Range: 'bytes=10-' } });
  assert.equal(stuk.status, 206, 'hervatten van een onderbroken download moet kunnen');
  assert.deepEqual(Buffer.from(await stuk.arrayBuffer()), BYTES.subarray(10));
  assert.equal((await fetch(srv.base + '/toestel/artefact/' + '0'.repeat(64))).status, 404);
  assert.equal((await fetch(srv.base + '/toestel/artefact/..%2F..%2Fmanifest.json')).status, 400);
});
