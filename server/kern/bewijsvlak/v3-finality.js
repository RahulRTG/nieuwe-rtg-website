/* Finality is geen getal. Correctietoestanden kunnen niet via een ontbrekende
   rang terugvallen naar een geruststellende toestand. */
'use strict';

const FINALITY_TRANSITIONS = Object.freeze({
  UNKNOWN: Object.freeze(['UNKNOWN', 'UNVERIFIED', 'SOURCE_ATTESTED', 'CROSS_VERIFIED', 'RECONCILED',
    'DISPUTED', 'REVERSED', 'CANCELLED']),
  UNVERIFIED: Object.freeze(['UNVERIFIED', 'SOURCE_ATTESTED', 'CROSS_VERIFIED', 'RECONCILED',
    'DISPUTED', 'REVERSED', 'CANCELLED']),
  SOURCE_ATTESTED: Object.freeze(['SOURCE_ATTESTED', 'CROSS_VERIFIED', 'RECONCILED',
    'DISPUTED', 'REVERSED', 'CANCELLED']),
  CROSS_VERIFIED: Object.freeze(['CROSS_VERIFIED', 'RECONCILED', 'DISPUTED', 'REVERSED', 'CANCELLED']),
  RECONCILED: Object.freeze(['RECONCILED', 'DISPUTED', 'REVERSED', 'CANCELLED']),
  DISPUTED: Object.freeze(['DISPUTED', 'REVERSED', 'CANCELLED']),
  REVERSED: Object.freeze(['REVERSED']),
  CANCELLED: Object.freeze(['CANCELLED'])
});

function overgangMag(van, naar, result) {
  if (!van) return true;
  const toegestaan = FINALITY_TRANSITIONS[van] || [];
  if (!toegestaan.includes(naar)) return false;
  if (['REVERSED', 'CANCELLED'].includes(naar) && naar !== van && !result.correctionRefs.length) return false;
  if (naar === 'DISPUTED' && naar !== van && !result.correctionRefs.length && !result.conflicting.length) return false;
  return true;
}

module.exports = { FINALITY_TRANSITIONS, overgangMag };
