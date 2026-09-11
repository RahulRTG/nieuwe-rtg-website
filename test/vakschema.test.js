/* EEN SCHEMA VAN EEN BEVOEGDE VAKMAN -- RUGDEKKING.md par. 4.4, besluit 4.

   WAT HIER OP HET SPEL STAAT. `kern/zorgniveau.js` verbiedt RTG om inhoud te
   geven op het niveau `professioneel`, en dat is juist. Het gevolg was dat
   NIEMAND inhoud kon geven: `vanWie` op een trainingsschema is vrije tekst die
   het lid zelf intypt, dus "mijn fysio" was een bewering. De uitweg die par. 4.4
   aanwijst is niet een uitzondering op die grens maar de professional IN het
   systeem -- en deze suite legt vast dat het ook werkelijk zo gebouwd is.

   ZES DINGEN, EN VIER ERVAN ZIJN GRENZEN.

   1. ZONDER STUK GEBEURT ER NIETS. De poort is de handeling `schemaGeven` uit
      kern/persoonseis-lijst.js, en die weegt het GENRE van de zaak en het
      VAKBEWIJS van de mens achter de sessie.
   2. DE VAKMAN STELT VOOR, HET LID BEVESTIGT. Een voorstel komt niet in het
      schema terecht tot het lid drukt (LIFE.md).
   3. EEN VOORSTEL VERKLAPT NIET OF EEN CODENAAM BESTAAT. Zonder deze regel is
      deze route een zoekmachine naar leden.
   4. DE VAKMAN LEEST NIETS TERUG -- ook niet of het is aangenomen.
   5. EEN WEIGERING BLIJFT BIJ HET LID, met reden en al.
   6. EN DE BETALER LEEST DE GEZONDHEID NOOIT (grens 8): er loopt geen draad van
      kern/rugdekking hierheen.

   Draai los: node --test test/vakschema.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { zonderCommentaar } = require('../scripts/lib/bron');

const persoonseisMod = require('../server/kern/persoonseis');
const vakbewijsMod = require('../server/kern/vakbewijs');
const maakVakschema = require('../server/kern/vakschema');

const ZAKEN = {
  FYSIO: { code: 'FYSIO', type: 'fysiotherapie', name: 'Praktijk Noord' },
  SPORTARTS: { code: 'SPORTARTS', type: 'sportarts', name: 'Sportgeneeskunde Zuid' },
  RESTO: { code: 'RESTO', type: 'restaurant', name: 'Het Hoekje' }
};

function huis(opties) {
  const o = opties || {};
  const db = { data: {} };
  const schoon = (v, n) => String(v == null ? '' : v).trim().slice(0, n || 200);
  const store = vakbewijsMod({ db, save() {}, schoon, tijdVandaag: () => '2026-09-11' });
  const identiteiten = {};
  const eis = persoonseisMod({ vakbewijsHeeft: store.vakbewijsHeeft, sleutelLid: store.sleutelLid,
    identiteitVan: (p) => identiteiten[p.lid] || { geverifieerd: false, stand: 'none' } });

  const schemas = {};
  const trainingZet = (key, body) => {
    if (!schemas[key]) schemas[key] = [];
    const r = Object.assign({ id: 't' + schemas[key].length }, body);
    schemas[key].push(r);
    return r;
  };
  const { vakschema } = maakVakschema({ db, save() {}, crypto, schoon,
    findSupplier: (c) => ZAKEN[String(c || '').toUpperCase()] || null,
    persoonseis: eis,
    keyVanCodenaam: async (naam) => (String(naam) === 'Zilveren Reiger' ? { key: 'k-lid' } : null),
    trainingZet: o.zonderTraining ? null : trainingZet });

  const bevoegd = (lid) => {
    identiteiten[lid] = { geverifieerd: true, stand: 'verified' };
    store.vakbewijsZet(store.sleutelLid(lid), { wat: 'big', nummer: '12345', tot: '2030-01-01' });
    store.vakbewijsTeken(store.sleutelLid(lid), 'big', 'M. de Vries (RTG)');
  };
  return { db, vakschema, bevoegd, identiteiten, schemas, store };
}

const LIJF = { mens: 'Zilveren Reiger', naam: 'Opbouw na knieblessure',
  wat: 'zes weken rustig opbouwen, elke week iets meer', dagen: '1,3,5', duurMin: 40 };
const ACTOR = { lid: 11, name: 'J. Bakker' };

test('1. zonder vakbewijs gebeurt er niets, en de weigering noemt het stuk', async () => {
  const { vakschema, identiteiten, db } = huis();
  identiteiten[11] = { geverifieerd: true, stand: 'verified' };   // werkt er, geen BIG
  const r = await vakschema.voorstel('FYSIO', LIJF, ACTOR);
  assert.equal(r.status, 403);
  assert.ok(r.persoonseis, 'de weigering zegt WELK stuk ontbreekt');
  assert.match(r.error, /BIG/i);
  assert.equal(db.data.vakschema, undefined, 'een geweigerde poging laat geen rij achter');
});

test('2. een zaak zonder het juiste genre kan dit niet, ook mét BIG', async () => {
  const { vakschema, bevoegd } = huis();
  bevoegd(11);
  const r = await vakschema.voorstel('RESTO', LIJF, ACTOR);
  assert.equal(r.status, 403, 'een restaurant met een BIG-houder in dienst geeft geen herstelschema');
});

test('3. de vakman stelt voor; het komt NIET in het schema van het lid', async () => {
  const { vakschema, bevoegd, schemas } = huis();
  bevoegd(11);
  const r = await vakschema.voorstel('FYSIO', LIJF, ACTOR);
  assert.equal(r.status, 200);
  assert.equal(r.klaargezet, true);
  assert.deepEqual(schemas['k-lid'], undefined,
    'een voorstel dat meteen in het schema staat, is een derde die in andermans dossier schrijft');

  const mijn = vakschema.mijn('k-lid');
  assert.equal(mijn.voorstellen.length, 1);
  assert.equal(mijn.voorstellen[0].naam, LIJF.naam);
  assert.equal(mijn.voorstellen[0].van, 'Praktijk Noord');
});

test('4. het lid aanvaardt, en dan pas staat het in zijn eigen schema', async () => {
  const { vakschema, bevoegd, schemas } = huis();
  bevoegd(11);
  await vakschema.voorstel('FYSIO', LIJF, ACTOR);
  const vid = vakschema.mijn('k-lid').voorstellen[0].id;

  const r = vakschema.aanvaard('k-lid', vid);
  assert.equal(r.status, 200);
  assert.equal(schemas['k-lid'].length, 1, 'het landt in het EIGEN schema, langs de gewone weg');
  assert.equal(schemas['k-lid'][0].naam, LIJF.naam);
  /* `vanWie` is hier voor het eerst geen vrije tekst maar een vastgestelde mens
     bij een zaak met een gekeurd genre. */
  assert.match(schemas['k-lid'][0].vanWie, /J\. Bakker/);
  assert.match(schemas['k-lid'][0].vanWie, /Praktijk Noord/);

  assert.equal(vakschema.mijn('k-lid').voorstellen.length, 0, 'een aanvaard voorstel staat niet meer open');
  assert.equal(vakschema.aanvaard('k-lid', vid).status, 404, 'en het kan geen tweede keer');
});

