/* DE CONTACTPIN (server/kern/sociaal/pin.js) -- de eigen code waarmee twee
   mensen elkaar toevoegen zonder te zoeken.

   Twee lagen, allebei getoetst:
   1. de kern op een nepdatabase: vorm, uniekheid, normalisatie, en de drie
      dingen die met opzet NIET verschillen (bestaat niet / beschermd kind /
      geblokkeerd geven alle drie hetzelfde antwoord);
   2. de route op een ECHTE server: twee leden die elkaar op pin toevoegen, en
      een oude pin die na het vernieuwen niets meer aanwijst.

   Draai los: node --experimental-sqlite --test test/contactpin.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const maakSociaal = require('../server/kern/sociaal');
const { startServer, stop } = require('./helper');

/* ---------- 1. de kern, op een nepdatabase ---------- */
function maak(opties = {}) {
  const beschermd = new Set(opties.beschermd || []);
  const db = { data: { connections: [], blocks: [], reports: [], memberChats: {}, contactPins: {} } };
  const rtf = {
    profielInfoVanHandle(h) {
      if (!String(h).startsWith('rtf:')) return null;
      return { codenaam: 'Kind ' + h, kind: true, beschermd: beschermd.has(h) };
    },
    socialProfielen() { return []; }
  };
  const sociaal = maakSociaal({ db, save() {}, sseToCustomer() {}, rtf,
    crypto: require('node:crypto'), gidsHaal: h => ({ codename: 'Lid ' + h, tier: 'rtg' }),
    gidsHaalWacht: async h => ({ codename: 'Lid ' + h, tier: 'rtg' }),
    gidsZoekCodenaam: async () => [], media: {} });
  return { db, sociaal };
}

test('een pin heeft de afgesproken vorm, blijft gelijk en is per lid uniek', () => {
  const { sociaal } = maak();
  const a = sociaal.pinVan('A');
  assert.match(a, /^[0-9A-HJKMNP-TV-Z]{8}$/, 'acht tekens uit Crockford base32 (geen I, L, O of U)');
  assert.equal(sociaal.pinVan('A'), a, 'dezelfde vraag geeft dezelfde pin');
  const pins = new Set();
  for (let i = 0; i < 200; i++) pins.add(sociaal.pinVan('lid' + i));
  assert.equal(pins.size, 200, 'tweehonderd leden, tweehonderd verschillende pins');
  assert.equal(sociaal.pinKaart('A').toon, a.slice(0, 4) + '-' + a.slice(4), 'het scherm krijgt hem in twee groepjes');
});

test('invoer wordt gelezen zoals een mens hem voorleest', () => {
  const { sociaal } = maak();
  const pin = sociaal.pinVan('A');
  const uitgesproken = pin.slice(0, 4) + ' - ' + pin.slice(4).toLowerCase();
  assert.equal(sociaal.pinNormaliseer(uitgesproken), pin, 'streepjes, spaties en kleine letters mogen');
  // de Crockford-lezing: wie 'O' zegt bedoelt 0, wie 'I' of 'L' zegt bedoelt 1
  assert.equal(sociaal.pinNormaliseer('O1234567'), '01234567');
  assert.equal(sociaal.pinNormaliseer('I1234567'), '11234567');
  assert.equal(sociaal.pinNormaliseer('L1234567'), '11234567');
  assert.equal(sociaal.pinNormaliseer('U1234567'), 'V1234567');
  assert.equal(sociaal.pinNormaliseer('1234567'), null, 'zeven tekens is geen pin');
  assert.equal(sociaal.pinNormaliseer('123456789'), null, 'negen ook niet');
  assert.equal(sociaal.pinNormaliseer(''), null);
  assert.equal(sociaal.pinNormaliseer(null), null);
});

test('een nieuwe pin trekt de oude in en laat de vriendschappen staan', async () => {
  const { db, sociaal } = maak();
  const oud = sociaal.pinVan('A');
  await sociaal.pinVerbind('B', oud);
  assert.equal(db.data.connections.length, 1, 'B heeft een verzoek aan A gestuurd');
  const nieuw = sociaal.pinVernieuw('A').pin;
  assert.notEqual(nieuw, oud);
  assert.equal(sociaal.pinZoek('C', oud).status, 404, 'de oude pin wijst niemand meer aan');
  assert.equal(sociaal.pinZoek('C', nieuw).key, 'A');
  assert.equal(db.data.connections.length, 1, 'de bestaande band staat op de sleutel, niet op de pin');
});

