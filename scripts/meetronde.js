#!/usr/bin/env node
/* ============================================================================
   DE MEETRONDE -- EEN COMMANDO DAT ALLE REGISTERS BIJWERKT.

   WAAROM DIT ER IS. De bewijslaag van dit huis bestaat uit twaalf registers die
   door acht instrumenten worden gevuld, en tot nu toe draaide je die met de
   hand, in de goede volgorde, met de goede vlaggen. Dat ging vier keer goed en
   een keer mis: een laadcontrole startte de rolproef met de STANDAARDbegrenzing
   en schreef ROLPROEF.json van 3377 beproefde routes terug naar 292. Het
   register zag er daarna volkomen normaal uit.

   Een keten die alleen klopt als een mens hem in de goede volgorde aanroept, is
   geen keten maar een gewoonte. Deze staat hier.

   DE VOLGORDE IS EEN AFHANKELIJKHEID EN GEEN SMAAK:

     1  de poortwacht      tegen een VERSE wegwerpserver (eigen datamap)
     2  de vier proeven    elk tegen hun eigen wegwerpserver
     3  de ketenronde      sabotage op echte ketens
     4  de bewijsmatrix    stelt 1-3 samen; draait hij eerder, dan stelt hij oude
                           registers samen en ziet niemand dat
     5  kaart en bewijs    de afdrukken van 4 in ARCHITECTUUR.md en BEWIJS.md

   WAT HIER NIET IN ZIT, met opzet:

     de suite + dekking    die duurt een uur en heeft een routejournaal nodig;
                           hij staat in .github/workflows/ronde.yml en in
                           `npm test` + `npm run dekking:vast`. Twee keer een uur
                           in een commando stoppen dat mensen "even" draaien, is
                           een commando dat niemand draait.
     de mutatiemotor       duurt uren (zie scripts/mutatie.js) en meet de TOETSEN
                           en niet de code.
     --vastleggen          NIETS wordt hier geratelt. De ratels (norm.js,
                           bewijsmatrix.js) weigeren een verslechtering met een
                           reden, en die reden hoort een mens te lezen. Een
                           meetronde die zichzelf vastlegt, legt ook een
                           verslechtering vast.

   Draai:  node scripts/meetronde.js
           node scripts/meetronde.js --snel   (alleen 1 en 4)
           node scripts/meetronde.js --alleen=poortwacht
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const wegwerp = require('./lib/wegwerpserver');
const { nuCommit } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const SNEL = argv.includes('--snel');
const ALLEEN = (argv.find(a => a.startsWith('--alleen=')) || '').slice(9);

/* Elke stap: wat hij vult, hoe hij draait, en hoe lang hij ongeveer duurt.
   `snel` markeert de stappen die ook in de korte ronde meedoen. */
