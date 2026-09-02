/* ============================================================================
   DE KANTOORROUTES -- deuren achter officeAuth die een PERSOON eisen.

   Gevonden bij het bouwen van de rtfos-wereld, en het is dezelfde vorm als
   ./accountroutes.js en ./persoonsroutes.js: de middleware laat een
   kantoorsessie door, maar de HANDELING vraagt te weten wie er zit.

   /api/rtfos/* draagt officeAuth, dus de bewakerskaart zegt `office`. De
   handeling leest `wie(req)` en dat komt uit `boardroomWie` -- en die geeft
   voor een kantoorsessie `sess.lidKey`, dat alleen gevuld is bij een inlog OP
   NAAM (kern/kantoor/index.js, regel 61). Een gedeelde kantoorcode heeft geen
   sleutel, en zonder sleutel is er geen zetel, geen bevoegdheid en geen
   bereik: heel het RTF-besturingssysteem blijft dicht.

   Gemeten, in twee stappen die elkaar opvolgden:
     - met de gedeelde kantoorsessie: "Deze stadsafdeling bestaat niet" (32x)
     - met een stad erbij, nog steeds gedeeld: "U heeft in RTF Proefstad geen
       bevoegdheid voor deze handeling"
     - met de kantoorsessie OP NAAM: key `user-1`, landelijk true

   Dat laatste is geen extra recht dat de proef zich toe-eigent: de eigenaar
   IS het landelijke bestuur, en een kantoormedewerker op naam krijgt zijn
   bereik uit zijn zetels. Wat er verandert is dat er iemand ZIT.

   Wie hier iets bij zet, kijkt eerst of het hele domein zo werkt. Zo niet, dan
   hoort het als heel pad -- zoals in de twee zusterregisters. */
'use strict';
const { dekt } = require('./padgrens');

const VOORVOEGSELS = [
  { pad: '/api/rtfos/', gemeten: 144, waarom: 'het RTF-besturingssysteem; wie(req) leest boardroomWie en dat is bij een gedeelde kantoorcode leeg' }
];
const PADEN = [];
const PADENSET = new Set(PADEN);

function dektPad(pad) {
  return PADENSET.has(String(pad || '')) || VOORVOEGSELS.some(v => dekt(pad, v.pad));
}

function kantoorRolVoor(huidigeRol, pad) {
  if (!dektPad(pad)) return { rol: null, reden: 'dit pad werkt met een gedeelde kantoorcode' };
  if (huidigeRol !== 'office') {
    return { rol: null, reden: '`' + huidigeRol + '` is geen kantoorsessie; ' +
      'een inlog op naam verfijnt alleen `office`' };
  }
  return { rol: 'kantoor-op-naam', reden: null };
}

module.exports = { VOORVOEGSELS, PADEN, dektPad, kantoorRolVoor };
