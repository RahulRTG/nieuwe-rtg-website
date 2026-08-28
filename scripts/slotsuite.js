/* ============================================================================
   DE SLOTSUITE -- de laatste die spreekt.

   De Beproeving legt het systeem op de pijnbank: volume, geld, misbruik,
   duurzaamheid, elke route in elke rol met rommel erin. De Keuring kijkt naar
   het geheel: klopt het, is het consistent, kan het beter. De testsuite
   bewijst per onderdeel. De Slotsuite doet ze alle drie achter elkaar, in de
   volgorde waarin ze elkaar het meest opleveren, en velt er één oordeel over.

   En dan het stuk dat een gewone testrun niet heeft: de Slotsuite ONTHOUDT.
   Elke ronde legt zij haar bevindingen naast die van de vorige ronde en ziet
   wat er is opgelost, wat er nieuw bij is gekomen, en -- het belangrijkste --
   wat er blijft staan. Een punt dat rondes overleeft klimt vanzelf naar boven
   in de backlog. Zo hoeft niemand te onthouden wat er nog moet: het systeem
   blijft zichzelf de volgende stap voorstellen.

   DE LAGEN (in deze volgorde, en dat is met opzet):
     1  BOUW         eerst de bundels en hashes vers, zodat alles daarna het
                     echte bouwsel toetst en niet dat van gisteren. Stonden ze
                     niet vers, dan zegt de suite dat -- stil repareren zou de
                     huisregel "bewerk de delen, niet de bundel" uithollen.
     2  POORTEN      goedkoop en hard: syntaxis, huisregels, AST, geheimen.
                     Zakt hier iets, dan is de rest tijdverspilling.
     3  TESTS        de volledige testsuite: elk onderdeel doet wat het belooft.
     4  TOEGANKELIJK de a11y-scan over alle schermen.
     5  BEPROEVING   de storm: mega volume, geld op de cent, morele grenzen,
                     herstart, elke route in elke rol, geheugenlek-vloer.
     6  KEURING      het logica-oordeel over het geheel.
     7  RAPPORT      RAPPORT-SLOTSUITE.md: uitslag, wat is opgelost sinds de
                     vorige ronde, wat is nieuw, en de backlog op volgorde.

   DRAAIEN:
     node scripts/slotsuite.js            de hele suite (duurt lang; dat hoort)
     node scripts/slotsuite.js --snel     zonder de Beproeving (laag 5)
     node scripts/slotsuite.js --alleen=poorten,keuring
   Exitcode 0 = alles staat. 1 = er is iets gezakt of STUK. 2 = zij zelf viel om. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const RAPPORT = path.join(WORTEL, 'RAPPORT-SLOTSUITE.md');
const argv = process.argv.slice(2);
const SNEL = argv.includes('--snel');
const alleenArg = (argv.find(a => a.startsWith('--alleen=')) || '').slice(9);
const ALLEEN = alleenArg ? alleenArg.split(',').map(s => s.trim()).filter(Boolean) : null;

const K = { dim: '\x1b[2m', groen: '\x1b[32m', rood: '\x1b[31m', geel: '\x1b[33m', vet: '\x1b[1m', uit: '\x1b[0m' };
const kop = t => console.log('\n' + K.vet + t + K.uit + '\n' + K.dim + '-'.repeat(t.length) + K.uit);
const duur = ms => (ms < 1000 ? ms + ' ms' : ms < 60000 ? (ms / 1000).toFixed(1) + ' s' : Math.floor(ms / 60000) + 'm ' + Math.round(ms % 60000 / 1000) + 's');

/* ---------- de lagen ---------- */
const NODE = process.execPath;
const LAGEN = [
  { id: 'bouw', naam: 'DE BOUW', hard: true, bouw: true },
  { id: 'poorten', naam: 'DE POORTEN', hard: true, stappen: [
    ['huisregels', [NODE, ['scripts/check.js']]],
    ['AST-scan', [NODE, ['scripts/ast-scan.js']]],
    ['geheimen', [NODE, ['scripts/geheimen.js']]],
    /* DE SAMENHANG hoort bij de poorten en niet bij de keuring, want hij is
       goedkoop en hij stelt een andere vraag dan alle stappen hieronder: niet
       "zakt er iets" maar "kijkt er iemand". Een soort ding zonder handhaver is
       precies het gat dat de rest van deze suite per definitie niet ziet -- zij
       draait immers alleen de handhavers die er WEL zijn. */
    ['samenhang', [NODE, ['scripts/samenhang.js']]]
  ] },
  { id: 'tests', naam: 'DE TESTSUITE', hard: true, stappen: [
    /* De gedeelde runner begrenst serverconcurrentie en draait de twee
       bronmuterende ijkingen apart. Anders kan de Slotsuite precies door haar
       eigen meetproeven nondeterministisch rood worden. */
    ['test/*.test.js', [NODE, ['scripts/test-runner.js', '--reporter=dot']]]
  ] },
  /* A11Y_STRICT=1, en dat is hier geen detail. scripts/a11y.js slaat zichzelf
     over met exitcode 0 als er geen browser staat -- terecht, want op een kale
     CI wil je daar niet op stuklopen. Maar DIT is de slotsuite: de laatste poort
     voor go-live, waar deze laag als `hard` staat aangemerkt. Een harde laag die
     zonder browser stilletjes "staat" meldt, is een laag die niet kan zakken, en
     dan zegt een groene slotsuite iets wat niet gemeten is. Ontbreekt de
     browser hier, dan hoort dat een gezakte poort te zijn en geen voetnoot.
     (LAT.md regel 3: een meter zakt als zijn invoer ontbreekt.) */
  { id: 'a11y', naam: 'DE TOEGANKELIJKHEID', hard: true, stappen: [
    ['a11y-scan', [NODE, ['scripts/a11y.js'], { A11Y_STRICT: '1' }]]
  ] },
  { id: 'beproeving', naam: 'DE BEPROEVING', hard: true, overslaanBijSnel: true, stappen: [
    ['de storm', [NODE, ['scripts/beproeving.js']]]
  ] },
  { id: 'keuring', naam: 'DE KEURING', hard: false, intern: true }
];

