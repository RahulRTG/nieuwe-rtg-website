'use strict';

// Rit en tickettransfer delen dezelfde object- en betaalidentiteit. De oude
// 24-bit code kon een verse rit dezelfde idem-identiteit als een betaalde rit
// geven. Meer entropie plus een botsingscontrole vóór publicatie voorkomt dat.
module.exports = (ritten, crypto) => {
  const bezet = new Set(ritten.map(r => r.ref));
  for (let poging = 0; poging < 8; poging++) {
    const ref = 'RTG-R-' + crypto.randomBytes(16).toString('hex').toUpperCase();
    if (!bezet.has(ref)) return ref;
  }
  return null; // ook bij een defecte randombron geen dubbel object publiceren
};
