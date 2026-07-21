/* De Brigade RTG Airport (kern/marechaussee.js): de grensbalie op de echte
   luchthavendata (passagierslijst op codenaam, besluit per reiziger),
   patrouilles door de zones, incidenten en het grens-signaal in de cockpit.
   Draai los: node --experimental-sqlite --test test/marechaussee.test.js */
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

let srv, base, lid, kmar, ops, partner, boekingId;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kmar-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  lid = (await api(base, '/api/auth/register', { name: 'Grens Reiziger', email: 'km' + u + '@x.nl',
    phone: '068' + u.slice(1), password: 'geheim123', geboortedatum: '1986-05-05', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const login = async code => {
    const roster = await api(base, '/api/supplier/roster', { code });
    const man = roster.body.staff.find(m => m.role === 'manager');
    return (await api(base, '/api/supplier/login', { code, staffId: man.id, pin: '1234' })).body.token;
  };
  kmar = await login('KMAR');
  ops = await login('LUCHT');
  partner = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  // een reiziger checkt in op de open vlucht RT205, zodat de grensbalie werk heeft
  const bord = await api(base, '/api/member/vluchten/bord', {}, lid);
  const open = bord.body.vluchten.find(v => v.nummer === 'RT205');
  const bk = await api(base, '/api/member/vluchten/boek', { id: open.id }, lid);
  await api(base, '/api/member/vluchten/incheck', { code: bk.body.boeking.code }, lid);
});
test.after(() => stop(srv && srv.child));

test('1. de brigade staat klaar: eigen rooster, cockpit, en alleen voor de marechaussee', async () => {
  const c = await api(base, '/api/kmar/cockpit', {}, kmar);
  assert.equal(c.status, 200);
  assert.ok(c.body.zones.length >= 5);
  assert.ok(c.body.vluchtenVandaag >= 1);
  assert.equal((await api(base, '/api/kmar/cockpit', {}, partner)).status, 403);
  assert.equal((await api(base, '/api/kmar/cockpit', {}, ops)).status, 403, 'ook operations komt niet in de brigade');
  assert.equal((await api(base, '/api/kmar/cockpit', {}, null)).status, 401);
});

test('2. de grensbalie: de passagierslijst op codenaam, en per reiziger een menselijk besluit', async () => {
  const r = await api(base, '/api/kmar/controle/lijst', { vlucht: 'RT205' }, kmar);
  assert.equal(r.status, 200);
  assert.ok(r.body.passagiers.length >= 1, 'de ingecheckte reiziger staat op de lijst');
  const p = r.body.passagiers[0];
  assert.ok(p.codenaam && !/Grens Reiziger/.test(p.codenaam), 'op codenaam, nooit de echte naam');
  assert.equal(p.besluit, 'wacht');
  boekingId = p.boekingId;
  // vrijgeven kan alleen NA nader onderzoek
  assert.equal((await api(base, '/api/kmar/controle/zet', { boekingId, besluit: 'vrijgegeven' }, kmar)).status, 409);
  assert.equal((await api(base, '/api/kmar/controle/zet', { boekingId, besluit: 'nader-onderzoek' }, kmar)).status, 200);
  // een besluit is een besluit: geen tweede oordeel, behalve vrijgeven na onderzoek
  assert.equal((await api(base, '/api/kmar/controle/zet', { boekingId, besluit: 'akkoord' }, kmar)).status, 409);
  assert.equal((await api(base, '/api/kmar/controle/zet', { boekingId, besluit: 'vrijgegeven' }, kmar)).status, 200);
  const na = await api(base, '/api/kmar/controle/lijst', { vlucht: 'RT205' }, kmar);
  assert.equal(na.body.passagiers.find(x => x.boekingId === boekingId).besluit, 'vrijgegeven');
});

test('3. het grens-signaal: een kist die boardt met ongecontroleerde reizigers valt op in de cockpit', async () => {
  // een tweede reiziger die NIET wordt gecontroleerd
  const u = Date.now().toString().slice(-8);
  const lid2 = (await api(base, '/api/auth/register', { name: 'Tweede Reiziger', email: 'km2' + u + '@x.nl',
    phone: '069' + u.slice(1), password: 'geheim123', geboortedatum: '1992-08-08', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const bord = await api(base, '/api/member/vluchten/bord', {}, lid2);
  const open = bord.body.vluchten.find(v => v.nummer === 'RT205');
  const bk = await api(base, '/api/member/vluchten/boek', { id: open.id }, lid2);
  await api(base, '/api/member/vluchten/incheck', { code: bk.body.boeking.code }, lid2);
  // operations maakt de draai rond en start het boarden
  for (const t of ['brandstof', 'catering', 'schoonmaak', 'bagage-laden', 'water-en-afval', 'pushback-gereed'])
    await api(base, '/api/lucht/draai/taak', { id: open.id, taak: t }, ops);
  assert.equal((await api(base, '/api/lucht/vlucht/status', { id: open.id, status: 'boarding' }, ops)).status, 200);
  const c = await api(base, '/api/kmar/cockpit', {}, kmar);
  assert.ok(c.body.signalen.some(s => s.soort === 'grens' && s.vlucht === 'RT205'), 'de cockpit waarschuwt de brigade');
});

test('4. patrouilles en incidenten: rondes met bevindingen, melden en netjes sluiten', async () => {
  assert.equal((await api(base, '/api/kmar/patrouille', { zone: 'Duty free' }, kmar)).status, 400, 'alleen echte zones');
  const p = await api(base, '/api/kmar/patrouille', { zone: 'Terminal', bevinding: 'Alles rustig; twee gates druk.' }, kmar);
  assert.equal(p.status, 200);
  const i = await api(base, '/api/kmar/incident', { zone: 'Security-filters', soort: 'achtergelaten-bagage', tekst: 'Zwarte trolley zonder eigenaar bij filter 1.' }, kmar);
  assert.equal(i.status, 200);
  assert.equal((await api(base, '/api/kmar/incident/sluit', { id: i.body.incident.id, afloop: 'Eigenaar gevonden in de lounge.' }, kmar)).status, 200);
  assert.equal((await api(base, '/api/kmar/incident/sluit', { id: i.body.incident.id }, kmar)).status, 409, 'niet dubbel sluiten');
  const c = await api(base, '/api/kmar/cockpit', {}, kmar);
  assert.ok(c.body.patrouillesVandaag >= 1);
  assert.ok(c.body.laatstePatrouille.Terminal, 'de zone draagt zijn laatste ronde');
});

test('5. de AI-wachtcommandant adviseert en beslist niets', async () => {
  const r = await api(base, '/api/kmar/ai', { vraag: 'Waar begin ik vandaag?' }, kmar);
  assert.equal(r.status, 200);
  assert.ok(r.body.antwoord && r.body.antwoord.length > 20);
  assert.match(r.body.antwoord, /zelf|beslis/i);
});
