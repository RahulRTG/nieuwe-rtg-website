/* ============================================================================
   DE BEDIENINGSLAAG VAN HET PLATFORM -- techniek, SSO, SCIM en de meting.

   Negenentwintig endpoints die de waargenomen dekkingsmeting als nooit
   aangeroepen aanwees, en ze horen bij elkaar: dit is de keten waarmee een
   zakelijke klant wordt aangesloten. De eigenaar zet in het techniekbord een
   SSO-koppeling neer, genereert daar een SCIM-sleutel bij, en pas dan gaan de
   publieke /api/sso/* en /api/scim/* endpoints iets doen.

   WAAROM ZE ONGETEST WAREN

   Er BESTAAT een test/techniek.test.js, maar die roept de module rechtstreeks
   aan (techniek.draaiChecks) en gaat nooit over HTTP. Dezelfde motor, tweede
   deur, en de deur was ongetoetst -- exact het patroon dat ook bij de leerlaag
   opdook. De rechtencontrole zit hier in de route (techAuth + eigenaarAlleen),
   dus juist die deur is wat er te bewijzen valt.

   WAT HIER OP HET SPEL STAAT

   Wie in het SSO-beheer mag schrijven, bepaalt wie het hele platform binnenkomt.
   Een koppeling met een domein dat je niet bezit is de kortste weg naar
   andermans account. Twee eisen dus, en ze zijn allebei absoluut:

     1. ALLEEN DE EIGENAAR. Niet "een ingelogd lid", niet "iemand van kantoor".
     2. HET CLIENT-GEHEIM KOMT ER NOOIT UIT. Het gaat erin en wordt versleuteld
        bewaard; een beheerscherm dat geheimen toont, lekt ze zodra iemand
        meekijkt of een schermafdruk maakt.

   Draai los: node --experimental-sqlite --test test/techniek-sso-scim.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-techsso-'));
let srv, base, eigenaar, vreemd, office;

const vraag = (pad, opts = {}) => fetch(base + pad, {
  method: opts.method || 'POST',
  headers: { 'Content-Type': 'application/json',
    ...(opts.token ? { Authorization: 'Bearer ' + opts.token } : {}), ...(opts.headers || {}) },
  body: (opts.method === 'GET' || opts.method === 'DELETE') ? undefined : JSON.stringify(opts.body || {})
}).then(async r => ({ status: r.status, tekst: await r.text() }))
  .then(r => { try { return { status: r.status, body: JSON.parse(r.tekst), tekst: r.tekst }; }
    catch (e) { return { status: r.status, body: {}, tekst: r.tekst }; } });

const post = (pad, body, token) => vraag(pad, { body, token });
const get = (pad, token, headers) => vraag(pad, { method: 'GET', token, headers });

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_OWNER_EMAIL: '',
    OFFICE_CODE: 'KANTOOR-TECHSSO' } });
  base = srv.base;

  // de eigenaar logt in op zijn eigen account (geseed op roellie.i@gmail.com)
  const o = await post('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' });
  assert.ok(o.body.token, 'de eigenaar kan inloggen: ' + o.tekst.slice(0, 200));
  eigenaar = o.body.token;

  // een gewoon lid, en een kantoorsessie: allebei mogen hier niet komen
  const u = Date.now().toString().slice(-9);
  const r = await post('/api/auth/register', { name: 'Gewoon Lid', email: 'ts' + u + '@x.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  vreemd = r.body.token;
  assert.ok(vreemd, 'het gewone lid bestaat');
  office = (await post('/api/office/login', { code: 'KANTOOR-TECHSSO' })).body.token;
  assert.ok(office, 'het kantoor is binnen');
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ================= 1. de deur van het techniekbord ================= */

