/* RTG REVENUE CATALOG CONTRACT V1.

   Dit is een PROJECTIE, geen nieuwe winkel. De betekenis van de capability
   blijft in het functieregister, de inhoud van AI Extra S blijft in
   commercie/tegoed/inhoud.js en de prijs blijft in commercie/bundelprijs.js.
   Deze laag geeft die drie bestaande bronnen één versieerbare commerciële
   identiteit, zonder te betalen, tegoed te boeken of rechten te verlenen.

   De projectie is immutable. Dat is geen beveiligingsgrens -- autorisatie blijft
   bij de bestaande poorten -- maar voorkomt dat een aanroeper een gelezen
   catalogusobject als tijdelijke tweede waarheid gaat bewerken. */
'use strict';

const crypto = require('crypto');
const schema = require('./catalogus-v1.schema.json');
const { OP_ID } = require('../../functies/register');
const { BUNDELS } = require('../commercie/tegoed/inhoud');
const bundelprijs = require('../commercie/bundelprijs');
const { maakRevenueCatalogusValidator } = require('./catalogus-v1-validatie');
const diepVast = require('./immutable');

const CATALOG_ID = 'rtg.revenue.catalog';
const CATALOG_VERSION = '1.0.0';
const PRODUCT_ID = 'rtg.product.ai.extra-s';
const OFFER_ID = 'rtg.offer.ai.extra-s.a-la-carte';
const CAPABILITY_ID = 'service.gld-aitegoed';
const FEATURE_ID = 'gld-aitegoed';
const FORMULA_ID = 'rtg.ai.bundle-price@1';
const READ_ONLY_REASON = 'Catalogusproef: betaling, tegoed en commerciële rechten zijn niet aangesloten.';
const SOURCE_REFS = Object.freeze([
  Object.freeze({ role: 'CAPABILITY', file: 'server/functies/register/cat-domeinen4.js', symbol: 'gld-aitegoed' }),
  Object.freeze({ role: 'OFFER', file: 'server/kern/commercie/tegoed/inhoud.js', symbol: 'BUNDELS.ai-s' }),
  Object.freeze({ role: 'PRICING', file: 'server/kern/commercie/bundelprijs.js', symbol: 'prijsVan' })
]);

function canoniek(waarde) {
  if (Array.isArray(waarde)) return '[' + waarde.map(canoniek).join(',') + ']';
  if (waarde && typeof waarde === 'object') return '{' + Object.keys(waarde).sort()
    .map(k => JSON.stringify(k) + ':' + canoniek(waarde[k])).join(',') + '}';
  return JSON.stringify(waarde);
}

const CONTRACT_DIGEST = 'sha256:' + crypto.createHash('sha256').update(canoniek(schema)).digest('hex');

function prijsProjectie(instellingen) {
  const p = bundelprijs.prijsVan('ai-s', instellingen || {});
  const prijsfout = bundelprijs.keur(instellingen || {});
  const beschikbaar = Number.isInteger(p.centen) && p.centen >= 0 && !prijsfout;
  return {
    formulaId: FORMULA_ID,
    state: beschikbaar ? 'AVAILABLE' : 'UNAVAILABLE',
    currency: 'EUR',
    amountCenten: beschikbaar ? p.centen : null,
    taxTreatment: 'UNSPECIFIED',
    reason: beschikbaar ? null : String(prijsfout || p.reden || p.error || 'Geen prijs beschikbaar.')
  };
}

function projecteerAiExtraS(instellingen) {
  const feature = OP_ID[FEATURE_ID];
  const offer = BUNDELS['ai-s'];
  if (!feature) throw new Error('Revenue Catalog v1: capabilitybron gld-aitegoed ontbreekt.');
  if (!offer) throw new Error('Revenue Catalog v1: aanbiedingsbron ai-s ontbreekt.');

  return diepVast({
    schemaVersion: 1,
    catalogId: CATALOG_ID,
    catalogVersion: CATALOG_VERSION,
    contractDigest: CONTRACT_DIGEST,
    mode: 'READ_ONLY',
    products: [{
      productId: PRODUCT_ID,
      productVersion: 1,
      offerId: OFFER_ID,
      offerVersion: 1,
      capabilityId: CAPABILITY_ID,
      featureId: feature.id,
      name: offer.naam,
      description: offer.wat,
      kind: 'CAPACITY_ADD_ON',
      unit: { id: 'rtg-ai-credit', quantity: offer.credits },
      salesForms: ['A_LA_CARTE', 'BUNDLE_ELIGIBLE'],
      price: prijsProjectie(instellingen),
      availability: { catalogVisible: true, purchasable: false, reason: READ_ONLY_REASON },
      effects: {
        paymentInitiated: false,
        creditGranted: false,
        subscriptionActivated: false,
        entitlementGranted: false
      },
      sources: SOURCE_REFS.map(bron => ({ ...bron })),
      riskRefs: ['REV-AI-CREDIT-001']
    }]
  });
}

const valideer = maakRevenueCatalogusValidator({
  catalogId: CATALOG_ID, catalogVersion: CATALOG_VERSION, contractDigest: CONTRACT_DIGEST,
  productId: PRODUCT_ID, offerId: OFFER_ID, capabilityId: CAPABILITY_ID,
  featureId: FEATURE_ID, formulaId: FORMULA_ID, sourceRefs: SOURCE_REFS,
  offer: BUNDELS['ai-s'], canoniek
});

module.exports = {
  schema, CONTRACT_DIGEST, CATALOG_ID, CATALOG_VERSION, PRODUCT_ID, OFFER_ID,
  CAPABILITY_ID, FEATURE_ID, FORMULA_ID, SOURCE_REFS, projecteerAiExtraS, valideer, canoniek
};
