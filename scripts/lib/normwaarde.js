/* ============================================================================
   DE WAARDE VAN EEN RATEL KOMT UIT NORM.json, EN NERGENS ANDERS.

   Tot 6 oktober 2026 stonden er elf ratels als losse constante in een script of
   een toets: KAPOT_MAX in scripts/adressen.js, drie in scripts/check.js, een in
   scripts/lib/uitvoerproef.js en zes in test/. Ze deden wat een ratel doet --
   het getal mag alleen omlaag -- maar ze stonden buiten het ene register waar
   dit huis zijn latten bijhoudt. Daardoor gold voor hen niets van wat NORM.json
   wel bewaakt: scripts/normbasis.js zag een verhoging niet, scripts/normverval.js
   eiste geen notitie, en `npm run norm:vast` trok een verbetering niet strak. Een
   verhoging stond hooguit als commentaar boven de constante, en of dat
   commentaar er stond hing aan wie hem verhoogde.

   Het besluit van de eigenaar: elke ratel is een geijkte meter in NORM.json. De
   aanroeper houdt zijn eigen bewering en zijn eigen melding (die zegt het meest
   op de plek waar het misgaat), maar het GETAL leest hij hier. Zo is er een plek
   met de waarheid en een weg om hem te verzetten, en die weg heeft een slot.

   WAAROM HIJ GOOIT IN PLAATS VAN EEN STANDAARD TE GEVEN. Een ratel zonder
   waarde is geen ratel. Een terugval op nul zou elke toets laten zakken om een
   reden die niemand begrijpt; een terugval op Infinity zou hem stil uitzetten,
   en dat is erger (LAT.md regel 3: een meter zonder invoer zakt, en zegt
   waarom). Ontbreekt de sleutel, dan staat er dus welke sleutel en waar hij
   had moeten staan.

   Hij leest bij ELKE aanroep opnieuw en onthoudt niets: een toets die NORM.json
   tijdelijk verzet, hoort de verzette waarde te zien.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const NORMBESTAND = path.join(__dirname, '..', '..', 'NORM.json');

function normwaarde(sleutel, bestand) {
  const pad = bestand || NORMBESTAND;
  let norm;
  try { norm = JSON.parse(fs.readFileSync(pad, 'utf8')); }
  catch (e) { throw new Error('normwaarde(' + sleutel + '): ' + pad + ' is niet te lezen (' + e.message + ')'); }
  const meters = norm && norm.meters;
  if (!meters || !Object.prototype.hasOwnProperty.call(meters, sleutel)) {
    throw new Error('normwaarde(' + sleutel + '): deze ratel staat niet onder `meters` in NORM.json. ' +
      'Leg hem vast met npm run norm:vast (de meter staat in scripts/norm.js), en verzet hem nooit met een losse constante.');
  }
  const waarde = meters[sleutel];
  if (typeof waarde !== 'number' || !Number.isFinite(waarde)) {
    throw new Error('normwaarde(' + sleutel + '): NORM.json draagt ' + JSON.stringify(waarde) + ' en dat is geen getal');
  }
  return waarde;
}

module.exports = { normwaarde, NORMBESTAND };
