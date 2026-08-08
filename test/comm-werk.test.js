/* De verhuizing van de sollicitatiechat naar de communicatiekern
   (server/kern/comm/werk.js).

   DE VIERDE EN LAATSTE GROTE VOORRAAD. Een sollicitatiechat loopt tussen een
   WERKGEVER en een SOLLICITANT, en die sollicitant is niet altijd een lid: hij
   kan ook een profiel binnen een RTF-gezin zijn (een jongere die via zijn
   gezin solliciteert, ingelogd op gezinscode en token). Daarom kon deze pas
   verhuizen nadat kern/comm/wie.js een vierde soort deelnemer kreeg.

   De vier vaste gevaren van een verhuizing (zie comm-dm.test.js) worden hier
   opnieuw gemeten. Wat EIGEN is aan deze voorraad:

   1. TWEE SOORTEN SOLLICITANT IN EEN MODEL. Een lid draagt zijn kale sleutel,
      een gezinsprofiel 'gezin:FAM7:3'. Lopen die door elkaar, dan leest de
      verkeerde persoon een sollicitatie -- en een sollicitatie is precies het
      soort gesprek waarvan je niet wilt dat je huisgenoot het ziet.

   2. DE KANT IS 'werkgever' OF 'sollicitant', NIET EEN NAAM. De oude vorm
      hield `van` bij als een van die twee woorden; het scherm kleurt de
      bubbels erop. Klapt dat om, dan lijkt de sollicitant zichzelf te hebben
      afgewezen.

   3. DE ANONIEME SOLLICITATIE HEEFT GEEN CHAT. Wie zonder account solliciteert
      heeft geen enkele sleutel, en dus geen gesprek. Dat moet zo blijven: een
      gesprek maken voor iemand die je niet kunt bereiken levert een draad op
      die niemand ooit leest, in een lijst waar de werkgever wel op reageert.

   Draait zonder server, op een nagemaakte database. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakComm } = require('../server/kern/comm');
const { maakCommWerk } = require('../server/kern/comm/werk');
const wie = require('../server/kern/comm/wie');

const ZAKEN = { KIKUNOI: 'Sal de Mar' };
const LEDEN = { 'user-1': 'Amberen Vos' };

function opzet(oud) {
  const db = { data: { applyChats: oud || {} } };
  const comm = maakComm({ db, save: () => {}, crypto,
    naamVan: wie.maakNaam({ codenaamVan: (k) => LEDEN[k] || null, zaakNaam: (c) => ZAKEN[c] || null }) });
  const werk = maakCommWerk({ db, save: () => {}, comm });
  return { db, comm, werk };
}

const LID = { kind: 'rtg', key: 'user-1', naam: 'Amberen Vos' };
const KIND = { kind: 'rtf', gezinCode: 'FAM7', profielId: 3, naam: 'Sam' };

const OUD = () => ({
  'app-1': {
    id: 'app-1', supplierCode: 'KIKUNOI', func: 'Bediening', bedrijf: 'Sal de Mar',
    applicant: LID,
    berichten: [
      { van: 'werkgever', wie: 'Marta', tekst: 'kun je zaterdag proefdraaien?', at: '2025-05-01T09:00:00.000Z', lang: 'nl' },
      { van: 'sollicitant', wie: 'Amberen Vos', tekst: 'ja, graag', at: '2025-05-01T09:20:00.000Z' }
    ],
    at: '2025-05-01T08:00:00.000Z'
  }
});

test('de oude geschiedenis verhuist mee, met haar eigen tijdstempels en kanten', () => {
  const { werk } = opzet(OUD());
  const uit = werk.berichten('app-1');
  assert.equal(uit.length, 2, 'niet alle oude berichten zijn meegekomen');
  assert.deepEqual(uit.map((m) => m.tekst), ['kun je zaterdag proefdraaien?', 'ja, graag']);
  assert.deepEqual(uit.map((m) => m.at.slice(0, 10)), ['2025-05-01', '2025-05-01'],
    'de tijdstempels zijn op de dag van de verhuizing gezet');
  /* De kant, en dit is wat het scherm gebruikt om de bubbels te kleuren. */
  assert.deepEqual(uit.map((m) => m.van), ['werkgever', 'sollicitant'],
    'de kanten van het gesprek zijn omgeklapt of samengevallen');
  assert.deepEqual(uit.map((m) => m.wie), ['Marta', 'Amberen Vos'],
    'de naam van wie het schreef is onderweg kwijtgeraakt');
});

test('de import gebeurt precies een keer', () => {
  const { werk } = opzet(OUD());
  werk.berichten('app-1');
  werk.gesprek('app-1');
  werk.stuur('app-1', 'werkgever', 'Marta', 'top, tot zaterdag');
  assert.equal(werk.berichten('app-1').length, 3,
    'de geschiedenis staat er dubbel in: ' + werk.berichten('app-1').map((m) => m.tekst).join(' | '));
});

