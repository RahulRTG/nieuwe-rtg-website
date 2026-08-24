#!/usr/bin/env node
/* DE GIETVORM -- een verse datamap die niet elke keer opnieuw gezaaid wordt.

   WAAROM DIT ER IS, IN EEN GEMETEN ZIN. Van de 673 toetsbestanden die een server
   starten geven er 472 aan die server NIETS mee behalve een eigen datamap (en
   SMTP_URL='', wat overal dezelfde lege waarde is). Elk van die 472 laat de
   server vervolgens dezelfde zaai-arbeid doen: de leden, de leveranciers, de
   genres, de drie SQLite-databases. Gemeten op deze machine, drie rondes elk:

     lege map, server zaait zelf     3063 / 2862 / 2735 ms   (gemiddeld 2887)
     voorgevulde map                 1949 / 2048 / 1976 ms   (gemiddeld 1991)

   Dat is 896 ms per start die niemand nodig heeft. Over 472 bestanden op vier
   kernen is dat ruim twee minuten van een ronde van een kwartier.

   WAT DIT NIET IS, EN DAT IS BELANGRIJKER DAN WAT HET WEL IS. Dit is GEEN
   gedeelde server en geen gedeelde map. Elke toets houdt zijn eigen verse map en
   zijn eigen verse proces; het enige dat gedeeld wordt is de MOEITE om die map
   te vullen. Er is dus geen enkele toestand die van de ene toets naar de andere
   kan lekken -- de winst kost geen isolatie. Dat is met opzet de eerste stap:
   echt hergebruik van een serverproces vraagt een bewijs per toets, en dit
   vraagt er geen.

   WANNEER ER NIET GEGOTEN WORDT. De vorm is gemaakt met EEN bepaalde omgeving
   (NODE_ENV=test, RTG_DEMO=1, RTG_DEV_LINKS=1, SMTP_URL=''), en die omgeving
   bepaalt WAT er gezaaid wordt -- RTG_DEMO zet demo-accounts neer, DEMO_SUPPLIER
   kiest een andere zaak, RTG_STORE een andere motor. Een toets die iets anders
   meegeeft krijgt daarom GEEN vorm en zaait gewoon zelf. De poort staat in
   test/helper.js en is streng: alleen de sleutels op de witte lijst hieronder.

   De sleutel van de vorm bevat de hele serverboom, de nodeversie, de
   opslagkeuze EN de kalenderdag. Dat laatste omdat de server bij het opstarten
   dingen met een datum in de naam neerzet (een reservekopie per dag); een vorm
   van gisteren zou vandaag een map met een verkeerde datum opleveren. Een dag
   kost een boot van drie seconden, dat is geen prijs.

   Draai:
     node scripts/vorm.js            maak de vorm als hij er niet is
     node scripts/vorm.js --pad      druk het pad af (leeg als er geen vorm is)
     node scripts/vorm.js --opnieuw  gooi weg en maak opnieuw
*/
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const net = require('net');

const WORTEL = path.join(__dirname, '..');
const kas = require(path.join(WORTEL, 'server', 'lib', 'bronkas'));

/* De omgeving waarin de vorm wordt gegoten. Wie hier iets bij zet, verandert wat
   er in de vorm zit, en dus ook wie hem mag gebruiken: de witte lijst in
   test/helper.js hoort dezelfde afspraak te weerspiegelen. */
const VORM_ENV = { NODE_ENV: 'test', RTG_DEMO: '1', RTG_DEV_LINKS: '1', SMTP_URL: '' };

/* WELKE OMGEVING BEPAALT WAT ER IN DE VORM ZIT.

   VORM_ENV hierboven zet de server in de stand waarin de vorm wordt gegoten.
   Maar de omgeving van de LOPER lekt ook door naar elke kindserver (test/helper.js
   doet `...process.env`), en een paar van die sleutels veranderen wat er gezaaid
   wordt of hoe het eruitziet. Als een van deze anders staat dan toen de vorm werd
   gegoten, hoort er niet gegoten te worden -- dan zaait de server gewoon zelf.

   Dit is met opzet een LIJST en geen slimmigheid. Een vorm die stilletjes de
   verkeerde data levert geeft geen fout maar een verkeerd antwoord, en dat is de
   duurste soort. Wie hier een sleutel bij moet zetten, zet hem erbij; de prijs is
   dat een paar toetsen zelf zaaien. */
