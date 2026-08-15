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
    for (const [k, v] of Object.entries(bestand)) if (/VUL-IN/i.test(v)) delete bestand[k];
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
  if (env.RTG_PRIVATE_BETA === '1')
    blokkeer('RTG_PRIVATE_BETA=1 staat nog aan: deze stand is alleen voor localhost en mag nooit als publieke livegang worden goedgekeurd.');
  const r = config.valideer(env);
  for (const f of r.fouten) blokkeer(f);
  for (const w of r.waarschuwingen) waarschuw(w);
  if (!r.fouten.length) goed('Configuratie: geen blokkerende fouten.');
  if (process.env.NODE_ENV !== 'production') waarschuw('NODE_ENV staat nu op "' + (process.env.NODE_ENV || 'leeg') + '"; zet hem bij de echte start op production.');

  // 1b. De externe voordeur heeft een EIGEN sleutel, buiten de app-env. Wie
  // Node overneemt mag de Sentinel niet zelf kunnen terugzetten naar normaal.
  const sentinelTokenPad = path.resolve(env.RTG_SENTINEL_TOKEN_FILE || path.join(__dirname, '..', '.sentinel-token'));
  try {
    const token = fs.readFileSync(sentinelTokenPad, 'utf8').trim();
    if (!/^[a-f0-9]{64}$/i.test(token)) blokkeer('De Sentinel-beheersleutel moet exact 32 willekeurige bytes (64 hex-tekens) zijn.');
    else if (process.platform !== 'win32' && (fs.statSync(sentinelTokenPad).mode & 0o077))
      blokkeer('De Sentinel-beheersleutel is leesbaar voor anderen; zet rechten 600.');
    else goed('Sentinel heeft een aparte beheersleutel buiten de app-omgeving.');
  } catch (e) { blokkeer('Sentinel-beheersleutel ontbreekt. Draai `npm run sentinel:init` of opnieuw de productie-installatie.'); }
  const sentinelBin = fs.existsSync('/app/rtg-sentinel') ? '/app/rtg-sentinel'
    : path.join(__dirname, '..', 'motor', 'target', 'release', 'rtg-sentinel');
  if (!fs.existsSync(sentinelBin)) blokkeer('Rust Sentinel-binary ontbreekt; draai npm run motor:build.');
  else goed('Onafhankelijke Rust Sentinel-binary staat klaar.');

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

  // 2b. Een ingestelde Rust-cutover ook werkelijk aanraken. Alleen een URL en
  // vlag controleren bewijst niet dat de sidecar draait of de juiste binary is.
  if (env.RTG_MOTOR_REKEN_URL || env.RTG_MOTOR_GELD_URL || env.RTG_MOTOR_SHADOW) {
    const motor = await require('./lib/motor-proef').motorProef(env);
    if (!motor.ok) blokkeer('Rust-motor is geconfigureerd maar niet inzetbaar: ' + motor.fout);
    else goed('Rust-motor bereikbaar (' + motor.ms + ' ms; native: ' + motor.native.join(', ') + ').');
  }
  if (env.RTG_CAPABILITY_RUST_BIN) {
    try {
      const cp = require('child_process');
      const proef = cp.spawnSync(env.RTG_CAPABILITY_RUST_BIN, ['capability-scan', path.join(__dirname, '..')], {
        encoding: 'utf8', timeout: 20000, maxBuffer: 32 * 1024 * 1024
      });
      if (proef.error) throw proef.error;
      if (proef.status !== 0) throw new Error(String(proef.stderr || 'exit ' + proef.status).trim());
      const body = JSON.parse(proef.stdout);
      if (!body.ok || !Array.isArray(body.apps) || !Array.isArray(body.endpoints)) throw new Error('ongeldig scanantwoord');
      goed('Native Magnaat-capabilityscan werkt (' + body.apps.length + ' apps, ' + body.endpoints.length + ' API-deuren).');
    } catch (e) { blokkeer('RTG_CAPABILITY_RUST_BIN werkt niet: ' + e.message); }
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

  /* De papieren kant, als ECHTE controle in plaats van een herinnering.

     Hier stond eerst alleen een regel tekst: "AVG op orde: verwerkersafspraken
     en het verwerkingsregister bijgewerkt." Dat is precies het soort
     proces-schijnvertoning waar niemand iets aan heeft -- een zin die je leest
     en waar niets van afhangt. Nu leest de keuring de documenten echt en kijkt
     of de plekken die alleen RTG kan invullen ook zijn ingevuld.

     De documenten staan in git met {{merktekens}} op de plekken die alleen RTG
     kan invullen; de antwoorden komen uit de vragen die Rahul stelt (zie
     server/papieren/). De keuring vult het document hier dus echt in en telt
     hoeveel gaten er overblijven -- geen aparte administratie die uit de pas
     kan gaan lopen met het papier zelf.

     Wat hij NIET kan: beoordelen of wat er staat juridisch klopt. Dat blijft
     mensenwerk. Hij controleert alleen dat het bestaat en niet half af is. */
  const papieren = require('../server/papieren');
  const nogOpen = papieren.openVragen();
  for (const naam of Object.keys(papieren.DOCUMENTEN)) {
    const d = papieren.document(naam);
    if (d.fout) { blokkeer(papieren.DOCUMENTEN[naam].bestand + ' ontbreekt: ' + papieren.DOCUMENTEN[naam].waarvoor + ' is verplicht voor je live gaat.'); continue; }
    const controleer = (d.tekst.match(/\[(CONTROLEER|TE DOEN)/g) || []).length;
    if (d.gaten) blokkeer(d.bestand + ': nog ' + d.gaten + ' open plek(ken) -- ' + d.waarvoor + ' is niet af.');
    else if (controleer) waarschuw(d.bestand + ': ' + controleer + ' punt(en) die een jurist moet nakijken voor je live gaat.');
    else goed(d.bestand + ' is ingevuld (' + d.waarvoor + '). Laat het alsnog juridisch nakijken.');
  }
  if (nogOpen.length)
    blokkeer('Papierwerk: ' + nogOpen.length + ' van de ' + papieren.VRAGEN.length + ' vragen staan nog open (eerste: "' +
      nogOpen[0].vraag + '"). Laat Rahul ze uitvragen op de technische pagina; met de hand in het bestand typen hoeft niet.');
  else goed('Papierwerk: alle ' + papieren.VRAGEN.length + ' vragen zijn beantwoord.');

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
  console.log(' - Een onafhankelijke pentest voor de lancering; eigen tests vervangen geen vreemde ogen.');
  console.log('   (Backups: npm test -- test/herstelproef.test.js zet er echt een terug.)');

  console.log('');
  if (blokkers) {
    const hulp = bestand
      ? 'Vul de HANDMATIG-regels in .env.productie en rond het gemelde papierwerk af.'
      : 'Maak eerst veilig .env.productie met: npm run sleutels:bestand';
    console.log('NIET klaar om live te gaan: ' + blokkers + ' blokkerend(e) punt(en). ' + hulp);
    process.exit(1);
  }
  console.log('Klaar om live te gaan. Start met NODE_ENV=production (of npm run vloot voor losse processen).');
})();
