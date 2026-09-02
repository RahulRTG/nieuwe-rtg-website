/* WAT ER ONDER EEN STAND NOG WERKT -- de andere helft van de vraag.

   ISOLATIEPROEF.json telde alleen wat er DICHTGAAT, en dat is de helft die een
   verkeerd gevoel geeft: hoe meer er dicht is, hoe beter het lijkt. Een
   isolatiestand die niemand durft aan te zetten, beschermt niemand.

   DEZE METING VOND DRIE ECHTE FOUTEN IN HET ONTWERP, en dat is de reden dat ze
   bestaat. Onder `isolatie` stonden drie beloftes op "werkt niet":

     geld-lezen           een lid kon zijn eigen afschrift niet meer opvragen --
                          de eerste handeling van iemand die zijn account niet
                          vertrouwt. Oorzaak: de regel ^/api/(pay|bank)/ zegt
                          GELD_BEWEGEN, en die sloeg een GEMETEN lezer.
     zelf-beschermen      de knop waarmee een mens zich beschermt viel dicht
                          door de bescherming zelf.
     ontsluiten-aanvragen een stand zonder uitgang is een val, en een val zet
                          niemand aan.

   WAT DEZE TOETS BEWIJST:

   1. elke belofte (`moetHeel`) staat HEEL onder elke stand -- dat is de regel
      die de drie fouten hierboven had moeten vangen en nu vangt;
   2. de stand doet aantoonbaar iets: geld sturen gaat wel dicht. Anders meet
      deze toets alleen dat er niets gebeurt;
   3. de uitgang van de stand is nooit door de stand zelf te sluiten;
   4. de verhalen wijzen naar paden die BESTAAN -- een verhaal over een route die
      er niet is, staat altijd op "werkt niet" en zegt niets.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - EIGEN_UITGANG leegmaken in leesset.js          -> 1 en 3 ZAKKEN (RAAK).
   - de leesset-uitzondering uit besluit.js halen
     (de belofte "lezen loopt door")                 -> 1 ZAKT (RAAK).
   - BUITEN_DE_OPSLAG vervangen door alle effecten   -> 1 ZAKT (RAAK).
   - /api/pay/stuur uit het verhaal `geld-sturen`    -> 2 ZAKT (RAAK).

   Draai los: node --test test/bruikbaarheid.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const functies = require('../server/functies');
const maakIsolatie = require('../server/kern/isolatie');
const { maakBruikbaarheid, VERHALEN } = require('../server/kern/isolatie/bruikbaarheid');
const { alleRoutes } = require('../scripts/lib/routes');

function meter() {
  const iso = maakIsolatie({ db: { data: {} }, save() {}, functies, klok: null, huisStand: () => 'normaal' });
  return maakBruikbaarheid({ isolatie: iso, functies });
}

test('1. elke belofte staat heel onder elke stand', () => {
  const uit = meter().overStanden(['normaal', 'waakzaam', 'beperkt', 'beschermd', 'isolatie']);
  const gezakt = [];
  for (const [stand, v] of Object.entries(uit)) {
    for (const b of v.belofteGezakt) gezakt.push(stand + ': ' + b.id + ' (' + b.dicht.join(', ') + ')');
  }
  assert.deepEqual(gezakt, [],
    'deze beloftes zakken: ' + gezakt.join('; ') +
    ' -- een stand die zijn eigen belofte breekt, wordt niet gebruikt');
});

test('2. de stand doet aantoonbaar iets', () => {
  const uit = meter().overStanden(['normaal', 'beschermd', 'isolatie']);
  assert.equal(uit.normaal.werktNiet, 0, 'zonder stand hoort alles te werken');
  assert.ok(uit.beschermd.werktNiet + uit.beschermd.beperkt > 0,
    'de beschermstand hoort iets te sluiten, anders meet deze toets dat er niets gebeurt');

  const sturen = uit.isolatie.rijen.find(r => r.id === 'geld-sturen');
  assert.equal(sturen.stand, 'werkt niet', 'geld sturen hoort onder isolatie dicht te zitten');

  /* En isolatie is minstens zo streng als beschermd -- dat volgt uit de
     ordening, en als het hier niet zo uitkomt, klopt de ordening niet. */
  assert.ok(uit.isolatie.werkt <= uit.beschermd.werkt);
});

test('3. de uitgang is nooit door de stand zelf te sluiten', () => {
  const uit = meter().overStanden(['isolatie']).isolatie;
  for (const id of ['zelf-beschermen', 'ontsluiten-aanvragen']) {
    const r = uit.rijen.find(x => x.id === id);
    assert.equal(r.stand, 'werkt', id + ' moet onder isolatie heel blijven: een stand zonder uitgang is een val');
  }
});

test('4. elk verhaal wijst naar paden die bestaan', () => {
  const bestaat = new Set(alleRoutes().map(r => r.pad));
  const wezen = [];
  for (const v of VERHALEN) for (const p of v.paden) if (!bestaat.has(p)) wezen.push(v.id + ' -> ' + p);
  assert.deepEqual(wezen, [],
    'deze verhalen wijzen naar een route die niet bestaat: ' + wezen.join(', ') +
    ' -- zo\'n verhaal staat altijd op "werkt niet" en zegt niets');
});
