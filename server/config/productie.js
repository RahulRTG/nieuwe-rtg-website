/* De configuratiekeuring, PRODUCTIEDEEL.

   Wat hier staat blokkeert een productiestart (fouten) of wordt luid gemeld
   (waarschuwingen). De regel om te onthouden: een instelling die ontbreekt mag
   nooit STIL in een onveilige stand vallen. Bijna elke regel hier is ooit
   toegevoegd omdat precies dat gebeurde -- de demo-provider die zichzelf
   bevestigt, de webhook zonder secret die onondertekende berichten gelooft, het
   eigenaarsadres dat iedereen kon claimen.

   Afgesplitst uit ../config.js toen die de 10 KB passeerde; dit is het deel dat
   bij elke doorlichting groeit. */
'use strict';

function keur(env, fouten, waarschuwingen) {
    // 1. Demo-modus mag nooit aan in productie: dat opent de demo-inlog en het
    //    account Rahul/Imran.
    if (env.RTG_DEMO === '1')
      fouten.push('RTG_DEMO=1 in productie: de demo-inlog zou openstaan. Zet hem uit.');

    // 2. Versleuteling-at-rest hoort aan te staan; expliciet uitzetten mag met
    //    RTG_ALLOW_PLAINTEXT=1, zodat het een bewuste keuze is en geen ongeluk.
    if (!env.RTG_ENC_KEY && env.RTG_ALLOW_PLAINTEXT !== '1')
      fouten.push('RTG_ENC_KEY ontbreekt: gegevens zouden onversleuteld op schijf staan. Zet een sleutel, of bevestig bewust met RTG_ALLOW_PLAINTEXT=1.');
    if (env.RTG_ENC_KEY && env.RTG_ENC_KEY.length < 16)
      fouten.push('RTG_ENC_KEY is te kort; gebruik 32+ willekeurige tekens of 64 hex-tekens.');

    /* 2b. De twee sleutels van de identiteitskluis MOETEN uit de omgeving komen.

       Zonder deze regel valt server/accounts terug op vault.key en secret.key
       IN DE DATAMAP -- dezelfde map als rtg.db. Wie die map heeft, heeft dan de
       database en de sleutel om hem te ontcijferen, en is de hele
       pseudonimisering waardeloos: codenamen worden weer namen.

       De kluis hoort te beschermen tegen een gestolen dump. Dat doet ze alleen
       als de sleutel ergens anders woont: een secrets manager, een gemounte
       sleutel, of desnoods een pad buiten het datavolume. Daarom blokkeert dit
       de start in plaats van te waarschuwen -- een waarschuwing die je kunt
       negeren beschermt niemand.

       Bij meer dan één instance is dit trouwens sowieso verplicht: elke
       instance zou anders zijn eigen sleutel maken, en dan klopt de
       e-mail-hash niet meer en kan de ene instance de gegevens van de andere
       niet lezen. */
    for (const [naam, waarvoor] of [
      ['RTG_VAULT_KEY', 'de identiteitskluis (namen, e-mail, telefoon)'],
      ['RTG_SECRET_KEY', 'de ondertekening van sessietokens']
    ]) {
      const v = String(env[naam] || '');
      if (!v)
        fouten.push(naam + ' ontbreekt: de sleutel voor ' + waarvoor + ' zou dan als bestand naast de database komen te staan. Wie de datamap steelt heeft dan ook de sleutel. Zet hem uit een secrets manager.');
      else if (v.length < 32)
        fouten.push(naam + ' is te kort; gebruik 64 hex-tekens (openssl rand -hex 32).');
    }

    // 3. Geen standaard-/zwakke geheimen laten staan.
    if (env.DEMO_PASS && env.DEMO_PASS === 'Imran')
      fouten.push('DEMO_PASS staat nog op de standaardwaarde.');
    if (env.RTG_CLUSTER_KEY && env.RTG_CLUSTER_KEY.length < 16)
      fouten.push('RTG_CLUSTER_KEY is te kort om de failover-endpoints te beschermen.');
    /* De eigenaar van de technische pagina wordt op e-mailadres herkend. In
       productie moet dat adres HIER staan, expliciet. server/eigenaar.js heeft
       wel een ingebouwde standaard, maar die is voor ontwikkelen: op een verse
       productiebak hoort bij dat adres nog geen account, dus wie het als eerste
       registreert zou eigenaar worden (zekeringen, functieschakelaars,
       beveiligingsmeldingen). Vandaar twee aparte, eerlijke meldingen: leeg is
       iets anders dan het voorbeeldadres, maar allebei blokkeren ze de start. */
    const eigenaarEnv = String(env.RTG_OWNER_EMAIL || '').trim().toLowerCase();
    if (eigenaarEnv === 'rahul@rtg.example')
      fouten.push('RTG_OWNER_EMAIL staat op het voorbeeldadres. Zet het echte e-mailadres van de eigenaar.');
    else if (!eigenaarEnv)
      fouten.push('RTG_OWNER_EMAIL ontbreekt. In productie geldt de ingebouwde standaard uit server/eigenaar.js niet: zet het echte e-mailadres van de eigenaar.');
    if (env.OFFICE_CODE && env.OFFICE_CODE.length < 8)
      fouten.push('OFFICE_CODE is te kort; gebruik minstens 8 tekens (of laat hem weg voor een willekeurige code).');

    // 4. Aanbevolen, maar niet blokkerend.
    if (!env.APP_URL) waarschuwingen.push('APP_URL niet gezet: links in e-mails vallen terug op de Host-header.');
    if (!env.DATABASE_URL && env.RTG_STORE !== 'sqlite') waarschuwingen.push('DATABASE_URL niet gezet: de gedeelde data draait op een lokaal bestand. Voor productie/meerdere instances wordt PostgreSQL aangeraden.');
    /* RTG_VAULT_KEY en RTG_SECRET_KEY stonden hier vroeger als waarschuwing.
       Ze zijn nu blokkerende fouten (punt 2b hierboven) -- twee keer melden zou
       de lijst alleen langer maken zonder iets toe te voegen. */
    if (!env.REDIS_URL) waarschuwingen.push('REDIS_URL niet gezet: realtime werkt alleen binnen één proces (niet over meerdere instances).');
    // Media (Salon-foto's, snaps) op lokale schijf worden niet gedeeld tussen
    // instances; bij meerdere instances is S3-compatibele opslag (of een gedeeld
    // volume) nodig zodat elke server dezelfde foto's ziet.
    if (env.DATABASE_URL && (env.RTG_MEDIA_BACKEND || '').toLowerCase() !== 's3')
      waarschuwingen.push('RTG_MEDIA_BACKEND niet op "s3": Salon-foto\'s en snaps staan op de lokale schijf en worden niet tussen instances gedeeld. Zet S3-compatibele opslag (RTG_MEDIA_S3_*) of gebruik een gedeeld volume.');
    if (!env.SENTRY_DSN) waarschuwingen.push('SENTRY_DSN niet gezet: geen EXTERNE fout-tracking (de eigen in-memory fout-aggregatie op het techniekbord draait altijd).');
    // Eenmalige sleutel waarmee de EERSTE eigenaar zijn account claimt; zonder hem
    // weigert de registratie dat adres. Bestaat het account al, dan hoort hij weg.
    if (!env.RTG_OWNER_BOOTSTRAP)
      waarschuwingen.push('RTG_OWNER_BOOTSTRAP niet gezet: als er nog GEEN account op het eigenaarsadres bestaat, is er geen manier meer om er een te maken. Bestaat het account al, dan hoort deze sleutel juist weg.');
    if (!env.OFFICE_TOTP_SECRET) waarschuwingen.push('OFFICE_TOTP_SECRET niet gezet: de backoffice heeft geen tweede factor (2FA). Sterk aangeraden: zet een base32-geheim en koppel een authenticator-app.');
    if (!env.SMTP_URL && !env.SMTP_HOST) waarschuwingen.push('Geen SMTP ingesteld: e-mail (herstel-links, bevestigingen) wordt niet echt verstuurd.');
    /* FOUT en geen waarschuwing: zonder sleutel draait de demo-provider, die
       ELKE betaling zelf bevestigt. Facturen gaan op 'paid' zonder afschrijving,
       terwijl de 30%-afdracht aan de RTFoundation wel gewoon wordt geboekt --
       geld eruit, niets erin. Dat is geen mededeling maar een storing. Wie
       bewust zonder betalingen draait, zegt dat met STRIPE_DEMO_BEWUST=1. */
    if (!env.STRIPE_SECRET_KEY && env.STRIPE_DEMO_BEWUST !== '1')
      fouten.push('STRIPE_SECRET_KEY ontbreekt in productie: dan draait de demo-provider, die ELKE betaling zelf bevestigt. Facturen gaan op betaald zonder dat er is afgerekend, terwijl de RTF-afdracht wel wordt geboekt. Zet de sleutel -- of, als deze installatie bewust zonder betalingen draait, zet STRIPE_DEMO_BEWUST=1.');
    if (!env.STRIPE_SECRET_KEY && env.STRIPE_DEMO_BEWUST === '1')
      waarschuwingen.push('STRIPE_DEMO_BEWUST=1: de demo-betaalprovider bevestigt elke betaling zelf. Dat is hier een bewuste keuze; er gaat geen echt geld om en facturen kloppen niet.');
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

module.exports = { keur };
