/* Onderwijs (deelmodule): EEN ACCOUNT VOOR DE LES (eigenaarsbesluit 19 oktober
   2026: gebruiken vraagt een account). Een les MAKEN vraagt een ingelogd
   account; MEEDOEN een account of een gezinsprofiel onder het account van een
   ouder (gezinCode + gezinToken in het lijf; profielVan past de accountplicht
   toe, foundation/accountplicht.js). De lescode en de lessleutels blijven een
   EXTRA sleutel; zonder lessleutel geven de lesroutes nog steeds 403. De
   gezinsregels staan pas na het opstarten op de context (foundation.js zet ze
   later), en worden dus per verzoek gelezen. Uit ./les.js geknipt op de
   10 kB-grens. */
'use strict';

const testomgeving = require('../../testomgeving');
// losSessie IS de centrale resolveSession (gemonteerd in kern/isolatie/sessiedragers.js)
const { losSessie: resolveSession } = require('../../kern/isolatie/sessiedragers');

module.exports = (gezinsCtx) => {
  const GEEN_ACCOUNT = { error: 'Log in met je RTG-account; een gratis account is genoeg.', accountNodig: true };
  function metAccount(req) {
    const h = (req.get && req.get('authorization')) || '';
    const t = h.startsWith('Bearer ') ? h.slice(7) : '';
    let s = null;
    try { s = t ? resolveSession(t) : null; } catch (e) { s = null; }
    return !!(s && (s.account || testomgeving.actief(process.env)));
  }
  function alsGezinslid(req) {
    const b = req.body || {};
    if (!gezinsCtx || typeof gezinsCtx.G !== 'function' || !b.gezinCode || !b.gezinToken) return false;
    const g = gezinsCtx.G()[String(b.gezinCode).toUpperCase()];
    return !!(g && gezinsCtx.profielVan(g, String(b.gezinToken)));
  }
  return { metAccount, alsGezinslid, GEEN_ACCOUNT };
};
