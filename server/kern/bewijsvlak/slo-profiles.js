/* Capability-SLO's komen uit dezelfde SLO.json als de bestaande HTTP-doelen.
   Een profiel is een norm; de duurzame capabilitymeter levert de waarneming. */
'use strict';

const fs = require('fs');
const path = require('path');
const BESTAND = path.join(__dirname, '..', '..', '..', 'SLO.json');

let cache = null;
function laad() {
  const stat = fs.statSync(BESTAND);
  if (cache && cache.mtimeMs === stat.mtimeMs) return cache.profiles;
  const bron = JSON.parse(fs.readFileSync(BESTAND, 'utf8'));
  const lijst = bron.capabilityProfielen;
  if (!Array.isArray(lijst) || !lijst.length) throw new Error('SLO.json mist capabilityProfielen');
  const profiles = Object.freeze(Object.fromEntries(lijst.map(p => {
    if (!p.id || !(p.availabilityTarget > 0 && p.availabilityTarget <= 100) ||
      !(p.windowDays > 0) || !(p.minimumSamples > 0) ||
      !(p.minimumCoverage >= 0 && p.minimumCoverage <= 1) || !(p.freshnessMinutes > 0) ||
      !p.latency || !(p.latency.quantile > 0 && p.latency.quantile <= 1) || !(p.latency.maxMs > 0))
      throw new Error('ongeldig capability-SLO-profiel: ' + (p.id || '(zonder id)'));
    return [p.id, Object.freeze({ ...p, latency: Object.freeze({ ...p.latency }) })];
  })));
  cache = { mtimeMs: stat.mtimeMs, profiles };
  return profiles;
}
function haal(id) { return laad()[id] || null; }

function resolveSloProfiel(profileId, stand) {
  const p = haal(profileId);
  if (!p) return { oordeel: 'onvoldoende gemeten', reasons: ['SLO_PROFILE_UNKNOWN'] };
  const doelen = new Map(((stand && stand.doelen) || []).map(d => [d.id, d]));
  const vereist = [p.legacyAvailability, p.legacyLatency].concat(p.legacyDependencies || []).filter(Boolean);
  const ontbreekt = vereist.filter(id => !doelen.has(id));
  if (ontbreekt.length) return { oordeel: 'onvoldoende gemeten', profile: profileId,
    reasons: ontbreekt.map(id => 'SLO_MISSING:' + id) };
  const waarden = vereist.map(id => doelen.get(id));
  if (waarden.some(d => d.oordeel === 'niet gehaald')) return { oordeel: 'niet gehaald', profile: profileId,
    reasons: waarden.filter(d => d.oordeel === 'niet gehaald').map(d => 'SLO_NOT_MET:' + d.id) };
  if (waarden.some(d => d.oordeel !== 'gehaald')) return { oordeel: 'onvoldoende gemeten', profile: profileId,
    reasons: waarden.filter(d => d.oordeel !== 'gehaald').map(d => 'SLO_UNKNOWN:' + d.id) };
  return { oordeel: 'gehaald', profile: profileId, reasons: [] };
}

const PROFILES = laad();
module.exports = { PROFILES, laad, haal, resolve: resolveSloProfiel, BESTAND };
