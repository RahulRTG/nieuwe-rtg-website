/* HET BERICHT AAN DE KLANT BIJ EEN LOPENDE BIJSTANDSSESSIE.

   Wat er mis was, was subtiel: de klant kon alles zien -- het spoor loopt live
   mee, het dossier staat open, de kaart in het Werk OS toont de sessie -- maar
   alleen ALS HIJ KEEK. "Toegang is een uitnodiging" wordt dun als de
   uitgenodigde binnenkomt op een moment dat de gastheer niet naar de deur kijkt.

   HET KANAAL IS ZIJN EIGEN JOURNAAL, en dat is een besluit met een reden (zie
   de kop van kern/command/bijstand-melden.js). Wat er BEWUST niet bij komt is
   een mail of een telefoonmelding: dat is hetzelfde kanaalbesluit als bij het
   alarm in SLO.md, en het hoort een klant in te stellen in plaats van
   stilzwijgend te krijgen.

   WAT DEZE TOETS BEWIJST:
   1. het binnenkomen van RTG landt in het journaal van de KLANT, niet alleen in
      dat van RTG;
   2. er staat geen RTG-medewerkersnaam in dat journaal -- wel het sessie-id, dus
      hij kan het terugvinden;
   3. elke RTG-handeling die de klant aangaat, laat een regel achter;
   4. er wordt niets naar buiten gestuurd: geen mail, geen push.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de meld()-aanroep uit betreed() gehaald
     -> toetsen 1, 2 en 3 ZAKKEN (RAAK). 1 draagt de bewering; 2 en 3 lezen
        dezelfde regel en zakken mee.
   - meld() de medewerkersnaam als `wie` laten schrijven
     -> toets 2 ZAKT, en ALLEEN toets 2 (RAAK).
   - ruimteVan() de eerste werkruimte laten pakken in plaats van die van de sessie
     -> toetsen 1, 2 en 3 ZAKKEN (RAAK): het bericht landt dan bij de buren.

     DIE DERDE WAS EERST AFGESLAGEN, en dat is het vermelden waard. In de eerste
     opzet stond WMIJN vooraan in de fixture, dus "de eerste die je tegenkomt"
     was toevallig de goede -- de mutatie liep er ongemerkt doorheen en de toets
     bewees niets over de keuze van de werkruimte. De fixture zet WANDER nu
     eerst; pas daarna zakt hij. Een toets die je niet hebt zien zakken, is geen
     toets (LAT.md regel 2).

   Draai los: node --test test/bijstandbericht.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

function opstelling() {
  const db = { data: {
    /* WANDER staat EERST, en dat is geen willekeur. Wie de werkruimte van de
       sessie zou vervangen door "de eerste die je tegenkomt", landt dan bij de
       buren -- en dat is precies de fout die deze volgorde laat zakken. Met
       WMIJN vooraan zou die mutatie er ongemerkt doorheen komen. */
    werkruimtes: {
      'WANDER': { code: 'WANDER', naam: 'Iemand anders', journaal: [] },
      'WMIJN': { code: 'WMIJN', naam: 'Hoshi Haarlem', journaal: [] }
    }
  } };
  const journaal = { regels: [], noteer(r) { this.regels.push(r); }, controleer: () => ({ heel: true }) };
  const tenant = { register: { haal: () => ({ org: 'O-HOSHI', naam: 'Hoshi', werkruimtes: ['WMIJN'] }),
    lijst: () => [{ org: 'O-HOSHI', naam: 'Hoshi', werkruimtes: ['WMIJN'] }] } };
  const b = require('../server/kern/command/bijstand').maakBijstand({
    db, save: () => {}, crypto, journaal, tenant: () => tenant,
    diagnose: { voor: () => ({ stand: {}, nooit: [], watIkKeek: 'de stand' }) } });
  return { db, journaal, b };
}

const dagboek = (db, code) => db.data.werkruimtes[code].journaal;

function sessie(b) {
  const v = b.vraag('O-HOSHI', { niveau: 'herstellen', onderwerp: 'de kassakoppeling doet niets',
    werkruimte: 'WMIJN', door: 'de werkruimte WMIJN' });
  assert.ok(v.sessie, JSON.stringify(v));
  return v.sessie.id;
}

