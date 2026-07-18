/* RTG Flits: de rijhulp van het netwerk. Meldingen op codenaam met
   houdbaarheid; een tweede melding dichtbij telt als bevestiging; drie keer
   "weg" haalt een melding eraf; landregels zetten flitsermeldingen uit waar
   ze verboden zijn; en er is bewust geen enkele spelmechaniek. Draai los:
   node --experimental-sqlite --test test/flits.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-flits-'));
const IBIZA = { lat: 38.9089, lng: 1.433 };

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
// elk lid een eigen account (eigen sleutel), zodat de rate-limit per melder echt per persoon is
let seq = 0;
async function lid(tier) {
  if (tier === 'guest') return (await api('/api/login', { tier: 'guest' })).body.token;
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', {
    name: 'Lid ' + seq, email: 'f' + u + '@x.nl', phone: '06' + u, password: 'geheim123',
    geboortedatum: '1990-05-05', geslacht: 'v', tier: tier || 'rtg', pasApp: tier || 'rtg'
  });
  return reg.body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. melden en zien: een lid meldt, het netwerk ziet het met afstand en codenaam', async () => {
  const a = await lid('rtg'), b = await lid('lifestyle');
  const gast = await lid('guest');
  const dicht = await api('/api/flits/rond', { ...IBIZA, land: 'ES' }, gast);
  assert.equal(dicht.status, 403, 'gasten rijden niet mee');
  const m = await api('/api/flits/meld', { soort: 'flitser', ...IBIZA, land: 'ES' }, a);
  assert.equal(m.status, 200);
  const rond = await api('/api/flits/rond', { lat: IBIZA.lat + 0.01, lng: IBIZA.lng, land: 'ES' }, b);
  assert.equal(rond.status, 200);
  const f = (rond.body.meldingen || []).find(x => x.soort === 'flitser');
  assert.ok(f, 'de melding is zichtbaar voor het netwerk');
  assert.ok(f.afstandKm >= 0.5 && f.afstandKm <= 3, 'met een kloppende afstand');
  assert.ok(f.door && !/Lid |Prins|Vidal/.test(f.door), 'de melder staat er op codenaam, nooit met echte naam');
  assert.ok(!('punten' in rond.body) && !('score' in f), 'geen spelmechaniek in het antwoord');
});

test('2. dichtbij dezelfde soort melden is bevestigen, geen tweede melding', async () => {
  const c = await lid('business');
  const m = await api('/api/flits/meld', { soort: 'flitser', lat: IBIZA.lat + 0.001, lng: IBIZA.lng, land: 'ES' }, c);
  assert.equal(m.status, 200);
  assert.equal(m.body.bevestigd, true, 'binnen 300 m telt de tik als bevestiging');
  const rond = await api('/api/flits/rond', { ...IBIZA, land: 'ES' }, c);
  assert.equal((rond.body.meldingen || []).filter(x => x.soort === 'flitser').length, 1, 'er blijft een flitser staan');
  assert.equal(rond.body.meldingen.find(x => x.soort === 'flitser').bevestigingen, 1);
});

test('3. rustig aan: direct nog een keer melden wordt vriendelijk geweigerd', async () => {
  const d = await lid('rtg');
  const eerste = await api('/api/flits/meld', { soort: 'file', lat: IBIZA.lat + 0.05, lng: IBIZA.lng, land: 'ES' }, d);
  assert.equal(eerste.status, 200);
  const tweede = await api('/api/flits/meld', { soort: 'ongeval', lat: IBIZA.lat + 0.06, lng: IBIZA.lng, land: 'ES' }, d);
  assert.equal(tweede.status, 429, 'de rate-limit houdt spam tegen');
});

test('4. drie keer "weg" haalt een melding eraf; elke stem telt een keer', async () => {
  const melder = await lid('rtg');
  const m = await api('/api/flits/meld', { soort: 'object', lat: IBIZA.lat - 0.05, lng: IBIZA.lng, land: 'ES' }, melder);
  const id = m.body.melding.id;
  const s1 = await api('/api/flits/stem', { id, klopt: false }, await lid('rtg'));
  assert.equal(s1.body.weg, false);
  const kiezer = await lid('lifestyle');
  await api('/api/flits/stem', { id, klopt: false }, kiezer);
  const dubbel = await api('/api/flits/stem', { id, klopt: false }, kiezer);
  assert.equal(dubbel.body.al, true, 'dezelfde stemmer telt niet dubbel');
  const s3 = await api('/api/flits/stem', { id, klopt: false }, await lid('business'));
  assert.equal(s3.body.weg, true, 'drie stemmen "weg" en de melding is weg');
  const rond = await api('/api/flits/rond', { lat: IBIZA.lat - 0.05, lng: IBIZA.lng, land: 'ES' }, melder);
  assert.ok(!(rond.body.meldingen || []).some(x => x.id === id));
});

test('5. landregels: waar flitsermeldingen verboden zijn, doen we ze niet', async () => {
  const e = await lid('rtg');
  const meld = await api('/api/flits/meld', { soort: 'flitser', ...IBIZA, land: 'FR' }, e);
  assert.equal(meld.status, 403, 'melden geweigerd met uitleg');
  assert.ok(/wettelijk/.test(meld.body.error));
  const rond = await api('/api/flits/rond', { ...IBIZA, land: 'FR' }, e);
  assert.equal(rond.body.flitsToegestaan, false);
  assert.ok(!(rond.body.meldingen || []).some(x => x.soort === 'flitser'), 'bestaande flitsers verschijnen daar niet');
  assert.ok((rond.body.meldingen || []).some(x => x.soort === 'file'), 'file- en gevaarmeldingen blijven aan');
});

test('6. chauffeurs melden mee via de PDA en de vooruitblik kijkt 12 uur vooruit', async () => {
  const roster = await api('/api/supplier/roster', { code: 'MKKX' });
  const w = (roster.body.staff || []).find(x => x.role !== 'manager');
  const pda = (await api('/api/supplier/login', { code: 'MKKX', staffId: w.id, pin: '5678' })).body.token;
  const m = await api('/api/staff/flits/meld', { soort: 'wegwerk', lat: IBIZA.lat + 0.09, lng: IBIZA.lng, land: 'ES' }, pda);
  assert.equal(m.status, 200, 'het eigen netwerk meldt ook vanaf de PDA');
  const v = await api('/api/flits/vooruit', { stad: 'Ibiza' }, await lid('rtg'));
  assert.equal(v.status, 200);
  assert.equal((v.body.uurbeeld || []).length, 12, 'de Ghost Driver-motor levert de vooruitblik');
});
