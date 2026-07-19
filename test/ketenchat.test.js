/* De ketenchat en de interne noodknop: korpsen verbinden eenmalig en delen
   daarna EEN ketenkanaal; besloten deelgroepen zijn alleen voor de leden en
   de meldkamer-chefs van de betrokken korpsen kijken mee (lezen, niet
   schrijven). De noodknop draait op de bestaande security-route. Draai los:
   node --experimental-sqlite --test test/ketenchat.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const wie = {}; // per korps: { chef: {token, staffId}, collega: {token, staffId} }
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-keten-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function login(code, rol, pin) {
  const roster = await api('/api/supplier/roster', { code });
  const lid = roster.body.staff.find(m => m.role === rol);
  const r = await api('/api/supplier/login', { code, staffId: lid.id, pin });
  assert.ok(r.body.token, code + ' ' + rol + ' is aangemeld');
  return { token: r.body.token, staffId: lid.id, naam: lid.name };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  for (const c of ['GUARDIA', 'URGENCIA', 'CANMISSES', 'CONSULTA']) {
    wie[c] = { chef: await login(c, 'manager', '1234'), collega: await login(c, 'staff', '5678') };
  }
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. eenmalig uitnodigen en akkoord; zonder verbinding blijft het ketenkanaal dicht', async () => {
  // zonder verbinding: geen ketenkanaal
  assert.equal((await api('/api/supplier/keten/gesprek', { kanaal: 'keten' }, wie.GUARDIA.chef.token)).status, 403);
  // politie nodigt ambulance en ziekenhuis uit; die stemmen in
  assert.equal((await api('/api/supplier/keten/verzoek', { korps: 'URGENCIA' }, wie.GUARDIA.chef.token)).status, 200);
  assert.equal((await api('/api/supplier/keten/beslis', { korps: 'GUARDIA', akkoord: true }, wie.URGENCIA.chef.token)).status, 200);
  assert.equal((await api('/api/supplier/keten/verzoek', { korps: 'CANMISSES' }, wie.GUARDIA.chef.token)).status, 200);
  assert.equal((await api('/api/supplier/keten/beslis', { korps: 'GUARDIA', akkoord: true }, wie.CANMISSES.chef.token)).status, 200);
  // en het ziekenhuis verbindt met de huisarts: de zorg zit ook in de keten
  assert.equal((await api('/api/supplier/keten/verzoek', { korps: 'CONSULTA' }, wie.CANMISSES.chef.token)).status, 200);
  assert.equal((await api('/api/supplier/keten/beslis', { korps: 'CANMISSES', akkoord: true }, wie.CONSULTA.chef.token)).status, 200);
  // nog een keer uitnodigen hoeft niet
  assert.equal((await api('/api/supplier/keten/verzoek', { korps: 'URGENCIA' }, wie.GUARDIA.chef.token)).status, 409);
});

test('2. het ketenkanaal: een gezamenlijke chat over de korpsen heen', async () => {
  const b = await api('/api/supplier/keten/bericht', { kanaal: 'keten', tekst: 'Grote oefening om 14:00; graag elk korps een eenheid paraat.' }, wie.GUARDIA.chef.token);
  assert.equal(b.status, 200);
  await api('/api/supplier/keten/bericht', { kanaal: 'keten', tekst: 'A-1 staat paraat.' }, wie.URGENCIA.collega.token);
  const zk = await api('/api/supplier/keten/gesprek', { kanaal: 'keten' }, wie.CANMISSES.collega.token);
  assert.equal(zk.status, 200);
  assert.ok(zk.body.berichten.some(m => /oefening/.test(m.tekst)), 'het ziekenhuis leest het politiebericht');
  assert.ok(zk.body.berichten.some(m => m.korps === 'URGENCIA'), 'en het antwoord van de ambulance');
  const ha = await api('/api/supplier/keten/gesprek', { kanaal: 'keten' }, wie.CONSULTA.chef.token);
  assert.ok(ha.body.berichten.length >= 2, 'de huisarts leest de keten ook');
});

test('3. een besloten deelgroep: alleen de leden schrijven, de meldkamer-chef kijkt mee', async () => {
  const maak = await api('/api/supplier/keten/groep/maak', {
    naam: 'Inzet strand-noord',
    leden: [{ code: 'GUARDIA', staffId: wie.GUARDIA.collega.staffId, naam: wie.GUARDIA.collega.naam },
      { code: 'URGENCIA', staffId: wie.URGENCIA.collega.staffId, naam: wie.URGENCIA.collega.naam }]
  }, wie.GUARDIA.chef.token);
  assert.equal(maak.status, 200);
  const gid = maak.body.groep.id;
  // de leden schrijven onder elkaar
  assert.equal((await api('/api/supplier/keten/bericht', { kanaal: gid, tekst: 'Wij staan bij paal 12.' }, wie.GUARDIA.collega.token)).status, 200);
  assert.equal((await api('/api/supplier/keten/bericht', { kanaal: gid, tekst: 'A-1 rijdt naar jullie toe.' }, wie.URGENCIA.collega.token)).status, 200);
  // een collega van hetzelfde korps die GEEN lid is, komt er niet in
  const buiten = await api('/api/supplier/keten/gesprek', { kanaal: gid }, wie.CANMISSES.collega.token);
  assert.equal(buiten.status, 403, 'niet-leden lezen niet mee');
  // de meldkamer-chef van een betrokken korps kijkt mee, maar schrijft niet
  const mee = await api('/api/supplier/keten/gesprek', { kanaal: gid }, wie.URGENCIA.chef.token);
  assert.equal(mee.status, 200);
  assert.equal(mee.body.kijktMee, true);
  assert.equal(mee.body.magSchrijven, false);
  assert.ok(mee.body.berichten.some(m => /paal 12/.test(m.tekst)), 'de meldkamer leest de besloten lijn');
  assert.equal((await api('/api/supplier/keten/bericht', { kanaal: gid, tekst: 'x' }, wie.URGENCIA.chef.token)).status, 403, 'meekijken is niet meeschrijven');
  // een chef van een NIET-betrokken korps kijkt niet mee
  assert.equal((await api('/api/supplier/keten/gesprek', { kanaal: gid }, wie.CONSULTA.chef.token)).status, 403);
  // een gewone collega maakt geen groepen; leden uit een onverbonden korps kunnen niet
  assert.equal((await api('/api/supplier/keten/groep/maak', { naam: 'x', leden: [] }, wie.GUARDIA.collega.token)).status, 403);
});

test('4. ziekenhuis en huisarts maken net zo goed een eigen lijn', async () => {
  const maak = await api('/api/supplier/keten/groep/maak', {
    naam: 'Overleg complexe casus',
    leden: [{ code: 'CANMISSES', staffId: wie.CANMISSES.collega.staffId, naam: wie.CANMISSES.collega.naam },
      { code: 'CONSULTA', staffId: wie.CONSULTA.collega.staffId, naam: wie.CONSULTA.collega.naam }]
  }, wie.CANMISSES.chef.token);
  assert.equal(maak.status, 200);
  assert.equal((await api('/api/supplier/keten/bericht', { kanaal: maak.body.groep.id, tekst: 'Uitslag is binnen; bel de praktijk.' }, wie.CANMISSES.collega.token)).status, 200);
  const ha = await api('/api/supplier/keten/gesprek', { kanaal: maak.body.groep.id }, wie.CONSULTA.collega.token);
  assert.ok(ha.body.berichten.some(m => /Uitslag/.test(m.tekst)), 'de huisarts-assistente leest de lijn');
});

test('5. de interne noodknop: een tik alarmeert het hele team, met reden', async () => {
  const r = await api('/api/supplier/security', { note: 'Agressieve bezoeker bij de balie' }, wie.CONSULTA.collega.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.alarm.note, 'Agressieve bezoeker bij de balie');
  assert.ok(r.body.alarm.from, 'met de naam van wie alarmeert');
  // ook een korps heeft de knop
  assert.equal((await api('/api/supplier/security', { note: 'Assistentie in de cel' }, wie.GUARDIA.collega.token)).status, 200);
});
