/* EEN STAND-BY BEVESTIGT NIETS (N6 van de V1-audit, besluit van de eigenaar op
   5 oktober 2026).

   Een proces dat niet schrijft (db.writable false: RTG_ROL=standby in het trio,
   of een server die de poortwachter net heeft afgezet) liet een schrijfverzoek
   gewoon door. De route deed haar werk in het geheugen, bewaar() keerde stil
   terug (../db/index.js), en het antwoord was 200. De klant las "gelukt" over
   iets dat nergens stond. Een betaalwebhook die zo binnenkwam, was voor de
   aanbieder afgeleverd en voor RTG verdwenen.

   De poortwachter stuurt een stand-by geen verkeer (../trio-wacht.js), maar dat
   lukt niet altijd. Een verzoek dat al onderweg was terwijl de server werd
   afgezet, en de werkers van RTG_POORTWACHTERS die hun stand pas na de hartslag
   krijgen, komen er nog wel. Daarvoor staat deze laag.

   DE REGEL: zolang dit proces niet schrijft, krijgt elk verzoek met een methode
   die iets kan veranderen een 503 met de reden en een Retry-After. Een webhook
   probeert het dan opnieuw, en een klant ziet eerlijk dat het niet lukte.

   Doorgelaten worden:
   - leesmethoden (GET, HEAD, OPTIONS);
   - /api/cluster/*: daar zet de poortwachter de rol, en zonder die route wordt
     een stand-by nooit meer leider. Die route vraagt zelf al de clustersleutel.

   WAAROM ELKE POST EN NIET ALLEEN DE SCHRIJVENDE: in dit huis is ook veel lezen
   een POST, en welke route schrijft is per route niet vast te stellen zonder het
   effect te meten. Een stand-by hoort helemaal geen verkeer te krijgen, dus een
   te strenge weigering kost hier niets. Een stille 200 kost een bestelling, een
   saldo of een betaling.

   Staat VOOR de betaalwebhooks en de body-lezer (./verzoekketen.js): een
   weigering hoeft het lijf niet te lezen.

   EN EEN TWEEDE BLIK BIJ HET ANTWOORD (N11): een verzoek dat hier nog door
   mocht en tijdens zijn werk de afzetting meemaakte, krijgt geen 200 maar een
   503. Waarom en waar precies staat in ./standbypoort-antwoord.js. */
'use strict';

const { bewaakAntwoord } = require('./standbypoort-antwoord');

const LEZEN = new Set(['GET', 'HEAD', 'OPTIONS']);

function standbyPoort(db) {
  return function (req, res, next) {
    if (LEZEN.has(req.method)) return next();
    // De clusterroute blijft vrij, ook bij het antwoord: de demote zelf zegt 200.
    if (String(req.path || '').startsWith('/api/cluster/')) return next();
    if (db.writable) { bewaakAntwoord(res, db); return next(); }
    res.set('Retry-After', '2');
    res.status(503).json({ error: 'Deze server is stand-by en neemt nu geen wijzigingen aan. Probeer het over een paar seconden opnieuw.' });
  };
}

module.exports = ({ app, db }) => { app.use(standbyPoort(db)); };
module.exports.standbyPoort = standbyPoort;
