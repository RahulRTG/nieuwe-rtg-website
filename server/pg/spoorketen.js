/* De ketencontroles onder de requestmerge van de auditsporen (./verzoeksporen.js):
   wat er gebeurt als een keten gebroken is, en hoe een zegelketen van het
   command-journaal wordt nagerekend. Geknipt uit verzoeksporen.js op de 10 kB
   van keuringsregel 13; de auditwacht (lib/auditwacht.js) leest commandHeel ook. */
'use strict';

const crypto = require('node:crypto');

function zonder(regel, velden) {
  const uit = { ...(regel || {}) };
  for (const veld of velden) delete uit[veld];
  return uit;
}

/* EEN GEBROKEN KETEN IS GEEN CONFLICT (audit P1-4). Hier stond voor allebei
   `conflict()`, en daarmee kreeg elke schrijfhandeling na een vervalsing een
   409 "laad opnieuw" -- een stille schrijfstoring zonder dat iemand hoorde dat
   het SPOOR stuk was. Opnieuw laden helpt bij een breuk niet: het spoor in de
   database is zelf ongeldig. Een eigen code (de route antwoordt 503 met de
   reden, db/opslagfout.js) en een melding aan de auditwacht, die het alarm
   laat afgaan. */
function gebroken(journaal, kant, tekst) {
  try { require('../lib/auditwacht').meld(journaal, tekst, 'requestmerge/' + kant); } catch (x) {}
  const e = new Error(tekst + ' Het auditspoor is gebroken; deze handeling wordt niet vastgelegd zolang dat zo is.');
  e.code = 'PG_AUDIT_KETEN_GEBROKEN';
  e.journaal = journaal;
  throw e;
}

function commandHash(regel) {
  return crypto.createHash('sha256').update(JSON.stringify(regel)).digest('hex').slice(0, 32);
}

function commandHeel(lijst) {
  const l = Array.isArray(lijst) ? lijst : [];
  for (let i = 0; i < l.length; i++) {
    const r = l[i];
    if (!r || !r.id || !r.zegel) return false;
    const kern = zonder(r, ['zegel']);
    if (commandHash(kern) !== r.zegel) return false;
    if (i > 0 && r.vorig !== l[i - 1].zegel) return false;
  }
  return true;
}

module.exports = { gebroken, commandHash, commandHeel, zonder };
