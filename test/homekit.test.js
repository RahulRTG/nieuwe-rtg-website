/* De RTG Home Kit: alle elektronica op een plek, scenes met AI-hulp, en de
   vaste veiligheidsregel dat sloten nooit via een scene of de AI gaan.
   Draai los: node --experimental-sqlite --test test/homekit.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, lid;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-homekit-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const reg = await api(base, '/api/auth/register', { name: 'Thuis Baas', email: 'thuis@x.nl', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  assert.ok(lid);
});
test.after(() => stop(srv && srv.child));

test('1. de woning start ingericht: kamers met apparaten, en bedienen werkt begrensd', async () => {
  const r = await api(base, '/api/home', {}, lid);
  assert.equal(r.status, 200);
  assert.ok(r.body.kamers.length >= 6, 'meerdere kamers');
  const alle = r.body.kamers.flatMap(k => k.apparaten);
  assert.ok(alle.length >= 18, 'een volle woning');
  assert.ok(alle.some(a => a.soort === 'slot'), 'er is een slot');
  // een lamp aan en dimmen; buiten de grenzen wordt geklemd
  const zet = await api(base, '/api/home/zet', { id: 'lamp-woon', stand: { aan: true, dim: 999 } }, lid);
  assert.equal(zet.body.apparaat.stand.aan, true);
  assert.equal(zet.body.apparaat.stand.dim, 100, 'dimmen klemt op 100');
  const temp = await api(base, '/api/home/zet', { id: 'thermostaat', stand: { temp: 2 } }, lid);
  assert.equal(temp.body.apparaat.stand.temp, 5, 'temperatuur klemt op minimaal 5');
  assert.equal((await api(base, '/api/home/zet', { id: 'bestaat-niet', stand: {} }, lid)).status, 404);
  assert.equal((await api(base, '/api/home')).status, 401, 'zonder inlog geen woning');
});

test('2. de AI-scenemaker: filmavond wordt een doordacht voorstel ZONDER sloten', async () => {
  const r = await api(base, '/api/home/scene/ai', { wens: 'gezellige filmavond' }, lid);
  assert.equal(r.status, 200);
  const v = r.body.voorstel;
  assert.equal(v.naam, 'Filmavond');
  assert.ok(Object.keys(v.standen).length >= 4, 'meerdere apparaten in de scene');
  assert.equal(v.standen['tv-woon'].aan, true, 'de tv gaat aan');
  assert.ok(!('slot-voordeur' in v.standen), 'sloten zitten NOOIT in een scene');
  assert.equal((await api(base, '/api/home/scene/ai', { wens: '' }, lid)).status, 400);
  // zelfs als iemand een slot in een scene probeert te smokkelen, wast de server hem eruit
  const smokkel = await api(base, '/api/home/scene/bewaar', { naam: 'Truc', standen: { 'slot-voordeur': { opSlot: false }, 'lamp-hal': { aan: true } } }, lid);
  assert.equal(smokkel.status, 200);
  const huis = await api(base, '/api/home', {}, lid);
  const truc = huis.body.scenes.find(s => s.naam === 'Truc');
  assert.equal(truc.aantal, 1, 'alleen de lamp bleef over; het slot is eruit gewassen');
});

test('3. bewaren, starten en alles-uit: de scene zet de standen echt, sloten blijven met rust', async () => {
  const v = (await api(base, '/api/home/scene/ai', { wens: 'welterusten allemaal' }, lid)).body.voorstel;
  const b = await api(base, '/api/home/scene/bewaar', v, lid);
  assert.equal(b.status, 200);
  // eerst de voordeur openzetten (handmatig mag dat) om te zien dat de scene er vanaf blijft
  await api(base, '/api/home/zet', { id: 'slot-voordeur', stand: { opSlot: false } }, lid);
  const start = await api(base, '/api/home/scene/start', { id: b.body.id }, lid);
  assert.equal(start.status, 200);
  assert.ok(start.body.gezet >= 4);
  const huis = await api(base, '/api/home', {}, lid);
  const alle = huis.body.kamers.flatMap(k => k.apparaten);
  assert.equal(alle.find(a => a.id === 'lamp-slaap').stand.aan, true, 'bedlampjes aan');
  assert.equal(alle.find(a => a.id === 'tv-woon').stand.aan, false, 'tv uit');
  assert.equal(alle.find(a => a.id === 'slot-voordeur').stand.opSlot, false, 'het slot bleef zoals het lid het zette');
  // alles uit raakt lampen en apparaten, maar het slot en de laadpaal niet
  const uit = await api(base, '/api/home/alles-uit', {}, lid);
  assert.ok(uit.body.uitgezet >= 1);
  const na = (await api(base, '/api/home', {}, lid)).body.kamers.flatMap(k => k.apparaten);
  assert.ok(na.filter(a => 'aan' in a.stand && a.soort !== 'slot' && a.id !== 'laadpaal').every(a => !a.stand.aan));
  assert.equal(na.find(a => a.id === 'laadpaal').stand.aan, true, 'de laadpaal laadt gewoon door');
  // opruimen: scene weg
  assert.equal((await api(base, '/api/home/scene/weg', { id: b.body.id }, lid)).status, 200);
});
