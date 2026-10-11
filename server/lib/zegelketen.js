/* De zegelketen van het command-journaal (kern/command/journaal.js) en het
   API-spoor nagerekend: elke regel draagt de zegel van de vorige (`vorig`) en
   van zichzelf (`zegel`). Een plek voor de requestmerge (pg/verzoeksporen.js)
   en de auditwacht (./auditwacht.js), zodat beide hetzelfde "heel" bedoelen. */
'use strict';

const crypto = require('node:crypto');

function zonder(regel, velden) {
  const uit = { ...(regel || {}) };
  for (const veld of velden) delete uit[veld];
  return uit;
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

module.exports = { zonder, commandHash, commandHeel };
