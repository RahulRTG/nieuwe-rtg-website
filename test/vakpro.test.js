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

/* 5. /api/vak/offerte/intrek: het lid trekt een aanvraag in zolang hij nog geen
   akkoord gaf; de zaak ziet hem dan als ingetrokken en kan er geen akkoord meer
   op krijgen. Een akkoord-offerte trekt het lid niet meer in (dan is er een
   boeking), en een ander lid raakt hem niet aan.
   MUTATIE GEZIEN ZAKKEN: in server/kern/vakwerk/pro.js de 409-grendel
   `o.status === 'akkoord'` in offerteIntrek() op `false`; de toets zakte op "na
   akkoord trekt het lid niet meer in". */
test('5. intrekken: voor het akkoord wel, erna niet, en alleen de eigen aanvraag', async () => {
  const vraag = await api(base, '/api/vak/offerte/vraag',
    { supplierCode: 'CASTELL', omschrijving: 'Dakgoot reinigen en nakijken op lekkage' }, lid.token);
  assert.equal(vraag.status, 200);
  const id = vraag.body.offerte.id;
  assert.equal((await api(base, '/api/supplier/vak/offerte/antwoord', { id, prijs: 120 }, zaak.token)).status, 200);

  const u = Date.now().toString().slice(-8);
  const ander = (await api(base, '/api/auth/register', { name: 'Buur', email: 'bu' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  assert.equal((await api(base, '/api/vak/offerte/intrek', { id }, ander)).status, 404, 'andermans offerte bestaat hier niet');
  assert.equal((await api(base, '/api/vak/offerte/intrek', { id }, null)).status, 401);

  const weg = await api(base, '/api/vak/offerte/intrek', { id }, lid.token);
  assert.equal(weg.status, 200, JSON.stringify(weg.body).slice(0, 160));
  const mijn = await api(base, '/api/vak/offertes/mijn', {}, lid.token);
  assert.equal(mijn.body.offertes.find(o => o.id === id).status, 'ingetrokken');
  const pro = await api(base, '/api/supplier/vak/pro', {}, zaak.token);
  const bijZaak = (pro.body.offertes || []).find(o => o.id === id);
  assert.ok(!bijZaak || bijZaak.status === 'ingetrokken', 'de zaak ziet hem niet meer als open aanvraag');
  assert.equal((await api(base, '/api/vak/offerte/akkoord', { id }, lid.token)).status, 409,
    'op een ingetrokken offerte komt geen akkoord meer');

  // de offerte uit toets 1 is akkoord: die trekt het lid niet meer in
  assert.equal((await api(base, '/api/vak/offerte/intrek', { id: offerteId }, lid.token)).status, 409,
    'na akkoord trekt het lid niet meer in');
});
