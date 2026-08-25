/* Functieschakelaars (deelmodule): WELKE functie bewaakt dit pad.

   Apart van ./toegang.js omdat het een eigen vraag is -- daar staan de aan/uit-
   assen en de blokkadereden, hier alleen de pad-matching -- en omdat toegang.js
   anders over de omvangsgrens van de keuring gaat.

   Dit is toegangscode: geeft functieVoorPad() null terug, dan is het pad "niet
   door een functie bewaakt" en dus altijd vrij. test/toegangprefix.test.js zet
   de oude dubbele lus ernaast en vergelijkt de uitkomsten over elk geregistreerd
   pad plus een reeks gemene varianten. */
'use strict';
const { FUNCTIES } = require('./register');

function prefixLengte(pad, prefix) {
  if (!pad.startsWith(prefix)) return 0;
  const rest = pad.slice(prefix.length);
  return (rest === '' || rest[0] === '/') ? prefix.length : 0;
}

/* De meest specifieke functie die dit pad bewaakt (langste prefix wint), of null.

   Dit was een dubbele lus over de hele registratie, per verzoek: 191 functies
   met samen 329 paden. Een cache op het PAD kan hier niet -- er komt een echt
   pad binnen (/api/lid/42), dus die kaart groeit mee met het verkeer in plaats
   van met de registratie. Daarom de vergelijking omgedraaid: prefixLengte()
   matcht alleen op een SEGMENTGRENS, dus de enige prefixen die kunnen winnen
   zijn de voorouders van het pad zelf. De registratie wordt een keer een kaart;
   een verzoek loopt van lang naar kort, en de langste wint vanzelf.

   Bij twee functies op HETZELFDE pad wint de eerst geregistreerde -- de oude lus
   verving alleen bij `len > besteLen`. Vandaar `if (!kaart.has(p))`.
   test/toegangprefix.test.js vergelijkt beide over elk geregistreerd pad. */
let padKaart = null;
function bouwPadKaart() {
  const kaart = new Map();
  for (const f of FUNCTIES) for (const p of (f.paden || [])) if (!kaart.has(p)) kaart.set(p, f);
  padKaart = kaart;
  return kaart;
}
function functieVoorPad(pad) {
  const kaart = padKaart || bouwPadKaart();
  if (typeof pad !== 'string' || !pad) return null;
  /* Van het volledige pad terug naar '/': elke stap kapt een segment af. De
     eerste treffer is de langste, want we lopen van lang naar kort. */
  let eind = pad.length;
  while (eind > 0) {
    const f = kaart.get(pad.slice(0, eind));
    if (f) return f;
    eind = pad.lastIndexOf('/', eind - 1);
  }
  return null;
}

module.exports = { prefixLengte, functieVoorPad };
