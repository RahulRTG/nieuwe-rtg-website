/* De reis staat in je agenda: een vlucht, een verblijf of een reisaanvraag
   verschijnt vanzelf in het programma van het lid (/api/agenda/mijn, de
   berekende reisagenda), en een bestemming die vooraf een visum of
   reistoestemming vraagt zet een afvinkbare taak in de persoonlijke agenda
   (kern/visumtaak.js, /api/agenda/mijn-lijst). Annuleren ruimt beide op:
   de projectie filtert zichzelf, de taak gaat weg op zijn bron.
   Draai los: node --test test/reisagenda.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisagenda-'));
let srv, base, lid, lucht, vluchtId, boekCode, verblijfId, verblijfRef, reisRef;

const dagPlus = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const vandaag = () => new Date().toISOString().slice(0, 10);

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const programma = async () => (await api('/api/agenda/mijn', {}, lid)).body.dagen || [];
const alleItems = dagen => dagen.flatMap(d => d.items || []);
const taken = async () => ((await api('/api/agenda/mijn-lijst', {}, lid)).body.items || []);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_ENC_KEY: 'test-encryptiesleutel-1234567890' } });
  base = srv.base;
  const reg = await api('/api/auth/register', { name: 'Reis Lid', email: 'reis@x.nl', phone: '0611122334',
    password: 'geheim123', geboortedatum: '1990-01-15', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  const rooster = await api('/api/supplier/roster', { code: 'LUCHT' });
  const manager = (rooster.body.staff || []).find(s => s.role === 'manager');
  lucht = (await api('/api/supplier/login', { code: 'LUCHT', staffId: manager && manager.id, pin: '1234' })).body.token;
  assert.ok(lid && lucht, 'een lid en de vluchtleiding zijn ingelogd');
  /* Een vlucht boeken eist de paspoortstrook (gegevenspoort, soort 'vlucht');
     zonder die scan geeft de boekroute een 428. Echte preconditie. */
  await api('/api/onboarding/paspoort', { nummer: 'NX7654321', vervaldatum: '2033-01-01',
    nationaliteit: 'Nederlandse', geboortedatum: '1990-01-15' }, lid);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een vlucht naar een toestemmingsland boeken zet de visumtaak klaar', async () => {
  const m = await api('/api/lucht/vlucht/maak', { nummer: 'RT901', bestemming: 'New York', datum: dagPlus(1), tijd: '11:07' }, lucht);
  assert.equal(m.status, 200, JSON.stringify(m.body));
  vluchtId = m.body.vlucht.id;
  const b = await api('/api/member/vluchten/boek', { id: vluchtId }, lid);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  boekCode = b.body.boeking.id;
  // de taak zit in het antwoord: reistoestemming (ESTA) voor de Verenigde Staten
  assert.ok(b.body.visumtaak, 'de boeking draagt de visumtaak');
  assert.match(b.body.visumtaak.titel, /Reistoestemming aanvragen voor Verenigde Staten/);
  // vertrek is morgen, dus de taakdatum is vandaag (niet in het verleden)
  assert.equal(b.body.visumtaak.datum, vandaag());
});

test('2. de taak staat echt in de persoonlijke agenda, op de bron van de boeking', async () => {
  const items = await taken();
  const taak = items.find(i => i.bron === 'reis:' + boekCode);
  assert.ok(taak, 'de visumtaak staat in de agenda (bron reis:' + boekCode + ')');
  assert.match(taak.notitie, /reistoestemming/i);
  assert.equal(taak.gedaan, false);
});

test('3. de vlucht staat in het programma van het lid', async () => {
  const items = alleItems(await programma());
  const vlucht = items.find(i => i.soort === 'vlucht' && i.ref === boekCode);
  assert.ok(vlucht, 'het programma kent de vlucht');
  assert.equal(vlucht.titel, 'Vlucht RT901 naar New York');
  assert.equal(vlucht.tijd, '11:07');
});

test('4. een verblijf verschijnt in het programma en verdwijnt bij annuleren', async () => {
  const b = await api('/api/verblijf', { supplierCode: 'SAKURA', roomId: 'a1', aankomst: dagPlus(2), vertrek: dagPlus(4) }, lid);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  verblijfId = b.body.verblijf.id;
  verblijfRef = b.body.verblijf.ref;
  let items = alleItems(await programma());
  const v = items.find(i => i.soort === 'verblijf' && i.ref === verblijfRef);
  assert.ok(v, 'het programma kent het verblijf');
  assert.match(v.titel, /Casa Mar.*Villa Bahia Ibiza.*2 nachten/);
  const a = await api('/api/verblijf/annuleer', { id: verblijfId }, lid);
  assert.equal(a.status, 200);
  items = alleItems(await programma());
  assert.ok(!items.some(i => i.soort === 'verblijf' && i.ref === verblijfRef), 'een geannuleerd verblijf staat niet meer in het programma');
});

test('5. een reisaanvraag: in het programma, geen taak voor een visumvrij land', async () => {
  const b = await api('/api/reisbureau/boek', { tripId: 'ibiza-jetset', vertrek: dagPlus(40), personen: 2 }, lid);
  assert.equal(b.status, 200, JSON.stringify(b.body));
  reisRef = b.body.aanvraag.ref;
  // de haak is gelopen (de sleutel bestaat) en oordeelde: Ibiza is visumvrij
  assert.ok('visumtaak' in b.body, 'het antwoord draagt de visumtaak-uitkomst');
  assert.equal(b.body.visumtaak, null);
  const items = alleItems(await programma());
  const reis = items.find(i => i.soort === 'reis' && i.ref === reisRef);
  assert.ok(reis, 'het programma kent de reisaanvraag');
  assert.match(reis.titel, /Ibiza/);
  assert.equal(reis.status, 'aangevraagd');
});

test('6. de reisaanvraag intrekken haalt hem uit het programma', async () => {
  const a = await api('/api/reisbureau/annuleer', { ref: reisRef }, lid);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  const items = alleItems(await programma());
  assert.ok(!items.some(i => i.soort === 'reis' && i.ref === reisRef), 'een ingetrokken aanvraag staat niet meer in het programma');
});

test('7. annuleert de vluchtleiding de vlucht, dan gaan taak en programma-item mee', async () => {
  const s = await api('/api/lucht/vlucht/status', { id: vluchtId, status: 'geannuleerd' }, lucht);
  assert.equal(s.status, 200, JSON.stringify(s.body));
  const items = await taken();
  assert.ok(!items.some(i => i.bron === 'reis:' + boekCode), 'de visumtaak is opgeruimd');
  const prog = alleItems(await programma());
  assert.ok(!prog.some(i => i.soort === 'vlucht' && i.ref === boekCode), 'de geannuleerde vlucht staat niet meer in het programma');
});
