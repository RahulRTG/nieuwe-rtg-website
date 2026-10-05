/* DE BEELDKEUZE VAN EEN GEZINSPROFIEL BLIJFT VAN DAT PROFIEL.
   routes/presentatie-gezinsbeelden.js (#413) laat een gekozen gezinsprofiel eigen
   foto's kiezen voor zijn schermen. De poort is rtf.verifieerProfiel(code, token)
   en de sleutel komt uit DIE sessie -- nooit uit het verzoek. Deze toets houdt
   drie dingen vast: zonder profielsessie opent geen van de acht deuren iets, een
   profiel ziet en kiest alleen zijn eigen bestanden, en een ander gezin krijgt op
   hetzelfde bestands-id een 404 en geen foto. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const DEUREN = ['/api/foundation/gezin/beelden', '/api/foundation/gezin/beelden/zet',
  '/api/foundation/gezin/beelden/mijn', '/api/foundation/gezin/beelden/haal',
  '/api/foundation/gezin/beelden/upstart', '/api/foundation/gezin/beelden/updeel',
  '/api/foundation/gezin/beelden/upklaar', '/api/foundation/gezin/beelden/upload'];

let srv;
test.before(async () => { srv = await startServer({ env: { RTG_DEMO: '0', RTG_AI_UIT: '1', SMTP_URL: '' } }); });
test.after(async () => { if (srv) await stop(srv.child); });

async function post(pad, body) {
  const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  let j = null; try { j = await r.json(); } catch (_) { /* geen json */ }
  return { status: r.status, body: j };
}
async function profiel(naam) {
  const f = (await post('/api/foundation/gezin/maak', { gezinsnaam: naam, naam: 'Ouder', pin: '1234', bevoegdGezin: true, privacyAkkoord: true })).body;
  const c = (await post('/api/foundation/gezin/profiel/maak', { code: f.code, token: f.token, naam: 'Kind', rol: 'kind', geboortedatum: '2015-04-04', pin: '5678' })).body;
  const k = (await post('/api/foundation/gezin/profiel/kies', { gezinscode: f.gezinscode, profielId: c.profiel.id, pin: '5678' })).body;
  return { code: f.code, token: k.token };
}

test('zonder gezinsprofiel opent geen van de acht deuren iets', async () => {
  for (const pad of DEUREN) {
    assert.equal((await post(pad, {})).status, 401, pad + ' hoort zonder profiel te weigeren');
    assert.equal((await post(pad, { code: 'BESTAATNIET', token: 'x' })).status, 401, pad + ' met een verzonnen sessie');
  }
});

test('een profiel kiest alleen uit zijn eigen bestanden, en een ander gezin krijgt 404', async () => {
  const a = await profiel('Gezin Eigen');
  const b = await profiel('Gezin Buren');
  const up = await post('/api/foundation/gezin/beelden/upload', { ...a, naam: 'sfeer.png', dataUrl: PNG });
  assert.equal(up.status, 200, JSON.stringify(up.body));
  const id = up.body.id;
  assert.ok(id, 'de upload geeft een bestands-id terug');

  const mijn = await post('/api/foundation/gezin/beelden/mijn', a);
  assert.equal(mijn.status, 200);
  assert.ok(mijn.body.items.some(f => f.id === id), 'het profiel ziet zijn eigen foto');
  assert.ok(!(await post('/api/foundation/gezin/beelden/mijn', b)).body.items.some(f => f.id === id),
    'het andere gezin ziet hem niet');

  const uitsnede = { x: 50, y: 50, zoom: 1 };
  const zet = await post('/api/foundation/gezin/beelden/zet', { ...a, slot: 'foundation/sfeer', image: { file: id, desktop: uitsnede, mobile: uitsnede } });
  assert.equal(zet.status, 200, JSON.stringify(zet.body));
  assert.equal((await post('/api/foundation/gezin/beelden', a)).body.images['foundation/sfeer'].file, id);

  assert.equal((await post('/api/foundation/gezin/beelden/haal', { ...a, id })).status, 200, 'eigen foto ophalen mag');
  assert.equal((await post('/api/foundation/gezin/beelden/haal', { ...b, id })).status, 404, 'andermans foto is er niet');
  assert.equal((await post('/api/foundation/gezin/beelden/zet', { ...b, slot: 'foundation/sfeer', image: { file: id, desktop: uitsnede, mobile: uitsnede } })).status, 404,
    'andermans foto kan niet op je eigen scherm');
  assert.deepEqual((await post('/api/foundation/gezin/beelden', b)).body.images, {}, 'de keuze van A lekt niet naar B');
});

test('de opgeknipte upload loopt achter dezelfde profielpoort', async () => {
  const a = await profiel('Gezin Stukken');
  const start = await post('/api/foundation/gezin/beelden/upstart', { ...a, naam: 'groot.png', grootte: 10, mime: 'image/png' });
  assert.notEqual(start.status, 401, 'met een profielsessie komt upstart langs de poort');
  const deel = await post('/api/foundation/gezin/beelden/updeel', { ...a, uploadId: 'bestaat-niet', stuk: '' });
  assert.notEqual(deel.status, 401);
  assert.ok(deel.status >= 400, 'een onbekende upload wordt geweigerd');
  const klaar = await post('/api/foundation/gezin/beelden/upklaar', { ...a, uploadId: 'bestaat-niet' });
  assert.notEqual(klaar.status, 401);
  assert.ok(klaar.status >= 400, 'een onbekende upload wordt niet afgerond');
});
