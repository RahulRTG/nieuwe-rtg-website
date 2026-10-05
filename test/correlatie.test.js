/* ============================================================================
   DE CORRELATIE MAAKT DE SERVER (Fase 2, besluit B1a; server/correlatie.js).

   Een X-Request-Id van de client werd ongetoetst de correlatie van het verzoek,
   in elke lengte -- en die correlatie is een SLEUTEL: de effectbon en de
   geldketen (`uitvoerVerzoek`) koppelen erop. Deze toetsen houden vast:

     1. twee verzoeken met dezelfde X-Request-Id krijgen elk een eigen
        correlatie, en geen van beide is het client-id;
     2. een id van 4000 tekens komt niet terug, maar `req.externeId` draagt het
        begrensd (de eerste 64);
     3. een id met een teken buiten [A-Za-z0-9._-] wordt niet schoongepoetst
        maar is gewoon geen `extern`;
     4. de logregel van het verzoek draagt beide, zodat een proxylog nog te
        koppelen is.

   De serverhelft (een echte server, handeling en ledenpoort ertussen) is I2 in
   scripts/contextdoorgifte.js, gedraaid door test/contextdoorgifte-server.test.js.

   Draai los: node --test test/correlatie.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { middleware } = require('../server/log');
const correlatie = require('../server/correlatie');

function verzoek(kop) {
  const headers = {};
  const req = { headers: kop === undefined ? {} : { 'x-request-id': kop }, method: 'GET', path: '/x' };
  const res = { set: (k, v) => { headers[k] = v; }, on: () => {} };
  middleware()(req, res, () => {});
  return { req, antwoord: headers['X-Request-Id'] };
}

test('twee verzoeken met dezelfde X-Request-Id krijgen elk een eigen servercorrelatie', () => {
  const a = verzoek('proxy-herhaling-1'), b = verzoek('proxy-herhaling-1');
  assert.notEqual(a.req.id, 'proxy-herhaling-1', 'het client-id werd de correlatie');
  assert.notEqual(a.req.id, b.req.id, 'twee uitvoeringen delen een sleutel');
  assert.equal(a.antwoord, a.req.id, 'het antwoord draagt de correlatie van de server');
  assert.match(a.req.id, /^[0-9a-f]{16}$/);
  assert.equal(a.req.externeId, 'proxy-herhaling-1', 'het client-id blijft als extern bestaan');
});

test('een id van 4000 tekens komt niet terug; extern draagt hem begrensd', () => {
  const lang = 'a'.repeat(4000);
  const { req, antwoord } = verzoek(lang);
  assert.ok(antwoord.length <= 64 && antwoord !== lang, 'het lange id kwam terug');
  assert.ok(!req.id.includes('aaaa'), 'de correlatie is (een stuk van) het client-id');
  assert.equal(req.externeId, lang.slice(0, correlatie.MAX_EXTERN));
  assert.equal(correlatie.MAX_EXTERN, 64);
});

test('een id met tekens buiten de set wordt niet herschreven maar is geen extern', () => {
  for (const kop of ['a b', 'x<script>', 'a,b', 'é', '', 'x\n']) {
    assert.equal(verzoek(kop).req.externeId, null, JSON.stringify(kop));
  }
  assert.equal(verzoek(undefined).req.externeId, null);
  assert.equal(correlatie.extern(['a', 'b']), null, 'een array is geen kop');
  assert.equal(correlatie.extern('ok.id_1-2'), 'ok.id_1-2');
});

test('de logregel van het verzoek draagt correlatie en extern', () => {
  const regels = [];
  const echt = process.stdout.write;
  const fin = [];
  const req = { headers: { 'x-request-id': 'proxy-log-7' }, method: 'GET', path: '/x' };
  const res = { statusCode: 200, set: () => {}, on: (e, f) => { if (e === 'finish') fin.push(f); } };
  middleware()(req, res, () => {});
  process.stdout.write = (s) => { regels.push(String(s)); return true; };
  try { fin.forEach(f => f()); } finally { process.stdout.write = echt; }
  const r = regels.find(x => x.includes('verzoek') && x.includes(req.id));
  assert.ok(r, 'geen verzoekregel met de servercorrelatie: ' + regels.join(''));
  assert.ok(r.includes('proxy-log-7'), 'de verzoekregel mist extern: ' + r);
});
