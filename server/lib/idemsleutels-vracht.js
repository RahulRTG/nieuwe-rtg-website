/* Vracht heeft duurzame idemsleutels in de zending zelf. Deze verklaringen
   voorkomen daarnaast dat de generieke rand een echte tweede handeling gokt. */
'use strict';
const SLEUTELS = {
  'POST /api/supplier/vracht': { leest:true },
  'POST /api/supplier/vracht/etappe': { zelfdeVerzoek:true },
  'POST /api/supplier/vracht/douane': { zelfdeVerzoek:true },
  'POST /api/supplier/vracht/afleveren': { zelfdeVerzoek:true },
  'POST /api/supplier/vracht/melding': { zelfdeVerzoek:true },
  'POST /api/supplier/vracht/volgcode/intrek': { zelfdeVerzoek:true },
  'POST /api/vracht/volg': { nietIdempotent:true,
    waarom:'iedere bewuste raadpleging telt als gebruik van de begrensde vrachtcredential' }
};
module.exports = { SLEUTELS };