const STAPPEN = [
  { id: 'poortwacht', register: 'POORTWACHT.json', snel: true, duur: '~3 min',
    wat: 'welke routes zonder token opengaan' },
  { id: 'rolproef', register: 'ROLPROEF.json', duur: '~6 min',
    wat: 'of een verkeerde rol binnenkomt',
    cmd: ['scripts/rolproef-route.js', '--max=8000'] },
  { id: 'invoerproef', register: 'INVOERPROEF.json', duur: '~6 min',
    wat: 'of rommel netjes wordt geweigerd',
    cmd: ['scripts/invoerproef-route.js', '--max=8000'] },
  { id: 'idemproef', register: 'IDEMPROEF.json', duur: '~8 min',
    wat: 'of een herhaalde oproep niets dubbel doet',
    cmd: ['scripts/idemproef-route.js', '--max=8000'] },
  { id: 'staatproef', register: 'STAATPROEF.json', duur: '~8 min',
    wat: 'of de toestand na afloop klopt',
    cmd: ['scripts/staatproef-route.js', '--max=8000'] },
  /* DE TWEE BEWIJSPROEVEN STONDEN HIER NIET IN, en dat had twee gevolgen die
     allebei zijn opgetreden.

     Het eerste: de bewijsmatrix stelt de AUDIT-kolom samen uit deze twee. Draai
     je een meetronde zonder ze, dan zakt die kolom naar nul en vraagt de ratel
     "is de meetronde meegeleverd?" -- terecht, want dat was hij niet.

     Het tweede is duurder. Wie ze met de hand draait, vergeet de begrenzing:
     de handelingproef valt zonder --max terug op 400 routes, en schreef zo een
     register van 3081 routes terug naar 400. Dat is precies het ongeluk dat de
     kop van dit bestand beschrijft voor de rolproef -- en het gebeurde opnieuw,
     bij het bijwerken van de registers na de reparatie van de proefsleutels.

     Ze staan nu in de rij, met de vlag erbij, op de plek waar hun uitslag nog
     vóór de bewijsmatrix komt. */
  { id: 'auditproef', register: 'AUDITPROEF.json', duur: '~5 min',
    wat: 'of een geslaagde schrijfactie een regel in het API-spoor nalaat',
    cmd: ['scripts/auditproef-route.js', '--max=8000'] },
  { id: 'handelingproef', register: 'HANDELINGPROEF.json', duur: '~5 min',
    wat: 'of een geslaagde schrijfactie een geketende regel nalaat',
    cmd: ['scripts/handelingproef-route.js', '--max=8000'] },
  { id: 'ketenronde', register: 'KETENS.json', duur: '~4 min',
    wat: 'of een keten netjes faalt onder sabotage',
    cmd: ['scripts/ketenronde.js'] },
  { id: 'bewijsmatrix', register: 'BEWIJSMATRIX.json', snel: true, duur: '~1 min',
    wat: 'de elf schakels per route, uit de registers hierboven',
    cmd: ['scripts/bewijsmatrix.js'] }
];

const vingerafdruk = (naam) => {
  try { return require('crypto').createHash('sha1')
    .update(fs.readFileSync(path.join(WORTEL, naam))).digest('hex').slice(0, 12); }
  catch (e) { return null; }
};

function draai(cmd, extraEnv) {
  const r = spawnSync(process.execPath, cmd, {
    cwd: WORTEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024, timeout: 45 * 60 * 1000,
    env: Object.assign({}, process.env, extraEnv || {})
  });
  /* STDOUT EN STDERR APART, en dat is geen netheid maar noodzaak. De server
     schrijft bij elke start twee waarschuwingen naar stderr (geen encryptiesleutel,
     geen eigenaarsaccount). Plak je die aan stdout, dan vindt de JSON-lezer
     hieronder een accolade IN een waarschuwing en leest hij de uitslag als kapot;
     en de laatste regel van een geslaagde stap is dan een node-melding in plaats
     van het antwoord. Allebei is hier gebeurd. */
  return { code: r.status, uit: r.stdout || '', fout: r.stderr || '' };
}

/* DE POORTWACHT HEEFT GEEN EIGEN SERVER, en dat is jarenlang met de hand
   opgelost (een shellscript in iemands scratchpad). Hij klopt aan bij een ADRES,
   dus hier krijgt hij er een: vers, met een eigen datamap, en met een
   metrics-token gezet -- anders meldt hij de twee meetpoort-routes als open,
   wat op een lokale opstelling klopt maar geen bevinding is. Zie het blok bij
   PUBLIEK in scripts/poortwacht.js. */