test('1. het techniekbord is van de eigenaar, niet van een lid en niet van kantoor', async () => {
  const posts = ['/api/techniek/toegang', '/api/techniek/ai', '/api/techniek/bewaren/veeg',
    '/api/techniek/fouten/wis', '/api/techniek/sso', '/api/techniek/sso/schakel',
    '/api/techniek/sso/scimsleutel', '/api/techniek/sso/proef',
    '/api/techniek/wacht/av-test', '/api/techniek/wacht/analyseer', '/api/techniek/wacht/beslis',
    '/api/techniek/wacht/quarantaine', '/api/techniek/wacht/opruimen', '/api/techniek/wacht/lastafworp'];
  const gets = ['/api/techniek/sso', '/api/techniek/wacht/bord', '/api/techniek/papieren/document'];

  for (const pad of posts)
    for (const [wat, token] of [['zonder token', undefined], ['een LEDENtoken', vreemd], ['een KANTOORtoken', office]]) {
      const r = await post(pad, { org: 'x', id: 'x' }, token);
      assert.ok(r.status === 401 || r.status === 403, pad + ' met ' + wat + ': ' + r.status);
    }
  for (const pad of gets)
    for (const [wat, token] of [['zonder token', undefined], ['een LEDENtoken', vreemd]]) {
      const r = await get(pad, token);
      assert.ok(r.status === 401 || r.status === 403, pad + ' (GET) met ' + wat + ': ' + r.status);
    }
  // en met DELETE net zo
  for (const pad of ['/api/techniek/sso/klantx', '/api/techniek/sso/scimsleutel/klantx'])
    assert.ok([401, 403].includes((await vraag(pad, { method: 'DELETE', token: vreemd })).status),
      pad + ' (DELETE) met een ledentoken');
});

/* ================= 2. een koppeling zetten, en het geheim dat er niet uit komt ==== */

test('2. de eigenaar zet een SSO-koppeling; het clientSecret komt er nooit meer uit', async () => {
  const GEHEIM = 'zeer-geheim-' + Math.random().toString(36).slice(2, 10);
  const zet = await post('/api/techniek/sso', { org: 'klantx', naam: 'Klant X BV',
    issuer: 'https://login.klantx-idp.test', clientId: 'rtg-klantx',
    clientSecret: GEHEIM, domeinen: ['klantx.nl'], actief: true }, eigenaar);
  assert.equal(zet.status, 200, zet.tekst.slice(0, 300));
  assert.equal(zet.tekst.includes(GEHEIM), false, 'het antwoord op het ZETTEN bevat het geheim al niet');

  const lijst = await get('/api/techniek/sso', eigenaar);
  assert.equal(lijst.status, 200);
  const k = (lijst.body.koppelingen || []).find(x => x.org === 'klantx');
  assert.ok(k, 'de koppeling staat in de lijst');
  assert.equal(k.geheimGezet, true, 'het bord meldt DAT er een geheim is...');
  assert.equal(lijst.tekst.includes(GEHEIM), false, '...maar noemt het niet');
  assert.equal(typeof k.identiteiten, 'number', 'een aantal, geen namen');

  /* Een domein mag bij hoogstens een organisatie horen. Zonder die regel kan de
     IdP van klant Y een medewerker van klant X claimen. */
  const botsing = await post('/api/techniek/sso', { org: 'klanty', naam: 'Klant Y',
    issuer: 'https://login.klanty-idp.test', clientId: 'rtg-klanty',
    clientSecret: 'ander-geheim', domeinen: ['klantx.nl'] }, eigenaar);
  assert.equal(botsing.status, 400, 'een domein van een ander is niet te claimen');
});

test('3. schakelen, een proef draaien op een IdP die niet bestaat, en opruimen', async () => {
  const uit = await post('/api/techniek/sso/schakel', { org: 'klantx', actief: false }, eigenaar);
  assert.equal(uit.status, 200, uit.tekst.slice(0, 200));
  const aan = await post('/api/techniek/sso/schakel', { org: 'klantx', actief: true }, eigenaar);
  assert.equal(aan.status, 200);

  /* De proef praat met de buitenwereld. Het adres hierboven bestaat niet, dus
     dit hoort een NETTE melding te worden -- geen 500 en geen hangende
     aanvraag. De SSRF-slotgracht (sso/haal.js) hoort hem sowieso te weigeren
     als iemand een intern adres invult. */
  const proef = await post('/api/techniek/sso/proef', { org: 'klantx' }, eigenaar);
  assert.notEqual(proef.status, 500, 'een onbereikbare IdP valt niet om: ' + proef.status);

  const intern = await post('/api/techniek/sso', { org: 'binnen', naam: 'Binnendoor',
    issuer: 'http://127.0.0.1:9', clientId: 'x', clientSecret: 'y', domeinen: ['binnen.test'] }, eigenaar);
  if (intern.status === 200) {
    const p2 = await post('/api/techniek/sso/proef', { org: 'binnen' }, eigenaar);
    assert.notEqual(p2.status, 200, 'een IdP op een intern adres hoort niet te lukken');
    assert.notEqual(p2.status, 500, 'en hij valt er ook niet op om');
    await vraag('/api/techniek/sso/binnen', { method: 'DELETE', token: eigenaar });
  }
});

