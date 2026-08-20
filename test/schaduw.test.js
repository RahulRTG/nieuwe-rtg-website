/* ============================================================================
   SCHADUWHANDHAVING -- een nieuwe regel loopt eerst mee zonder te blokkeren.

   WAAROM DIT ER IS. Op 20 augustus 2026 is aan de leverancierspoort een
   abonnementscontrole gehangen. Zorgvuldig gebouwd en getoetst -- en toch wist
   niemand wat hij de volgende ochtend om negen uur zou DOEN: hoeveel verzoeken
   hij raakt, van wie, op welke paden. Dat is precies het moment waarop een
   handhavingsregel een storing wordt in plaats van een grens.

   DE BEWERINGEN DIE ERTOE DOEN:

     toets 2   in de schaduw wordt NIEMAND tegengehouden -- structureel, niet
               als afspraak
     toets 3   je kunt niet afdwingen wat nooit heeft meegelopen; zonder die
               eis is de schaduwstand een vinkje dat niemand aanzet
     toets 5   een vrijstelling wordt GEREKEND en niet beweerd
     toets 7   terug naar de schaduw is een noodrem en wordt nooit tegengehouden

   Draai los: node --experimental-sqlite --test test/schaduw.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakSchaduw, MODUS, RIJP } = require('../server/kern/commercie/schaduw');
const routepoort = require('../server/kern/commercie/routepoort');
const caps = require('../server/kern/commercie/capaciteiten');

const DAG = 86400000;
let T0 = 1_700_000_000_000;
const nu = () => T0;

function opstelling() {
  const db = { data: {} };
  let saves = 0;
  return { S: maakSchaduw({ db, save: () => { saves++; }, nu }), db, saves: () => saves };
}
function laatMeelopen(S, id, n, elkeZoveelste) {
  for (let i = 0; i < n; i++) S.weeg(id, (i % (elkeZoveelste || 10) === 0) ? 'geen abonnement' : null, { wie: 'Z' + i });
}

test('1. een nieuwe regel begint in de schaduw en telt wat hij zou doen', () => {
  const { S } = opstelling();
  S.meld('r1');
  assert.equal(S.stand('r1').modus, MODUS.SCHADUW);

  S.weeg('r1', 'geen abonnement', { wie: 'AAA', wat: '/api/supplier/command/beleid' });
  S.weeg('r1', null, { wie: 'BBB' });
  const st = S.stand('r1');
  assert.equal(st.waarnemingen, 2);
  assert.equal(st.zouTegenhouden, 1);
  assert.equal(st.voorbeelden[0].wie, 'AAA',
    'een getal zonder voorbeelden is niet te beoordelen: 120 keer -- van wie? waarop?');
  assert.equal(st.voorbeelden[0].wat, '/api/supplier/command/beleid');
});

/* DE BEWERING. Er is geen tak waarlangs een schaduwregel iets tegenhoudt. */
test('2. in de schaduw wordt niemand tegengehouden, wat het oordeel ook is', () => {
  const { S } = opstelling();
  S.meld('r1');
  for (const bezwaar of ['geen abonnement', 'te duur', 'verboden', null]) {
    const w = S.weeg('r1', bezwaar, { wie: 'X' });
    assert.equal(w.door, true, 'schaduw laat door, ook bij: ' + bezwaar);
  }
  assert.equal(S.stand('r1').zouTegenhouden, 3, 'maar hij telt het wel');

  // UIT telt niet eens mee
  S.zetModus('r1', 'UIT', 'ik');
  const uit = S.weeg('r1', 'geen abonnement', { wie: 'X' });
  assert.equal(uit.door, true);
  assert.equal(uit.gemeten, false);
  assert.equal(S.stand('r1').waarnemingen, 4, 'een uitgezette regel telt niet mee');
});

/* DE TWEEDE BEWERING, en zij is de enige die deze module echt maakt. */
test('3. je kunt niet afdwingen wat nooit heeft meegelopen', () => {
  const { S } = opstelling();
  S.meld('r1');

  const teVroeg = S.zetModus('r1', 'AFDWINGEN', 'ik');
  assert.equal(teVroeg.status, 409);
  assert.match(teVroeg.error, /nog niet genoeg meegelopen/);
  assert.match(teVroeg.error, new RegExp(RIJP.minWaarnemingen + ' waarnemingen'));
  assert.equal(S.stand('r1').modus, MODUS.SCHADUW, 'en de stand verandert niet');

  // genoeg waarnemingen, maar nog geen week
  laatMeelopen(S, 'r1', RIJP.minWaarnemingen + 5);
  const wachtNogOpDeTijd = S.zetModus('r1', 'AFDWINGEN', 'ik');
  assert.equal(wachtNogOpDeTijd.status, 409);
  assert.match(wachtNogOpDeTijd.error, /dagen/);
  assert.doesNotMatch(wachtNogOpDeTijd.error, /waarnemingen/,
    'duizend waarnemingen op een dag zegt niets over de maandafsluiting');

  const was = T0;
  T0 = was + (RIJP.minDagen + 1) * DAG;
  const nuMag = S.zetModus('r1', 'AFDWINGEN', 'ik');
  assert.equal(nuMag.ok, true);
  assert.equal(S.weeg('r1', 'geen abonnement', { wie: 'X' }).door, false, 'en nu bijt hij');
  assert.equal(S.weeg('r1', null, { wie: 'X' }).door, true);
  T0 = was;
});

