/* Previewbereiding: geldig domeingezag en bronpolicy vóór een bewaard voorstel.
   Uitvoering, idempotentie en afronding blijven bij de broker. */
'use strict';
const { hash, kopie } = require('./canon');
const registry = require('./intent-registry');
const authority = require('./broker-authority');
function fout(error, status, code, extra) { return { error, status, code, ...(extra || {}) }; }

module.exports = function maakPreview({ crypto, opslag, contexten, handlers, evidence }) {
  const { contextVoor, bevoegd, velden } = require('./broker-grenzen')({ contexten });
  return function preview(key, invoer, economicPrincipalRef, routeBeleid) {
    const b = invoer || {}, definition = registry.haal(b.intent, b.version);
    if (!definition) return fout('Onbekende of verouderde intentie.', 400, 'UNKNOWN_INTENT');
    const parameters = b.parameters || {};
    const world = String(b.world || parameters.world || '').toLowerCase();
    if (!definition.worlds.includes(world))
      return fout('Deze intentie is in deze wereld niet beschikbaar.', 403, 'WORLD_NOT_ALLOWED');
    const ontbreekt = velden(definition, parameters); if (ontbreekt) return ontbreekt;
    const context = contextVoor(key, world, b.contextId); if (context.error) return context;
    const geenGezag = bevoegd(context, definition); if (geenGezag) return geenGezag;
    const handler = handlers[definition.id];
    if (!handler) return fout('De runtime voor deze intentie is niet beschikbaar.', 503, 'RUNTIME_UNAVAILABLE');
    const denied = authority.check(definition.id, routeBeleid); if (denied) return denied;
    const voorbereid = handler.prepare({ key, world, context, parameters, economicPrincipalRef });
    if (!voorbereid || voorbereid.error)
      return voorbereid || fout('De actie kon niet worden voorbereid.', 500, 'PREVIEW_FAILED');
    const createdAt = opslag.tijd();
    const fingerprint = hash(crypto, { intent: definition.id, version: definition.version,
      world, contextId: context.id, economicPrincipalRef: economicPrincipalRef || null,
      parameters: voorbereid.parameters });
    const policy = voorbereid.policy || {};
    const policyDecision = {
      decisionId: 'xpd_' + hash(crypto, { fingerprint, policy }).slice(0, 24),
      policyId: policy.policyId || 'policy:experience-default',
      policyVersion: policy.version || 'v1', inputHash: fingerprint,
      decision: policy.decision || 'DENY', reasonCodes: kopie(policy.reasonCodes || []),
      actor: opslag.actor(key), timestamp: createdAt
    };
    if (!String(policyDecision.decision).startsWith('ALLOW'))
      return fout('De geldende policy staat deze actie niet toe.', 403, 'POLICY_DENIED', { policyDecision });
    const expiresAt = new Date(Date.parse(createdAt) + 5 * 60000).toISOString();
    const p = {
      id: 'xpv_' + crypto.randomBytes(12).toString('hex'),
      intent: definition.id, version: definition.version, runtime: definition.runtime,
      world, contextId: context.id, parameters: kopie(voorbereid.parameters),
      economicPrincipalRef: economicPrincipalRef || null,
      objectRef: kopie(voorbereid.objectRef || null), fingerprint, createdAt, expiresAt,
      policyDecision, confirmation: kopie(voorbereid.confirmation),
      consequence: kopie(voorbereid.consequence)
    };
    opslag.previewZet(key, p);
    evidence.preview(key, p);
    return { ok: true, preview: p };
  };
};
