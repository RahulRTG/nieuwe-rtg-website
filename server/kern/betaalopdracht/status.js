/* De monotone statustrap van een betaalopdracht. Een onbekende of teruggaande
   overgang wordt geweigerd: intern geboekt en extern ontvangen zijn twee
   verschillende waarheden. */
'use strict';

const STATUS = { GEBOEKT: 'GEBOEKT', INGEDIEND: 'INGEDIEND', AFGEWIKKELD: 'AFGEWIKKELD',
  MISLUKT: 'MISLUKT', TERUGGEBOEKT: 'TERUGGEBOEKT' };
const OVERGANG = {
  GEBOEKT: ['INGEDIEND', 'AFGEWIKKELD', 'MISLUKT'],
  INGEDIEND: ['AFGEWIKKELD', 'MISLUKT'],
  AFGEWIKKELD: [],
  MISLUKT: ['TERUGGEBOEKT', 'INGEDIEND'],
  TERUGGEBOEKT: []
};
const AF = new Set([STATUS.AFGEWIKKELD, STATUS.TERUGGEBOEKT]);
const OPEN = new Set([STATUS.GEBOEKT, STATUS.INGEDIEND, STATUS.MISLUKT]);
const DEFINITIEF = new Set(['betaald', 'succeeded', 'paid', 'settled', 'afgewikkeld']);
const BACKOFF_MS = [30000, 120000, 600000, 1800000, 3600000];
const MAX_POGINGEN = 6;
const RAM_MAX = 50000;

/* Reconciliation projection: intern geboekt, extern nog niet definitief en
   rail-finalisaties die na een crash nog op hun runtime-hook wachten. */
function maakOpenstaandOverzicht(rij) {
  const uit = { status: 200, aantal: 0, centen: 0, perStatus: {}, oudsteAt: null,
    mislukt: 0, mislukteCenten: 0, zonderTerugboeking: 0, zonderAfwikkeling: 0 };
  for (const o of rij) {
    uit.perStatus[o.status] = (uit.perStatus[o.status] || 0) + 1;
    if (o.status === STATUS.AFGEWIKKELD && o.afwikkelingNodig && !o.afwikkelingVerwerktAt)
      uit.zonderAfwikkeling++;
    if (!OPEN.has(o.status)) continue;
    uit.aantal++; uit.centen += o.centen;
    if (uit.oudsteAt === null || o.at < uit.oudsteAt) uit.oudsteAt = o.at;
    if (o.status === STATUS.MISLUKT) {
      uit.mislukt++; uit.mislukteCenten += o.centen;
      if (o.terugboekFout) uit.zonderTerugboeking++;
    }
  }
  return uit;
}

module.exports = { STATUS, OVERGANG, AF, OPEN, DEFINITIEF, BACKOFF_MS,
  MAX_POGINGEN, RAM_MAX, maakOpenstaandOverzicht };
