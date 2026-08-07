/* De verhuizing van de collegaberichten naar de communicatiekern
   (server/kern/comm/collega.js).

   DE TWEEDE VOORRAAD DIE OVERGAAT, en de eerste die dat kan doordat een
   deelnemer niet meer per se een lid is (kern/comm/wie.js). Een collegachat
   loopt tussen twee MENSEN BINNEN EEN ZAAK -- 'mens:AB12:7' en 'mens:AB12:9'
   -- en die sleutels bestonden tot voor kort niet.

   Wat er bij een verhuizing van gebruikersdata misgaat, staat uitgeschreven in
   comm-dm.test.js: de geschiedenis verdwijnt, de tijdstempels schuiven, de
   leesstand gaat niet mee, of de import gebeurt twee keer. Alle vier zijn ze
   onzichtbaar op het scherm van de dag zelf, en alle vier worden ze hier
   opnieuw gemeten -- want een regel die in het ene bestand klopt, klopt niet
   vanzelf in het volgende.

   MAAR ER IS EEN VIJFDE, en die is nieuw voor deze voorraad. De oude opslag
   was per zaak: db.data.collegaChats[code][paar]. Twee medewerkers met
   TOEVALLIG DEZELFDE NUMMERS bij twee verschillende bedrijven zaten daardoor
   in twee verschillende bakjes, en de code kon niet anders. In de kern is er
   een platte lijst gesprekken; als de zaakcode uit de sleutel wegvalt, lopen
   die twee gesprekken in elkaar over. Dat is geen rommelig scherm maar een
   datalek tussen twee bedrijven, dus staat het hieronder als eigen toets.

   Draait zonder server, op een nagemaakte database. De routes eromheen staan
   in comm-zaak.e2e.js. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakComm } = require('../server/kern/comm');
const { maakCommCollega } = require('../server/kern/comm/collega');
const wie = require('../server/kern/comm/wie');

const NAMEN = { 7: 'Sanne', 9: 'Joris', 3: 'Ilona' };

function opzet(oud) {
  const db = { data: { collegaChats: oud || {} } };
  let bewaard = 0;
  const comm = maakComm({ db, save: () => { bewaard++; }, crypto,
    naamVan: wie.maakNaam({ mensNaam: (code, id) => NAMEN[id] || null }) });
  const cc = maakCommCollega({ db, save: () => { bewaard++; }, comm });
  return { db, comm, cc, bewaard: () => bewaard };
}

/* De oude vorm, letterlijk zoals routes/staff/collega.js hem schreef:
   { messages: [{ van, naam, text, at }], unread: { staffId: n }, lastAt }. */
const OUD = () => ({
  AB12: {
    '7-9': {
      messages: [
        { van: 7, naam: 'Sanne', text: 'neem jij de late dienst', at: '2024-03-01T10:00:00.000Z' },
        { van: 9, naam: 'Joris', text: 'is goed', at: '2024-03-01T10:04:00.000Z' },
        { van: 7, naam: 'Sanne', text: 'top', at: '2024-03-02T09:00:00.000Z' }
      ],
      unread: { 9: 1 },
      lastAt: '2024-03-02T09:00:00.000Z'
    }
  }
});

test('de oude geschiedenis verhuist mee, met haar eigen tijdstempels', () => {
  const { cc } = opzet(OUD());
  const uit = cc.berichten('AB12', 7, 9);
  assert.equal(uit.length, 3, 'niet alle oude berichten zijn meegekomen');
  assert.deepEqual(uit.map((m) => m.text), ['neem jij de late dienst', 'is goed', 'top']);
  /* De datums, en dit is de belangrijkste regel van deze toets: via de gewone
     verstuurweg zou hier drie keer vandaag staan. */
  assert.deepEqual(uit.map((m) => m.at.slice(0, 10)), ['2024-03-01', '2024-03-01', '2024-03-02'],
    'de tijdstempels zijn op de dag van de verhuizing gezet');
  // en de afzender blijft de afzender, in de vorm die het scherm al kent
  assert.deepEqual(uit.map((m) => m.van), [7, 9, 7], 'het scherm kan niet meer zien wie wat schreef');
});

test('de leesstand gaat mee: wat gelezen was, springt niet op ongelezen', () => {
  const { cc } = opzet(OUD());
  /* In de oude vorm stond ongelezen als TELLER (unread[9] = 1), niet als
     tijdstip. De kern rekent met "gelezen tot", dus moet de teller worden
     omgerekend: de laatste n berichten van de ander zijn ongelezen, de rest
     niet. Klopt dat niet, dan springt bij iedereen elk oud gesprek op
     ongelezen -- een stapel rode bolletjes die niemand veroorzaakt heeft. */
  assert.equal(cc.ongelezen('AB12', 9, 7), 1, 'de teller van de ontvanger klopt niet');
  assert.equal(cc.ongelezen('AB12', 7, 9), 0, 'de afzender heeft ineens ongelezen berichten');
});

