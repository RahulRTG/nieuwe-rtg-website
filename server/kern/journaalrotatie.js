/* HET WEGSCHUIVEN VAN HET JOURNAALBESTAND, en het begrenzen van de schijf.

   Apart van ./journaalbestand.js omdat het een eigen zaak is -- daar staat het
   verzamelen en wegschrijven, hier alleen wat er gebeurt als het actieve bestand
   vol is -- en omdat dat bestand anders over de omvangsgrens van de keuring gaat.

   Wordt alleen aangeroepen vanuit de spoeling, dus nooit vanaf het verzoekpad. */
'use strict';
const fs = require('fs');

function maakRotatie({ map, pad, klok, huidig, grensBytes, grensBestanden, meld }) {
  /* De geroteerde bestanden, nieuwste eerst. De naam is de tijd in ms, dus
     lexicografisch sorteren is chronologisch sorteren (13 cijfers, geen overgang
     binnen deze eeuw).

     De catch hier vangt een lege of ontbrekende map op -- en hij ving even ook
     een ReferenceError op `map`, toen deze functie hierheen verhuisde zonder dat
     `map` werd meegegeven. Uitkomst: geen enkel geroteerd bestand werd nog
     gezien, dus lezen miste de historie en opruimen deed niets. Stil, want een
     lege lijst ziet er precies zo uit als "er is nog niet geroteerd". Twee
     toetsen in test/journaalbestand.test.js vielen er meteen over. */
  function oudeBestanden() {
    try {
      return fs.readdirSync(map).filter(n => /^\d{13}\.log$/.test(n)).sort().reverse();
    } catch (e) { return []; }
  }

  /* EEN VERSE NAAM VOOR EEN GEROTEERD BESTAND, en die moet twee dingen doen:
     uniek zijn en oplopen.

     Hier stond kortweg `klok() + '.log'`. Roteren twee bestanden binnen dezelfde
     milliseconde, dan wijst die naam naar het bestand dat er al staat en gooit
     renameSync() het vorige er stilzwijgend overheen -- een heel journaalbestand
     weg, zonder fout. Ook dat is geen theorie: de rotatietoets viel er meteen over.

     De stempel loopt daarom altijd door: nooit lager dan de vorige, en nooit op
     een naam die al bestaat (een klok die terugloopt mag ook niets overschrijven).
     Dertien cijfers blijft dertien cijfers, dus lexicografisch sorteren blijft
     chronologisch sorteren. */
  let laatsteStempel = 0;
  function verseNaam() {
    let s = Math.max(klok(), laatsteStempel + 1);
    while (fs.existsSync(pad(s + '.log'))) s++;
    laatsteStempel = s;
    return s + '.log';
  }

  /* Het actieve bestand wegschuiven zodra het vol is, en de oudste opruimen. */
  function roteerIndienNodig() {
    let groot = 0;
    try { groot = fs.statSync(pad(huidig)).size; } catch (e) { return; }
    if (groot < grensBytes) return;
    try { fs.renameSync(pad(huidig), pad(verseNaam())); } catch (e) { meld(e); return; }
    for (const n of oudeBestanden().slice(grensBestanden)) {
      try { fs.unlinkSync(pad(n)); } catch (e) { /* al weg is ook goed */ }
    }
  }

  return { oudeBestanden, roteerIndienNodig };
}

module.exports = { maakRotatie };
