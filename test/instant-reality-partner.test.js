/* Het Vooruitzicht: wat een PARTNER ziet (/api/instant-reality/partner).

   DE FOUT (domeinkaart LivingOS-A, 19 oktober 2026). `/partner` gaf altijd de
   eigen wereld terug, in partnervorm: een partner kon de wereld van een ander
   nooit zien, en `permissions.friends` werd opgeslagen maar nergens gelezen.
   De partnerweergave toonde dus alles, wat de eigenaar ook had gekozen.

   DE REGEL NU:
     - zonder `van` is het de eigen voorvertoning ("zo ziet mijn partner het");
     - met `van` (een codenaam) alleen als de eigenaar het stuk "afspraken" met
       de vrager deelt over een bevestigde levensband (kern/levensband/inzage.js
       mag()); anders 403, en een onbekende codenaam krijgt hetzelfde antwoord;
     - `permissions.friends` bepaalt de velden: itinerary geeft providers en
       aankomstvenster, own_share de betaalgarantie;
     - de eigenaar zet die keuze met de gebeurtenis `permissions.friends`;
     - een partner-lezing maakt nooit een wereld aan voor de eigenaar.

   Draai los: node --test test/instant-reality-partner.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-instantpartner-'));
let srv, base;
const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
let n = 0;
const lid = async () => {
  const token = (await api('/api/auth/register', { name: 'Partner ' + n, email: 'ip' + Date.now() + (n++) + '@x.nl',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const codenaam = (await api('/api/member/connections', {}, token)).body.codename;
  return { token, codenaam };
};
const dag = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

let A, B, C;
test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  A = await lid(); B = await lid(); C = await lid();
  assert.ok(A.token && B.token && C.token && A.codenaam && B.codenaam, 'drie leden met een codenaam');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('zonder band en deling ziet een ander niets van de wereld van A', async () => {
  const eigen = (await api('/api/instant-reality', {}, A.token)).body;
  await api('/api/instant-reality/event', { type: 'intent.delta', value: 'Kyoto in oktober', version: eigen.version }, A.token);
  const r = await api('/api/instant-reality/partner', { van: A.codenaam }, B.token);
  assert.equal(r.status, 403, 'geen band: geen inzage');
  const onbekend = await api('/api/instant-reality/partner', { van: 'Bestaat Niet 0000' }, B.token);
  assert.equal(onbekend.status, 403);
  assert.equal(onbekend.body.error, r.body.error, 'een onbekende codenaam verraadt niet dat hij niet bestaat');
});

test('met een bevestigde band en een deling van "afspraken" ziet B de partnervorm van A', async () => {
  const v = await api('/api/leven/band/vraag', { codenaam: B.codenaam, soort: 'partner', vervalt: dag(200) }, A.token);
  assert.equal(v.status, 200, JSON.stringify(v.body));
  assert.equal((await api('/api/leven/band/bevestig', { bandId: v.body.band.id }, B.token)).status, 200);
  const d = await api('/api/leven/deel/zet', { bandId: v.body.band.id, stuk: 'afspraken', vervalt: dag(30) }, A.token);
  assert.equal(d.status, 200, JSON.stringify(d.body));
  const eigen = (await api('/api/instant-reality', {}, A.token)).body;
  const p = await api('/api/instant-reality/partner', { van: A.codenaam }, B.token);
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(p.body.id, eigen.id, 'het is de wereld van A, niet die van B');
  assert.equal(p.body.intent, undefined);
  assert.ok(!JSON.stringify(p.body).includes('Kyoto'), 'de intentie zelf reist niet mee');
  assert.ok(p.body.providers, 'itinerary staat standaard aan');
  assert.equal(typeof p.body.paymentGuarantee, 'boolean', 'own_share staat standaard aan');
  // C heeft geen band met A
  assert.equal((await api('/api/instant-reality/partner', { van: A.codenaam }, C.token)).status, 403);
  global.bandId = v.body.band.id; global.delingId = d.body.deling.id;
});

test('permissions.friends bepaalt wat de partner ziet, en intrekken sluit de deur', async () => {
  const eigen = (await api('/api/instant-reality', {}, A.token)).body;
  const z = await api('/api/instant-reality/event', { type: 'permissions.friends', value: ['own_share', 'iets-anders'], version: eigen.version }, A.token);
  assert.equal(z.status, 200, JSON.stringify(z.body));
  assert.deepEqual(z.body.universe.permissions.friends, ['own_share'], 'alleen bekende keuzes blijven staan');
  const p = (await api('/api/instant-reality/partner', { van: A.codenaam }, B.token)).body;
  assert.equal(p.providers, undefined, 'zonder itinerary geen providers');
  assert.equal(p.arrivalWindow, undefined, 'en geen aankomstvenster');
  assert.equal(typeof p.paymentGuarantee, 'boolean');
  // de eigen voorvertoning volgt dezelfde keuze
  const voor = (await api('/api/instant-reality/partner', {}, A.token)).body;
  assert.equal(voor.providers, undefined);
  // intrekken
  const t = await api('/api/leven/deel/in', { delingId: global.delingId }, A.token);
  assert.equal(t.status, 200, JSON.stringify(t.body));
  assert.equal((await api('/api/instant-reality/partner', { van: A.codenaam }, B.token)).status, 403);
});

test('een partner-lezing maakt geen wereld aan voor de eigenaar', async () => {
  const D = await lid();
  const v = await api('/api/leven/band/vraag', { codenaam: B.codenaam, soort: 'partner', vervalt: dag(200) }, D.token);
  await api('/api/leven/band/bevestig', { bandId: v.body.band.id }, B.token);
  await api('/api/leven/deel/zet', { bandId: v.body.band.id, stuk: 'afspraken', vervalt: dag(30) }, D.token);
  const p = await api('/api/instant-reality/partner', { van: D.codenaam }, B.token);
  assert.equal(p.status, 404, 'D heeft nog geen wereld; er wordt er geen voor hem gemaakt');
});