function draai(cmd, args, extraEnv) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd: WORTEL, encoding: 'utf8', timeout: 90 * 60 * 1000, maxBuffer: 256 * 1024 * 1024,
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env });
  const uit = String(r.stdout || '') + String(r.stderr || '');
  return { ok: r.status === 0, code: r.status, uit, ms: Date.now() - t0 };
}

/* Een vingerafdruk over alles wat de bouw schrijft: de samengeplakte bundels,
   het geminificeerde bouwsel en de service-workers. Verandert die door een
   verse bouw, dan liep het bouwsel achter op de bron -- goed om te weten, want
   de lagen erna zouden dan iets anders hebben getoetst dan de code. */
function bouwselAfdruk() {
  const crypto = require('crypto');
  const h = crypto.createHash('sha256');
  const pak = dir => {
    let items = [];
    try { items = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)); } catch (e) { return; }
    for (const it of items) {
      const p = path.join(dir, it.name);
      if (it.isDirectory()) { if (dir.includes('dist')) pak(p); continue; }
      if (!/\.(js|css|webmanifest)$/.test(it.name)) continue;
      h.update(p.replace(WORTEL, ''));
      try { h.update(fs.readFileSync(p)); } catch (e) {}
    }
  };
  pak(path.join(WORTEL, 'public', 'dist'));
  pak(path.join(WORTEL, 'public', 'apps'));
  for (const sw of ['public/sw.js', 'public/apps/foundation/sw.js'])
    try { h.update(fs.readFileSync(path.join(WORTEL, sw))); } catch (e) {}
  return h.digest('hex');
}

/* De laatste betekenisvolle regels van een gezakte stap: genoeg om te weten
   waar het misging, niet zoveel dat het rapport onleesbaar wordt. */
