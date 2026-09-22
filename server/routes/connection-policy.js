/* De HTTP-voordeur van Connection OS. De kern/ontmoetpoort blijft de
   handhaver achter de route; deze laag koppelt elke route expliciet aan één
   capability en levert stabiele foutcodes aan de schermen. */
'use strict';

const policy = require('../kern/connection-policy');

module.exports = ({ product, accounts, leeftijdVan, identityAtCore }) => {
  function toestand(req) {
    const sess = req.session || {};
    let account = null, md = null, leeftijd = null;
    try { account = sess.account && accounts.getUserById(sess.account.id); } catch (e) {}
    try { md = account && accounts.getMemberState(account.id); } catch (e) {}
    try { leeftijd = md && md.geboren ? leeftijdVan(md.geboren) : null; } catch (e) {}
    /* Vonk krijgt accounts/leeftijd bewust niet door zijn domeingrens. Daar
       handhaaft elke kernfunctie ontmoetPoort zelf. De route beoordeelt dan de
       capability en pas; `verified/adult` betekent hier uitsluitend dat deze
       tweede poort bij de kern ligt, niet dat de eis vervalt. */
    return { pass: sess.tier,
      verified: identityAtCore ? true : !!account && account.verified === 'verified',
      adult: identityAtCore ? true : leeftijd != null && leeftijd >= 18 };
  }

  function fout(decision) {
    if (decision.code === 'PASS_REQUIRED') return product === 'rendezvous'
      ? 'Rendez-vous is voor Signature-members met een Lifestyle Pass of Business Pass.'
      : 'Vonk is voor leden met een pas.';
    if (decision.code === 'IDENTITY_REQUIRED')
      return 'Verifieer eerst uw identiteit. Zo weet ieder lid dat de ander echt is.';
    if (decision.code === 'AGE_REQUIRED')
      return (product === 'rendezvous' ? 'Rendez-vous' : 'Vonk') + ' is uitsluitend voor geverifieerde leden van 18 jaar en ouder.';
    return decision.reden || 'Deze handeling is niet toegestaan.';
  }

  function eis(req, res, capability, actor) {
    const d = policy.beslis({ actor: actor || 'member', product, capability, state: toestand(req) });
    if (d.allow) return true;
    res.status(403).json({ code: d.code, error: fout(d) });
    return false;
  }

  return { eis, toestand };
};
