/* Go-live-keuring: controleert in een keer of deze omgeving echt live kan.
   Draai op de productiemachine (met de echte omgevingsvariabelen geladen):

     npm run golive

   Staat er een .env.productie in de projectmap (gemaakt met
   npm run sleutels -- --schrijf), dan leest de keuring die vanzelf mee. In
   Docker wijst RTG_ENV_FILE naar hetzelfde bestand als gemount geheim;
   echte omgevingsvariabelen winnen altijd van het bestand. De keuring
   beoordeelt de configuratie ALSOF het productie is (ook als NODE_ENV nog
   niet op production staat), probeert PostgreSQL echt te bereiken, en drukt
   een lijst af met kruisjes en vinkjes. Exitcode 1 zolang er blokkerende
   punten zijn; 0 = klaar om live te gaan. */
const fs = require('fs');
const { maskerEmail, zonderGeheim } = require('./lib/geenlek');
const path = require('path');
const config = require('../server/config');
const foundationVrijgave = require('../server/config/foundation-vrijgave');
const accountDuurzaamheid = require('../server/accounts/duurzaamheid');
const RELEASE = path.join(__dirname, '..', '.release');
const RAPPORT = path.join(RELEASE, 'golive-bewijs.json');
/* De live-wrapper draait deze keuring bewust in de read-only app-container en
   laat het proces zijn rapport via stdout aan de host overdragen. Alleen deze
   exacte, argumentloze modus wijkt af van de normale lokale bestandsuitvoer. */
