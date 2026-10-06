/* Eén synchrone commitgrens voor V3-records en hun ledgerregels.

   Een V3-handeling mag nooit eerst een claim/besluit bewaren en pas daarna
   ontdekken dat het bijbehorende ketenbewijs niet meer past. Store en ledger
   leveren daarom alleen kleine apply/rollback-operaties aan deze coordinator.
   Alles wordt vooraf gevalideerd, daarna in RAM toegepast en met één save()
   duurzaam gemaakt. Een mislukte save herstelt het RAM-beeld en blijft als
   expliciete Evidence Debt zichtbaar. */
'use strict';

const { kopie, bevries } = require('./canon');

function codeVan(error) {
  return String(error && error.code || 'V3_TRANSACTION_FAILED').slice(0, 100);
}

function maakCoordinator(opties) {
  const o = opties || {}, save = typeof o.save === 'function' ? o.save : () => {},
    nu = o.nu || (() => new Date().toISOString()), vasteRoot = o.root || o.state || {},
    rootFor = typeof o.rootFor === 'function' ? o.rootFor : () => vasteRoot;
  const health = { status: 'HEALTHY', acceptingWrites: true, failureCount: 0,
    unresolvedCount: 0, incidents: [], lastFailure: null, lastSuccessAt: null };
  let actief = null;

  function meld(label, error, writes) {
    const h = health;
    h.status = 'UNHEALTHY';
    h.acceptingWrites = false;
    h.failureCount = Number(h.failureCount || 0) + 1;
    h.unresolvedCount = Number(h.unresolvedCount || 0) + 1;
    const incident = bevries({ incidentId: 'v3_failure_' + h.failureCount,
      operation: String(label || 'v3.unknown').slice(0, 120), code: codeVan(error),
      attemptedWrites: Number(writes || 0), at: nu(), resolved: false });
    h.lastFailure = incident;
    h.incidents = [...(Array.isArray(h.incidents) ? h.incidents : []), incident].slice(-50);
    return incident;
  }

  function stage(operation) {
    if (!actief) return false;
    if (!operation || typeof operation.apply !== 'function' || typeof operation.rollback !== 'function')
      throw new Error('bewijsvlak v3: ongeldige transactie-operatie');
    if (operation.key && actief.keys.has(operation.key))
      throw new Error('bewijsvlak v3: dubbele transactie-operatie ' + operation.key);
    actief.operations.push(operation);
    if (operation.key) actief.keys.add(operation.key);
    return true;
  }

  const pending = predicate => actief
    ? actief.operations.filter(predicate || (() => true)) : [];
  const active = () => !!actief;
  const root = () => actief ? actief.root : rootFor();

  function atomic(label, fn) {
    if (actief) return fn();
    if (!health.acceptingWrites) {
      const error = new Error('bewijsvlak v3: bewijswrites zijn geblokkeerd na een onopgelost incident');
      error.code = 'EVIDENCE_WRITES_BLOCKED';
      error.incidentId = health.lastFailure && health.lastFailure.incidentId;
      throw error;
    }
    const transaction = { label: String(label || 'v3.transaction'), operations: [], keys: new Set(), root: rootFor() };
    if (!transaction.root || typeof transaction.root !== 'object')
      throw new Error('bewijsvlak v3: transactie heeft geen state-root');
    actief = transaction;
    let result;
    try {
      result = fn();
      if (result && typeof result.then === 'function') {
        const error = new Error('bewijsvlak v3: transacties moeten synchroon afronden');
        error.code = 'V3_TRANSACTION_ASYNC';
        throw error;
      }
    } catch (error) {
      actief = null;
      if (transaction.operations.length || error && error.code === 'EVIDENCE_CAPACITY_REACHED') {
        if (!error.code) error.code = 'V3_TRANSACTION_FAILED';
        const incident = meld(transaction.label, error, transaction.operations.length);
        error.incidentId = incident.incidentId;
      }
      throw error;
    }
    actief = null;
    const applied = [];
    let saveStarted = false;
    try {
      for (const operation of transaction.operations)
        if (typeof operation.validate === 'function') operation.validate();
      for (const operation of transaction.operations) {
        operation.apply(); applied.push(operation);
      }
      if (applied.length) {
        saveStarted = true;
        const persisted = save();
        if (persisted && typeof persisted.then === 'function') {
          const error = new Error('bewijsvlak v3: save moet de synchrone commitgrens bevestigen');
          error.code = 'EVIDENCE_ASYNC_SAVE_UNSUPPORTED';
          throw error;
        }
      }
      health.lastSuccessAt = nu();
      return result;
    } catch (error) {
      if (saveStarted) {
        error.causeCode = codeVan(error);
        error.code = 'EVIDENCE_PERSIST_OUTCOME_UNKNOWN';
      } else if (!error.code) error.code = 'V3_TRANSACTION_APPLY_FAILED';
      const rollbackErrors = [];
      for (let i = applied.length - 1; i >= 0; i--) {
        try { applied[i].rollback(); }
        catch (rollbackError) { rollbackErrors.push(codeVan(rollbackError)); }
      }
      if (rollbackErrors.length) {
        health.status = 'CORRUPT';
        error.rollbackErrors = rollbackErrors;
      }
      const incident = meld(transaction.label, error, transaction.operations.length);
      if (rollbackErrors.length) health.status = 'CORRUPT';
      error.incidentId = incident.incidentId;
      throw error;
    }
  }

  function snapshot() {
    const h = health;
    return bevries({ status: h.status, acceptingWrites: h.acceptingWrites,
      failureCount: Number(h.failureCount || 0), unresolvedCount: Number(h.unresolvedCount || 0),
      lastSuccessAt: h.lastSuccessAt, lastFailure: h.lastFailure ? kopie(h.lastFailure) : null,
      incidents: (h.incidents || []).filter(x => !x.resolved).map(kopie) });
  }

  return Object.freeze({ atomic, stage, pending, active, root, snapshot });
}

module.exports = { maakCoordinator };
