/* WAAROM DE CAPABILITY-GRAAF UIT EEN KAS KOMT.

   magnaat-capabilities.scan() leest de app-schermen en alle serverbronnen,
   bouwt daar een capability-graaf uit op, en kostte daarmee ruim 800 ms bij elke
   serverstart (455 ms in de scanner zelf plus 391 ms in de dekkingsmatrix). De
   toetssuite start 647 servers. De uitkomst hangt uitsluitend af van die
   bestanden, van de functievlaggen en van de code van de scanners zelf.

   Dus zit hij in server/lib/bronkas.js, met een sleutel over de INHOUD daarvan.
   Wat er in die sleutel MOET zitten, en waarom elk deel:

   - de app-schermen en de serverbronnen: dat is wat er gescand wordt
   - de broncode van de scanners zelf: verandert de manier van scannen zonder
     dat de gescande bestanden veranderen, dan zou een oude graaf blijven passen
     bij een nieuwe scanner
   - de functievlaggen en de werkprocessen ALS TEKST: die komen als parameter
     binnen en niet van schijf. Vergeet je ze, dan blijft een oude graaf geldig
     nadat er een functievlag bij is gekomen -- de bestanden zijn immers niet
     veranderd, en dat is precies het soort stille fout waar een cache om
     berucht is.
   - DE MOTORSTAND UIT DE OMGEVING, en die ben ik in de eerste versie vergeten.
     magnaat-capabilities-bronnen.js leest vijf variabelen (de stand, het pad
     naar de binary, het canary-percentage, de canary-sleutel en de globale
     noodstop) en die bepalen mede of de graaf 'javascript' of 'rust' als bron
     noemt. Zonder die vijf in de sleutel gaf een omgeschakelde motorstand de
     OUDE graaf terug: test/magnaat-capabilities.test.js verwachtte 'rust' en
     kreeg 'javascript'. Ik had de waarschuwing hierboven zelf opgeschreven en
     maakte er meteen daaronder hetzelfde geval van.
   - DE BINARY ZELF, om dezelfde reden. Hij staat buiten de gescande mappen,
     dus geen enkel manifest ziet hem; toch verandert de uitkomst als hij
     verandert (de pariteitsproef draait er echt tegenaan). Hij gaat als
     bestandshash mee.

   Deze laag staat los van de scanner omdat het twee dingen zijn: WAT er gemeten
   wordt, en WANNEER dat opnieuw moet. En omdat magnaat-capabilities.js anders
   over de 10 kB-grens van de keuring gaat.

   Handhaver: test/bronkas.test.js voor het mechanisme, en de graaf zelf komt
   langs test/magnaat-capabilities.test.js. */
'use strict';
const path = require('path');

/* De omgevingsvariabelen die de motorstand bepalen; gelijk te houden aan wat
   magnaat-capabilities-bronnen.js leest. test/bronkas.test.js loopt die bron af
   en eist dat elke gelezen RTG_-variabele hier staat. */
const MOTORVLAGGEN = ['RTG_CAPABILITY_RUST_MODE', 'RTG_CAPABILITY_RUST_BIN',
  'RTG_CAPABILITY_RUST_CANARY_PCT', 'RTG_CAPABILITY_RUST_CANARY_KEY', 'RTG_RUST_ALLES_UIT'];

function viaKas({ root, functies, volledigeWerkprocessen, werkrouteFabriek }, bereken) {
  const kas = require('../lib/bronkas');
  const kern = __dirname;
  const sleutel = kas.sleutelUit([
    kas.manifestVan(path.join(root, 'public', 'apps'), (p) => p.endsWith('.html'), 'cap-apps'),
    kas.manifestVan(path.join(root, 'server'), (p) => p.endsWith('.js'), 'cap-server'),
    kas.leesVersie([
      path.join(kern, 'magnaat-capabilities.js'),
      path.join(kern, 'magnaat-capabilities-bronnen.js'),
      path.join(kern, 'magnaat-dekkingsmatrix.js'),
      path.join(kern, 'magnaat-kantoorregels.js'),
      path.join(kern, 'magnaat-werkroutefabriek.js')
    ]),
    JSON.stringify(Array.isArray(functies && functies.FUNCTIES) ? functies.FUNCTIES : []),
    JSON.stringify(volledigeWerkprocessen || []),
    typeof werkrouteFabriek === 'function' ? 'fabriek' : 'geen',
    /* De motorstand uit de omgeving. Deze vijf staan met naam in
       magnaat-capabilities-bronnen.js; wie er daar een bijzet, zet hem hier bij
       (test/bronkas.test.js houdt dat vast). Als LIJST en niet als process.env
       in zijn geheel: dan zou elke willekeurige variabele de kas ongeldig maken
       en is er geen kas meer. */
    MOTORVLAGGEN.map(n => n + '=' + (process.env[n] === undefined ? '' : process.env[n])).join('|'),
    /* En de binary waar die stand naar wijst: die ligt buiten de gescande
       mappen, dus geen manifest ziet hem. */
    process.env.RTG_CAPABILITY_RUST_BIN ? kas.leesVersie([process.env.RTG_CAPABILITY_RUST_BIN]) : 'geen-binary'
  ]);
  return kas.geheugen({
    naam: 'capability-graaf', sleutel, bereken,
    naarTekst: (g) => JSON.stringify(g),
    /* Een graaf die geen object is, is geen graaf: dan rekent de kas opnieuw.
       De gaafheid van het BESTAND bewaakt de kas zelf met een sha op de
       eerste regel; dit gaat alleen over de vorm van de inhoud. */
    vanTekst: (t) => { const g = JSON.parse(t); return (g && typeof g === 'object') ? g : null; }
  });
}

module.exports = { viaKas, MOTORVLAGGEN };
