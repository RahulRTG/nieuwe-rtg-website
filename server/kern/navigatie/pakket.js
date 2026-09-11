/* WAAR EEN KAARTPAKKET LIGT -- en of die naam wel een bestandsnaam mag worden.

   Dit stond in ./gebieden.js en is eruit gehaald omdat het iets anders doet:
   gebieden.js beantwoordt "wat biedt RTG aan", dit bestand beantwoordt "welk
   pad hoort bij deze code, en mag die code uberhaupt een pad worden". Dat
   tweede is een GRENS en geen hulpfunctie; hij verdient zijn eigen plek en
   zijn eigen kop.

   Een pakket is twee dingen naast elkaar: de SQLite met de r-tree-indexen en
   een map met de binaire graaf. Beide namen komen uit de CODE van het gebied
   en niet uit een vaste tekst -- er stond `nederland-graaf` hardgecodeerd, en
   dat werkt zolang er een gebied is: een tweede pakket in dezelfde map zou de
   graaf van Nederland inlezen en er een Franse route op rekenen. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const dataMap = () => process.env.RTG_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const navMap = () => path.join(dataMap(), 'navigatie');
/* De index die het importscript wegschrijft uit de bronindex. Buiten Git: het
   is invoer voor een meting en geen bron (zelfde regel als het routejournaal). */
const indexPad = () => path.join(navMap(), 'gebieden.json');

/* EEN GEBIEDSCODE WORDT EEN BESTANDSNAAM, DUS HIJ IS STRENG. Dit is geen
   voorzorg maar een reparatie: de code kwam uit een index die van BUITEN wordt
   opgehaald, en `pakketVan('../../../etc/passwd')` gaf gewoon
   `./etc/passwd.sqlite` terug -- de datamap uit. En het is niet eens een
   kwaadwillend geval: de bronindex draagt ids MET schuine strepen
   (`europe/netherlands`), dus het gewone geval maakte al stilletjes submappen
   aan waar `pakketLigt()` nooit meer keek.

   Alleen kleine letters, cijfers en koppeltekens, niet beginnend of eindigend
   op een koppelteken. Geen punt (dus geen `..`), geen streep, geen scheidingsteken.
   Wie een pad wil samenstellen uit iets van buiten, hoort het eerst te laten
   afkeuren; het VERTALEN van een bron-id naar een veilige code doet de
   indexschrijver, want alleen die kan een botsing zien. */
const VEILIG = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const codeVeilig = (code) => VEILIG.test(String(code || ''));

/* Een onveilige code levert `null` en geen pad. Fail closed: een pad
   teruggeven dat "toch wel klopt" is precies hoe zo'n gat blijft bestaan. */
function pakketVan(code) {
  const c = String(code || '').toLowerCase();
  if (!codeVeilig(c)) return null;
  return { code: c, db: path.join(navMap(), c + '.sqlite'),
    graafMap: path.join(navMap(), c + '-graaf') };
}
const pakketLigt = (code) => {
  const p = pakketVan(code);
  if (!p) return false;
  try { return fs.existsSync(p.db) && fs.existsSync(path.join(p.graafMap, 'graaf.json')); }
  catch (e) { return false; }
};

module.exports = { pakketVan, pakketLigt, codeVeilig, indexPad, navMap };
