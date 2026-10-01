'use strict';

function nummer(v) {
  if (Number.isInteger(v)) return v;
  const m = String(v == null ? '' : v).match(/^(?:v)?(\d+)$/);
  return m ? Number(m[1]) : null;
}

function past(range, versie) {
  const v = nummer(versie);
  if (v == null || !range) return false;
  if (range.exact != null) return v === nummer(range.exact);
  if (range.min != null && v < nummer(range.min)) return false;
  if (range.max != null && v > nummer(range.max)) return false;
  if ((range.blocked || []).map(nummer).includes(v)) return false;
  return true;
}

function resolve(contract, versies, opties) {
  const mutation = !(opties && opties.readOnly);
  if (!contract || !contract.compatibility) return { ok: false, decision: mutation ? 'DENY' : 'DEGRADE', reasons: ['CONTRACT_UNKNOWN'] };
  const reasons = [];
  for (const soort of ['client', 'policy', 'event']) {
    if (!past(contract.compatibility[soort], versies && versies[soort])) reasons.push(soort.toUpperCase() + '_INCOMPATIBLE');
  }
  if (!reasons.length) return { ok: true, decision: 'ALLOW', reasons: [] };
  return { ok: false, decision: mutation ? 'DENY' : 'DEGRADE', reasons };
}

module.exports = { nummer, past, resolve };
