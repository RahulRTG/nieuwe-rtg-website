/* Het verloop van een partij, voor de replay. De uitslagen zeggen WIE won;
   dit zegt HOE. Aparte tak en aparte termijn -- een uitslag is een feit dat
   een jaar meegaat, een verloop is een geheugen van een maand.

   Draai los: node --experimental-sqlite --test test/spelreplay.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakSpellen = require('../server/kern/spellen');
const maakRegister = require('../server/kern/spellen/register');
const maakZetten = require('../server/kern/spellen/zetten');
const maakAnoniem = require('../server/kern/vergeten/anoniem');
const { BELEID } = require('../server/bewaarbeleid');
const bewaar = require('../server/bewaartermijnen');

const spelCtx = { save() {}, crypto: require('crypto'), schud: (a) => a, beurtDoor() {}, codenaamVan: (x) => 'CN-' + x, nudge() {} };
const REG = maakRegister(spelCtx);

function opstelling(volw = () => true) {
  const db = { data: { spellen: { potjes: {}, wachtrij: {} } } };
  const kern = maakSpellen({ db, save() {}, crypto: require('crypto'), zijnVrienden: () => true,
    codenaamVan: (x) => 'CN-' + x, sseToCustomer() {}, isGeblokkeerd: () => false,
    socialZoek: async () => [], sociaalRate: () => true, volwassen: volw, sseClients: [], lidBoardUit: () => false });
  const potje = (id, soort, spelers) => {
    const p = { id, soort, modus: 'vrij', spelers, uitgenodigd: [], beurt: 0, teams: [0, 1],
      status: 'bezig', winnaar: null, at: new Date().toISOString() };
    REG.INITS[soort](p);
    db.data.spellen.potjes[id] = p;
    return p;
  };
  return { db, kern, potje };
}

test('het verloop wordt vastgelegd, met wie welke zet deed', () => {
  const o = opstelling();
  o.potje('p1', 'schaak', ['a', 'b']);
  o.kern.spelZet('a', 'p1', { van: 53, naar: 45 });
  o.kern.spelZet('b', 'p1', { van: 12, naar: 28 });
  const r = o.kern.spelReplay('a', 'p1');
  assert.equal(r.status, 200);
  assert.deepEqual(r.zetten, [
    { speler: 0, zet: { van: 53, naar: 45 } },
    { speler: 1, zet: { van: 12, naar: 28 } }
  ]);
  assert.deepEqual(r.spelers, ['CN-a', 'CN-b'], 'op codenaam');
});

test('een geweigerde zet komt niet in het verloop', () => {
  /* Een replay met afgekeurde zetten erin is geen verloop maar een logboek --
     en hij zou een partij tonen die nooit zo is gespeeld. */
  const o = opstelling();
  o.potje('p1', 'schaak', ['a', 'b']);
  o.kern.spelZet('a', 'p1', { van: 53, naar: 45 });
  o.kern.spelZet('a', 'p1', { van: 99, naar: 1 });      // onwettig
  o.kern.spelZet('b', 'p1', { van: 8, naar: 200 });     // ook onwettig
  assert.equal(o.kern.spelReplay('a', 'p1').zetten.length, 1, 'alleen de zet die is doorgelaten');
});

test('alleen wie meespeelde ziet het verloop', () => {
  /* Een kijker mocht live meekijken, maar het verloop bevat ook wat toen
     verborgen was -- dat is van de twee die speelden. */
  const o = opstelling();
  o.potje('p1', 'schaak', ['a', 'b']);
  o.kern.spelZet('a', 'p1', { van: 53, naar: 45 });
  assert.equal(o.kern.spelReplay('b', 'p1').status, 200, 'de tegenstander wel');
  assert.equal(o.kern.spelReplay('vriend', 'p1').status, 404, 'een kijker niet');
});

test('ook onder de 18+-grens bestaat een replay van je eigen partij', () => {
  /* Terugkijken is geen ranglijst en geen stand: er wordt niets opgeteld en
     niets vergeleken. Dezelfde redenering als bij een toernooi. */
  const o = opstelling((h) => !String(h).startsWith('kind'));
  o.potje('p1', 'schaak', ['kind1', 'kind2']);
  o.kern.spelZet('kind1', 'p1', { van: 53, naar: 45 });
  const r = o.kern.spelReplay('kind1', 'p1');
  assert.equal(r.status, 200);
  assert.equal(r.zetten.length, 1);
  // maar een STAND is er nog steeds niet
  assert.equal(o.kern.spelStand('kind1').progressie, false);
});

