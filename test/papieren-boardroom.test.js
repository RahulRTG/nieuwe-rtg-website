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

   Draai los: node --experimental-sqlite --test test/papieren-boardroom.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
// de vragen komen uit de BRON, zodat toets 9 meegroeit als er een bijkomt
const { VRAGEN } = require('../server/papieren/vragen');

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

/* ---------------------------------------------------------------------------
   9. DE HELE WEG, EEN KEER ECHT AFGELOPEN

   De acht toetsen hierboven meten stukken van de deur. Wat er nog nooit is
   nagegaan is de vraag waar het om te doen is: KAN de eigenaar het papierwerk
   in de boardroom werkelijk AFMAKEN? Dat zijn drie blokkerende punten uit
   TAKEN.md tegelijk (1.6 het verwerkingsregister, 1.7 het datalek-draaiboek,
   1.8 de achttien vragen) en het zijn er in werkelijkheid geen drie maar EEN:
   de twee documenten vullen zichzelf uit dezelfde antwoorden.

   Niemand had die poort ooit zien OMSLAAN. Een keuring die je alleen rood hebt
   zien staan, is in dit huis geen bewijs -- precies de reden dat LAT-regel 9
   bestaat. Hier gaat hij van rood naar groen en weer terug.

   De antwoorden hieronder zijn duidelijk herkenbare TOETSWAARDEN. Ze staan
   niet in de repository en ze raken het echte register niet: deze server
   draait op een eigen datamap die na afloop wordt weggegooid.
   --------------------------------------------------------------------------- */
