'use strict';

const INVARIANTS = Object.freeze([
  { id: 'TEP-01', rule: 'same-idempotency-key-same-input-one-effect' },
  { id: 'TEP-02', rule: 'same-idempotency-key-different-input-conflict' },
  { id: 'TEP-03', rule: 'claim-never-grants-permission' },
  { id: 'TEP-04', rule: 'unknown-compatibility-denies-mutation' },
  { id: 'TEP-05', rule: 'unknown-slo-is-not-healthy' },
  { id: 'TEP-06', rule: 'every-retry-keeps-input-hash' },
  { id: 'TEP-07', rule: 'ambiguous-money-requires-reconciliation' },
  { id: 'TEP-08', rule: 'ledger-stores-references-not-domain-ownership' },
  { id: 'TEP-09', rule: 'shadow-policy-never-enforces' },
  { id: 'TEP-10', rule: 'migration-unknown-never-auto-runs' },
  { id: 'TEP-11', rule: 'evidence-is-observation-not-truth' },
  { id: 'TEP-12', rule: 'claims-require-sufficient-authorized-evidence' },
  { id: 'TEP-13', rule: 'absence-of-proof-never-proves-success' },
  { id: 'TEP-14', rule: 'unknown-never-authorizes-blind-irreversible-retry' },
  { id: 'TEP-15', rule: 'consequential-decisions-produce-immutable-explanation-evidence' }
]);

function controleer(resultaten) {
  const r = resultaten || {};
  const ontbreekt = INVARIANTS.filter(i => r[i.id] !== true).map(i => i.id);
  return Object.freeze({ ok: ontbreekt.length === 0, checked: INVARIANTS.length, missing: ontbreekt });
}

module.exports = { INVARIANTS, controleer };