test('5. weigeren doet niets, en de reden blijft bij het lid', async () => {
  const { vakschema, bevoegd, schemas, db } = huis();
  bevoegd(11);
  await vakschema.voorstel('FYSIO', LIJF, ACTOR);
  const vid = vakschema.mijn('k-lid').voorstellen[0].id;

  assert.equal(vakschema.weiger('k-lid', vid, 'ik train al bij iemand anders').status, 200);
  assert.equal(schemas['k-lid'], undefined);
  assert.equal(vakschema.mijn('k-lid').voorstellen.length, 0);

  /* De reden staat in de opslag van het LID en komt nergens in het antwoord aan
     de zaak terug -- zie toets 6. */
  const rij = db.data.vakschema['k-lid'].find(v => v.id === vid);
  assert.equal(rij.stand, 'geweigerd');
  assert.equal(rij.reden, 'ik train al bij iemand anders');
});

test('6. de vakman ziet zijn eigen post en nooit wat het lid ermee deed', async () => {
  const { vakschema, bevoegd } = huis();
  bevoegd(11);
  await vakschema.voorstel('FYSIO', LIJF, ACTOR);
  const vid = vakschema.mijn('k-lid').voorstellen[0].id;
  vakschema.weiger('k-lid', vid, 'liever niet');

  const lijst = vakschema.mijnVoorstellen('FYSIO', ACTOR);
  assert.equal(lijst.status, 200);
  assert.equal(lijst.voorstellen.length, 1, 'hij ziet dat hij het stuurde');
  const vlak = JSON.stringify(lijst);
  for (const woord of ['geweigerd', 'aanvaard', 'liever niet', 'k-lid', 'Zilveren Reiger']) {
    assert.equal(vlak.includes(woord), false,
      'de zaak leest "' + woord + '" terug; dat is het dossier van het lid en niet het hare');
  }
});

test('7. een onbekende codenaam geeft exact hetzelfde antwoord als een bekende', async () => {
  const { vakschema, bevoegd } = huis();
  bevoegd(11);
  const bekend = await vakschema.voorstel('FYSIO', LIJF, ACTOR);
  const onbekend = await vakschema.voorstel('FYSIO', Object.assign({}, LIJF, { mens: 'Bestaat Niet' }), ACTOR);
  assert.deepEqual(onbekend, bekend,
    'een verschil hier maakt van deze route een zoekmachine naar leden van RTG');
});

test('8. een leeg schema wordt geweigerd, en dat mag WEL verschillen', async () => {
  const { vakschema, bevoegd } = huis();
  bevoegd(11);
  const r = await vakschema.voorstel('FYSIO', { mens: 'Zilveren Reiger', naam: '', wat: '' }, ACTOR);
  assert.equal(r.status, 400,
    'dit gaat over wat de AFZENDER instuurde en zegt niets over het lid; hier hoort wel een fout');
});

