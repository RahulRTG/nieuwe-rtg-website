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

module.exports = { BESLUITEN };
