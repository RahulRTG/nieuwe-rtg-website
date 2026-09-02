/* Adapter van de generieke Action Broker naar de Experience-attentionstaat. */
'use strict';

function fout(error, status, code) { return { error, status, code }; }

module.exports = function attentionActie({ projecteer, opslag }) {
  function vind(key, world, contextId, attentionId, economicPrincipalRef) {
    const projection = projecteer({ key, world, contextId, economicPrincipalRef });
    if (projection.error) return projection;
    const item = (projection.attention || []).find(a => a.id === attentionId);
    return item ? { projection, item }
      : fout('Dit aandachtspunt bestaat niet meer.', 409, 'STALE_ATTENTION');
  }

  function prepare({ key, world, context, parameters, economicPrincipalRef }) {
    const attentionId = String(parameters.attentionId || '');
    const gevonden = vind(key, world, context.id, attentionId, economicPrincipalRef);
    if (gevonden.error) return gevonden;
    if (gevonden.item.lifecycle === 'ACKNOWLEDGED')
      return fout('Dit aandachtspunt is al gezien.', 409, 'ATTENTION_ALREADY_ACKNOWLEDGED');
    return {
      ok: true, parameters: { attentionId }, objectRef: gevonden.item.objectRef,
      policy: { decision: 'ALLOW_WITH_CONFIRMATION', policyId: 'policy:own-attention',
        version: 'v1', reasonCodes: ['OWN_ATTENTION_ITEM'] },
      confirmation: { required: true, text: 'Markeer “' + gevonden.item.title + '” als gezien.' },
      consequence: { changesDomainTruth: false, changesExperienceState: true,
        createsFinancialCommitment: false, reversible: true, notificationSent: false }
    };
  }

  function execute({ key, preview, economicPrincipalRef }) {
    const gevonden = vind(key, preview.world, preview.contextId,
      preview.parameters.attentionId, economicPrincipalRef);
    if (gevonden.error) return gevonden;
    const at = opslag.tijd();
    const state = opslag.attentionZet(key, preview.parameters.attentionId,
      { lifecycle: 'ACKNOWLEDGED', acknowledgedAt: at, world: preview.world,
        objectRef: gevonden.item.objectRef });
    return { ok: true, objectRef: gevonden.item.objectRef,
      result: { attention: { ...gevonden.item, ...state } } };
  }

  return { prepare, execute };
};
