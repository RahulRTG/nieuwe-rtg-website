/* DE GO-LIVE-KEURING ALS MODULE.

   Deze keuring stond alleen in scripts/golive.js, als een script dat op de
   productiemachine wordt gedraaid en zijn oordeel naar de terminal schrijft.
   Dat is precies een plek te weinig: de eigenaar zit niet in een terminal maar
   in de boardroom, en daar wordt ook het papierwerk ingevuld dat drie van de
   acht blokkerende punten uitmaakt. Iemand die daar alles invult, hoort er ook
   te kunnen zien dat het genoeg was.

   Wat hier NIET gebeurt is een tweede keuring naast de eerste. De controles
   staan hier een keer; `scripts/golive.js` drukt het resultaat af en bepaalt
   de exitcode, en de boardroom en het techniekbord tonen dezelfde lijst. Twee
   implementaties zouden uiteenlopen zodra iemand er een aanraakt, en dan is
   "npm run golive is groen" iets anders dan "het bord staat groen".

   WAT ER NOOIT UIT DEZE MODULE KOMT: de WAARDE van een geheim. De keuring zegt
   dat RTG_VAULT_KEY ontbreekt of dat hij er is -- nooit wat erin staat. Dat is
   geen detail: dit antwoord gaat over een netwerkverbinding naar een browser,
   en een sleutel die in een scherm belandt, staat daarna in een cache, een log
   en een schermafdruk. Het enige wat wel wordt teruggegeven is het
   eigenaars-e-mailadres, want dat is precies het adres van degene die dit
   scherm mag zien.

   Het oordeel wordt geveld ALSOF het productie is (NODE_ENV=production), ook
   als de server nu anders draait. Anders zou een keuring op een testmachine
   groen kunnen staan voor een opstelling die live meteen omvalt. */
const fs = require('fs');
const path = require('path');
const config = require('./config');

const WORTEL = path.join(__dirname, '..');

/* De punten die BUITEN de code liggen. Geen vinkjes -- de keuring kan ze vanaf
   hier niet zien -- maar ze staan er wel elke keer bij, zodat ze nooit
   stilletjes worden overgeslagen. */
const BUITEN_DE_CODE = [
  'TLS-terminatie (reverse proxy of load balancer) VOOR de app; trust proxy staat al aan.',
  'Rand-DDoS: DNS achter Cloudflare of gelijkwaardig met proxy aan; de app-WAF is de tweede linie.',
  'Een onafhankelijke pentest voor de lancering; eigen tests vervangen geen vreemde ogen.',
  'Backups: npm test -- test/herstelproef.test.js zet er echt een terug.'
];

/* .env.productie inlezen (alleen KEY=waarde-regels; # is commentaar). */
function leesEnvBestand(pad) {
  const uit = {};
  try {
    for (const regel of fs.readFileSync(pad, 'utf8').split('\n')) {
      const r = regel.trim();
      if (!r || r.startsWith('#')) continue;
      const i = r.indexOf('=');
      if (i > 0) uit[r.slice(0, i).trim()] = r.slice(i + 1).trim();
    }
  } catch (e) { return null; }
  return uit;
}

/* De keuring. `opties.database` op false slaat de echte PostgreSQL-verbinding
   over -- die doet netwerk-I/O met een wachttijd van vier seconden, en een
   scherm dat elke twaalf seconden ververst hoort dat niet elke keer te doen.
   Het script zet hem wel aan: daar telt "de variabele staat er" niet als bewijs
   dat de database antwoordt. */
