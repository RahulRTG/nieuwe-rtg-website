/* DE GRENS VAN HET TOESTELREGISTER -- wat het vangnet mag laten wijken, en wat
   nooit.

   Het register van ./toestellen.js houdt per lid hoogstens MAX_ACTIEF actieve
   bindingen bij; bij de volgende wijkt de langst niet bewezen. Dat vangnet liet
   vroeger ook INGETROKKEN toestellen wijken. Na 25 nieuwere bindingen was de
   intrekking dan weg, en bond een oude private sleutel stil opnieuw: de regel
   "een ingetrokken toestel komt niet stilletjes terug" hing aan een opruimbeurt.

   Een intrekking is bewijs, en bewijs wijkt niet voor ruimte. Dus:
     - het vangnet telt en verwijdert alleen ACTIEVE bindingen;
     - ingetrokken toestellen blijven staan. Wie er MAX_INGETROKKEN van heeft,
       bindt geen nieuw toestel meer: de grens sluit dicht en gooit niets weg. */
'use strict';

const MAX_ACTIEF = 25;
const MAX_INGETROKKEN = 500;

const vanLid = (bak, lidKey) => Object.entries(bak).filter(([, r]) => r && r.lidKey === String(lidKey));

/* Ruimt actieve bindingen van dit lid op tot er plek is voor `behoud`. */
function ruimActief(bak, lidKey, behoud) {
  const actief = vanLid(bak, lidKey)
    .filter(([k, r]) => k !== behoud && !r.ingetrokkenOp)
    .sort((a, b) => new Date(a[1].laatstBewezenOp || 0) - new Date(b[1].laatstBewezenOp || 0));
  const teveel = actief.length + 1 - MAX_ACTIEF;
  for (let i = 0; i < teveel; i++) delete bak[actief[i][0]];
}

/* Mag dit lid nog een NIEUW toestel binden? Nee als de intrekkingen vol zijn. */
const intrekkingenVol = (bak, lidKey) =>
  vanLid(bak, lidKey).filter(([, r]) => r.ingetrokkenOp).length >= MAX_INGETROKKEN;

module.exports = { MAX_ACTIEF, MAX_INGETROKKEN, ruimActief, intrekkingenVol };
