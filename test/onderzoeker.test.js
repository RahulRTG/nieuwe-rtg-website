/* De Onderzoeker: de tweede AI van het RTG Kantoor. De RTG AI bouwt hem met
   zijn meelees-kennis als leerstof; daarna doet hij agentisch onderzoek
   (plan, bronnen, analyse, rapport) en adviseert hij alleen.
   Draai los: node --experimental-sqlite --test test/onderzoeker.test.js */
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
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ondz-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTGAI_MS: '0' } });
  base = srv.base;
  office = (await api(base, '/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.ok(office, 'kantoor-login geeft een token');
});
test.after(() => stop(srv && srv.child));

let rapportId;

test('1. de Onderzoeker begint in ontwikkeling en doet dan nog geen onderzoek', async () => {
  const s = (await api(base, '/api/office/onderzoeker', {}, office)).body;
  assert.equal(s.fase, 'in-ontwikkeling');
  assert.equal(s.bouwstappen, 0);
  const teVroeg = await api(base, '/api/office/onderzoeker/onderzoek', { vraag: 'Hoe druk is het?' }, office);
  assert.equal(teVroeg.status, 400);
  assert.match(teVroeg.body.error, /in ontwikkeling/);
});

test('2. de RTG AI bouwt hem stap voor stap af, met zijn meelees-kennis als leerstof', async () => {
  // wat verkeer genereren zodat de leerstof (waarnemingen) rijker is; de
  // kantoor-inlog zelf is overigens al meegelezen: de RTG AI ziet alles
  for (let i = 0; i < 6; i++) { await fetch(base + '/api/health'); await api(base, '/api/gids/app', { pad: '/apps/rtgkantoor.html' }); }
  assert.ok((await api(base, '/api/office/rtgai', {}, office)).body.waarnemingen > 0, 'de bouwer heeft leerstof');
  let laatste = null;
  for (let i = 0; i < 5; i++) laatste = (await api(base, '/api/office/onderzoeker/ontwikkel', {}, office)).body;
  assert.equal(laatste.fase, 'onderzoeksklaar', 'na vijf bouwstappen is hij af');
  // de bouw staat in BEIDE journaals: bij de Onderzoeker en bij de bouwer zelf
  const s = (await api(base, '/api/office/onderzoeker', {}, office)).body;
  assert.ok(s.logboek.some(j => j.soort === 'bouw'), 'het bouwlogboek van de Onderzoeker');
  const ai = (await api(base, '/api/office/rtgai', {}, office)).body;
  assert.ok(ai.journaal.some(j => j.soort === 'bouw' && /Onderzoeker/.test(j.tekst)), 'de RTG AI schreef de bouw in zijn eigen journaal');
  // en nog een bouwstap is klaar-af: netjes geweigerd
  assert.equal((await api(base, '/api/office/onderzoeker/ontwikkel', {}, office)).status, 400);
});

test('3. een onderzoek loopt agentisch: plan, bronnen, analyse en een rapport met echte cijfers', async () => {
  const r = await api(base, '/api/office/onderzoeker/onderzoek', { vraag: 'Hoe staan de partners en de vrachtstromen ervoor?' }, office);
  assert.equal(r.status, 200);
  const rap = r.body.rapport;
  rapportId = rap.id;
  const soorten = rap.stappen.map(st => st.soort);
  assert.equal(soorten[0], 'plan', 'het begint met een plan');
  assert.ok(soorten.filter(x => x === 'bron').length >= 2, 'meerdere bron-stappen (partners en vracht passen bij de vraag)');
  assert.ok(soorten.includes('analyse') && soorten.at(-1) === 'rapport', 'analyse en een afsluitend rapport');
  assert.ok(rap.bevindingen.some(b => /partners over/.test(b)), 'echte partnercijfers in de bevindingen');
  assert.ok(rap.bevindingen.some(b => /zendingen/.test(b)), 'echte vrachtcijfers in de bevindingen');
  assert.match(rap.advies, /mens beslist/, 'adviseren, niet beslissen');
});

test('4. rapporten zijn terug te lezen; zonder kantoor-inlog is alles dicht', async () => {
  const terug = await api(base, '/api/office/onderzoeker/rapport', { id: rapportId }, office);
  assert.equal(terug.status, 200);
  assert.equal(terug.body.rapport.id, rapportId);
  assert.equal((await api(base, '/api/office/onderzoeker/rapport', { id: 'bestaatniet' }, office)).status, 404);
  assert.equal((await api(base, '/api/office/onderzoeker')).status, 401);
  assert.equal((await api(base, '/api/office/onderzoeker/onderzoek', { vraag: 'x' })).status, 401);
});
