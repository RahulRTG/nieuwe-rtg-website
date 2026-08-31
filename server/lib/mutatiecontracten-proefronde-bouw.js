/* ============================================================================
   MUTATIECONTRACTEN -- DE OOGST VAN DE UITGEBREIDE PROEFOPSTELLING (30 aug 2026).

   Deel van ./mutatiecontracten.js.

   Toen scripts/lib/idemwereld.js een gezin op /api/rtf/, een klas en een
   document kreeg, gingen 325 dichte deuren open en kregen 123 routes voor het
   eerst een uitslag. Die routes stonden tot dan op BLOCKED_BY_TEST_FIXTURE --
   "wij weten het niet, en dit is waarom de proef er niet bij kwam". Dat klopt
   nu niet meer: er IS gemeten, dus die stand vervalt en er hoort een uitspraak
   te komen.

   Dat is precies wat de poort op nul moest afdwingen, en hij deed het: het
   register viel meteen van 100% terug op 97,5% met 116 routes op LEGACY. Een
   betere meting maakt classificatiewerk zichtbaar in plaats van het stil te
   laten verdwijnen.

   DRIE GROEPEN, EN ZE VERSCHILLEN IN BEWIJSKRACHT. Dat verschil staat per
   contract in `bewijs` en wordt hier niet gladgestreken:

     27  MET sleutel beschermd EN ZONDER sleutel beschermd.
         Vierentwintig daarvan op de sterkste grond die deze proef kent: de
         server merkte de herhaling ZELF (`herhaald: true`) terwijl er geen
         sleutel is gestuurd. Dat kan alleen de idem-poort zijn, en die handelt
         op een verklaring in ./idemsleutels.js. Bedoeling en gedrag vallen
         aantoonbaar samen.

     86  MET sleutel beschermd, ZONDER sleutel geen uitspraak.
         Zwakker, en dat staat er met zoveel woorden bij: wat hier ving is de
         PLATFORMBREDE laag (middleware/idempotentie.js) op de sleutel die de
         aanroeper meestuurde. De kop van scripts/lib/idemproef.js waarschuwt
         daar zelf voor -- "beschermd" betekent dan niet "deze route is
         idempotent" maar "de laag ving hem". Een keyloze dubbeltik is hier NIET
         gemeten, en de kolom `zonderSleutel` in het register blijft dat zeggen.

      3  MET sleutel beschermd, ZONDER sleutel deed het werk opnieuw -- en dat
         is de bedoeling. Ze staan hieronder als INTENTIONALLY_NON_IDEMPOTENT.
   ========================================================================== */
'use strict';

const { SLEUTELS } = require('./idemsleutels');

const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van de meting van de uitgebreide proefopstelling; ' +
    'niet door een mens nagelezen',
  op: '2026-08-30'
};

const OBJECT = (veld) => ({ klasse: 'OBJECT_SCOPED', objectVeld: veld });
const LID = { klasse: 'AUTHENTICATED' };

/* Het objectveld hangt aan het voorvoegsel: de school-routes worden geopend met
   een schoolcode, de rtf-routes met een gezinscode. Dat is geen gok maar wat de
   proefopstelling zelf meestuurt (zie voorvoegselLijf in idemwereld.js). */
function toegangVan(route) {
  const pad = route.split(' ')[1] || '';
  if (pad.startsWith('/api/foundation/school/')) return OBJECT('schoolCode');
  if (pad.startsWith('/api/foundation/') || pad.startsWith('/api/rtf/')) return OBJECT('code');
  return LID;
}

const CONTRACTEN = {};

/* ---- 1. de sterkste groep: ook zonder sleutel opgevangen ---- */
function gemerkt(route, mutatieId) {
  CONTRACTEN[route] = {
    mutatieId, herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: toegangVan(route),
    stand: 'PROTECTED',
    bewijs: {
      gemeten: 'proefronde met de uitgebreide wereld: MET sleutel werd de herhaling opgevangen, en ZONDER ' +
        'sleutel merkte de server haar ZELF (herhaald: true). Dat kan alleen de idem-poort zijn, op grond ' +
        'van de verklaring in lib/idemsleutels.js',
      op: '2026-08-30'
    },
    afgetekend: AFGETEKEND
  };
}

/* ---- 2. de zwakkere groep: alleen met sleutel gemeten ---- */
function metSleutel(route, mutatieId) {
  CONTRACTEN[route] = {
    mutatieId, herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: toegangVan(route),
    stand: 'PROTECTED',
    bewijs: {
      gemeten: 'proefronde met de uitgebreide wereld: MET sleutel deed de herhaling het werk niet opnieuw. ' +
        'ZONDER sleutel is er GEEN uitspraak -- de tweede kale oproep liet niets zien. Wat hier ving is ' +
        'daarmee de platformbrede laag (middleware/idempotentie.js) op de sleutel van de aanroeper, en ' +
        'niet aantoonbaar de route zelf',
      op: '2026-08-30'
    },
    afgetekend: AFGETEKEND
  };
}

/* ---- 3. en de drie die met opzet een tweede handeling doen ----
   De reden wordt OPGEHAALD uit de sleutellijst en niet overgetypt: daar stuurt
   zij de idem-poort, hier verantwoordt zij een stand. Twee kopieen lopen uiteen,
   en dan zegt het register iets anders dan de poort doet. Ontbreekt zij, dan
   gooit dit bestand -- een INTENTIONALLY_NON_IDEMPOTENT met een lege `waarom` is
   precies het vinkje waar die stand voor waarschuwt. */
function tweedeHandeling(route, mutatieId) {
  const v = SLEUTELS[route];
  if (!v || !v.waarom) {
    throw new Error('mutatiecontracten-proefronde: "' + route + '" heeft geen verklaring met een reden in ' +
      'lib/idemsleutels.js; zonder die reden is deze stand een ontsnapping');
  }
  CONTRACTEN[route] = {
    mutatieId, herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: toegangVan(route),
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: v.waarom,
    bewijs: {
      gemeten: 'proefronde met de uitgebreide wereld: MET sleutel opgevangen, ZONDER sleutel deed de ' +
        'tweede oproep het werk opnieuw -- en dat is hier de bedoeling',
      op: '2026-08-30'
    },
    afgetekend: AFGETEKEND
  };
}

module.exports = { CONTRACTEN, gemerkt, metSleutel, tweedeHandeling };
