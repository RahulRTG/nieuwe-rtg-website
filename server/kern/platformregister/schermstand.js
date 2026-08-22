/* Het platformregister (deelmodule): DE SCHERMWAARNEMING.

   Eigen bestand omdat server/routes/office/register.js met dit blok erin in de
   waarschuwingsband van keuringsregel 13 kwam. Het is ook een eigen vraag: de
   rest van register.js hangt bronnen aan elkaar, dit beantwoordt "wat weten we
   van de schermen, en heeft die ronde uberhaupt gedraaid".

   HET NEEMT DE SCHERMMETER MEE in plaats van hem zelf te laden, zodat een toets
   hem kan voeden zonder een journaal op schijf te zetten. */
'use strict';
const path = require('path');

/* De schermmeter leest het journaal van de laatste e2e-ronde. Ligt dat er niet,
   dan is de schermstatus ONBEKEND en zeggen we dat -- een scherm stil op
   "nooit geopend" zetten omdat het journaal ontbreekt, is een meting verzinnen
   (LAT.md regel 3). */
function schermRecords(schermenMeter, sam, wortel, gids) {
  let schermen = [];
  try { schermen = schermenMeter.alleSchermen(); } catch (e) { return []; }

  /* geopendeSchermen() NEEMT EEN PAD en geeft {afgelegd, neven} terug. Zonder
     pad leest hij undefined, geeft netjes null, en dan kwamen alle 260 schermen
     als "nooit geopend" uit dit register -- een meting verzonnen uit een
     ontbrekend bestand. Het journaal heet .schermjournaal en wordt door
     `npm run e2e` geschreven, niet door de gewone suite. */
  let waarneming = null;
  try {
    const journaalPad = path.join(wortel, '.schermjournaal');
    const w = schermenMeter.geopendeSchermen(journaalPad);
    if (w && w.afgelegd) {
      /* HEEFT DIE RONDE GEDRAAID. Een journaal dat er ligt is nog geen ronde die
         is afgelopen: viel de browser om, dan staan er wel TOETS-regels en geen
         enkele SCHERM-regel, en dat leest als 262 nooit geopende schermen.
         rondeVerslag() geeft `af: false` met de reden, en dan is de schermstatus
         ONGEMETEN -- een uitspraak over ons, niet over de app (LAT.md regel 12). */
      const ronde = schermenMeter.rondeVerslag(journaalPad);
      waarneming = { afgelegd: w.afgelegd, neven: w.neven,
        af: ronde ? ronde.af : true, reden: ronde ? ronde.reden : null,
        vegers: schermenMeter.veegToetsen(w.afgelegd, schermen.length) };
    }
  } catch (e) { waarneming = null; }
  return sam.schermRecords(schermen, gids || {}, waarneming);
}

module.exports = { schermRecords };