test('9. de eigenaar kan het papierwerk in de boardroom AFMAKEN, en dan zijn beide documenten dicht', async () => {
  const stand = await api('/api/office/papieren', {}, baas);
  assert.equal(stand.status, 200);
  assert.ok(stand.body.open > 0, 'er staat nog werk open, anders meet deze toets niets');

  /* Elke vraag krijgt een antwoord in de vorm die ZIJN EIGEN soort eist. Een
     kaal "ja" op een ja-nee-reden hoort geweigerd te worden, en dat wordt
     hieronder ook nagegaan -- anders zou deze toets een deur groen melden die
     alles aanneemt. De soort komt uit de bron en niet uit een lijstje hier:
     komt er een vraag bij, dan loopt deze toets er vanzelf overheen. */
  const SOORT = new Map(VRAGEN.map(v => [v.id, v.soort || 'tekst']));
  assert.equal(stand.body.regels.length, VRAGEN.length, 'het bord toont ze allemaal');
  for (const r0 of stand.body.regels) {
    const waarde = SOORT.get(r0.id) === 'ja-nee-reden'
      ? 'ja, met Toetspartij B.V., per 1 september 2026 getekend'
      : 'Toetsantwoord voor ' + r0.id + ' -- vastgelegd door de toets, geen echt gegeven';
    const r = await api('/api/office/papieren/antwoord', { id: r0.id, waarde }, baas);
    assert.equal(r.status, 200, r0.id + ': ' + JSON.stringify(r.body).slice(0, 160));
  }

  const na = await api('/api/office/papieren', {}, baas);
  assert.equal(na.body.open, 0, 'alle achttien staan beantwoord');
  assert.equal(na.body.klaar, true, 'en het papierwerk meldt zichzelf af');
  assert.equal(na.body.volgende, null, 'en Rahul heeft niets meer te vragen');

  /* En nu de documenten zelf. Ze dragen hun merktekens in git en worden pas
     bij het opvragen gevuld; wat nog open staat blijft er zichtbaar in staan.
     Dus: geen enkel open merkteken meer, en de antwoorden staan er echt in. */
  const docs = (await api('/api/office/papieren/documenten', {}, baas)).body.documenten;
  assert.equal(docs.length, 2, 'het verwerkingsregister en het datalek-draaiboek');
  for (const d of docs) {
    const doc = await api('/api/office/papieren/document', { naam: d.naam }, baas);
    assert.equal(doc.status, 200, d.naam);
    assert.equal(doc.body.gaten, 0, d.naam + ' heeft geen open plekken meer');
    assert.ok(!/\{\{/.test(doc.body.tekst), d.naam + ': geen onvervangen merktekens');
    assert.ok(!/nog niet uitgevraagd|nog niet bekend/.test(doc.body.tekst),
      d.naam + ': en ook geen openstaand-melding meer');
    /* En de ingetypte antwoorden staan er ECHT in -- niet alleen: de
       merktekens zijn weg. Welk veld dat is verschilt per document (het
       register draagt het bedrijf, het draaiboek de vier rollen), dus het
       antwoord wordt herkend aan zijn eigen vorm en niet aan een naam die
       maar in een van de twee voorkomt. */
    assert.match(doc.body.tekst, /Toetsantwoord voor \w+/,
      d.naam + ': de ingetypte antwoorden staan er echt in');
  }

  /* De tegenproef, en die is het halve punt van deze toets. Een deur die dicht
     KAN, moet ook weer open kunnen -- parkeer er een, en beide documenten
     melden hun gat opnieuw. Zonder deze stap zou een document dat zijn
     merktekens gewoon WEGGOOIT er hierboven precies zo uitzien. */
  assert.equal((await api('/api/office/papieren/antwoord',
    { id: 'verantwoordelijke', parkeer: true, waarde: 'moet ik navragen bij de KvK' }, baas)).status, 200);
  const terug = await api('/api/office/papieren', {}, baas);
  assert.equal(terug.body.open, 1, 'parkeren zet hem weer open');
  assert.equal(terug.body.klaar, false, 'en het papierwerk is niet meer af');
  const weer = await api('/api/office/papieren/document', { naam: 'verwerkingsregister' }, baas);
  assert.ok(weer.body.gaten >= 1, 'en het document meldt zijn gat weer');
  assert.match(weer.body.tekst, /nog niet bekend/, 'met zoveel woorden');

  /* En een kaal "ja" op een ja-nee-vraag komt er niet doorheen. Kwam dat er
     wel door, dan zou de lus hierboven achttien lege antwoorden hebben kunnen
     wegschrijven en de poort groen melden zonder dat er iets vaststond. */
  const kaal = await api('/api/office/papieren/antwoord', { id: 'fg', waarde: 'ja' }, baas);
  assert.equal(kaal.status, 400, 'een kaal ja zonder toelichting wordt geweigerd');
});

/* ---------------------------------------------------------------------------
   10. DE KEURING OP DEZELFDE PAGINA ALS HET WERK

   npm run golive telt acht blokkerende punten, en DRIE ervan worden hier
   ingevuld. Wie het werk doet kon dus niet zien of het genoeg was: daarvoor
   moest iemand een script draaien op een machine waar de eigenaar niet bij
   kan. De keuring hangt nu naast het papierwerk, met dezelfde controles uit
   server/golive.js -- geen tweede lijst ernaast, want twee lijsten over
   dezelfde opstelling lopen uiteen zodra iemand er een aanraakt.

   Twee dingen worden hier bewaakt die verder gaan dan "de route antwoordt":
   de lijst BEWEEGT als je het papierwerk invult (anders is het een plaatje),
   en er staat GEEN sleutelwaarde in het antwoord. Dat laatste is geen detail:
   dit antwoord reist naar een browser en belandt daarna in een cache, een log
   en een schermafdruk.
   --------------------------------------------------------------------------- */
test('10. de go-live-keuring staat in de boardroom, beweegt mee, en lekt geen sleutel', async () => {
  // eerst het papierwerk weer helemaal open, zodat de keuring iets te melden heeft
  for (const r of (await api('/api/office/papieren', {}, baas)).body.regels)
    await api('/api/office/papieren/antwoord', { id: r.id, parkeer: true, waarde: 'nog navragen' }, baas);

  const open = await api('/api/office/golive', {}, baas);
  assert.equal(open.status, 200);
  assert.ok(open.body.blokkers > 0, 'er staan blokkerende punten');
  assert.equal(open.body.klaar, false);
  const papierPunt = open.body.punten.find(p => /Papierwerk:/.test(p.tekst));
  assert.ok(papierPunt && papierPunt.blokkeert, 'het openstaande papierwerk blokkeert');
  assert.match(papierPunt.tekst, /18 van de 18/, 'en zegt hoeveel er open staan');
  assert.ok(open.body.punten.some(p => /VERWERKINGSREGISTER\.md/.test(p.tekst) && p.blokkeert),
    'en het register meldt zijn eigen gaten');
  assert.ok(open.body.buitenDeCode.some(x => /pentest/i.test(x)),
    'wat buiten de code ligt staat er elke keer bij, anders wordt het overgeslagen');

  /* DE LIJST BEWEEGT. Zonder deze stap zou een keuring die zijn oordeel uit
     een oud bestand leest er precies zo uitzien. */
  for (const r of (await api('/api/office/papieren', {}, baas)).body.regels) {
    const waarde = r.id === 'fg' || /^vwo/.test(r.id) || r.id === 'dpia'
      ? 'ja, met Toetspartij B.V., per 1 september 2026 getekend'
      : 'Toetsantwoord voor ' + r.id + ' -- vastgelegd door de toets, geen echt gegeven';
    await api('/api/office/papieren/antwoord', { id: r.id, waarde }, baas);
  }
  const na = await api('/api/office/golive', {}, baas);
  assert.ok(na.body.punten.some(p => /alle 18 vragen zijn beantwoord/.test(p.tekst)),
    'het papierwerk staat nu als afgevinkt in de keuring');
  assert.ok(!na.body.punten.some(p => p.blokkeert && /VERWERKINGSREGISTER\.md|DATALEK\.md|Papierwerk:/.test(p.tekst)),
    'en geen van de drie papieren punten blokkeert nog');
  assert.ok(na.body.blokkers < open.body.blokkers, 'er staan er minder in de weg dan zojuist');

  /* GEEN SLEUTELWAARDE. De keuring draait hier in een proces waarin de
     sessiesleutel wel degelijk bestaat; hij mag alleen nooit in het antwoord
     terechtkomen. Getoetst op de WAARDE en niet op de veldnaam, want een
     controle op namen mist precies het geval dat ertoe doet. */
  const tekst = JSON.stringify(na.body);
  for (const naam of ['RTG_SECRET_KEY', 'RTG_VAULT_KEY', 'RTG_ENC_KEY', 'STRIPE_SECRET_KEY', 'OFFICE_TOTP_SECRET']) {
    const w = process.env[naam];
    if (w && w.length > 8) assert.ok(!tekst.includes(w), naam + ' staat met zijn WAARDE in het antwoord');
  }
  assert.ok(!/-----BEGIN|[A-Fa-f0-9]{48}/.test(tekst), 'en er staat geen sleutelvormig blok in');

  // en de deur zit dicht voor wie geen eigenaar is
  assert.equal((await api('/api/office/golive', {}, gast)).status, 403,
    'boardroom-toegang is geen eigenaarschap');
  assert.equal((await api('/api/office/golive', {}, office)).status, 403,
    'en een gewone kantoorinlog komt er helemaal niet in');
});
