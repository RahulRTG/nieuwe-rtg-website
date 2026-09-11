/* HET VAKSCHEMA OVER HTTP -- de bedrading, en met opzet niet meer dan dat.

   test/vakschema.test.js beproeft het GEDRAG op de kern: de poort, de
   dubbelklik, wie wat terugleest. Deze suite beantwoordt de andere vraag, die je
   daar niet kunt stellen: hangen de routes werkelijk aan die kern, komen ze door
   de juiste deur binnen, en lezen ze het lijf zoals de kern het verwacht.

   WAT DEZE SUITE NIET BEWIJST, en dat hoort er even groot bij: de GESLAAGDE weg.
   Daarvoor is een zaak nodig met het genre `fysiotherapie` (status `bewijs`, dus
   toegelaten door een mens van RTG) en een medewerker met een AFGETEKENDE
   BIG-registratie, en die wereld zet de opzet hier niet op. Wat er wel staat is
   de weigering langs elke as -- geen sessie, verkeerd genre, onbekend voorstel
   -- en dat is precies wat een verkeerd bedrade route NIET zou geven.

   Draai los: node --test test/vakschema.e2e.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child, lid, zaak;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vaksch-'));

const post = (pad, body, tok) => fetch(BASE + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  lid = (await post('/api/auth/register', { name: 'Sporter Drie', email: 'vs1@x.nl',
    phone: '0612346001', password: 'geheim12345', geboortedatum: '1996-02-02', tier: 'rtg' })).body.token;
  zaak = (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. zonder sessie komt er niemand bij', async () => {
  assert.equal((await post('/api/training/voorstellen', {}, null)).status, 401);
  assert.equal((await post('/api/training/voorstel/aanvaard', { id: 'x' }, null)).status, 401);
  assert.equal((await post('/api/supplier/vakschema/voorstel', {}, null)).status, 401);
  assert.equal((await post('/api/supplier/vakschema/mijn', {}, null)).status, 401);
});

test('2. het antwoord van het LID komt aantoonbaar uit de kern', async () => {
  const r = await post('/api/training/voorstellen', {}, lid);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));

  /* GEEN `deepEqual(voorstellen, [])` HIER, en dat is met opzet. Zo'n bewering
     slaagt ook als deze route NOOIT iets teruggeeft, en dan toetst hij niets
     (scripts/tandeloos.js). Wat wel iets zegt: het antwoord draagt de letterlijke
     zin die kern/vakschema-lid.js meestuurt. Staat die er, dan hangt de route aan
     de echte kern en niet aan een lege stub -- en die zin kan niet toevallig
     ontstaan. */
  const kern = require('../server/kern/vakschema-lid')({
    kijk: () => ({}), save() {}, scho: (v) => v, nu: () => '', trainingZet: () => null });
  assert.equal(r.body.let, kern.mijn('wie-dan-ook').let);
  assert.ok(Array.isArray(r.body.voorstellen));
});

test('3. een zaak met het verkeerde genre wordt geweigerd, en hoort waarom', async () => {
  const r = await post('/api/supplier/vakschema/voorstel',
    { mens: 'Iemand', naam: 'Opbouw knie', wat: 'zes weken rustig opbouwen' }, zaak);
  assert.equal(r.status, 403, JSON.stringify(r.body).slice(0, 200));
  assert.match(r.body.error, /fysiotherapie|sportgeneeskunde/i,
    'de weigering zegt bij wat voor zaak dit hoort; een kale nee stuurt iemand op zoek');
  /* En de LEESweg valt onder dezelfde poort: wie niet mag sturen, mag ook niet
     zien wat er ooit vanuit deze zaak is gestuurd. */
  assert.equal((await post('/api/supplier/vakschema/mijn', {}, zaak)).status, 403);
});

test('4. het lijf komt door tot in de kern', async () => {
  /* Een onbekend voorstel-id geeft 404 en niet 400 of 500: dat kan alleen als de
     route `id` werkelijk uitleest en doorgeeft aan de kern, die er in de reeks
     van DIT lid naar zoekt. */
  const a = await post('/api/training/voorstel/aanvaard', { id: 'vsbestaatniet' }, lid);
  assert.equal(a.status, 404);
  assert.match(a.body.error, /staat niet voor u open/i);
  const w = await post('/api/training/voorstel/weiger', { id: 'vsbestaatniet', reden: 'nee' }, lid);
  assert.equal(w.status, 404);
  /* En zonder id ook: een lege body hoort niet stil iets te raken. */
  assert.equal((await post('/api/training/voorstel/aanvaard', {}, lid)).status, 404);
});

test('5. een mislukte poging laat geen spoor achter in de opslag', async () => {
  /* De tegenproef op toets 4: een 404 mag geen rij hebben aangemaakt. Dat is de
     regel uit kern/eigencollectie.js -- opzoeken maakt niets aan -- en hij is
     hier extra hard, want een aangemaakte rij verraadt dat er naar deze mens is
     gevraagd.

     Gemeten op de OPSLAG en niet op een lege lijst in het antwoord: "de lijst is
     leeg" slaagt ook als de route altijd leeg antwoordt, en dan is de bewering
     tandeloos. Dat de collectie helemaal niet BESTAAT, is wel een uitspraak. */
  await post('/api/training/voorstel/aanvaard', { id: 'vsnogsteedsniet' }, lid);

  /* De server schrijft db.json pas weg bij een save, en juist dat is hier de
     uitspraak: gebeurt er niets, dan STAAT er ook niets. Bestaat het bestand
     wel, dan hoort `vakschema` er niet in te zitten. Allebei de takken zijn een
     geldig bewijs, en geen van beide slaagt vanzelf -- zou de route een rij
     aanmaken, dan volgt er een save en zakt deze toets. */
  const pad = path.join(TMP, 'db.json');
  if (!fs.existsSync(pad)) {
    const na = await post('/api/training/voorstellen', {}, lid);
    assert.equal(na.status, 200, 'de server leeft nog; er is alleen niets weggeschreven');
    return;
  }
  const db = JSON.parse(fs.readFileSync(pad, 'utf8'));
  const data = db.data || db;
  assert.equal(data.vakschema, undefined,
    'een verzoek dat op 404 eindigt heeft toch een rij aangemaakt; dat verraadt dat ernaar is gevraagd');
});
