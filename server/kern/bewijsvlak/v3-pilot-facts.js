'use strict';

const MONEY = Object.freeze({
  'payment.ledger.posted': Object.freeze({ contract: 'money.domain', truthClass: 'DOMAIN',
    scope: 'payment.ledger', protocol: 'COMMITMENT', sourceType: 'rtg-payment-truth',
    sourceRef: 'betaalwaarheid', authorityId: 'rtg:payment', authorityBasis: 'domain-ownership',
    owner: 'payment-truth', retentionContract: 'money.domain-source' }),
  'payment.reconciliation.matched': Object.freeze({ contract: 'money.domain', truthClass: 'DOMAIN',
    scope: 'payment.reconcile', protocol: 'SETTLEMENT', sourceType: 'rtg-payment-truth',
    sourceRef: 'betaalwaarheid', authorityId: 'rtg:payment', authorityBasis: 'domain-ownership',
    owner: 'payment-truth', retentionContract: 'money.domain-source' }),
  'payment.provider.settled': Object.freeze({ contract: 'money.provider', truthClass: 'EXTERNAL',
    scope: 'payment.settlement', protocol: 'SETTLEMENT', sourceType: 'verified-payment-provider', external: true }),
  'payment.reversed': Object.freeze({ contract: 'money.provider', truthClass: 'EXTERNAL',
    scope: 'payment.settlement', protocol: 'SETTLEMENT', sourceType: 'verified-payment-provider', external: true }),
  'payment.disputed': Object.freeze({ contract: 'money.provider', truthClass: 'EXTERNAL',
    scope: 'payment.settlement', protocol: 'SETTLEMENT', sourceType: 'verified-payment-provider', external: true }),
  'payment.provider.outcome_unknown': Object.freeze({ contract: 'money.execution', truthClass: 'TECHNICAL',
    scope: 'payment.execution', protocol: 'EXECUTION', sourceType: 'rtg-payment-execution',
    sourceRef: 'betaalwaarheid', authorityId: 'rtg:payment', authorityBasis: 'domain-ownership',
    owner: 'payment-truth', retentionContract: 'money.domain-source' })
});

const EXTERNAL = Object.freeze({
  'external.commitment.recorded': Object.freeze({ contract: 'external.domain', truthClass: 'DOMAIN',
    scope: 'external.commitment', protocol: 'COMMITMENT', sourceType: 'rtg-external-domain',
    sourceRef: 'reservation', authorityId: 'rtg:external', authorityBasis: 'domain-ownership',
    owner: 'hospitality-domain', retentionContract: 'hospitality.domain-source' }),
  'external.disputed': Object.freeze({ contract: 'external.domain', truthClass: 'DOMAIN',
    scope: 'external.correction', protocol: 'CONFIRMATION', sourceType: 'rtg-external-domain',
    sourceRef: 'reservation', authorityId: 'rtg:external', authorityBasis: 'domain-ownership',
    owner: 'hospitality-domain', retentionContract: 'hospitality.domain-source' }),
  'external.provider.confirmed': Object.freeze({ contract: 'external.provider', truthClass: 'EXTERNAL',
    scope: 'external.confirmation', protocol: 'CONFIRMATION', sourceType: 'hospitality-provider', external: true }),
  'external.cancelled': Object.freeze({ contract: 'external.provider', truthClass: 'EXTERNAL',
    scope: 'external.correction', protocol: 'CONFIRMATION', sourceType: 'hospitality-provider', external: true }),
  'external.outcome.observed': Object.freeze({ contract: 'external.operational', truthClass: 'OPERATIONAL',
    scope: 'external.outcome', protocol: 'OUTCOME', sourceType: 'authorized-fulfillment-observer', operational: true })
});

const AUTHORITY = Object.freeze({
  'authority.granted': Object.freeze({ contract: 'authority.owner', truthClass: 'DOMAIN',
    scope: 'authority.grant', sourceType: 'rtg-authority', sourceRef: 'consent-kernel',
    authorityId: 'rtg:authority', authorityBasis: 'authority-owner', owner: 'connection-consent',
    retentionContract: 'authority.owner-source' }),
  'authority.expired': Object.freeze({ contract: 'authority.expiry', truthClass: 'DOMAIN',
    scope: 'authority.expire', sourceType: 'rtg-authority', sourceRef: 'consent-kernel',
    authorityId: 'rtg:authority', authorityBasis: 'authority-owner', owner: 'connection-consent',
    retentionContract: 'authority.owner-source' }),
  'authority.revoked': Object.freeze({ contract: 'authority.owner', truthClass: 'DOMAIN',
    scope: 'authority.revoke', sourceType: 'rtg-authority', sourceRef: 'consent-kernel',
    authorityId: 'rtg:authority', authorityBasis: 'authority-owner', owner: 'connection-consent',
    retentionContract: 'authority.owner-source' }),
  'authority.revocation.propagated': Object.freeze({ contract: 'authority.propagation', truthClass: 'TECHNICAL',
    scope: 'authority.propagate', sourceType: 'rtg-authority-propagation', sourceRef: 'connection-runtime',
    authorityId: 'rtg:authority', authorityBasis: 'authority-propagation', owner: 'connection-consent',
    retentionContract: 'authority.propagation-source' })
});

module.exports = { MONEY, EXTERNAL, AUTHORITY };
