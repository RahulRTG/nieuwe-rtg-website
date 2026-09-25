/* De monotone statustrap van een betaalopdracht. Een onbekende of teruggaande
   overgang wordt geweigerd: intern geboekt en extern ontvangen zijn twee
   verschillende waarheden.

   ONBEKEND is de stand voor "de rail kan het geld al hebben verstuurd, maar wij
   weten het niet" (MONEY-012). Hij bestaat omdat MISLUKT het terugboeken
   ontgrendelt, en terugboeken na een betaling die WEL is uitgevoerd maakt geld
   uit niets: het lid krijgt zijn bedrag terug terwijl de ontvanger het ook
   heeft. Uit ONBEKEND kom je alleen met een uitspraak van de rail zelf -- een
   herhaalde inzending met dezelfde sleutel (INGEDIEND/AFGEWIKKELD) of een
   bevestiging dat hij mislukte (MISLUKT) -- en nooit door de tijd. */
'use strict';

const STATUS = { GEBOEKT: 'GEBOEKT', INGEDIEND: 'INGEDIEND', AFGEWIKKELD: 'AFGEWIKKELD',
  MISLUKT: 'MISLUKT', TERUGGEBOEKT: 'TERUGGEBOEKT', ONBEKEND: 'ONBEKEND' };
const OVERGANG = {
  GEBOEKT: ['INGEDIEND', 'AFGEWIKKELD', 'MISLUKT', 'ONBEKEND'],
  INGEDIEND: ['AFGEWIKKELD', 'MISLUKT', 'ONBEKEND'],
  AFGEWIKKELD: [],
  MISLUKT: ['TERUGGEBOEKT', 'INGEDIEND'],
  TERUGGEBOEKT: [],
  ONBEKEND: ['INGEDIEND', 'AFGEWIKKELD', 'MISLUKT']
};
const AF = new Set([STATUS.AFGEWIKKELD, STATUS.TERUGGEBOEKT]);
const OPEN = new Set([STATUS.GEBOEKT, STATUS.INGEDIEND, STATUS.MISLUKT, STATUS.ONBEKEND]);
const DEFINITIEF = new Set(['betaald', 'succeeded', 'paid', 'settled', 'afgewikkeld']);
const BACKOFF_MS = [30000, 120000, 600000, 1800000, 3600000];
const MAX_POGINGEN = 6;
const RAM_MAX = 50000;

/* Reconciliation projection: intern geboekt, extern nog niet definitief en
   rail-finalisaties die na een crash nog op hun runtime-hook wachten. */
function maakOpenstaandOverzicht(rij) {
  const uit = { status: 200, aantal: 0, centen: 0, perStatus: {}, oudsteAt: null,
    mislukt: 0, mislukteCenten: 0, zonderTerugboeking: 0, zonderAfwikkeling: 0,
    onbekend: 0, onbekendeCenten: 0 };
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
    if (o.status === STATUS.ONBEKEND) { uit.onbekend++; uit.onbekendeCenten += o.centen; }
  }
  return uit;
}

module.exports = { STATUS, OVERGANG, AF, OPEN, DEFINITIEF, BACKOFF_MS,
  MAX_POGINGEN, RAM_MAX, maakOpenstaandOverzicht };
