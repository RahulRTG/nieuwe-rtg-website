/* Eén register van uitvoerbare beloften. Het register beslist niet over de
   inhoud van een domein; het combineert contract, policy, SLO en dependencies. */
'use strict';

const { capabilityContract } = require('./contract');
const compatibility = require('./compatibility');
const { kopie, bevries } = require('./canon');

function maakRegister(initieel) {
  const map = new Map();

  function registreer(invoer) {
    const c = capabilityContract(invoer);
    const sleutel = c.id + '@' + c.version;
    if (map.has(sleutel)) throw new Error('bewijsvlak: capability bestaat al: ' + sleutel);
    map.set(sleutel, c);
    return c;
  }
  for (const c of initieel || []) registreer(c);

  function haal(id, versie) {
    if (versie) return map.get(id + '@' + versie) || null;
    return [...map.values()].filter(c => c.id === id).sort((a, b) => b.version - a.version)[0] || null;
  }

  function resolve(vraag) {
    const v = vraag || {}, c = haal(v.id, v.version);
    if (!c) return bevries({ id: v.id || null, state: 'UNKNOWN', decision: 'DENY', reasons: ['CAPABILITY_UNKNOWN'] });
    if (!c.implemented) return bevries({ id: c.id, version: c.version, state: 'BLOCKED', decision: 'DENY', reasons: ['NOT_IMPLEMENTED'] });
    const comp = compatibility.resolve(c, v.versions || {}, { readOnly: !!v.readOnly });
    if (!comp.ok) return bevries({ id: c.id, version: c.version,
      state: comp.decision === 'DEGRADE' ? 'DEGRADED' : 'BLOCKED', decision: comp.decision, reasons: comp.reasons });
    if (!v.policy || !String(v.policy.decision || '').startsWith('ALLOW'))
      return bevries({ id: c.id, version: c.version, state: 'BLOCKED', decision: 'DENY', reasons: ['POLICY_DENIED'] });
    const ontbreekt = (c.dependencies || []).filter(d => !(v.dependencies || {})[d]);
    if (ontbreekt.length) return bevries({ id: c.id, version: c.version,
      state: 'BLOCKED', decision: 'DENY', reasons: ontbreekt.map(d => 'DEPENDENCY_UNAVAILABLE:' + d) });
    const slo = v.slo || {};
    if (slo.oordeel === 'onvoldoende gemeten' || slo.oordeel == null)
      return bevries({ id: c.id, version: c.version, state: 'UNKNOWN', decision: 'ESCALATE', reasons: ['SLO_UNKNOWN'] });
    if (slo.oordeel !== 'gehaald') {
      const fallback = c.fallback && c.fallback.capability;
      return bevries({ id: c.id, version: c.version, state: 'DEGRADED', decision: fallback ? 'DEGRADE' : 'DENY',
        reasons: ['SLO_NOT_MET'], fallback: fallback || null });
    }
    return bevries({ id: c.id, version: c.version, state: 'AVAILABLE', decision: 'ALLOW', reasons: [] });
  }

  return Object.freeze({ registreer, haal, resolve,
    publiek: () => [...map.values()].map(kopie).sort((a, b) => (a.id + a.version).localeCompare(b.id + b.version)),
    compatibilityMatrix: () => [...map.values()].map(c => ({ id: c.id, capabilityVersion: c.version,
      client: kopie(c.compatibility.client), policy: kopie(c.compatibility.policy),
      event: kopie(c.compatibility.event), deprecated: kopie(c.compatibility.deprecated || []),
      blocked: kopie(c.compatibility.blocked || []) })) });
}

module.exports = { maakRegister };
