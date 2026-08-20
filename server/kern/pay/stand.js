/* WAAR DIT GELD NAAR LUISTERT: de stand van de betaallaag en de grenzen eromheen.

   Drie schakelaars uit de omgeving en zes bedragen. Ze staan hier bij elkaar
   omdat ze allemaal EEN KEER bij het opstarten worden bepaald en daarna niet
   meer veranderen -- anders dan alles in ./index.js, dat per boeking werkt.

   WAAROM DIT EEN EIGEN BESTAND IS. ./index.js stond op 11310 byte, over de
   grens uit keuringsregel 13. Dit is de naad met de minste bedrading eroverheen:
   er gaat niets IN, en wat eruit komt zijn waarden en twee klanten die zichzelf
   opbouwen.

   WAT ER NIET MEEGING, en dat is met opzet. pasToe(), boek() en boekAsync()
   blijven in ./index.js staan. Niet omdat ze daar mooier staan, maar omdat
   WETTEN.json de wet geld-conservatie daar handhaaft en zijn sabotagerecept
   letterlijk EEN REGEL uit pasToe() aanwijst, met bestandsnaam. Een wet die
   naar een verhuisde regel wijst, toetst niets meer.
   ========================================================================== */
'use strict';

module.exports = () => {
  const betalingenUit = process.env.RTG_BETALEN_UIT === '1';
  const uitFout = () => ({ status: 503,
    error: 'Betalen staat bewust uitgeschakeld. Er is niets afgeschreven.', code: 'betalingen-uit' });

  // Schaduw-modus: spiegelt elke boeking naar de Rust-motor (RTG_MOTOR_SHADOW).
  // Uit = een no-op; JS blijft altijd de baas.
  const schaduw = require('./schaduw')();

  // CUTOVER-modus (RTG_MOTOR_GELD=motor): de Rust-motor wordt het ENIGE
  // autoritatieve grootboek. Standaard uit -> geldModus 'schaduw' = JS blijft de
  // baas, exact als voorheen. In 'motor' loopt elke boeking eerst geguard langs
  // de motor en past de JS-engine daarna dezelfde bevestigde regel toe (spiegel).
  const motorklant = require('./motorklant')();
  const geldModus = motorklant.aan ? 'motor' : motorklant.modus;

  const MIN_CENTEN = 1;              // vanaf 1 cent (een rondje delen mag klein zijn)
  const MAX_CENTEN = 500000;         // tot 5000 euro per boeking
  const OPLAAD_MIN = 100;            // opladen vanaf 1 euro
  const AUTOLAAD_STAP = 1000;        // zelf bijladen in stappen van 10 euro
  const KASCODE_MS = 5 * 60 * 1000;  // een kassacode leeft vijf minuten
  const KASCODE_MAX = 50000;         // standaardplafond kassacode: 500 euro

  return { betalingenUit, uitFout, schaduw, motorklant, geldModus,
    MIN_CENTEN, MAX_CENTEN, OPLAAD_MIN, AUTOLAAD_STAP, KASCODE_MS, KASCODE_MAX };
};
