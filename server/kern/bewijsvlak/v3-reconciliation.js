'use strict';

const { id, kopie, bevries } = require('./canon');

const STATES = Object.freeze(['REQUESTED', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED', 'CANCELLED']);

function maakReconciliation(opties) {
  const o = opties || {}, store = o.store, nu = o.nu || (() => new Date().toISOString());
  if (!store) throw new Error('bewijsvlak v3: reconciliation mist store');

  function reconciliatieTransition(input) {
    const i = input || {}, state = String(i.state || '').toUpperCase();
    if (!STATES.includes(state)) throw new Error('bewijsvlak v3: ongeldige reconciliatiestatus');
    const previous = i.previousRecordId ? store.get('reconciliations', i.previousRecordId) : null;
    if (i.previousRecordId && !previous) throw new Error('bewijsvlak v3: eerdere reconciliatie ontbreekt');
    const body = { schemaVersion: 3, subjectRef: kopie(i.subjectRef), claimRef: String(i.claimRef || ''),
      state, reasonCodes: (i.reasonCodes || []).map(String).sort(), evidenceRefs: (i.evidenceRefs || []).map(String).sort(),
      previousRecordId: i.previousRecordId || null, at: String(i.at || nu()) };
    if (!body.claimRef) throw new Error('bewijsvlak v3: reconciliatie vereist claim');
    body.reconciliationId = id('reconciliation_v3', body);
    return store.put('reconciliations', body.reconciliationId, bevries(body));
  }
  function current(subjectRef) {
    const s = JSON.stringify(subjectRef || {});
    return store.list('reconciliations').filter(x => JSON.stringify(x.subjectRef) === s)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))[0] || null;
  }
  return Object.freeze({ STATES, transition: reconciliatieTransition, current });
}

module.exports = { STATES, maakReconciliation };
