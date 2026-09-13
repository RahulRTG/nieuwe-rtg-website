/* HET SAMENGESTELDE GEVOLGCONTRACTREGISTER -- en de enige plek die de delen bij
   elkaar legt.

   WAAROM HET UIT DELEN BESTAAT. Dit register vult zich zoals server/lib/mutatiecontracten.js
   dat doet: langzaam, per regel door een mens nagekeken, en nooit door een script
   aangevuld. Een register dat in een middag vol wordt gezet is precies het valse
   groen dat deze laag moest voorkomen. Het groeit dus, en een bestand dat groeit gaat
   door de omvangband -- vandaar de delen, en niet omgekeerd.

   DE DELEN, MET DE REDEN VOOR DE NAAD:

     ./register-bank.js  de geldweg van het KANTOOR: aanvragen en bevestigen. Geen van
       beide staat in de AI-allowlist, dus geen van beide telt mee in de noemer van
       scripts/gevolgdekking.js -- die meldt ze apart als `contractenBuitenBereik`.
     ./register-lid.js   wat een LID zelf kan aanroepen. Dat staat wel in de allowlist
       en telt dus wel mee. Ze bij elkaar zetten zou die noemer onzichtbaar maken.

   EN HIJ GOOIT BIJ EEN DUBBELE DEFINITIE. Dat is de les uit mutatiecontracten.js: een
   samengesteld register waarin het ene deel het andere stilzwijgend overschrijft, laat
   twee mensen een contract schrijven waarvan er een nooit wordt gelezen. Bij het LADEN
   omvallen is hier het goedkoopste moment.
   ========================================================================== */
'use strict';

const { BANK } = require('./register-bank');
const { LID } = require('./register-lid');

const CONTRACTEN = (() => {
  const uit = {};
  for (const [naam, deel] of [['register-bank.js', BANK], ['register-lid.js', LID]]) {
    for (const pad of Object.keys(deel)) {
      if (uit[pad]) throw new Error('gevolgcontract: twee delen claimen ' + pad +
        ' (de tweede is ' + naam + '). Een contract dat stilzwijgend wordt overschreven, ' +
        'wordt nooit gelezen -- kies er een.');
      uit[pad] = deel[pad];
    }
  }
  return Object.freeze(uit);
})();

module.exports = { CONTRACTEN };
