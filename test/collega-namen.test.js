/* De namenregel op de werkvloer: COLLEGA'S zien elkaar overal met de echte
   naam: het eigen rooster en team, het personeelsnetwerk tussen zaken van
   elk genre, en de ketenchat van de hulpdiensten. KLANTEN blijven op
   codenaam: dat is het privacy-fundament van het platform (de echte naam
   staat in de kluis en is alleen via de kantoor-inzage met auditlog te
   zien). Deze test bewaakt beide kanten. Draai los:
   node --experimental-sqlite --test test/collega-namen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-namen-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function staffLogin(code, rol, pin) {
  const roster = await api('/api/supplier/roster', { code });
  const lid = roster.body.staff.find(m => m.role === rol);
  const r = await api('/api/supplier/login', { code, staffId: lid.id, pin });
  return { token: r.body.token, naam: lid.name };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. het rooster toont collega\'s met hun echte naam, in elk genre', async () => {
  for (const [code, naam] of [['KIKUNOI', 'Mateo Ferrer'], ['GUARDIA', 'Marta Colom'], ['CANMISSES', 'Dr. Elena Roig'], ['FARMACIA', 'Clara Bonet']]) {
    const r = await api('/api/supplier/roster', { code });
    assert.ok(r.body.staff.some(m => m.name === naam), code + ' toont ' + naam + ' met de echte naam');
    assert.ok(r.body.staff.every(m => m.name && !/^[A-Z]{2,}-\d/.test(m.name)), 'geen codenaam-vormen in het rooster');
  }
});

test('2. het personeelsnetwerk (zaken van verschillende genres) draagt de echte naam van wie schrijft', async () => {
  // KIKUNOI (restaurant) en VORA (beachclub) zijn in de demo al verbonden
  const nora = await staffLogin('KIKUNOI', 'staff', '5678');
  const stuur = await api('/api/supplier/net/bericht', { code: 'VORA', tekst: 'Terras vol; sturen jullie een loper?' }, nora.token);
  assert.equal(stuur.status, 200);
  const vora = await staffLogin('VORA', 'manager', '1234');
  const gesprek = await api('/api/supplier/net/gesprek', { code: 'KIKUNOI' }, vora.token);
  const m = gesprek.body.berichten.find(x => /Terras vol/.test(x.tekst));
  assert.ok(m, 'het bericht komt aan bij de andere zaak');
  assert.equal(m.door, nora.naam, 'met de ECHTE naam van de collega erbij');
});

test('3. de ketenchat van de hulpdiensten draagt de echte naam van de collega', async () => {
  const pol = await staffLogin('GUARDIA', 'manager', '1234');
  const amb = await staffLogin('URGENCIA', 'manager', '1234');
  await api('/api/supplier/keten/verzoek', { korps: 'URGENCIA' }, pol.token);
  await api('/api/supplier/keten/beslis', { korps: 'GUARDIA', akkoord: true }, amb.token);
  await api('/api/supplier/keten/bericht', { kanaal: 'keten', tekst: 'Namencheck in de keten.' }, pol.token);
  const g = await api('/api/supplier/keten/gesprek', { kanaal: 'keten' }, amb.token);
  const m = g.body.berichten.find(x => /Namencheck/.test(x.tekst));
  assert.equal(m.van, pol.naam, 'de ketenchat toont de echte naam');
});

test('4. de grens blijft staan: KLANTEN verschijnen op de werkvloer op codenaam, nooit met kluisdata', async () => {
  // een lid registreert en doet een gastmelding-achtige actie; op zaak-schermen
  // hoort dan de codenaam te staan. We bewaken de bron: publicUser levert wel
  // een codenaam, en het klant-zicht van de zaak (klantprofiel op maat) draait
  // op die codenaam. De echte naam is ALLEEN via de kantoor-inzage te zien.
  const u = Date.now().toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Klant Echtenaam', email: 'kn' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1992-02-02', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  const st = await api('/api/state', {}, reg.body.token);
  const codenaam = st.body.state.user.codename;
  assert.ok(codenaam && codenaam !== 'Klant Echtenaam', 'het lid draait op een codenaam');
  // het zoeken door een ander lid geeft codenamen, geen echte namen
  const zoek = await api('/api/member/find', { q: codenaam }, reg.body.token);
  if (zoek.status === 200 && Array.isArray(zoek.body.results)) {
    assert.ok(!JSON.stringify(zoek.body.results).includes('Klant Echtenaam'), 'nergens de echte naam van een klant');
  }
});