test('je eigen pin opzoeken is geen zoekopdracht maar een vergissing', () => {
  const { sociaal } = maak();
  const r = sociaal.pinZoek('A', sociaal.pinVan('A'));
  assert.equal(r.status, 400);
  assert.match(r.error, /eigen pin/i);
});

/* DE KERN VAN DE PRIVACY: drie heel verschillende situaties horen aan de
   buitenkant NIET te onderscheiden zijn. Verschilt de melding, dan is precies
   dat verschil de manier om alsnog vast te stellen dat een kind bestaat. */
test('onbekend, beschermd en geblokkeerd geven alle drie hetzelfde antwoord', () => {
  const { db, sociaal } = maak({ beschermd: ['rtf:kind'] });
  const kindPin = sociaal.pinVan('rtf:kind');
  const bozePin = sociaal.pinVan('boos');
  db.data.blocks.push({ door: 'boos', doel: 'A' });
  const onbekend = sociaal.pinZoek('A', '00000000');
  const beschermd = sociaal.pinZoek('A', kindPin);
  const geblokkeerd = sociaal.pinZoek('A', bozePin);
  assert.deepEqual(beschermd, onbekend, 'een beschermd kind is via zijn pin onvindbaar, met dezelfde woorden');
  assert.deepEqual(geblokkeerd, onbekend, 'wie jou blokkeerde, is via zijn pin onvindbaar, met dezelfde woorden');
  assert.equal(onbekend.status, 404);
});

test('verbinden op pin laat elke controle bij socialVerbind', async () => {
  const { db, sociaal } = maak({ beschermd: ['rtf:kind'] });
  const kindPin = sociaal.pinVan('rtf:kind');
  assert.equal((await sociaal.pinVerbind('A', kindPin)).status, 404, 'een vreemde bereikt een kind ook via de pin niet');
  assert.equal(db.data.connections.length, 0);
  const r = await sociaal.pinVerbind('A', sociaal.pinVan('B'));
  assert.equal(r.st, 'aangevraagd');
  assert.equal(r.codename, 'Lid B', 'het scherm weet wie het geworden is');
  assert.equal(db.data.connections.length, 1);
});

test('raden loopt vast op de snelheidsrem', () => {
  const { sociaal } = maak();
  let laatste;
  for (let i = 0; i < 31; i++) laatste = sociaal.pinZoek('gokker', '0000000' + (i % 10));
  assert.equal(laatste.status, 429, 'na dertig pogingen in een uur gaat de deur dicht');
  // en de rem hangt aan de VRAGER, dus een ander lid heeft er geen last van
  assert.equal(sociaal.pinZoek('ander', '00000000').status, 404);
});

/* ---------- 2. de routes, op een echte server ---------- */
let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pin-'));