async function poortwachtRonde() {
  const token = 'meetronde-' + require('crypto').randomBytes(6).toString('hex');
  const srv = await wegwerp.start({ naam: 'poortwacht', env: {
    RTG_METRICS_TOKEN: token, OFFICE_CODE: 'RTG-MEETRONDE' } });
  try {
    const r = draai(['scripts/poortwacht.js', '--json', '--per-route', srv.basis],
      { RTG_METRICS_TOKEN: token });
    /* Exit 1 betekent OPEN ROUTES en dat is een bevinding, geen storing: de
       uitslag is bruikbaar en wordt weggeschreven. Alleen een uitslag die geen
       geldige JSON is, is een mislukte stap. */
    let uitslag;
    try { uitslag = JSON.parse(r.uit.slice(r.uit.indexOf('{'))); }
    catch (e) { return { ok: false, melding: 'de poortwacht gaf geen leesbare uitslag: ' + e.message.slice(0, 80) }; }
    fs.writeFileSync(path.join(WORTEL, 'POORTWACHT.json'), JSON.stringify(uitslag, null, 1) + '\n');
    return { ok: true,
      melding: uitslag.totaal + ' routes, ' + uitslag.open.length + ' open, ' +
        uitslag.dicht + ' dicht, ' + uitslag.stil + ' stil, ' + uitslag.publiek + ' publiek' };
  } finally { srv.klaar(); }
}

(async () => {
  const start = Date.now();
  const commit = nuCommit();
  const kiezen = STAPPEN.filter(s => (ALLEEN ? s.id === ALLEEN : (SNEL ? s.snel : true)));

  console.log('\n=== DE MEETRONDE ===\n');
  console.log('  commit ' + (commit || 'onbekend') +
    (SNEL ? '   (korte ronde: alleen de poortwacht en de matrix)' : '') + '\n');
  if (!kiezen.length) { console.error('  geen stap die "' + ALLEEN + '" heet.'); process.exit(2); }

  const uitslagen = [];
  for (const s of kiezen) {
    const voor = vingerafdruk(s.register);
    process.stdout.write('  ' + s.id.padEnd(14) + s.duur.padEnd(9) + '... ');
    let r;
    try {
      r = s.id === 'poortwacht' ? await poortwachtRonde()
        : (() => { const d = draai(s.cmd); return { ok: d.code === 0 || d.code === 1, melding: laatsteRegel(d.uit) }; })();
    } catch (e) { r = { ok: false, melding: String(e.message) }; }
    const na = vingerafdruk(s.register);
    const veranderd = voor !== na;
    console.log((r.ok ? 'klaar' : 'GESTRUIKELD') + (veranderd ? '  (register bijgewerkt)' : '  (register onveranderd)'));
    if (r.melding) console.log('                 ' + r.melding);
    uitslagen.push({ id: s.id, ok: r.ok, veranderd, register: s.register });
  }

  /* De afdrukken pas NA de metingen: ARCHITECTUUR.md en BEWIJS.md zijn afdrukken
     van de registers, en een afdruk van een half bijgewerkte stapel is erger dan
     geen afdruk. */
  if (!ALLEEN) {
    process.stdout.write('  ' + 'kaart+bewijs'.padEnd(14) + '~1 min   ... ');
    const a = draai(['scripts/kaart.js']);
    const b = draai(['scripts/bewijs.js']);
    console.log(a.code === 0 && b.code === 0 ? 'klaar' : 'GESTRUIKELD');
  }

  const minuten = Math.round((Date.now() - start) / 60000);
  const stuk = uitslagen.filter(u => !u.ok);
  console.log('\n  ' + uitslagen.filter(u => u.veranderd).length + ' van de ' + uitslagen.length +
    ' registers bijgewerkt in ' + minuten + ' minuten.');
  if (stuk.length) {
    console.log('  GESTRUIKELD: ' + stuk.map(u => u.id).join(', ') +
      ' -- die registers zijn NIET bijgewerkt en dragen dus nog de oude meting.');
  }
  console.log('\n  Niets is vastgelegd. Kijk wat er veranderde en leg het dan vast:');
  console.log('    node scripts/versheid.js');
  console.log('    npm run bewijsmatrix:vast   (de ratel weigert een verslechtering; lees die reden)');
  console.log('    npm run norm\n');
  process.exit(stuk.length ? 1 : 0);
})().catch(e => { console.error('de meetronde brak af: ' + e.message); process.exit(2); });

function laatsteRegel(tekst) {
  const regels = String(tekst || '').split('\n').map(r => r.replace(/\x1b\[[0-9;]*m/g, '').trim()).filter(Boolean);
  return regels.length ? regels[regels.length - 1].slice(0, 120) : '';
}
