/* ============================================================================
   DE BUURTRUIL -- de vijf grendels uit kern/rtfos/ruil.js, elk apart.

   Waarom deze toets bestaat: dit is de ENIGE rtfos-deur die op een gewone
   ledensessie opengaat. Alle andere ingangen van dit domein staan achter de
   kantoordeur of op een uitgegeven code, en die twee zijn allebei zwaarder. Een
   fout in de zichtbaarheid hier raakt dus meteen elk lid met een account.

   De vijf, in dezelfde volgorde als in de kop van de module:

   1. Een aanbod hangt aan een codenaam, en de BELANGSTELLENDEN zijn alleen voor
      de eigenaar. Een ander lid dat ze kan zien, leest wie er in zijn buurt naar
      spullen zoekt -- dat is een lijst die niemand hoort te hebben.
   2. Interesse is een signaal dat de eigenaar ophaalt: het telt een keer per
      lid, nooit op je eigen aanbod.
   3. Melden verbergt pas bij twee VERSCHILLENDE melders, en zegt eerlijk dat er
      bij de eerste nog niets gebeurde.
   4. Alleen in een stad die echt open is.
   5. De tellers dedupliceren op codenaam, en er is een rem op hoeveel er open
      staan.

   En de deur zelf: zonder inlog komt er niets uit.

   Draai los: node --test test/rtfos-ruil.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfruil-'));
const OFFICE_CODE = 'RTFRUIL-KEURING';

let srv, BASE, LAND, STAD, DICHT, A, B, C;

const post = (pad, body, tok) => fetch(BASE + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const ruil = (pad, body, tok) => post('/api/rtfos/ruil/' + pad, body, tok);

async function lid(naam, mail) {
  const r = await post('/api/auth/register', { name: naam, email: mail, password: 'geheim123',
    geboortedatum: '1990-05-05', pasApp: 'rtg' });
  assert.ok(r.body.token, 'aanmelden mislukt voor ' + naam + ': ' + JSON.stringify(r.body).slice(0, 120));
  return r.body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  BASE = srv.base;
  LAND = await kantoorAlsPersoon(BASE);
  assert.ok(LAND, 'geen kantoorsessie');

  STAD = (await post('/api/rtfos/stad/maak', { naam: 'Beverwijk' }, LAND)).body.stad.id;
  await post('/api/rtfos/stad/status', { id: STAD, status: 'actief' }, LAND);
  // een tweede stad die met opzet NIET geactiveerd wordt
  DICHT = (await post('/api/rtfos/stad/maak', { naam: 'Heemskerk' }, LAND)).body.stad.id;

  A = await lid('Ayla Buur', 'a@ruil.test');
  B = await lid('Bram Buur', 'b@ruil.test');
  C = await lid('Cem Buur', 'c@ruil.test');
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ------------------------------------------------------------------------- */
test('zonder inlog komt er niets uit de buurtruil', async () => {
  const r = await ruil('lijst', { stad: STAD });
  assert.equal(r.status, 401, 'de buurtruil ging open zonder sessie');
});

test('een aanbod hangt aan een codenaam, en alleen de eigenaar ziet wie belangstelling heeft', async () => {
  const gemaakt = await ruil('plaats', { stad: STAD, soort: 'geef', titel: 'Kinderfiets 16 inch',
    wat: 'Rood, remmen nagekeken', staat: 'gebruikt' }, A);
  assert.equal(gemaakt.status, 200, JSON.stringify(gemaakt.body).slice(0, 140));
  const id = gemaakt.body.ruil.id;

  // de echte naam komt hier nooit langs
  assert.ok(gemaakt.body.ruil.van, 'een aanbod zonder afzender');
  assert.ok(!/Ayla/i.test(JSON.stringify(gemaakt.body)), 'de echte naam van het lid stond in het antwoord');

  await ruil('interesse', { id }, B);

  const bijEigenaar = await ruil('lijst', { stad: STAD }, A);
  const mijne = bijEigenaar.body.ruil.find(x => x.id === id);
  assert.equal(mijne.ikBenEigenaar, true);
  assert.deepEqual(mijne.belangstellenden.length, 1, 'de eigenaar zag zijn belangstellende niet');

  const bijEenAnder = await ruil('lijst', { stad: STAD }, C);
  const die = bijEenAnder.body.ruil.find(x => x.id === id);
  assert.equal(die.ikBenEigenaar, false);
  assert.equal(die.belangstellenden, undefined, 'een ander lid zag WIE er belangstelling had');
  assert.equal(die.interesse, 1, 'het aantal mag wel: dat zegt niets over wie');
});

test('interesse telt een keer per lid, en nooit op je eigen aanbod', async () => {
  const id = (await ruil('plaats', { stad: STAD, soort: 'zoek', titel: 'Bureaustoel' }, A)).body.ruil.id;

  assert.equal((await ruil('interesse', { id }, B)).status, 200);
  const tweede = await ruil('interesse', { id }, B);
  assert.equal(tweede.status, 409, 'hetzelfde lid kon twee keer belangstelling tonen');

  const eigen = await ruil('interesse', { id }, A);
  assert.equal(eigen.status, 400, 'de eigenaar kon op zijn eigen aanbod reageren');

  const na = (await ruil('lijst', { stad: STAD }, A)).body.ruil.find(x => x.id === id);
  assert.equal(na.interesse, 1, 'de teller liep op van een dubbele klik');
});

