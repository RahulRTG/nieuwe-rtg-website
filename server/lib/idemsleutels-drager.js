/* HET IDEM-REGISTER, deel de drager (B1, kern/genootschap/drager.js) en de
   gezinsdeur van het genootschap (routes/member/genootschap-gezin.js) -- via
   ./idemsleutels-gemeenschap.js.

   Hier staan alleen de routes die niets veranderen. De vijf die wel iets
   veranderen staan in ./idemsleutels-nooit-drager.js: ze herkennen een
   herhaling zelf, of weigeren haar op de stand. */
'use strict';

const SLEUTELS = {
  /* De gezinsdeur roept dezelfde leesfuncties aan als de ledendeur
     (genootschap.mijn/zoek, prikbord.lees, bijeenkomst.agenda); geen ervan
     bewaart iets. */
  'POST /api/rtf/genootschap/mijn': { leest: true },
  'POST /api/rtf/genootschap/zoek': { leest: true },
  'POST /api/rtf/genootschap/prikbord': { leest: true },
  'POST /api/rtf/genootschap/agenda': { leest: true },
  /* Wat een partner in zijn portaal ziet (drager.voorPartner): naam en stand,
     gelezen en niet bewaard. */
  'POST /api/rtfos/portaal/partner/genootschap': { leest: true }
};

module.exports = { SLEUTELS };
