/* ============================================================================
   HET PAPIERWERK IN DE BOARDROOM.

   De 18 vragen die alleen een mens kan beantwoorden -- de juridische naam en
   het KvK-nummer, het privacy-aanspreekpunt, of er een FG is, hoe lang een
   paspoortscan bewaard wordt, welke verwerkers er zijn, en wie er bij een
   datalek om drie uur 's nachts gebeld wordt.

   Ze hingen alleen aan de technische pagina. Dat is de verkeerde plek: dit is
   bestuurswerk, geen systeembeheer. Ze staan nu ook in de boardroom, waar de
   eigenaar ze inlevert, bijwerkt en bijstelt.

   Wat deze test vastlegt:
   1. beide deuren werken, en het is dezelfde stand -- geen tweede administratie;
   2. de eigenaar kan invullen, WIJZIGEN en parkeren;
   3. wijzigen laat een spoor achter met wie en wanneer, en ZONDER de oude
      waarde -- dit bestand bevat privenummers, en een historie zou die
      verdubbelen;
   4. een boardroom-sleutel is NIET genoeg: wie de kamer in mag van de eigenaar,
      hoeft nog niet het privenummer van de jurist te zien;
   5. een gewone kantoorinlog komt er helemaal niet in;
   6. een geparkeerd antwoord blijft OPEN staan, zodat de go-live-keuring erop
      blijft blokkeren. "Ik weet het nog niet" hoort zichtbaar te blijven.

   Draai los: node --test test/papieren-boardroom.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-papieren-'));
let srv, base, office, baas, gast;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-PAP-1' } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'KANTOOR-PAP-1' })).body.token;
  assert.ok(office, 'de gedeelde kantoorinlog werkt');

  const eig = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  baas = (await api('/api/account/start', { rol: 'kantoor' }, eig)).body.token;
  assert.ok(baas, 'de eigenaar staat in de backoffice op zijn eigen account');

  /* En een tweede persoon MET boardroom-toegang maar zonder eigenaarschap.
     Precies het geval dat ertoe doet: de kamer open, de kluis dicht. */
  const u = Date.now().toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Boardroomgast', email: 'bg' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  const cn = (await api('/api/state', {}, reg.body.token)).body.state.user.codename;
  assert.equal((await api('/api/office/boardroom/toegang/geef', { codenaam: cn }, baas)).status, 200,
    'de eigenaar geeft boardroom-toegang');
  await api('/api/account/koppel', { soort: 'kantoor', code: 'KANTOOR-PAP-1' }, reg.body.token);
  gast = (await api('/api/account/start', { rol: 'kantoor' }, reg.body.token)).body.token;
  assert.ok(gast, 'en die persoon staat in de backoffice');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de eigenaar ziet alle achttien vragen, met de reden erbij', async () => {
  const r = await api('/api/office/papieren', {}, baas);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  assert.equal(r.body.totaal, 18, 'achttien vragen');
  assert.equal(r.body.open, 18, 'op een verse installatie staat alles open');
  assert.equal(r.body.klaar, false);
  assert.ok(r.body.volgende && r.body.volgende.vraag, 'er is een eerstvolgende vraag');
  assert.ok(r.body.volgende.waarom, 'met waarom hij het vraagt -- anders is het een invullijst');
  assert.ok(r.body.regels.some(x => x.groep === 'Bij een datalek'), 'de datalek-rollen zitten erbij');
});

test('2. invullen, en daarna WIJZIGEN -- allebei via de boardroom', async () => {
  const eerst = await api('/api/office/papieren/antwoord',
    { id: 'privacycontact', waarde: 'Iemand Achternaam, privacy@rtg.example' }, baas);
  assert.equal(eerst.status, 200, JSON.stringify(eerst.body).slice(0, 160));
  assert.equal(eerst.body.open, 17, 'er staat er een minder open');
  const regel = eerst.body.regels.find(x => x.id === 'privacycontact');
  assert.equal(regel.status, 'ingevuld');
  assert.match(regel.waarde, /privacy@rtg\.example/);
  assert.ok(regel.at, 'met een tijdstip');

  // en nu bijwerken: dat is dezelfde handeling, niet een aparte route
  const opnieuw = await api('/api/office/papieren/antwoord',
    { id: 'privacycontact', waarde: 'Ander Iemand, avg@rtg.example' }, baas);
  assert.equal(opnieuw.status, 200);
  const na = opnieuw.body.regels.find(x => x.id === 'privacycontact');
  assert.match(na.waarde, /avg@rtg\.example/, 'de nieuwe waarde staat er');
  assert.doesNotMatch(na.waarde, /privacy@rtg\.example/, 'de oude niet meer');
  assert.equal(opnieuw.body.open, 17, 'bijwerken opent niets opnieuw');
});

