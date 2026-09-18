/* De publieke vorm van een Salon-post. Apart van de opslaglogica zodat elke
   lezer dezelfde veilige projectie krijgt: nooit sleutels, wel het getypeerde
   moment, de publiekskeuze en een genormaliseerd Offer. */
'use strict';

module.exports = ({ S, vorm }) => function publiek(p, sess) {
  const s = S();
  const mij = sess && sess.key;
  return {
    id: p.id, author: p.author, tier: p.tier, place: p.place || null, at: p.at || null,
    partner: !!p.partner, partnerCode: p.partnerCode || null,
    text: p.text, lang: p.lang || 'nl', featured: !!p.featured,
    momentType: vorm.soort(p.momentType || (p.offer || p.deal ? 'offer' : 'moment')),
    publiek: vorm.publiek(p.publiek), startsAt: p.startsAt || null, endsAt: p.endsAt || null,
    offer: p.offer ? {
      titel: p.offer.titel || '', geldigTot: p.offer.geldigTot || null,
      capaciteit: Number.isFinite(p.offer.capaciteit) ? p.offer.capaciteit : null,
      actie: p.offer.actie || null
    } : (p.deal ? { titel: p.deal.titel || '', geldigTot: p.deal.geldigTot || null,
      capaciteit: null, actie: null } : null),
    media: Array.isArray(p.media) && p.media.length ? p.media
      : (p.photo ? [{ src: p.photo, alt: '' }] : []),
    onderwerpen: p.onderwerpen || [],
    likes: (p.baseLikes || 0) + Object.keys(p.likedBy || {}).length,
    liked: !!(p.likedBy && mij && p.likedBy[mij]),
    reacties: (p.comments || []).length,
    bewaard: !!(mij && (s.bewaard[mij] || []).includes(p.id)),
    vanMij: !!(mij && p.authorKey === mij),
    gearchiveerd: !!p.archief,
    reactiesVan: p.reactiesVan || 'iedereen'
  };
};
