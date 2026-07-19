/* De zorgketen (laag twee op de hulpdiensten): recepten van de spreekkamer
   naar de apotheek, de eerste hulp met triagekleuren, verwijzingen naar de
   medisch specialist en beauty medical (intake verplicht), en de agenda's.
   Draai los: node --experimental-sqlite --test test/zorgketen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const tokens = {};
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zorg-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function zaakLogin(code) {
  const roster = await api('/api/supplier/roster', { code });
  const chef = roster.body.staff.find(m => m.role === 'manager');
  const login = await api('/api/supplier/login', { code, staffId: chef.id, pin: '1234' });
  assert.ok(login.body.token, code + ' is aangemeld');
  return login.body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  for (const c of ['CONSULTA', 'FARMACIA', 'CANMISSES', 'CARDIO', 'ESTETICA', 'GUARDIA'])
    tokens[c] = await zaakLogin(c);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. recepten: de huisarts schrijft voor, de apotheek zet klaar en reikt uit; de politie mag niet voorschrijven', async () => {
  const r = await api('/api/supplier/zorg/recept/maak', { apotheek: 'FARMACIA', middel: 'Amoxicilline 500mg', dosering: '3x daags, 7 dagen' }, tokens.CONSULTA);
  assert.equal(r.status, 200);
  const apo = await api('/api/supplier/zorg/overzicht', {}, tokens.FARMACIA);
  const recept = apo.body.recepten.find(x => x.id === r.body.recept.id);
  assert.ok(recept, 'de apotheek ziet het recept binnenkomen');
  assert.equal(recept.status, 'voorgeschreven');
  await api('/api/supplier/zorg/recept/zet', { id: recept.id, status: 'klaar' }, tokens.FARMACIA);
  const uit = await api('/api/supplier/zorg/recept/zet', { id: recept.id, status: 'uitgereikt' }, tokens.FARMACIA);
  assert.equal(uit.body.recept.status, 'uitgereikt');
  assert.equal((await api('/api/supplier/zorg/recept/zet', { id: recept.id, status: 'klaar' }, tokens.FARMACIA)).status, 409, 'uitgereikt is definitief');
  assert.equal((await api('/api/supplier/zorg/recept/maak', { apotheek: 'FARMACIA', middel: 'x' }, tokens.GUARDIA)).status, 403, 'de politie schrijft niet voor');
  assert.equal((await api('/api/supplier/zorg/recept/zet', { id: recept.id, status: 'klaar' }, tokens.CONSULTA)).status, 403, 'alleen de apotheek handelt af');
});

test('2. de eerste hulp: triagekleuren sorteren de rij, rood gaat voor', async () => {
  await api('/api/supplier/zorg/seh/binnen', { klacht: 'Verstuikte enkel', triage: 'groen', via: 'balie' }, tokens.CANMISSES);
  await api('/api/supplier/zorg/seh/binnen', { klacht: 'Pijn op de borst', triage: 'rood', via: 'ambulance' }, tokens.CANMISSES);
  await api('/api/supplier/zorg/seh/binnen', { klacht: 'Diepe snijwond', triage: 'oranje', via: 'balie' }, tokens.CANMISSES);
  const z = await api('/api/supplier/zorg/overzicht', {}, tokens.CANMISSES);
  assert.equal(z.body.seh[0].triage, 'rood', 'rood staat vooraan');
  assert.equal(z.body.seh[1].triage, 'oranje');
  const eerste = z.body.seh[0];
  await api('/api/supplier/zorg/seh/zet', { id: eerste.id, status: 'in-behandeling' }, tokens.CANMISSES);
  const op = await api('/api/supplier/zorg/seh/zet', { id: eerste.id, status: 'opgenomen' }, tokens.CANMISSES);
  assert.equal(op.status, 200);
  const na = await api('/api/supplier/zorg/overzicht', {}, tokens.CANMISSES);
  assert.ok(!na.body.seh.some(p => p.id === eerste.id), 'opgenomen is uit de rij');
  assert.equal((await api('/api/supplier/zorg/seh/binnen', { klacht: 'x', triage: 'paars' }, tokens.CANMISSES)).status, 400, 'alleen echte triagekleuren');
  assert.equal((await api('/api/supplier/zorg/seh/binnen', { klacht: 'x', triage: 'rood' }, tokens.CONSULTA)).status, 403, 'alleen het ziekenhuis heeft een SEH');
});

test('3. verwijzen: de huisarts stuurt naar de specialist, die plant en handelt af', async () => {
  const v = await api('/api/supplier/zorg/verwijs/maak', { naar: 'CARDIO', reden: 'Hartkloppingen bij inspanning' }, tokens.CONSULTA);
  assert.equal(v.status, 200);
  const inbox = await api('/api/supplier/zorg/overzicht', {}, tokens.CARDIO);
  assert.ok(inbox.body.verwijzingen.some(x => x.id === v.body.verwijzing.id), 'de specialist ziet de verwijzing');
  assert.equal((await api('/api/supplier/zorg/verwijs/zet', { id: v.body.verwijzing.id, status: 'gepland' }, tokens.CARDIO)).status, 200);
  // verwijzen kan ook naar beauty medical, maar niet naar de apotheek
  assert.equal((await api('/api/supplier/zorg/verwijs/maak', { naar: 'ESTETICA', reden: 'Littekencorrectie na ongeval' }, tokens.CONSULTA)).status, 200);
  assert.equal((await api('/api/supplier/zorg/verwijs/maak', { naar: 'FARMACIA', reden: 'x' }, tokens.CONSULTA)).status, 404);
});

test('4. de agenda: de specialist plant vrij, beauty medical nooit zonder intake', async () => {
  assert.equal((await api('/api/supplier/zorg/afspraak/maak', { wat: 'Consult cardiologie', wanneer: 'di 14:30' }, tokens.CARDIO)).status, 200);
  // beauty medical zonder intake wordt geweigerd, met intake mag het
  const zonder = await api('/api/supplier/zorg/afspraak/maak', { wat: 'Fillerbehandeling', wanneer: 'wo 11:00' }, tokens.ESTETICA);
  assert.equal(zonder.status, 400);
  assert.match(zonder.body.error, /intake/i, 'de intake-eis staat in de foutmelding');
  const met = await api('/api/supplier/zorg/afspraak/maak', { wat: 'Intakegesprek fillers', wanneer: 'wo 11:00', intake: true }, tokens.ESTETICA);
  assert.equal(met.status, 200);
  assert.equal((await api('/api/supplier/zorg/afspraak/zet', { id: met.body.afspraak.id, status: 'afgerond' }, tokens.ESTETICA)).status, 200);
  // de apotheek heeft geen agenda op dit bord
  assert.equal((await api('/api/supplier/zorg/afspraak/maak', { wat: 'x' }, tokens.FARMACIA)).status, 403);
});

test('5. het zorg-overzicht past zich aan de soort zaak aan', async () => {
  const apo = await api('/api/supplier/zorg/overzicht', {}, tokens.FARMACIA);
  assert.ok(Array.isArray(apo.body.recepten) && !apo.body.seh, 'de apotheek ziet recepten, geen SEH');
  const ha = await api('/api/supplier/zorg/overzicht', {}, tokens.CONSULTA);
  assert.ok(ha.body.apotheken.length && ha.body.verwijsDoelen.length, 'de huisarts ziet apotheken en verwijsdoelen');
  const zk = await api('/api/supplier/zorg/overzicht', {}, tokens.CANMISSES);
  assert.ok(Array.isArray(zk.body.seh) && zk.body.apotheken.length, 'het ziekenhuis ziet de SEH en kan voorschrijven');
  assert.equal((await api('/api/supplier/zorg/overzicht', {}, tokens.GUARDIA)).status, 403, 'de politie hoort niet bij de zorgketen');
});
