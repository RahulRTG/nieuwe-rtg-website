/* ============================================================================
   DE GUARD OP ./mutatiecontracten-effect -- uit ./mutatiecontracten.js gehaald
   op 13 september 2026, toen die index over de 10 KB van keuringsregel 13 ging.

   WAAROM HIJ APART STAAT EN NIET WEG IS. Hij herhaalt de requirelijst van de
   index, en dat is met opzet: `-effect` draagt een besluit over een STANDAARD
   (scripts/effectcontracten.js), en zo'n standaard mag nooit over een contract
   heen dat iemand per route heeft nagekeken. De guard is de enige plek die dat
   kan zien, want Object.assign zwijgt over wat het overschrijft.

   DUS: komt er een zijbestand bij in ./mutatiecontracten.js, dan hoort het HIER
   ook bij te staan. Die dubbeling is de prijs van de controle; hij stond er
   eerder ook al, alleen tien regels lager in hetzelfde bestand.
   ========================================================================== */
'use strict';

{
  const effect = require('./mutatiecontracten-effect');
  const eerder = Object.assign({},
    require('./mutatiecontracten-beschermd').CONTRACTEN,
    require('./mutatiecontracten-leest').CONTRACTEN,
    require('./mutatiecontracten-tweedehandeling').CONTRACTEN,
    require('./mutatiecontracten-padparameter').CONTRACTEN,
    require('./mutatiecontracten-kaleronde').CONTRACTEN,
    require('./mutatiecontracten-kaleronde-b').CONTRACTEN,
    require('./mutatiecontracten-tweedehandeling-b').CONTRACTEN,
    require('./mutatiecontracten-voorstelintrek').CONTRACTEN,
    require('./mutatiecontracten-isolatie').CONTRACTEN,
    require('./mutatiecontracten-isolatie-lid').CONTRACTEN,
    require('./mutatiecontracten-samenvoeging').CONTRACTEN,
    require('./mutatiecontracten-wonen').CONTRACTEN,
    require('./mutatiecontracten-lidabonnement').CONTRACTEN,
    require('./mutatiecontracten-afleidrest').CONTRACTEN,
    require('./mutatiecontracten-afleidrest-b').CONTRACTEN,
    require('./mutatiecontracten-afleidrest-c').CONTRACTEN,
    require('./mutatiecontracten-afleidrest-d').CONTRACTEN,
    require('./mutatiecontracten-afleidrest-e').CONTRACTEN);   // ook hier: de guard moet hem kennen
  const overschreven = Object.keys(effect).filter(k => k in eerder);
  if (overschreven.length) {
    throw new Error('mutatiecontracten: ./mutatiecontracten-effect overschrijft een specifieker ' +
      'contract: ' + overschreven.slice(0, 5).join(', ') + (overschreven.length > 5 ? ' (+' +
      (overschreven.length - 5) + ')' : '') + '. Haal die route uit scripts/effectcontracten.js zijn ' +
      'uitkomst -- een besluit over een standaard mag nooit over een gelezen contract heen.');
  }
}
