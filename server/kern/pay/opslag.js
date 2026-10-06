/* Het vaste opslagvlak van de geldlaag. Een save uit pay hoeft niet alle
   honderden collecties te serialiseren. De lijst is bewust een bovengrens:
   alleen aanwezige collecties gaan mee, zodat ook een samengestelde boeking
   binnen een duurzame bundel exact weet wat zij moet bevestigen. */
'use strict';

const SLEUTELS = Object.freeze([
  'paySaldi', 'payBoekingen', 'payVerzoeken', 'payIdem', 'payIdemAfdruk',
  'payTreasury', 'payKasToegang', 'payTikToegang', 'payVoorafAfloop',
  'payTegoedBon', 'payTegoed', 'payAfstemming', 'payCodes', 'payTikCodes',
  'waardePosities', 'suppliers'
]);

module.exports = ({ save }) => () => typeof save.bestaande === 'function'
  ? save.bestaande(SLEUTELS)
  : save();

module.exports.SLEUTELS = SLEUTELS;