test('3. het spoor zegt WIE en WANNEER, en bewust niet WAT het was', async () => {
  const r = await api('/api/office/papieren', {}, baas);
  const mijn = (r.body.spoor || []).filter(x => x.id === 'privacycontact');
  assert.ok(mijn.length >= 2, 'invullen en bijwerken staan er allebei in: ' + JSON.stringify(mijn));
  assert.ok(mijn.some(x => x.actie === 'ingevuld'), 'de eerste keer heet ingevuld');
  assert.ok(mijn.some(x => x.actie === 'bijgewerkt'), 'de tweede keer bijgewerkt');
  for (const x of mijn) {
    assert.ok(x.at, 'met een tijdstip');
    assert.ok(x.door, 'en wie het deed: ' + JSON.stringify(x));
  }
  /* DE ASSERTIE DIE ERTOE DOET. Dit bestand bevat het privenummer van de jurist
     en de afspraak wie er 's nachts gebeld wordt. Een historie met oude waarden
     zou precies die gegevens verdubbelen, en dan is "bijwerken" geen bijwerken
     maar een tweede kopie. */
  const alles = JSON.stringify(r.body.spoor || []);
  assert.doesNotMatch(alles, /privacy@rtg\.example/, 'de oude waarde staat NIET in het spoor');
  assert.doesNotMatch(alles, /avg@rtg\.example/, 'en de nieuwe ook niet');
});

test('4. parkeren mag, en houdt het punt zichtbaar OPEN', async () => {
  const r = await api('/api/office/papieren/antwoord', { id: 'fg', parkeer: true, waarde: 'moet ik nog navragen' }, baas);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
  assert.equal(r.body.geparkeerd, true);
  const regel = r.body.regels.find(x => x.id === 'fg');
  assert.equal(regel.status, 'geparkeerd');
  assert.equal(regel.waarde, null, 'een geparkeerd punt heeft geen antwoord');
  assert.equal(r.body.klaar, false, 'en de keuring blijft erop blokkeren');
});

test('5. de boardroom-sleutel is niet genoeg: dit is van de eigenaar', async () => {
  /* Wie van de eigenaar de sleutel van de kamer kreeg, mag meebesturen -- maar
     hoeft daarom nog niet het privenummer van de jurist en het KvK-dossier te
     zien. Toegang tot een kamer is niet hetzelfde als eigenaarschap. */
  const lezen = await api('/api/office/papieren', {}, gast);
  assert.equal(lezen.status, 403, 'lezen mag niet: ' + JSON.stringify(lezen.body).slice(0, 140));
  const schrijven = await api('/api/office/papieren/antwoord', { id: 'privacycontact', waarde: 'ik@elders.example' }, gast);
  assert.equal(schrijven.status, 403, 'schrijven al helemaal niet');
  assert.doesNotMatch(JSON.stringify(lezen.body), /rtg\.example/, 'en er lekt geen antwoord mee in de weigering');
});

test('6. een gewone kantoorinlog komt er niet in', async () => {
  assert.equal((await api('/api/office/papieren', {}, office)).status, 403, 'de gedeelde code is geen persoon en geen eigenaar');
  assert.equal((await api('/api/office/papieren/antwoord', { id: 'fg', waarde: 'ja, iemand' }, office)).status, 403);
  assert.equal((await api('/api/office/papieren', {}, null)).status, 401, 'en zonder inlog al niets');
});