const RECEPT = ['DEMO_SUPPLIER', 'DEMO_PASS', 'RTG_OWNER_EMAIL', 'RTG_ENC_KEY', 'RTG_STORE',
  'DATABASE_URL', 'PG_URL', 'REDIS_URL', 'OFFICE_CODE', 'OFFICE_TOTP_SECRET',
  'RTG_DOMAINS', 'RTG_SERVER', 'RTG_KLOK', 'RTG_ZAAD', 'RTG_VERRAAD'];
function receptVan(env) {
  const uit = {};
  for (const k of RECEPT) if (env[k] !== undefined) uit[k] = String(env[k]);
  return uit;
}

/* Wat de vorm bepaalt. De serverboom via het bronmanifest (dezelfde sleutelvorm
   als de rest van de kas), plus alles wat buiten de bron om de inhoud stuurt. */
function sleutel() {
  const delen = [
    kas.manifestVan(path.join(WORTEL, 'server'), (p) => p.endsWith('.js'), 'vorm', { vers: true }),
    'node=' + process.versions.node,
    'store=' + (process.env.RTG_STORE || ''),
    'pg=' + (process.env.DATABASE_URL || process.env.PG_URL ? 'ja' : 'nee'),
    'env=' + JSON.stringify(VORM_ENV),
    'recept=' + JSON.stringify(receptVan(process.env)),
    /* De kalenderdag, want de server zet bij het starten een reservekopie neer
       in een map met de datum in de naam. Zonder deze regel zou een vorm van
       gisteren vandaag een map met de verkeerde datum opleveren -- en dat is
       precies het soort verschil dat een toets een keer per etmaal rood maakt
       zonder dat er iets stuk is. */
    'dag=' + new Date().toISOString().slice(0, 10)
  ];
  return kas.sleutelUit(delen).slice(0, 16);
}

/* HET PAD OPZOEKEN MAG NIET DUURDER ZIJN DAN WAT HET BESPAART.

   sleutel() hasht de hele serverboom: 100 ms. De helper vraagt er drie keer naar
   per serverstart (bestaat de vorm, klopt de omgeving, giet hem in), en dat is
   300 ms van de 566 die het gieten oplevert -- ruim de helft van de winst weg,
   aan het uitrekenen van het antwoord. Zelf gemeten en zelf gemaakt.

   Twee lagen dus. RTG_VORM wint altijd: de toetsloper rekent de sleutel EEN keer
   uit voor de hele ronde en geeft het pad door, en dan kost dit niets. Zonder die
   variabele -- een losse `node --test test/x.test.js` -- wordt hij een keer per
   PROCES uitgerekend en daarna onthouden.

   Wat RTG_VORM NIET doet: een vorm goedkeuren. Het merk wordt nog steeds gelezen
   en het recept nog steeds vergeleken. Wat het wel overslaat is de vraag of de
   BRON sinds het gieten is veranderd; die verantwoordelijkheid ligt bij wie de
   variabele zet, en dat is de loper aan het begin van de ronde. Wie midden in een
   ronde in server/ zit te typen heeft grotere problemen dan een oude gietvorm. */
let onthoudenSleutel = null;
function vormPad(s) {
  if (!s && process.env.RTG_VORM) return process.env.RTG_VORM;
  if (!s) s = (onthoudenSleutel || (onthoudenSleutel = sleutel()));
  return path.join(kas.kasMap(), 'vorm-' + s);
}

/* Er is pas een vorm als het merkbestand er staat. Een half gekopieerde map is
   erger dan geen map: die geeft een server die start op onvolledige data en dan
   iets anders doet dan hij hoort. Het merk wordt als LAATSTE geschreven, na de
   hernoeming, dus wie het ziet weet dat de rest er ook is. */
const MERK = '.vorm-af';
function erIsEenVorm(p) { return !!merkVan(p); }

/* Het merk draagt het recept waarmee de vorm is gegoten. Zo kan een aanroeper
   NAKIJKEN of zijn eigen omgeving dezelfde is, in plaats van het te geloven.
   Een merk dat niet te lezen is telt als "klopt niet": bij twijfel zaait de
   server zelf, dat kost een halve seconde en geen zekerheid. */
