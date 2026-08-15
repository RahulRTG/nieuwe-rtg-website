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
    const demoBewust = env.STRIPE_DEMO_BEWUST === '1' || env.RTG_PRIVATE_BETA === '1';
    /* FOUT en geen waarschuwing: zonder sleutel draait de demo-provider, die
       ELKE betaling zelf bevestigt. Facturen gaan op 'paid' zonder afschrijving,
       terwijl de 30%-afdracht aan de RTFoundation wel gewoon wordt geboekt --
       geld eruit, niets erin. Dat is geen mededeling maar een storing. Wie
       bewust zonder betalingen draait, zegt dat met RTG_BETALEN_UIT=1. Alleen
       een afgeschermde lokale beta mag de demo-provider nog bewust gebruiken. */
    const echteProvider = !!(env.STRIPE_SECRET_KEY || env.MOLLIE_API_KEY || env.ADYEN_API_KEY);
    if (betalingenUit) {
      if (echteProvider || env.STRIPE_WEBHOOK_SECRET || env.ADYEN_HMAC_KEY ||
          env.MUNT_PROVIDER_KEY || env.MUNT_WEBHOOK_SECRET)
        fouten.push('RTG_BETALEN_UIT=1 botst met ingestelde betaalgeheimen. Verwijder de provider- en webhook-sleutels: een uitgeschakelde betaalrail hoort niets te kunnen bereiken.');
      if (demoBewust)
        fouten.push('RTG_BETALEN_UIT=1 botst met STRIPE_DEMO_BEWUST of RTG_PRIVATE_BETA. Kies precies één stand: echt fail-closed uit, of de lokale demo.');
      if (env.MUNT_AAN === '1')
        fouten.push('RTG_BETALEN_UIT=1 botst met MUNT_AAN=1. Ook muntbetalingen moeten uit blijven.');
      waarschuwingen.push('RTG_BETALEN_UIT=1: alle betaalrails, webhooks, terugbetalingen en uitbetalingen weigeren fail-closed. Er draait ook geen demo-provider.');
      return;
    }
    if (!echteProvider && !demoBewust)
      fouten.push('STRIPE_SECRET_KEY, MOLLIE_API_KEY en ADYEN_API_KEY ontbreken in productie: dan draait de demo-provider, die ELKE betaling zelf bevestigt. Zet minstens één echte provider -- of zet RTG_BETALEN_UIT=1 om alle betaalfuncties bewust fail-closed uit te schakelen.');
    if (!echteProvider && demoBewust)
      waarschuwingen.push((env.RTG_PRIVATE_BETA === '1' ? 'RTG_PRIVATE_BETA=1' : 'STRIPE_DEMO_BEWUST=1') + ': de demo-betaalprovider bevestigt elke betaling zelf. Dat is hier een bewuste keuze; er gaat geen echt geld om en facturen kloppen niet.');
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

module.exports = { keurGeld };