test('12. een dubbelklik zet geen tweede kaart in andermans inbox -- en verklapt niets', async () => {
  /* De ronde vond hier 0 -> 2. Dat is niet alleen rommel: het is andermans
     scherm dat je volzet. De oplossing mag hier geen 409 zijn -- "deze stond er
     al" bestaat alleen als de codenaam bestaat, en dat is precies wat toets 7
     geheim houdt. De tweede oproep doet dus niets en zegt hetzelfde. */
  const { vakschema, bevoegd, db } = huis();
  bevoegd(11);
  const a = await vakschema.voorstel('FYSIO', LIJF, ACTOR);
  const b = await vakschema.voorstel('FYSIO', LIJF, ACTOR);
  assert.deepEqual(b, a, 'een tweede identieke oproep mag niet te onderscheiden zijn van de eerste');
  assert.equal(db.data.vakschema['k-lid'].length, 1, 'en er hoort geen tweede kaart te staan');

  /* Wijk ergens van af en het is een ander voorstel, dat gewoon doorgaat. */
  await vakschema.voorstel('FYSIO', Object.assign({}, LIJF, { naam: 'Opbouw enkel' }), ACTOR);
  assert.equal(db.data.vakschema['k-lid'].length, 2);

  /* En na beslissen mag dezelfde tekst opnieuw: een herhaling na een half jaar
     is geen dubbelklik. */
  const vid = vakschema.mijn('k-lid').voorstellen[0].id;
  vakschema.weiger('k-lid', vid, 'nu even niet');
  await vakschema.voorstel('FYSIO', LIJF, ACTOR);
  assert.equal(db.data.vakschema['k-lid'].filter(v => v.stand === 'open' && v.naam === LIJF.naam).length, 1);
});

/* ---------- de grenzen die geen gedrag zijn ---------- */

test('9. grens 8: de betaler leest de gezondheid nooit', () => {
  /* RUGDEKKING.md grens 8. Dat RTG achter een sporter staat, geeft RTG geen blik
     op zijn knie -- dus er hoort geen draad te lopen van de rugdekkingslaag naar
     deze. Lexicaal gemeten en dus een ONDERgrens, precies zoals bij
     scripts/lib/cijferopmens.js: dit vangt een require en geen omweg. */
  const map = path.join(__dirname, '..', 'server', 'kern', 'rugdekking');
  const gevonden = [];
  for (const naam of fs.readdirSync(map).filter(n => n.endsWith('.js'))) {
    const code = zonderCommentaar(fs.readFileSync(path.join(map, naam), 'utf8'));
    if (/vakschema|trainingsschema|zorgprofiel|metingen/.test(code)) gevonden.push(naam);
  }
  assert.deepEqual(gevonden, [],
    'kern/rugdekking raakt een gezondheidslaag aan; de betaler leest de gezondheid nooit');

  /* En andersom: deze laag kent de rugdekking niet, zodat een schema niet stil
     een voorwaarde van een programma kan worden. */
  const eigen = zonderCommentaar(fs.readFileSync(
    path.join(__dirname, '..', 'server', 'kern', 'vakschema.js'), 'utf8'));
  assert.equal(/rugdekking/.test(eigen), false);
});

test('10. zorgniveau blijft ongemoeid: RTG geeft zelf nog steeds geen inhoud', () => {
  /* De hele opzet van par. 4.4 is dat de GRENS blijft staan en dat er een mens
     bij komt die hem niet nodig heeft. Zou deze laag `zorgniveau` aanroepen om
     er iets omheen te praten, dan was het alsnog een uitzondering. */
  const eigen = zonderCommentaar(fs.readFileSync(
    path.join(__dirname, '..', 'server', 'kern', 'vakschema.js'), 'utf8'));
  assert.equal(/zorgniveau/.test(eigen), false,
    'deze laag omzeilt de zorggrens niet; zij zet er een bevoegde mens naast');

  const niveau = require('../server/kern/zorgniveau');
  const uit = niveau.zorgniveau ? niveau.zorgniveau('mag ik mijn dosering ophogen') : null;
  if (uit) assert.notEqual(uit.niveau, 'lifestyle', 'de grens zelf doet nog gewoon zijn werk');
});

test('11. zonder trainingslaag wordt er niets beloofd', async () => {
  /* Een aanvaarding die niets wegschrijft en toch 200 geeft, is de ergste vorm:
     het lid denkt dat zijn schema er staat. */
  const { vakschema, bevoegd } = huis({ zonderTraining: true });
  bevoegd(11);
  await vakschema.voorstel('FYSIO', LIJF, ACTOR);
  const vid = vakschema.mijn('k-lid').voorstellen[0].id;
  const r = vakschema.aanvaard('k-lid', vid);
  assert.equal(r.status, 503);
  assert.equal(vakschema.mijn('k-lid').voorstellen.length, 1, 'en het voorstel blijft dus openstaan');
});