const RAPPORT_NAAR_STDOUT = process.argv.length === 3 && process.argv[2] === '--bewijs-stdout';
if (!RAPPORT_NAAR_STDOUT) {
  try { fs.rmSync(RAPPORT, { force: true }); } catch (e) {}
}

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
  // 0. het productie-envbestand, als dat er is (echte env wint altijd). In
  //    Docker is dit /run/secrets/rtg_env; op de host blijft de vertrouwde
  //    .env.productie de standaard. Nooit `source`: waarden blijven letterlijk.
  const standaardEnvPad = path.join(__dirname, '..', '.env.productie');
  const envPad = process.env.RTG_ENV_FILE
    ? path.resolve(process.env.RTG_ENV_FILE)
    : standaardEnvPad;
  let bestand = null;
  if (fs.existsSync(envPad)) {
    bestand = leesEnvBestand(envPad) || {};
    // HANDMATIG-plekken die nog niet zijn ingevuld tellen niet mee
    for (const [k, v] of Object.entries(bestand)) if (/VUL-IN/i.test(v)) delete bestand[k];
    goed(path.basename(envPad) + ' gevonden en meegelezen (' + Object.keys(bestand).length + ' ingevulde waarden).');
    // het geheimenbestand mag nooit in git terechtkomen
    try { if (envPad === standaardEnvPad) {
      const ignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
      if (!/^\.env(\.\*|\.productie)?$/m.test(ignore) || !/\.env\./.test(ignore))
        blokkeer('.env.productie staat niet in .gitignore: het geheimenbestand zou in git kunnen belanden.');
    } } catch (e) {}
  } else if (process.env.RTG_ENV_FILE) {
    blokkeer('RTG_ENV_FILE wijst naar een ontbrekend geheimenbestand: ' + envPad + '.');
  }

  // 1. de configuratie, beoordeeld op productieniveau
  const env = { ...(bestand || {}), ...process.env, NODE_ENV: 'production' };
  // Docker bewaart het PostgreSQL-wachtwoord bewust in een tweede secret, dus
  // DATABASE_URL staat niet in rtg_env en verschijnt niet in docker inspect.
  // Bouw voor deze keuring exact dezelfde interne URL als de startwikkel.
  if (!env.DATABASE_URL && env.RTG_POSTGRES_PASSWORD_FILE) {
    try {
      const wachtwoord = fs.readFileSync(env.RTG_POSTGRES_PASSWORD_FILE, 'utf8').replace(/[\r\n]+$/, '');
      if (wachtwoord.length < 16) throw new Error('leeg of te kort');
      env.DATABASE_URL = 'postgresql://rtg:' + encodeURIComponent(wachtwoord) + '@postgres:5432/rtg';
      goed('PostgreSQL-connectie veilig uit het aparte Docker-secret opgebouwd.');
    } catch (e) {
      blokkeer('RTG_POSTGRES_PASSWORD_FILE is niet bruikbaar: ' + (e.message || e));
    }
  }
  if (env.RTG_PRIVATE_BETA === '1')
    blokkeer('RTG_PRIVATE_BETA=1 staat nog aan: deze stand is alleen voor localhost en mag nooit als publieke livegang worden goedgekeurd.');
  const r = config.valideer(env);
  for (const f of r.fouten) blokkeer(f);
  for (const w of r.waarschuwingen) waarschuw(w);
  if (!r.fouten.length) goed('Configuratie: geen blokkerende fouten.');
  /* Een losse Node-instantie mag voor een afgeschermde proef op SQLite en
     proceslokale tellers draaien. Dat is niet hetzelfde als een B2B2C-
     go-live: geld, intrekking, rate limits en realtime moeten instanceverlies
     en horizontale schaal overleven. De releasekeuring vereist daarom beide
     gedeelde diensten positief, ook al kan de applicatie fail-closed opkomen. */
  if (!env.DATABASE_URL)
    blokkeer('B2B2C-opslag: DATABASE_URL ontbreekt; go-live vereist PostgreSQL en geen lokale SQLite-waarheid.');
  if (!env.REDIS_URL)
    blokkeer('B2B2C-coordinatie: REDIS_URL ontbreekt; gedeelde frauderem, realtime en intrekking zijn niet multi-instance bewezen.');
  const accountStand = accountDuurzaamheid.releaseStand(env);
  if (!accountStand.gereed || !accountStand.transactioneel ||
      accountStand.productieMutaties !== 'duurzaam')
    blokkeer('B2B2C-identiteit [' + accountStand.code + ']: users/staff zijn nog niet aan de gedeelde PostgreSQL-requesttransactie gebonden; accountmutaties blijven veilig 503.');
  else goed('B2B2C-identiteit: accountmutaties zijn gedeeld en transactioneel duurzaam.');
  if (env.RTG_OWNER_BOOTSTRAP)
    blokkeer('RTG_OWNER_BOOTSTRAP staat nog in de productieomgeving. Gebruik hem uitsluitend voor de eerste eigenaarsregistratie en verwijder hem vóór go-live.');
  /* Een server kan veilig draaien met alle geldwegen dicht. Dat maakt de
     configuratie geldig, maar niet de volledige B2B2C-operatie productieklaar.
     Deze drie punten zijn daarom een GO-LIVE-poort en geen startvoorwaarde:
     het proces mag fail-closed opkomen, de release krijgt geen READY-stempel. */
  const geldStand = require('../server/config/productie-geld').stand(env);
  const geldMotor = { vereist: geldStand.inkomendGeconfigureerd || geldStand.uitgaandGeconfigureerd,
    modus: String(env.RTG_MOTOR_GELD || 'schaduw').toLowerCase(),
    bereikbaar: false, native: [], duurzaam:null, bank:null,
    verwachtGenesis: String(env.RTG_MOTOR_EXPECT_GENESIS || '') };
  if (!geldStand.inkomendGeconfigureerd)
    blokkeer('B2B2C-geld: de echte inkomende betaalrail heeft geen provider geconfigureerd.');
  if (!geldStand.uitgaandGeconfigureerd)
    blokkeer('B2B2C-geld: er is geen werkende productie-uitbetaalrail geconfigureerd. ' + geldStand.uitgaandWaarom);
  if (!geldStand.foundationRekeningGeconfigureerd)
    blokkeer('B2B2C-geld: RTF_IBAN ontbreekt of is geen geldig IBAN voor Foundation-settlement.');
  if (geldMotor.vereist && geldMotor.modus !== 'motor')
    blokkeer('B2B2C-geld: echte geldrails vereisen RTG_MOTOR_GELD=motor; JS write-behind/schaduw is niet multi-instance duurzaam.');
  if (geldMotor.vereist && env.RTG_RUST_ALLES_UIT === '1')
    blokkeer('B2B2C-geld: de centrale Rust-noodstop staat aan terwijl echte geldrails actief zijn.');
  if (geldMotor.vereist && !(env.RTG_MOTOR_GELD_URL || env.RTG_MOTOR_SHADOW))
    blokkeer('B2B2C-geld: de duurzame geldmotor heeft geen bereikbare productie-URL.');
  /* De env-vlag alleen is nooit een juridische of operationele vrijgave. Het
     vaste externe dossier moet dezelfde releasecommit, drie relevante PASS-
     controles en gehashte bewijsverwijzingen dragen. Zonder aanvraag blijven
     de risicoroutes veilig dicht en blokkeert dit de rest van RTG niet. */
  const foundationStand = foundationVrijgave.beoordeel({ env });
  if (!env[foundationVrijgave.ENV_NAAM])
    goed('Beschermde Foundation-functies blijven voor deze release server-side gesloten.');
  else if (!foundationStand.vrijgegeven)
    blokkeer('Foundation-vrijgave geweigerd: de vlag heeft geen geldig commit-gebonden extern dossier (' +
      foundationStand.reden + ').');
  else goed('Beschermde Foundation-functies zijn door een commit-gebonden extern dossier vrijgegeven.');
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
      /* DE FOUT VAN DE DRIVER GAAT ER GEMASKEERD IN. Hierboven wordt
         DATABASE_URL zo nodig zelf samengesteld uit het wachtwoordbestand, dus
         die reeks DRAAGT een wachtwoord -- en een driverfout neemt de
         verbindingsreeks nogal eens mee. Dat is een wachtwoord in de log op
         precies het moment dat iemand de log gaat delen om hulp te vragen. */
      blokkeer('DATABASE_URL is gezet maar de database antwoordt niet: ' + zonderGeheim(e.message || e));
    }
  }

  /* 2a. Redis, gedeelde bytes en externe alarmering actief beproeven. Een
     PING bewijst geen pub/sub-intrekking en geen atomaire instancebrede
     limiter. De Redis-proef gebruikt daarom drie onafhankelijke verbindingen,
     een eenmalig bericht en een tijdelijke EVAL-limietteller.
     sleutel of webhook-URL in de omgeving is geen bewijs dat twee instances
     dezelfde media zien of dat een alarm de ontvanger bereikt. Deze proeven
     schrijven uitsluitend een willekeurig tijdelijk object en een herkenbare
     zelfproefmelding; beide uitkomsten gaan mee in het releasebewijs. */
  const uitgangen = require('./lib/golive-uitgangen');
  const redisBewijs = await uitgangen.beproefRedis(env);
  if (redisBewijs.ok)
    goed('Redis: cross-instance pub/sub en atomische rate limit actief bewezen.');
  else blokkeer('Redis is niet operationeel bewezen: ' + zonderGeheim(redisBewijs.reden || 'onvolledige proef') + '.');
  const gedeeldeMedia = await uitgangen.beproefMedia(env);
  if (gedeeldeMedia.ok)
    goed('Gedeelde media: put/get/hash/delete over twee backendinstanties geslaagd.');
  else blokkeer('Gedeelde media is niet actief bewezen: ' + zonderGeheim(gedeeldeMedia.reden || 'onvolledige proef') + '.');
  const alarmering = await uitgangen.beproefAlarm(env);
  if (alarmering.ok)
    goed('Externe foutalarmering heeft de go-live-zelfproef met 2xx ontvangen.');
  else blokkeer('Externe foutalarmering is niet actief bewezen: ' + zonderGeheim(alarmering.reden || 'onvolledige proef') + '.');

  // 2b. Een ingestelde Rust-cutover ook werkelijk aanraken. Alleen een URL en
  // vlag controleren bewijst niet dat de sidecar draait of de juiste binary is.
  if (env.RTG_MOTOR_REKEN_URL || env.RTG_MOTOR_GELD_URL || env.RTG_MOTOR_SHADOW) {
    const motor = await require('./lib/motor-proef').motorProef(env);
    geldMotor.bereikbaar = motor.ok === true && motor.noodstop !== true;
    geldMotor.native = Array.isArray(motor.native) ? motor.native : [];
    geldMotor.duurzaam = motor.duurzaam || null;
    geldMotor.bank = motor.bank || null;
    if (!motor.ok) blokkeer('Rust-motor is geconfigureerd maar niet inzetbaar: ' + motor.fout);
    else if (motor.noodstop) waarschuw('Rust-appmotoren zijn door RTG_RUST_ALLES_UIT=1 bewust overgeslagen; Sentinel blijft actief.');
    else goed('Rust-motor bereikbaar (' + motor.ms + ' ms; native: ' + motor.native.join(', ') + ').');
  }
  if (env.RTG_CAPABILITY_RUST_BIN && env.RTG_RUST_ALLES_UIT !== '1') {
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
  } else if (env.RTG_CAPABILITY_RUST_BIN) waarschuw('Native capabilityscan is door de centrale Rust-noodstop bewust niet uitgevoerd.');

  // 3. de sleutels die instances MOETEN delen
  if (env.DATABASE_URL && env.RTG_VAULT_KEY && env.RTG_SECRET_KEY)
    goed('Gedeelde sleutels (kluis + tokens) staan klaar voor meerdere instances.');

  // 4. HTTPS-hygiene
  if (env.APP_URL && !/^https:\/\//.test(env.APP_URL))
    blokkeer('APP_URL is geen https-adres: e-maillinks zouden onversleuteld wijzen.');
  else if (env.APP_URL) goed('APP_URL is https.');

  // 5. de eigenaar (nogmaals expliciet, want dit is de sleutel van alles)
  if (env.RTG_OWNER_EMAIL && env.RTG_OWNER_EMAIL !== 'rahul@rtg.example')
    /* GEMASKEERD, en dat is hier geen overdaad: dit huis draait op codenamen
       (CLAUDE.md, privacy by design). Een adres in een terminalbuffer of in een
       screenshot bij een hulpvraag is precies de terugweg van codenaam naar
       mens die dat ontwerp wil voorkomen. De keuring wil alleen weten OF de
       eigenaar gezet is en of hij niet nog op het voorbeeld staat; daar is de
       gemaskeerde vorm genoeg voor. */
    goed('Eigenaar van de technische pagina: ' + maskerEmail(env.RTG_OWNER_EMAIL));

  // 6. de tweede factor van de backoffice
  if (env.OFFICE_TOTP_SECRET)
    goed('Backoffice-2FA (TOTP) staat aan.');

  // 7. Magnaat Test en de verouderde snelle testinlog mogen nooit op de echte
  //    installatie werken. De configuratiekeuring blokkeert beide standen;
  //    hier bevestigen we de bedoelde eindstand nogmaals zichtbaar.
  if (process.env.RTG_MAGNAAT_TEST !== '1' && process.env.RTG_DEMO !== '1')
    goed('Magnaat Test en snelle testinlog staan uit; leden loggen in via hun account, personeel met pincode.');

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
  /* EN NOG EEN ZEEF OVER ALLES WAT ERUIT GAAT. De maskering bij de bron
     hierboven is de echte reparatie; deze regel is de vangnetlaag voor de
     volgende melding die iemand toevoegt zonder eraan te denken. Paden,
     hostnamen en poortnummers blijven staan -- een keuring die niet meer zegt
     WELK pad ontbreekt, wordt niet gedraaid. */
  for (const [teken, tekst] of uit) console.log(' ' + teken + ' ' + zonderGeheim(tekst));
  const blokkers = uit.filter(x => x[2]).length;
  const rapport = {
    formaat: 'rtg-golive-bewijs-v1',
    afgerond: new Date().toISOString(),
    bron: require('./lib/runtime-release-stempel').lees(path.join(__dirname, '..')),
    geslaagd: blokkers === 0,
    blokkers,
    waarschuwingen: uit.filter(x => x[0] === '⚠').length,
    geld: geldStand,
    geldMotor,
    redis: redisBewijs,
    gedeeldeMedia,
    alarmering,
    accounts: accountStand,
    foundation: foundationStand,
    controles: uit.map(([teken, tekst, hard]) => ({ teken, hard: !!hard, tekst: zonderGeheim(tekst) }))
  };
  if (RAPPORT_NAAR_STDOUT) {
    /* Eén compacte, herkenbare regel: live.sh valideert hem en schrijft hem
       atomair op de host. De read-only applicatie krijgt geen schrijfmount. */
    console.log('RTG_GOLIVE_BEWIJS_JSON=' + JSON.stringify(rapport));
  } else {
    fs.mkdirSync(RELEASE, { recursive: true, mode: 0o700 });
    const tijdelijk = RAPPORT + '.tmp-' + process.pid;
    fs.writeFileSync(tijdelijk, JSON.stringify(rapport, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(tijdelijk, RAPPORT);
  }

  /* De punten die BUITEN de code liggen: geen kruisjes (de keuring kan ze
     vanaf hier niet zien), maar wel elke keer op het bord, zodat ze nooit
     stilletjes worden overgeslagen. */
  console.log('\nBuiten de code, op de server zelf (zie LIVEGANG.md):');
  if (env.RTG_TLS === '1' && env.RTG_ACME === '1')
    console.log(' - Native TLS/ACME staat klaar; DNS moet naar deze server wijzen en poort 80/443 moet publiek bereikbaar zijn.');
  else
    console.log(' - TLS-terminatie via de gekozen reverse proxy/load balancer moet nog buiten de app worden ingericht.');
  console.log(' - Volumetrische DDoS-bescherming vóór de server is afhankelijk van het risicoprofiel; de app-WAF is de tweede linie.');
  console.log(' - Een onafhankelijke pentest voor de lancering; eigen tests vervangen geen vreemde ogen.');
  console.log('   (Backups: npm run live:backup; herstel: npm run live:restore -- <timestamp>.)');

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
