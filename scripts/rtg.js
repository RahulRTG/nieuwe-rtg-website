#!/usr/bin/env node
/* ============================================================================
   RTG -- het gereedschap voor wie een app voor de RTG App Store bouwt.

   WAT DIT IS EN WAT HET NIET IS. Dit is de ontbrekende schil uit
   DEVELOPERCLOUD.md par. 1: auth, geld, rechten, bewijs, meting en de sandbox
   staan al, maar een ontwikkelaar ziet nul van die bestanden. Dit gereedschap is
   het enige wat hij wel ziet.

   Het zendt met opzet NIETS in. `rtg check` en `rtg dev` vragen geen inlog en
   raken de server niet -- ze draaien de echte poort en de echte brug op je eigen
   machine. Inzenden blijft op /apps/appstore-uitgever.html, want daarvoor is een
   uitgeversplek nodig en die hangt aan een organisatie (APPSTORE.md). Zo hoeft
   niemand een BV te hebben om te kunnen BOUWEN.

   DE REGEL WAAR ALLES HIER AAN HANGT: dit gereedschap bouwt niets na. De poort
   die `rtg check` draait is `kern/appstore/keuring.js`, de brug die `rtg dev`
   draait is `kern/appstore/brug.js`, en de CSP en de brugklant komen uit
   `kern/appstore/brugklant.js`. Een tweede uitvoering ernaast zou een keer
   uiteenlopen, en dan is de fout "werkt lokaal, geblokkeerd in de cel" -- precies
   de ervaring die dit kanaal niet moet geven (LAT-regel 4).

   Draai:  node scripts/rtg.js <opdracht>
           rtg <opdracht>                (na `npm link`, zie package.json bin)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { neem } = require(path.join(WORTEL, 'server/kern/appstore/bundel'));
const { keur, BUDGET, TOEGESTAAN } = require(path.join(WORTEL, 'server/kern/appstore/keuring'));
const manifestLezer = require(path.join(WORTEL, 'server/kern/appstore/manifest'));

const kleur = process.stdout.isTTY && !process.env.NO_COLOR;
const rood = (s) => kleur ? '\x1b[31m' + s + '\x1b[0m' : s;
const geel = (s) => kleur ? '\x1b[33m' + s + '\x1b[0m' : s;
const groen = (s) => kleur ? '\x1b[32m' + s + '\x1b[0m' : s;
const grijs = (s) => kleur ? '\x1b[90m' + s + '\x1b[0m' : s;
const vet = (s) => kleur ? '\x1b[1m' + s + '\x1b[0m' : s;

/* ------------------------------------------------------------ een map inlezen */

/* Wat een bundel mag bevatten, staat in kern/appstore/bundel.js en niet hier.
   Deze functie doet maar een ding: een map omzetten naar de vorm die de poort
   verwacht, en ZEGGEN wat er is overgeslagen. Stil overslaan is het ergste wat
   je hier kunt doen -- dan keurt de poort een bundel goed die niet is wat de
   ontwikkelaar voor zich ziet. */
const OVERSLAAN = new Set(['node_modules', '.git', '.rtg', 'dist', 'build']);
const TEKST = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt']);

function lijstMap(map, prefix, uit, over) {
  let namen;
  try { namen = fs.readdirSync(map, { withFileTypes: true }); }
  catch (e) { return { uit, over }; }
  for (const d of namen.sort((a, b) => a.name.localeCompare(b.name))) {
    if (d.name.startsWith('.') && d.name !== '.well-known') { over.push({ pad: prefix + d.name, waarom: 'verborgen bestand' }); continue; }
    if (OVERSLAAN.has(d.name)) { over.push({ pad: prefix + d.name, waarom: 'werkmap, hoort niet in een bundel' }); continue; }
    const vol = path.join(map, d.name);
    if (d.isDirectory()) { lijstMap(vol, prefix + d.name + '/', uit, over); continue; }
    const ext = path.extname(d.name).toLowerCase();
    if (!TOEGESTAAN[ext]) { over.push({ pad: prefix + d.name, waarom: 'de soort "' + (ext || 'zonder extensie') + '" hoort niet in een bundel' }); continue; }
    const buf = fs.readFileSync(vol);
    uit.push(TEKST.has(ext)
      ? { pad: prefix + d.name, inhoud: buf.toString('utf8'), codering: 'tekst' }
      : { pad: prefix + d.name, inhoud: buf.toString('base64'), codering: 'base64' });
  }
  return { uit, over };
}