test('7. het is EEN administratie: wat in de boardroom ingaat, staat op het techniekbord', async () => {
  /* Twee deuren naar dezelfde gegevens met elk hun eigen code lopen uiteen
     zodra iemand er een aanraakt. Daarom delen ze een implementatie -- en deze
     test bewaakt dat er ook echt maar een administratie achter zit. */
  const tech = (await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
  assert.ok(tech, 'de eigenaar komt op het techniekbord');
  const via = await fetch(base + '/api/techniek/papieren', { headers: { Authorization: 'Bearer ' + tech } });
  assert.equal(via.status, 200);
  const board = await via.json();
  const regel = board.regels.find(x => x.id === 'privacycontact');
  assert.match(regel.waarde, /avg@rtg\.example/, 'het antwoord uit de boardroom staat hier ook');
  assert.equal(board.regels.find(x => x.id === 'fg').status, 'geparkeerd', 'en het geparkeerde punt ook');
});

test('8. het document toont zijn eigen gaten in plaats van ze te verbergen', async () => {
  const lijst = await api('/api/office/papieren/documenten', {}, baas);
  assert.equal(lijst.status, 200);
  assert.ok((lijst.body.documenten || []).length >= 1, 'er is minstens een document');
  const naam = lijst.body.documenten[0].naam;
  const d = await api('/api/office/papieren/document', { naam }, baas);
  assert.equal(d.status, 200, JSON.stringify(d.body).slice(0, 160));
  assert.ok(d.body.tekst && d.body.tekst.length > 100, 'er komt echte tekst terug');
  assert.ok(typeof d.body.gaten === 'number' && d.body.gaten > 0,
    'en het telt zijn eigen openstaande plekken -- een register dat zijn gaten verbergt is gevaarlijker dan een register met gaten');
});

test('9. beide werkwoorden geven hetzelfde papier: vier methoden die nog nooit waren aangeraakt', async () => {
  /* WAAROM DEZE TOETS ERBIJ MOEST. Op deze vier paden hangen GET én POST, en
     routes/papieren-deur.js zegt met zoveel woorden waarom: "Dezelfde stand via
     POST. De boardroom praat overal met POST + Bearer; een GET zou daar de enige
     uitzondering zijn." Dat is een belofte over twee werkwoorden, en tot deze
     ronde was er per pad maar één van de twee ooit aangeroepen -- de
     dekkingsmeting telde per PAD, dus de andere lifte gratis mee:

       GET  /api/office/papieren            (alleen de POST was beproefd)
       GET  /api/office/papieren/document   (idem)
       POST /api/techniek/papieren          (alleen de GET was beproefd)
       POST /api/techniek/papieren/document (idem)

     Haal een van de acht registratieregels weg en er verandert niets zichtbaars
     -- behalve dat de helft van de bellers een 404 krijgt. Deze toets legt de
     belofte vast in plaats van de statuscode: de twee werkwoorden horen HETZELFDE
     antwoord te geven. */
  const tech = (await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
  assert.ok(tech, 'de eigenaar komt op het techniekbord');
  const viaGet = (pad, token) => fetch(base + pad, { headers: { Authorization: 'Bearer ' + token } })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  /* De stand wisselt niet tussen twee aanroepen (papieren.overzicht() leest de
     database), dus mogen de twee antwoorden echt vergeleken worden. `volgende`
     hoort er bij te zitten: dat is het veld waar het bord op leunt. */
  const kantoorPost = await api('/api/office/papieren', {}, baas);
  const kantoorGet = await viaGet('/api/office/papieren', baas);
  assert.equal(kantoorGet.status, 200, 'GET op het kantoorpapierwerk: ' + kantoorGet.status);
  assert.deepEqual(kantoorGet.body, kantoorPost.body, 'GET en POST geven dezelfde stand');
  assert.ok(kantoorGet.body.regels && kantoorGet.body.regels.length, 'en het is een echte stand, geen leeg object');

  const bordPost = await api('/api/techniek/papieren', {}, tech);
  const bordGet = await viaGet('/api/techniek/papieren', tech);
  assert.equal(bordPost.status, 200, 'POST op het techniekbord: ' + bordPost.status);
  assert.deepEqual(bordPost.body, bordGet.body, 'ook daar geven beide werkwoorden hetzelfde');
  assert.deepEqual(bordPost.body.regels, kantoorPost.body.regels,
    'en het blijft EEN administratie, langs welk werkwoord en welke deur je ook binnenkomt');

  /* Het document langs alle vier de ingangen. De naam komt uit de lijst en niet
     uit een verzonnen string: een typefout zou hier vier keer 404 geven en dan
     zou de toets alleen bewijzen dat 404 bestaat. */
  const naam = (await api('/api/office/papieren/documenten', {}, baas)).body.documenten[0].naam;
  const docs = [
    ['office POST', await api('/api/office/papieren/document', { naam }, baas)],
    ['office GET', await viaGet('/api/office/papieren/document?naam=' + encodeURIComponent(naam), baas)],
    ['techniek POST', await api('/api/techniek/papieren/document', { naam }, tech)],
    ['techniek GET', await viaGet('/api/techniek/papieren/document?naam=' + encodeURIComponent(naam), tech)]
  ];
  for (const [wie, r] of docs) {
    assert.equal(r.status, 200, wie + ' geeft het document: ' + r.status);
    assert.deepEqual(r.body, docs[0][1].body, wie + ' geeft hetzelfde document als de eerste ingang');
  }
  assert.ok(docs[0][1].body.tekst.length > 100, 'en er staat echt tekst in');
});
