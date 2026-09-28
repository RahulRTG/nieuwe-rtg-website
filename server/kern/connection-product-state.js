/* De gemeenschappelijke resolver tussen productstate en UI-rand. Producten
   bepalen hun eigen states; deze laag past policy/default-deny toe, verwijdert
   niet-gebouwde capabilities en maakt een freshness-token over de uitkomst. */
'use strict';

const crypto = require('crypto');
const policy = require('./connection-policy');
const Projection = require('./connection-projection');
const Edge = require('./connection-edge');

const VERSION = 1;

function stabiel(value) {
  if (Array.isArray(value)) return value.map(stabiel);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stabiel(value[k])]));
  return value;
}

function revision(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stabiel(value))).digest('hex').slice(0, 24);
}

function resolve({ actor, product, productState, access, subject, context }) {
  if (!productState) return { status: 404, code: 'CONNECTION_CONTEXT_NOT_FOUND', error: 'Deze Connection-context bestaat niet.' };
  const availableCapabilities = [];
  for (const capability of [...new Set(productState.candidates || [])]) {
    const decision = policy.beslis({ actor: actor || 'member', product, capability,
      state: { ...(access || {}), blocked: !!(access && access.blocked) } });
    if (decision.allow) availableCapabilities.push(capability);
  }
  const basis = {
    surface: productState.surface,
    state: productState.state,
    availableCapabilities,
    actions: Edge.project(productState.surface, availableCapabilities),
    policyVersion: policy.CONTRACT.version,
    projectionVersion: Projection.VERSION,
    stateContractVersion: VERSION
  };
  const stateRevision = revision({ product, actor: actor || 'member', subject, context,
    fingerprint: productState.fingerprint, ...basis });
  const naam = product === 'vonk' ? Projection.NAMES.VONK_EDGE : Projection.NAMES.RENDEZVOUS_EDGE;
  return { status: 200, ...Projection.project(naam, { ...basis, stateRevision }) };
}

function guard({ edge, expectedRevision, capability, transition }) {
  if (!edge || edge.error) return edge || { status: 404, code: 'CONNECTION_CONTEXT_NOT_FOUND', error: 'Deze Connection-context bestaat niet.' };
  if (expectedRevision && expectedRevision !== edge.stateRevision) {
    return { status: 409, code: 'STALE_CONNECTION_STATE', error: 'Deze bediening is verouderd. Vernieuw de actuele toestand.' };
  }
  if (capability && !(edge.availableCapabilities || []).includes(capability)) {
    return { status: 409, code: 'CAPABILITY_NOT_AVAILABLE', error: 'Deze handeling bestaat niet in de actuele toestand.' };
  }
  if (transition && !transition.ok) {
    return { status: 409, code: transition.code || 'INVALID_PRODUCT_TRANSITION',
      error: 'Deze overgang bestaat niet in de actuele producttoestand.' };
  }
  return { status: 200, ok: true };
}

module.exports = { VERSION, resolve, guard, revision };
