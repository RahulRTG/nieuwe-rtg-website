/* De adapter van een bevestigde abonnementsbetaling naar de Economic Runtime.
   Hier staat de huidige golden path: netto waarde wordt formeel 70/20/10
   verdeeld; alleen de 20- en 10-claims krijgen een externe settlement. */
'use strict';

const btw = require('../commercie/btw');
const { verdeel, HUIDIGE_VERSIE } = require('../commercie/allocatie/regels');
const { naarCenten } = require('../geld/eenheid');

module.exports = function fondsEconomie({ runtime, crypto, env }) {
  const omgeving = env || process.env;
  const hash = waarde => crypto.createHash('sha256').update(String(waarde || '')).digest('hex');
  const veilig = (waarde, prefix) => /^[A-Za-z][A-Za-z0-9:_-]{1,119}$/.test(String(waarde || ''))
    ? String(waarde) : prefix + ':' + hash(waarde).slice(0, 24);
  const actorRef = wie => veilig(wie || 'rtg-member', 'principal');

  function bestemmingen() {
    return {
      lokaal: {
        iban: String(omgeving.RTF_LOKAAL_IBAN || '').trim(),
        begunstigde: String(omgeving.RTF_LOKAAL_BEGUNSTIGDE || omgeving.RTF_LOKAAL || 'Lokaal sociaal fonds').trim(),
        destinationRef: veilig(omgeving.RTF_LOKAAL_DESTINATION_REF || 'destination:local-fund:v1', 'destination')
      },
      foundation: {
        iban: String(omgeving.RTF_IBAN || '').trim(),
        begunstigde: String(omgeving.RTF_BEGUNSTIGDE || 'Stichting RTFoundation').trim(),
        destinationRef: veilig(omgeving.RTF_DESTINATION_REF || 'destination:rtfoundation:v1', 'destination')
      }
    };
  }

  function bereken(bijdrage, btwProfiel) {
    const opbouw = btw.overBruto(naarCenten(bijdrage) || 0, btwProfiel);
    const verdeling = verdeel(opbouw.nettoCenten, HUIDIGE_VERSIE);
    const sociaal = {};
    for (const d of verdeling.delen) sociaal[d.id] = d.centen;
    /* Het expliciete afrondingsverschil landt op de laatste sociale component,
       mét metadata, zodat de drie claims exact de netto waarde vormen. */
    sociaal.foundation = (sociaal.foundation || 0) + verdeling.afrondingCenten;
    const sociaalTotaal = (sociaal.lokaal || 0) + (sociaal.foundation || 0);
    return { opbouw, verdeling, sociaal, sociaalTotaal,
      platformCenten: opbouw.nettoCenten - sociaalTotaal };
  }

  async function registreer({ invoiceId, wie, bijdrage, betaalId, btwProfiel }) {
    const c = bereken(bijdrage, btwProfiel);
    if (!(c.sociaalTotaal > 0) || !(c.platformCenten > 0)) return { ok: true, overslaan: true, berekening: c };
    const bron = veilig(invoiceId || betaalId || hash(String(bijdrage)), 'invoice');
    const sourceRef = bron.startsWith('invoice:') ? bron : 'invoice:' + hash(bron).slice(0, 24);
    const actor = actorRef(wie);
    const decisionId = 'decision:social:' + hash(sourceRef + ':' + HUIDIGE_VERSIE).slice(0, 20);
    const allocations = [
      { component: 'platform', beneficiaryRef: 'entity:rtg-platform', amountMinor: c.platformCenten,
        currency: 'EUR', mode: 'INTERNAL', ledgerAccount: 'revenue:membership' },
      { component: 'local-fund', beneficiaryRef: 'entity:local-social-fund', amountMinor: c.sociaal.lokaal,
        currency: 'EUR', mode: 'EXTERNAL', roundingMinor: 0 },
      { component: 'foundation', beneficiaryRef: 'entity:rtfoundation', amountMinor: c.sociaal.foundation,
        currency: 'EUR', mode: 'EXTERNAL', roundingMinor: c.verdeling.afrondingCenten }
    ];
    const intentUit = await runtime.registreerVerdeling({
      idempotencyKey: 'membership:' + hash(actor + ':' + sourceRef).slice(0, 32),
      sourceRef, principalRef: actor, actingRef: actor, purpose: 'MEMBERSHIP.CONTRIBUTION',
      requestedValue: { amountMinor: c.opbouw.nettoCenten, currency: 'EUR' },
      legalContext: {
        entityRef: veilig(omgeving.RTG_LEGAL_ENTITY_REF || 'entity:rtg-nl', 'entity'),
        settlementEntityRef: veilig(omgeving.RTG_SETTLEMENT_ENTITY_REF || 'entity:rtg-settlement', 'entity'),
        jurisdiction: String(omgeving.RTG_JURISDICTION || 'NL')
      },
      economicContext: { experienceWorld: 'LivingOS', economicWorld: 'consument',
        domain: 'membership', capability: 'membership.contribution' },
      pricingSnapshot: { invoiceRef: sourceRef, grossMinor: c.opbouw.brutoCenten,
        netMinor: c.opbouw.nettoCenten, allocationRuleVersion: c.verdeling.regelVersie },
      taxSnapshot: { profile: c.opbouw.profiel, ratePct: c.opbouw.pct,
        taxMinor: c.opbouw.btwCenten, reverseCharged: c.opbouw.verlegd },
      policyDecision: { decisionId, policyId: 'policy:social-allocation', version: c.verdeling.regelVersie,
        inputHash: hash(JSON.stringify({ sourceRef, netto: c.opbouw.nettoCenten, regel: c.verdeling.regelVersie })),
        decision: 'ALLOW', reasonCodes: ['CONFIRMED_MEMBERSHIP_REVENUE'] },
      authorizationContext: { authorityRef: 'authority:membership-contract' },
      allocations,
      captureEvidence: { sourceRef: betaalId ? 'provider:payment-rail' : 'source:confirmed-invoice',
        externalRef: betaalId ? 'payment:' + hash(betaalId).slice(0, 24) : sourceRef,
        authenticity: betaalId ? 'PROVIDER_ASSERTED' : 'INTERNAL_ASSERTED',
        payload: { amountMinor: c.opbouw.nettoCenten, currency: 'EUR', sourceRef } }
    });
    if (!intentUit || intentUit.error) return intentUit || { error: 'Economic intent kon niet worden gemaakt.' };
    const intent = intentUit.intent;
    const dest = bestemmingen();
    const legs = [];
    for (const [component, bestemming] of [['local-fund', dest.lokaal], ['foundation', dest.foundation]]) {
      const claim = runtime.claimVoor(intent.id, component);
      const leg = { component, claimId: claim.id, centen: claim.amountMinor, currency: claim.currency,
        destinationRef: bestemming.destinationRef, iban: bestemming.iban, begunstigde: bestemming.begunstigde,
        settlementId: null, opdrachtId: null, providerRef: null, status: 'te_storten', fout: null };
      if (bestemming.iban) {
        const p = await runtime.planSettlement({ intentId: intent.id, claimId: claim.id,
          destinationRef: bestemming.destinationRef, rail: 'SEPA',
          idempotencyKey: 'social:' + component + ':' + hash(sourceRef).slice(0, 24) });
        if (!p || p.error) return p || { error: 'Settlement kon niet worden gepland.' };
        leg.settlementId = p.settlement.id; leg.status = 'gepland';
      }
      legs.push(leg);
    }
    return { ok: true, replay: intentUit.replay, intent, legs, berekening: c };
  }

  return { bestemmingen, bereken, registreer, actorRef };
};
