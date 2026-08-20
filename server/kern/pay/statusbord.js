/* RTG Pay: DE STAND VAN DE MOTOR, voor het techniekbord.

   Uit ./index.js geknipt op de 10 kB-grens, en op een echte naad: dit bestand
   zegt of de MOTOR gezond is, terwijl index.js geld boekt. Alles hier wordt
   alleen gelezen door een poll van het statusbord en nooit in het warme
   geld-pad -- de vingerafdruk over alle saldi is te duur om per boeking te
   berekenen, en dat is precies waarom hij hier staat en niet daar.

   Twee dingen:
     - de MOTORZEKERING: een doorgeslagen zekering hoort zichtbaar te zijn en
       niet alleen merkbaar (LAT.md regel 5). Anders zie je alleen dat boekingen
       falen, en niet dat wij zelf gestopt zijn met proberen.
     - de SCHADUWSTAND: vergelijkt de JS-stand met de Rust-motor, en niet alleen
       de som maar ook een vingerafdruk over ALLE saldi -- zodat drift op een
       enkele rekening die de som mist er toch uit komt. `aan` is false als
       RTG_MOTOR_SHADOW niet is gezet. */
'use strict';

module.exports = ({ motorklant, schaduw, sluitcontrole, saldi }) => {
  /* De stand van de motor-zekering, voor het techniekbord. Een doorgeslagen
     zekering hoort ZICHTBAAR te zijn en niet alleen merkbaar (LAT.md regel 5):
     anders zie je alleen dat boekingen falen en niet dat wij zelf gestopt zijn
     met het proberen. Zie server/kern/motorzekering.js. */
  const motorZekering = () => motorklant.stand();
  // schaduw-stand voor het statusbord (drift-detector): vergelijkt de JS-stand
  // met de Rust-motor -- niet alleen de som maar ook een vingerafdruk over ALLE
  // saldi, zodat per-rekening-drift die de som mist er alsnog uit komt. De afdruk
  // wordt alleen hier berekend (statusbord-poll), niet in het warme geld-pad.
  // `aan` is false als RTG_MOTOR_SHADOW niet is gezet.
  const { vingerafdruk } = require('./vingerafdruk');
  const schaduwMetAfdruk = { aan: schaduw.aan, stand: () => schaduw.stand(sluitcontrole().som, vingerafdruk(saldi())) };
  return { motorZekering, schaduwMetAfdruk };
};
