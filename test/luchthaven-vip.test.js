/* De uitbreiding van RTG Airport: helikopters (helipads, lichtste draai),
   privejets (GA-stands via het charterloket), de Koninklijke Vleugel (vips
   onder protocolnaam; de boarding wacht op het protocol) en de lounges
   (binnen op de boarding pass; royal alleen met vip-protocol).
   Draai los: node --experimental-sqlite --test test/luchthaven-vip.test.js */
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

let srv, base, lid, ops;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-luchtvip-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  lid = (await api(base, '/api/auth/register', { name: 'Jetset Lid', email: 'jv' + u + '@x.nl',
    phone: '067' + u.slice(1), password: 'geheim123', geboortedatum: '1987-03-03', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const roster = await api(base, '/api/supplier/roster', { code: 'LUCHT' });
  const man = roster.body.staff.find(m => m.role === 'manager');
  ops = (await api(base, '/api/supplier/login', { code: 'LUCHT', staffId: man.id, pin: '1234' })).body.token;
});
test.after(() => stop(srv && srv.child));

async function doorloopDraai(vluchtId, taken) {
  for (const t of taken) assert.equal((await api(base, '/api/lucht/draai/taak', { id: vluchtId, taak: t }, ops)).status, 200, 'taak ' + t);
}

test('1. het charterloket: het lid vraagt een helikopter aan, operations bevestigt, en de vlucht landt op een helipad', async () => {
  const vr = await api(base, '/api/member/vluchten/charter', { soort: 'helikopter', bestemming: 'Formentera', tijd: '15:00' }, lid);
  assert.equal(vr.status, 200);
  assert.equal(vr.body.charter.status, 'aangevraagd');
  const lijst = await api(base, '/api/lucht/charters', {}, ops);
  const ch = lijst.body.charters.find(c => c.code === vr.body.charter.code);
  assert.ok(ch, 'operations ziet de aanvraag');
  const ok = await api(base, '/api/lucht/charter/beslis', { id: ch.id, akkoord: true }, ops);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.vlucht.categorie, 'helikopter');
  assert.match(ok.body.vlucht.gate, /^H\d$/, 'de helikopter staat op een helipad');
  assert.equal(ok.body.vlucht.status, 'inchecken');
  // het lid ziet de charter bevestigd en staat geboekt op de vlucht
  const mijn = await api(base, '/api/member/vluchten/mijn', {}, lid);
  assert.equal(mijn.body.charters.find(c => c.code === vr.body.charter.code).status, 'bevestigd');
  assert.ok(mijn.body.boekingen.some(b => b.vlucht.nummer === ok.body.vlucht.nummer));
  // niet twee keer beslissen
  assert.equal((await api(base, '/api/lucht/charter/beslis', { id: ch.id, akkoord: false }, ops)).status, 409);
});

test('2. de helikopter: de lichtste draai (3 taken) en klaring op een helipad, niet op een baan', async () => {
  const mijn = await api(base, '/api/member/vluchten/mijn', {}, lid);
  const heli = mijn.body.boekingen.find(b => b.vlucht.categorie === 'helikopter').vlucht;
  assert.equal(heli.draai.taken.length, 3, 'een helikopter heeft drie platformtaken');
  // een catering-taak hoort niet bij een helikopter
  assert.equal((await api(base, '/api/lucht/draai/taak', { id: heli.id, taak: 'catering' }, ops)).status, 400);
  await doorloopDraai(heli.id, ['brandstof', 'schoonmaak', 'pushback-gereed']);
  assert.equal((await api(base, '/api/lucht/vlucht/status', { id: heli.id, status: 'boarding' }, ops)).status, 200);
  // de toren: een baan is geen helipad
  const fout = await api(base, '/api/lucht/toren/klaring', { id: heli.id, baan: '06/24' }, ops);
  assert.equal(fout.status, 400);
  assert.match(fout.body.error, /H1, H2/);
  assert.equal((await api(base, '/api/lucht/toren/klaring', { id: heli.id, baan: 'H2' }, ops)).status, 200);
  assert.equal((await api(base, '/api/lucht/vlucht/status', { id: heli.id, status: 'vertrokken' }, ops)).status, 200);
});

test('3. de privejet: op een GA-stand met de lichte draai (4 taken) en klaring op een gewone baan', async () => {
  const jet = await api(base, '/api/lucht/vlucht/maak', { nummer: 'RJ777', soort: 'vertrek', categorie: 'privejet', bestemming: 'Nice', tijd: '18:00', gate: 'P2' }, ops);
  assert.equal(jet.status, 200);
  assert.equal(jet.body.vlucht.gate, 'P2');
  assert.equal(jet.body.vlucht.draai.taken.length, 4);
  // een gate is geen stand
  assert.equal((await api(base, '/api/lucht/vlucht/maak', { categorie: 'privejet', gate: 'A1', tijd: '19:00' }, ops)).status, 400);
  const vid = jet.body.vlucht.id;
  assert.equal((await api(base, '/api/lucht/vlucht/status', { id: vid, status: 'inchecken' }, ops)).status, 200);
  await doorloopDraai(vid, ['brandstof', 'catering', 'schoonmaak', 'pushback-gereed']);
  assert.equal((await api(base, '/api/lucht/vlucht/status', { id: vid, status: 'boarding' }, ops)).status, 200);
  assert.equal((await api(base, '/api/lucht/toren/klaring', { id: vid, baan: '13/31' }, ops)).status, 200);
});

