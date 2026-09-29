/* HET IDEM-REGISTER, deel leerhuis (RTG Academy) -- zelfde register, eigen bestand.

   Drie routes, drie vormen:
     - `lees` verandert niets: de kern leest met kijk() en schept geen collectie.
     - `doe` draagt een VERPLICHTE sleutel en de kern is daarop idempotent: een
       tweede oproep met dezelfde sleutel schrijft niets en geeft het eerste
       antwoord terug. De poort hoeft er dus niets te dedupliceren buiten die
       sleutel om; `velden` zegt welke velden de handeling identificeren.
     - `open` kan per organisatie precies een keer slagen (409 daarna), en de
       route geeft zelf een vaste sleutel mee. */
'use strict';

const STAND = 'de kern vergelijkt met de huidige stand en ontdubbelt daarop zelf; een bewaard antwoord zou een stand van eerder teruggeven';

const SLEUTELS = {
  'POST /api/leerhuis/lees': { leest: true },
  'POST /api/leerhuis/doe': { velden: ['org', 'actie', 'sleutel'] },
  'POST /api/office/leerhuis/open': { velden: ['id'] },
  /* Besluit B2b, de bron van een RTF-stad (kern/rtfos/vrijwilligeraccount.js).
     Alle drie ontdubbelt de KERN op de stand van dat moment: koppelen aan
     hetzelfde account geeft `al: true`, en loskoppelen van wat al los is doet
     niets. Een bewaard eerste antwoord is hier fout en geen vangnet: wie
     koppelt, door de coordinator wordt losgemaakt en binnen het venster
     opnieuw koppelt, kreeg "gekoppeld" terug zonder dat er iets gebeurde
     (test/leerhuis-rtfbron.test.js toets 6 vond het). */
  'POST /api/rtfos/portaal/vrijwilliger/koppel': { nietIdempotent: true, waarom: STAND },
  'POST /api/rtfos/portaal/vrijwilliger/ontkoppel': { nietIdempotent: true, waarom: STAND },
  'POST /api/rtfos/vrijwilliger/account-los': { nietIdempotent: true, waarom: STAND }
};

module.exports = { SLEUTELS };
