/* DE HERSTELTRANSACTIE AAN DE ZAAK-KANT.

   Tot vandaag draaide kern/zaakcommand zijn recepten rechtstreeks door
   runbooks.voer(). Dat had de MOMENTOPNAME wel (elke wijziging draagt zijn oude
   waarde mee, dus terugdraaien kon) en de twee stappen eromheen niet: geen
   voorcontrole vooraf, geen verificatie achteraf. Een ondernemer die op
   "rechtzetten" drukte kreeg daardoor dezelfde groene ronde of het nu gelukt
   was of stil niets had gedaan -- en dat tweede is precies hoe een herstelknop
   vertrouwen verliest.

   WAT DEZE TOETS BEWIJST, en de derde is de belangrijkste:

   1. de keten loopt werkelijk, en een droogloop verandert niets;
   2. het certificaat is een BOVENGRENS die ook echt tegenhoudt;
   3. de voorcontrole die hier NIET bestaat, staat als niet-gecontroleerd in het
      antwoord -- met de reden. De gezondheidskaart gaat over het platform en
      een ondernemer heeft daar geen zeggenschap over; hem een controle tonen
      die niet draait, zou erger zijn dan hem niets tonen;
   4. een ronde die nul objecten raakt is `niet van toepassing` en uitdrukkelijk
      geen geslaagde ronde.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de route en de laag teruggezet op runbooks.voer() (de transactie eruit)
     -> toets 1, 2, 3 en 4 ZAKKEN alle vier (RAAK). Dat is geen te grove mutatie
        maar precies de vraag: zonder transactie bestaat er geen voorcontrole,
        geen certificaat en geen verificatie om te lezen.
   - `certificaat: CERT(25)` van bestelling-stations-klaar afgehaald
     -> toets 2 ZAKT (RAAK), en alleen toets 2: zonder certificaat is er geen
        bovengrens en laat de voorcontrole alles door.
   - `gezondheid: null` vervangen door een verzonnen kaart die altijd "in orde"
     zegt -> toets 3 ZAKT (RAAK), en alleen toets 3.

   Draai los: node --test test/zaaktransactie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

/* Eén zaak, en een knop om er zoveel bestellingen bij te zetten als een toets
   nodig heeft. Het aantal is de hele inzet bij toets 2. */
function maak(extraKlaar) {
  const mijn = { code: 'MIJN', name: 'Sal de Mar', type: 'restaurant', city: 'Ibiza', rooms: [], tables: [] };
  const oud = new Date(Date.now() - 3600e3).toISOString();
  const orders = [
    { ref: 'O-KLAAR', supplierCode: 'MIJN', paid: true, status: 'nieuw', at: oud,
      customerCodename: 'Havik', total: 4200, stations: { warm: 'klaar', koud: 'klaar' } },
    { ref: 'O-HALF', supplierCode: 'MIJN', paid: true, status: 'nieuw', at: oud,
      customerCodename: 'Reiger', total: 1500, stations: { warm: 'klaar', koud: 'bezig' } }
  ];
  for (let i = 0; i < (extraKlaar || 0); i++) {
    orders.push({ ref: 'O-X' + i, supplierCode: 'MIJN', paid: true, status: 'nieuw', at: oud,
      customerCodename: 'Gast', total: 100, stations: { warm: 'klaar' } });
  }
  const db = { data: {
    suppliers: [mijn], orders,
    rides: [], boekingen: [], tickets: { MIJN: [] }, verlof: { MIJN: [] },
    applications: {}, vacatures: {}, reserveringen: []
  } };
  const zc = require('../server/kern/zaakcommand').maakZaakCommand({
    db, save: () => {}, crypto, anthropic: null,
    findSupplier: (c) => db.data.suppliers.find(x => x.code === c)
  });
  return { db, orders, mij: zc.voor(mijn, { leiding: true }) };
}

const stap = (voor, naam) => voor.stappen.find(x => x.naam === naam);

test('1. de keten loopt, en droog blijft droog', () => {
  const { mij, db } = maak();
  const droog = mij.transactie.draai('bestelling-stations-klaar', { door: 'Ik', reden: 'proef' });
  assert.deepEqual(droog.keten, ['voorcontrole', 'droogloop'], JSON.stringify(droog.keten));
  assert.equal(droog.droog, true);
  assert.equal(droog.verificatie.nietVanToepassing, true, 'een droogloop heeft niets te verifiëren');
  assert.equal(db.data.orders.find(o => o.ref === 'O-KLAAR').status, 'nieuw', 'de droogloop veranderde iets');

  const echt = mij.transactie.draai('bestelling-stations-klaar',
    { droog: false, door: 'Ik', reden: 'de stations zijn klaar' });
  assert.deepEqual(echt.keten, ['voorcontrole', 'momentopname', 'uitvoeren', 'verificatie', 'vastleggen'],
    JSON.stringify(echt.keten));
  assert.equal(echt.verificatie.goed, true, JSON.stringify(echt.verificatie));
  assert.equal(db.data.orders.find(o => o.ref === 'O-KLAAR').status, 'klaar');
  assert.equal(db.data.orders.find(o => o.ref === 'O-HALF').status, 'nieuw', 'de halve bestelling is meegegaan');

  /* En de verificatie kijkt POSITIEF na, allebei de kanten op. */
  assert.equal(stap(echt.verificatie, 'veld-staat-op-doel').goed, true);
  assert.equal(stap(echt.verificatie, 'oorzaak-weg').goed, true);
});

