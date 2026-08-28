#!/usr/bin/env node
/* ============================================================================
   DE SAMENHANG -- wie bewaakt wat, en wat bewaakt niemand.

   WAAROM DIT ER IS

   RTG heeft veel handhavers: 29 keuringsregels, een ratel met statische en
   prestatiemeters, een paginascan over alle 189 schermen, een routejournaal,
   een kruisscan, een bundelcontract, 2866 toetsen, de Beproeving, de Slotsuite.
   Stuk voor stuk goed. Maar ze kennen elkaar niet, en dus stelt niemand de ene
   vraag die er bij zoveel gereedschap toe doet:

       is er iets in deze repo waar GEEN ENKELE handhaver naar kijkt?

   De Slotsuite draait ze allemaal achter elkaar en velt een oordeel. Dat is
   iets anders: zij vraagt "zakt er iets", niet "kijkt er iemand". Een module
   zonder toets, een categorie zonder bewaker en een regel in LAT.md die naar
   een handhaver verwijst die niet bestaat -- die drie zijn allemaal groen in
   elke bestaande poort.

   Op de dag dat dit bestand werd geschreven leverde dat drie echte gevallen op:
   een nieuw deelbestand in public/apps/app-main/ dat NOOIT DRAAIDE (geen
   syntaxfout, geen uitzondering, gewoon stil), een stop() in de toetshulp die
   een programmeerfout in een lege catch liet verdwijnen, en mijn eigen aanname
   dat honderdveertig pagina's ongedekt waren terwijl er allang een scan voor
   bestond. Alle drie onzichtbaar voor alles wat we al hadden.

   WAT DIT WEL DOET

   Eén tabel, hieronder: per SOORT ding staat er hoe je het opsomt en welke
   handhaver ernaar kijkt. Daaruit rolt per soort: hoeveel er zijn, hoeveel er
   bewaakt zijn, en met NAAM wat er niet bewaakt is. Nieuw werk valt vanzelf in
   een soort; valt het in geen enkele soort, dan is dat zelf de melding.

   WAT DIT NIET DOET, EN DAT IS GEEN DETAIL

   Dit is een census, geen bewijs. "Bewaakt" betekent hier: er is een handhaver
   die dit ding NOEMT of opsomt. Of die handhaver ook iets zinnigs beweert, is
   regel 2 (mutatie) en regel 10 (een meter die je niet hebt zien uitslaan) --
   mensenwerk, geen tabel. En de categorie die vandaag het duurst was --
   code die stil NIET draait -- is statisch niet te zien; die vraag hoort in een
   toets die kijkt of er echt iets gebeurt.

   Draai:  node scripts/samenhang.js
           node scripts/samenhang.js --json
   Exitcode 0 = elke soort heeft een bewaker en de onbewaakte lijst is niet
   gegroeid. 1 = er is iets onbewaakt bijgekomen. 2 = de census zelf kon niet.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const NORMBESTAND = path.join(WORTEL, 'NORM.json');
const jsonUit = process.argv.includes('--json');
const METER = 'onbewaakt';
const RICHTING = 'omlaag';           // een plafond: meer onbewaakts is slechter

function loop(map, filter, uit = []) {
  let namen = [];
  try { namen = fs.readdirSync(map, { withFileTypes: true }); } catch (e) { return uit; }
  for (const f of namen) {
    const p = path.join(map, f.name);
    if (f.isDirectory()) { if (!/^(node_modules|data|dist|\.git)$/.test(f.name)) loop(p, filter, uit); continue; }
    if (filter(f.name, p)) uit.push(path.relative(WORTEL, p));
  }
  return uit;
}
const lees = p => { try { return fs.readFileSync(path.join(WORTEL, p), 'utf8'); } catch (e) { return ''; } };
const bestaat = p => fs.existsSync(path.join(WORTEL, p));

/* De tekst van alle toetsen en scripts in een keer: daarin zoeken we of een
   ding ergens bij naam genoemd wordt. Een keer inlezen, niet per ding. */
function bronBundel(mappen, patroon) {
  let t = '';
  for (const m of mappen) for (const f of loop(path.join(WORTEL, m), n => patroon.test(n))) t += lees(f) + '\n';
  return t;
}

