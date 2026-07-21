/* RTG Airport (kern/luchthaven.js): de gehele luchthavenoperatie. Getest: de
   passagiersketen (boeken -> inchecken -> boarding pass + koffertags), de
   operationele grendels (een kist boardt pas als de draai rond is; zonder
   klaring van de toren vertrekt er niets; de keten draait nooit achteruit),
   vertragingen op het bord, de bagageketen met vermist/gevonden, de
   aankomstketen met de band, security-wachttijden en de AI-operations.
   Draai los: node --experimental-sqlite --test test/luchthaven.test.js */
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

let srv, base, lid, ops, partner;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lucht-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  lid = (await api(base, '/api/auth/register', { name: 'Reiziger Lucht', email: 'lu' + u + '@x.nl',
    phone: '064' + u.slice(1), password: 'geheim123', geboortedatum: '1988-06-06', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const roster = await api(base, '/api/supplier/roster', { code: 'LUCHT' });
  const man = roster.body.staff.find(m => m.role === 'manager');
  ops = (await api(base, '/api/supplier/login', { code: 'LUCHT', staffId: man.id, pin: '1234' })).body.token;
  partner = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
});
test.after(() => stop(srv && srv.child));

test('1. het bord staat klaar met de seed-vluchten, gates, banen en security-filters', async () => {
  const r = await api(base, '/api/lucht/bord', {}, ops);
  assert.equal(r.status, 200);
  assert.ok(r.body.vluchten.some(v => v.nummer === 'RT205' && v.status === 'inchecken'), 'RT205 staat open voor inchecken');
  assert.ok(r.body.vluchten.some(v => v.soort === 'aankomst'), 'er is een aankomst onderweg');
  assert.equal(r.body.gates.length, 6);
  assert.equal(r.body.banen.length, 2);
  assert.ok(r.body.security.length >= 3, 'de filters staan op het bord');
});

test('2. de passagiersketen: boeken, inchecken tijdens het venster, boarding pass met stoel en koffertags', async () => {
  const bord = await api(base, '/api/member/vluchten/bord', {}, lid);
  const dicht = bord.body.vluchten.find(v => v.nummer === 'RT101');
  const open = bord.body.vluchten.find(v => v.nummer === 'RT205');
  // boeken kan op beide, inchecken alleen als het venster open staat
  const b1 = await api(base, '/api/member/vluchten/boek', { id: dicht.id }, lid);
  assert.equal(b1.status, 200);
  assert.equal((await api(base, '/api/member/vluchten/boek', { id: dicht.id }, lid)).status, 409, 'niet dubbel op dezelfde vlucht');
  assert.equal((await api(base, '/api/member/vluchten/incheck', { code: b1.body.boeking.code }, lid)).status, 409, 'inchecken is nog niet open');
  const b2 = await api(base, '/api/member/vluchten/boek', { id: open.id }, lid);
  const inc = await api(base, '/api/member/vluchten/incheck', { code: b2.body.boeking.code, koffers: 2 }, lid);
  assert.equal(inc.status, 200);
  assert.match(inc.body.pass.stoel, /^\d+[A-F]$/, 'een echte stoel');
  assert.equal(inc.body.pass.koffers.length, 2, 'twee koffertags');
  assert.equal((await api(base, '/api/member/vluchten/incheck', { code: b2.body.boeking.code }, lid)).status, 409, 'niet dubbel inchecken');
  const mijn = await api(base, '/api/member/vluchten/mijn', {}, lid);
  assert.ok(mijn.body.boekingen.some(b => b.status === 'ingecheckt' && b.koffers.length === 2));
});

test('3. de grendels: geen boarding zonder rond draai, geen vertrek zonder klaring, en de keten nooit achteruit', async () => {
  const bord = await api(base, '/api/lucht/bord', { soort: 'vertrek' }, ops);
  const v = bord.body.vluchten.find(x => x.nummer === 'RT205');
  // boarding weigert zolang de draai niet rond is
  const te = await api(base, '/api/lucht/vlucht/status', { id: v.id, status: 'boarding' }, ops);
  assert.equal(te.status, 409);
  assert.match(te.body.error, /draai/);
  // klaring kan ook nog niet: de kist boardt niet
  assert.equal((await api(base, '/api/lucht/toren/klaring', { id: v.id, baan: '06/24' }, ops)).status, 409);
  // het platform werkt de draai af
  for (const t of ['brandstof', 'catering', 'schoonmaak', 'bagage-laden', 'water-en-afval', 'pushback-gereed']) {
    const r = await api(base, '/api/lucht/draai/taak', { id: v.id, taak: t }, ops);
    assert.equal(r.status, 200, 'taak ' + t);
  }
  assert.equal((await api(base, '/api/lucht/draai/taak', { id: v.id, taak: 'catering' }, ops)).status, 409, 'niet dubbel afvinken');
  // nu mag de kist boarden, maar vertrekken pas met klaring
  assert.equal((await api(base, '/api/lucht/vlucht/status', { id: v.id, status: 'boarding' }, ops)).status, 200);
  const zonder = await api(base, '/api/lucht/vlucht/status', { id: v.id, status: 'vertrokken' }, ops);
  assert.equal(zonder.status, 409);
  assert.match(zonder.body.error, /toren/);
  assert.equal((await api(base, '/api/lucht/toren/klaring', { id: v.id, baan: '06/24' }, ops)).status, 200);
  assert.equal((await api(base, '/api/lucht/toren/klaring', { id: v.id, baan: '13/31' }, ops)).status, 409, 'geen dubbele klaring');
  assert.equal((await api(base, '/api/lucht/vlucht/status', { id: v.id, status: 'vertrokken' }, ops)).status, 200);
  // en daarna draait er niets meer terug
  assert.equal((await api(base, '/api/lucht/vlucht/status', { id: v.id, status: 'boarding' }, ops)).status, 409);
});

test('4. vertraging: de tijd schuift, de reden staat op het bord en telt op', async () => {
  const bord = await api(base, '/api/lucht/bord', { soort: 'vertrek' }, ops);
  const v = bord.body.vluchten.find(x => x.nummer === 'RT101');
  const was = v.tijd;
  const r = await api(base, '/api/lucht/vlucht/vertraag', { id: v.id, minuten: 45, reden: 'late aankomst toestel' }, ops);
  assert.equal(r.status, 200);
  assert.notEqual(r.body.vlucht.tijd, was);
  assert.equal(r.body.vlucht.vertraging.minuten, 45);
  assert.equal((await api(base, '/api/lucht/vlucht/vertraag', { id: v.id, minuten: 2 }, ops)).status, 400, 'onder de 5 minuten is geen vertraging');
  const r2 = await api(base, '/api/lucht/vlucht/vertraag', { id: v.id, minuten: 15, reden: 'druk luchtruim' }, ops);
  assert.equal(r2.body.vlucht.vertraging.minuten, 60, 'vertraging telt op');
  // het lid ziet het op het bord
  const mb = await api(base, '/api/member/vluchten/bord', {}, lid);
  assert.equal(mb.body.vluchten.find(x => x.nummer === 'RT101').vertraging.minuten, 60);
});

test('5. de bagageketen: vooruit door de kelder, nooit achteruit, en vermist wordt gevonden', async () => {
  const bag = await api(base, '/api/lucht/bagage', {}, ops);
  assert.ok(bag.body.koffers.length >= 2, 'de ingecheckte koffers staan in de kelder');
  const tag = bag.body.koffers.find(k => k.status === 'ingecheckt').tag;
  assert.equal((await api(base, '/api/lucht/bagage/zet', { tag, status: 'geladen' }, ops)).status, 409, 'stap voor stap: eerst sorteren');
  assert.equal((await api(base, '/api/lucht/bagage/zet', { tag, status: 'gesorteerd' }, ops)).status, 200);
  assert.equal((await api(base, '/api/lucht/bagage/zet', { tag, status: 'ingecheckt' }, ops)).status, 409, 'nooit achteruit');
  assert.equal((await api(base, '/api/lucht/bagage/zet', { tag, status: 'vermist' }, ops)).status, 200);
  const terug = await api(base, '/api/lucht/bagage/zet', { tag, status: 'op-band' }, ops);
  assert.equal(terug.status, 200);
  assert.equal(terug.body.gevonden, true, 'een vermiste koffer die opduikt is gevonden');
});

test('6. de aankomstketen: geland krijgt een band, en de geladen koffers rollen mee de band op', async () => {
  const bord = await api(base, '/api/lucht/bord', { soort: 'aankomst' }, ops);
  const v = bord.body.vluchten[0];
  assert.equal(v.status, 'onderweg');
  const gl = await api(base, '/api/lucht/vlucht/status', { id: v.id, status: 'geland' }, ops);
  assert.equal(gl.status, 200);
  assert.ok(gl.body.vlucht.band >= 1, 'de landing krijgt een bagageband');
  assert.equal((await api(base, '/api/lucht/vlucht/status', { id: v.id, status: 'bagage-op-band' }, ops)).status, 200);
  assert.equal((await api(base, '/api/lucht/vlucht/status', { id: v.id, status: 'afgerond' }, ops)).status, 200);
});

test('7. security: wachttijden en open/dicht staan live op het reizigersbord', async () => {
  const r = await api(base, '/api/lucht/security/zet', { id: 'f2', open: true, wachtMinuten: 12 }, ops);
  assert.equal(r.status, 200);
  assert.equal((await api(base, '/api/lucht/security/zet', { id: 'f1', wachtMinuten: 999 }, ops)).status, 400, 'onzin-wachttijd geweigerd');
  const mb = await api(base, '/api/member/vluchten/bord', {}, lid);
  const f2 = mb.body.security.find(f => f.id === 'f2');
  assert.equal(f2.open, true);
  assert.equal(f2.wachtMinuten, 12);
});

test('8. de cockpit ziet de hele operatie en de AI-operations adviseert (en schakelt niets)', async () => {
  const c = await api(base, '/api/lucht/cockpit', {}, ops);
  assert.equal(c.status, 200);
  assert.ok(c.body.vluchtenVandaag >= 3);
  assert.ok(c.body.vertrokken >= 1 && c.body.geland >= 1);
  assert.ok(Array.isArray(c.body.signalen));
  const ai = await api(base, '/api/lucht/ai', { vraag: 'Wat pak ik als eerste op?' }, ops);
  assert.equal(ai.status, 200);
  assert.ok(ai.body.antwoord && ai.body.antwoord.length > 20);
  assert.match(ai.body.antwoord, /zelf|mens|u /i, 'het advies laat de mens schakelen');
});

test('9. de operatie is alleen voor het luchthavenpersoneel; het bord is er voor elke sessie', async () => {
  assert.equal((await api(base, '/api/lucht/cockpit', {}, partner)).status, 403);
  assert.equal((await api(base, '/api/lucht/cockpit', {}, null)).status, 401);
  assert.equal((await api(base, '/api/lucht/toren/klaring', { id: 'x', baan: '06/24' }, partner)).status, 403);
  assert.equal((await api(base, '/api/member/vluchten/bord', {}, null)).status, 401);
});