test('1. het binnenkomen van RTG staat in het journaal van de klant', () => {
  const { db, b } = opstelling();
  const id = sessie(b);
  assert.equal(dagboek(db, 'WMIJN').length, 0, 'er stond al iets voordat RTG binnenkwam');

  const r = b.betreed(id, 'user-77');
  assert.equal(r.sessie ? 200 : r.status, 200, JSON.stringify(r).slice(0, 160));
  const regels = dagboek(db, 'WMIJN');
  assert.equal(regels.length, 1, 'de klant kreeg geen regel: ' + JSON.stringify(regels));
  assert.match(regels[0].wat, /binnengekomen/, regels[0].wat);
  assert.match(regels[0].reden, /herstellen/, regels[0].reden);

  /* EN NIET BIJ DE BUREN. Een bericht in het journaal van een andere
     werkruimte komt aan bij mensen die er niets mee te maken hebben. */
  assert.equal(dagboek(db, 'WANDER').length, 0, 'de buurwerkruimte kreeg het bericht ook');
});

test('2. er staat geen RTG-naam in het klantjournaal, wel het sessie-id', () => {
  const { db, b } = opstelling();
  const id = sessie(b);
  b.betreed(id, 'user-77');
  const r = dagboek(db, 'WMIJN')[0];
  assert.equal(r.wie, 'RTG Bijstand', 'er staat een andere afzender: ' + r.wie);
  assert.equal(JSON.stringify(r).includes('user-77'), false,
    'de codenaam van de medewerker staat in het journaal van de klant: ' + JSON.stringify(r));
  assert.match(r.waarover, new RegExp(id), 'het sessie-id ontbreekt, dus hij kan het niet terugvinden');
});

test('3. elke RTG-handeling die de klant aangaat laat een regel achter', () => {
  const { db, b } = opstelling();
  const id = sessie(b);
  b.betreed(id, 'user-77');
  b.stelVoor(id, 'user-77', { wat: 'de kassakoppeling opnieuw opbouwen', waarom: 'de sessie is weg' });
  b.besluit('O-HOSHI', id, 0, true, 'de werkruimte WMIJN');
  b.voerUit(id, 'user-77', 0, '82 van 82 verwerkt');
  b.vraagInhoud(id, 'user-77', 'ik moet zien welke groep aan welke rol hangt');
  b.sluit(id, 'user-77', 'De sessie was verlopen; opnieuw opgebouwd en 82 transacties verwerkt.');

  const watten = dagboek(db, 'WMIJN').map(r => r.wat);
  assert.equal(watten.length, 4, 'niet elke handeling meldde zich: ' + JSON.stringify(watten));
  assert.ok(watten.some(w => /binnengekomen/.test(w)), watten.join(' | '));
  assert.ok(watten.some(w => /uitvoerde|voerde een goedgekeurde handeling uit/.test(w)), watten.join(' | '));
  assert.ok(watten.some(w => /toegang tot namen/.test(w)), watten.join(' | '));
  assert.ok(watten.some(w => /afgesloten/.test(w)), watten.join(' | '));
});

test('4. er gaat niets naar buiten: geen mail en geen telefoonmelding', () => {
  /* Dit is een KANAALBESLUIT en geen vergeten functie. Zolang een klant niet
     heeft afgesproken waar hij bereikt wil worden, is een bericht naar buiten
     een bericht op het verkeerde moment bij de verkeerde persoon. */
  const bron = require('fs').readFileSync('server/kern/command/bijstand-melden.js', 'utf8');
  for (const verboden of ['mail', 'sendPush', 'sms', 'webpush', 'nodemailer']) {
    assert.equal(new RegExp('\\b' + verboden + '\\s*\\(', 'i').test(bron), false,
      'bijstand-melden.js roept "' + verboden + '" aan: dat is een kanaal naar buiten');
  }
  /* En de reden waarom niet, staat erin. Een grens zonder reden wordt de
     volgende keer weggehaald door iemand die hem voor een gat aanziet. */
  assert.match(bron, /geen mail en geen telefoonmelding/i);
  assert.match(bron, /SLO\.md/, 'de reden verwijst niet naar het eerdere kanaalbesluit');
});
