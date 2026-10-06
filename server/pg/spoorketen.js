/* De ketencontroles onder de requestmerge van de auditsporen (./verzoeksporen.js):
   wat er gebeurt als een keten gebroken is, en hoe een zegelketen van het
   command-journaal wordt nagerekend. Geknipt uit verzoeksporen.js op de 10 kB
   van keuringsregel 13. De zegelcontrole zelf woont in ../lib/zegelketen.js. */
'use strict';

const { zonder, commandHash, commandHeel } = require('../lib/zegelketen');

/* EEN GEBROKEN KETEN IS GEEN CONFLICT (audit P1-4). Hier stond voor allebei
   `conflict()`, en daarmee kreeg elke schrijfhandeling na een vervalsing een
   409 "laad opnieuw" -- een stille schrijfstoring zonder dat iemand hoorde dat
   het SPOOR stuk was. Opnieuw laden helpt bij een breuk niet: het spoor in de
   database is zelf ongeldig. Een eigen code (de route antwoordt 503 met de
   reden, db/opslagfout.js) en een melding aan de auditwacht, die het alarm
   laat afgaan. */
function gebroken(journaal, kant, tekst) {
  /* Het alarm mag de weigering nooit tegenhouden, maar faalt het melden, dan
     staat dat in het log: een wacht die stil omvalt, is precies wat hier wordt
     gerepareerd. De weigering zelf gaat altijd door. */
  try { require('../lib/auditwacht').meld(journaal, tekst, 'requestmerge/' + kant); }
  catch (x) { console.error('[auditwacht] melding mislukt:', x && x.message); }
  const e = new Error(tekst + ' Het auditspoor is gebroken; deze handeling wordt niet vastgelegd zolang dat zo is.');
  e.code = 'PG_AUDIT_KETEN_GEBROKEN';
  e.journaal = journaal;
  throw e;
}

module.exports = { gebroken, commandHash, commandHeel, zonder };
