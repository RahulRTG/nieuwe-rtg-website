#!/usr/bin/env node
/* ============================================================================
   DE POSTGRES-TOETSEN, ELK IN EEN EIGEN DATABASE.

   HET PROBLEEM DAT DIT OPLOST

   Zeven toetsbestanden delen de PostgreSQL-tabellen kv, users, supplier_staff
   en tx_ledger, en verschillende ervan maken en droppen die tabellen zelf. Op
   een gedeelde database trekt de een de tabel onder de ander weg. Elk bestand
   waarschuwt daar bovenaan zelf voor:

       "Draai ze daarom serieel via npm run test:pg (of geef elke toets een
        eigen database)."

   Serieel draaien is niet genoeg. Het voorkomt gelijktijdigheid, maar niet dat
   toets vijf begint op wat toets vier heeft achtergelaten. Zo zag ik
   leden-gids-pg zakken op "16 -> 16" -- het nieuwe lid landde niet in de gids
   -- terwijl datzelfde bestand met een eigen database gewoon slaagt. Een uur
   zoeken naar een bug die er niet was.

   De gevolgen daarvan zijn zichtbaar in de pijplijn: .github/workflows/ci.yml
   draaide er DRIE van de zeven. De andere vier staan wel in de repo maar zijn
   nooit uitgevoerd. Iemand is op dit gedrag gestuit en heeft de lijst
   ingekort -- begrijpelijk, maar dan heb je vier toetsen die eruitzien als
   dekking en er geen zijn.

   Deze runner geeft elk bestand een eigen, wegwerpbare database. Daarmee is
   het tweede deel van de eigen waarschuwing eindelijk waar, en kan de hele
   lijst weer draaien.

   Draai:  DATABASE_URL=postgres://... node scripts/pgtoetsen.js
           (zonder DATABASE_URL: netjes overgeslagen, net als de toetsen zelf)
   ========================================================================== */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const RAPPORT = path.join(WORTEL, '.release', 'pg-bewijs.json');
