/* De verhuizing van het gastcontact naar de communicatiekern
   (server/kern/comm/gast.js).

   DE DERDE VOORRAAD, en de eerste waarin een LID en een ZAAK in hetzelfde
   gesprek zitten. De collegachat (comm-collega.test.js) liep tussen twee
   mensen van dezelfde zaak; hier zit aan de ene kant een codenaam en aan de
   andere kant een bedrijf. Dat is precies het gesprek waarvoor het actormodel
   is gemaakt, en dus ook het gesprek waar een fout twee kanten op lekt.

   De vier vaste gevaren van een verhuizing staan uitgeschreven in
   comm-dm.test.js en worden hier opnieuw gemeten: de geschiedenis verdwijnt,
   de tijdstempels schuiven, de leesstand gaat niet mee, de import gebeurt
   twee keer.

   DRIE DIE EIGEN ZIJN AAN DEZE VOORRAAD:

   1. DE AFDELING IS DEEL VAN HET GESPREK. Een hotel heeft Receptie,
      Roomservice, Housekeeping, Onderhoud en Security, en dat waren vijf
      aparte lijnen (de sleutel was CODE|lid|afdeling). Vallen die samen, dan
      leest Housekeeping mee met wat je aan Security schreef.

   2. ER ZIJN TWEE TELLERS, EEN PER KANT. unreadGuest en unreadPartner. In de
      kern is "gelezen tot" per deelnemer, dus moeten het er ook twee blijven
      -- en niet een die voor allebei geldt.

   3. HET SYSTEEMBERICHT HEEFT GEEN AFZENDER. "U heeft nu een open lijn met
      X" stond in de oude voorraad als from:'systeem'. De kern eist dat een
      afzender deelnemer is, dus moet dat bericht ergens vandaan komen; het
      komt van de zaak, met een eigen soort, en het gaat in de oude vorm weer
      als 'systeem' naar buiten. Een regel die bij de verhuizing van afzender
      wisselt zonder dat iemand het merkt, is hoe een gesprek achteraf iets
      anders gaat zeggen dan er stond.

   Draait zonder server, op een nagemaakte database. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakComm } = require('../server/kern/comm');
const { maakCommGast } = require('../server/kern/comm/gast');
const wie = require('../server/kern/comm/wie');

const ZAKEN = { HOSHI: 'Aguamarina Ibiza', PONTO: 'Sunset Ibiza' };
const LEDEN = { 'user-1': 'Amberen Vos' };

function opzet(oud) {
  const db = { data: { guestChats: oud || {} } };
  const comm = maakComm({ db, save: () => {}, crypto,
    naamVan: wie.maakNaam({ codenaamVan: (k) => LEDEN[k] || null, zaakNaam: (c) => ZAKEN[c] || null }) });
  const gast = maakCommGast({ db, save: () => {}, comm });
  return { db, comm, gast };
}

/* De oude vorm, letterlijk zoals kern/leverancier/gastcontact.js hem schreef. */
const OUD = () => ({
  'HOSHI|user-1|Roomservice': {
    supplierCode: 'HOSHI', customerKey: 'user-1', codename: 'Amberen Vos', tier: 'rtg',
    dept: 'Roomservice',
    messages: [
      { from: 'systeem', text: 'U heeft nu een open lijn met Aguamarina Ibiza.', at: '2025-06-01T08:00:00.000Z' },
      { from: 'guest', who: 'Amberen Vos', text: 'mag ik een pot thee', at: '2025-06-01T08:05:00.000Z', lang: 'nl' },
      { from: 'partner', who: 'Marta', text: 'komt eraan', at: '2025-06-01T08:06:00.000Z' }
    ],
    unreadGuest: 1, unreadPartner: 0, lastAt: '2025-06-01T08:06:00.000Z'
  }
});

test('de oude geschiedenis verhuist mee, met haar eigen tijdstempels en kanten', () => {
  const { gast } = opzet(OUD());
  const uit = gast.berichten('HOSHI', 'user-1', 'Roomservice');
  assert.equal(uit.length, 3, 'niet alle oude berichten zijn meegekomen');
  assert.deepEqual(uit.map((m) => m.text),
    ['U heeft nu een open lijn met Aguamarina Ibiza.', 'mag ik een pot thee', 'komt eraan']);
  assert.deepEqual(uit.map((m) => m.at.slice(0, 10)), ['2025-06-01', '2025-06-01', '2025-06-01'],
    'de tijdstempels zijn op de dag van de verhuizing gezet');
  /* Welke kant een bericht op ging, is het enige waaraan het scherm de bubbels
     onderscheidt. Loopt dat door elkaar, dan lijkt de gast zichzelf te hebben
     geantwoord -- en dat is niet terug te rekenen uit de tekst. */
  assert.deepEqual(uit.map((m) => m.from), ['systeem', 'guest', 'partner'],
    'de kanten van het gesprek zijn omgeklapt of samengevallen');
});

