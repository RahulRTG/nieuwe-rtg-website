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
     ./register-pay-oplaad.js en ./register-pay-stuur.js  de wallet van een lid. Twee
       delen omdat opladen als enige een partij BUITEN RTG raakt en sturen als enige de
       gegevens van een ANDER lid verandert -- twee gevolgprofielen, en samen gingen ze
       door de omvangband.
     ./register-pay-factuur.js  de maandfactuur uit het eigen saldo. Eigen deel omdat de
       tegenpartij RTG zelf is (de huisrekening, buiten het gesloten circuit) en de
       afdracht aan de RTFoundation meegaat: het enige walletpad met drie partijen.
     ./register-pay-klompje.js en ./register-pay-klompje-betaal.js  het klompje vragen en
       voldoen. Twee delen om het scherpste verschil dat deze laag kent: vragen verplaatst
       GEEN geld (`VOORSTEL_MAKEN`) en voldoen wel (`GELD_BEWEGEN`).

   EN HIJ GOOIT BIJ EEN DUBBELE DEFINITIE. Dat is de les uit mutatiecontracten.js: een
   samengesteld register waarin het ene deel het andere stilzwijgend overschrijft, laat
   twee mensen een contract schrijven waarvan er een nooit wordt gelezen. Bij het LADEN
   omvallen is hier het goedkoopste moment.
   ========================================================================== */
'use strict';

const { BANK } = require('./register-bank');
const { BANK_BEVESTIG } = require('./register-bank-bevestig');
const { LID } = require('./register-lid');
const { OPLAAD } = require('./register-pay-oplaad');
const { STUUR } = require('./register-pay-stuur');
const { FACTUUR } = require('./register-pay-factuur');
const { KLOMPJE } = require('./register-pay-klompje');
const { KLOMPJE_BETAAL } = require('./register-pay-klompje-betaal');

const CONTRACTEN = (() => {
  const uit = {};
  for (const [naam, deel] of [['register-bank.js', BANK],
    ['register-bank-bevestig.js', BANK_BEVESTIG], ['register-lid.js', LID],
    ['register-pay-oplaad.js', OPLAAD], ['register-pay-stuur.js', STUUR],
    ['register-pay-factuur.js', FACTUUR], ['register-pay-klompje.js', KLOMPJE],
    ['register-pay-klompje-betaal.js', KLOMPJE_BETAAL]]) {
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