test('het platform schrijft, dus elk spel krijgt het vanzelf', () => {
  // niet zestien motoren die er elk aan moeten denken
  const o = opstelling();
  o.potje('d1', 'dam', ['a', 'b']);
  const mag = REG.ZICHT.dam.speler(o.db.data.spellen.potjes.d1, o.db.data.spellen.potjes.d1.staat, 'a').zetten;
  o.kern.spelZet('a', 'd1', { van: mag[0].van, naar: mag[0].naar });
  assert.equal(o.kern.spelReplay('a', 'd1').zetten.length, 1, 'ook dammen legt vanzelf vast');
});

test('een eindeloze partij vult de database niet, en dat staat erbij', () => {
  const z = maakZetten({ db: { data: {} }, save() {}, nu: () => new Date().toISOString(), codenaamVan: (x) => x });
  const p = { id: 'p1', soort: 'schaak', spelers: ['a', 'b'] };
  for (let i = 0; i < z._MAX_ZETTEN + 50; i++) z.noteerZet(p, 'a', { n: i });
  const r = z.spelReplay('a', 'p1');
  assert.equal(r.zetten.length, z._MAX_ZETTEN, 'afgekapt op de bovengrens');
  assert.equal(r.afgekapt, true, 'en de replay zegt dat hij niet compleet is');
  assert.equal(r.zetten[r.zetten.length - 1].zet.n, z._MAX_ZETTEN + 49,
    'de NIEUWSTE zetten blijven: het eind van een partij is interessanter dan het begin');
});

/* ---------- bewaren en vergeten ---------- */

test('het verloop heeft een eigen, kortere termijn dan de uitslagen', () => {
  const zet = BELEID.find(r => r.tak === 'spelZetten');
  const uit = BELEID.find(r => r.tak === 'spelUitslagen');
  assert.ok(zet, 'er hoort een bewaarregel te zijn');
  assert.equal(zet.vorm, 'lijst');
  assert.equal(zet.datum, 'at');
  assert.ok(zet.dagen < uit.dagen, 'korter dan een uitslag: ' + zet.dagen + ' vs ' + uit.dagen);

  const DAG = 86400000, geleden = (d) => new Date(Date.now() - d * DAG).toISOString();
  const db = { data: { spelZetten: [
    { potje: 'vers', at: geleden(5), spelers: ['a'], zetten: [] },
    { potje: 'oud', at: geleden(60), spelers: ['a'], zetten: [] }] } };
  bewaar.veeg(db, { echt: true });
  assert.deepEqual(db.data.spelZetten.map(r => r.potje), ['vers']);
});

test('een verwijderd lid laat geen verloop met zijn sleutel achter', () => {
  const o = opstelling();
  o.potje('p1', 'schaak', ['weg', 'blijf']);
  o.kern.spelZet('weg', 'p1', { van: 53, naar: 45 });
  maakAnoniem({ db: o.db, accounts: {}, spelVergeet: o.kern.spelVergeet }).anonimiseer('weg', 'CN-weg', null);
  const tekst = JSON.stringify(o.db.data.spelZetten || []);
  assert.equal(tekst.includes('"weg"'), false, 'zijn sleutel staat nergens meer: ' + tekst);
  assert.equal(o.kern.spelReplay('blijf', 'p1').status, 200, 'de ander houdt zijn replay');
});

test('blijft er niemand over, dan verdwijnt het verloop helemaal', () => {
  // er is dan niemand meer die hem MAG zien, dus heeft hij geen doel
  const z = maakZetten({ db: { data: { spelZetten: [{ potje: 'p1', spelers: ['weg'], zetten: [], at: '' }] } },
    save() {}, nu: () => '', codenaamVan: (x) => x });
  z.zettenVergeet('weg');
  assert.equal(z.spelReplay('weg', 'p1').status, 404);
});