function leesBundel(map) {
  if (!fs.existsSync(map)) return { error: 'De map "' + map + '" bestaat niet.' };
  const manifestPad = path.join(map, 'manifest.json');
  if (!fs.existsSync(manifestPad)) {
    return { error: 'Er staat geen manifest.json in "' + map + '". Begin met `rtg new` als je nog geen app hebt.' };
  }
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPad, 'utf8')); }
  catch (e) { return { error: 'manifest.json is geen geldige JSON: ' + e.message }; }

  const { uit, over } = lijstMap(map, '', [], []);
  /* manifest.json hoort NIET in de bundel: hij beschrijft de bundel. Zat hij
     erin, dan telde hij mee in het budget en kon een app zijn eigen manifest
     serveren -- twee lezingen van hetzelfde (LAT-regel 4). */
  const bestanden = uit.filter(b => b.pad !== 'manifest.json');
  return { manifest, bestanden, overgeslagen: over };
}

/* ------------------------------------------------------------------- opdracht: check */

function toonBevindingen(bevindingen) {
  const blok = bevindingen.filter(b => b.ernst === 'blokkeert');
  const let_op = bevindingen.filter(b => b.ernst !== 'blokkeert');
  for (const groep of [blok, let_op]) {
    for (const b of groep) {
      const merk = b.ernst === 'blokkeert' ? rood('blokkeert') : geel('let op');
      const waar = b.bestand ? b.bestand + (b.regel ? ':' + b.regel : '') : '(de bundel)';
      console.log('  ' + merk + '  ' + vet(waar));
      console.log('           ' + b.wat);
      console.log('           ' + grijs(b.hoe));
    }
  }
}

function opdrachtCheck(argv) {
  const map = path.resolve(argv[0] || '.');
  const g = leesBundel(map);
  if (g.error) { console.error(rood(g.error)); return 2; }

  const m = manifestLezer.lees(g.manifest);
  if (!m.ok) {
    console.log('\n  ' + vet('Het manifest klopt nog niet.') + '\n');
    for (const f of m.fouten) {
      console.log('  ' + rood(f.veld));
      console.log('           ' + f.wat);
    }
    console.log('');
    return 1;
  }

  const b = neem(g.bestanden);
  if (!b.ok) {
    console.log('\n  ' + vet('De bundel klopt nog niet.') + '\n');
    for (const f of b.fouten) console.log('  ' + rood(f.pad || '(de bundel)') + '  ' + f.wat);
    console.log('');
    return 1;
  }

  /* DE ECHTE POORT, met eisScan uit. Niet omdat de scan onbelangrijk is, maar
     omdat hij hier niet KAN draaien -- en dan is 'niet uitgevoerd' het eerlijke
     antwoord en niet 'afgekeurd'. Zie de kop van kern/appstore/keuring.js. */
  const k = keur({ bestanden: b.bestanden, manifest: m.manifest, antivirus: null, eisScan: false });

  console.log('\n  ' + vet(m.manifest.naam) + grijs('  ' + m.manifest.sleutel + ' ' + m.manifest.versie));
  console.log('  ' + k.maten.bestanden + ' bestanden, ' + kB(k.maten.totaal) + ' totaal'
    + '  ' + grijs('(script ' + kB(k.maten.script) + '/' + kB(BUDGET.script)
    + ', stijl ' + kB(k.maten.stijl) + '/' + kB(BUDGET.stijl)
    + ', totaal ' + kB(BUDGET.totaal) + ')'));
  if (g.overgeslagen.length) {
    console.log('  ' + geel(g.overgeslagen.length + ' bestand(en) overgeslagen') + grijs(' -- ze zitten dus NIET in wat hier is gekeurd:'));
    for (const o of g.overgeslagen.slice(0, 8)) console.log('    ' + grijs(o.pad + '  ' + o.waarom));
    if (g.overgeslagen.length > 8) console.log('    ' + grijs('(+' + (g.overgeslagen.length - 8) + ' meer)'));
  }
  console.log('');
  if (k.bevindingen.length) { toonBevindingen(k.bevindingen); console.log(''); }

  /* DRIE UITSLAGEN, en de derde is het punt. 'Vorm in orde' is geen goedkeuring:
     de machinepoort keurt sowieso nooit goed (APPSTORE.md grens 2), en de
     virusscan is hier niet gedraaid. Wie hier een groen vinkje van maakt, maakt
     een belofte die dit gereedschap niet kan waarmaken. */
  const vorm = k.door ? groen('in orde') : rood('blokkeert');
  console.log('  vorm       ' + vorm);
  console.log('  virusscan  ' + geel('niet uitgevoerd') + grijs('  -- draait alleen bij RTG, bij het inzenden'));
  console.log('  keuring    ' + grijs('niet vast te stellen') + grijs('  -- een mens van RTG kijkt naar wat je app DOET'));
  console.log('');
  if (k.door) {
    console.log('  ' + grijs('De vorm van je bundel houdt de poort niet tegen. Inzenden doe je in het'));
    console.log('  ' + grijs('uitgeversbureau: /apps/appstore-uitgever.html'));
  } else {
    console.log('  ' + grijs('Zo komt deze bundel de poort niet door. Hierboven staat per bestand en'));
    console.log('  ' + grijs('regel wat er is gevonden en hoe het wel kan.'));
  }
  console.log('');
  return k.door ? 0 : 1;
}