/* HET MERK WORDT ELKE KEER GELEZEN, EN DAT IS EEN BESLUIT.

   Hier heeft een onthoudlaag gestaan, "want drie lezingen per serverstart". Dat
   was de verkeerde plek: van de 106 ms die zo'n lezing kostte zat 106 ms in
   sleutel() (een hash over de hele serverboom) en vrijwel niets in het lezen van
   dit kleine JSON-bestand. De onthoudlaag leverde dus niets op en kostte wel
   iets: test/gietvorm.test.js haalt het merk weg om te bewijzen dat een half
   gekopieerde vorm nooit wordt gebruikt, en die toets zag daarna zijn eigen
   verwijdering niet meer. Hij is er dus in geslaagd waar hij voor staat, op de
   dag dat hij geschreven werd. Het onthouden zit nu waar het hoort: op de
   sleutel, in vormPad(). */
function merkVan(p) {
  try { return JSON.parse(fs.readFileSync(path.join(p || vormPad(), MERK), 'utf8')); }
  catch (e) { return null; }
}
function omgevingKlopt(env) {
  const merk = merkVan();
  if (!merk || !merk.recept) return false;
  const mijn = receptVan(env || process.env);
  const a = Object.keys(merk.recept).sort(), b = Object.keys(mijn).sort();
  if (a.join('|') !== b.join('|')) return false;
  return a.every(k => merk.recept[k] === mijn[k]);
}

function vrijePoort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

/* Een server starten op een lege map, wachten tot hij ECHT klaar is, en hem
   daarna NET stoppen (SIGTERM, niet SIGKILL). Dat verschil is hier geen detail:
   met SIGKILL krijgt de write-behind geen kans zijn laatste brokken weg te
   schrijven, en dan bevat de vorm minder dan een verse map. */
