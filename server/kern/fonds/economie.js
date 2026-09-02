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
      /* EEN CLAIM WORDT GEPLAND, OOK ZONDER IBAN -- en dat is de reparatie.

         Hier stond dit blok achter `if (bestemming.iban)`. Zonder rekeningnummer
         kreeg de leg dus geen settlementId, en ../fonds/uitbetalen.js stopt op
         precies dat veld. Gevolg: stond de boardroom-knop op "eigen" terwijl er
         nog geen RTF_IBAN was vastgelegd, dan gebeurde er NIETS -- geen boeking,
         geen opdracht, en `foundationCenten` bleef op nul staan terwijl het lid
         wel had betaald. Niets brak; er stond alleen niets, en dat is de
         vervelendste soort.

         DE RAIL IS NIET DE BESTEMMING. Een IBAN zegt hoe het geld naar BUITEN
         gaat; de eigen-grootboekrail brengt het niet naar buiten maar boekt het
         van rtg:reserve naar extern:foundation, binnen ons eigen boek. De claim
         blijft EXTERNAL -- het geld is een andere rechtspersoon verschuldigd --
         maar hij wordt over een interne rail voldaan. Vandaar `INTERN` in plaats
         van `SEPA`: de runtime houdt claim, ledger en bewijs, en de rail zegt
         alleen waarlangs het is gegaan.

         Zonder IBAN EN zonder eigen rail verandert er niets: uitbetalen.js valt
         dan terug op de opdrachtenrij, die wel een rekeningnummer eist, en de
         leg blijft op te_storten wachten op de rekening. Dat is de bestaande
         belofte en die blijft staan. */
      const opEigenBoek = !bestemming.iban;
      const p = await runtime.planSettlement({ intentId: intent.id, claimId: claim.id,
        destinationRef: bestemming.destinationRef, rail: opEigenBoek ? 'INTERN' : 'SEPA',
        idempotencyKey: 'social:' + component + ':' + hash(sourceRef).slice(0, 24) });
      if (!p || p.error) return p || { error: 'Settlement kon niet worden gepland.' };
      leg.settlementId = p.settlement.id;
      /* DE STAND VAN DE LEG VOLGT DE RAIL, NIET DE PLANNING. `gepland` staat
         voor "er ligt een weg naar buiten"; zonder IBAN ligt die er niet, en
         dan blijft de leg op te_storten wachten op de rekening. Hem hier toch
         op gepland zetten maakt van een openstaande verplichting een belofte
         die het huis niet kan waarmaken -- precies de fout die de kop van
         ./uitbetalen.js beschrijft ("van een mislukking weer een belofte").

         De settlement in de runtime is iets anders en wordt wel aangemaakt: dat
         is de administratie van de claim, en die hoort er te zijn ook als er
         nog geen rail is. */
      if (!opEigenBoek) leg.status = 'gepland';
      legs.push(leg);
    }
    return { ok: true, replay: intentUit.replay, intent, legs, berekening: c };
  }

  return { bestemmingen, bereken, registreer, actorRef };
};
