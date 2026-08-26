/* De publieke ledenstatus van RTG.

   Deze namen zijn bewust iets anders dan de technische pas-trap. Een pas
   bepaalt welke deuren openstaan; de ledenstatus vertelt wat voor plaats iemand
   in de society heeft. De merkregel is:

     RTG Pass / Business Lite  -> Verified
     Lifestyle / Business     -> Signature

   `Signature` is dus geen reputatiescore en kan nooit door likes, bereik of
   gedrag worden verdiend. `Member` betekent dat iemand tot de gecureerde
   community is toegelaten. De paspoortcontrole blijft een aparte waarheid:
   een account kan tijdens onboarding al een Verified-membership hebben terwijl
   de identiteitscontrole nog loopt. Die twee mogen in API of scherm nooit tot
   één misleidend vinkje worden samengevoegd. */
'use strict';

const PASSEN = Object.freeze({
  rtg: { id: 'rtg', naam: 'RTG Pass', soort: 'persoonlijk', status: 'verified' },
  business_lite: { id: 'business_lite', naam: 'Business Lite', soort: 'zakelijk', status: 'verified' },
  lifestyle: { id: 'lifestyle', naam: 'Lifestyle', soort: 'lifestyle', status: 'signature' },
  business: { id: 'business', naam: 'Business', soort: 'zakelijk', status: 'signature' }
});

const STATUSSEN = Object.freeze({
  verified: { id: 'verified', naam: 'Verified' },
  signature: { id: 'signature', naam: 'Signature' }
});

/* Eén identiteit, vijf intenties. Dit is navigatie, geen tweede rechtenlijst:
   de twee exclusieve lenzen volgen uitsluitend uit de status hierboven. De
   doelapps houden daarnaast altijd hun eigen serverpoort. */
const LENZEN = Object.freeze([
  { id: 'dating', naam: 'Dating', url: '/apps/rendezvous.html', eist: 'signature' },
  { id: 'friends', naam: 'Friends', url: '/apps/wereld.html', eist: null },
  { id: 'business', naam: 'Business', url: '/apps/zakelijk.html', eist: 'signature' },
  { id: 'travel', naam: 'Travel', url: '/apps/reizen.html', eist: null },
  { id: 'events', naam: 'Events', url: '/apps/avond.html', eist: null }
]);

function normaliseer(tier) {
  const waarde = String(tier || '').trim().toLowerCase().replace(/[ -]+/g, '_');
  return waarde === 'businesslite' ? 'business_lite' : waarde;
}

function identiteit(stand) {
  if (stand === 'verified') return { id: 'verified', naam: 'Identiteit geverifieerd' };
  if (stand === 'rejected') return { id: 'rejected', naam: 'Identiteitscontrole afgewezen' };
  return { id: 'pending', naam: 'Identiteitscontrole loopt' };
}

function voor({ tier, verified } = {}) {
  const pas = PASSEN[normaliseer(tier)];
  if (!pas) return null;
  return {
    member: { id: 'member', naam: 'Member' },
    pas: { id: pas.id, naam: pas.naam, soort: pas.soort },
    status: STATUSSEN[pas.status],
    identiteit: identiteit(verified)
  };
}

function voorSessie(sess) {
  const s = sess || {};
  return voor({ tier: s.tier, verified: s.account ? s.account.verified : 'verified' });
}

function lenzenVoor(tier) {
  const lid = voor({ tier, verified: 'verified' });
  if (!lid) return [];
  return LENZEN.map(lens => ({
    id: lens.id,
    naam: lens.naam,
    url: lens.url,
    open: !lens.eist || lid.status.id === lens.eist,
    reden: !lens.eist || lid.status.id === lens.eist ? null : 'Exclusief voor Signature-members.'
  }));
}

module.exports = { PASSEN, STATUSSEN, LENZEN, normaliseer, voor, voorSessie, lenzenVoor };
