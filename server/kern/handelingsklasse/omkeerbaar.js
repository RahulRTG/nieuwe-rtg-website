/* IS DIT TERUG TE DRAAIEN, EN HOE? -- alleen wat werkelijk beproefd is.

   Dit is de omkeerbaarheidskant van ../handelingsklasse.js (TAKEN.md 4.71).
   De bron is HERSTELPROEF.json: 90 routeparen die ECHT zijn uitgevoerd (heen,
   kijken, terug, kijken) met de inhoud van de opslag vergeleken. Dat is de enige
   gemeten uitspraak over omkeerbaarheid die dit huis heeft, en er komt hier geen
   tweede bij die uit een naam of een methode wordt geraden -- HERSTEL.json heeft
   al gemeten dat een naam daar niets over zegt (/agenda/bewaar is geen omkering
   van /verwijder).

   NIET BEPROEFD IS NIET ONOMKEERBAAR, en dat onderscheid is de hele opbrengst
   van deze kant. `onbekend` betekent dat de proef er niet bij kwam; het betekent
   niet dat de handeling vaststaat. Ze samenvatten zou van 4685 routes zeggen dat
   ze onomkeerbaar zijn, en dat heeft niemand gemeten.

   EN DE TERUGWEG DRAAGT DE UITSLAG NIET. Die is het gereedschap waarmee gemeten
   is, niet het onderwerp: /api/agenda/verwijder omkeerbaar noemen omdat hij iets
   anders omkeert, is een uitspraak over het verkeerde pad.
   ========================================================================== */
'use strict';

const path = require('path');
/* `onbekend` komt uit ./risico.js en wordt hier niet opnieuw gedefinieerd. Het
   is EEN woord met EEN betekenis -- "geen bron gevonden" -- en twee definities
   van hetzelfde woord in twee buurbestanden is precies waar SEMANTIEK.json vol
   mee staat. */
const { ONBEKEND } = require('./risico');

/* De uitslagen van de herstelproef, letterlijk zoals HERSTELPROEF.json ze
   schrijft. Geen eigen woorden: een tweede vocabulaire over dezelfde meting is
   precies waar SEMANTIEK.json vol mee staat. */
const HERSTEL = Object.freeze(['exact', 'compensatie', 'geen-herstel']);

function leesHerstel(wortel) {
  try {
    const rel = path.join(wortel || path.join(__dirname, '..', '..', '..'), 'HERSTELPROEF.json');
    const reg = JSON.parse(require('fs').readFileSync(rel, 'utf8'));
    const kaart = new Map();
    for (const p of (reg.per || [])) {
      if (!p || !p.heen || !HERSTEL.includes(p.uitslag)) continue;
      /* De HEENweg draagt de uitslag. De terugweg is het gereedschap waarmee
         hij is gemeten en niet zelf het onderwerp -- die als omkeerbaar
         bestempelen zou zeggen dat /api/agenda/verwijder omkeerbaar is omdat
         hij iets anders omkeert. */
      kaart.set(p.heen, { klasse: p.uitslag, terug: p.terug || null, reden: p.reden || null });
    }
    return kaart;
  } catch (e) { return null; }
}

function maakOmkeerbaar(herstel) {
  function omkeerbaarVan(pad) {
    const p = String(pad || '');
    if (!herstel) {
      return { klasse: ONBEKEND, graad: 'onbekend', bron: null,
        reden: 'HERSTELPROEF.json is niet te lezen; zonder die meting is hier niets over te zeggen' };
    }
    const r = herstel.get(p);
    if (r) {
      return { klasse: r.klasse, graad: 'gemeten', bron: 'HERSTELPROEF.json',
        terug: r.terug, reden: r.reden };
    }
    return { klasse: ONBEKEND, graad: 'onbekend', bron: 'HERSTELPROEF.json',
      reden: 'dit pad zit niet in de ' + herstel.size + ' beproefde paren; niet beproefd is ' +
        'iets anders dan onomkeerbaar' };
  }

  return { omkeerbaarVan };
}

module.exports = { maakOmkeerbaar, leesHerstel, HERSTEL };
