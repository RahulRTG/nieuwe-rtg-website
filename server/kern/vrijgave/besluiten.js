'use strict';
/* De BESLUITEN die een regel kan eisen. Een besluit is een vastgelegd extern
   feit (een contract, een juridisch oordeel), en het wordt in de boardroom met
   bron en hash vastgelegd (./stand.js). Een besluitnaam die hier niet staat,
   kan niet worden vastgelegd -- anders is "autorisatie" een vrij tekstveld. */
const BESLUITEN = Object.freeze({
  'inkomend.handelaar': 'Handelaarscontract en KYB-dossier bij de betaalprovider zijn rond.',
  'provider.stripe': 'Overeenkomst met Stripe als betaalprovider, met afgerond KYB-dossier.',
  'provider.stripe_connect': 'Connect-platformovereenkomst met Stripe, inclusief de verantwoordelijkheid voor onboarding van verbonden accounts.',
  'provider.mollie': 'Overeenkomst met Mollie als betaalprovider, met afgerond KYB-dossier.',
  'provider.adyen': 'Overeenkomst met Adyen als betaalprovider, met afgerond KYB-dossier.',
  'emoney.b3': 'Extern juridisch besluit (B3): RTG neemt de positie in dat terugstortbaar saldo elektronisch geld is, met de vergunning of partnerconstructie die daarbij hoort.'
});

/* WELKE BESLUITEN EEN CONTRACT MET EEN ECHTE PROVIDER ZIJN. Een handelaars- of
   Connect-overeenkomst gaat over geld dat via DIE provider loopt; op een rail
   zonder echt geld (een sandbox op een neprail, ./oordeel.js) bestaat die
   provider niet en is het besluit niet van toepassing. Dat is GEEN versoepeling
   van de autorisatie: de sandbox zelf bestaat alleen buiten productie en buiten
   een openbaar adres (./lokaal.js), en de bevoegdheidslaag (`vermogen`) blijft
   ook in de sandbox gevraagd.

   `emoney.b3` staat er met opzet NIET in. Dat besluit gaat niet over een provider
   maar over de positie van RTG zelf (terugstortbaar saldo is elektronisch geld),
   en die positie verandert niet doordat de rail nep is. Zonder B3 blijft de
   IBAN-uitbetaling van een lid dus ook lokaal dicht. */
const PROVIDERCONTRACT = Object.freeze(['inkomend.handelaar', 'provider.stripe', 'provider.stripe_connect',
  'provider.mollie', 'provider.adyen']);

module.exports = { BESLUITEN, PROVIDERCONTRACT };
