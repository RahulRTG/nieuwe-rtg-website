/* RTF-golf 4: de geldschool -- klusjes (sterren), weekgeld en het
   zakgeldpotje als een geheel. Ouder beslist, kind ziet alles terug,
   de eer (ranglijst) blijft staan na verzilveren.
   Draai los: node --test test/rtfgeld.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-geld-'));
let child;

const api = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const tiener = (actie, body) => fetch(BASE + '/api/rtf/tiener/' + actie, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let g, ouder, kind, kindId;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
  const gz = await api('/gezin/maak', { gezinsnaam: 'Fam Geldschool', naam: 'Pap', pin: '1234' });
  g = gz.body;
  ouder = { code: g.code, token: g.token };
  const k = await api('/gezin/profiel/maak', Object.assign({}, ouder, { naam: 'Mila', rol: 'kind', groep: 'tiener' }));
  kindId = k.body.profiel.id;
  kind = { code: g.code, token: (await api('/gezin/profiel/kies', { code: g.code, profielId: kindId })).body.token };
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. weekgeld: de eerste week boekt meteen, en nooit dubbel binnen dezelfde week', async () => {
  const r = await api('/gezin/geldschool/weekgeld', Object.assign({}, ouder, { pid: kindId, centenPerWeek: 250 }));
  assert.equal(r.status, 200);
  let p = await tiener('potje', kind);
  assert.equal(p.body.saldoCenten, 250, 'de week begint nu: de eerste boeking staat er meteen');
  assert.ok(p.body.transacties.find(t => /Zakgeld/.test(t.wat) && t.centen === 250));
  assert.equal(p.body.weekgeldCenten, 250, 'het potje vertelt het kind wat zijn weekgeld is');
  p = await tiener('potje', kind);
  assert.equal(p.body.saldoCenten, 250, 'nog een keer kijken boekt niets dubbel');
  // alleen een ouder gaat over het weekgeld
  assert.equal((await api('/gezin/geldschool/weekgeld', Object.assign({}, kind, { pid: kindId, centenPerWeek: 9999 }))).status, 403);
});

test('2. sterren verzilveren: de ouder kiest het bedrag, de eer blijft staan', async () => {
  // de klusketen: klaarzetten -> gedaan -> goedkeuren = 3 sterren
  const kl = await api('/gezin/klus', Object.assign({}, ouder, { titel: 'Auto wassen', sterren: 3, voor: kindId }));
  await api('/gezin/klus/gedaan', Object.assign({}, kind, { klusId: kl.body.klus.id }));
  await api('/gezin/klus/keur', Object.assign({}, ouder, { klusId: kl.body.klus.id, goed: true }));
  let o = await api('/gezin/geldschool', ouder);
  let mila = o.body.kinderen.find(x => x.id === kindId);
  assert.equal(mila.beschikbaar, 3);
  // verzilveren: 2 sterren voor 1 euro, door de ouder
  const v = await api('/gezin/geldschool/verzilver', Object.assign({}, ouder, { pid: kindId, sterren: 2, centen: 100 }));
  assert.equal(v.status, 200);
  assert.equal(v.body.beschikbaar, 1);
  const p = await tiener('potje', kind);
  assert.equal(p.body.saldoCenten, 350, 'het potje groeit met het gekozen bedrag');
  assert.ok(p.body.transacties.find(t => /Sterren verzilverd \(2\)/.test(t.wat)));
  o = await api('/gezin/geldschool', ouder);
  mila = o.body.kinderen.find(x => x.id === kindId);
  assert.equal(mila.sterren, 3, 'de ranglijst-eer blijft gewoon staan');
  assert.equal(mila.beschikbaar, 1, 'alleen het beschikbare saldo daalt');
  // meer verzilveren dan er openstaat kan niet, en het kind zelf ook niet
  assert.equal((await api('/gezin/geldschool/verzilver', Object.assign({}, ouder, { pid: kindId, sterren: 5, centen: 100 }))).status, 400);
  assert.equal((await api('/gezin/geldschool/verzilver', Object.assign({}, kind, { pid: kindId, sterren: 1, centen: 100 }))).status, 403);
});

test('3. weekgeld uitzetten en het overzicht kloppen tot op de cent', async () => {
  const r = await api('/gezin/geldschool/weekgeld', Object.assign({}, ouder, { pid: kindId, centenPerWeek: 0 }));
  assert.equal(r.body.weekgeldCenten, 0);
  const o = await api('/gezin/geldschool', ouder);
  const mila = o.body.kinderen.find(x => x.id === kindId);
  assert.equal(mila.weekgeldCenten, 0, 'uit is uit');
  const p = await tiener('potje', kind);
  assert.equal(p.body.saldoCenten, 350, 'uitzetten pakt niets terug: geboekt is geboekt');
  assert.equal(p.body.weekgeldCenten, 0);
});
