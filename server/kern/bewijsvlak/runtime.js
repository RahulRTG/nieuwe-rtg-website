'use strict';

const { maakPlane } = require('./plane');

let actief = maakPlane({ mode: 'shadow', state: {} });

function configure(opties) {
  const o = opties || {}, state = o.state || (o.db && o.db.data
    ? (o.db.data.trustEvidence = o.db.data.trustEvidence || {}) : {});
  actief = maakPlane({ ...o, state });
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
    return { ok: false, shadow: true, code: 'V3_EVIDENCE_FAILED', error: error.message };
  }
}
function pilot(naam, handeling, invoer) {
  try {
    const groep = actief.v3 && actief.v3.pilots;
    if (!groep || typeof groep[handeling] !== 'function')
      return { ok: false, shadow: true, code: 'V3_PILOT_UNKNOWN' };
    return groep[handeling](invoer);
  } catch (error) {
    return { ok: false, shadow: true, code: 'V3_PILOT_FAILED', pilot: naam, error: error.message };
  }
}

module.exports = { configure, current, observe, measure, timer, v3, pilot };
