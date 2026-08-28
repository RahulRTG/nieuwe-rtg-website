/* WAT EEN CONTRACT IS, EN WELKE STAP DAARNA MAG.

   ../contract.js is de WINKEL: openen, aanbieden, accepteren, activeren,
   verlengen, opzeggen. Dit bestand is de VORM: de acht standen, de tabel van
   toegestane overgangen, en hoe een contractrij eruitziet als hij ontstaat.

   EEN OVERGANG DIE HIER NIET STAAT, IS EEN PROGRAMMEERFOUT en wordt geweigerd.
   Dat is het hele nut van een expliciete tabel boven een reeks if-jes: je kunt
   hem lezen, en wat er niet in staat kan niet gebeuren.

   GEEN NAAM IN EEN CONTRACT. Hier stond `naam`, overgenomen uit de aanmelding,
   en dat brak het recht op vergetelheid: verwijderde een lid zijn gegevens, dan
   bleef zijn naam in de contractentabel staan (test/vergeten-gezelschap.test.js
   vond het). Operationele data van dit huis draait op codenamen -- de echte naam
   staat in de identiteitskluis, en een tweede kopie ergens anders maakt die
   scheiding waardeloos. Een contract heeft die naam ook niet nodig:
   `aanmeldingId` wijst naar het dossier waar hij hoort, en die laag kent de
   vergeetregels al. */
'use strict';

const klok = require('../../../lib/klok');
const { plusMaanden } = require('./verplichting');

const STATUS = {
  CONCEPT: 'CONCEPT', AANGEBODEN: 'AANGEBODEN', GEACCEPTEERD: 'GEACCEPTEERD',
  ACTIEF: 'ACTIEF', VERLENGBAAR: 'VERLENGBAAR', VERLENGD: 'VERLENGD',
  OPZEGGEND: 'OPZEGGEND', GEEINDIGD: 'GEEINDIGD'
};

/* Een overgang die hier niet staat is een programmeerfout en wordt geweigerd.
   VERLENGD is met opzet een doorgangsstand en geen eindstand: verlengen zet het
   contract terug op ACTIEF met een nieuwe periode, en dat blijft zichtbaar in
   het verloop. */
const OVERGANG = {
  [STATUS.CONCEPT]: [STATUS.AANGEBODEN, STATUS.GEEINDIGD],
  [STATUS.AANGEBODEN]: [STATUS.GEACCEPTEERD, STATUS.GEEINDIGD],
  [STATUS.GEACCEPTEERD]: [STATUS.ACTIEF, STATUS.GEEINDIGD],
  [STATUS.ACTIEF]: [STATUS.VERLENGBAAR, STATUS.OPZEGGEND, STATUS.GEEINDIGD],
  [STATUS.VERLENGBAAR]: [STATUS.VERLENGD, STATUS.OPZEGGEND, STATUS.GEEINDIGD],
  [STATUS.VERLENGD]: [STATUS.ACTIEF],
  [STATUS.OPZEGGEND]: [STATUS.GEEINDIGD],
  [STATUS.GEEINDIGD]: []
};

// standen waarin een contract verplichtingen kan voortbrengen
const LOPEND = new Set([STATUS.ACTIEF, STATUS.VERLENGBAAR, STATUS.OPZEGGEND]);

const VERLENGING = { STILZWIJGEND: 'stilzwijgend', OPZEGBAAR: 'opzegbaar', GEEN: 'geen' };

function magOvergaan(van, naar) {
  return Array.isArray(OVERGANG[van]) && OVERGANG[van].includes(naar);
}

/* Het contract zelf. `afgesprokenCenten` mag null zijn zolang er nog niets is
   getekend (CONCEPT), maar niet meer zodra het ACTIEF wordt -- dat wordt
   hieronder afgedwongen. */
/* GEEN NAAM IN EEN CONTRACT. Hier stond `naam`, overgenomen uit de aanmelding, en
   dat brak het recht op vergetelheid: verwijderde een lid zijn gegevens, dan
   bleef zijn naam in de contractentabel staan (test/vergeten-gezelschap.test.js
   vond het). Operationele data van dit huis draait op codenamen -- de echte naam
   staat in de identiteitskluis, en een tweede kopie ergens anders maakt die
   scheiding waardeloos.

   Een contract heeft die naam ook niet nodig: `aanmeldingId` wijst naar het
   dossier waar hij hoort, en die laag kent de vergeetregels al. Wie een naam op
   een scherm wil, haalt hem daar op -- en krijgt hem dus niet meer als het lid
   is vergeten. Dat is precies de bedoeling. */
function maakContract({ id, pas, aanmeldingId, startAt, afgesprokenCenten,
  minimumMaanden = 12, frequentie = 'maand', verlenging = VERLENGING.OPZEGBAAR,
  opzegMaanden = 1, btwProfiel = 'nl-21', serviceNiveau = null, door = null, nu }) {
  const at = nu ? nu() : klok.nu();
  const start = startAt || new Date(at).toISOString();
  return {
    id, pas, aanmeldingId: aanmeldingId || null,
    status: STATUS.CONCEPT,
    startAt: start,
    minimumMaanden: Math.max(1, Math.round(minimumMaanden)),
    frequentie,
    verlenging,
    opzegMaanden: Math.max(0, Math.round(opzegMaanden)),
    /* DE MOMENTOPNAME. Nooit opnieuw uit de catalogus halen. */
    afgesprokenCenten: Number.isFinite(afgesprokenCenten) ? Math.round(afgesprokenCenten) : null,
    prijsVastTot: plusMaanden(start, Math.max(1, Math.round(minimumMaanden))),
    indexatie: null,
    btwProfiel,
    serviceNiveau,
    eindigtOp: null,
    periode: 1,
    door,
    at,
    verloop: [{ naar: STATUS.CONCEPT, at }]
  };
}

module.exports = { STATUS, OVERGANG, LOPEND, VERLENGING, magOvergaan, maakContract };