test('melden verbergt pas bij twee verschillende melders, en liegt daar niet over', async () => {
  const id = (await ruil('plaats', { stad: STAD, soort: 'geef', titel: 'Twijfelachtig aanbod' }, A)).body.ruil.id;

  const een = await ruil('meld', { id, reden: 'klopt niet' }, B);
  assert.equal(een.body.verborgen, false);
  assert.match(een.body.bericht, /nog niets verborgen/i,
    'de eerste melder kreeg te horen dat er iets gebeurde terwijl er niets gebeurde');

  const weer = await ruil('meld', { id, reden: 'nogmaals' }, B);
  assert.equal(weer.status, 409, 'dezelfde melder telde twee keer -- dan haalt een mens er in zijn eentje iets weg');

  const twee = await ruil('meld', { id, reden: 'ook mee eens' }, C);
  assert.equal(twee.body.verborgen, true, 'twee verschillende melders verborgen het aanbod niet');

  const lijst = (await ruil('lijst', { stad: STAD }, C)).body.ruil;
  assert.ok(!lijst.some(x => x.id === id), 'een verborgen aanbod stond nog in de lijst');

  // verbergen is geen verwijderen: de stichting moet kunnen zien waarover het ging
  const bij = (await ruil('mijn', {}, A)).body.ruil.find(x => x.id === id);
  assert.equal(bij.status, 'verborgen', 'de rij was weg in plaats van verborgen');
});

test('sluiten kan alleen de eigenaar, en het haalt het aanbod uit de lijst', async () => {
  const id = (await ruil('plaats', { stad: STAD, soort: 'geef', titel: 'Plantenbakken' }, A)).body.ruil.id;

  const vreemde = await ruil('sluit', { id }, B);
  assert.equal(vreemde.status, 403, 'een ander lid kon andermans aanbod sluiten');

  assert.equal((await ruil('sluit', { id, status: 'weg' }, A)).status, 200);
  const lijst = (await ruil('lijst', { stad: STAD }, B)).body.ruil;
  assert.ok(!lijst.some(x => x.id === id), 'een gesloten aanbod stond nog in de lijst');
});

test('een stad die niet open is, draagt geen buurtruil', async () => {
  const geplaatst = await ruil('plaats', { stad: DICHT, soort: 'geef', titel: 'Wasmachine' }, A);
  assert.equal(geplaatst.status, 409, 'er kon geruild worden in een stad die nog niet open is');

  const gelezen = await ruil('lijst', { stad: DICHT }, A);
  assert.equal(gelezen.status, 409);
  assert.match(gelezen.body.error, /nog niet open/i);
});

/* DEZE EEN OP DE MODULE EN NIET DOOR DE DEUR, en dat is de bevinding zelf: door
   HTTP slaat de REM (twintig schrijfacties per minuut) eerder dicht dan de
   grens van twintig OPEN aanbiedingen. Dat is goed -- de goedkoopste grendel
   hoort eerst te komen -- maar het maakt de grens erachter onbereikbaar voor
   een toets, en een grens die je niet hebt zien dichtslaan is geen grens. */
test('een lid houdt er hooguit twintig tegelijk open (op de module, want de rem komt eerder)', () => {
  const db = { data: {} };
  const ctx = require('../server/kern/rtfos/basis')({ db, save() {}, crypto: require('crypto'),
    boardroomWie: () => null, magBoardroom: () => false });
  const ruilModule = require('../server/kern/rtfos/ruil')(ctx);
  // S() legt de collecties aan; ervoor bestaat db.data.rtfos nog niet
  const opslag = ctx.S();
  opslag.steden.push({ id: 'S1', naam: 'Testdorp', status: 'actief', vlaggen: [], limieten: {} });

  for (let i = 0; i < 20; i++) {
    const r = ruilModule.plaats('Codenaam Een', { stad: 'S1', soort: 'geef', titel: 'Doos ' + i });
    assert.ok(r.ok, 'plaatsen zakte al bij ' + i + ': ' + JSON.stringify(r));
  }
  const eenTeveel = ruilModule.plaats('Codenaam Een', { stad: 'S1', soort: 'geef', titel: 'Doos 21' });
  assert.equal(eenTeveel.status, 429, 'een lid kon er onbeperkt open houden');

  // en de grens telt OPEN aanbiedingen, niet alles ooit: sluiten maakt plek
  const eerste = opslag.ruil[0];
  ruilModule.sluit('Codenaam Een', { id: eerste.id, status: 'weg' });
  assert.ok(ruilModule.plaats('Codenaam Een', { stad: 'S1', soort: 'geef', titel: 'Nieuwe doos' }).ok,
    'na het sluiten van een aanbod kwam er geen plek vrij');
});

test('er is nergens een bedrag: dit is geen marktplaats', async () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'rtfos', 'ruil.js'), 'utf8');
  for (const woord of ['prijs', 'centen', 'bedrag', 'euro', 'betaal']) {
    assert.ok(!new RegExp('\\b' + woord, 'i').test(bron.replace(/\/\*[\s\S]*?\*\//g, '')),
      'de buurtruil kreeg een "' + woord + '" -- dan gelden er btw-, retour- en consumentenregels die deze module niet draagt');
  }
});
