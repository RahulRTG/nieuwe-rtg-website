/* MEET IK NAAST EEN MOTOR DIE DE BRON VERBOUWT? -- het hulpje voor een TOETS
   die de boom opnieuw meet en de uitkomst naast een register legt.

   WAAROM DIT NAAST scripts/afbouw-slot.js STAAT EN ER NIET IN. Dat bestand
   bedient de MOTOREN: pak() voor wie de bron verbouwt, eisGeenAfbouw() voor een
   generator die een document schrijft. Dit is de derde soort aanroeper -- een
   toets die niets schrijft en alleen VERGELIJKT -- en die heeft een ander
   antwoord nodig: niet weigeren met een foutcode, maar de vergelijking
   overslaan met de reden erbij.

   DE AANLEIDING (13 september 2026). test/magnaatlab.test.js meldde
   "MAGNAATLAB.json loopt achter: 2068 vastgelegd, 2069 gemeten", en dat getal
   was ONWAAR. Er liep op dat moment een meterijking, en die zet met opzet echte
   bestanden neer (een scherm onder public/apps/, een route, een dependency) en
   haalt ze in een finally weer weg. De toets telde die aanbouw mee.

   Dat is precies het geval dat test/afbouwpoort.test.js in zijn kop al
   voorspelde: `eisSchoneBoom` vangt het maar bij toeval, want een meting die
   START in een schoon venster en er MIDDENIN belandt, komt erlangs. De motoren
   waren afgeschermd; de lezers niet.

   WAT HET WEL EN NIET DOET. Binnen `npm test` zet scripts/test-runner.js
   RTG_AFBOUW_SLOT_ACTIEF=1, en dan is het slot van de eigen proceslijn --
   eisGeenAfbouw laat dat door en dit hulpje dus ook. Hij bijt alleen waar hij
   voor bedoeld is: een toets die je met de hand in een shell draait terwijl er
   in een andere proceslijn een motor loopt.

   EN EEN OVERGESLAGEN VERGELIJKING IS GEEN GESLAAGDE. De aanroeper krijgt een
   reden terug die hij in de uitslag hoort te zetten; een register dat je niet
   hebt kunnen controleren, mag nooit als "in orde" langskomen (dezelfde regel
   als MET_REDEN in scripts/tikken.js). */
'use strict';

const { eisGeenAfbouw } = require('../afbouw-slot');

/* Geeft null als er vrij gemeten mag worden, en anders een REDEN in gewone
   woorden. De aanroeper beslist zelf wat hij daarmee doet -- overslaan of
   melden -- want dit hulpje kent zijn toets niet. */
function afbouwInDeWeg(watMeetJe) {
  const poort = eisGeenAfbouw(watMeetJe || 'een register-vergelijking');
  if (poort.ok) return null;
  const a = poort.afbouw || {};
  return 'er loopt een afbouw (' + (a.taak || 'onbekende taak') + ', PID ' + (a.pid || '?') +
    ', gestart ' + (a.gestart || '?') + '). Die verbouwt met opzet echte bestanden, dus een verse ' +
    'meting telt die aanbouw mee en het verschil met het register zegt niets. ' +
    'Deze vergelijking is OVERGESLAGEN en niet geslaagd.';
}

module.exports = { afbouwInDeWeg };
