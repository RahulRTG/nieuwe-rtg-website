/* Configuratie-controle die bij het opstarten faalt als productie onveilig is
   ingesteld ("fail-fast"). Beter dat de server weigert te starten dan dat hij
   live gaat met het demo-wachtwoord open of met onversleutelde gegevens.

   valideer(env) is zuiver en testbaar: het leest alleen uit het meegegeven
   omgevingsobject en geeft { fouten, waarschuwingen, productie } terug.
   pasToe() draait die controle bij de echte start en stopt het proces bij een
   fout in productie. */

function isProductie(env) { return env.NODE_ENV === 'production'; }

function valideer(env) {
  const fouten = [];
  const waarschuwingen = [];
  const prod = isProductie(env);

  // PORT moet een geldig poortnummer zijn als hij is gezet.
  if (env.PORT && !(Number(env.PORT) > 0 && Number(env.PORT) < 65536))
    fouten.push(`PORT is ongeldig: "${env.PORT}".`);

  if (prod) {
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
      fouten.push('RTG_OWNER_EMAIL staat op het voorbeeldadres: wie dat adres registreert zou eigenaar van de technische pagina worden. Zet het echte e-mailadres van de eigenaar.');
    else if (!eigenaarEnv)
      fouten.push('RTG_OWNER_EMAIL ontbreekt. In productie geldt de ingebouwde standaard uit server/eigenaar.js niet: zet het echte e-mailadres van de eigenaar, en zorg dat daar al een RTG-account bij hoort.');
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
    if (!env.OFFICE_TOTP_SECRET) waarschuwingen.push('OFFICE_TOTP_SECRET niet gezet: de backoffice heeft geen tweede factor (2FA). Sterk aangeraden: zet een base32-geheim en koppel een authenticator-app.');
    if (!env.SMTP_URL && !env.SMTP_HOST) waarschuwingen.push('Geen SMTP ingesteld: e-mail (herstel-links, bevestigingen) wordt niet echt verstuurd.');
    if (!env.STRIPE_SECRET_KEY) waarschuwingen.push('STRIPE_SECRET_KEY niet gezet: betalingen draaien in demo-stand (geen echt geld).');
    /* Een betaalsleutel zonder webhook-secret is gevaarlijker dan geen van
       beide: er gaat echt geld om, en de webhook die vertelt of er betaald is
       zou dan onondertekend binnenkomen. Wie het adres kent roept "betaald". */
    if (env.STRIPE_SECRET_KEY && !env.STRIPE_WEBHOOK_SECRET)
      fouten.push('STRIPE_SECRET_KEY gezet zonder STRIPE_WEBHOOK_SECRET: de betaal-webhook zou onondertekende berichten als waarheid aannemen. Zet het webhook-secret uit het Stripe-dashboard.');
    if (!env.RTF_IBAN) waarschuwingen.push('RTF_IBAN niet gezet: de 30%-afdracht aan de RTFoundation wordt wel per betaling geboekt en gereserveerd (status "te_storten"), maar nog niet uitbetaald. Vul het foundation-IBAN zodra het bekend is.');
    if (env.MUNT_AAN === '1' && !env.MUNT_PROVIDER_KEY)
      fouten.push('MUNT_AAN=1 zonder MUNT_PROVIDER_KEY: crypto-acceptatie zou aanstaan zonder vergunninghoudende aanbieder om te ontvangen en om te zetten. Zet de provider, of laat MUNT_AAN uit.');
    if (env.MUNT_AAN === '1' && !env.MUNT_WEBHOOK_SECRET)
      waarschuwingen.push('MUNT_WEBHOOK_SECRET niet gezet terwijl munt-acceptatie aanstaat: de munt-webhook is dan niet te vertrouwen. Zet een secret.');
  } else {
    // Buiten productie: alleen zachte hints, nooit blokkeren.
    if (!env.RTG_ENC_KEY) waarschuwingen.push('RTG_ENC_KEY niet gezet: versleuteling-at-rest is uit (prima voor lokaal, niet voor productie).');
  }

  return { fouten, waarschuwingen, productie: prod };
}

/* Draai de controle en handel ernaar: waarschuwingen loggen, en bij fouten in
   productie stoppen met exitcode 1 (zodat de proces-manager niet doorstart op
   een onveilige configuratie). Buiten productie worden fouten als waarschuwing
   getoond, zodat lokaal experimenteren niet wordt geblokkeerd. */
function pasToe(env, log) {
  env = env || process.env;
  log = log || console;
  const r = valideer(env);
  for (const w of r.waarschuwingen) (log.warn || log.log).call(log, '[config] ' + w);
  if (r.fouten.length) {
    for (const f of r.fouten) (log.error || log.log).call(log, '[config] ' + f);
    if (r.productie) {
      (log.error || log.log).call(log, `[config] ${r.fouten.length} configuratiefout(en) in productie; start afgebroken.`);
      process.exit(1);
    } else {
      (log.warn || log.log).call(log, '[config] bovenstaande zou de productiestart blokkeren; buiten productie gaan we door.');
    }
  } else if (r.productie) {
    (log.info || log.log).call(log, '[config] productieconfiguratie gecontroleerd: in orde.');
  }
  return r;
}

module.exports = { valideer, pasToe, isProductie };