const BEWIJS_NAAR_STDOUT = process.argv.includes('--bewijs-stdout');
const K = { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', grijs: '\x1b[2m', reset: '\x1b[0m' };
try { fs.rmSync(RAPPORT, { force: true }); } catch (e) {}

/* De bestanden die een echte PostgreSQL nodig hebben. Bewust een expliciete
   lijst en geen glob: een bestand hoort hier pas in als iemand heeft nagedacht
   of het een eigen database wil. */
const { TOETSEN, toetslijstSha256 } = require('./lib/pg-toetslijst');

/* NUL TOETSEN IS GEEN GROEN.

   Hier stond `process.exit(0)` als er geen DATABASE_URL was. De tekst eronder
   was eerlijk -- er stond letterlijk dat alles werd overgeslagen -- maar de
   exitcode zei "goed". Wie dit in een pijplijn hangt of alleen naar het vinkje
   kijkt, ziet dekking die er niet is. Zo hebben acht bestanden maandenlang
   bestaan zonder ooit te draaien.

   Een meter moet ZAKKEN als zijn invoer ontbreekt, niet stilvallen. Dat doet
   scripts/dekking.js al goed (leeg journaal -> exitcode 2); hier deed hij het
   niet. Vanaf nu is niets-gedraaid een fout, en wie op een machine zonder
   database werkt spreekt dat een keer uit met --mag-overslaan.

   Datzelfde geldt verderop voor een bestand dat WEL draaide maar nul toetsen
   uitvoerde (bijvoorbeeld omdat het naast Postgres ook een REDIS_URL wil). */
const MAG_OVERSLAAN = process.argv.includes('--mag-overslaan');

/* Een kandidaatcontainer krijgt zijn waarden via read-only Docker-secrets.
   Lees het KEY=value-bestand zonder shell-evaluatie en geef de waarden alleen
   aan de toetskinderen door. Zo hoeft een wachtwoord nooit in de commandline,
   `docker inspect` of het overdraagbare bewijs te verschijnen. */
function containerOmgeving() {
  if (!BEWIJS_NAAR_STDOUT) return { ...process.env };
  let bestand = {};
  try {
    for (const regel of fs.readFileSync(process.env.RTG_ENV_FILE, 'utf8').split(/\r?\n/)) {
      const r = regel.trim();
      if (!r || r.startsWith('#')) continue;
      const i = r.indexOf('=');
      if (i > 0) bestand[r.slice(0, i).trim()] = r.slice(i + 1).trim();
    }
  } catch (e) {}
  const env = { ...bestand, ...process.env };
  if (!env.DATABASE_URL && env.RTG_POSTGRES_PASSWORD_FILE) {
    const wachtwoord = fs.readFileSync(env.RTG_POSTGRES_PASSWORD_FILE, 'utf8').replace(/[\r\n]+$/, '');
    if (wachtwoord.length < 16) throw new Error('PostgreSQL-secret is leeg of te kort.');
    env.DATABASE_URL = 'postgresql://rtg:' + encodeURIComponent(wachtwoord) + '@postgres:5432/rtg';
  }
  return env;
}

let KIND_ENV;
try { KIND_ENV = containerOmgeving(); }
catch (e) { console.error('[pgtoetsen] containerconfiguratie ongeldig: ' + e.message); process.exit(1); }
const BRON = KIND_ENV.DATABASE_URL || KIND_ENV.PG_URL || '';  // niet URL: dat is de globale constructor
if (!BRON) {
  if (MAG_OVERSLAAN) {
    console.log('\n  ' + K.grijs + 'Geen DATABASE_URL, en --mag-overslaan staat aan: ' + TOETSEN.length +
      ' bestanden zijn NIET gedraaid.' + K.reset + '\n');
    process.exit(0);
  }
  console.error('\n  ' + K.rood + 'GEEN DATABASE_URL: ' + TOETSEN.length + ' toetsbestanden zijn niet gedraaid.' + K.reset +
    '\n\n  ' + K.grijs + 'Dat is geen geslaagde run maar een overgeslagen run. Deze bestanden dekken de\n' +
    '  gedeelde opslag, de idempotentie van geld over een herstart heen en het\n' +
    '  transactie-grootboek; zonder database is daar niets van beproefd.\n\n' +
    '  Zet DATABASE_URL, of geef --mag-overslaan mee als je bewust zonder wilt draaien.' + K.reset + '\n');
  process.exit(1);
}

/* De beheer-URL: dezelfde server, maar op de standaarddatabase. CREATE DATABASE
   kan niet vanuit de database die je aan het maken bent, en ook niet vanuit een
   verbinding met de database die je zo weggooit. */
function metDb(url, naam) {
  const u = new URL(url);
  u.pathname = '/' + naam;
  return u.toString();
}
const basis = new URL(BRON);
const beheerUrl = metDb(BRON, 'postgres');
const voorvoegsel = (basis.pathname.replace(/^\//, '') || 'rtg') + '_t';

const { Pool } = require(path.join(WORTEL, 'server', 'pgwire'));

async function beheer(sql) {
  const pool = new Pool({ connectionString: beheerUrl, max: 1 });
  try { await pool.query(sql); }
  finally { try { await pool.end(); } catch (e) {} }
}

(async () => {
  console.log('\n\x1b[1mPOSTGRES-TOETSEN\x1b[0m ' + K.grijs + TOETSEN.length + ' bestanden, elk in een eigen database' + K.reset + '\n');
  const uitslag = [];
  for (const bestand of TOETSEN) {
    const naam = voorvoegsel + '_' + path.basename(bestand).replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 24);
    let gemaakt = false;
    try {
      await beheer('DROP DATABASE IF EXISTS ' + naam);
      await beheer('CREATE DATABASE ' + naam);
      gemaakt = true;
    } catch (e) {
      console.log('  ' + K.rood + 'FOUT' + K.reset + '  ' + bestand + K.grijs + '  (database aanmaken mislukte: ' + e.message.slice(0, 80) + ')' + K.reset);
      uitslag.push({ bestand, code: 1 });
      continue;
    }
    const t0 = Date.now();
    /* MET EEN VASTE VERSLAGGEVER. Zonder deze twee vlaggen kiest Node zelf, en
       dat verschilt per versie en per soort uitvoer: de ene drukt "# pass 4"
       (tap), de andere "i pass 4" (spec). De teller hieronder kende alleen de
       eerste vorm, dus een bestand dat gewoon SLAAGDE werd geteld als nul
       toetsen en heette LEEG -- en tien lege bestanden lieten de hele stap
       zakken terwijl er niets stuk was. De teller verstaat nu allebei de
       vormen, en de vlag zorgt dat er niet nog een derde bij komt. */
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap',
      '--test-reporter-destination=stdout', bestand], {
      cwd: WORTEL, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...KIND_ENV, DATABASE_URL: metDb(BRON, naam), PG_URL: '' }
    });
    const uit = String(r.stdout || '') + String(r.stderr || '');
    const geslaagd = r.status === 0;
    const lees = (naam) => Number((uit.match(new RegExp('^[#\u2139] ' + naam + ' (\\d+)', 'm')) || [])[1] || 0);
    const tests = lees('tests');
    const tel = lees('pass');
    const mislukt = lees('fail');
    const geannuleerd = lees('cancelled');
    const over = lees('skipped');
    const todo = lees('todo');
    const tapVolledig = ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']
      .every(veld => new RegExp('^[#\u2139] ' + veld + ' (\\d+)', 'm').test(uit));
    /* OVERGESLAGEN IS GEEN GESLAAGD. Een bestand dat nul toetsen draait en toch
       exitcode 0 geeft, leest als dekking en is het niet -- precies de vorm
       waar deze runner tegen bedoeld is. Twee bestanden hebben naast Postgres
       ook een REDIS_URL nodig; zonder die slaan ze zichzelf netjes over, en dan
       hoort dat er ook te STAAN. */
    const onvolledig = !tapVolledig || tests === 0 || over > 0 || todo > 0 || geannuleerd > 0;
    const merk = !geslaagd || onvolledig ? K.rood + 'ZAKT' : K.groen + 'GOED';
    console.log('  ' + merk + K.reset + '  ' + bestand.padEnd(38)
      + K.grijs + tel + ' geslaagd' + (over ? ', ' + over + ' overgeslagen' : '') +
      (todo ? ', ' + todo + ' todo' : '')
      + ', ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s' + K.reset);
    /* WAAROM, EN NIET ALLEEN DAT. Deze regel zocht naar "not ok" of "error:" en
       zweeg als het kind daar niets van drukte -- en dat is precies wat er
       gebeurt bij een val VOOR de eerste toets: dan is er geen enkele toetsregel
       en staat er in CI tien keer "0 geslaagd" zonder een woord uitleg. Op 27
       augustus 2026 stond de hele pg-stap zo rood en moest de reden lokaal
       worden nagespeeld. Nu komt bij elk bestand dat zakt OF nul toetsen draait
       de afloop mee, plus de laatste betekenisvolle regels van zijn uitvoer. */
    if (!geslaagd || onvolledig) {
      /* DE GEZAKTE TOETS MET ZIJN BLOK, en pas daarna de staart.

         Twee keer bijgesteld, en allebei de keren stond er iets anders dan de
         reden. Eerst waren het de laatste acht regels, en dat bleek precies de
         samenvatting ("# fail 2"): wel dat er twee vielen, niet welke. Daarna
         de regels die op "not ok" of op "error:" leken -- maar in tap staat de
         reden in een INGESPRONGEN blok onder de not-ok-regel, en dat blok viel
         door dat filter heen; er bleef "error: |-" over met niets erachter.
         Nu wordt vanaf elke not-ok-regel het hele blok meegenomen tot het
         afsluitende "...", en dat is waar de melding zelf staat. */
      const alles = uit.split('\n').map(l => l.trimEnd());
      const gevallen = [];
      for (let i = 0; i < alles.length; i++) {
        if (!/^\s*not ok /.test(alles[i])) continue;
        gevallen.push(alles[i].trim());
        for (let j = i + 1; j < alles.length && j < i + 20; j++) {
          if (/^\s*(not ok |ok |# )/.test(alles[j])) break;
          if (/^\s*\.\.\.\s*$/.test(alles[j])) break;
          if (alles[j].trim() && !/^\s*(---|\*)/.test(alles[j])) gevallen.push('  ' + alles[j].trim());
        }
      }
      const gezien = gevallen.length ? gevallen : alles
        .filter(l => l.trim() && !/^(ok |# Subtest|# {2}|TAP version)/.test(l.trim()));
      console.log('        ' + K.grijs + 'afloop=' + r.status + ' signaal=' + r.signal + K.reset);
      for (const regel of gezien.slice(0, 24)) console.log('        ' + K.rood + regel.slice(0, 160) + K.reset);
      if (!gezien.length) console.log('        ' + K.grijs + '(het kind drukte niets af)' + K.reset);
    }
    uitslag.push({ bestand, code: r.status, tapVolledig, tests, geslaagd:tel,
      mislukt, geannuleerd, over, todo });
    if (gemaakt) { try { await beheer('DROP DATABASE IF EXISTS ' + naam); } catch (e) {} }
  }

  const stuk = uitslag.filter(x => x.code !== 0);
  const leeg = uitslag.filter(x => x.code === 0 && (!x.tapVolledig || !x.tests));
  const stil = uitslag.filter(x => x.code === 0 && (x.over || x.todo || x.geannuleerd));
  console.log('\n  ' + (stuk.length
    ? K.rood + stuk.length + ' van de ' + uitslag.length + ' zakt' + K.reset
    : K.groen + 'alle ' + uitslag.length + ' bestanden geslaagd' + K.reset));
  if (leeg.length) console.log('  ' + (MAG_OVERSLAAN ? K.geel : K.rood) + leeg.length + ' bestand(en) draaiden GEEN enkele toets' + K.reset
    + K.grijs + ' -- ' + leeg.map(x => path.basename(x.bestand)).join(', ')
    + (KIND_ENV.REDIS_URL
      ? '\n  (REDIS_URL staat gezet, dus overslaan verklaart dit NIET -- de reden staat per bestand hierboven)'
      : '\n  (die vragen naast Postgres ook een REDIS_URL; zonder die slaan ze zichzelf over)') + K.reset);
  if (stil.length) console.log('  ' + K.rood + stil.length +
    ' bestand(en) bevatten skips, todo of annuleringen; dat is geen volledig PostgreSQL/Redis-bewijs.' + K.reset);
  if (leeg.length && !MAG_OVERSLAAN) console.log('  ' + K.grijs +
    'Zet REDIS_URL, of geef --mag-overslaan mee als je bewust zonder wilt draaien.' + K.reset);
  console.log('');
  // Een bestand dat nul toetsen draaide telt als niet-gedraaid, niet als geslaagd.
  const fout = stuk.length || leeg.length || stil.length;
  if (!fout) {
    const bron = BEWIJS_NAAR_STDOUT
      ? require('./lib/runtime-release-stempel').lees(WORTEL)
      : require('./lib/stempel').exactStempel();
    const bewijs = { formaat: 'rtg-pg-bewijs-v1', afgerond: new Date().toISOString(), bron, geslaagd: true,
      bestanden: uitslag.length, tests:uitslag.reduce((n, x) => n + x.tests, 0),
      geslaagdeTests:uitslag.reduce((n, x) => n + x.geslaagd, 0),
      tapVolledig:uitslag.every(x => x.tapVolledig),
      mislukt:uitslag.reduce((n, x) => n + x.mislukt, 0),
      geannuleerd:uitslag.reduce((n, x) => n + x.geannuleerd, 0),
      overgeslagen: uitslag.reduce((n, x) => n + x.over, 0),
      todo:uitslag.reduce((n, x) => n + x.todo, 0), toetslijstSha256,
      controles: uitslag.map(x => ({ bestand:x.bestand, tests:x.tests,
        geslaagd:x.geslaagd, mislukt:x.mislukt, geannuleerd:x.geannuleerd,
        overgeslagen:x.over, todo:x.todo })) };
    if (BEWIJS_NAAR_STDOUT) console.log('RTG_PG_BEWIJS_JSON=' + JSON.stringify(bewijs));
    else {
      fs.mkdirSync(path.dirname(RAPPORT), { recursive: true, mode: 0o700 });
      const tijdelijk = RAPPORT + '.tmp-' + process.pid;
      fs.writeFileSync(tijdelijk, JSON.stringify(bewijs, null, 2) + '\n', { mode: 0o600 });
      fs.renameSync(tijdelijk, RAPPORT);
    }
  }
  process.exit(fout ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