test('de import gebeurt precies een keer, ook als het gesprek vaak wordt geopend', () => {
  const { cc } = opzet(OUD());
  cc.berichten('AB12', 7, 9);
  cc.berichten('AB12', 9, 7);        // andersom geopend: hetzelfde gesprek
  cc.stuur('AB12', 7, 9, 'en morgen?');
  cc.berichten('AB12', 7, 9);
  const uit = cc.berichten('AB12', 9, 7);
  assert.equal(uit.length, 4, 'de geschiedenis staat er dubbel in: ' + uit.map((m) => m.text).join(' | '));
});

test('twee collegas hebben EEN gesprek, welke kant je het ook opent', () => {
  const { comm, cc } = opzet();
  cc.stuur('AB12', 7, 9, 'van zeven');
  cc.stuur('AB12', 9, 7, 'van negen');
  assert.equal(comm.gesprekVan(cc.gesprek('AB12', 7, 9).id).id, cc.gesprek('AB12', 9, 7).id,
    'er zijn twee gesprekken tussen dezelfde twee mensen');
  assert.deepEqual(cc.berichten('AB12', 9, 7).map((m) => m.text), ['van zeven', 'van negen']);
});

/* ------------------------------------------------- de vijfde, en de nieuwe */

test('dezelfde nummers bij een andere zaak zijn andere mensen', () => {
  const { comm, cc } = opzet();
  cc.stuur('AB12', 7, 9, 'bij ons in de keuken');
  cc.stuur('CD34', 7, 9, 'bij ons aan de balie');

  /* De oude opslag zette de zaakcode in het PAD (collegaChats[code][paar]); in
     de kern moet hij in de SLEUTEL zitten, anders is er een gesprek waar twee
     bedrijven in zitten. Twee gesprekken dus, en elk ziet alleen het eigene. */
  assert.notEqual(cc.gesprek('AB12', 7, 9).id, cc.gesprek('CD34', 7, 9).id,
    'twee bedrijven delen hetzelfde collegagesprek');
  assert.deepEqual(cc.berichten('AB12', 7, 9).map((m) => m.text), ['bij ons in de keuken']);
  assert.deepEqual(cc.berichten('CD34', 7, 9).map((m) => m.text), ['bij ons aan de balie']);

  // en de poort van de kern zegt hetzelfde: de sleutels van AB12 passen niet op CD34
  const g = comm.gesprekVan(cc.gesprek('CD34', 7, 9).id);
  assert.equal(comm.magErin(g, wie.mens('AB12', 7)), false,
    'een medewerker van de ene zaak zit in het gesprek van de andere');
});

test('de deelnemers zijn mensen binnen een zaak, en de zaak zelf zit er niet in', () => {
  const { comm, cc } = opzet();
  cc.stuur('AB12', 7, 9, 'onder ons');
  const g = comm.gesprekVan(cc.gesprek('AB12', 7, 9).id);
  assert.deepEqual([...g.deelnemers].sort(), ['mens:AB12:7', 'mens:AB12:9']);
  /* De zaaksleutel zit in de sessie van ELKE medewerker. Stond die hier ook
     in, dan las het halve team mee in een gesprek tussen twee mensen. */
  assert.equal(comm.magErin(g, wie.zaak('AB12')), false, 'de hele zaak zit in de collega-DM');
  assert.equal(comm.magErin(g, wie.mens('AB12', 3)), false, 'een derde collega zit erin');
});

test('de oude voorraad blijft staan: er wordt niet in gewist', () => {
  const { db, cc } = opzet(OUD());
  cc.berichten('AB12', 7, 9);
  cc.stuur('AB12', 7, 9, 'nieuw bericht');
  /* Data van mensen weggooien omdat de code er klaar mee is, is precies de
     handeling die je niet terug kunt draaien als er iets aan de import blijkt
     te mankeren. Hij wordt niet meer gelezen en niet meer geschreven. */
  assert.equal(db.data.collegaChats.AB12['7-9'].messages.length, 3,
    'de oude voorraad is aangeraakt door de verhuizing');
});

test('een leeg bericht en een onbekend paar laten niets omvallen', () => {
  const { cc } = opzet();
  assert.throws(() => cc.stuur('AB12', 7, 9, '   '), /leeg/i);
  assert.deepEqual(cc.berichten('AB12', 7, 3), [], 'een vers paar begint niet leeg');
  assert.equal(cc.ongelezen('AB12', 7, 3), 0);
});