function staart(tekst, n) {
  return String(tekst).split('\n').map(s => s.replace(/\x1b\[[0-9;]*m/g, '').trimEnd())
    .filter(s => s.trim()).slice(-(n || 12)).join('\n');
}

/* ---------- het geheugen: de vorige ronde uit het rapport terugleren ---------- */
function vorigeRonde() {
  try {
    const t = fs.readFileSync(RAPPORT, 'utf8');
    const m = t.match(/```json\s*([\s\S]*?)```\s*$/);
    return m ? JSON.parse(m[1]) : null;
  } catch (e) { return null; }
}

/* Een bevinding krijgt een sleutel die niet meebeweegt met de bewoording,
   zodat "hetzelfde punt, andere zin" toch als hetzelfde punt telt. */
const sleutelVan = b => [b.groep, b.waar || '-', String(b.tekst).slice(0, 60)].join('|');

const GEWICHT = { stuk: 1000, scheef: 100, beter: 10 };
const GROEPGEWICHT = { privacy: 500, beloftes: 400, dekking: 60, pariteit: 40, 'dode code': 30, dubbeling: 10, i18n: 15, omvang: 20 };

function backlog(bevindingen, vorig) {
  const oud = new Map(((vorig && vorig.backlog) || []).map(b => [b.sleutel, b]));
  const nu = bevindingen.map(b => {
    const sleutel = sleutelVan(b);
    const eerder = oud.get(sleutel);
    const rondes = (eerder ? eerder.rondes : 0) + 1;
    // wie blijft staan, klimt: elke overleefde ronde weegt een kwart extra
    const punten = Math.round((GEWICHT[b.soort] || 10) * (1 + 0.25 * (rondes - 1)) + (GROEPGEWICHT[b.groep] || 0));
    return { sleutel, soort: b.soort, groep: b.groep, tekst: b.tekst, waar: b.waar, hoe: b.hoe, rondes, punten };
  });
  nu.sort((a, b) => b.punten - a.punten || a.groep.localeCompare(b.groep));
  const nuSleutels = new Set(nu.map(b => b.sleutel));
  const opgelost = [...oud.values()].filter(b => !nuSleutels.has(b.sleutel));
  const nieuw = nu.filter(b => b.rondes === 1);
  return { backlog: nu, opgelost, nieuw };
}

/* ---------- rapport ---------- */
function schrijfRapport(uitslagen, keuring, gg, gezakt) {
  const nu = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const r = [];
  r.push('# Rapport van de Slotsuite');
  r.push('');
  r.push('_Automatisch geschreven door `scripts/slotsuite.js` op ' + nu + ' UTC. Niet met de hand bijwerken:');
  r.push('de volgende ronde overschrijft dit bestand en leest het JSON-blok onderaan terug als geheugen._');
  r.push('');
  r.push('## Oordeel');
  r.push('');
  r.push(gezakt ? '**GEZAKT** -- ' + gezakt + ' laag(en) staan niet.' : '**ALLES STAAT** -- elke laag is doorlopen zonder breuk.');
  r.push('');
  r.push('| Laag | Uitslag | Tijd | Toelichting |');
  r.push('|---|---|---|---|');
  for (const u of uitslagen)
    r.push('| ' + u.naam + ' | ' + (u.overgeslagen ? 'overgeslagen' : u.ok ? 'staat' : 'GEZAKT') + ' | ' +
      (u.ms ? duur(u.ms) : '-') + ' | ' + (u.toelichting || '') + ' |');
  r.push('');

  if (keuring) {
    r.push('## Het logica-oordeel');
    r.push('');
    r.push('- endpoints die in een test voorkomen: **' + (keuring.cijfers.dekking.gedekt || 0) + ' van ' +
      (keuring.cijfers.dekking.routes || 0) + '** (' + (keuring.cijfers.dekking.pct || 0) + '%)');
    r.push('- genres op pariteit bekeken: **' + (keuring.cijfers.pariteit.genres || 0) + '**');
    r.push('- teksten gescand op beloftes: **' + (keuring.cijfers.beloftes.gescand || 0) + '** bestanden, ' +
      (keuring.cijfers.beloftes.gewogen || 0) + ' zin(nen) eerder gewogen en goedgekeurd');
    r.push('- oordeel: **' + keuring.stuk + ' stuk, ' + keuring.scheef + ' scheef, ' + keuring.beter + ' kan beter**');
    r.push('');
  }

  r.push('## Sinds de vorige ronde');
  r.push('');
  if (gg.overgenomen) r.push('De Keuring draaide deze ronde niet, dus de backlog hieronder is die van de vorige ronde, ongewijzigd overgenomen.');
  else if (!gg.vorigBestond) r.push('Dit is de eerste ronde; er is nog niets om mee te vergelijken.');
  else {
    r.push('- opgelost: **' + gg.opgelost.length + '**');
    r.push('- nieuw: **' + gg.nieuw.length + '**');
    r.push('- blijft staan: **' + (gg.backlog.length - gg.nieuw.length) + '**');
    if (gg.opgelost.length) {
      r.push('');
      r.push('Weg sinds de vorige ronde:');
      for (const b of gg.opgelost.slice(0, 15)) r.push('- ' + b.tekst + (b.waar ? ' `' + b.waar + '`' : ''));
    }
  }
  r.push('');

  r.push('## De backlog -- wat de volgende ronde verdient');
  r.push('');
  r.push('Op volgorde van gewicht. Een punt dat rondes overleeft klimt vanzelf; dat is met opzet,');
  r.push('want wat blijft liggen wordt niet minder waar.');
  r.push('');
  const top = gg.backlog.slice(0, 40);
  for (let i = 0; i < top.length; i++) {
    const b = top[i];
    r.push((i + 1) + '. **[' + b.soort.toUpperCase() + ' / ' + b.groep + ']** ' + b.tekst +
      (b.rondes > 1 ? ' _(' + b.rondes + 'e ronde open)_' : ''));
    if (b.waar) r.push('   - waar: `' + b.waar + '`');
    if (b.hoe) r.push('   - aanpak: ' + b.hoe);
  }
  if (gg.backlog.length > top.length) r.push('');
  if (gg.backlog.length > top.length) r.push('_(nog ' + (gg.backlog.length - top.length) + ' punten van lagere prioriteit; zie het JSON-blok.)_');
  r.push('');

  r.push('## Wat deze suite niet bewijst');
  r.push('');
  for (const l of [
    'Eén machine, één node; geen echte productie-opslag en geen echt netwerk tussen de lagen.',
    'De Keuring leest de code, niet de bedoeling: zij vermoedt, en een mens weegt.',
    'De dekkingscijfers tellen of een endpoint in een test VOORKOMT, niet of hij goed getoetst is.',
    SNEL ? 'De Beproeving is deze ronde overgeslagen (--snel); volume, geld en misbruik zijn dus niet getoetst.' :
      'De Beproeving draaide in sqlite-modus tenzij DATABASE_URL was gezet; de 100M-schaal vraagt Postgres.'
  ]) r.push('- ' + l);
  r.push('');

  r.push('<!-- geheugen van de Slotsuite; hier leest de volgende ronde uit terug -->');
  r.push('```json');
  r.push(JSON.stringify({ ronde: nu, gezakt, backlog: gg.backlog }, null, 1));
  r.push('```');
  fs.writeFileSync(RAPPORT, r.join('\n') + '\n');
}

/* ---------- de suite ----------
   Alleen draaien als hij zelf wordt aangeroepen. Zonder dit slot start een
   require('./slotsuite') de hele suite, en dat is een valstrik die ik zelf al
   in ben gelopen. */
function suite() {
  const t0 = Date.now();
  console.log('\n' + K.vet + 'DE SLOTSUITE' + K.uit + K.dim + ' -- de laatste die spreekt' + K.uit);
  if (SNEL) console.log(K.geel + '  (snelle modus: de Beproeving wordt overgeslagen)' + K.uit);

  const uitslagen = [];
  let keuring = null, gezakt = 0;

  for (const laag of LAGEN) {
    if (ALLEEN && !ALLEEN.includes(laag.id)) { uitslagen.push({ naam: laag.naam, overgeslagen: true, ok: true, toelichting: 'niet gevraagd' }); continue; }
    if (SNEL && laag.overslaanBijSnel) { uitslagen.push({ naam: laag.naam, overgeslagen: true, ok: true, toelichting: 'overgeslagen (--snel)' }); continue; }
    kop(laag.naam);

    if (laag.bouw) {
      const voor = bouwselAfdruk();
      process.stdout.write('  ' + 'bundels + hashes'.padEnd(22));
      const r = draai(NODE, ['scripts/build.js']);
      const vers = bouwselAfdruk() === voor;
      console.log((r.ok ? K.groen + 'staat' : K.rood + 'GEZAKT (exit ' + r.code + ')') + K.uit + K.dim + '  ' + duur(r.ms) + K.uit);
      if (!r.ok) { gezakt++; console.log(K.dim + staart(r.uit, 12).split('\n').map(s => '    ' + s).join('\n') + K.uit); }
      else if (!vers) console.log('  ' + K.geel + 'let op' + K.uit + '  het bouwsel liep achter op de bron en is nu bijgewerkt; commit het mee.');
      uitslagen.push({ naam: laag.naam, ok: r.ok, ms: r.ms,
        toelichting: !r.ok ? 'de bouw zelf zakte' : vers ? 'het bouwsel stond al vers' : 'het bouwsel liep achter en is bijgewerkt' });
      continue;
    }

    if (laag.intern) {
      const t1 = Date.now();
      try {
        delete require.cache[require.resolve('./keuring.js')];
        keuring = require('./keuring.js').keur();
        const ok = keuring.stuk === 0;
        if (!ok) gezakt++;
        console.log('  ' + (ok ? K.groen + 'staat' : K.rood + 'GEZAKT') + K.uit + '  ' +
          keuring.stuk + ' stuk, ' + keuring.scheef + ' scheef, ' + keuring.beter + ' kan beter');
        uitslagen.push({ naam: laag.naam, ok, ms: Date.now() - t1,
          toelichting: keuring.stuk + ' stuk, ' + keuring.scheef + ' scheef, ' + keuring.beter + ' kan beter' });
      } catch (e) {
        gezakt++;
        console.log('  ' + K.rood + 'GEZAKT' + K.uit + '  de Keuring zelf viel om: ' + (e && e.message));
        uitslagen.push({ naam: laag.naam, ok: false, ms: Date.now() - t1, toelichting: 'de Keuring zelf viel om' });
      }
      continue;
    }

    let laagOk = true, laagMs = 0;
    const toel = [];
    for (const [naam, [cmd, args, env]] of laag.stappen) {
      process.stdout.write('  ' + naam.padEnd(22));
      const r = draai(cmd, args, env);
      laagMs += r.ms;
      console.log((r.ok ? K.groen + 'staat' : K.rood + 'GEZAKT (exit ' + r.code + ')') + K.uit + K.dim + '  ' + duur(r.ms) + K.uit);
      if (!r.ok) {
        laagOk = false;
        toel.push(naam + ' gezakt');
        console.log(K.dim + staart(r.uit, 14).split('\n').map(s => '    ' + s).join('\n') + K.uit);
      }
    }
    if (!laagOk && laag.hard) gezakt++;
    uitslagen.push({ naam: laag.naam, ok: laagOk, ms: laagMs, toelichting: toel.join(', ') || 'alle stappen staan' });
  }

  const vorig = vorigeRonde();
  /* Zonder Keuring is er niets nieuws te wegen. De backlog van de vorige ronde
     blijft dan staan zoals hij was: hem leegmaken zou "alles opgelost" liegen. */
  const gg = keuring ? backlog(keuring.bevindingen, vorig)
    : { backlog: (vorig && vorig.backlog) || [], opgelost: [], nieuw: [], overgenomen: true };
  gg.vorigBestond = !!vorig;
  schrijfRapport(uitslagen, keuring, gg, gezakt);

  kop('SLOTOORDEEL');
  console.log('  doorlooptijd  : ' + duur(Date.now() - t0));
  console.log('  backlog       : ' + gg.backlog.length + ' punten' +
    (gg.vorigBestond ? ' (' + gg.nieuw.length + ' nieuw, ' + gg.opgelost.length + ' opgelost)' : ' (eerste ronde)'));
  console.log('  rapport       : RAPPORT-SLOTSUITE.md');
  console.log('  OORDEEL       : ' + (gezakt === 0 ? K.groen + 'ALLES STAAT' : K.rood + gezakt + ' LAAG/LAGEN GEZAKT') + K.uit);
  if (gg.backlog.length) {
    console.log('\n  ' + K.vet + 'De volgende ronde verdient:' + K.uit);
    for (const b of gg.backlog.slice(0, 5))
      console.log('    - [' + b.soort + '] ' + b.tekst.slice(0, 96) + (b.rondes > 1 ? K.geel + ' (' + b.rondes + 'e ronde open)' + K.uit : ''));
  }
  console.log('');
  process.exit(gezakt === 0 ? 0 : 1);
}

if (require.main === module) suite();
module.exports = { suite };
