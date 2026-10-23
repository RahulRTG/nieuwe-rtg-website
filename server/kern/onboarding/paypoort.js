/* De identiteitsgrens voor het eerste RTG Pay-gebruik. Betaalde passen zijn al
   gekeurd tijdens toelating; ieder ander echt account moet eenmalig langs de
   paspoortstap. Demo- en gastsessies zonder account kunnen niets uploaden. */
'use strict';

module.exports = ({ profielVan, profielId, save }) => function payGate(sess) {
  const tier = (sess && sess.tier) || 'guest';
  if (tier === 'lifestyle' || tier === 'business') return { ok: true };
  const profiel = profielVan(profielId(sess));
  if (!profiel.payGebruikt) { profiel.payGebruikt = true; save(); }
  const acc = sess && sess.account;
  const geverifieerd = acc && ['pending', 'approved', 'geverifieerd', 'verified'].includes(acc.verified);
  if (!acc || geverifieerd) return { ok: true };
  return { ok: false, status: 403, kyc: true,
    error: 'RTG Pay vraagt eenmalig je paspoort. Open de app; Rahul helpt je het te bevestigen.' };
};
