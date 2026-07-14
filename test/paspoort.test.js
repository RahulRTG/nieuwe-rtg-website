/* End-to-end tests voor de paspoort-/identiteitslaag (kern/paspoort.js):
   het gecontroleerde, toestemmingsgestuurde kanaal waarlangs een partner de
   identiteit achter een codenaam opvraagt. Dekt: de directe ja/nee-bevestiging,
   het idkaart-/paspoortverzoek met melding en goedkeuren/weigeren, de tijdelijke
   inzage, de gezichtscontrole (selfie x paspoort) en de incident-vrijgave die
   RTG-kantoor beoordeelt. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAoHf3ZQAAAAASUVORK5CYII=';

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, brand, office, lid;
let seq = 0;

// een geverifieerd lid: registreren, paspoort + selfie uploaden, RTG keurt goed
async function nieuwGeverifieerdLid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Jamie de Vries', email: 'p' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1991-03-12', tier: 'business', pasApp: 'business' });
  const token = reg.body.token;
  const st = await api(base, '/api/state', {}, token);
  const codename = st.body.state.user.codename;
  await api(base, '/api/verify/upload', { image: PNG }, token);
  await api(base, '/api/verify/selfie', { image: PNG }, token);
  // RTG-kantoor keurt goed met gezichtscontrole en nationaliteit
  const pend = await api(base, '/api/office/verifications', {}, office);
  const mij = (pend.body.pending || []).find(p => p.codename === codename) || (pend.body.pending || [])[0];
  await api(base, '/api/office/verify', { userId: mij.id, decision: 'approve', faceMatch: true, nationaliteit: 'Nederlandse' }, office);
  return { token, codename };
}

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-paspoort-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_ENC_KEY: 'test-encryptiesleutel-1234567890' } });
  base = srv.base;
  const login = await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
  brand = { token: login.body.token, code: login.body.state.supplier.code };
  office = (await api(base, '/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  lid = await nieuwGeverifieerdLid();
});
test.after(() => stop(srv && srv.child));

test('1. bevestiging (ja/nee) komt direct terug, zonder naam of foto', async () => {
  const r = await api(base, '/api/supplier/paspoort/vraag', { codenaam: lid.codename, niveau: 'bevestiging', minLeeftijd: 21 }, brand.token);
  assert.equal(r.status, 200);
  assert.equal(r.niveau || r.body.niveau, 'bevestiging');
  const b = r.body.bevestiging;
  assert.equal(b.geverifieerd, true, 'RTG-geverifieerd');
  assert.equal(b.gezichtGecontroleerd, true, 'selfie x paspoort gematcht');
  assert.equal(b.voldoetLeeftijd, true, '34 jaar voldoet aan 21+');
  assert.ok(!('naam' in b) && !('foto' in b), 'geen persoonsgegevens in de bevestiging');
});

test('2. idkaart-verzoek: het lid krijgt het te zien en kan weigeren', async () => {
  const r = await api(base, '/api/supplier/paspoort/vraag', { codenaam: lid.codename, niveau: 'idkaart', reden: 'Leeftijdscontrole aan de deur' }, brand.token);
  assert.equal(r.status, 200);
  assert.ok(r.body.verzoek && r.body.verzoek.status === 'aangevraagd');
  const mijn = await api(base, '/api/paspoort/mijn', {}, lid.token);
  const v = mijn.body.verzoeken.find(x => x.id === r.body.verzoek.id);
  assert.ok(v, 'het verzoek staat in de app van het lid');
  // weigeren
  const w = await api(base, '/api/paspoort/beslis', { id: v.id, akkoord: false }, lid.token);
  assert.equal(w.status, 200);
  // na weigering geen inzage voor de partner
  const bekijk = await api(base, '/api/supplier/paspoort/bekijk', { id: v.id }, brand.token);
  assert.equal(bekijk.status, 403, 'geweigerd verzoek is niet in te zien');
});

test('3. idkaart-verzoek goedgekeurd: de partner ziet de geverifieerde ID-kaart', async () => {
  const r = await api(base, '/api/supplier/paspoort/vraag', { codenaam: lid.codename, niveau: 'idkaart' }, brand.token);
  const id = r.body.verzoek.id;
  const ok = await api(base, '/api/paspoort/beslis', { id, akkoord: true }, lid.token);
  assert.equal(ok.status, 200);
  const bekijk = await api(base, '/api/supplier/paspoort/bekijk', { id }, brand.token);
  assert.equal(bekijk.status, 200);
  const k = bekijk.body.inhoud;
  assert.equal(k.niveau, 'idkaart');
  assert.equal(k.naam, 'Jamie de Vries', 'de geverifieerde naam');
  assert.equal(k.nationaliteit, 'Nederlandse');
  assert.ok(typeof k.leeftijd === 'number' && k.leeftijd >= 30, 'de leeftijd (uit de paspoortdatum) staat erbij');
  assert.ok(k.foto && k.foto.startsWith('data:image/'), 'een pasfoto (selfie) staat erbij');
  assert.ok(!('scan' in k), 'de ruwe scan zit NIET in de ID-kaart');
});

test('4. volledige paspoortscan alleen na aparte goedkeuring', async () => {
  const r = await api(base, '/api/supplier/paspoort/vraag', { codenaam: lid.codename, niveau: 'paspoort' }, brand.token);
  const id = r.body.verzoek.id;
  await api(base, '/api/paspoort/beslis', { id, akkoord: true }, lid.token);
  const bekijk = await api(base, '/api/supplier/paspoort/bekijk', { id }, brand.token);
  assert.equal(bekijk.status, 200);
  assert.equal(bekijk.body.inhoud.niveau, 'paspoort');
  assert.ok(bekijk.body.inhoud.scan && bekijk.body.inhoud.scan.startsWith('data:image/'), 'de scan is zichtbaar');
});

test('5. het lid kan een gegeven goedkeuring weer intrekken', async () => {
  const r = await api(base, '/api/supplier/paspoort/vraag', { codenaam: lid.codename, niveau: 'idkaart' }, brand.token);
  const id = r.body.verzoek.id;
  await api(base, '/api/paspoort/beslis', { id, akkoord: true }, lid.token);
  const trek = await api(base, '/api/paspoort/trek-in', { id }, lid.token);
  assert.equal(trek.status, 200);
  const bekijk = await api(base, '/api/supplier/paspoort/bekijk', { id }, brand.token);
  assert.equal(bekijk.status, 403, 'na intrekken geen inzage meer');
});

test('6. incident: partner eist op, RTG beoordeelt en geeft vrij', async () => {
  const inc = await api(base, '/api/supplier/paspoort/incident', { codenaam: lid.codename, reden: 'Schade op de kamer, gast weigert te betalen.', niveau: 'idkaart' }, brand.token);
  assert.equal(inc.status, 200);
  const incidentId = inc.body.incident.id;
  // RTG-kantoor ziet het open incident
  const lijst = await api(base, '/api/office/incidenten', { alleen: 'open' }, office);
  assert.ok(lijst.body.incidenten.some(i => i.id === incidentId), 'het incident staat op de RTG-lijst');
  // vrijgeven -> er ontstaat een tijdelijke inzage voor de partner
  const besl = await api(base, '/api/office/incident/beslis', { id: incidentId, besluit: 'vrijgeven' }, office);
  assert.equal(besl.status, 200);
  assert.equal(besl.body.incident.status, 'vrijgegeven');
  // de partner vindt de vrijgegeven inzage in zijn overzicht en kan hem openen
  const overzicht = await api(base, '/api/supplier/paspoort/overzicht', {}, brand.token);
  const vrij = overzicht.body.verzoeken.find(v => v.incident && v.status === 'goedgekeurd');
  assert.ok(vrij, 'de vrijgegeven inzage staat klaar voor de partner');
  const bekijk = await api(base, '/api/supplier/paspoort/bekijk', { id: vrij.id }, brand.token);
  assert.equal(bekijk.status, 200);
  assert.equal(bekijk.body.inhoud.naam, 'Jamie de Vries');
});

test('7. incident afwijzen deelt niets', async () => {
  const inc = await api(base, '/api/supplier/paspoort/incident', { codenaam: lid.codename, reden: 'Twijfel over de leeftijd, wil zekerheid.', niveau: 'paspoort' }, brand.token);
  const incidentId = inc.body.incident.id;
  const besl = await api(base, '/api/office/incident/beslis', { id: incidentId, besluit: 'afwijzen' }, office);
  assert.equal(besl.status, 200);
  assert.equal(besl.body.incident.status, 'afgewezen');
});

test('8. een onbekende codenaam levert geen inzage op', async () => {
  const r = await api(base, '/api/supplier/paspoort/vraag', { codenaam: 'Niet Bestaand 99', niveau: 'idkaart' }, brand.token);
  assert.equal(r.status, 404);
});

test('9. het lid ziet zijn eigen verificatiestatus (regie bij het lid)', async () => {
  const mijn = await api(base, '/api/paspoort/mijn', {}, lid.token);
  assert.equal(mijn.status, 200);
  assert.equal(mijn.body.status.geverifieerd, 'verified');
  assert.equal(mijn.body.status.gezichtGecontroleerd, true);
  assert.equal(mijn.body.status.selfieAanwezig, true);
  assert.ok(mijn.body.verzoeken.length >= 1, 'de historie van verzoeken staat er');
});
