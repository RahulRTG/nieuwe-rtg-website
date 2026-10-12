'use strict';
/* De Connect-webhook zonder ingericht geheim (server/opzet/connectwebhook.js):
   geen serverfout maar een 404 "niet ingericht", en er wordt niets verwerkt.
   De ladder vond hier eerst een 503 op een verzoek zonder token. Met geheim
   loopt de route verder naar de handtekening (dat deel staat in
   test/vrijgave-routes.test.js tegen een echte server). */
const test = require('node:test');
const assert = require('node:assert/strict');
const hang = require('../server/opzet/connectwebhook');

function haal(env) {
  let lijf;
  const app = { post: (pad, ...h) => { lijf = h[h.length - 1]; } };
  const express = { raw: () => (q, r, n) => n() };
  const log = { warn() {}, info() {}, uitzondering() {} };
  hang({ app, express, db: { data: {} }, save() {}, log, webhookRem: () => {}, webhookPoort: () => {}, env });
  return lijf;
}
function antwoord() {
  const r = { s: 200, b: null, status(s) { this.s = s; return this; }, json(b) { this.b = b; return this; } };
  return r;
}

test('zonder STRIPE_CONNECT_WEBHOOK_SECRET: 404 niet-ingericht, nooit een 5xx', async () => {
  const r = antwoord();
  await haal({})({ body: Buffer.from('{}'), get: () => null, id: 'x' }, r);
  assert.equal(r.s, 404);
  assert.equal(r.b.code, 'niet-ingericht');
});

test('met geheim maar zonder handtekening: 400, en de 404 geldt alleen voor de afwezigheid van het geheim', async () => {
  const r = antwoord();
  await haal({ STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_proef' })({ body: Buffer.from('{}'), get: () => null, id: 'x' }, r);
  assert.equal(r.s, 400);
});
