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

    // 3. Geen standaard-/zwakke geheimen laten staan.
    if (env.DEMO_PASS && env.DEMO_PASS === 'Imran')
      fouten.push('DEMO_PASS staat nog op de standaardwaarde.');
    if (env.RTG_CLUSTER_KEY && env.RTG_CLUSTER_KEY.length < 16)
      fouten.push('RTG_CLUSTER_KEY is te kort om de failover-endpoints te beschermen.');

    // 4. Aanbevolen, maar niet blokkerend.
    if (!env.APP_URL) waarschuwingen.push('APP_URL niet gezet: links in e-mails vallen terug op de Host-header.');
    if (!env.DATABASE_URL && env.RTG_STORE !== 'sqlite') waarschuwingen.push('DATABASE_URL niet gezet: de gedeelde data draait op een lokaal bestand. Voor productie/meerdere instances wordt PostgreSQL aangeraden.');
    // Met gedeelde accounts (Postgres) MOETEN de kluis- en tokensleutel gedeeld
    // zijn, anders kan de ene instance de gegevens van de andere niet lezen.
    if (env.DATABASE_URL && !env.RTG_VAULT_KEY) waarschuwingen.push('RTG_VAULT_KEY niet gezet: bij meerdere instances kunnen ze elkaars versleutelde naam/e-mail niet ontsleutelen en klopt de e-mail-login-hash niet. Zet een gedeelde sleutel.');
    if (env.DATABASE_URL && !env.RTG_SECRET_KEY) waarschuwingen.push('RTG_SECRET_KEY niet gezet: sessietokens van de ene instance gelden dan niet op de andere.');
    if (!env.REDIS_URL) waarschuwingen.push('REDIS_URL niet gezet: realtime werkt alleen binnen één proces (niet over meerdere instances).');
    if (!env.SENTRY_DSN) waarschuwingen.push('SENTRY_DSN niet gezet: geen externe fout-tracking.');
    if (!env.SMTP_URL && !env.SMTP_HOST) waarschuwingen.push('Geen SMTP ingesteld: e-mail (herstel-links, bevestigingen) wordt niet echt verstuurd.');
    if (!env.STRIPE_SECRET_KEY) waarschuwingen.push('STRIPE_SECRET_KEY niet gezet: betalingen draaien in demo-stand (geen echt geld).');
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
