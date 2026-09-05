/* De productie-keuring, deel GELD: Stripe, Mollie, Adyen, munt-acceptatie en de
   RTF-afdracht.

   Afgesplitst uit ./productie.js omdat dat bestand over de 10 kB-grens liep en
   de keuring er al maanden op wees dat het er vlak onder zat. Dit is de naad
   die er toch al lag: alle regels hieronder gaan over de vraag of er ECHT geld
   kan bewegen, en die vraag heeft een eigen toon. Waar de rest van de keuring
   waarschuwt, hoort het hier meestal hard te zijn: een betaalpad dat half
   aanstaat boekt geld weg dat er niet is.

   Gemount vanuit ./productie.js; dezelfde (env, fouten, waarschuwingen). */
'use strict';

function keurGeld(env, fouten, waarschuwingen) {
    const betalingenUit = env.RTG_BETALEN_UIT === '1';
    const oudeDemoVlag = env.STRIPE_DEMO_BEWUST === '1';
    /* Productie kent geen synthetische betaalprovider. Zonder echte provider
       moet de hele rail aantoonbaar fail-closed uit staan. Testbetalingen horen
       uitsluitend bij de afzonderlijke Magnaat Test-installatie. */
    const echteProvider = !!(env.STRIPE_SECRET_KEY || env.MOLLIE_API_KEY || env.ADYEN_API_KEY);
    if (betalingenUit) {
      if (echteProvider || env.STRIPE_WEBHOOK_SECRET || env.ADYEN_HMAC_KEY ||
          env.MUNT_PROVIDER_KEY || env.MUNT_WEBHOOK_SECRET)
        fouten.push('RTG_BETALEN_UIT=1 botst met ingestelde betaalgeheimen. Verwijder de provider- en webhook-sleutels: een uitgeschakelde betaalrail hoort niets te kunnen bereiken.');
      if (oudeDemoVlag)
        fouten.push('STRIPE_DEMO_BEWUST wordt niet meer ondersteund. Testbetalingen horen uitsluitend bij Magnaat Test.');
      if (env.MUNT_AAN === '1')
        fouten.push('RTG_BETALEN_UIT=1 botst met MUNT_AAN=1. Ook muntbetalingen moeten uit blijven.');
      waarschuwingen.push('RTG_BETALEN_UIT=1: alle betaalrails, webhooks, terugbetalingen en uitbetalingen weigeren fail-closed.');
      return;
    }
    if (oudeDemoVlag)
      fouten.push('STRIPE_DEMO_BEWUST wordt niet meer ondersteund. Gebruik Magnaat Test voor tests; productie heeft een echte provider of RTG_BETALEN_UIT=1 nodig.');
    if (!echteProvider)
      fouten.push('STRIPE_SECRET_KEY, MOLLIE_API_KEY en ADYEN_API_KEY ontbreken in productie. Zet minstens één echte provider -- of RTG_BETALEN_UIT=1 om alle betaalfuncties fail-closed uit te schakelen.');
    /* Een betaalsleutel zonder webhook-secret is gevaarlijker dan geen van
       beide: er gaat echt geld om, en de webhook die vertelt of er betaald is
       zou dan onondertekend binnenkomen. Wie het adres kent roept "betaald". */
    if (env.STRIPE_SECRET_KEY && !env.STRIPE_WEBHOOK_SECRET)
      fouten.push('STRIPE_SECRET_KEY gezet zonder STRIPE_WEBHOOK_SECRET: de betaal-webhook zou onondertekende berichten als waarheid aannemen. Zet het webhook-secret uit het Stripe-dashboard.');
    /* De klassieke Mollie-terugmelding draagt alleen een payment-id. Die wordt
       nooit zelf geloofd: RTG haalt de stand op met MOLLIE_API_KEY. Daarom is
       hier geen fictief webhook-secret verplicht. Een vast APP_URL wel, want
       terugkeer- en webhook-URL mogen niet uit een aanvragerkop komen. */
    if (env.MOLLIE_API_KEY && !env.APP_URL)
      fouten.push('MOLLIE_API_KEY gezet zonder APP_URL: Mollie heeft vaste terugkeer- en webhook-URL\'s nodig. Zet APP_URL op het publieke RTG-adres.');
    if (env.ADYEN_API_KEY && !env.ADYEN_MERCHANT_ACCOUNT)
      fouten.push('ADYEN_API_KEY gezet zonder ADYEN_MERCHANT_ACCOUNT: RTG kan de betaalpagina en webhook dan niet aan één zakelijke rekening binden.');
    if (env.ADYEN_API_KEY && !/^[A-Fa-f0-9]{64}$/.test(String(env.ADYEN_HMAC_KEY || '')))
      fouten.push('ADYEN_API_KEY gezet zonder geldige ADYEN_HMAC_KEY van 64 hex-tekens: AUTHORISATION- en REFUND-webhooks zijn dan niet te vertrouwen.');
    if (env.ADYEN_API_KEY && !env.APP_URL)
      fouten.push('ADYEN_API_KEY gezet zonder APP_URL: Adyen heeft een vaste terugkeer-URL nodig. Zet APP_URL op het publieke RTG-adres.');
    if (env.ADYEN_API_KEY && !/^https:\/\/[^/]+-checkout-live\.adyenpayments\.com\/checkout\/v\d+\/?$/.test(String(env.ADYEN_CHECKOUT_BASE_URL || '')))
      fouten.push('ADYEN_API_KEY gezet zonder geldige live ADYEN_CHECKOUT_BASE_URL. Gebruik exact de merchant-specifieke Checkout-URL uit Adyen Customer Area, inclusief /checkout/v72.');
    if (!env.RTF_IBAN) waarschuwingen.push('RTF_IBAN niet gezet: de 30%-afdracht aan de RTFoundation wordt wel per betaling geboekt en gereserveerd (status "te_storten"), maar nog niet uitbetaald. Vul het foundation-IBAN zodra het bekend is.');
    if (env.MUNT_AAN === '1' && !env.MUNT_PROVIDER_KEY)
      fouten.push('MUNT_AAN=1 zonder MUNT_PROVIDER_KEY: crypto-acceptatie zou aanstaan zonder vergunninghoudende aanbieder om te ontvangen en om te zetten. Zet de provider, of laat MUNT_AAN uit.');
    /* Even hard als de Stripe-regel hierboven, en om dezelfde reden: de
       munt-webhook zet bij "ontvangen" een factuur op betaald of crediteert een
       leverancier rechtstreeks. Dit stond als WAARSCHUWING terwijl de
       Stripe-tweeling een FOUT was, en dat verschil was er geen: allebei
       vertellen ze de server dat er geld binnen is. Sinds muntbetaal.js in
       productie zonder secret weigert, zou een waarschuwing bovendien liegen --
       de acceptatie werkt dan gewoon niet meer. Liever nu luid dan straks stil. */
    if (env.MUNT_AAN === '1' && !env.MUNT_WEBHOOK_SECRET)
      fouten.push('MUNT_AAN=1 zonder MUNT_WEBHOOK_SECRET: de munt-webhook zou onondertekende berichten als waarheid aannemen (en zet een factuur op betaald). Zet een secret, of laat MUNT_AAN uit.');
}