const kB = (n) => Math.round(n / 1024) + ' kB';

/* --------------------------------------------------------------- opdracht: new */

const SJABLOON = {
  'manifest.json': (sleutel) => JSON.stringify({
    sleutel,
    naam: 'Mijn eerste app',
    versie: '0.1.0',
    uitleg: 'Beschrijf hier in gewone taal wat deze app doet. Dit is wat een lid leest voordat hij iets verleent.',
    categorie: 'leven',
    start: 'index.html',
    taal: 'nl',
    machtigingen: [{ id: 'profiel.basis', doel: 'aanspreken' }]
  }, null, 2) + '\n',

  'index.html': () => `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mijn eerste app</title>
<link rel="stylesheet" href="app.css">
</head>
<body>
  <main>
    <h1 id="groet">Hallo</h1>
    <p id="uitleg">Deze app draait in een cel: geen netwerk, geen cookies, een naamloze herkomst.</p>
    <button id="knop">Wie ben ik?</button>
    <pre id="uit"></pre>
  </main>
  <!-- Geen on...-attributen: die werken niet achter de CSP van de cel.
       addEventListener in app.js werkt wel. -->
  <script src="app.js"></script>
</body>
</html>
`,

  'app.js': () => `'use strict';
/* RTG.roep() is er al voordat dit bestand draait: de brugklant wordt door de cel
   in de <head> gezet. Netwerkaanroepen bestaan hier niet -- de cel heeft er geen.

   Let op: de poort leest je bestanden REGEL voor regel en strijkt het commentaar
   er niet af. Een verboden naam noemen in een uitleg is dus ook een blokkade.
   Dat is streng en het is de goede kant om streng te zijn: een lijst die je kunt
   omzeilen door je aanroep in een string te zetten, is geen lijst. */
document.getElementById('knop').addEventListener('click', async () => {
  const uit = document.getElementById('uit');
  try {
    const ik = await RTG.roep('profiel.wieBenIk');
    uit.textContent = 'Je codenaam is ' + ik.codenaam + ' (' + ik.taal + ', ' + ik.pas + ').';
  } catch (e) {
    /* Een weigering draagt meer dan een zin: e.code, e.machtiging, e.verleend
       en e.hoe zeggen samen wat er mis is en wat je eraan kunt doen. */
    uit.textContent = e.code + '\\n' + e.message + (e.hoe ? '\\n\\n' + e.hoe : '');
  }
});
`,

  'app.css': () => `:root { color-scheme: light dark; }
body { margin: 0; font-family: system-ui, sans-serif; line-height: 1.5; }
main { max-width: 34rem; margin: 0 auto; padding: 2.5rem 1.25rem; }
h1 { font-weight: 500; letter-spacing: -0.01em; }
button { font: inherit; padding: 0.5rem 0.9rem; border-radius: 10px; border: 1px solid currentColor; background: none; cursor: pointer; }
pre { white-space: pre-wrap; opacity: 0.8; }
`
};

