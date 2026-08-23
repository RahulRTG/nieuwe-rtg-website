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

   Deze laag staat los van de scanner omdat het twee dingen zijn: WAT er gemeten
   wordt, en WANNEER dat opnieuw moet. En omdat magnaat-capabilities.js anders
   over de 10 kB-grens van de keuring gaat.

   Handhaver: test/bronkas.test.js voor het mechanisme, en de graaf zelf komt
   langs test/magnaat-capabilities.test.js. */
'use strict';
const path = require('path');

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
    typeof werkrouteFabriek === 'function' ? 'fabriek' : 'geen'
  ]);
  return kas.geheugen({
    wortel: root, naam: 'capability-graaf', sleutel, bereken,
    naarTekst: (g) => JSON.stringify(g),
    /* Een graaf die geen object is, is geen graaf: dan rekent de kas opnieuw.
       De gaafheid van het BESTAND bewaakt de kas zelf met een sha op de
       eerste regel; dit gaat alleen over de vorm van de inhoud. */
    vanTekst: (t) => { const g = JSON.parse(t); return (g && typeof g === 'object') ? g : null; }
  });
}

module.exports = { viaKas };
