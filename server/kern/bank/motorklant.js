/* Motor-client voor de bank-CUTOVER (RTG_MOTOR_GELD=motor): maakt de Rust-motor
   het ENIGE autoritatieve grootboek voor OOK de RTG Bank (naast RTG Pay). De
   motor houdt een tweede, aparte Ledger voor de bank; de rijke bank-guard
   (rekening bestaat, bevroren, rood-staan-bodem) blijft in de JS-engine, want die
   leunt op de rekening-metadata die daar woont. De motor doet dus een RAUWE apply
   (/api/bank/boek) en is de bron van waarheid voor de saldi; de JS-engine guard't
   ervoor en spiegelt de door de motor bevestigde regel.

   Standaard uit: zonder RTG_MOTOR_GELD=motor is dit een no-op en blijft de
   JS-engine zelf de baas (schaduw-modus), exact als voorheen. Dezelfde vlag en
   URL als de pay-motorklant, want het is dezelfde motor-processus.

   En omdat het dezelfde motor en dezelfde vlaggen zijn, staat de verbinding zelf
   nu ook op een plek: ../motorverbinding.js. Wat HIER staat is wat de bank eigen
   is -- de twee paden, en de namen waarmee de rest van de code hem al aanroept. */
'use strict';

const maakMotorverbinding = require('../motorverbinding');

module.exports = function maakBankMotorklant() {
  const v = maakMotorverbinding({
    boekPad: '/api/bank/boek',
    saldiPad: '/api/bank/saldi',
    watBoeking: 'de bankboeking',
    watSaldi: 'native banksaldi'
  });
  return {
    aan: v.aan, modus: v.modus, globaleNoodstop: v.globaleNoodstop, url: v.url,
    /* Rauw boeken: de JS-guard is AL gepasseerd voordat dit wordt aangeroepen;
       de motor past de al-genomen beslissing enkel toe. */
    bankBoek: v.boek,
    bankSaldiSnapshot: v.saldi
  };
};