async function keuring(opties) {
  const o = opties || {};
  const punten = [];
  const blokkeer = (t) => punten.push({ teken: '✗', tekst: t, blokkeert: true });
  const waarschuw = (t) => punten.push({ teken: '⚠', tekst: t, blokkeert: false });
  const goed = (t) => punten.push({ teken: '✓', tekst: t, blokkeert: false });

  // 0. het productie-envbestand, als dat er is (echte env wint altijd)
  const envPad = path.join(WORTEL, '.env.productie');
  let bestand = null;
  if (fs.existsSync(envPad)) {
    bestand = leesEnvBestand(envPad) || {};
    // HANDMATIG-plekken die nog niet zijn ingevuld tellen niet mee
    for (const [k, v] of Object.entries(bestand)) if (/VUL-IN/.test(v)) delete bestand[k];
    goed('.env.productie gevonden en meegelezen (' + Object.keys(bestand).length + ' ingevulde waarden).');
    // het geheimenbestand mag nooit in git terechtkomen
    try {
      const ignore = fs.readFileSync(path.join(WORTEL, '.gitignore'), 'utf8');
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
  if (process.env.NODE_ENV !== 'production')
    waarschuw('NODE_ENV staat nu op "' + (process.env.NODE_ENV || 'leeg') + '"; zet hem bij de echte start op production.');

  // 2. PostgreSQL echt aanraken (niet alleen "de variabele staat er")
  if (env.DATABASE_URL && o.database !== false) {
    try {
      const { Client } = require('./pgwire');
      const c = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 4000 });
      const t0 = Date.now();
      await c.connect();
      await c.query('SELECT 1');
      await c.end();
      goed('PostgreSQL bereikbaar (' + (Date.now() - t0) + ' ms).');
    } catch (e) {
      blokkeer('DATABASE_URL is gezet maar de database antwoordt niet: ' + (e.message || e));
    }
  } else if (env.DATABASE_URL) {
    waarschuw('DATABASE_URL is gezet; of de database echt antwoordt is hier niet geprobeerd (draai npm run golive op de machine zelf).');
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
  if (env.OFFICE_TOTP_SECRET) goed('Backoffice-2FA (TOTP) staat aan.');

  /* 7. de demo-inlog: het universele demo-account (naam/wachtwoord) mag in
        productie niet meer werken. Het is uit zodra NODE_ENV=production, tenzij
        iemand hem bewust met RTG_DEMO=1 weer aanzet (de config-keuring hierboven
        blokkeert dat geval al). Hier bevestigen we alleen dat hij uitstaat. */
  if (process.env.RTG_DEMO !== '1')
    goed('Demo-inlog (universeel account) staat uit in productie; leden loggen in via hun account, personeel met pincode.');

  /* De papieren kant, als ECHTE controle in plaats van een herinnering.

     Hier stond eerst alleen een regel tekst: "AVG op orde: verwerkersafspraken
     en het verwerkingsregister bijgewerkt." Dat is precies het soort
     proces-schijnvertoning waar niemand iets aan heeft -- een zin die je leest
     en waar niets van afhangt. Nu leest de keuring de documenten echt en kijkt
     of de plekken die alleen RTG kan invullen ook zijn ingevuld.

     De documenten staan in git met {{merktekens}}; de antwoorden komen uit de
     vragen die Rahul stelt (zie server/papieren/). De keuring vult het document
     hier dus echt in en telt hoeveel gaten er overblijven -- geen aparte
     administratie die uit de pas kan gaan lopen met het papier zelf.

     Wat hij NIET kan: beoordelen of wat er staat juridisch klopt. Dat blijft
     mensenwerk. Hij controleert alleen dat het bestaat en niet half af is. */
  const papieren = require('./papieren');
  const nogOpen = papieren.openVragen();
  for (const naam of Object.keys(papieren.DOCUMENTEN)) {
    const d = papieren.document(naam);
    if (d.fout) {
      blokkeer(papieren.DOCUMENTEN[naam].bestand + ' ontbreekt: ' + papieren.DOCUMENTEN[naam].waarvoor + ' is verplicht voor je live gaat.');
      continue;
    }
    const controleer = (d.tekst.match(/\[(CONTROLEER|TE DOEN)/g) || []).length;
    if (d.gaten) blokkeer(d.bestand + ': nog ' + d.gaten + ' open plek(ken) -- ' + d.waarvoor + ' is niet af.');
    else if (controleer) waarschuw(d.bestand + ': ' + controleer + ' punt(en) die een jurist moet nakijken voor je live gaat.');
    else goed(d.bestand + ' is ingevuld (' + d.waarvoor + '). Laat het alsnog juridisch nakijken.');
  }
  if (nogOpen.length)
    blokkeer('Papierwerk: ' + nogOpen.length + ' van de ' + papieren.VRAGEN.length + ' vragen staan nog open (eerste: "' +
      nogOpen[0].vraag + '"). Vul ze in bij Het papierwerk hieronder; met de hand in het bestand typen hoeft niet.');
  else goed('Papierwerk: alle ' + papieren.VRAGEN.length + ' vragen zijn beantwoord.');

  // blokkers eerst: wie dit leest, hoort bovenaan te zien wat hem tegenhoudt
  punten.sort((a, b) => (b.blokkeert ? 1 : 0) - (a.blokkeert ? 1 : 0));
  const blokkers = punten.filter(p => p.blokkeert).length;
  return { punten, blokkers, klaar: blokkers === 0, buitenDeCode: BUITEN_DE_CODE };
}

module.exports = { keuring, BUITEN_DE_CODE };