test('de twee tellers blijven twee kanten', () => {
  const { gast } = opzet(OUD());
  /* unreadGuest = 1: het lid heeft het antwoord van de zaak nog niet gezien.
     unreadPartner = 0: de zaak is bij. Een enkele stand voor allebei zou de
     ene kant een badge geven die van de andere was. */
  assert.equal(gast.ongelezenGast('HOSHI', 'user-1', 'Roomservice'), 1, 'de teller van het lid klopt niet');
  assert.equal(gast.ongelezenZaak('HOSHI', 'user-1', 'Roomservice'), 0, 'de zaak heeft ineens ongelezen berichten');
});

test('elke afdeling is een eigen gesprek', () => {
  const { gast } = opzet();
  gast.stuurGast('HOSHI', 'user-1', 'Security', 'er staat iemand bij de poort', 'Amberen Vos');
  gast.stuurGast('HOSHI', 'user-1', 'Roomservice', 'mag ik een pot thee', 'Amberen Vos');

  assert.notEqual(gast.gesprek('HOSHI', 'user-1', 'Security').id,
    gast.gesprek('HOSHI', 'user-1', 'Roomservice').id, 'twee afdelingen delen een gesprek');
  assert.deepEqual(gast.berichten('HOSHI', 'user-1', 'Security').map((m) => m.text),
    ['er staat iemand bij de poort'], 'Security ziet wat aan Roomservice geschreven is');
});

test('de deelnemers zijn het lid en de zaak -- en niemand anders', () => {
  const { comm, gast } = opzet();
  gast.stuurGast('HOSHI', 'user-1', 'Team', 'hallo', 'Amberen Vos');
  const g = comm.gesprekVan(gast.gesprek('HOSHI', 'user-1', 'Team').id);
  assert.deepEqual([...g.deelnemers].sort(), ['user-1', 'zaak:HOSHI']);
  assert.equal(g.soort, 'order', 'een gastgesprek hoort in de la Onderweg');
  // een andere zaak komt er niet in, ook niet met het id
  assert.equal(comm.magErin(g, wie.zaak('PONTO')), false, 'een andere zaak zit in dit gesprek');
  assert.throws(() => comm.gesprek(wie.zaak('PONTO'), g.id), /niet van jou/i);
});

test('het systeembericht komt van de zaak en heet naar buiten nog steeds systeem', () => {
  const { comm, gast } = opzet();
  gast.opening('HOSHI', 'user-1', 'Team', 'U heeft nu een open lijn met Aguamarina Ibiza.');
  const uit = gast.berichten('HOSHI', 'user-1', 'Team');
  assert.equal(uit[0].from, 'systeem', 'het scherm ziet het niet meer als systeemregel');
  /* In de kern MOET een afzender deelnemer zijn (dat is de poort), dus staat
     de zaak eronder. Dat is eerlijker dan een lege afzender: de regel gaat
     over die zaak en komt uit haar systeem. */
  const g = comm.gesprekVan(gast.gesprek('HOSHI', 'user-1', 'Team').id);
  assert.equal(comm.berichtenVan(g.id)[0].van, 'zaak:HOSHI');
});

test('de import gebeurt precies een keer', () => {
  const { gast } = opzet(OUD());
  gast.berichten('HOSHI', 'user-1', 'Roomservice');
  gast.ongelezenGast('HOSHI', 'user-1', 'Roomservice');
  gast.stuurZaak('HOSHI', 'user-1', 'Roomservice', 'nog iets?', 'Marta');
  const uit = gast.berichten('HOSHI', 'user-1', 'Roomservice');
  assert.equal(uit.length, 4, 'de geschiedenis staat er dubbel in: ' + uit.map((m) => m.text).join(' | '));
});

test('lezen aan de ene kant zet de teller van de andere niet op nul', () => {
  const { gast } = opzet();
  gast.stuurGast('HOSHI', 'user-1', 'Team', 'een', 'Amberen Vos');
  gast.stuurGast('HOSHI', 'user-1', 'Team', 'twee', 'Amberen Vos');
  assert.equal(gast.ongelezenZaak('HOSHI', 'user-1', 'Team'), 2);
  gast.leesGast('HOSHI', 'user-1', 'Team');       // het LID opent zijn scherm
  assert.equal(gast.ongelezenZaak('HOSHI', 'user-1', 'Team'), 2,
    'het lid las zijn eigen scherm en de zaak was ineens bij');
  gast.leesZaak('HOSHI', 'user-1', 'Team');
  assert.equal(gast.ongelezenZaak('HOSHI', 'user-1', 'Team'), 0);
});