/* Een meetbare CONFIGURATIEstand voor het releasebewijs. Aanwezige sleutels of
   een geldig IBAN bewijzen geen levering, webhook of settlement; daarvoor eist
   productie-status de afzonderlijke, ondertekende externe proefartefacten. */
function geldigIban(waarde) {
  const iban = String(waarde || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const herschikt = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const teken of herschikt) {
    const deel = /\d/.test(teken) ? teken : String(teken.charCodeAt(0) - 55);
    for (const cijfer of deel) rest = (rest * 10 + Number(cijfer)) % 97;
  }
  return rest === 1;
}

function stand(env) {
  env = env || {};
  const inkomendProviders = [];
  if (env.STRIPE_SECRET_KEY) inkomendProviders.push('stripe');
  if (env.MOLLIE_API_KEY) inkomendProviders.push('mollie');
  if (env.ADYEN_API_KEY) inkomendProviders.push('adyen');
  const betalingenUit = env.RTG_BETALEN_UIT === '1';
  return {
    betalingenUit,
    inkomendProviders,
    inkomendGeconfigureerd: !betalingenUit && inkomendProviders.length > 0,
    uitgaandGeconfigureerd: false,
    uitgaandWaarom: 'Er is nog geen productie-uitbetaalprovider; de huidige SEPA-weg is uitsluitend sandbox/Magnaat Test.',
    foundationRekeningGeconfigureerd: geldigIban(env.RTF_IBAN)
  };
}

module.exports = { keurGeld, stand, geldigIban };