async function gietEenServer(doel) {
  const poort = await vrijePoort();
  const kind = spawn(process.execPath, ['--experimental-sqlite', path.join(WORTEL, 'server', 'server.js')], {
    cwd: WORTEL,
    env: { ...process.env, ...VORM_ENV, RTG_DATA_DIR: doel, PORT: String(poort), RTG_TOETS: 'gietvorm' },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let stderr = '';
  kind.stderr.on('data', (b) => { stderr += b.toString(); if (stderr.length > 20000) stderr = stderr.slice(-20000); });
  const basis = 'http://127.0.0.1:' + poort;
  const tot = Date.now() + 120000;
  try {
    for (;;) {
      if (kind.exitCode != null)
        throw new Error('de server stopte tijdens het gieten (exit ' + kind.exitCode + ')\n' + stderr.slice(-1500));
      if (Date.now() > tot)
        throw new Error('de server werd niet klaar binnen 120 s tijdens het gieten\n' + stderr.slice(-1500));
      const r = await fetch(basis + '/api/ready', { headers: { 'X-Forwarded-Proto': 'https' } }).catch(() => null);
      if (r && r.ok) break;
      await new Promise(r2 => setTimeout(r2, 100));
    }
    await new Promise((res) => {
      const klaar = () => res();
      kind.once('exit', klaar);
      try { kind.kill('SIGTERM'); } catch (e) { return klaar(); }
      setTimeout(() => { try { kind.kill('SIGKILL'); } catch (e) {} klaar(); }, 20000).unref();
    });
  } catch (e) {
    try { kind.kill('SIGKILL'); } catch (e2) {}
    throw e;
  }
}

/* Wat er NIET in de vorm hoort.

   backups/  de server maakt bij het starten zelf een reservekopie. Die met de
             vorm meesturen scheelt NIETS -- gemeten: 2124 ms tegen 2054 ms, dus
             ruis -- en verdubbelt wel de omvang (1118 kB tegen 670) en dus de
             giettijd. Blijft er dus uit.
   *-shm     het gedeelde-geheugenbestand van SQLite. Dat is een index op de
             WAL en wordt bij het openen opnieuw gemaakt; een gekopieerde -shm
             die niet bij het proces hoort is in het gunstigste geval onzin.
             De WAL zelf blijft WEL staan: die hoort bij zijn database. */
function schoonVorm(map) {
  try { fs.rmSync(path.join(map, 'backups'), { recursive: true, force: true }); } catch (e) {}
  let namen = [];
  try { namen = fs.readdirSync(map); } catch (e) { return; }
  for (const n of namen) if (n.endsWith('-shm')) { try { fs.unlinkSync(path.join(map, n)); } catch (e) {} }
}

async function maakVorm(opties) {
  const s = sleutel();
  const doel = vormPad(s);
  if (!(opties && opties.opnieuw) && erIsEenVorm(doel)) return doel;
  try { fs.rmSync(doel, { recursive: true, force: true }); } catch (e) {}
  const werk = doel + '.bouw.' + process.pid;
  try { fs.rmSync(werk, { recursive: true, force: true }); } catch (e) {}
  fs.mkdirSync(werk, { recursive: true, mode: 0o700 });
  try {
    await gietEenServer(werk);
    schoonVorm(werk);
    fs.renameSync(werk, doel);
    fs.writeFileSync(path.join(doel, MERK), JSON.stringify({
      sleutel: s, gegotenOp: new Date().toISOString(), node: process.versions.node,
      env: VORM_ENV, recept: receptVan(process.env)
    }, null, 1) + '\n', { mode: 0o600 });
  } catch (e) {
    try { fs.rmSync(werk, { recursive: true, force: true }); } catch (e2) {}
    throw e;
  }
  ruimOudeVormenOp(s);
  return doel;
}

/* Twee vormen blijven staan (vandaag en de vorige stand), de rest gaat weg. Net
   als de bronkas: schakelen tussen takken mag niet elke keer een boot kosten, en
   de tijdelijke map mag niet volgroeien. */
function ruimOudeVormenOp(houdSleutel) {
  let namen = [];
  try { namen = fs.readdirSync(kas.kasMap()); } catch (e) { return; }
  const mijn = namen.filter(n => n.startsWith('vorm-') && n !== 'vorm-' + houdSleutel)
    .map(n => {
      const p = path.join(kas.kasMap(), n);
      try { return { p, t: fs.statSync(p).mtimeMs }; } catch (e) { return null; }
    }).filter(Boolean).sort((a, b) => b.t - a.t);
  for (const oud of mijn.slice(1)) { try { fs.rmSync(oud.p, { recursive: true, force: true }); } catch (e) {} }
}

/* GIETEN. Geeft true als de map nu een verse, volledige installatie bevat, en
   false als er niets is gebeurd -- dan zaait de server gewoon zelf.

   Er wordt NOOIT half gegoten. Loopt het kopieren stuk (schijf vol, een vorm die
   net door een opruimer is weggehaald), dan wordt alles wat er al stond weer
   weggehaald en is de uitkomst een lege map: precies wat de aanroeper had.
   Een half gevulde map zou een server opleveren die start op onvolledige data en
   daarna iets anders doet dan hij hoort, en dat is een fout die niemand op deze
   plek zou zoeken. */
function gietIn(doel) {
  const p = vormPad();
  if (!erIsEenVorm(p)) return false;
  let gezet = [];
  try {
    for (const n of fs.readdirSync(p)) {
      if (n === MERK) continue;
      fs.cpSync(path.join(p, n), path.join(doel, n), { recursive: true, preserveTimestamps: false });
      gezet.push(n);
    }
    return true;
  } catch (e) {
    for (const n of gezet) { try { fs.rmSync(path.join(doel, n), { recursive: true, force: true }); } catch (e2) {} }
    return false;
  }
}

module.exports = { sleutel, vormPad, erIsEenVorm, merkVan, omgevingKlopt, maakVorm, gietIn, VORM_ENV, RECEPT, receptVan, MERK };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--pad')) {
    const p = vormPad();
    process.stdout.write((erIsEenVorm(p) ? p : '') + '\n');
    process.exit(erIsEenVorm(p) ? 0 : 1);
  }
  const t0 = Date.now();
  maakVorm({ opnieuw: args.includes('--opnieuw') })
    .then((p) => {
      const bytes = (function tel(m) {
        let s = 0;
        for (const n of fs.readdirSync(m)) {
          const q = path.join(m, n); const st = fs.statSync(q);
          s += st.isDirectory() ? tel(q) : st.size;
        }
        return s;
      })(p);
      console.log('[vorm] ' + p + '  (' + Math.round(bytes / 1024) + ' kB, ' + (Date.now() - t0) + ' ms)');
    })
    .catch((e) => { console.error('[vorm] MISLUKT: ' + e.message); process.exit(1); });
}
