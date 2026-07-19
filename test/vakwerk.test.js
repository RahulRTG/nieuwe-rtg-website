/* Vakwerk: het slimme dashboard voor de dienstverlenende genres (zzp, chef,
   wellness). Zelfde aanbod-/boekingsmodel als voorheen, maar met een
   vandaag-bord, de aanvragen die op bevestiging wachten, het aanbod met
   boek-cijfers, omzet-KPI's en een genre-bewuste AI-assistent.
   Draai: node --experimental-sqlite --test test/vakwerk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid;
const tok = {};
const VANDAAG = new Date().toISOString().slice(0, 10);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vak-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function login(code, pin) {
  const roster = await api('/api/supplier/roster', { code });
  const chef = roster.body.staff.find(m => m.role === 'manager');
  const r = await api('/api/supplier/login', { code, staffId: chef.id, pin });
  return r.body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const reg = await api('/api/auth/register', { name: 'Vak Lid', email: 'vak@x.nl', phone: '0612345677',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'lifestyle', pasApp: 'lifestyle' });
  lid = reg.body.token;
  for (const c of ['FUEGO', 'SERENA', 'AYAKA']) tok[c] = await login(c, '1234');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. het bord staat klaar met het aanbod; alle drie de genres krijgen er een', async () => {
  const b = await api('/api/supplier/vak/bord', {}, tok.FUEGO);
  assert.equal(b.status, 200);
  assert.equal(b.body.genre, 'chef');
  assert.equal(b.body.werkMv, 'opdrachten');
  assert.ok(b.body.aanbod.length >= 3, 'de geseede diensten staan in het aanbod');
  assert.equal(b.body.kpi.openAanvragen, 0, 'nog geen open aanvragen');
  // ook wellness en zzp krijgen hun eigen bord met het juiste label
  assert.equal((await api('/api/supplier/vak/bord', {}, tok.SERENA)).body.label, 'Wellness & spa');
  assert.equal((await api('/api/supplier/vak/bord', {}, tok.AYAKA)).body.label, 'Zelfstandig professional');
});

test('2. een betaalde boeking valt binnen: op het vandaag-bord en in de te-bevestigen-lijst', async () => {
  const boek = await api('/api/booking/request', { supplierCode: 'FUEGO', serviceId: 's1', date: VANDAAG, time: '19:00' }, lid);
  assert.equal(boek.status, 200);
  const ref = boek.body.boeking.ref;
  // deze chef rekent vooraf af; pas na betaling is het een echte aanvraag
  await api('/api/booking/pay', { ref }, lid);
  const b = await api('/api/supplier/vak/bord', {}, tok.FUEGO);
  assert.ok(b.body.teBevestigen.some(x => x.ref === ref), 'de aanvraag wacht op bevestiging');
  assert.ok(b.body.vandaag.some(x => x.ref === ref && x.tijd === '19:00'), 'en staat op het vandaag-bord');
  assert.equal(b.body.kpi.openAanvragen, 1);
  // op codenaam, niet op echte naam
  const rij = b.body.vandaag.find(x => x.ref === ref);
  assert.ok(rij.klant && !/Vak Lid/.test(rij.klant), 'de klant staat op codenaam');
});

test('3. bevestigen telt de bezetting; de betaalde omzet en de boek-cijfers kloppen', async () => {
  const boek = await api('/api/booking/request', { supplierCode: 'FUEGO', serviceId: 's3', date: VANDAAG, time: '11:00' }, lid);
  const ref = boek.body.boeking.ref;
  await api('/api/booking/pay', { ref }, lid);
  // de chef bevestigt
  const bev = await api('/api/supplier/booking/status', { ref, status: 'bevestigd' }, tok.FUEGO);
  assert.equal(bev.status, 200);
  const b = await api('/api/supplier/vak/bord', {}, tok.FUEGO);
  assert.ok(b.body.kpi.bezetUurVandaag >= 2, 's3 duurt 120 min, dus minstens 2 uur bezetting vandaag');
  assert.ok(!b.body.teBevestigen.some(x => x.ref === ref), 'bevestigd, dus uit de wachtlijst');
  assert.ok(b.body.kpi.omzetVandaag >= 480 + 145, 'de betaalde opdrachten tellen in de dagomzet');
  const s3 = b.body.aanbod.find(x => x.id === 's3');
  assert.equal(s3.boekingen, 1, 's3 is een keer geboekt');
  assert.ok(s3.omzet >= 480, 'met de bijbehorende omzet');
});

test('4. de AI-assistent doet concrete, genre-bewuste voorstellen', async () => {
  const r = await api('/api/supplier/vak/ai', { q: 'Waar moet ik me op richten?' }, tok.FUEGO);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.voorstellen) && r.body.voorstellen.length, 'er zijn voorstellen');
  assert.ok(r.body.antwoord.length > 15, 'en een leesbaar advies');
});

test('5. de grens: een niet-dienstverlenend genre krijgt geen vakwerk-bord', async () => {
  const kik = await api('/api/supplier/login', { username: 'rahul', password: 'Imran' });
  const b = await api('/api/supplier/vak/bord', {}, kik.body.token);
  assert.equal(b.status, 403, 'een restaurant hoort niet bij de dienstverleners');
});
