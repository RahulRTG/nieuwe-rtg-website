/* ============================================================================
   DE VIJF DUBBELTIKKEN -- en de eis dat "geen tweede effect" niet genoeg is.

   server/lib/idemsleutels-afleidrest.js verklaart vijf routes als `zelfdeVerzoek`
   omdat de idemproef ze GEMETEN onbeschermd vond: "een woordelijk gelijke
   herhaling ZONDER sleutel deed het werk opnieuw -- dit is de dubbeltik".

   EEN CONTRACT OVER EEN REPARATIE DIE ALLEEN OP PAPIER BESTAAT IS ERGER DAN GEEN
   CONTRACT, dus deze toets leest de VERSE meting terug en eist per route vier
   dingen tegelijk. De eerste twee zijn de gewone vraag; de laatste twee zijn de
   reden dat deze toets bestaat.

     1. de tweede kale oproep liet NIETS achter in de opslag
     2. de proef noemt de route `beschermd`
     3. de grond is `gemerkt` en niet `gelijk`
     4. de tweede oproep gaf dezelfde STATUS als de eerste

   WAAROM 3 DE SCHERPSTE IS. scripts/lib/idemproef.js kent twee gronden voor
   `beschermd`. `gelijk` betekent: het antwoord was toevallig hetzelfde. `gemerkt`
   betekent: de server heeft de herhaling zelf onderschept en `herhaald: true`
   teruggegeven -- en server/lib/idem-poort.js:133 doet dan letterlijk
   `res.status(eerder.status).json(herhaal(eerder.lijf))`, dus het OPGESLAGEN
   ORIGINELE antwoord. Alleen die grond bewijst dat de aanroeper antwoord R
   terugkrijgt en niet een leeg antwoord, een fout of een tweede id.

   Een poort die het tweede effect voorkomt maar daarna iets anders teruggeeft, is
   operationeel nog steeds stuk. Punt 3 en 4 zijn wat dat verschil vasthoudt.

   EN DE POORT BEWAART ALLEEN EEN GESLAAGD ANTWOORD (2xx en niet `ok:false`, zie
   de kop van idem-poort.js regel 65), dus `gemerkt` kan nooit een fout herhalen.
   ========================================================================== */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const register = JSON.parse(fs.readFileSync(path.join(WORTEL, 'IDEMPROEF.json'), 'utf8'));
const VERKLAARD = require('../server/lib/idemsleutels-afleidrest').SLEUTELS;

const rij = (route) => (register.perRoute || []).find(
  (x) => ((x.methode || 'POST').toUpperCase() + ' ' + x.pad) === route);

test('de vijf verklaringen slaan op routes die de proef kent', () => {
  for (const route of Object.keys(VERKLAARD)) {
    assert.ok(rij(route), route + ' staat niet in IDEMPROEF.json -- een verklaring over een route die ' +
      'de proef niet heeft aangeroepen, is een bewering zonder meting');
  }
});

test('elke verklaring is `zelfdeVerzoek` -- geen andere vorm sloop hier binnen', () => {
  for (const [route, v] of Object.entries(VERKLAARD)) {
    assert.deepStrictEqual(Object.keys(v), ['zelfdeVerzoek'], route);
    assert.strictEqual(v.zelfdeVerzoek, true, route);
  }
});

for (const route of Object.keys(VERKLAARD)) {
  test('de dubbeltik op ' + route + ' wordt onderschept EN geeft hetzelfde antwoord', () => {
    const r = rij(route);
    const z = (r && r.zonderSleutel) || {};

    /* 1. geen tweede effect. `e` is de TWEEDE kale oproep; `d` de eerste. */
    const tweede = (z.opslag && z.opslag.e) || {};
    assert.deepStrictEqual(tweede, {},
      'de tweede kale oproep veranderde nog steeds iets in de opslag (' + JSON.stringify(tweede) +
      '). De verklaring in idemsleutels-afleidrest.js heeft de dubbeltik dus niet gedicht.');

    /* 2. de proef noemt hem beschermd. */
    assert.strictEqual(z.stand, 'beschermd',
      'de proef zegt "' + z.stand + '" (' + (z.reden || 'zonder reden') + ')');

    /* 3. EN DE GROND IS `gemerkt`. Zie de kop: `gelijk` zou betekenen dat het
       antwoord toevallig hetzelfde was, en dat bewijst niet dat de aanroeper het
       OORSPRONKELIJKE antwoord terugkreeg. */
    assert.strictEqual(z.grond, 'gemerkt',
      'beschermd op grond van "' + z.grond + '" en niet "gemerkt": de idem-poort heeft de herhaling ' +
      'dan niet zelf onderschept, dus er is geen bewijs dat antwoord R wordt herhaald in plaats van ' +
      'opnieuw berekend');

    /* 4. dezelfde status terug. De poort herhaalt de opgeslagen status; wijkt
       die af, dan kreeg de aanroeper een ander verhaal dan de eerste keer. */
    const st = z.statussen || [];
    assert.strictEqual(st.length, 2, 'twee kale oproepen verwacht, gemeten: ' + JSON.stringify(st));
    assert.strictEqual(st[1], st[0],
      'de tweede oproep gaf status ' + st[1] + ' waar de eerste ' + st[0] + ' gaf -- een poort die het ' +
      'effect tegenhoudt maar een ander antwoord teruggeeft, is operationeel nog steeds stuk');
  });
}
