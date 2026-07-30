/* Vakwerk Pro: de pro-laag van de dienstverlenende genres -- de offerte-keten
   (lid vraagt vrije klus, zaak biedt prijs, lid geeft akkoord en de klus staat
   als bevestigde boeking klaar), de digitale werkbon die met de boeking van
   het lid meereist, het klantenboek op codenaam en het herhaal-onderhoud.
   Draai: npm test */
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

let srv, base, lid, zaak, offerteId, boekingRef, codenaam;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vakpro-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-PRO-1' } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Protest', email: 'p' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = { token: reg.body.token };
  const roster = await api(base, '/api/supplier/roster', { code: 'CASTELL' });
  const mgr = (roster.body.staff || []).find(x => x.role === 'manager');
  const login = await api(base, '/api/supplier/login', { code: 'CASTELL', staffId: mgr && mgr.id, pin: '1234' });
  zaak = { token: login.body.token };
});
test.after(() => stop(srv && srv.child));

test('1. de offerte-keten: vraag -> aanbod -> akkoord = bevestigde boeking op codenaam', async () => {
  const vraag = await api(base, '/api/vak/offerte/vraag',
    { supplierCode: 'CASTELL', omschrijving: 'Schutting van 8 meter vervangen, hout in overleg' }, lid.token);
  assert.equal(vraag.status, 200);
  offerteId = vraag.body.offerte.id;
  // de zaak ziet de aanvraag op codenaam en biedt een prijs (alleen de eigenaar)
  const pro = await api(base, '/api/supplier/vak/pro', {}, zaak.token);
  const rij = (pro.body.offertes || []).find(o => o.id === offerteId);
  assert.ok(rij && rij.klant && !rij.klant.includes('Protest'), 'de zaak ziet alleen de codenaam');
  const bied = await api(base, '/api/supplier/vak/offerte/antwoord',
    { id: offerteId, prijs: 780, toelichting: 'Incl. hout en afvoer' }, zaak.token);
  assert.equal(bied.status, 200);
  // het lid ziet het aanbod en geeft akkoord; er ontstaat een bevestigde boeking
  const mijn = await api(base, '/api/vak/offertes/mijn', {}, lid.token);
  const aanbod = mijn.body.offertes.find(o => o.id === offerteId);
  assert.equal(aanbod.status, 'aangeboden');
  assert.equal(aanbod.prijs, 780);
  const ok = await api(base, '/api/vak/offerte/akkoord', { id: offerteId }, lid.token);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.boeking.status, 'bevestigd');
  assert.equal(ok.body.boeking.paid, false, 'akkoord is geen betaling');
  assert.ok(!JSON.stringify(ok.body).includes('Protest'), 'nergens een echte naam');
  boekingRef = ok.body.boeking.ref;
  codenaam = ok.body.boeking.customerCodename;
  // dubbel akkoord kan niet
  assert.equal((await api(base, '/api/vak/offerte/akkoord', { id: offerteId }, lid.token)).status, 409);
});

test('2. de digitale werkbon reist mee met de boeking van het lid', async () => {
  await api(base, '/api/supplier/booking/status', { ref: boekingRef, status: 'afgerond' }, zaak.token);
  const pro = await api(base, '/api/supplier/vak/pro', {}, zaak.token);
  assert.ok(pro.body.werkbonOpen.some(x => x.ref === boekingRef), 'de afgeronde klus wacht op een werkbon');
  const wb = await api(base, '/api/supplier/vak/werkbon',
    { ref: boekingRef, werk: 'Oude schutting verwijderd, nieuwe geplaatst', materiaal: '16 delen douglas' }, zaak.token);
  assert.equal(wb.status, 200);
  const mijn = await api(base, '/api/bookings/mine', {}, lid.token);
  const b = (mijn.body.boekingen || []).find(x => x.ref === boekingRef);
  assert.ok(b && b.werkbon && /schutting/i.test(b.werkbon.werk), 'het lid ziet de werkbon bij de boeking');
  // een tweede werkbon op dezelfde klus kan niet
  assert.equal((await api(base, '/api/supplier/vak/werkbon', { ref: boekingRef, werk: 'nogmaals iets' }, zaak.token)).status, 409);
});

test('3. het klantenboek draait op codenamen, met een eigen notitie', async () => {
  const nz = await api(base, '/api/supplier/vak/klantnotitie', { codenaam, tekst: 'Sleutel bij de buren' }, zaak.token);
  assert.equal(nz.status, 200);
  const pro = await api(base, '/api/supplier/vak/pro', {}, zaak.token);
  const k = pro.body.klanten.find(x => x.codenaam === codenaam);
  assert.ok(k && k.aantal >= 1 && k.notitie === 'Sleutel bij de buren');
  assert.ok(!JSON.stringify(pro.body).includes('Protest'), 'het klantenboek kent geen echte namen');
});

test('4. herhaal-onderhoud: interval per dienst, alleen de eigenaar', async () => {
  const hh = await api(base, '/api/supplier/vak/dienst/herhaal', { id: 'b1', mnd: 12 }, zaak.token);
  assert.equal(hh.status, 200);
  assert.equal(hh.body.herhaalMnd, 12);
  const pro = await api(base, '/api/supplier/vak/pro', {}, zaak.token);
  assert.ok(Array.isArray(pro.body.onderhoud), 'de onderhoudslijst bestaat (vers werk is nog niet aan de beurt)');
});