function opdrachtNew(argv) {
  const map = path.resolve(argv[0] || 'mijn-app');
  const sleutel = path.basename(map).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 39) || 'mijn-app';
  if (!/^[a-z][a-z0-9-]{2,39}$/.test(sleutel)) {
    console.error(rood('"' + sleutel + '" kan geen appsleutel zijn: kleine letters, cijfers en streepjes, 3 tot 40 tekens, beginnend met een letter.'));
    return 2;
  }
  if (fs.existsSync(map) && fs.readdirSync(map).length) {
    console.error(rood('De map "' + map + '" bestaat al en is niet leeg. Kies een andere naam.'));
    return 2;
  }
  fs.mkdirSync(map, { recursive: true });
  for (const [naam, maakInhoud] of Object.entries(SJABLOON)) {
    fs.writeFileSync(path.join(map, naam), maakInhoud(sleutel));
  }
  console.log('\n  ' + vet(sleutel) + ' staat klaar in ' + grijs(map) + '\n');
  console.log('    ' + Object.keys(SJABLOON).join('  '));
  console.log('\n  Verder:');
  console.log('    rtg dev ' + path.relative(process.cwd(), map) + grijs('     draai hem, met een synthetisch lid'));
  console.log('    rtg check ' + path.relative(process.cwd(), map) + grijs('   haal de poort erover'));
  console.log('');
  return 0;
}

/* ------------------------------------------------------------------- de hulp */

function hulp() {
  console.log(`
  ${vet('rtg')} ${grijs('-- bouwen voor de RTG App Store')}

    ${vet('rtg new')} [map]        een nieuwe app, klaar om te draaien
    ${vet('rtg check')} [map]      de echte poort over je bundel, op je eigen machine
    ${vet('rtg dev')} [map]        draai je app in een echte cel, met een synthetisch lid
    ${vet('rtg sdk')} [--uit map]  schrijf de typings en de documentatie uit de code

  ${grijs('Geen van deze opdrachten heeft een inlog nodig en geen ervan raakt de')}
  ${grijs('server van RTG. Inzenden gebeurt in het uitgeversbureau:')}
  ${grijs('/apps/appstore-uitgever.html')}
`);
}

/* ------------------------------------------------------------------ de wissel */

const OPDRACHTEN = {
  new: opdrachtNew,
  check: opdrachtCheck,
  dev: (argv) => require('./rtg-dev')(argv, { leesBundel, kleur }),
  sdk: (argv) => require('./rtg-sdk')(argv, { kleur })
};

function hoofd(argv) {
  const opdracht = argv[0];
  if (!opdracht || opdracht === '--help' || opdracht === '-h' || opdracht === 'help') { hulp(); return 0; }
  const fn = OPDRACHTEN[opdracht];
  if (!fn) {
    console.error(rood('"' + opdracht + '" is geen opdracht.') + ' Er zijn er ' + Object.keys(OPDRACHTEN).length + ': ' + Object.keys(OPDRACHTEN).join(', ') + '.');
    return 2;
  }
  return fn(argv.slice(1));
}

module.exports = { hoofd, leesBundel, opdrachtCheck, opdrachtNew, SJABLOON };

if (require.main === module) {
  const uit = hoofd(process.argv.slice(2));
  if (typeof uit === 'number') process.exit(uit);
}