test('4. een regel die nooit iemand zou tegenhouden, wordt niet stilzwijgend goedgekeurd', () => {
  const { S } = opstelling();
  S.meld('stil');
  S.meld('bijt');
  for (let i = 0; i < RIJP.minWaarnemingen + 1; i++) S.weeg('stil', null, { wie: 'Z' });
  laatMeelopen(S, 'bijt', RIJP.minWaarnemingen + 1);

  const was = T0;
  T0 = was + (RIJP.minDagen + 1) * DAG;

  const k = S.rijp('stil');
  assert.equal(k.ok, true, 'het is geen blokkade');
  assert.match(k.let, /geen bewijs dat hij werkt/,
    'de mens die hem aanzet hoort te lezen dat er geen bewijs is');

  // en een regel die WEL iets ophield, draagt die waarschuwing niet
  assert.equal(S.rijp('bijt').ok, true);
  assert.equal(S.rijp('bijt').let, null);
  T0 = was;
});

/* DE DERDE BEWERING. Een vrijstelling die je beweert, is een uitgezette regel
   met een nette naam; een die je rekent, vervalt vanzelf als het product
   verandert. */
test('5. de vrijstelling van de abonnementspoort wordt gerekend en niet beweerd', () => {
  const zakelijk = Object.keys(caps.PROFIEL).filter(t => caps.mag(t, 'can_be_partner'));
  for (const r of routepoort.regels()) {
    const missen = zakelijk.filter(t => !caps.mag(t, r.cap));
    if (missen.length) {
      assert.equal(r.vrijstelling, null,
        r.cap + ' ontbreekt op ' + missen.join(', ') + ' en pakt die treden dus wel iets af');
    } else {
      assert.ok(r.vrijstelling, r.cap + ' zit op elke zakelijke trede en kan niemand iets afnemen');
      assert.match(r.vrijstelling, /kan geen enkele zaak iets afnemen/);
    }
  }

  /* Governance is vandaag de enige die iets afpakt (van Business Lite), en dat
     is precies de regel die op 20 augustus meteen is aangezet zonder mee te
     lopen. Deze toets houdt vast dat hij niet stil wordt vrijgesteld. */
  const gov = routepoort.regels().find(r => r.cap === 'can_use_enterprise_governance');
  assert.ok(gov, 'de governance-regel hoort te bestaan');
  assert.equal(gov.vrijstelling, null, 'hij pakt Business Lite iets af en hoort dus mee te lopen');
});

test('6. een vrijstelling vraagt een reden, en is telbaar', () => {
  const { S } = opstelling();
  S.meld('r1');
  assert.equal(S.stelVrij('r1', 'omdat', 'ik').status, 400, 'een woord is geen reden');
  assert.match(S.stelVrij('r1', 'omdat', 'ik').error, /waarom pakt deze regel niemand iets af/);

  assert.equal(S.stelVrij('r1', 'elke zakelijke trede bevat dit onderdeel', 'ik').ok, true);
  assert.equal(S.zetModus('r1', 'AFDWINGEN', 'ik').ok, true, 'vrijgesteld hoeft niet te wachten');
  assert.deepEqual(S.vrijgesteld().map(v => v.id), ['r1']);
  assert.match(S.vrijgesteld()[0].reden, /elke zakelijke trede/,
    'een uitzondering die je niet kunt tellen, is over een jaar de regel');
});

/* DE VIERDE BEWERING. Een noodrem die soms klemt, is geen noodrem. */
test('7. terugzetten naar de schaduw mag altijd, en de klok begint opnieuw', () => {
  const { S } = opstelling();
  S.meld('r1');
  laatMeelopen(S, 'r1', RIJP.minWaarnemingen + 1);
  const was = T0;
  T0 = was + (RIJP.minDagen + 1) * DAG;
  assert.equal(S.zetModus('r1', 'AFDWINGEN', 'ik').ok, true);

  // terug: nooit tegengehouden
  assert.equal(S.zetModus('r1', 'SCHADUW', 'noodrem').ok, true);
  assert.equal(S.weeg('r1', 'geen abonnement', { wie: 'X' }).door, true);

  /* De klok begint opnieuw: er is iets veranderd, en dan is de week ervoor geen
     bewijs meer over de week erna. */
  assert.equal(S.rijp('r1').ok, false);
  assert.match(S.rijp('r1').reden, /dagen/);
  assert.equal(S.stand('r1').verloop[0].van, MODUS.AFDWINGEN);
  T0 = was;
});

test('8. een herstart zet een afgedwongen regel niet terug in de schaduw', () => {
  const { S, db } = opstelling();
  S.meld('r1');
  S.stelVrij('r1', 'elke zakelijke trede bevat dit onderdeel', 'ik');
  S.zetModus('r1', 'AFDWINGEN', 'ik');

  // dezelfde opslag, een nieuwe laag -- zoals bij een herstart van de server
  const opnieuw = maakSchaduw({ db, save: () => {}, nu });
  assert.equal(opnieuw.meld('r1', 'SCHADUW').modus, MODUS.AFDWINGEN,
    'een bestaande regel houdt zijn stand; melden is geen resetten');
});

test('9. een schaduwregel die er maanden staat, is een besluit dat niemand neemt', () => {
  const { S } = opstelling();
  S.meld('oud');
  const was = T0;
  T0 = was + 45 * DAG;
  S.meld('vers');

  const blijft = S.blijftInSchaduw(30).map(r => r.id);
  assert.deepEqual(blijft, ['oud'], 'alleen wat er al 45 dagen staat');
  assert.deepEqual(S.blijftInSchaduw(60).map(r => r.id), [], 'en niet wat nog binnen het venster valt');

  /* Een vrijgestelde regel telt hier NIET mee: die wacht niet op een besluit,
     die heeft er een. */
  S.stelVrij('oud', 'elke zakelijke trede bevat dit onderdeel', 'ik');
  assert.deepEqual(S.blijftInSchaduw(30).map(r => r.id), []);
  T0 = was;
});
