/* DE COMPRESSIELAAG -- nooit een oude minify, nooit buiten de webroot, nooit een lege belofte.

   server/middleware/compressie.js comprimeert statische bestanden (een keer, in
   een cache) en grote JSON-antwoorden. Hij leest een pad dat de browser
   aanlevert en kiest zelf tussen bron en geminificeerde versie.

   Wat hier niet mag sneuvelen:
   1. Een pad met .., ook procentgecodeerd, of een kapotte escape wordt niet
      gelezen; een map, een onbekend type of een range-verzoek gaat door naar
      de gewone statische laag.
   2. Een geminificeerde versie wordt alleen geserveerd als hij VERSER is dan
      de bron; een lokaal bewerkte bron wint, en de ETag zegt welke het was.
   3. Een gewijzigd bestand krijgt een nieuwe ETag (geen oude bytes uit de
      cache); dezelfde ETag is 304; br en gzip hebben elk een eigen ETag.
   4. Een JSON-antwoord dat niet te serialiseren is of klein is, gaat
      onverpakt en zonder Content-Encoding-belofte de deur uit.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - compressie.js: `mst.mtimeMs >= st.mtimeMs` -> `true` -> toets 2 zakt (oude minify).
   - compressie.js: `if (rel.indexOf('..') !== -1) return next();` weg -> toets 1 zakt.
   - compressie.js: `hit.mtimeMs !== st.mtimeMs ||` weg uit de cachecontrole -> toets 3 zakt.

   Draai los: node --test test/compressie-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { statischGzip, jsonGzip } = require('../server/middleware/compressie');

const BUITEN = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-compressie-'));
const WORTEL = path.join(BUITEN, 'public');
test.after(() => fs.rmSync(BUITEN, { recursive: true, force: true }));
const T0 = Date.parse('2026-01-01T00:00:00Z');
function schrijf(rel, inhoud, ms, wortel = WORTEL) {
  const abs = path.join(wortel, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, inhoud);
  fs.utimesSync(abs, new Date(ms), new Date(ms));
}
schrijf('geheim.js', 'geheim()', T0, BUITEN);
/* Een BUURMAP met dezelfde naam als voorvoegsel: public-geheim begint met
   "public", dus een startsWith zonder scheidingsteken laat hem door. */
schrijf('public-geheim/x.js', 'buur()', T0, BUITEN);
schrijf('js/a.js', 'function bron() { return 1; }', T0 + 2000);
schrijf('dist/min/js/a.js', 'oud()', T0 + 1000);
schrijf('js/b.js', 'function b() {}', T0);
schrijf('dist/min/js/b.js', 'b()', T0 + 5000);
schrijf('plaatje.png', 'png', T0);
fs.mkdirSync(path.join(WORTEL, 'map.js'));

function roep(mw, pad, headers = { 'accept-encoding': 'gzip' }, query = {}) {
  const res = { statusCode: 200, kop: {}, lijf: undefined, door: false,
    setHeader(k, v) { this.kop[k.toLowerCase()] = v; }, end(b) { this.lijf = b; return this; } };
  mw({ path: pad, headers, query }, res, () => { res.door = true; });
  return res;
}
const uitpakken = (r) => (r.kop['content-encoding'] === 'br' ? zlib.brotliDecompressSync(r.lijf) : zlib.gunzipSync(r.lijf)).toString();

test('1. buiten de webroot, kapotte escapes, mappen, vreemde typen en ranges: niet hier', () => {
  const mw = statischGzip(WORTEL);
  for (const pad of ['/../geheim.js', '/../public-geheim/x.js', '/%2e%2e/public-geheim/x.js', '/js/%E0%A4%A.js', '/map.js', '/plaatje.png', '/js/weg.js']) {
    const r = roep(mw, pad);
    assert.equal(r.door, true, pad);
    assert.equal(r.lijf, undefined, pad);
  }
  assert.equal(roep(mw, '/js/a.js', { 'accept-encoding': 'gzip', range: 'bytes=0-3' }).door, true);
  assert.equal(roep(mw, '/js/a.js', {}).door, true, 'zonder compressiewens gaat de gewone laag');
});

test('2. een minify wordt alleen geserveerd als hij verser is dan de bron', () => {
  const mw = statischGzip(WORTEL);
  const a = roep(mw, '/js/a.js');
  assert.equal(uitpakken(a), 'function bron() { return 1; }', 'de bewerkte bron wint van een oude minify');
  assert.doesNotMatch(a.kop.etag, /-m/);
  const b = roep(mw, '/js/b.js', { 'accept-encoding': 'br' });
  assert.equal(uitpakken(b), 'b()');
  assert.match(b.kop.etag, /-m[0-9a-f]+-b"$/);
  assert.equal(b.kop['cache-control'], 'no-cache');
});

test('3. een gewijzigd bestand krijgt een nieuwe ETag; dezelfde ETag is 304', () => {
  const mw = statischGzip(WORTEL);
  schrijf('js/c.js', 'eerst()', T0);
  const een = roep(mw, '/js/c.js');
  assert.equal(roep(mw, '/js/c.js', { 'accept-encoding': 'gzip', 'if-none-match': een.kop.etag }).statusCode, 304);
  assert.notEqual(roep(mw, '/js/c.js', { 'accept-encoding': 'br' }).kop.etag, een.kop.etag, 'br en gzip niet dezelfde ETag');
  schrijf('js/c.js', 'daarna()', T0 + 9000);
  const twee = roep(mw, '/js/c.js');
  assert.notEqual(twee.kop.etag, een.kop.etag);
  assert.equal(uitpakken(twee), 'daarna()', 'geen oude bytes uit de cache');
});

test('4. niet te serialiseren of klein: onverpakt en zonder belofte', () => {
  const mw = jsonGzip();
  const verpakt = [];
  const res = (headersSent = false) => ({ headersSent, kop: {}, setHeader(k, v) { this.kop[k] = v; },
    json(d) { verpakt.push(['json', d]); return this; }, end(b) { verpakt.push(['end', b]); return this; } });
  const rond = {}; rond.zelf = rond;
  for (const [data, r] of [[rond, res()], [{ klein: true }, res()], [{ groot: 'x'.repeat(5000) }, res(true)]]) {
    mw({ headers: { 'accept-encoding': 'gzip' } }, r, () => {});
    r.json(data);
    assert.equal(r.kop['Content-Encoding'], undefined);
  }
  assert.deepEqual(verpakt.map(v => v[0]), ['json', 'json', 'json']);
  let door = 0;
  mw({ headers: {} }, res(), () => door++);
  assert.equal(door, 1);
});
