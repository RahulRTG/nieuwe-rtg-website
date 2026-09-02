/* De harde voordeur van een Economic Intent. Alleen vorm, authority snapshot,
   policybesluit en sluitende allocatie worden hier gekeurd; schrijven gebeurt
   pas in intent.js en altijd binnen de duurzame runtimebundel. */
'use strict';

const { fout, ref, plan } = require('./regels');

function valideer(input) {
  if (!input || typeof input !== 'object') return fout('INVALID_INTENT', 'Economic intent ontbreekt.');
  if (!/^[A-Za-z0-9:_-]{8,180}$/.test(String(input.idempotencyKey || '')))
    return fout('INVALID_IDEMPOTENCY_KEY', 'Een duurzame idempotency key van minimaal acht tekens is verplicht.');
  for (const [waarde, naam] of [[input.principalRef, 'principalRef'], [input.actingRef || input.principalRef, 'actingRef'],
    [input.legalContext && input.legalContext.settlementEntityRef, 'legalContext.settlementEntityRef'],
    [input.sourceRef, 'sourceRef']]) {
    const bezwaar = ref(waarde, naam); if (bezwaar) return bezwaar;
  }
  if (!/^[A-Z][A-Z0-9_.-]{2,79}$/.test(String(input.purpose || '')))
    return fout('INVALID_PURPOSE', 'Economic purpose moet een stabiele machinecode zijn.');
  if (!input.policyDecision || input.policyDecision.decision !== 'ALLOW')
    return fout('POLICY_NOT_ALLOWED', 'Zonder expliciete ALLOW-policybeslissing ontstaat geen economische waarheid.', 403);
  for (const [waarde, naam] of [[input.policyDecision.policyId, 'policyDecision.policyId'],
    [input.policyDecision.version, 'policyDecision.version'],
    [input.policyDecision.decisionId, 'policyDecision.decisionId']]) {
    const bezwaar = ref(waarde, naam); if (bezwaar) return bezwaar;
  }
  return plan(input.requestedValue, input.allocations);
}

module.exports = { valideer };
