/* ============================================================================
   DE RIJ-TELLING ONDER DE HANDELING.

   Dit stond in ./handeling.js. Die laag doet twee dingen: hij MEET wat er
   veranderde en hij HANGT dat om een verzoek (de context, de haak, de melding,
   sinds kort de classificatie). Dit bestand is de eerste helft, en de kop
   eronder is met de code meeverhuisd -- een reden die achterblijft bij een
   bestand dat de code niet meer draagt, leest niemand meer.

   WAT ER GEMETEN WORDT, en waarom juist dat. Per top-level collectie in db.data
   het AANTAL RIJEN, bij het begin en aan het eind. Het verschil is de
   handeling: `+1 boekingen` bij een normale reservering, `-4280 medewerkers` bij
   een massaverwijdering. Dat tweede getal is precies waar een blast-radius-grens
   op hoort te staan, en het is er nu.

   WAT DEZE METING NIET ZIET, en dat hoort er hard bij te staan:

   - EEN WIJZIGING BINNEN EEN RIJ. Vierduizend medewerkers op non-actief zetten
     verandert geen rij-aantal en is hier onzichtbaar: de grootste blinde vlek,
     bewust geaccepteerd, want het alternatief is een diep diff over de hele
     database bij elk verzoek. Wie die klasse wil vangen, laat de handeling zelf
     zeggen wat hij aanraakt -- daar is `raakt()` voor. De drie zwaarste roepen
     hem aan (loonrun, weekrooster, ledenbord); al het andere valt nog steeds in
     deze vlek, en dat staat er zo.
   - VERVANGING MET GELIJK AANTAL. Vijf rijen weg en vijf erbij is delta nul.
   - WAT ER NIET DOOR EEN VERZOEK KOMT. Een cronjob, de onderhoudsveger of een
     migratie draait buiten deze context; die zijn hier onzichtbaar en horen dat
     ook te zijn -- een actor die geen verzoek is, is een andere vraag.

   WAT HET KOST, gemeten en niet geschat. Op een db.data met 450 top-level
   sleutels (300 arrays) duurt een telling 60 microseconden; twee per verzoek plus
   het verschil is ~0,13 ms. De lat in BEPROEVING.json staat op p50 13 ms, dus dat
   is ongeveer een procent van een mediaan verzoek. Een snellere vorm (twee losse
   arrays in plaats van een Map) scheelde 14 microseconden -- een tiende procent
   van p50 -- en dat is hier de leesbaarheid niet waard.
   ========================================================================== */
'use strict';

/* Alleen top-level arrays tellen. Een object of een getal in db.data is geen
   collectie met rijen, en meetellen zou het getal betekenisloos maken. */
function tel(data) {
  const uit = new Map();
  if (!data || typeof data !== 'object') return uit;
  for (const sleutel of Object.keys(data)) {
    const v = data[sleutel];
    if (Array.isArray(v)) uit.set(sleutel, v.length);
  }
  return uit;
}

/* Het verschil tussen twee tellingen. Een collectie die nieuw is telt als groei
   vanaf nul; een die verdwenen is als krimp naar nul -- allebei zijn het echte
   gebeurtenissen en geen meetruis. */
function verschil(voor, na) {
  const wijzigingen = [];
  const sleutels = new Set([...voor.keys(), ...na.keys()]);
  for (const s of sleutels) {
    const van = voor.has(s) ? voor.get(s) : 0;
    const naar = na.has(s) ? na.get(s) : 0;
    if (van !== naar) wijzigingen.push({ collectie: s, van, naar, delta: naar - van });
  }
  // grootste beweging eerst: wie dit leest wil weten wat er het meest gebeurde
  wijzigingen.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return wijzigingen;
}

module.exports = { tel, verschil };
