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

const { keurGeld } = require('./productie-geld');
const { keurAi } = require('./productie-ai');
const { keurOpslag } = require('./productie-opslag');
const { keurMotor } = require('./productie-motor');

function keur(env, fouten, waarschuwingen) {
    const priveBeta = env.RTG_PRIVATE_BETA === '1';
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

    // 3b. Geen grootboek, geen productie. Zie ./productie-opslag.js.
    keurOpslag(env, fouten, waarschuwingen);
    keurMotor(env, fouten, waarschuwingen);

    /* Een private beta is een bouwstand, geen sluiproute naar internet. Mail mag
       naar de lokale outbox en de betaalprovider mag demo zijn, maar uitsluitend
       als APP_URL aantoonbaar lokaal is. Een publiek adres met deze vlag is een
       harde fout: anders wordt "tijdelijk" ongemerkt productie. */
    if (priveBeta) {
      let lokaal = false;
      try {
        const host = new URL(String(env.APP_URL || '')).hostname.toLowerCase();
        lokaal = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local') ||
          /^10\./.test(host) || /^192\.168\./.test(host) ||
          (() => { const m = /^172\.(\d+)\./.exec(host); return !!m && Number(m[1]) >= 16 && Number(m[1]) <= 31; })();
      } catch (e) {}
      if (!lokaal)
        fouten.push('RTG_PRIVATE_BETA=1 mag alleen met een lokaal APP_URL (localhost, .local of een privaat netwerkadres). Een private beta mag nooit per ongeluk publiek staan.');
      else
        waarschuwingen.push('RTG_PRIVATE_BETA=1: alleen lokaal bouwen; mail blijft in de outbox en demo-betalingen zijn geen echte betalingen. Verwijder deze vlag voor publieke livegang.');
    }

    // 4. Aanbevolen, maar niet blokkerend.
    if (!env.APP_URL) waarschuwingen.push('APP_URL niet gezet: links in e-mails vallen terug op de Host-header.');
    /* RTG_VAULT_KEY en RTG_SECRET_KEY stonden hier vroeger als waarschuwing.
       Ze zijn nu blokkerende fouten (punt 2b hierboven) -- twee keer melden zou
       de lijst alleen langer maken zonder iets toe te voegen. */
    if (!env.REDIS_URL) waarschuwingen.push('REDIS_URL niet gezet: realtime werkt alleen binnen één proces (niet over meerdere instances).');
    // Media (Salon-foto's, snaps) op lokale schijf worden niet gedeeld tussen
    // instances; bij meerdere instances is S3-compatibele opslag (of een gedeeld
    // volume) nodig zodat elke server dezelfde foto's ziet.
    if (env.DATABASE_URL && (env.RTG_MEDIA_BACKEND || '').toLowerCase() !== 's3')
      waarschuwingen.push('RTG_MEDIA_BACKEND niet op "s3": Salon-foto\'s en snaps staan op de lokale schijf en worden niet tussen instances gedeeld. Zet S3-compatibele opslag (RTG_MEDIA_S3_*) of gebruik een gedeeld volume.');
    /* HIER STOND SENTRY_DSN. Niets in deze codebase leest die variabele -- het
       pakket @sentry/node is er nooit gekomen (zero dependencies) en
       server/foutmelder.js nam zijn plaats in, op ERR_WEBHOOK_URL. De
       waarschuwing stuurde de beheerder dus naar een knop die nergens op zit.
       Zie test/alarmweg.test.js en check.js regel 27. */
    if (!env.ERR_WEBHOOK_URL) waarschuwingen.push('ERR_WEBHOOK_URL niet gezet: geen EXTERNE alarmering. De eigen fout-aggregatie op het techniekbord draait altijd, maar die zie je alleen als je zelf kijkt -- en niet als de doos plat ligt. Zet een webhook (Slack/Discord/eigen endpoint) en beproef hem met de zelfproef op het techniekbord.');
    if (env.SENTRY_DSN && !env.ERR_WEBHOOK_URL) waarschuwingen.push('SENTRY_DSN is gezet maar wordt door niets gelezen: deze codebase heeft geen Sentry-koppeling (zero dependencies). De externe alarmering loopt via ERR_WEBHOOK_URL.');
    /* RTG_OWNER_BOOTSTRAP staat BEWUST niet in deze lijst. De eenmalige sleutel
       waarmee de eerste eigenaar zijn account claimt hoort weg zodra dat account
       bestaat -- dat is de normale eindstand. Hier waarschuwen zodra hij ontbreekt
       betekende dus: waarschuwen bij elke gezonde productiestart, en een melding
       die altijd afgaat leert iedereen hem weg te kijken. De vraag die er wél toe
       doet (bestaat dat account al?) valt hier ook niet te beantwoorden: deze
       functie kent alleen de omgeving, niet de database. Die controle staat nu in
       server.js, na load(), waar hij het antwoord echt weet. */
    if (!env.OFFICE_TOTP_SECRET) waarschuwingen.push('OFFICE_TOTP_SECRET niet gezet: de backoffice heeft geen tweede factor (2FA). Sterk aangeraden: zet een base32-geheim en koppel een authenticator-app.');
    /* AI is een versneller, geen afhankelijkheid. Zonder provider start RTG in
       de ingebouwde werkmodus: schermen, regels, controles en handmatige routes
       blijven beschikbaar en de UI meldt eerlijk dat vrije AI niet actief is.
       Mail is anders: een herstelbericht lokaal parkeren terwijl de gebruiker
       denkt dat het verzonden is, is geen werkbare uitwijk en blijft blokkeren. */
    keurAi(env, fouten, waarschuwingen);
    if (!env.SMTP_URL && !env.SMTP_HOST) {
      if (priveBeta) waarschuwingen.push('Geen mailprovider in private beta: herstel- en bevestigingsmail blijft zichtbaar in de lokale outbox.');
      else fouten.push('Geen echte mailprovider ingesteld: herstel- en bevestigingsmail zou alleen in de lokale outbox belanden. Zet SMTP_URL of SMTP_HOST.');
    }
    // De geldkant (Stripe, munt, RTF-afdracht) staat in ./productie-geld.js
    keurGeld(env, fouten, waarschuwingen);
}

module.exports = { keur };
