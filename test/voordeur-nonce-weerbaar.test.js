/* DE NONCE-LAAG VAN DE VOORDEUR -- elk script een verse nonce, niets van buiten de webroot.

   server/middleware/voordeur.js (cspNonce) serveert elke .html zelf: hij zet een
   verse nonce op ieder <script> en <style>, legt dezelfde nonce in de CSP-kop,
   zet via kopinjectie.js het handattribuut uit een cookie, en levert de landing
   (index.html in de repositoryroot) ook als de nonce-laag uit staat.

   Wat hier niet mag sneuvelen:
   1. Een pad dat via .. buiten de webroot wijst wordt niet gelezen, ook niet als
      dat bestand bestaat.
   2. Elk script en stijlblok draagt de nonce van DEZE respons, die ook in de CSP
      staat; een tweede verzoek krijgt een andere. Een bestaande nonce blijft.
   3. HEAD geeft dezelfde CSP en de juiste Content-Length, zonder lijf -- ook voor
      de landing met de nonce-laag uit.
   4. Uit de handcookie komt alleen `links` of `rechts` in een attribuut; een pagina
      zonder <html> krijgt niets, en dan ook geen Vary op Cookie.
   5. Een meekijkhaak die gooit, breekt de pagina niet; gzip pakt terug uit.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - voordeur.js: de path-traversalregel (`!bestand.startsWith(publicDir + path.sep)`) weg -> toets 1 zakt.
   - voordeur.js: `<script(?![^>]*\bnonce=)` -> `<script` -> toets 2 zakt (dubbele nonce).
   - kopinjectie.js: `(links|rechts)` -> `([^;]+)` -> toets 4 zakt.

   Draai los: node --test test/voordeur-nonce-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { cspNonce, opPagina } = require('../server/middleware/voordeur');

const BUITEN = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-voordeur-'));
const WORTEL = path.join(BUITEN, 'public');
fs.mkdirSync(path.join(WORTEL, 'apps'), { recursive: true });
test.after(() => { opPagina(null); fs.rmSync(BUITEN, { recursive: true, force: true }); });
fs.writeFileSync(path.join(BUITEN, 'geheim.html'), '<html><body>GEHEIM</body></html>');
fs.writeFileSync(path.join(BUITEN, 'index.html'), '<!doctype html><html><head><meta name="x" content="y"></head><body>landing</body></html>');
const PAGINA = '<!doctype html><html lang="nl"><head><style>.a{}</style></head><body>' +
  '<script>var a=1</script><script nonce="vast">var b=2</script><p>' + 'x'.repeat(3000) + '</p></body></html>';
fs.writeFileSync(path.join(WORTEL, 'apps', 'p.html'), PAGINA);
fs.writeFileSync(path.join(WORTEL, 'apps', 'kaal.html'), '<p>zonder html-element</p>');

function roep(mw, { pad, methode = 'GET', headers = {} }) {
  return new Promise((klaar) => {
    const res = { kop: {}, lijf: undefined, door: false,
      set(k, v) { this.kop[k.toLowerCase()] = v; return this; }, setHeader(k, v) { this.kop[k.toLowerCase()] = v; },
      type() { return this; }, send(b) { this.lijf = b; klaar(this); return this; }, end() { this.lijf = null; klaar(this); return this; } };
    mw({ path: pad, method: methode, headers, query: {} }, res, () => { res.door = true; klaar(res); });
  });
}
const nonceUit = (csp) => /'nonce-([^']+)'/.exec(csp)[1];

test('1. buiten de webroot wordt niets gelezen', async () => {
  const mw = cspNonce(WORTEL, true);
  for (const pad of ['/../geheim.html', '/apps/../../geheim.html']) {
    const r = await roep(mw, { pad });
    assert.equal(r.door, true, pad);
    assert.equal(r.lijf, undefined);
  }
  assert.equal((await roep(mw, { pad: '/apps/bestaat-niet.html' })).door, true);
  assert.equal((await roep(mw, { pad: '/apps/p.html', methode: 'POST' })).door, true);
  assert.equal((await roep(mw, { pad: '/apps/plaatje.png' })).door, true);
  assert.equal((await roep(cspNonce(WORTEL, false), { pad: '/apps/p.html' })).door, true, 'nonce-laag uit: alleen de landing');
});

test('2. elk script en stijlblok draagt de nonce van deze respons', async () => {
  const mw = cspNonce(WORTEL, true);
  const een = await roep(mw, { pad: '/apps/p.html' });
  const twee = await roep(mw, { pad: '/apps/p.html' });
  const n = nonceUit(een.kop['content-security-policy']);
  assert.notEqual(n, nonceUit(twee.kop['content-security-policy']), 'elke respons een verse nonce');
  assert.ok(een.lijf.includes('<script nonce="' + n + '">var a=1'));
  assert.ok(een.lijf.includes('<style nonce="' + n + '">.a{}'));
  assert.ok(een.lijf.includes('<script nonce="vast">var b=2'), 'een bestaande nonce wordt niet overschreven');
  assert.doesNotMatch(een.lijf, /nonce="[^"]*" nonce=/, 'nooit twee nonces op een element');
  assert.equal(een.lijf.match(/<script(?![^>]*\bnonce=)/g), null, 'geen ongestempeld script');
});

test('3. HEAD: dezelfde CSP, de juiste lengte, geen lijf -- ook voor de landing', async () => {
  const head = await roep(cspNonce(WORTEL, true), { pad: '/apps/p.html', methode: 'HEAD' });
  assert.equal(head.lijf, null);
  assert.match(head.kop['content-security-policy'], /'nonce-/);
  const get = await roep(cspNonce(WORTEL, true), { pad: '/apps/p.html' });
  assert.ok(Math.abs(Number(head.kop['content-length']) - Buffer.byteLength(get.lijf)) <= 4, 'lengte van dezelfde pagina (nonces van gelijke lengte)');
  const landingHead = await roep(cspNonce(WORTEL, false), { pad: '/', methode: 'HEAD' });
  assert.equal(landingHead.lijf, null);
  const landingGet = await roep(cspNonce(WORTEL, false), { pad: '/' });
  assert.equal(Number(landingHead.kop['content-length']), Buffer.byteLength(landingGet.lijf));
  assert.match(landingGet.lijf, /landing/);
});

test('4. uit de handcookie komt alleen links of rechts', async () => {
  const mw = cspNonce(WORTEL, true);
  const links = await roep(mw, { pad: '/apps/p.html', headers: { cookie: 'a=1; rtg_hand=links' } });
  assert.match(links.lijf, /<html data-hand="links" lang="nl">/);
  assert.equal(links.kop.vary, 'Cookie, Accept-Encoding');
  for (const cookie of ['rtg_hand=links"><script>x()</script>', 'rtg_hand=boven', 'xrtg_hand=links']) {
    const r = await roep(mw, { pad: '/apps/p.html', headers: { cookie } });
    assert.doesNotMatch(r.lijf, /data-hand=/, cookie);
  }
  const kaal = await roep(mw, { pad: '/apps/kaal.html', headers: { cookie: 'rtg_hand=rechts' } });
  assert.doesNotMatch(kaal.lijf, /data-hand/);
  assert.equal(kaal.kop.vary, undefined);
  assert.match(kaal.lijf, /^<script nonce="[^"]+">\(function\(d\)/, 'zonder <head> komt de stempelaar vooraan, met nonce');
});

test('5. een gooiende meekijkhaak breekt niets; gzip pakt terug uit', async () => {
  const gezien = [];
  opPagina((p) => { gezien.push(p); throw new Error('haak kapot'); });
  const r = await roep(cspNonce(WORTEL, true), { pad: '/apps/p.html', headers: { 'accept-encoding': 'gzip' } });
  assert.deepEqual(gezien, ['/apps/p.html']);
  assert.equal(r.kop['content-encoding'], 'gzip');
  const html = zlib.gunzipSync(r.lijf).toString();
  assert.ok(html.includes('nonce="' + nonceUit(r.kop['content-security-policy']) + '"'));
  opPagina('geen functie');
  await roep(cspNonce(WORTEL, true), { pad: '/apps/p.html' });
  assert.equal(gezien.length, 1, 'een niet-functie zet de haak uit');
});
