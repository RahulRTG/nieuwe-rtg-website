/* RTG Alpine: het wintersport- en seizoensresort (demo Val d'Aurora).
   Bewaakt de pistes en liften, de lawineregel (alleen de berggids zet het
   niveau, en vanaf 4 gaan de zwarte pistes dicht en blijven ze dicht),
   skipassen, materiaalverhuur, de skischool met vol-is-vol en
   instructeur-agenda, chalets zonder overlap en de cap-poorten.
   Draai los: node --experimental-sqlite --test test/alpine.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, berg, resto;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-alp-'));
const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function supLogin(code) {
  const roster = await api('supplier/roster', { code });
  const manager = (roster.body.staff || []).find(x => x.role === 'manager');
  return (await api('supplier/login', { code, staffId: manager.id, pin: '1234' })).body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  berg = await supLogin('VALAURA');
  resto = await supLogin('KIKUNOI');
  assert.ok(berg && resto, 'de resortmanager en het restaurant zijn binnen');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de berg op een scherm: pistes, liften, chalets en KPI\'s', async () => {
  const r = await api('supplier/alpine', {}, berg);
  assert.equal(r.status, 200);
  assert.equal(r.body.naam, "Val d'Aurora");
  assert.equal(r.body.pistes.length, 5);
  assert.ok(r.body.liften.length >= 3 && r.body.chalets.length >= 2);
  assert.equal(r.body.kpi.lawine, 2);
  assert.match(r.body.regel, /berggids/);
});

test('2. de lawineregel: niveau 4 sluit de zwarte pistes, en die blijven dicht', async () => {
  const zet = await api('supplier/alpine/lawine', { niveau: 4 }, berg);
  assert.equal(zet.status, 200);
  assert.equal(zet.body.gesloten.length, 2, 'beide zwarte pistes gaan uit voorzorg dicht');
  const o = await api('supplier/alpine', {}, berg);
  assert.ok(o.body.pistes.filter(p => p.kleur === 'zwart').every(p => p.status === 'dicht'));
  const open = await api('supplier/alpine/piste', { id: 'p4', status: 'open' }, berg);
  assert.equal(open.status, 409, 'bij niveau 4 gaat een zwarte piste niet open');
  await api('supplier/alpine/lawine', { niveau: 2 }, berg);
  assert.equal((await api('supplier/alpine/piste', { id: 'p4', status: 'open' }, berg)).status, 200, 'bij niveau 2 kan het weer');
  assert.equal((await api('supplier/alpine/lawine', { niveau: 7 }, berg)).status, 400);
});

test('3. skipassen en de liften', async () => {
  const pas = await api('supplier/alpine/pas', { naam: 'Julia Berg', dagen: 6 }, berg);
  assert.equal(pas.status, 200);
  assert.match(pas.body.pas.id, /^SKI-[0-9A-F]{4}$/);
  assert.equal(pas.body.pas.prijs, 6 * 69);
  assert.equal((await api('supplier/alpine/pas', { naam: 'X', dagen: 20 }, berg)).status, 400, 'maximaal veertien dagen');
  assert.equal((await api('supplier/alpine/lift', { id: 'l3', status: 'dicht' }, berg)).body.lift.status, 'dicht');
});

test('4. materiaalverhuur: prijs per dag maal de set, en inleveren maar een keer', async () => {
  const h = await api('supplier/alpine/huur', { naam: 'Daan Kuipers', dagen: 3, items: ['m1', 'm3'] }, berg);
  assert.equal(h.status, 200);
  assert.equal(h.body.verhuur.prijs, (28 + 6) * 3);
  assert.equal((await api('supplier/alpine/huur', { naam: 'X', dagen: 3, items: [] }, berg)).status, 400, 'zonder materiaal geen verhuur');
  assert.equal((await api('supplier/alpine/huur/in', { id: h.body.verhuur.id }, berg)).status, 200);
  assert.equal((await api('supplier/alpine/huur/in', { id: h.body.verhuur.id }, berg)).status, 409, 'al ingeleverd');
});

test('5. de skischool: groepsles vol is vol, en de instructeur staat niet dubbel op de piste', async () => {
  const o = await api('supplier/alpine', {}, berg);
  const les = o.body.groepslessen.find(l => l.capaciteit === 6);
  for (let i = 0; i < 6; i++) {
    assert.equal((await api('supplier/alpine/groep/in', { lesId: les.id, naam: 'Deelnemer ' + i }, berg)).status, 200);
  }
  assert.equal((await api('supplier/alpine/groep/in', { lesId: les.id, naam: 'Te laat' }, berg)).status, 409);
  const l1 = await api('supplier/alpine/prive', { instructeurId: 'i1', naam: 'Julia Berg', datum: morgen, tijd: '10:00' }, berg);
  assert.equal(l1.status, 200);
  assert.equal(l1.body.les.prijs, 95);
  assert.equal((await api('supplier/alpine/prive', { instructeurId: 'i1', naam: 'Daan', datum: morgen, tijd: '10:00' }, berg)).status, 409);
  assert.equal((await api('supplier/alpine/prive', { instructeurId: 'i2', naam: 'Daan', datum: morgen, tijd: '10:00' }, berg)).status, 200, 'de andere instructeur kan wel');
  assert.equal((await api('supplier/alpine/prive/klaar', { id: l1.body.les.id }, berg)).body.les.status, 'gegeven');
});

test('6. de chalets: een week boeken, en overlap wordt geweigerd', async () => {
  const b = await api('supplier/alpine/chalet', { chaletId: 'c1', naam: 'Fam. Vermeer', van: morgen, nachten: 7 }, berg);
  assert.equal(b.status, 200);
  assert.equal(b.body.boeking.prijs, 7 * 480);
  const over3 = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10);
  assert.equal((await api('supplier/alpine/chalet', { chaletId: 'c1', naam: 'Ander gezin', van: over3, nachten: 2 }, berg)).status, 409, 'midden in de week van een ander');
  assert.equal((await api('supplier/alpine/chalet', { chaletId: 'c2', naam: 'Ander gezin', van: over3, nachten: 2 }, berg)).status, 200, 'het andere chalet kan wel');
});

test('7. de poorten: zonder alpine-cap 403, zonder inlog 401', async () => {
  assert.equal((await api('supplier/alpine', {}, resto)).status, 403, 'een restaurant is geen resort');
  assert.equal((await api('supplier/alpine/lawine', { niveau: 3 }, resto)).status, 403);
  assert.equal((await api('supplier/alpine')).status, 401);
});