test.before(async () => { ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } })); });
test.after(() => { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

const json = r => r.json();
function api(pad, body, token) {
  return fetch(BASE + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) });
}
async function lid(naam) {
  const reg = await json(await api('/api/auth/register', { name: naam,
    email: naam.replace(/\s/g, '') + Date.now() + '@voorbeeld.test', phone: '0611122233',
    password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg' }));
  // een keer /state, zoals de app bij het openen doet: dat zet het lid in de gids
  const st = await json(await api('/api/state', {}, reg.token));
  return { token: reg.token, codenaam: st.state.user.codename };
}

test('twee leden voegen elkaar toe op pin, in twee stappen', async () => {
  const anna = await lid('Anna Pin');
  const boris = await lid('Boris Pin');
  const mijn = await json(await api('/api/member/pin', {}, anna.token));
  assert.match(mijn.pin, /^[0-9A-HJKMNP-TV-Z]{8}$/);
  assert.equal(mijn.toon, mijn.pin.slice(0, 4) + '-' + mijn.pin.slice(4));

  // stap 1: kijken wie het is -- dit verstuurt nog niets
  const kijk = await json(await api('/api/member/pin/zoek', { pin: mijn.toon }, boris.token));
  assert.equal(kijk.codename, anna.codenaam, 'de codenaam, nooit de echte naam');
  assert.ok(!JSON.stringify(kijk).includes('Anna Pin'), 'de echte naam blijft in de kluis');
  assert.equal(kijk.status, 'geen');
  const nietsGebeurd = await json(await api('/api/member/connections', {}, anna.token));
  assert.equal((nietsGebeurd.requests || []).length, 0, 'kijken is geen verzoek');

  // stap 2: en nu pas versturen
  const stuur = await json(await api('/api/member/pin/connect', { pin: mijn.toon }, boris.token));
  assert.equal(stuur.status, 'aangevraagd');
  const bij = await json(await api('/api/member/connections', {}, anna.token));
  assert.equal((bij.requests || []).length, 1);
  assert.equal(bij.requests[0].codename, boris.codenaam);

  // en accepteren maakt er een gewone vriendschap van
  await api('/api/member/connect/respond', { key: bij.requests[0].key, action: 'accept' }, anna.token);
  const na = await json(await api('/api/member/connections', {}, boris.token));
  assert.equal(na.connections.length, 1);
  assert.equal(na.connections[0].codename, anna.codenaam);
});

test('een vernieuwde pin maakt de oude waardeloos', async () => {
  const carla = await lid('Carla Pin');
  const dirk = await lid('Dirk Pin');
  const oud = (await json(await api('/api/member/pin', {}, carla.token))).pin;
  const nieuw = (await json(await api('/api/member/pin/nieuw', {}, carla.token))).pin;
  assert.notEqual(nieuw, oud);
  const met = await api('/api/member/pin/zoek', { pin: oud }, dirk.token);
  assert.equal(met.status, 404);
  const nu = await json(await api('/api/member/pin/zoek', { pin: nieuw }, dirk.token));
  assert.equal(nu.codename, carla.codenaam);
});

test('een onzinnige pin komt niet als 404 maar als "dat is geen pin" terug', async () => {
  const eva = await lid('Eva Pin');
  const r = await api('/api/member/pin/zoek', { pin: 'hallo' }, eva.token);
  assert.equal(r.status, 400);
  assert.match((await json(r)).error, /acht tekens/i);
});

/* ---------- 3. de ouderkant: een kind heeft geen eigen loket ----------
   Een beschermd profiel (15 of jonger) verbindt nooit zelf. De pin verandert
   daar niets aan -- hij is er voor de OUDER, die hem uitwisselt met de ouder
   van het vriendje, precies zoals hij nu de codenaam overtypt. */
function fond(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
}
function soc(pad, body) {
  return fetch(BASE + '/api/rtf/social' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
}
async function gezinMetKind(naam) {
  const g = await json(await fond('/gezin/maak', { gezinsnaam: naam, naam: 'Ouder ' + naam, pin: '1234' }));
  const kind = await json(await fond('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Kind', rol: 'gezinslid', groep: 'tiener' }));
  const kidToken = (await json(await fond('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;
  return { g, kidToken };
}

test('een beschermd kind krijgt geen eigen pinloket, zijn ouder wel', async () => {
  const fam = await gezinMetKind('Pinhuis');
  const dicht = await soc('/pin', { code: fam.g.code, token: fam.kidToken });
  assert.equal(dicht.status, 403, 'het kind zelf komt er niet bij');
  assert.match((await json(dicht)).error, /ouder of verzorger/i);
  const ouder = await json(await soc('/connections', { code: fam.g.code, token: fam.g.token }));
  assert.equal(ouder.beheerder, true);
  assert.equal(ouder.kinderen.length, 1);
  assert.match(ouder.kinderen[0].toon, /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/,
    'de ouder krijgt de pin van zijn kind, om af te geven aan de andere ouder');
});

test('een ouder voegt een vriend toe voor zijn kind op diens pin', async () => {
  const fam = await gezinMetKind('Pinhof');
  const frits = await lid('Frits Pin');
  const zijnPin = (await json(await api('/api/member/pin', {}, frits.token))).toon;
  const kind = (await json(await soc('/connections', { code: fam.g.code, token: fam.g.token }))).kinderen[0];

  const r = await soc('/oudervoeg', { code: fam.g.code, token: fam.g.token, kindHandle: kind.handle, pin: zijnPin });
  assert.equal(r.status, 200, 'de ouder mag dit, en de pin wijst de goede persoon aan');
  const bij = await json(await api('/api/member/connections', {}, frits.token));
  assert.equal(bij.requests.length, 1, 'aan de andere kant staat een gewoon verzoek');
  assert.equal(bij.requests[0].codename, kind.codenaam);

  // en een pin die niemand aanwijst, blijft ook hier een nette weigering
  const mis = await soc('/oudervoeg', { code: fam.g.code, token: fam.g.token, kindHandle: kind.handle, pin: '00000000' });
  assert.equal(mis.status, 404);
});
