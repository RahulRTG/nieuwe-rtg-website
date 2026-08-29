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

module.exports = { STATUS, OVERGANG, AF, OPEN, DEFINITIEF, BACKOFF_MS, MAX_POGINGEN, RAM_MAX };
