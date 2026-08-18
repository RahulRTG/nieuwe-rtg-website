/* Motor-client voor de CUTOVER (RTG_MOTOR_GELD=motor): maakt de Rust-motor het
   ENIGE autoritatieve grootboek. Anders dan de schaduw-laag (fire-and-forget
   spiegeling) is dit een SYNCHRONE afhankelijkheid op het geld-pad: elke boeking
   gaat eerst geguard naar de motor (/api/pay/boekguard), en pas als die de
   boeking bevestigt past de JS-engine dezelfde regel toe op zijn spiegel. Zo is
   er EEN grootboek (de motor) en kan er geen split-brain ontstaan.

   Standaard uit: zonder RTG_MOTOR_GELD=motor is dit een no-op en blijft de
   JS-engine zelf de baas (schaduw-modus). De URL komt uit RTG_MOTOR_GELD_URL of
   valt terug op RTG_MOTOR_SHADOW.

   De verbinding zelf (vlaggen, koppen, time-out, foutvertaling) staat in
   ../motorverbinding.js, want de bank-client deed daar precies hetzelfde -- zie
   de uitleg daar. Wat HIER staat is wat pay eigen is: welke twee paden, en hoe
   de twee functies heten die de rest van de code al gebruikt. */
'use strict';

const maakMotorverbinding = require('../motorverbinding');

module.exports = function maakMotorklant() {
  const v = maakMotorverbinding({
    boekPad: '/api/pay/boekguard',
    saldiPad: '/api/motor/saldi',
    watBoeking: 'de boeking',
    watSaldi: 'native saldi'
  });
  return {
    aan: v.aan, modus: v.modus, globaleNoodstop: v.globaleNoodstop, url: v.url,
    /* Geguard boeken: de motor neemt de beslissing (bijv. 402 bij onvoldoende
       saldo) en de JS-engine spiegelt pas na zijn bevestiging. */
    boekGuard: v.boek,
    saldiSnapshot: v.saldi
  };
};
