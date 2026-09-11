/* ============================================================================
   DE MUTATIECONTRACTEN VAN RTG RUGDEKKING (kern/rugdekking).

   EERST HET BEWIJS, DAN HET CONTRACT. Er is een dubbeltik-ronde gedraaid op de
   zes routes (elke weg twee keer met hetzelfde lijf, en tellen wat er in de
   collectie `rugdekkingen` bij kwam). De uitkomst staat per route in
   `bewijs.gemeten`.

   EN DIE RONDE VOND IETS. `stel` liet in de eerste meting TWEE lopende
   programma's achter na twee identieke aanroepen (0 -> 1 -> 2): een dubbelklik
   in het kantoor verdubbelde stil wat RTG een mens had beloofd. Bij een agenda
   is dat rommel, bij geld is het het dubbele bedrag. Dat is gerepareerd VOORDAT
   dit contract werd geschreven, en pas daarna opnieuw gemeten -- dat is de
   volgorde die MUTATIECONTRACT.md bedoelt: het bewijs stuurt de code, niet
   andersom.

   DRIE VAN DE ZES ZIJN EEN TOESTANDSCONTROLE EN GEEN DUPLICAATLAAG. Dat verschil
   wordt hier niet weggepoetst (par. 5o): wat vaststaat is dat er geen tweede
   effect KAN ontstaan, niet dat een dubbeltik wordt herkend. */
'use strict';

const OP = '2026-09-11';

/* DE AFTEKENING IS EERLIJK OVER WAT ZE IS. Deze contracten zijn opgesteld door
   Claude op grond van een dubbeltik-ronde die in dezelfde sessie is gedraaid --
   niet door een mens die ze een voor een heeft nagelezen. Dat verschil hoort in
   het register te staan; wie ze naleest, vervangt deze regel door zijn naam. */
const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van een gedraaide dubbeltik-ronde op kern/rugdekking; ' +
    'niet door een mens nagelezen',
  op: OP
};

/* De kantoorwegen hangen aan `kluisAuth` en niet aan de gedeelde code: elk
   besluit hier gaat over geld naar een MENS, en een spoor dat eindigt bij een
   gedeelde code is geen spoor (KANTOORMACHT.md). De kern weigert zonder naam.

   EN TOCH IS DE KLASSE `AUTHENTICATED`, precies zoals bij
   ./mutatiecontracten-tweedehand.js. `kluisAuth` vraagt geen BEVOEGDHEID maar
   een IDENTITEIT, en `CAPABILITY_GATED` eist de naam van een bevoegdheid zodat
   de route en kern/bevoegdheid/lijst.js over hetzelfde ding praten. Die naam is
   er hier niet -- RUGDEKKING_BEURS wordt door de KERN gevraagd, niet door de
   deur. Een zwaardere klasse opschrijven dan er staat, maakt het register een
   verlanglijst. */
const KANTOOR = { klasse: 'AUTHENTICATED', deur: 'kluisAuth' };
const LID = { klasse: 'AUTHENTICATED', deur: 'auth' };

/* Een LEESweg: hij raakt de opslag niet. `kijk()` is met opzet gekozen boven
   `bak()` zodat een blik geen lege rij achterlaat -- zie de kop van
   kern/eigencollectie.js. */
const leest = (route, mutatieId, toegang, hoe) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang,
  stand: 'NOT_APPLICABLE',
  bewijs: { gemeten: 'dubbeltik-ronde ' + OP + ': twee keer 200 en het aantal programma\'s bleef ' +
    'gelijk. ' + hoe, op: OP },
  nagekeken: 'de handler is herleid en roept alleen boekKijk() aan, dat een ontbrekende collectie ' +
    'niet aanmaakt',
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  leest('POST /api/rugdekking/lijst', 'rugdekking.lijst', LID,
    'De route geeft de twee soorten, de gesloten lijst tegenprestaties, de NOOIT-lijst en de stand ' +
    'van de beurs terug; hij kent geen lid.'),
  leest('POST /api/rugdekking/mijn', 'rugdekking.mijn', LID,
    'Wat er over DEZE mens is vastgelegd, op de sleutel uit de sessie.'),
  leest('POST /api/office/rugdekking/alle', 'rugdekking.alle', KANTOOR,
    'Alle programma\'s plus de stand van de beurs, voor het kantoor.'),

  ['POST /api/office/rugdekking/stel', {
    mutatieId: 'rugdekking.stel', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: KANTOOR,
    stand: 'PROTECTED',
    bewijs: { gemeten: 'dubbeltik-ronde ' + OP + ': de tweede oproep kwam terug met 409 ("Dit lid ' +
      'heeft al een lopend programma dat op alle punten hetzelfde is") en er bleef EEN programma ' +
      'staan (0 -> 1 -> 1). In de eerste ronde stond die controle er niet en bleven er TWEE staan ' +
      '(0 -> 1 -> 2) -- twee keer hetzelfde bedrag aan dezelfde mens beloofd. Een toestandscontrole ' +
      'en geen duplicaatlaag (par. 5o): wat vaststaat is dat er geen tweede IDENTIEK programma kan ' +
      'ontstaan. Een programma dat ergens van afwijkt -- ander bedrag, andere einddatum, andere ' +
      'tegenprestatie -- is een ander besluit en gaat gewoon door; dat is apart gemeten.', op: OP },
    afgetekend: AFGETEKEND
  }],

  ['POST /api/office/rugdekking/stop', {
    mutatieId: 'rugdekking.stop', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: KANTOOR,
    stand: 'PROTECTED',
    bewijs: { gemeten: 'dubbeltik-ronde ' + OP + ': de tweede oproep kwam terug met 409 ("Dit ' +
      'programma is al gestopt") en de stopregel van de eerste bleef ongewijzigd staan -- dus ook ' +
      'geen tweede stopper of tweede tijdstip. Een toestandscontrole, geen duplicaatlaag (par. 5o).',
      op: OP },
    afgetekend: AFGETEKEND
  }],

  ['POST /api/office/rugdekking/beurs', {
    mutatieId: 'rugdekking.beursStandZet', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: KANTOOR,
    stand: 'PROTECTED',
    bewijs: { gemeten: 'dubbeltik-ronde ' + OP + ': de route ZET de stand (een toewijzing, geen ' +
      'toevoeging). Twee keer `open` gaf twee keer 200 met dezelfde stand, en twee keer `gesloten` ' +
      'ook. Dit is dus echte idempotentie en geen toestandscontrole: de route weigert niet, hij ' +
      'antwoordt hetzelfde. Wat WEL elke keer meeverandert is `standDoor` en `standAt` -- en dat ' +
      'is de bedoeling: wie de positie van dit huis als laatste heeft bevestigd, is precies wat je ' +
      'bij een geschil wilt weten.', op: OP },
    afgetekend: AFGETEKEND
  }]
]);

module.exports = { CONTRACTEN };
