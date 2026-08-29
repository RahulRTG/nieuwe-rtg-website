/* De enige muterende weg vanuit het Experience Plane. De broker kent geen
   domeinopslag: hij resolveert intent, context, authority, policy, bevestiging
   en idempotentie en roept daarna precies één runtime-adapter aan. */
'use strict';

const { hash, kopie } = require('./canon');
const registry = require('./intent-registry');
const { veiligGelijk } = require('../util');

function fout(error, status, code, extra) { return { error, status, code, ...(extra || {}) }; }

module.exports = function maakBroker({ crypto, opslag, projecteer, contexten, kern, commit }) {
  const handlers = {
    'attention.acknowledge': require('./action-attention')({ projecteer, opslag }),
    'schedule.item.create': require('./action-schedule')({ kern })
  };

  function contextVoor(key, world, contextId) {
    const context = contexten.kies(key, world, contextId);
    if (!context || (contextId && context.id !== contextId))
      return fout('Deze context hoort niet bij deze gebruiker en wereld.', 403, 'CONTEXT_NOT_ALLOWED');
    return context;
  }
  function bevoegd(context, definition) {
    const scope = new Set(context.authorityScope || []);
    const mist = (definition.authority || []).filter(a => !scope.has(a));
    return mist.length ? fout('Deze context geeft geen bevoegdheid voor de actie.', 403,
      'AUTHORITY_DENIED', { requiredAuthority: mist }) : null;
  }
  function velden(definition, parameters) {
    const p = parameters || {};
    for (const naam of definition.required) if (p[naam] == null || p[naam] === '')
      return fout('Verplicht veld ontbreekt: ' + naam + '.', 400, 'INVALID_INPUT');
    return null;
  }

  function preview(key, invoer, economicPrincipalRef) {
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
    return { ok: true, preview: p };
  }

  async function execute(key, invoer) {
    const b = invoer || {}, idemKey = String(b.idempotencyKey || '');
    if (!/^[a-zA-Z0-9._:-]{8,120}$/.test(idemKey))
      return fout('Een geldige idempotencyKey van minimaal acht tekens is verplicht.', 400, 'IDEMPOTENCY_REQUIRED');
    const eerder = opslag.idemLees(key, idemKey);
    if (eerder) {
      if (eerder.previewId === b.previewId) return { ...eerder.result, replay: true };
      const ander = opslag.previewLees(key, String(b.previewId || ''));
      if (!ander || !veiligGelijk(eerder.fingerprint, ander.fingerprint))
        return fout('Deze idempotencyKey hoort al bij een andere actie.', 409, 'IDEMPOTENCY_CONFLICT');
      return { ...eerder.result, replay: true };
    }
    const p = opslag.previewLees(key, String(b.previewId || ''));
    if (!p) return fout('Deze preview bestaat niet of hoort niet bij deze gebruiker.', 404, 'PREVIEW_NOT_FOUND');
    if (p.executedAt)
      return fout('Deze preview is al uitgevoerd. Gebruik dezelfde idempotencyKey.', 409, 'PREVIEW_USED');
    const nuMs = Date.parse(opslag.tijd());
    if (Date.parse(p.expiresAt) <= (Number.isFinite(nuMs) ? nuMs : Date.now()))
      return fout('Deze preview is verlopen; bekijk de actie opnieuw.', 409, 'PREVIEW_EXPIRED');
    if (p.confirmation && p.confirmation.required && b.confirmed !== true)
      return fout('Menselijke bevestiging ontbreekt.', 409, 'CONFIRMATION_REQUIRED');
    const definition = registry.haal(p.intent, p.version);
    const handler = definition && handlers[definition.id];
    if (!definition || !handler)
      return fout('De runtime voor deze preview bestaat niet meer.', 409, 'RUNTIME_CHANGED');
    const context = contextVoor(key, p.world, p.contextId); if (context.error) return context;
    const geenGezag = bevoegd(context, definition); if (geenGezag) return geenGezag;

    return commit(async () => {
      const uitgevoerd = await handler.execute({ key, context, preview: p,
        economicPrincipalRef: p.economicPrincipalRef });
      if (!uitgevoerd || uitgevoerd.error)
        return uitgevoerd || fout('De runtime kon de actie niet uitvoeren.', 500, 'EXECUTION_FAILED');
      const at = opslag.tijd();
      const objectRef = kopie(uitgevoerd.objectRef || p.objectRef);
      const result = opslag.actieAfronden(key, p.id, idemKey, p.fingerprint, {
        type: 'ExperienceActionExecuted', intent: { id: p.intent, version: p.version },
        runtime: p.runtime, previewId: p.id, idempotencyKey: idemKey,
        world: p.world, contextId: p.contextId,
        objectRef,
        policyDecision: p.policyDecision, confirmation: { confirmed: true, at },
        result: kopie(uitgevoerd.result || {})
      }, { ok: true, intent: p.intent, ...(uitgevoerd.result || {}), objectRef });
      return result || fout('De actie kon niet atomair worden afgerond.', 500, 'FINALIZATION_FAILED');
    });
  }

  return { preview, execute, registry: registry.publiek };
};
