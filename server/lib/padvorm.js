/* Een padpatroon met parameters op VORM matchen: elk :segment staat voor
   precies een echt segment. /api/gezin/:code/mij matcht /api/gezin/ABC123/mij
   en niet /api/gezin/A/B/mij.

   Op een plek, want er zijn twee afnemers met precies dezelfde vraag: de
   liegpoort (server/opzet/liegpoort.js, liegen over een parameterroute) en de
   schorspoort (server/middleware/schorspoort.js, een geschorste parameterroute
   dichthouden). Twee kopieen van dezelfde vertaling zouden binnen een week
   uiteenlopen (LAT.md regel 4), en deze vertaling is al een keer de oorzaak
   van 33 valse metingen geweest -- juist hier telt een waarheid. */
'use strict';

/* Geeft een RegExp voor een patroon MET parameters, en null voor een patroon
   zonder: de aanroeper kiest dan zijn eigen letterlijke vergelijking (de
   liegpoort een voorvoegsel, de schorspoort een gelijkheid). */
function segmentPatroon(patroon) {
  const p = String(patroon || '');
  if (!p.includes('/:')) return null;
  return new RegExp('^' + p.split('/').map(s =>
    s.startsWith(':') ? '[^/]+' : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/') + '$');
}

module.exports = { segmentPatroon };