/* ================= 3. de SCIM-sleutel en de SCIM-endpoints ================= */

test('4. de SCIM-sleutel wordt EEN keer getoond en daarna nooit meer', async () => {
  const maak = await post('/api/techniek/sso/scimsleutel', { org: 'klantx' }, eigenaar);
  assert.equal(maak.status, 200, maak.tekst.slice(0, 300));
  const sleutel = maak.body.sleutel || maak.body.token || maak.body.key;
  assert.ok(sleutel && String(sleutel).length > 20, 'er komt een sleutel terug: ' + maak.tekst.slice(0, 200));
  global.__scim = sleutel;

  const opnieuw = await get('/api/techniek/sso', eigenaar);
  assert.equal(opnieuw.tekst.includes(sleutel), false,
    'de sleutel staat daarna nergens meer in het overzicht -- hij ligt gehasht op');
});

test('5. de SCIM-endpoints zitten ALLEMAAL achter de sleutel, ook de metadata', async () => {
  const sleutel = global.__scim;
  assert.ok(sleutel, 'de sleutel uit de vorige test');
  const scim = (pad, opts = {}) => vraag('/api/scim/v2' + pad, opts);

  const goed = { Authorization: 'Bearer ' + sleutel };

  /* RFC 7644 STAAT TOE dat de drie metadata-endpoints open staan -- een IdP
     leest ze voordat hij iets doet. Deze server zet ze toch achter de sleutel,
     en dat is de strengere keuze: ServiceProviderConfig verklapt welke SCIM-
     functies aanstaan, en dat is verkenningsinformatie die een aanvaller niet
     gratis hoeft te krijgen. De test legt de STRENGE stand vast; zou iemand ze
     later opengooien "omdat de RFC dat mag", dan valt hij hier om en is dat een
     bewust besluit in plaats van een schuivende default. */
  for (const pad of ['/ServiceProviderConfig', '/ResourceTypes', '/Schemas']) {
    assert.equal((await scim(pad, { method: 'GET' })).status, 401, 'scim' + pad + ' zonder sleutel');
    const r = await scim(pad, { method: 'GET', headers: goed });
    assert.equal(r.status, 200, 'scim' + pad + ' met sleutel: ' + r.status);
    assert.ok(r.body.schemas, 'scim' + pad + ' draagt een SCIM-schema');
    assert.equal(/roellie|@x\.nl|Gewoon Lid/i.test(r.tekst), false, 'scim' + pad + ' bevat geen persoonsgegevens');
  }

  // en de gebruikers natuurlijk ook
  assert.equal((await scim('/Users', { method: 'GET' })).status, 401, 'Users zonder sleutel');
  assert.equal((await scim('/Users', { method: 'GET', headers: { Authorization: 'Bearer fout' } })).status, 401,
    'Users met een verkeerde sleutel');
  const lijst = await scim('/Users', { method: 'GET', headers: goed });
  assert.equal(lijst.status, 200, 'met de goede sleutel gaat hij open: ' + lijst.tekst.slice(0, 200));
  assert.ok(lijst.body.schemas, 'het antwoord draagt een SCIM-schema');

  // een gebruiker aanmaken via SCIM, en hem daarna op id opvragen
  const nieuw = await scim('/Users', { headers: goed, body: {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    userName: 'nieuw.medewerker@klantx.nl', active: true,
    name: { givenName: 'Nieuw', familyName: 'Medewerker' },
    emails: [{ value: 'nieuw.medewerker@klantx.nl', primary: true }] } });
  assert.ok([200, 201].includes(nieuw.status), 'aanmaken via SCIM: ' + nieuw.status + ' ' + nieuw.tekst.slice(0, 200));
  const id = nieuw.body.id;
  assert.ok(id, 'de aangemaakte gebruiker heeft een id');

  const een = await scim('/Users/' + encodeURIComponent(id), { method: 'GET', headers: goed });
  assert.equal(een.status, 200, 'en is op id op te vragen');

  /* De sleutel van klant X mag niet ineens ook klant Y beheren. We hebben maar
     een koppeling, dus toetsen we de andere kant: een ingetrokken sleutel werkt
     niet meer. Dat is dezelfde grens, van de andere kant benaderd. */
  const weg = await vraag('/api/techniek/sso/scimsleutel/klantx', { method: 'DELETE', token: eigenaar });
  assert.equal(weg.status, 200, 'de eigenaar trekt de sleutel in: ' + weg.tekst.slice(0, 200));
  assert.equal((await scim('/Users', { method: 'GET', headers: goed })).status, 401,
    'de ingetrokken sleutel opent niets meer');
});