/* Dezelfde regel als in de kern (comm-actor.test.js), maar dan op de weg waar
   hij vandaan komt. De gastchat stuurde de naam van de medewerker altijd al
   mee -- alleen de HELE naam, want het personeelsregister draagt "Marta
   Colom". De gast heeft aan "Marta" genoeg; het team moet weten wie het was. */
test('de gast ziet de voornaam van wie antwoordde, de zaak de hele naam', () => {
  const { gast } = opzet();
  gast.stuurZaak('HOSHI', 'user-1', 'Roomservice', 'komt eraan', 'Marta Colom');

  const bijGast = gast.berichten('HOSHI', 'user-1', 'Roomservice');
  assert.equal(bijGast[0].who, 'Marta', 'de achternaam van de medewerker ging naar de gast');
  assert.equal(bijGast[0].from, 'partner');

  const bijZaak = gast.berichten('HOSHI', 'user-1', 'Roomservice', 120, 'zaak');
  assert.equal(bijZaak[0].who, 'Marta Colom', 'het team kon niet zien wie er antwoordde');
});

test('de oude voorraad blijft staan: er wordt niet in gewist', () => {
  const { db, gast } = opzet(OUD());
  gast.berichten('HOSHI', 'user-1', 'Roomservice');
  gast.stuurGast('HOSHI', 'user-1', 'Roomservice', 'nieuw', 'Amberen Vos');
  assert.equal(db.data.guestChats['HOSHI|user-1|Roomservice'].messages.length, 3,
    'de oude voorraad is aangeraakt door de verhuizing');
});

/* Deze twee gaan over de dag van de verhuizing zelf, en ze zijn er gekomen
   doordat de toets hierboven zakte op iets wat ik niet had zien aankomen.

   De import gebeurt per lijn, op het moment dat die lijn wordt geopend. Bij de
   vorige twee voorraden was dat precies goed: daar komt de LIJST ergens anders
   vandaan (de vriendenlijst, de personeelslijst) en wordt elke lijn onderweg
   aangeraakt. Hier komt de lijst uit de kern zelf -- en die ziet alleen wat al
   verhuisd is. Het gevolg: op de dag van de verhuizing staat het gastenscherm
   van elke zaak leeg, en elk gesprek lijkt weg. Niet stuk en niet op te lossen
   door te wachten: de deur die je nodig hebt om te importeren is de deur die
   je niet meer kunt vinden.

   Hetzelfde geldt voor de gegevensuitvoer van een lid, en daar is het erger.
   Die uitvoer is een RECHT: "wat heeft u van mij". Een leeg antwoord is niet
   zichtbaar fout -- het lijkt gewoon alsof er niets was. */
test('de dag van de verhuizing: een zaak ziet haar lopende gesprekken meteen', () => {
  const { gast } = opzet(OUD());
  /* Niets is aangeraakt: dit is de eerste aanroep na de verhuizing, precies
     zoals het gastenscherm hem doet. */
  const lijst = gast.voorZaak('HOSHI');
  assert.equal(lijst.length, 1, 'het gastenscherm van de zaak stond leeg na de verhuizing');
  assert.equal(lijst[0].last, 'komt eraan');
  assert.equal(lijst[0].dept, 'Roomservice');
  assert.equal(lijst[0].codename, 'Amberen Vos', 'de zaak weet niet meer met wie ze sprak');
});

test('de dag van de verhuizing: de gegevensuitvoer van een lid is compleet', () => {
  const { gast } = opzet(OUD());
  const uit = gast.voorLid('user-1');
  const sleutels = Object.keys(uit);
  assert.deepEqual(sleutels, ['HOSHI|user-1|Roomservice'],
    'de uitvoer van het lid miste zijn gesprekken met zaken');
  assert.equal(uit[sleutels[0]].messages.length, 3, 'de berichten ontbreken in de uitvoer');
  assert.equal(uit[sleutels[0]].supplierCode, 'HOSHI');
});

test('de lijst voor het zaakscherm: alleen de eigen zaak, nieuwste eerst', () => {
  const { gast } = opzet(OUD());
  gast.stuurGast('PONTO', 'user-1', 'Team', 'bij de bar', 'Amberen Vos');
  gast.stuurGast('HOSHI', 'user-1', 'Team', 'bij de receptie', 'Amberen Vos');

  const hoshi = gast.voorZaak('HOSHI');
  assert.deepEqual(hoshi.map((r) => r.dept).sort(), ['Roomservice', 'Team']);
  assert.ok(hoshi.every((r) => r.codename === 'Amberen Vos'), 'het scherm van de zaak toont geen codenaam');
  /* De zaak ziet de codenaam en nooit de echte naam: die staat in de kluis
     (accounts.js) en komt langs deze weg niet naar buiten. */
  assert.deepEqual(gast.voorZaak('PONTO').map((r) => r.last), ['bij de bar'],
    'de ene zaak ziet de gesprekken van de andere');
});
