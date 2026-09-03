/* HET BEWIJSPASPOORT -- draagt een register de omgeving waarin hij is gemeten?

   STANDAARD.md par. 5 stelt de eis: geen bewijs zonder omgevingsidentiteit. Dit
   bestand is daarvan de smalle, altijd-ware helft.

   WAAROM SMAL, EN WAAROM DEZE HELFT. De volle eis heeft twee kanten. De ene is
   "op wat voor MACHINE is dit gemeten", en die geldt alleen voor een meting die
   van de machine afhangt: een latentie wel, een telling van routes uit de bron
   niet. Een regel die van alle 25 registers een machine-vingerafdruk zou eisen,
   heeft dus vanaf de eerste dag valse gevallen -- en keuringsregel 50 legt uit
   wat dat kost: liever een smalle regel die altijd klopt dan een brede die
   niemand meer gelooft.

   De andere kant geldt WEL overal, en die staat hier: is de boom waaruit dit
   bewijs komt een COMMIT geweest? Zo niet, dan is de meting niet te herhalen --
   niet moeilijk te herhalen, maar principieel niet: er bestaat geen toestand om
   naar terug te keren. Zo'n uitslag mag bestaan (een tussenronde is nuttig),
   maar hij is geen bewijs.

   DAT IS GEEN THEORIE. Bij het schrijven hiervan droegen 18 van de 25 registers
   met een stempel `boomVuil: true`, waaronder VERTROUWEN.json -- het register
   waarop de bewijspoort van kern/stuur/beleid.js zijn oordeel baseert. De
   4180 verzwakte routes daarin komen dus van een boom die niet bestond.

   DE STEMPEL ZELF wordt gezet door scripts/lib/stempel.js; dit bestand leest
   hem alleen. Twee plekken lezen deze telling -- de meter in scripts/norm.js en
   de deltapoort -- en allebei roepen ze deze functie aan in plaats van zelf te
   tellen, want de deltapoort eist dat een regel telt met dezelfde functie als
   de meter die hij dient (LAT.md regel 4). */
'use strict';
const fs = require('fs');
const path = require('path');

/* Draagt DEZE inhoud een meting uit een vuile boom?

   De invoer is tekst en geen pad, zodat test/meterijk.test.js hem een verzonnen
   register kan voeden en de meter echt kan zien uitslaan. Een meter die alleen
   zijn eigen wortel kan lezen, is niet te ijken.

   Onleesbaar of vormloos telt NIET mee. Dat is met opzet: dit bestand meet een
   eigenschap van bewijs en niet of json geldig is -- daar is de meter voor die
   dat wel doet. Een tweede meter die stilletjes over kapotte bestanden oordeelt,
   maakt de uitslag van allebei onleesbaar. */
function uitVuileBoom(bron) {
  let j;
  try { j = JSON.parse(bron); } catch (e) { return false; }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return false;
  return !!(j.stempel && j.stempel.boomVuil === true);
}

/* Alle registers in de wortel die hun meting uit een vuile boom halen.

   Gesorteerd, zodat twee rondes op dezelfde stand dezelfde lijst geven en een
   verschil dus een verschil is en geen volgorde. */
function vuileRegisters(wortel) {
  let namen;
  try { namen = fs.readdirSync(wortel); } catch (e) { return []; }
  return namen
    .filter(n => n.endsWith('.json'))
    .filter(n => {
      let bron;
      try { bron = fs.readFileSync(path.join(wortel, n), 'utf8'); } catch (e) { return false; }
      return uitVuileBoom(bron);
    })
    .sort();
}

module.exports = { uitVuileBoom, vuileRegisters };
