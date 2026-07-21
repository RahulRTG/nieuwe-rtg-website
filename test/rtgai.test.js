/* De RTG AI van het RTG Kantoor: leest mee, traint zichzelf, meldt zich
   klaar, en krijgt het roer ALLEEN via de knop; daarna draait het
   routinewerk automatisch door en de terug-knop werkt.
   Draai los: node --experimental-sqlite --test test/rtgai.test.js */
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

let srv, base, office;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtgai-'));
  // lage drempels en geen eigen timer: de test stuurt de trainingsrondes zelf
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTGAI_MS: '0',
    RTGAI_DREMPEL_WAARNEMINGEN: '25', RTGAI_DREMPEL_DOMEINEN: '3' } });
  base = srv.base;
  office = (await api(base, '/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.ok(office, 'kantoor-login geeft een token');
});
test.after(() => stop(srv && srv.child));

test('1. de AI begint met meelezen en doet NIETS; de tellers lopen mee met het verkeer', async () => {
  const s0 = (await api(base, '/api/office/rtgai', {}, office)).body;
  assert.equal(s0.fase, 'meelezen');
  assert.equal(s0.roerRondes, 0, 'geen enkele actie');
  // wat verkeer over meerdere domeinen genereren
  for (let i = 0; i < 12; i++) { await api(base, '/api/health'); await api(base, '/api/gids/app', { pad: '/apps/mall.html' }); await api(base, '/api/login', { tier: 'guest', pasApp: 'rtg' }); }
  const s1 = (await api(base, '/api/office/rtgai', {}, office)).body;
  assert.ok(s1.waarnemingen > s0.waarnemingen, 'hij leest mee');
  assert.ok(s1.domeinen >= 3, 'meerdere domeinen gezien');
  assert.equal(s1.roerRondes, 0, 'en doet nog steeds niets');
  // het roer opeisen voordat hij klaar is: geweigerd met uitleg
  const teVroeg = await api(base, '/api/office/rtgai/roer/geef', {}, office);
  if (s1.gereedheid.procent < 100) assert.equal(teVroeg.status, 400);
});

test('2. hij traint zichzelf klaar en MELDT dat; overnemen doet hij nooit zelf', async () => {
  const t = (await api(base, '/api/office/rtgai/train', {}, office)).body;
  assert.equal(t.fase, 'klaar-voor-roer', 'de drempels zijn gehaald; hij meldt zich klaar');
  const s = (await api(base, '/api/office/rtgai', {}, office)).body;
  assert.equal(s.gereedheid.procent, 100);
  assert.ok(s.journaal.some(j => j.soort === 'klaar' && /klaar voor/.test(j.tekst)), 'de klaar-melding staat in het journaal');
  assert.equal(s.roerRondes, 0, 'hij heeft het roer NIET zelf gepakt');
  // nog een trainingsronde verandert daar niets aan
  await api(base, '/api/office/rtgai/train', {}, office);
  assert.equal((await api(base, '/api/office/rtgai', {}, office)).body.fase, 'klaar-voor-roer');
});

test('3. de knop geeft het roer; daarna draait het routinewerk vlekkeloos door', async () => {
  const r = await api(base, '/api/office/rtgai/roer/geef', {}, office);
  assert.equal(r.status, 200);
  assert.equal(r.body.fase, 'aan-het-roer');
  // twee rondes aan het roer: elke ronde routinewerk + journaalregel
  await api(base, '/api/office/rtgai/train', {}, office);
  await api(base, '/api/office/rtgai/train', {}, office);
  const s = (await api(base, '/api/office/rtgai', {}, office)).body;
  assert.equal(s.fase, 'aan-het-roer');
  assert.ok(s.roerRondes >= 2, 'het routinewerk draait door');
  assert.ok(s.journaal.some(j => j.soort === 'roer' && /Alles draait door/.test(j.tekst)));
  // en het systeem blijft gewoon werken terwijl hij aan het roer staat
  assert.equal((await fetch(base + '/api/health')).status, 200);
  assert.equal((await api(base, '/api/gids/app', { pad: '/apps/rtgkantoor.html' })).status, 200);
});

test('4. het roer terug: de mens houdt het laatste woord, en zonder kantoor-inlog geen knoppen', async () => {
  const terug = await api(base, '/api/office/rtgai/roer/terug', {}, office);
  assert.equal(terug.status, 200);
  const s = (await api(base, '/api/office/rtgai', {}, office)).body;
  assert.equal(s.fase, 'klaar-voor-roer', 'terug naar klaarstaan; hij blijft meelezen');
  const voorRondes = s.roerRondes;
  await api(base, '/api/office/rtgai/train', {}, office);
  assert.equal((await api(base, '/api/office/rtgai', {}, office)).body.roerRondes, voorRondes, 'zonder roer geen acties meer');
  // zonder kantoor-inlog is alles dicht
  assert.equal((await api(base, '/api/office/rtgai')).status, 401);
  assert.equal((await api(base, '/api/office/rtgai/roer/geef')).status, 401);
});