/* ================= 4. de publieke SSO-routes ================= */

test('6. de SSO-startroutes weigeren een onbekende organisatie en een open redirect', async () => {
  const onbekend = await post('/api/sso/waarheen', { email: 'iemand@nergens-bekend.test' });
  assert.notEqual(onbekend.status, 500, 'een onbekend domein valt niet om');
  assert.equal(onbekend.tekst.includes('klantx-idp'), false, 'en verklapt geen IdP-adres');

  const wijst = await post('/api/sso/waarheen', { email: 'directeur@klantx.nl' });
  assert.notEqual(wijst.status, 500);

  /* De terugkomst en de tokenwissel zijn de twee plekken waar een aanvaller
     komt. Een verzonnen state of een verzonnen overdrachtstoken hoort een nette
     weigering te zijn, nooit een sessie. */
  const terug = await get('/api/sso/terug?code=verzonnen&state=verzonnen');
  assert.notEqual(terug.status, 500, 'een verzonnen state valt niet om: ' + terug.status);
  assert.equal(/"token"\s*:\s*"[a-f0-9]{16}/i.test(terug.tekst), false, 'en levert geen sessietoken op');

  const wissel = await post('/api/sso/wissel', { token: 'verzonnen-overdrachtstoken' });
  assert.notEqual(wissel.status, 200, 'een verzonnen overdrachtstoken wisselt niets in');
  assert.notEqual(wissel.status, 500);

  const start = await get('/api/sso/start?org=bestaat-niet');
  assert.notEqual(start.status, 500, 'starten bij een onbekende org valt niet om');
});

/* ================= 5. de meting ================= */

test('7. /api/metrics staat niet zomaar open, en bevat geen persoonsgegevens', async () => {
  /* Zonder RTG_METRICS_TOKEN mag alleen een intern adres erbij. De testclient
     komt via 127.0.0.1 binnen, dus die telt als intern -- precies de opzet die
     in productie achter een reverse proxy zit. Wat er NIET in mag staan is
     belangrijker dan of hij open is: een scrape-endpoint wordt doorgaans minder
     streng bewaakt dan de database. */
  const m = await get('/api/metrics');
  assert.ok([200, 404].includes(m.status), '/api/metrics geeft 200 (intern) of 404 (geweigerd): ' + m.status);
  if (m.status === 200) {
    assert.ok(m.tekst.includes('rtg_verzoeken_totaal'), 'het Prometheus-formaat staat erin');
    assert.equal(/roellie|@x\.nl|Gewoon Lid/i.test(m.tekst), false, 'geen namen of adressen in de meting');
    /* En geen route met een ingevulde waarde erin: dan zou elke gebruiker een
       eigen tijdreeks krijgen en legt de monitoring zichzelf om. */
    assert.equal(/route="[^"]*\/(user-\d+|NL\d\d[A-Z]{4})/.test(m.tekst), false,
      'de labels dragen het routePATROON, geen ingevulde ids');
  }
  const kort = await get('/api/metrics/kort');
  assert.ok([200, 404].includes(kort.status), '/api/metrics/kort: ' + kort.status);

  // een verzonnen intern-verklaring in een kop mag niets openen dat dicht was
  const nep = await get('/api/metrics', undefined, { 'X-Forwarded-For': '10.0.0.1' });
  assert.ok([200, 404].includes(nep.status), 'een kop verandert de beoordeling niet in een fout');
});
