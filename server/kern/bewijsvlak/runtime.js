'use strict';

const { maakPlane } = require('./plane');

let actief = maakPlane({ mode: 'shadow', state: {} });

function configure(opties) {
  const o = opties || {}, fallback = o.state || {};
  const stateFor = typeof o.stateFor === 'function' ? o.stateFor : o.db
    ? () => {
      const data = o.db.data;
      if (!data || typeof data !== 'object') throw new Error('bewijsvlak runtime: database-state ontbreekt');
      if (!data.trustEvidence || typeof data.trustEvidence !== 'object') data.trustEvidence = {};
      return data.trustEvidence;
    }
    : () => fallback;
  actief = maakPlane({ ...o, state: stateFor(), stateFor });
  return actief;
}

function current() { return actief; }
function observe(invoer) {
  try { return actief.observe(invoer); }
  catch (error) { return { ok: false, shadow: true, code: 'EVIDENCE_OBSERVATION_FAILED', error: error.message }; }
}
function measure(invoer) {
  try { return actief.measure(invoer); }
  catch (error) { return { ok: false, shadow: true, code: 'CAPABILITY_MEASUREMENT_FAILED', error: error.message }; }
}
function timer(invoer) {
  const gestart = process.hrtime.bigint(); let klaar = null;
  return Object.freeze({ finish(resultaat) {
    if (klaar) return klaar;
    klaar = measure({ ...(invoer || {}), ...(resultaat || {}),
      durationMs: Number(process.hrtime.bigint() - gestart) / 1e6 });
    return klaar;
  } });
}

function v3(handeling, invoer) {
  try {
    const plane = actief.v3;
    if (!plane || typeof plane[handeling] !== 'function')
      return { ok: false, shadow: true, code: 'V3_ACTION_UNKNOWN' };
    return plane[handeling](invoer);
  } catch (error) {
    if (error && error.incidentId) throw error;
    return { ok: false, shadow: true, code: error && error.code || 'V3_EVIDENCE_FAILED',
      incidentId: error && error.incidentId || null, error: error.message };
  }
}
module.exports = { configure, current, observe, measure, timer, v3 };
