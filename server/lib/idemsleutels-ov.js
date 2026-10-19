/* DE ROUTETEKENAAR VAN EEN OV-ZAAK -- wat is hier "hetzelfde verzoek"?
   (routes/ov.js, kern/ov/dienst.js)

   De lijst lezen verandert niets. Bewaren zonder `id` MAAKT een lijn, en een
   dubbeltik op "Bewaren" maakte er twee met dezelfde naam en haltes; leden
   zagen die lijn dan dubbel op de OV-kaart (scripts/lib/voltooi/ovroutes.js).
   Een woordelijk gelijk verzoek binnen het venster is dus een herhaling. Een
   echte tweede lijn verschilt in naam of haltes, en een wijziging of weghalen
   draagt het id -- die zijn een ander verzoek. */
'use strict';
const SLEUTELS = {
  'POST /api/staff/ov/lijnen': { leest: true },
  'POST /api/staff/ov/lijn/zet': { zelfdeVerzoek: true }
};
module.exports = { SLEUTELS };
