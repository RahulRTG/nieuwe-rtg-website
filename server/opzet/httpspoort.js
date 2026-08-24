/* ============================================================================
   ALLES NAAR HTTPS, EN HSTS ZODAT DE BROWSER HET ONTHOUDT.

   Stond in ./verzoekketen.js en is er als eigen laag afgeknipt toen die over de
   tienkilobytegrens ging -- zelfde naad als ./koppen.js en ./schildwacht.js:
   een laag die een verzoek kan omleiden voordat er een route naar kijkt.

   De security-headers zelf (inclusief Referrer-Policy) staan in ./koppen.js;
   daar gelden ze voor elk antwoord, ook lokaal.

   TWEE TAKKEN, en de tweede is de belangrijkste:

     PRODUCTION gezet   -- de bedoelde stand.
     GEEN vlag, maar de bezoeker komt van een ECHT DOMEIN -- de stand die er
     werkelijk was. Dit hing alleen aan PRODUCTION, en die vlag was op de echte
     server nooit gezet. Van buiten gemeten: http://app.rahultravelgroup.com/
     apps/app.html gaf gewoon 200 met de hele app, geen 301, en op https ontbrak
     HSTS. Elk sessietoken, elk wachtwoord en de backoffice-code gingen daarmee
     leesbaar over de lijn voor wie op http binnenkwam.

   Een slot dat opengaat als iemand een vlag vergeet, is geen slot. Daarom hangt
   het nu aan iets wat niet te vergeten valt: KOMT DIT VAN EEN ECHT DOMEIN? Wie
   op localhost of een adres in het eigen netwerk ontwikkelt, merkt niets (daar
   is ook geen certificaat); wie via een domeinnaam binnenkomt, wordt
   doorgestuurd en krijgt HSTS mee -- ook als NODE_ENV nergens staat.

   WAT ER NOOIT DOORHEEN GAAT: de interne kanalen. De poortwachter
   (server/trio.js) controleert zijn drie servers op /api/health over gewone http
   op de loopback -- daar hoort geen TLS bij, en er komt dus ook geen
   X-Forwarded-Proto mee. Kreeg die prik een 301, dan zag de poortwachter nooit
   een 200, concludeerde hij dat geen enkele server leefde, en gaf de site 503
   terwijl alle drie de servers kerngezond stonden te draaien. De
   failover-opstelling kon in productie dus nooit gezond worden. Dat gebeurde op
   de eerste echte productiemachine, en het is van buitenaf niet te zien: lsof
   laat drie luisterende servers zien en de browser krijgt "alle servers zijn
   tijdelijk onbereikbaar". Hetzelfde geldt voor /api/ready en voor de
   healthcheck in de Dockerfile.

   En voor het hele /api/cluster-kanaal: het interne gesprek tussen poortwachter
   en servers (promote, de hartslag, het doorgeven van wie de baas is). Ook http,
   ook loopback. Alleen /api/health vrijstellen was half werk: de prik lukte
   daarna wel, maar promote kreeg nog een 301, er werd dus nooit iemand actief,
   en de site bleef 503 geven. Dat kanaal is niet van buiten te misbruiken: het
   eist de gedeelde x-rtg-cluster-sleutel en luistert alleen op 127.0.0.1 (zie de
   HOST-keuze in ./luister.js).
   ========================================================================== */
'use strict';
const { lokaalAdres } = require('../lib/lokaaladres');

const HSTS = 'max-age=31536000; includeSubDomains';

/* De uitzonderingslijst stond er twee keer, een keer per tak. Twee kopieen van
   een uitzonderingslijst is de plek waar er ooit een pad in de ene wel en in de
   andere niet staat, dus staat hij hier een keer. */
function internKanaal(pad) {
  return pad === '/api/health' || pad === '/api/ready' || pad.indexOf('/api/cluster/') === 0;
}

module.exports = function httpspoort({ app, PRODUCTION }) {
  app.use((req, res, next) => {
    const intern = internKanaal(req.path);
    /* Buiten productie geldt dit alleen voor een ECHT domein. Welke adressen als
       lokaal tellen en waarom, staat in ../lib/lokaaladres.js -- kort: adressen
       waarvoor niemand een certificaat kan krijgen, en doorsturen naar https is
       daar doorsturen naar niets. */
    if (!PRODUCTION && lokaalAdres(req.get('host'))) return next();
    if (!req.secure && !intern) return res.redirect(301, 'https://' + req.get('host') + req.originalUrl);
    if (req.secure) res.set('Strict-Transport-Security', HSTS);
    next();
  });
};

module.exports.internKanaal = internKanaal;
module.exports.HSTS = HSTS;
