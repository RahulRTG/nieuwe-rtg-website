/* ============================================================================
   MUTATIECONTRACTEN -- DE GELDROUTES, VAN TWEE KANTEN DICHT.

   Deel van ./mutatiecontracten.js.

   Deze zes zijn beschermd in de sterkste vorm die dit huis kent, en het bewijs
   komt van TWEE metingen die elkaar aanvullen:

     MET SLEUTEL     de kale ronde stuurde een idem-sleutel en de herhaling kwam
                     terug met `herhaald: true` -- de duurzame geldlaag
                     (lib/idem.js) had haar al eens gedaan en doet haar niet
                     opnieuw.
     ZONDER SLEUTEL  de kale ronde kreeg 400. Sinds het besluit van de eigenaar
                     van 30 augustus 2026 weigert lib/idem.js een geldhandeling
                     zonder sleutel: geen sleutel is geen verzoek.

   Een keyloze dubbeltik kan hier dus niet eens ONTSTAAN, en een dubbeltik met
   sleutel wordt opgevangen. Dat is precies wat PROTECTED beweert: "een herhaling
   doet het werk niet nog een keer, vastgesteld en niet aangenomen".

   LET OP DE OMKERING DIE DIT LAAT ZIEN. Deze routes stonden op LEGACY met de
   reden "ongemeten" -- de kale ronde kon niets meten omdat de route weigerde. Dat
   las als onwetendheid en was het tegendeel: de weigering IS de bescherming. Wie
   alleen naar de kale ronde had gekeken, had zes van de best beschermde routes
   van dit huis als onbekend geboekt.

   WIE ER NIET IN STAAT. /api/pay/verzoek/betaal meet met sleutel een 409 ("er is
   geen schuld meer"), en dat is een TOESTANDSCONTROLE en geen idempotentie -- de
   kop van lib/idem-poort.js waarschuwt daar met zoveel woorden voor. Die route
   blijft dus liggen tot iemand haar leest.
   ========================================================================== */
'use strict';

const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van twee metingen (met en zonder sleutel) plus het besluit van de ' +
    'eigenaar over de geldgrens; niet door een mens nagelezen',
  op: '2026-08-30'
};

const BEWIJS = {
  gemeten: 'twee ronden: MET sleutel gaf de herhaling `herhaald: true` (lib/idem.js ving haar), ZONDER ' +
    'sleutel gaf de eerste oproep al 400 -- de geldgrens weigert een geldhandeling zonder sleutel',
  op: '2026-08-30'
};

const dicht = (route, mutatieId) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'sleutelVereist' },
  toegang: { klasse: 'AUTHENTICATED' },
  stand: 'PROTECTED',
  bewijs: BEWIJS,
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  dicht('POST /api/bank/storten', 'bank.storten'),
  dicht('POST /api/bank/terugkerend/zet', 'bank.terugkerend.zet'),
  dicht('POST /api/pay/oplaad', 'pay.oplaad'),
  dicht('POST /api/pay/stuur', 'pay.stuur'),
  dicht('POST /api/pay/tegoed/koop', 'pay.tegoed.koop'),
  dicht('POST /api/pay/tik', 'pay.tik')
]);

module.exports = CONTRACTEN;
