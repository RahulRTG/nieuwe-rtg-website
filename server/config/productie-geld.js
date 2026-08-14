/* De productie-keuring, deel GELD: Stripe, de munt-acceptatie en de
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
    const demoBewust = env.STRIPE_DEMO_BEWUST === '1' || env.RTG_PRIVATE_BETA === '1';
    /* FOUT en geen waarschuwing: zonder sleutel draait de demo-provider, die
       ELKE betaling zelf bevestigt. Facturen gaan op 'paid' zonder afschrijving,
       terwijl de 30%-afdracht aan de RTFoundation wel gewoon wordt geboekt --
       geld eruit, niets erin. Dat is geen mededeling maar een storing. Wie
       bewust zonder betalingen draait, zegt dat met STRIPE_DEMO_BEWUST=1. */
    if (!env.STRIPE_SECRET_KEY && !demoBewust)
      fouten.push('STRIPE_SECRET_KEY ontbreekt in productie: dan draait de demo-provider, die ELKE betaling zelf bevestigt. Facturen gaan op betaald zonder dat er is afgerekend, terwijl de RTF-afdracht wel wordt geboekt. Zet de sleutel -- of, als deze installatie bewust zonder betalingen draait, zet STRIPE_DEMO_BEWUST=1.');
    if (!env.STRIPE_SECRET_KEY && demoBewust)
      waarschuwingen.push((env.RTG_PRIVATE_BETA === '1' ? 'RTG_PRIVATE_BETA=1' : 'STRIPE_DEMO_BEWUST=1') + ': de demo-betaalprovider bevestigt elke betaling zelf. Dat is hier een bewuste keuze; er gaat geen echt geld om en facturen kloppen niet.');
    /* Een betaalsleutel zonder webhook-secret is gevaarlijker dan geen van
       beide: er gaat echt geld om, en de webhook die vertelt of er betaald is
       zou dan onondertekend binnenkomen. Wie het adres kent roept "betaald". */
    if (env.STRIPE_SECRET_KEY && !env.STRIPE_WEBHOOK_SECRET)
      fouten.push('STRIPE_SECRET_KEY gezet zonder STRIPE_WEBHOOK_SECRET: de betaal-webhook zou onondertekende berichten als waarheid aannemen. Zet het webhook-secret uit het Stripe-dashboard.');
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
