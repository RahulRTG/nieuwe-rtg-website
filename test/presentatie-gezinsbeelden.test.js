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
const { startServer, stop, keurLidGoed } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const DEUREN = ['/api/foundation/gezin/beelden', '/api/foundation/gezin/beelden/zet',
  '/api/foundation/gezin/beelden/mijn', '/api/foundation/gezin/beelden/haal',
  '/api/foundation/gezin/beelden/upstart', '/api/foundation/gezin/beelden/updeel',
  '/api/foundation/gezin/beelden/upklaar', '/api/foundation/gezin/beelden/upload'];

let srv;
/* De accountplicht staat AAN: buiten de demo bestaat een anoniem gezin niet meer
   (eigenaarsbesluit 19 oktober 2026). Het gezin hangt hier dus aan een gratis
   account van een ouder; de demo is er alleen om die ouder door een kantoormens
   op naam te laten keuren, wat een kind in het gezin vraagt. */
test.before(async () => { srv = await startServer({ env: { RTG_MAGNAAT_TEST: '1', RTF_GEZIN_ACCOUNTPLICHT: '1', RTG_AI_UIT: '1', SMTP_URL: '' } }); });
test.after(async () => { if (srv) await stop(srv.child); });

async function post(pad, body, tok) {
  const r = await fetch(srv.base + pad, { method: 'POST', body: JSON.stringify(body || {}),
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}) });
  let j = null; try { j = await r.json(); } catch (_) { /* geen json */ }
  return { status: r.status, body: j };
}
async function profiel(naam) {
  const ouder = await registreerGratis(srv.base);
  assert.ok(ouder, 'een gratis account van de ouder');
  await keurLidGoed(srv.base, ouder.token, ouder.codenaam);
  const f = (await post('/api/rtf/eigen-gezin/maak', { gezinsnaam: naam, naam: 'Ouder', bevoegdGezin: true, privacyAkkoord: true }, ouder.token)).body;
  const c = (await post('/api/rtf/eigen-gezin/kind', { naam: 'Kind', geboortedatum: '2015-04-04' }, ouder.token)).body;
  const k = (await post('/api/rtf/eigen-gezin/sessie', { profielId: c.profiel.id }, ouder.token)).body;
  assert.ok(k.token, 'het kind komt binnen via het account van de ouder');
  return { code: f.code, token: k.token };
}

test('zonder gezinsprofiel opent geen van de acht deuren iets', async () => {
  for (const pad of DEUREN) {
    assert.equal((await post(pad, {})).status, 401, pad + ' hoort zonder profiel te weigeren');
    assert.equal((await post(pad, { code: 'BESTAATNIET', token: 'x' })).status, 401, pad + ' met een verzonnen sessie');
  }
});

test('een eigen ledenaccount krijgt zijn beeldkeuzes terug', async () => {
  const lid = (await post('/api/auth/register', { name:'Beeldkeuze', email:'beeldkeuze@test.invalid',
    phone:'0611112222', password:'geheim123', geboortedatum:'1990-01-01', tier:'rtg' })).body;
  assert.ok(lid.token);
  const r = await fetch(srv.base + '/api/ik/beelden', { method:'POST',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+lid.token}, body:'{}' });
  assert.equal(r.status,200);
  assert.deepEqual((await r.json()).images,{},'een nieuw account heeft een eigen, leeg overzicht');
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
