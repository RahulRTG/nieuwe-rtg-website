/* ============================================================================
   MUTATIECONTRACT -- WAT IEDER VOOR ZICHZELF OPGEEFT BIJ EEN GEZAMENLIJKE REIS.

   Deel van ./mutatiecontracten.js. De vier routes van server/routes/reis-opgave.js
   (kern/reisgezelschap-opgave.js), stap 1 van het programma "Five People. Five
   Private Contexts. One Shared Outcome".

   TWEE LEZEN EN TWEE ZETTEN EEN STAND, en geen van de vier maakt een tweede ding.
   `zet` vergelijkt de nieuwe opgave met de bewaarde; is hij gelijk, dan blijft
   alles staan, ook de versie (gewijzigd: false). `wis` vindt bij de tweede keer
   niets meer en laat dezelfde lege stand achter. Dat is een TOESTANDSCONTROLE en
   geen duplicaatlaag: er wordt geen sleutel herkend, en dat staat er zo bij.
   ========================================================================== */
'use strict';

const OP = '2026-10-12';
const AFGETEKEND = {
  door: 'Claude, op grond van de gelezen handler en test/reisgezelschap-opgave.test.js tegen een ' +
    'wegwerpserver; niet door een mens nagelezen',
  op: OP
};
const toegang = { klasse: 'AUTHENTICATED', deur: 'auth' };
const BESTAND = 'server/kern/reisgezelschap-opgave.js';

const leest = (route, mutatieId, wat) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang,
  stand: 'NOT_APPLICABLE',
  bewijs: { gemeten: 'test/reisgezelschap-opgave.test.js leest dezelfde route herhaald en vergelijkt de stand', op: OP },
  nagekeken: 'handler gelezen in ' + BESTAND + ': ' + wat + ' -- schrijft niets',
  afgetekend: AFGETEKEND
}];
const zet = (route, mutatieId, gemeten) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang,
  stand: 'PROTECTED',
  bewijs: { gemeten, op: OP },
  nagekeken: 'handler gelezen in ' + BESTAND + ': de stand hangt alleen af van de inhoud van de opgave, ' +
    'niet van het aantal oproepen',
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  leest('POST /api/reis/gezelschap/opgave', 'reis.gezelschap.opgave', 'mijnOpgave geeft alleen de eigen opgave van de sessie'),
  leest('POST /api/reis/gezelschap/opgave/voortgang', 'reis.gezelschap.opgave.voortgang', 'voortgang telt deelnemers en opgaven, zonder namen'),
  zet('POST /api/reis/gezelschap/opgave/zet', 'reis.gezelschap.opgave.zet',
    'toets 6: dezelfde opgave twee keer gaf gewijzigd:false en versie 1 bleef 1; een andere opgave gaf versie 2'),
  zet('POST /api/reis/gezelschap/opgave/wis', 'reis.gezelschap.opgave.wis',
    'toets 6: twee keer wissen gaf twee keer 200 en een lege opgave; de tweede vond niets meer om te wissen')
]);

module.exports = CONTRACTEN;
