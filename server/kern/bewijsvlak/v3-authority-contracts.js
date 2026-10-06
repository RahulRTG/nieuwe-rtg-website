/* Declarative, versioned authority/source contracts. Validation and the opaque
   one-use grants live in v3-authorities.js; this module owns no runtime state. */
'use strict';

const PAYMENT_PROVIDERS = Object.freeze(['adyen', 'mollie', 'stripe']);

const BUILTIN = Object.freeze([
  { id: 'money.domain', version: 1, signer: 'rtg:money-domain-adapter',
    factTypes: ['payment.ledger.posted', 'payment.reconciliation.matched'], truthClasses: ['DOMAIN'],
    scopes: ['payment.ledger', 'payment.reconcile'], sourceTypes: ['rtg-payment-truth'],
    sourceRefs: ['betaalwaarheid'], authorityIds: ['rtg:payment'], authorityBases: ['domain-ownership'],
    operationDomains: ['money'], capabilities: ['payment.authorize'] },
  { id: 'money.provider', version: 1, signer: 'rtg:money-provider-adapter',
    factTypes: ['payment.provider.settled', 'payment.reversed', 'payment.disputed'], truthClasses: ['EXTERNAL'],
    scopes: ['payment.settlement'], sourceTypes: ['verified-payment-provider', 'verified-payment-provider-lookup'],
    authorityBases: ['verified-provider-channel'], operationDomains: ['money'],
    capabilities: ['payment.authorize'], providers: PAYMENT_PROVIDERS,
    providerRequired: true, sourceRefEqualsProvider: true, authorityIdProviderPrefix: 'provider:' },
  { id: 'money.execution', version: 1, signer: 'rtg:money-execution-adapter',
    factTypes: ['payment.provider.outcome_unknown'], truthClasses: ['TECHNICAL'], scopes: ['payment.execution'],
    sourceTypes: ['rtg-payment-execution'], sourceRefs: ['betaalwaarheid'], authorityIds: ['rtg:payment'],
    authorityBases: ['domain-ownership'], operationDomains: ['money'], capabilities: ['payment.authorize'] },
  { id: 'external.domain', version: 1, signer: 'rtg:external-domain-adapter',
    factTypes: ['external.commitment.recorded', 'external.cancelled', 'external.disputed'], truthClasses: ['DOMAIN'],
    scopes: ['external.commitment', 'external.correction'], sourceTypes: ['rtg-external-domain'],
    sourceRefs: ['reservation'], authorityIds: ['rtg:external'], authorityBases: ['domain-ownership'],
    operationDomains: ['external'], capabilities: ['external.fulfill', 'reservation.request'] },
  { id: 'external.provider', version: 1, signer: 'rtg:external-provider-adapter',
    factTypes: ['external.provider.confirmed', 'external.cancelled', 'external.disputed'], truthClasses: ['EXTERNAL'],
    scopes: ['external.confirmation', 'external.correction'], sourceTypes: ['hospitality-provider'],
    authorityBases: ['verified-provider-channel'], operationDomains: ['external'],
    capabilities: ['external.fulfill', 'reservation.request'], providerRequired: true, sourceRefEqualsProvider: true,
    authorityIdProviderPrefix: 'provider:' },
  { id: 'external.operational', version: 1, signer: 'rtg:external-outcome-adapter',
    factTypes: ['external.outcome.observed'], truthClasses: ['OPERATIONAL'], scopes: ['external.outcome'],
    sourceTypes: ['authorized-fulfillment-observer'], authorityBases: ['authorized-observer'],
    operationDomains: ['external'], capabilities: ['external.fulfill', 'reservation.request'], authorityIdSourcePrefix: 'observer:' },
  { id: 'authority.owner', version: 1, signer: 'rtg:authority-owner-adapter',
    factTypes: ['authority.granted', 'authority.revoked'], truthClasses: ['DOMAIN'],
    scopes: ['authority.grant', 'authority.revoke'], sourceTypes: ['rtg-authority'], sourceRefs: ['consent-kernel'],
    authorityIds: ['rtg:authority'], authorityBases: ['authority-owner'], operationDomains: ['authority'],
    capabilities: ['authority.revoke'] },
  { id: 'authority.expiry', version: 1, signer: 'rtg:authority-expiry-adapter',
    factTypes: ['authority.expired'], truthClasses: ['DOMAIN'], scopes: ['authority.expire'],
    sourceTypes: ['rtg-authority'], sourceRefs: ['consent-kernel'], authorityIds: ['rtg:authority'],
    authorityBases: ['authority-owner'], operationDomains: ['authority'], capabilities: ['authority.revoke'] },
  { id: 'authority.propagation', version: 1, signer: 'rtg:authority-propagation-adapter',
    factTypes: ['authority.revocation.propagated'], truthClasses: ['TECHNICAL'], scopes: ['authority.propagate'],
    sourceTypes: ['rtg-authority-propagation'], sourceRefs: ['connection-runtime'],
    authorityIds: ['rtg:authority'], authorityBases: ['authority-propagation'], operationDomains: ['authority'],
    capabilities: ['authority.revoke'] },
  { id: 'trust.decision', version: 1, signer: 'rtg:policy-decision-adapter',
    factTypes: ['decision.recorded'], truthClasses: ['TECHNICAL'], scopes: ['decision.record'],
    sourceTypes: ['rtg-policy-engine'], authorityBasesPrefix: 'policy:', operationDomains: ['trust'],
    capabilities: ['trust.decision'], sourceRefEqualsAuthorityId: true }
]);

module.exports = { PAYMENT_PROVIDERS, BUILTIN };