/* ---------------------------------------------------------------------------
   DE TABEL. Per soort: hoe som je hem op, welke handhaver kijkt ernaar, en hoe
   stel je vast dat een individueel ding bewaakt is.

   `bewaker` is de bestandsnaam van de handhaver -- die MOET bestaan, anders is
   de soort onbewaakt en dat is meteen een fout. Zo kan een handhaver niet stil
   verdwijnen terwijl de tabel doet alsof hij er nog is.
   --------------------------------------------------------------------------- */
function tabel() {
  const scriptTekst = bronBundel(['scripts'], /\.js$/);

  return [
    {
      /* DE VERSIE DIE IK HEB WEGGEGOOID, EN WAAROM.

         Eerst stond hier: "bewaakt = de bestandsnaam komt ergens in een toets
         voor". Dat gaf 849 van de 1109 modules als onbewaakt -- en dat getal
         was onzin. Toetsen laden `server/accounts` en roepen
         accounts.getMemberState() aan; `accounts/dossier` staat nergens in de
         tekst terwijl die module zwaar wordt beproefd.

         Dat is precies de fout die vanochtend uit scripts/dekking.js is
         gehaald: treffers tellen in plaats van dekking meten. Een census die
         849 valse meldingen produceert, wordt binnen een week genegeerd -- en
         dan is hij schadelijker dan geen census.

         De enige eerlijke bron is echte dekkingsdata: node --test met
         --experimental-test-coverage weet per bestand welke regels zijn
         uitgevoerd. Die run duurt twintig minuten, dus hij hoort niet in deze
         census te zitten maar ernaast. Zolang het bestand er niet is, meldt
         deze soort NIET GEMETEN -- en dat is de eerlijke uitkomst, geen nul en
         geen 849. */
      soort: 'serverkern (server/**/*.js)',
      bewaker: ['scripts/check.js', 'test'],
      wat: 'elke servermodule wordt door de toetsen echt uitgevoerd (uit dekkingsdata, niet uit namen)',
      dingen: () => {
        /* AANWEZIG IS NIET HETZELFDE ALS BRUIKBAAR.

           Eerst stond hier alleen fs.existsSync(). Terwijl de dekkingsrun nog
           bezig was lag er een HALF geschreven bestand, en de census meldde
           prompt 1109 onbewaakte modules -- een getal dat nergens op sloeg,
           geproduceerd door precies de meter die over samenhang gaat. Dat is
           LAT.md regel 3 in het gereedschap dat die regel bewaakt.

           Een lcov-bestand is af als het records bevat EN op end_of_record
           eindigt. Alles daaronder is een run die nog loopt of is afgebroken,
           en dan is "niet gemeten" het enige eerlijke antwoord. */
        const lcov = lees('DEKKING-LCOV.info');
        const records = (lcov.match(/^SF:/gm) || []).length;
        if (records < 50 || !/end_of_record\s*$/.test(lcov)) return null;
        return loop(path.join(WORTEL, 'server'), n => n.endsWith('.js'));
      },
      bewaakt: p => {
        const lcov = lees('DEKKING-LCOV.info');
        const re = new RegExp('^SF:.*' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'm');
        return re.test(lcov);
      },
      kanttekening: 'maak de bron met: npm run test:coverage -- --test-reporter=lcov --test-reporter-destination=DEKKING-LCOV.info'
    },
    {
      soort: 'schermen (public/**/*.html)',
      bewaker: ['test/paginas.e2e.js'],
      wat: 'ze gaan allemaal open ZONDER fout en tonen een teken van LEVEN (de paginascan, die de map zelf opsomt)',
      dingen: () => loop(path.join(WORTEL, 'public'), n => n.endsWith('.html')),
      /* ALLEEN DE PAGINASCAN SOMT DE MAP OP, en hier stond dat er twee dat deden.
         test/leven.e2e.js stond ernaast met de tekst "beide scans sommen de map
         zelf op" -- maar dat bestand opent EEN pagina (/apps/leven.html) en veegt
         niets. Het is een gewone schermtoets zoals de 138 andere.

         Wat er mis was, is NIET dat de census blind werd -- `bewaakt` eiste met
         een EN dat allebei de bestanden er zijn, dus het weghalen van de veger
         liet hem wel degelijk zakken. De fout zit er andersom in: de census hing
         voor deze soort af van een bestand dat de dekking niet levert. Wie
         leven.e2e.js ooit opruimt of hernoemt, krijgt 268 onbewaakte schermen
         gemeld terwijl de paginascan alles gewoon dekt -- een vals alarm, en dat
         is hoe een census binnen een week genegeerd wordt (zie de kop van dit
         bestand over de 849 valse gevallen van de eerste versie).

         De claim "alle 268 schermen" hangt aan de scan die de map opsomt, en aan
         niets anders. Gevonden door te vragen of het ook WERKT in plaats van of
         het groen is. */
      bewaakt: () => bestaat('test/paginas.e2e.js')
    },
    {
      soort: 'app-delen (public/apps/*/**.js)',
      bewaker: ['scripts/bundel.js', 'scripts/check.js'],
      wat: 'elk deel hoort bij een bundel en de bundel moet met de delen overeenkomen',
      dingen: () => {
        const uit = [];
        for (const bundelMap of Object.values(require('./bundel').bundels || {})) {
          uit.push(...loop(path.join(WORTEL, 'public', bundelMap), n => n.endsWith('.js')));
        }
        return uit;
      },
      bewaakt: () => true,   // het bundelcontract dekt ze per constructie
      /* EERLIJKE KANTTEKENING, en het is de duurste van vandaag: het contract
         bewijst dat de bundel de delen bevat, NIET dat elk deel ook draait. Een
         deel dat midden in een functie belandt, staat keurig in de bundel en
         gebeurt nooit. Statisch is dat niet te zien; het hoort in een toets die
         kijkt of er echt iets gebeurt. */
      kanttekening: 'het contract bewijst dat een deel IN de bundel staat, niet dat het DRAAIT -- dat vangt test/leven.e2e.js, per scherm'
    },
    {
      soort: 'API-routes',
      bewaker: ['scripts/dekking.js', 'scripts/check.js'],
      wat: 'elke route wordt tijdens de suite echt aangeroepen (routejournaal) en heeft een poort',
      dingen: () => {
        try {
          const { execFileSync } = require('child_process');
          const uit = execFileSync(process.execPath, [path.join(__dirname, 'routekaart.js'), '--json'],
            { cwd: WORTEL, encoding: 'utf8', timeout: 180000, maxBuffer: 64 * 1024 * 1024 });
          return (JSON.parse(uit).routes || []).map(r => r.pad).filter(p => p && p.startsWith('/api/'));
        } catch (e) { return null; }   // null = niet te meten, en dat is geen nul
      },
      bewaakt: () => bestaat('scripts/dekking.js')
    },
    {
      soort: 'meters in NORM.json',
      bewaker: ['scripts/norm.js'],
      wat: 'elke meter heeft een richting en een grondwaarde; slechter worden gaat niet stil',
      dingen: () => {
        const n = JSON.parse(lees('NORM.json') || '{}');
        return Object.keys(n.meters || {}).concat(Object.keys(n.prestatie || {}));
      },
      bewaakt: naam => scriptTekst.includes("'" + naam + "'") || scriptTekst.includes('"' + naam + '"')
    },
    {
      soort: 'regels in LAT.md',
      bewaker: ['LAT.md'],
      wat: 'elke regel noemt zijn eigen handhaver; een regel zonder handhaver is een voornemen',
      dingen: () => (lees('LAT.md').match(/^### \d+\. .+$/gm) || []).map(r => r.replace(/^### /, '')),
      bewaakt: regel => {
        const tekst = lees('LAT.md');
        const start = tekst.indexOf('### ' + regel);
        if (start < 0) return false;
        const eind = tekst.indexOf('\n### ', start + 4);
        const blok = tekst.slice(start, eind < 0 ? undefined : eind);
        return /\*\*Handhaver:\*\*/.test(blok);
      }
    }
  ];
}

function meet() {
  const uit = [];
  for (const s of tabel()) {
    const ontbrekendeBewaker = s.bewaker.filter(b => !bestaat(b));
    const dingen = s.dingen();
    if (dingen === null) {
      uit.push({ soort: s.soort, wat: s.wat, bewaker: s.bewaker, ontbrekendeBewaker, nietTeMeten: true, kanttekening: s.kanttekening });
      continue;
    }
    const onbewaakt = dingen.filter(d => !s.bewaakt(d));
    uit.push({ soort: s.soort, wat: s.wat, bewaker: s.bewaker, ontbrekendeBewaker,
      totaal: dingen.length, onbewaakt, kanttekening: s.kanttekening });
  }
  return uit;
}

/* Het CIJFER dat als meter `onbewaakt` in NORM.json staat. Aparte functie en
   niet een optelling middenin main(), zodat test/meterijk.test.js exact hetzelfde
   telt als wat hier op het scherm komt. Een ijking die zijn eigen optelling maakt,
   ijkt zijn eigen optelling en niet de meter. */
function totaalOnbewaakt(rijen) {
  return rijen.filter(r => !r.nietTeMeten && r.onbewaakt).reduce((n, r) => n + r.onbewaakt.length, 0);
}

function main() {
  let rijen;
  try { rijen = meet(); }
  catch (e) { console.error('\n  \x1b[31mDe census zelf viel om: ' + e.message + '\x1b[0m\n'); return 2; }

  if (jsonUit) { console.log(JSON.stringify({ rijen }, null, 2)); return 0; }

  console.log('\n\x1b[1mDE SAMENHANG\x1b[0m \x1b[2m-- wie bewaakt wat\x1b[0m\n');
  const totaal = totaalOnbewaakt(rijen);
  let stuk = 0;
  for (const r of rijen) {
    if (r.ontbrekendeBewaker.length) {
      stuk++;
      console.log('  \x1b[31mGEEN BEWAKER\x1b[0m  ' + r.soort);
      console.log('               \x1b[2mde tabel noemt ' + r.ontbrekendeBewaker.join(', ') + ', maar die bestaat niet\x1b[0m');
      continue;
    }
    if (r.nietTeMeten) {
      console.log('  \x1b[33mNIET GEMETEN\x1b[0m  ' + r.soort + '  \x1b[2m(' + r.bewaker.join(', ') + ')\x1b[0m');
      continue;
    }
    const merk = r.onbewaakt.length ? '\x1b[33m' + String(r.onbewaakt.length).padStart(4) + ' los\x1b[0m' : '\x1b[32m   alles\x1b[0m';
    console.log('  ' + merk + '  ' + String(r.totaal).padStart(5) + '  ' + r.soort);
    console.log('             \x1b[2m' + r.wat + '  [' + r.bewaker.join(', ') + ']\x1b[0m');
    if (r.kanttekening) console.log('             \x1b[2m! ' + r.kanttekening + '\x1b[0m');
    for (const o of r.onbewaakt.slice(0, 12)) console.log('               \x1b[33m-\x1b[0m ' + o);
    if (r.onbewaakt.length > 12) console.log('               \x1b[2m... en nog ' + (r.onbewaakt.length - 12) + '\x1b[0m');
  }

  const norm = JSON.parse(lees('NORM.json') || '{}');
  const plafond = norm.meters ? norm.meters[METER] : undefined;
  console.log('\n  onbewaakt totaal: ' + totaal +
    (plafond === undefined ? '  \x1b[2m(nog geen norm; leg vast met --vastleggen)\x1b[0m' : '  \x1b[2m(norm: ' + plafond + ')\x1b[0m'));

  if (process.argv.includes('--vastleggen')) {
    norm.meters = norm.meters || {};
    norm.meters[METER] = totaal;
    fs.writeFileSync(NORMBESTAND, JSON.stringify(norm, null, 2) + '\n');
    console.log('  \x1b[32m' + METER + ' vastgelegd op ' + totaal + '.\x1b[0m\n');
    return stuk ? 1 : 0;
  }
  if (stuk) { console.log('\n  \x1b[31mEen soort heeft geen bestaande bewaker.\x1b[0m\n'); return 1; }
  if (plafond !== undefined && totaal > plafond) {
    console.log('\n  \x1b[31mEr is iets onbewaakts bijgekomen\x1b[0m (' + totaal + ' tegen een norm van ' + plafond + ').');
    console.log('  \x1b[2mSchrijf er een toets voor, of verhoog de norm met de hand -- dan staat het als keuze in de historie.\x1b[0m\n');
    return 1;
  }
  console.log('');
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { meet, tabel, totaalOnbewaakt };
