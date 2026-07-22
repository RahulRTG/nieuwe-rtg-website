/* Go-live-keuring: controleert in een keer of deze omgeving echt live kan.
   Draai op de productiemachine (met de echte omgevingsvariabelen geladen):

     npm run golive

   Staat er een .env.productie in de projectmap (gemaakt met
   npm run sleutels -- --schrijf), dan leest de keuring die vanzelf mee;
   echte omgevingsvariabelen winnen altijd van het bestand. De keuring
   beoordeelt de configuratie ALSOF het productie is (ook als NODE_ENV nog
   niet op production staat), probeert PostgreSQL echt te bereiken, en drukt
   een lijst af met kruisjes en vinkjes. Exitcode 1 zolang er blokkerende
   punten zijn; 0 = klaar om live te gaan. */
const fs = require('fs');
const path = require('path');
const config = require('../server/config');

const uit = [];
const blokkeer = (t) => uit.push(['✗', t, true]);
const waarschuw = (t) => uit.push(['⚠', t, false]);
const goed = (t) => uit.push(['✓', t, false]);

/* .env.productie inlezen (alleen KEY=waarde-regels; # is commentaar). */
function leesEnvBestand(pad) {
  const uitv = {};
  try {
    for (const regel of fs.readFileSync(pad, 'utf8').split('\n')) {
      const r = regel.trim();
      if (!r || r.startsWith('#')) continue;
      const i = r.indexOf('=');
      if (i > 0) uitv[r.slice(0, i).trim()] = r.slice(i + 1).trim();
    }
  } catch (e) { return null; }
  return uitv;
}

(async () => {
  // 0. het productie-envbestand, als dat er is (echte env wint altijd)
  const envPad = path.join(__dirname, '..', '.env.productie');
  let bestand = null;
  if (fs.existsSync(envPad)) {
    bestand = leesEnvBestand(envPad) || {};
    // HANDMATIG-plekken die nog niet zijn ingevuld tellen niet mee
    for (const [k, v] of Object.entries(bestand)) if (/VUL-IN/.test(v)) delete bestand[k];
    goed('.env.productie gevonden en meegelezen (' + Object.keys(bestand).length + ' ingevulde waarden).');
    // het geheimenbestand mag nooit in git terechtkomen
    try {
      const ignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
      if (!/^\.env(\.\*|\.productie)?$/m.test(ignore) || !/\.env\./.test(ignore))
        blokkeer('.env.productie staat niet in .gitignore: het geheimenbestand zou in git kunnen belanden.');
    } catch (e) {}
  }

  // 1. de configuratie, beoordeeld op productieniveau
  const env = { ...(bestand || {}), ...process.env, NODE_ENV: 'production' };
  const r = config.valideer(env);
  for (const f of r.fouten) blokkeer(f);
  for (const w of r.waarschuwingen) waarschuw(w);
  if (!r.fouten.length) goed('Configuratie: geen blokkerende fouten.');
  if (process.env.NODE_ENV !== 'production') waarschuw('NODE_ENV staat nu op "' + (process.env.NODE_ENV || 'leeg') + '"; zet hem bij de echte start op production.');

  // 2. PostgreSQL echt aanraken (niet alleen "de variabele staat er")
  if (env.DATABASE_URL) {
    try {
      const { Client } = require('../server/pgwire');
      const c = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 4000 });
      const t0 = Date.now();
      await c.connect();
      await c.query('SELECT 1');
      await c.end();
      goed('PostgreSQL bereikbaar (' + (Date.now() - t0) + ' ms).');
    } catch (e) {
      blokkeer('DATABASE_URL is gezet maar de database antwoordt niet: ' + (e.message || e));
    }
  }

  // 3. de sleutels die instances MOETEN delen
  if (env.DATABASE_URL && env.RTG_VAULT_KEY && env.RTG_SECRET_KEY)
    goed('Gedeelde sleutels (kluis + tokens) staan klaar voor meerdere instances.');

  // 4. HTTPS-hygiene
  if (env.APP_URL && !/^https:\/\//.test(env.APP_URL))
    blokkeer('APP_URL is geen https-adres: e-maillinks zouden onversleuteld wijzen.');
  else if (env.APP_URL) goed('APP_URL is https.');

  // 5. de eigenaar (nogmaals expliciet, want dit is de sleutel van alles)
  if (env.RTG_OWNER_EMAIL && env.RTG_OWNER_EMAIL !== 'rahul@rtg.example')
    goed('Eigenaar van de technische pagina: ' + env.RTG_OWNER_EMAIL);

  // 6. de tweede factor van de backoffice
  if (env.OFFICE_TOTP_SECRET)
    goed('Backoffice-2FA (TOTP) staat aan.');

  // 7. de demo-inlog: het universele demo-account (naam/wachtwoord) mag in
  //    productie niet meer werken. Het is uit zodra NODE_ENV=production, tenzij
  //    iemand hem bewust met RTG_DEMO=1 weer aanzet (de config-keuring hierboven
  //    blokkeert dat geval al). Hier bevestigen we alleen dat hij uitstaat.
  if (process.env.RTG_DEMO !== '1')
    goed('Demo-inlog (universeel account) staat uit in productie; leden loggen in via hun account, personeel met pincode.');

  // afdrukken, blokkers eerst
  uit.sort((a, b) => (b[2] ? 1 : 0) - (a[2] ? 1 : 0));
  console.log('\n=== RTG go-live-keuring ===\n');
  for (const [teken, tekst] of uit) console.log(' ' + teken + ' ' + tekst);
  const blokkers = uit.filter(x => x[2]).length;

  /* De punten die BUITEN de code liggen: geen kruisjes (de keuring kan ze
     vanaf hier niet zien), maar wel elke keer op het bord, zodat ze nooit
     stilletjes worden overgeslagen. */
  console.log('\nBuiten de code, op de server zelf (zie PRODUCTION.md):');
  console.log(' - TLS-terminatie (reverse proxy of load balancer) VOOR de app; trust proxy staat al aan.');
  console.log(' - Rand-DDoS: DNS achter Cloudflare of gelijkwaardig met proxy aan; de app-WAF is de tweede linie.');
  console.log(' - Backups van server/data (en Postgres) draaien EN terugzetten is echt getest.');
  console.log(' - Een onafhankelijke pentest voor de lancering; eigen tests vervangen geen vreemde ogen.');
  console.log(' - AVG op orde: verwerkersafspraken met partners en het verwerkingsregister bijgewerkt.');

  console.log('');
  if (blokkers) {
    console.log('NIET klaar om live te gaan: ' + blokkers + ' blokkerend(e) punt(en). (npm run sleutels -- --schrijf maakt de geheimen.)');
    process.exit(1);
  }
  console.log('Klaar om live te gaan. Start met NODE_ENV=production (of npm run vloot voor losse processen).');
})();
