/* ============================================================================
   WIE HEEFT DEZE PAS TOEGEKEND?

   Het accepteren of afwijzen van een aanmelding is de ENE menselijke handeling
   in een verder volledig geautomatiseerde stroom. De merkregel is hard: een
   Lifestyle- of Business Pass ontstaat uitsluitend na menselijke goedkeuring, en
   de AI kent ze nooit zelf toe. De kern bewaakt dat ook: beslis() weigert een
   besluit zonder naam met "een besluit draagt altijd de naam van de mens die
   beslist".

   En toch droeg ELK besluit ooit genomen dezelfde naam: 'RTG-personeel'. De
   route deed `req.session.codename || ... || 'RTG-personeel'`, maar deze routes
   staan achter officeAuth en die zet req.session HELEMAAL NIET. De terugval was
   dus niet een uitzondering maar de regel. De grendel stond er, en werd verslagen
   door een waarde die er altijd langs kwam.

   WAAROM DIT BESTAND BESTAAT EN test/aanmeldingen.test.js NIET GENOEG WAS. Die
   toetst de kern rechtstreeks (maak() + beslis()) en geeft de naam met de hand
   mee -- precies zoals de kapotte route dat deed. Hij kan deze fout per
   constructie niet zien. Dit bestand gaat over de ROUTE, met een echte server en
   echte inloggen, want daar zat hij.

   Draai los: node --experimental-sqlite --test test/aanmeldbesluit.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-besluit-'));
const CODE = 'KANTOOR-BESLUIT-1';
let srv, base, gedeeld, eigenaarKantoor;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const vraagAan = (pas) => api('/api/aanmelding/aanvraag',
  { pas, naam: 'Aanvrager ' + pas, email: 'a' + Date.now().toString(36) + pas + '@voorbeeld.test' });

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  base = srv.base;
  gedeeld = (await api('/api/office/login', { code: CODE })).body.token;
  assert.ok(gedeeld, 'de gedeelde kantoorcode werkt');

  const eig = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  eigenaarKantoor = (await api('/api/account/start', { rol: 'kantoor' }, eig)).body.token;
  assert.ok(eigenaarKantoor, 'de eigenaar staat in de backoffice op zijn eigen account');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* DE BEWERING DIE DE FOUT VASTPINT. Met de gedeelde code is er niemand aan te
   wijzen, en dan mag er geen Lifestyle Pass ontstaan. */
test('1. de gedeelde kantoorcode kent geen Lifestyle Pass toe', async () => {
  const a = await vraagAan('lifestyle');
  assert.ok(a.body.aanmelding && a.body.aanmelding.id, 'de aanvraag is aangenomen: ' + JSON.stringify(a.body).slice(0, 140));

  const besluit = await api('/api/aanmelding/beslis',
    { id: a.body.aanmelding.id, besluit: 'geaccepteerd' }, gedeeld);
  assert.equal(besluit.status, 403, 'geweigerd: ' + JSON.stringify(besluit.body).slice(0, 160));
  assert.match(besluit.body.error, /herleidbaar persoon/, 'en het zegt hoe het wel moet');
  assert.doesNotMatch(JSON.stringify(besluit.body), /RTG-personeel/, 'geen verzonnen naam meer');
});

test('2. een Business Pass net zo min', async () => {
  const a = await vraagAan('business');
  const besluit = await api('/api/aanmelding/beslis',
    { id: a.body.aanmelding.id, besluit: 'geaccepteerd' }, gedeeld);
  assert.equal(besluit.status, 403, JSON.stringify(besluit.body).slice(0, 160));
});

/* De tegenproef. Zonder deze bewijst toets 1 alleen dat er iets dichtzit, niet
   dat de goede persoon er wel doorheen komt. */
test('3. de eigenaar met zijn eigen inlog kan het wel, en komt met naam in het spoor', async () => {
  const a = await vraagAan('lifestyle');
  const besluit = await api('/api/aanmelding/beslis',
    { id: a.body.aanmelding.id, besluit: 'geaccepteerd', notitie: 'Op uitnodiging' }, eigenaarKantoor);
  assert.equal(besluit.status, 200, JSON.stringify(besluit.body).slice(0, 160));
  const door = besluit.body.aanmelding.besluit.door;
  assert.ok(door && door.length > 1, 'het besluit draagt een herleidbare sleutel: ' + door);
  assert.notEqual(door, 'RTG-personeel', 'en niet de oude verzonnen naam');
  assert.notEqual(door, 'backoffice (gedeelde code)', 'de eigenaar is wel te herleiden');
});

/* De RTG Pass ligt anders: die staat na de AI-intake voor iedereen open, dus
   daar is een herleidbaar persoon te zwaar. Maar het spoor liegt niet: het zegt
   dat het via de gedeelde code ging. Beter een spoor dat "we weten het niet"
   zegt dan een spoor dat een persoon verzint. */
test('4. een RTG Pass mag met de gedeelde code, en het spoor zegt dat eerlijk', async () => {
  const a = await vraagAan('rtg');
  const besluit = await api('/api/aanmelding/beslis',
    { id: a.body.aanmelding.id, besluit: 'geaccepteerd' }, gedeeld);
  assert.equal(besluit.status, 200, JSON.stringify(besluit.body).slice(0, 160));
  assert.equal(besluit.body.aanmelding.besluit.door, 'backoffice (gedeelde code)');
});

test('5. zonder backoffice-inlog beslist niemand iets', async () => {
  const a = await vraagAan('rtg');
  const zonder = await api('/api/aanmelding/beslis', { id: a.body.aanmelding.id, besluit: 'geaccepteerd' }, null);
  assert.equal(zonder.status, 401, JSON.stringify(zonder.body).slice(0, 140));
});
