/* De interne lijn tussen collega's: het directe chatbericht (1-op-1, met
   ongelezen-tellers) en de interne call (signalering; alleen ingeklokte
   collega's zijn belbaar). Draai los:
   node --experimental-sqlite --test test/collegachat.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
let ana, bo;                 // twee collega-tokens van HOSHI
let anaId, boId;             // hun staff-ids
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-collega-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const inloggen = async (staffId, pin) => (await (await fetch(base + '/api/supplier/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: 'HOSHI', staffId, pin })
})).json()).token;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const roster = await api('supplier/roster', { code: 'HOSHI' });
  const staff = roster.body.staff || [];
  assert.ok(staff.length >= 2, 'HOSHI heeft minstens twee mensen op de vloer');
  // de demo-zaak: de manager heeft PIN 1234, de medewerker 5678
  anaId = staff.find(x => x.role === 'manager').id;
  boId = staff.find(x => x.role !== 'manager').id;
  ana = await inloggen(anaId, '1234');
  bo = await inloggen(boId, '5678');
  assert.ok(ana && bo, 'allebei de collegas zijn ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('direct bericht: heen en weer, met ongelezen-teller die leest op openen', async () => {
  // de collegalijst kent iedereen behalve jezelf
  const lijst = (await api('staff/dm/lijst', {}, ana)).body;
  assert.ok(lijst.collegas.length >= 1);
  assert.ok(!lijst.collegas.some(c => c.id === anaId), 'jezelf staat er niet tussen');
  assert.ok(lijst.collegas.some(c => c.id === boId), 'de collega wel');
  // sturen: het bericht komt aan en telt als ongelezen bij de ander
  const r = await api('staff/dm/send', { staffId: boId, text: 'Kun je tafel 4 overnemen?' }, ana);
  assert.equal(r.status, 200);
  assert.equal(r.body.messages.length, 1);
  await api('staff/dm/send', { staffId: boId, text: 'Ze wachten op de rekening.' }, ana);
  const bijBo = (await api('staff/dm/lijst', {}, bo)).body.collegas.find(c => c.id === anaId);
  assert.equal(bijBo.ongelezen, 2, 'twee ongelezen berichten');
  assert.ok(/rekening/.test(bijBo.laatste), 'de lijst toont het laatste bericht');
  // openen leest: de historie staat er en de teller gaat naar nul
  const gesprek = (await api('staff/dm/history', { staffId: anaId }, bo)).body;
  assert.equal(gesprek.messages.length, 2);
  assert.equal(gesprek.messages[0].van, anaId);
  assert.equal((await api('staff/dm/lijst', {}, bo)).body.collegas.find(c => c.id === anaId).ongelezen, 0);
  // terugschrijven: beide kanten zien hetzelfde gesprek
  await api('staff/dm/send', { staffId: anaId, text: 'Doe ik.' }, bo);
  const terug = (await api('staff/dm/history', { staffId: boId }, ana)).body;
  assert.equal(terug.messages.length, 3);
  assert.equal(terug.messages[2].van, boId);
  // grenzen: leeg bericht, naar jezelf en naar een vreemde ketsen af
  assert.equal((await api('staff/dm/send', { staffId: boId, text: '' }, ana)).status, 400);
  assert.equal((await api('staff/dm/send', { staffId: anaId, text: 'hoi' }, ana)).status, 404);
  assert.equal((await api('staff/dm/send', { staffId: 999999, text: 'hoi' }, ana)).status, 404);
});

test('interne call: alleen wie ingeklokt is, is belbaar', async () => {
  // niet ingeklokt: de lijn blijft dicht
  assert.equal((await api('staff/call', { kind: 'ring', staffId: boId }, ana)).status, 409);
  // de collega klokt in en is meteen bereikbaar
  assert.equal((await api('staff/clock', {}, bo)).body.actie, 'in');
  const lijst = (await api('staff/dm/lijst', {}, ana)).body;
  assert.ok(lijst.collegas.find(c => c.id === boId).binnen, 'de lijst ziet wie er binnen is');
  assert.equal((await api('staff/call', { kind: 'ring', staffId: boId }, ana)).status, 200);
  // gekke signalen en bellen naar jezelf ketsen af
  assert.equal((await api('staff/call', { kind: 'fluister', staffId: boId }, ana)).status, 400);
  assert.equal((await api('staff/call', { kind: 'ring', staffId: anaId }, ana)).status, 400);
  await api('staff/clock', {}, bo); // netjes weer uitklokken
});