test('een lid en een gezinsprofiel zijn allebei sollicitant, en niet dezelfde', () => {
  const { comm, werk } = opzet({
    'app-1': { id: 'app-1', supplierCode: 'KIKUNOI', func: 'Bediening', applicant: LID, berichten: [] },
    'app-2': { id: 'app-2', supplierCode: 'KIKUNOI', func: 'Afwas', applicant: KIND, berichten: [] }
  });
  werk.stuur('app-1', 'sollicitant', 'Amberen Vos', 'van het lid');
  werk.stuur('app-2', 'sollicitant', 'Sam', 'van het gezinslid');

  const g1 = comm.gesprekVan(werk.gesprek('app-1').id);
  const g2 = comm.gesprekVan(werk.gesprek('app-2').id);
  assert.deepEqual([...g1.deelnemers].sort(), ['user-1', 'zaak:KIKUNOI']);
  assert.deepEqual([...g2.deelnemers].sort(), ['gezin:FAM7:3', 'zaak:KIKUNOI']);

  /* De poort van de kern doet de rest: het lid komt niet in de sollicitatie
     van het gezinslid en andersom. Een sollicitatie is precies het gesprek
     waarvan je niet wilt dat een ander hem opent. */
  assert.throws(() => comm.gesprek('user-1', g2.id), /niet van jou/i);
  assert.throws(() => comm.gesprek('gezin:FAM7:3', g1.id), /niet van jou/i);
  assert.equal(comm.magErin(g2, wie.gezin('FAM7', 4)), false,
    'een ander profiel uit hetzelfde gezin komt erin');
});

test('de werkgever ziet zijn eigen sollicitaties en niet die van een andere zaak', () => {
  const { comm, werk } = opzet({
    'app-1': { id: 'app-1', supplierCode: 'KIKUNOI', func: 'Bediening', applicant: LID, berichten: [] },
    'app-9': { id: 'app-9', supplierCode: 'ESVEDRA', func: 'Bar', applicant: LID, berichten: [] }
  });
  werk.stuur('app-1', 'sollicitant', 'Amberen Vos', 'bij Sal de Mar');
  werk.stuur('app-9', 'sollicitant', 'Amberen Vos', 'bij Es Vedra');

  const g = comm.gesprekVan(werk.gesprek('app-9').id);
  assert.equal(comm.magErin(g, wie.zaak('KIKUNOI')), false,
    'de ene werkgever zit in de sollicitatie bij de andere');
  assert.throws(() => comm.gesprek(wie.zaak('KIKUNOI'), g.id), /niet van jou/i);
});

test('een anonieme sollicitatie krijgt geen gesprek', () => {
  const { werk } = opzet({
    'app-3': { id: 'app-3', supplierCode: 'KIKUNOI', func: 'Bediening', applicant: null, berichten: [] }
  });
  /* Zonder sleutel is er niemand om mee te praten. Een gesprek maken voor
     iemand die je niet kunt bereiken levert een draad op die niemand leest --
     in een lijst waar de werkgever wel op antwoordt. */
  assert.equal(werk.gesprek('app-3'), null);
  assert.deepEqual(werk.berichten('app-3'), []);
  assert.equal(werk.stuur('app-3', 'werkgever', 'Marta', 'hallo?'), null);
});

test('een leeg bericht doet niets, en een onbekende sollicitatie ook niet', () => {
  const { werk } = opzet(OUD());
  assert.equal(werk.stuur('app-1', 'werkgever', 'Marta', '   '), null);
  assert.equal(werk.gesprek('bestaat-niet'), null);
  assert.deepEqual(werk.berichten('bestaat-niet'), []);
});

test('de oude voorraad blijft staan: er wordt niet in gewist', () => {
  const { db, werk } = opzet(OUD());
  werk.berichten('app-1');
  werk.stuur('app-1', 'werkgever', 'Marta', 'nieuw bericht');
  assert.equal(db.data.applyChats['app-1'].berichten.length, 2,
    'de oude voorraad is aangeraakt door de verhuizing');
});

test('de lijst van een lid: zijn eigen sollicitaties, met de laatste regel', () => {
  const { werk } = opzet(OUD());
  /* Net als bij het gastcontact leest deze lijst uit de kern, en moet hij dus
     zijn eigen oude voorraad binnenhalen -- anders staat de sollicitatielijst
     op de dag van de verhuizing leeg. Dezelfde valkuil, dezelfde toets. */
  const lijst = werk.voorSollicitant('user-1');
  assert.equal(lijst.length, 1, 'de sollicitatielijst van het lid stond leeg na de verhuizing');
  assert.equal(lijst[0].id, 'app-1');
  assert.equal(lijst[0].bedrijf, 'Sal de Mar');
  assert.equal(lijst[0].laatste, 'ja, graag');
});