test('2. het certificaat is een bovengrens die werkelijk tegenhoudt', () => {
  const { mij, db } = maak(30);   // 31 gevallen tegenover een certificaat voor 25
  const echt = mij.transactie.draai('bestelling-stations-klaar',
    { droog: false, door: 'Ik', reden: 'alles ineens' });
  assert.equal(echt.status, 409, JSON.stringify(echt).slice(0, 200));
  assert.match(echt.error, /bovengrens|ten hoogste/i, echt.error);
  assert.equal(echt.certificaat.maxObjecten, 25);
  assert.equal(db.data.orders.find(o => o.ref === 'O-KLAAR').status, 'nieuw',
    'de tegengehouden ronde heeft toch iets veranderd');

  /* EN EEN DROOGLOOP WORDT ER NIET DOOR TEGENGEHOUDEN. Dat is juist hoe je
     erachter komt dat de grens knelt voordat je hem raakt. */
  const droog = mij.transactie.draai('bestelling-stations-klaar', { door: 'Ik', reden: 'kijken' });
  assert.equal(droog.voorcontrole.mag, false, 'de droogloop meldt de grens niet');
  assert.equal(droog.droog, true, 'en hij loopt gewoon');
  assert.equal(stap(droog.voorcontrole, 'binnen-max-impact').gemeten.kandidaten, 31);
});

test('3. de controle die hier niet bestaat, staat als niet-gecontroleerd in het antwoord', () => {
  const { mij } = maak();
  const r = mij.transactie.draai('bestelling-stations-klaar', { door: 'Ik', reden: 'kijken' });
  const f = stap(r.voorcontrole, 'fundament-gezond');
  assert.ok(f, 'de stap ontbreekt helemaal: ' + r.voorcontrole.stappen.map(x => x.naam).join(', '));
  assert.equal(f.gecontroleerd, false, 'de zaak-kant beweert het fundament te hebben gecontroleerd');
  assert.equal(f.goed, null, 'niet gecontroleerd is niet geslaagd en ook niet gezakt');
  assert.match(f.waarom, /gezondheidskaart/, f.waarom);
  assert.ok(r.voorcontrole.nietGecontroleerd.includes('fundament-gezond'),
    'hij staat niet in de lijst met wat er niet gecontroleerd is');
  /* En hij houdt niets tegen: een controle die niet kon draaien mag geen poort zijn. */
  assert.equal(r.voorcontrole.mag, true);
});

test('4. een ronde die niets raakt is niet van toepassing en niet geslaagd', () => {
  const { mij } = maak();
  /* Geen enkele rit in deze zaak, dus dit recept vindt nul gevallen. */
  const r = mij.transactie.draai('rit-oude-statusnaam', { droog: false, door: 'Ik', reden: 'kijken' });
  assert.equal(r.verificatie.goed, null, JSON.stringify(r.verificatie));
  assert.equal(r.verificatie.nietVanToepassing, true);
  assert.match(r.verificatie.waarom, /uitdrukkelijk geen geslaagde ronde/);
  assert.notEqual(r.verificatie.goed, true, 'nul objecten mag nooit als geslaagd lezen');
});

test('5. elk zaak-recept draagt een certificaat, en geen enkel raakt een bevroren veld', () => {
  /* Een recept zonder certificaat draait wel, maar dan zonder bovengrens -- en
     dat hoort een BESLUIT te zijn en niet iets wat je vergeet. Zolang ze het
     alle vier hebben, pint deze toets dat af. */
  const { RUNBOOKS } = require('../server/kern/zaakcommand/runbooks');
  const { BEVROREN } = require('../server/kern/command/runbooks');
  for (const rb of RUNBOOKS) {
    assert.ok(rb.certificaat, rb.id + ' draagt geen certificaat');
    assert.ok(rb.certificaat.maxObjecten > 0, rb.id + ' heeft geen bovengrens');
    assert.equal(rb.certificaat.terugweg, 'automatisch', rb.id);
    assert.equal(rb.terugDraaibaar, true, rb.id + ' belooft een weg terug die hij niet heeft');
    assert.equal(BEVROREN.has(rb.veld), false, rb.id + ' raakt het bevroren veld "' + rb.veld + '"');
  }
});
