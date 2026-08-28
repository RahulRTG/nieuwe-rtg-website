/* De twee leesingangen van de partneraanmelding: /api/partner/types (de kaart
   van wat RTG per bedrijfstype en land vraagt) en /api/partner/applications/mijn
   (de eigen aanvragen met hun toelatingsstand).

   Wat hier op het spel staat is de POORT. Sinds de ladderronde staat de
   typekaart achter can_be_partner: wat eruit komt is de volledige eisenkaart
   van dit huis, en die hoort bij wie partner MAG worden -- niet bij wie het
   adres raadt. De ladder handhaaft dat op norm nul (49c375c0); deze toets zegt
   het per ingang, met de inhoud erbij zodra de deur wel opengaat.

   Draai los: node --test test/partnertypes.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, elevateTier } = require('./helper');

let srv, base;
const post = (pad, body, tok) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '' } }); base = srv.base; });
test.after(() => stop(srv && srv.child));

async function lid(tier) {
  const t = Date.now() + '' + Math.floor(Math.random() * 1e4);
  const r = await post('/api/auth/register', { name: 'Partner ' + t, email: 'pt' + t + '@v.test',
    phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(r.body.token, 'registratie geeft een token');
  if (tier && tier !== 'rtg') await elevateTier(base, r.body.token, tier);
  return r.body.token;
}

test('de typekaart is niet voor wie het adres raadt: anoniem en RTG Pass krijgen 403', async () => {
  const anoniem = await post('/api/partner/types');
  assert.equal(anoniem.status, 403, 'zonder token blijft de kaart dicht');
  assert.match(anoniem.body.error, /partner/i, 'en de reden noemt de partnereis');
  const rtg = await post('/api/partner/types', {}, await lid('rtg'));
  assert.equal(rtg.status, 403, 'een RTG Pass mag geen partner zijn, dus ook geen kaart');
});

test('met een Business Pass komt de volle kaart: types, landen en handelseisen', async () => {
  const tok = await lid('business');
  const d = await post('/api/partner/types', {}, tok);
  assert.equal(d.status, 200);
  assert.ok((d.body.types || []).length >= 5, 'de bedrijfstypen staan erin');
  assert.ok((d.body.landen || []).length > 100, 'de landenlijst komt uit de catalogus, niet uit een lijstje');
  assert.ok(d.body.landen.every(l => typeof l.code === 'string' && l.code.length >= 2), 'elk land draagt een code');
  assert.ok(d.body.handelEisen, 'de handelseisen (goederen, douane) reizen mee');
  const restaurant = d.body.types.find(t => t.code === 'restaurant');
  assert.ok(restaurant && Array.isArray(restaurant.eisen), 'een gereguleerd type noemt zijn eisen');
});

test('mijn aanvragen: dezelfde poort, en een vers lid heeft er nul', async () => {
  assert.equal((await post('/api/partner/applications/mijn')).status, 403, 'anoniem blijft dicht');
  const tok = await lid('business');
  const d = await post('/api/partner/applications/mijn', {}, tok);
  assert.equal(d.status, 200);
  assert.deepEqual(d.body.aanvragen, [], 'geen aanvragen betekent een lege lijst, geen storing');
});