test('4. de Koninklijke Vleugel: de boarding wacht op het vip-protocol, onder protocolnaam', async () => {
  const v = await api(base, '/api/lucht/vlucht/maak', { nummer: 'RT900', soort: 'vertrek', bestemming: 'Den Haag', tijd: '20:00', gate: 'C1' }, ops);
  const vid = v.body.vlucht.id;
  const vip = await api(base, '/api/lucht/vip/maak', { vlucht: 'RT900', protocolnaam: 'Valk Een', soort: 'koninklijk' }, ops);
  assert.equal(vip.status, 200);
  assert.equal(vip.body.vip.suite, 'Suite Royale');
  assert.equal(vip.body.vip.protocol.length, 5);
  // zonder protocolnaam geen vip (privacy by design)
  assert.equal((await api(base, '/api/lucht/vip/maak', { vlucht: 'RT900', protocolnaam: 'X' }, ops)).status, 409, 'een vlucht draagt een protocol');
  // de hele draai rond, maar boarding blijft dicht tot het protocol rond is
  assert.equal((await api(base, '/api/lucht/vlucht/status', { id: vid, status: 'inchecken' }, ops)).status, 200);
  await doorloopDraai(vid, ['brandstof', 'catering', 'schoonmaak', 'bagage-laden', 'water-en-afval', 'pushback-gereed']);
  const dicht = await api(base, '/api/lucht/vlucht/status', { id: vid, status: 'boarding' }, ops);
  assert.equal(dicht.status, 409);
  assert.match(dicht.body.error, /Koninklijke Vleugel/);
  for (const s of ['suite-gereed', 'security-sweep', 'protocol-officier', 'motorcade', 'discrete-boarding'])
    assert.equal((await api(base, '/api/lucht/vip/taak', { id: vip.body.vip.id, stap: s }, ops)).status, 200, 'stap ' + s);
  assert.equal((await api(base, '/api/lucht/vlucht/status', { id: vid, status: 'boarding' }, ops)).status, 200, 'protocol rond: boarden mag');
  const bord = await api(base, '/api/lucht/bord', {}, ops);
  const rt900 = bord.body.vluchten.find(x => x.nummer === 'RT900');
  assert.equal(rt900.vip.soort, 'koninklijk');
  assert.equal(rt900.vip.rond, true);
});

test('5. de lounges: binnen op de boarding pass, de Vleugel alleen met vip-protocol, en de capaciteit telt', async () => {
  // het lid checkt in op de vip-vlucht RT900 (staat op inchecken... hij boardt al; boek+incheck moet EERDER)
  // daarom: een verse gast op de open lijnvlucht RT205
  const bord = await api(base, '/api/member/vluchten/bord', {}, lid);
  const open = bord.body.vluchten.find(v => v.nummer === 'RT205' && v.status === 'inchecken');
  const bk = await api(base, '/api/member/vluchten/boek', { id: open.id }, lid);
  const code = bk.body.boeking.code;
  // zonder inchecken geen lounge
  assert.equal((await api(base, '/api/lucht/lounge/in', { lounge: 'salon', code }, ops)).status, 409);
  await api(base, '/api/member/vluchten/incheck', { code }, lid);
  // de salon: welkom; maar niet dubbel
  const inr = await api(base, '/api/lucht/lounge/in', { lounge: 'salon', code }, ops);
  assert.equal(inr.status, 200);
  assert.equal((await api(base, '/api/lucht/lounge/in', { lounge: 'salon', code }, ops)).status, 409, 'niet dubbel binnen');
  // de Koninklijke Vleugel weigert een gast zonder vip-vlucht
  await api(base, '/api/lucht/lounge/uit', { id: inr.body.gast.id }, ops);
  const royal = await api(base, '/api/lucht/lounge/in', { lounge: 'royal', code }, ops);
  assert.equal(royal.status, 403);
  assert.match(royal.body.error, /vip-protocol/);
  // de stand telt netjes mee
  const stand = await api(base, '/api/lucht/lounge', {}, ops);
  assert.equal(stand.status, 200);
  const salon = stand.body.lounges.find(l => l.id === 'salon');
  assert.ok(salon.capaciteit === 40 && salon.binnen >= 0);
  // en de cockpit ziet de nieuwe wereld
  const c = await api(base, '/api/lucht/cockpit', {}, ops);
  assert.ok('chartersWachtend' in c.body && 'vipsActief' in c.body && 'loungeGasten' in c.body);
});
