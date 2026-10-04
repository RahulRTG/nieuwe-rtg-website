/* Opzet: hoeveel en welke proxy's de app vertrouwt voor req.ip.

   Afgesplitst uit ./verzoekketen.js, dat tegen de omvanggrens aan zat. Het
   draait op dezelfde plek in de keten: direct na de foutisolatie en vóór elke
   laag die req.ip leest (snelheidslimieten, het schild). */
'use strict';

module.exports = function proxyvertrouwen({ app }) {
  /* Hoeveel proxy-hops staan er ECHT voor deze app?

     Dit stond vast op 1. Dat klopt achter een reverse proxy, maar is gevaarlijk
     zodra de app rechtstreeks bereikbaar is: dan IS de bezoeker de eerste hop en
     mag hij zijn eigen X-Forwarded-For verzinnen -- waarmee elke snelheidslimiet
     (die op req.ip telt) met één kop te omzeilen is. Zie test/proxykop.test.js.

     RTG_PROXY_HOPS=0 zet het vertrouwen helemaal uit: dan telt alleen het adres
     van de verbinding zelf. Dat is de juiste stand voor een app die zonder proxy
     aan het internet hangt. */
  app.set('trust proxy', Number(process.env.RTG_PROXY_HOPS != null ? process.env.RTG_PROXY_HOPS : 1));
  /* WIE die proxy is. Zonder opgave vertrouwen we alleen loopback en private
     adressen -- de gebruikelijke plek voor een reverse proxy. Een bezoeker die
     rechtstreeks vanaf het internet binnenkomt valt daar nooit onder, dus zijn
     X-Forwarded-For wordt genegeerd in plaats van geloofd. Staat de proxy op een
     publiek adres, zet die dan hier (komma-gescheiden). */
  app.set('proxy ips', String(process.env.RTG_PROXY_IPS || '').split(',').map(s => s.trim()).filter(Boolean));
};
