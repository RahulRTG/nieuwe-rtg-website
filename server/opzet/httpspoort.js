/* ============================================================================
   DE HTTPS-POORT: stap 4 van de voordeurketen (../opzet/verzoekketen.js).

   WAAROM DIT EEN EIGEN BESTAND IS. De keten noemt acht stappen, en stap 5, 6 en
   8 wonen al elk in een eigen bestand (./schildwacht.js, ./koppen.js,
   ./lijfpoort.js). Deze stap niet -- hij stond als enige uitgeschreven in de
   keten zelf, en duwde dat bestand tegen de 10 kB-grens van keuringsregel 13 aan
   (10219 van 10240: een regel erbij en de keuring zakte). De naad is dus niet
   voor de gelegenheid bedacht maar de enige die er nog niet was.

   WAT HIER GEBEURT, in een zin: wie over http binnenkomt wordt naar https
   gestuurd en krijgt HSTS mee -- behalve de interne kanalen, en behalve op
   adressen waarvoor geen certificaat kan bestaan. De redenen daaronder staan bij
   de code zelf, want elk van die uitzonderingen komt uit een storing die echt is
   gebeurd.
   ========================================================================== */
'use strict';
const { lokaalAdres } = require('../lib/lokaaladres');

module.exports = function httpspoort({ app, PRODUCTION }) {
  app.use((req, res, next) => {
    if (PRODUCTION) {
      /* De gezondheidsprikken gaan hier NIET doorheen. De poortwachter
         (server/trio.js) controleert zijn drie servers op /api/health over
         gewone http op de loopback -- daar hoort geen TLS bij, en er komt dus
         ook geen X-Forwarded-Proto mee. Kreeg die prik een 301, dan zag de
         poortwachter nooit een 200, concludeerde hij dat geen enkele server
         leefde, en gaf de site 503 terwijl alle drie de servers kerngezond
         stonden te draaien. De failover-opstelling kon in productie dus nooit
         gezond worden. Dat gebeurde op de eerste echte productiemachine, en het
         is van buitenaf niet te zien: lsof laat drie luisterende servers zien
         en de browser krijgt "alle servers zijn tijdelijk onbereikbaar".
         Hetzelfde geldt voor /api/ready en voor de healthcheck in de Dockerfile. */
      /* Hetzelfde geldt voor het hele /api/cluster-kanaal. Dat is het interne
         gesprek tussen poortwachter en servers: promote (word actief), de
         hartslag, het doorgeven van wie de baas is. Ook http, ook loopback.
         Alleen /api/health vrijstellen was half werk: de prik lukte daarna wel,
         maar promote kreeg nog een 301, er werd dus nooit iemand actief, en de
         site bleef 503 geven. Dit kanaal is niet van buiten te misbruiken: het
         eist de gedeelde x-rtg-cluster-sleutel en luistert alleen op 127.0.0.1
         (zie de HOST-keuze in ./luister.js). */
      const intern = req.path === '/api/health' || req.path === '/api/ready' ||
        req.path.indexOf('/api/cluster/') === 0;
      if (!req.secure && !intern) return res.redirect(301, 'https://' + req.get('host') + req.originalUrl);
      if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    /* EN OOK ZONDER DIE VLAG, als de bezoeker van een ECHT DOMEIN komt.

       Dit hing alleen aan PRODUCTION, en die vlag was op de echte server nooit
       gezet. Van buiten gemeten: http://app.rahultravelgroup.com/apps/app.html
       gaf gewoon 200 met de hele app, geen 301, en op https ontbrak HSTS. Elk
       sessietoken, elk wachtwoord en de backoffice-code gingen daarmee leesbaar
       over de lijn voor wie op http binnenkwam.

       Een slot dat opengaat als iemand een vlag vergeet, is geen slot -- dat is
       vandaag de vierde keer dat diezelfde vorm bovenkomt. Daarom hangt het nu
       aan iets wat niet te vergeten valt: KOMT DIT VAN EEN ECHT DOMEIN? Wie op
       localhost of een adres in het eigen netwerk ontwikkelt, merkt niets (daar
       is ook geen certificaat); wie via een domeinnaam binnenkomt, wordt
       doorgestuurd en krijgt HSTS mee -- ook als NODE_ENV nergens staat. */
    if (!PRODUCTION) {
      /* Welke adressen tellen als lokaal, en waarom, staat in
         ../lib/lokaaladres.js. Kort: adressen waarvoor niemand een certificaat
         kan krijgen -- doorsturen naar https is daar doorsturen naar niets. */
      const lokaal = lokaalAdres(req.get('host'));
      if (!lokaal) {
        const intern2 = req.path === '/api/health' || req.path === '/api/ready' ||
          req.path.indexOf('/api/cluster/') === 0;
        if (!req.secure && !intern2) return res.redirect(301, 'https://' + req.get('host') + req.originalUrl);
        if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }
    }
    next();
  });
};
