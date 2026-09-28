/* VRIJHEID: DE STANDMACHINES -- expliciete overgangen, en wat er niet in staat
   kan niet. Elke overgang die de motor zet gaat langs `mag()`; een overgang
   die hier niet staat, is een programmeerfout en geen randgeval. */
'use strict';

const MACHINES = Object.freeze({
  verzoek: {
    DRAFT: ['SUBMITTED', 'CANCELLED'],
    SUBMITTED: ['CHECKING', 'CANCELLED'],
    CHECKING: ['AUTO_APPROVED', 'HUMAN_REVIEW', 'ALTERNATIVE_PROPOSED', 'DECLINED', 'CANCELLED'],
    HUMAN_REVIEW: ['APPROVED', 'ALTERNATIVE_PROPOSED', 'DECLINED', 'CANCELLED'],
    ALTERNATIVE_PROPOSED: ['SUBMITTED', 'CANCELLED', 'DECLINED'],
    AUTO_APPROVED: ['SCHEDULED', 'HUMAN_REVIEW', 'CANCELLED'],
    APPROVED: ['SCHEDULED', 'HUMAN_REVIEW', 'CANCELLED'],
    SCHEDULED: ['HANDOVER_READY', 'TAKEN', 'HUMAN_REVIEW', 'CANCELLED'],
    HANDOVER_READY: ['TAKEN', 'CANCELLED'],
    TAKEN: ['COMPLETED'],
    DECLINED: [], COMPLETED: [], CANCELLED: []
  },
  verjaardag: {
    DETECTED: ['ELIGIBILITY_CONFIRMED', 'NEEDS_REVIEW', 'NOT_APPLICABLE'],
    ELIGIBILITY_CONFIRMED: ['COVERAGE_PLANNED', 'NEEDS_REVIEW'],
    COVERAGE_PLANNED: ['SCHEDULED'],
    NEEDS_REVIEW: ['ELIGIBILITY_CONFIRMED', 'NOT_APPLICABLE'],
    SCHEDULED: ['TAKEN', 'WORKED_BY_CHOICE'],
    TAKEN: ['COMPLETED'], WORKED_BY_CHOICE: [], COMPLETED: [], NOT_APPLICABLE: []
  },
  vrijgaveAanbod: {
    OPPORTUNITY_DETECTED: ['SAFETY_CHECK'],
    SAFETY_CHECK: ['FAIRNESS_CHECK', 'NOT_OFFERED'],
    FAIRNESS_CHECK: ['OFFERED', 'NOT_OFFERED'],
    OFFERED: ['ACCEPTED', 'DECLINED', 'EXPIRED'],
    ACCEPTED: ['ROSTER_RECONCILED', 'RECONCILE_PENDING'],
    RECONCILE_PENDING: ['ROSTER_RECONCILED'],
    ROSTER_RECONCILED: ['COMPLETED'],
    DECLINED: [], EXPIRED: [], NOT_OFFERED: [], COMPLETED: []
  },
  ruil: {
    PROPOSED: ['COUNTERPART_ACCEPTED', 'WITHDRAWN', 'DECLINED'],
    COUNTERPART_ACCEPTED: ['COVERAGE_CHECK'],
    COVERAGE_CHECK: ['POLICY_CHECK', 'DECLINED'],
    POLICY_CHECK: ['APPROVED', 'DECLINED'],
    APPROVED: ['ROSTER_UPDATED'],
    ROSTER_UPDATED: [], DECLINED: [], WITHDRAWN: []
  },
  uitzondering: {
    REQUESTED: ['REVIEW'],
    REVIEW: ['APPROVED', 'MODIFIED', 'DECLINED'],
    APPROVED: [], MODIFIED: [], DECLINED: []
  }
});

function mag(machine, van, naar) {
  const m = MACHINES[machine];
  return !!(m && m[van] && m[van].includes(naar));
}

/* Zet een stand en legt de overgang vast. Een verboden overgang gooit: de
   aanroeper hoort hem nooit te proberen. */
function zet(obj, machine, naar, door, nu) {
  if (!mag(machine, obj.stand, naar)) throw new Error('Verboden overgang in ' + machine + ': ' + obj.stand + ' -> ' + naar);
  (obj.historie || (obj.historie = [])).push({ van: obj.stand, naar, door: door || 'systeem', op: nu });
  obj.stand = naar;
  return obj;
}

module.exports = { MACHINES, mag, zet };
