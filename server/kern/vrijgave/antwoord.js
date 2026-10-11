/* DE BUITENKANT VAN DE VRIJGAVEPOORT: wat een klant te horen krijgt, met welke
   status, en hoe de gezondheid van een provider uit de omgeving wordt gelezen.
   Apart van het oordeel (./oordeel.js) omdat dit de stukken zijn die een scherm
   en een log LEZEN, en die horen niet te veranderen als het oordeel verandert. */
'use strict';

const CODES = Object.freeze(['bestaat-niet-voor-dit-product', 'tijdelijk-uit', 'niet-geautoriseerd',
  'provider-niet-beschikbaar', 'compliance-ontbreekt', 'geen-recht']);

const ZIN = Object.freeze({
  'bestaat-niet-voor-dit-product': 'Deze functie wordt in deze omgeving niet aangeboden. Er is niets uitgevoerd.',
  'tijdelijk-uit': 'Deze functie staat tijdelijk uit. Er is niets uitgevoerd; probeer het later opnieuw.',
  'niet-geautoriseerd': 'RTG mag deze handeling op dit moment niet verrichten. Er is niets uitgevoerd.',
  'provider-niet-beschikbaar': 'De partij die dit voor RTG uitvoert, is nu niet beschikbaar. Er is niets uitgevoerd.',
  'compliance-ontbreekt': 'Deze functie is nog niet voor gebruik vrijgegeven. Er is niets uitgevoerd.',
  'geen-recht': 'U heeft geen recht op deze functie. Er is niets uitgevoerd.'
});
/* 403 waar het over de AANVRAGER gaat, 503 waar het over het HUIS gaat. Een lid
   met een 403 hoeft niet opnieuw te proberen; met een 503 misschien straks wel. */
const STATUS = Object.freeze({ 'geen-recht': 403, 'niet-geautoriseerd': 403 });

/* De gezondheid van een provider uit de omgeving: sleutel EN de middelen om
   een terugmelding te vertrouwen. Zonder webhookgeheim kan een provider een
   betaling uitvoeren die RTG nooit betrouwbaar terug hoort; dat is geen gezonde
   rail maar een halve. Een sleutel alleen maakt een provider nooit "aan". */
function providerUitOmgeving(env) {
  return provider => {
    if (env.RTG_BETALEN_UIT === '1') return { gezond: false, reden: 'betalen staat bewust uit (RTG_BETALEN_UIT)' };
    const er = k => typeof env[k] === 'string' && env[k].length > 0;
    if (provider === 'stripe') return er('STRIPE_SECRET_KEY') && er('STRIPE_WEBHOOK_SECRET')
      ? { gezond: true } : { gezond: false, reden: 'Stripe-sleutel of webhookgeheim ontbreekt' };
    if (provider === 'stripe_connect') return er('STRIPE_SECRET_KEY') && er('STRIPE_CONNECT_WEBHOOK_SECRET')
      ? { gezond: true } : { gezond: false, reden: 'Stripe-sleutel of Connect-webhookgeheim ontbreekt' };
    if (provider === 'mollie') return er('MOLLIE_API_KEY')
      ? { gezond: true } : { gezond: false, reden: 'Mollie-sleutel ontbreekt' };
    if (provider === 'adyen') return er('ADYEN_API_KEY') && er('ADYEN_HMAC_KEY')
      ? { gezond: true } : { gezond: false, reden: 'Adyen-sleutel of HMAC-sleutel ontbreekt' };
    return { gezond: false, reden: 'onbekende provider' };
  };
}

module.exports = { CODES, ZIN, STATUS, providerUitOmgeving };
