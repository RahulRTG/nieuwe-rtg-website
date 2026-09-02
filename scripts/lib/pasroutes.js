/* ============================================================================
   DE PASROUTES -- deuren die om een betaalde pas vragen.

   Vijfde en laatste variant van de sessieverfijning, en de eenvoudigste: geen
   account, geen persoon, geen geverifieerde identiteit, maar simpelweg een
   andere PAS. De routes zeggen het zelf, en ze zeggen ook welke:

     /api/zakelijk        13  "RTG Zakelijk is onderdeel van de Lifestyle en
                              Business Pass."
     /api/wereld           5  "Dit hoort bij de Lifestyle en Business Pass."
     /api/member/bord(en)  2  "Borden zijn onderdeel van de Business Pass."
     /api/member/accountant 1 "De AI-boekhouder is onderdeel van de Business Pass"
     /api/member/zzp        1  "De zzp-belastingtool is onderdeel van de Business"

   TWEE VERSCHILLENDE PASSEN, en dat verschil is niet cosmetisch. Waar de zin
   "Lifestyle en Business" noemt, opent een Lifestyle Pass de deur; waar hij
   alleen "Business" zegt, doet hij dat niet. Ze op een hoop gooien zou de
   proef laten meten dat een Lifestyle Pass iets opent wat hij niet opent --
   en dat is precies het soort schijnbewijs waar deze hele ronde tegen is.

   WAAROM DIT GEEN LIJFSLEUTELFAMILIE IS. De familie `lifestyle` bestaat al en
   dekt /api/member/rechterhand/, /bureau/, /rendezvous/ en /lifestyle/. Die
   families gaan over een sleutel in het LIJF; dit gaat over de sessie waarmee
   je aanklopt. Dezelfde reden waarom accountroutes.js geen familie werd. */
'use strict';
const { dekt } = require('./padgrens');

/* Per voorvoegsel de pas die de route noemt. `member-lifestyle` opent ook wat
   Business opent niet -- vandaar twee rollen en geen een. */
const VOORVOEGSELS = [
  { pad: '/api/zakelijk', naar: 'member-lifestyle', gemeten: 13,
    waarom: 'RTG Zakelijk is onderdeel van de Lifestyle EN Business Pass; de Lifestyle opent hem' },
  { pad: '/api/wereld', naar: 'member-lifestyle', gemeten: 5,
    waarom: 'de wereldkant hoort bij de Lifestyle en Business Pass' },
  { pad: '/api/member/bord', naar: 'member-zakelijk', gemeten: 1,
    waarom: 'borden zijn ALLEEN Business; een Lifestyle Pass opent ze niet' },
  { pad: '/api/member/borden', naar: 'member-zakelijk', gemeten: 1,
    waarom: 'borden zijn ALLEEN Business; een Lifestyle Pass opent ze niet' },
  { pad: '/api/member/accountant', naar: 'member-zakelijk', gemeten: 1,
    waarom: 'de AI-boekhouder is ALLEEN Business' },
  { pad: '/api/member/zzp', naar: 'member-zakelijk', gemeten: 1,
    waarom: 'de zzp-belastingtool is ALLEEN Business' }
];

function dektPad(pad) {
  return VOORVOEGSELS.some(v => dekt(pad, v.pad));
}

/* Alleen vanaf `member`: de RTG Pass is de trede die deze deuren dicht vindt.
   Wie al een zwaardere pas heeft, hoeft niet verfijnd te worden -- en wie een
   heel andere soort sessie heeft, klopt hier niet aan. */
function pasRolVoor(huidigeRol, pad) {
  let beste = null;
  for (const v of VOORVOEGSELS) {
    if (!dekt(pad, v.pad)) continue;
    if (!beste || v.pad.length > beste.pad.length) beste = v;
  }
  if (!beste) return { rol: null, reden: 'dit pad vraagt geen betaalde pas' };
  if (huidigeRol !== 'member') {
    return { rol: null, reden: '`' + huidigeRol + '` is geen RTG-passessie; ' +
      'een zwaardere pas verfijnt alleen `member`' };
  }
  return { rol: beste.naar, reden: null };
}

module.exports = { VOORVOEGSELS, dektPad, pasRolVoor };
