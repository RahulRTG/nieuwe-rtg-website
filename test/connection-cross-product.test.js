/* Bewijst dat veiligheid geen productgrens kent. Dit is een aparte suite boven
   de 58 bevroren producttests, zodat hun baseline zelf ongewijzigd blijft. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon, elevateTier } = require('./helper');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-connection-'));
let srv, base, office, teller = 0;

async function api(pad, body, token) {
  const r = await fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function lid() {
  const n = Date.now() + '-' + (++teller);
  const reg = await api('/api/auth/register', { name: 'Connection ' + n, email: 'connection-' + n + '@test.invalid',
    phone: '061' + String(Date.now()).slice(-7) + teller, password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg' });
  await elevateTier(base, reg.body.token, 'lifestyle', office);
  let st = await api('/api/state', {}, reg.body.token);
  const voor = st.body.state.user.codename;
  await api('/api/verify/upload', { image: PNG }, reg.body.token);
  await api('/api/verify/selfie', { image: PNG }, reg.body.token);
  const p = await api('/api/office/verifications', {}, office);
  const rij = (p.body.pending || []).find(x => x.codename === voor);
  assert.ok(rij, 'het lid staat bij de identiteitsbalie');
  await api('/api/office/verify', { userId: rij.id, decision: 'approve', faceMatch: true, geslacht: 'x' }, office);
  st = await api('/api/state', {}, reg.body.token);
  return { token: reg.body.token, codenaam: st.body.state.user.codename };
}

async function profielen(lid, merk, plek) {
  const v = await api('/api/vonk/profiel', { over: merk, stad: plek, lat: 52.1, lng: 4.3,
    leeftijdMin: 18, leeftijdMax: 99, maxKm: 500 }, lid.token);
  assert.equal(v.status, 200);
  const r = await api('/api/member/rendezvous/profiel/zet', { aan: true, over: merk, locaties: [plek] }, lid.token);
  assert.equal(r.status, 200);
}

test.before(async () => {
  srv = await startServer({ env: { RTG_DATA_DIR: TMP, RTG_ENC_KEY: 'connection-test-encryptiesleutel-123', SMTP_URL: '' } });
  base = srv.base;
  office = await kantoorAlsPersoon(base, 'RTG-OFFICE');
});

test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('blokkeren in een product sluit beide producten in beide richtingen', async () => {
  const a = await lid(), b = await lid(), c = await lid(), d = await lid();
  await profielen(a, 'paar-ab-a', 'Den Haag');
  await profielen(b, 'paar-ab-b', 'Den Haag');
  await profielen(c, 'paar-cd-c', 'Utrecht');
  await profielen(d, 'paar-cd-d', 'Utrecht');

  const voorA = await api('/api/member/rendezvous/kandidaten', {}, a.token);
  const bInA = voorA.body.kandidaten.find(x => x.codenaam === b.codenaam);
  assert.ok(bInA, 'B staat voor de blokkade in Rendez-vous bij A');
  const voorB = await api('/api/member/rendezvous/kandidaten', {}, b.token);
  const aInB = voorB.body.kandidaten.find(x => x.codenaam === a.codenaam);
  assert.equal((await api('/api/member/rendezvous/like', { id: bInA.id }, a.token)).status, 200);
  assert.equal((await api('/api/member/rendezvous/like', { id: aInB.id }, b.token)).status, 200);
  assert.equal((await api('/api/member/rendezvous/date', { id: bInA.id }, a.token)).status, 200,
    'Rahul kan voor de blokkade uitsluitend binnen een echte match werken');
  assert.equal((await api('/api/vonk/blokkeer', { codenaam: b.codenaam }, a.token)).status, 200);

  const naA = await api('/api/member/rendezvous/kandidaten', {}, a.token);
  const naB = await api('/api/member/rendezvous/kandidaten', {}, b.token);
  assert.ok(!naA.body.kandidaten.some(x => x.codenaam === b.codenaam), 'Vonk-blokkade verwijdert B uit Rendez-vous bij A');
  assert.ok(!naB.body.kandidaten.some(x => x.codenaam === a.codenaam), 'dezelfde grens werkt ook voor B');
  assert.equal((await api('/api/member/rendezvous/like', { id: bInA.id }, a.token)).status, 403,
    'een oud id omzeilt de blokkade niet');
  assert.equal((await api('/api/member/rendezvous/date', { id: bInA.id }, a.token)).status, 400,
    'Rahul ziet de geblokkeerde match bij de eerstvolgende request niet meer');

  const tafel = await api('/api/office/rendezvous/tafel/maak',
    { naam: 'Niet samen', plaatsen: 6, genodigden: [a.codenaam, b.codenaam] }, office);
  assert.equal(tafel.status, 409, 'ook het kantoor zet een geblokkeerd paar niet stil aan dezelfde tafel');

  const voorC = await api('/api/member/rendezvous/kandidaten', {}, c.token);
  const dInC = voorC.body.kandidaten.find(x => x.codenaam === d.codenaam);
  assert.ok(dInC, 'D staat voor de blokkade bij C');
  assert.equal((await api('/api/member/rendezvous/blokkeer', { id: dInC.id }, c.token)).status, 200);
  const vonkC = await api('/api/vonk/selectie', {}, c.token);
  const vonkD = await api('/api/vonk/selectie', {}, d.token);
  assert.ok(vonkC.body.mensen.length >= 1, 'C houdt andere geldige Vonk-kandidaten over');
  assert.ok(vonkD.body.mensen.length >= 1, 'D houdt andere geldige Vonk-kandidaten over');
  assert.ok(!vonkC.body.mensen.some(x => x.codenaam === d.codenaam), 'Rendez-vous-blokkade verwijdert D uit Vonk bij C');
  assert.ok(!vonkD.body.mensen.some(x => x.codenaam === c.codenaam), 'ook deze richting is wederzijds');
});
