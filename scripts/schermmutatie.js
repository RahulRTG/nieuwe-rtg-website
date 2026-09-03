#!/usr/bin/env node
/* ============================================================================
   DE SCHERMMUTATIEMOTOR -- merkt deze schermtoets het als er iets van het
   scherm verdwijnt?

   HET GAT DAT DIT VULT, en het is een gat in de MOTOR en niet in een toets.
   scripts/mutatie.js kent twee fasen: pure toetsen (muteer de module die de
   toets laadt) en servertoetsen (laat de liegpoort elk antwoord legen). Een
   SCHERMTOETS valt in geen van beide op de manier die ertoe doet: hij laadt
   geen module -- hij bezoekt een adres -- en de liegpoort leegt de API, niet de
   pagina. Een schermtoets die op het verkeerde element kijkt, blijft daardoor
   in beide fasen keurig "gevoelig" heten.

   DAT IS GEEN THEORIE. Twee keer in een ronde stond hier een schermtoets groen
   om niets: een assertie las de tekst van een heel blok en matchte op de
   inleidende zin in plaats van op het onderdeel eronder, en een andere las de
   hele pagina. Beide keren was de mutatie die het aan het licht bracht dezelfde
   handeling: HAAL EEN STUK VAN HET SCHERM WEG EN KIJK OF DE TOETS HET MERKT.
   Die handeling stond nergens in de motor; hij zat in mijn hoofd. Dit bestand
   is die handeling, mechanisch gemaakt.

   HOE HIJ WEET WELK SCHERM BIJ WELKE TOETS HOORT. Niet uit een register -- dat
   drijft weg -- maar uit de toets zelf: `page.goto(base + '/apps/x.html')` staat
   erin, want anders zou de toets niets kunnen bezoeken. Een schermtoets die geen
   pagina noemt, komt in de uitslag als "geen scherm gevonden" en niet als groen.

   DE OPERATOREN. Twee, en allebei halen ze iets WEG in plaats van iets te
   verdraaien -- want dat is de vraag hier: valt het op als het er niet is?

     blok-weg        een `if (x) {` wordt `if (false) {`: het blok rendert niet
     appendChild-weg een `x.appendChild(y);` valt weg: dat onderdeel komt niet
                     in de boom

   Wat hij NIET beweert, in dezelfde geest als de motor waar hij naast staat:
   een toets die zakt is BEWEZEN gevoelig voor dit stuk scherm, niet bewezen
   goed. En een toets die groen blijft terwijl een blok verdwijnt, zegt niet dat
   de toets waardeloos is -- hij zegt dat NIEMAND WEET of dat blok gedekt is, en
   dat is precies het soort onwetendheid dat hier tweemaal geld kostte.

   Draai:  node scripts/schermmutatie.js test/gegevenskaart-scherm.e2e.js
           node scripts/schermmutatie.js --alles        (alle schermtoetsen)
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');
/* HET SPOOR WORDT GELEZEN VOOR ./mutatie WORDT GELADEN, en dat is geen
   volgordekwestie maar de hele werking: die module RUIMT het spoor op bij het
   laden (zijn opruimwacht). Zou deze grendel het daarna lezen, dan zag hij
   altijd een leeg spoor en weigerde hij nooit -- een grendel die niet kan
   sluiten. Dat is hier ook echt gebeurd voordat deze regel er stond. */
const SPOOR = path.join(__dirname, '..', 'server', 'data', 'mutatie-open.json');
const SPOOR_BIJ_START = (() => {
  try {
    const open = JSON.parse(fs.readFileSync(SPOOR, 'utf8'));
    const paden = Array.isArray(open) ? open : Object.keys(open || {});
    return paden.length ? paden : null;
  } catch (e) { return null; }
})();

const { draaiToets, metMutatie } = require('./mutatie');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'SCHERMMUTATIES.json');

/* De twee operatoren. Ze werken op de inline `<script>` van een pagina, en ze
   halen weg in plaats van te verdraaien. */
const OPERATOREN = [
  { naam: 'blok-weg',
    zoek: /\n(\s*)if \((?!false)([^\n]{1,120}?)\) \{/,
    zet: (m, wit) => '\n' + wit + 'if (false) {' },
  { naam: 'appendChild-weg',
    zoek: /\n(\s*)([\w$.]+)\.appendChild\(([^\n]{1,160}?)\);/,
    zet: (m, wit) => '\n' + wit + ';' }
];

/* Welk scherm hoort bij deze toets? Uit de toets zelf, want een register dat
   naast de toetsen leeft, klopt over een half jaar niet meer. */
function schermenVan(toetsPad) {
  const t = fs.readFileSync(toetsPad, 'utf8');
  const uit = new Set();
  const rx = /page\.goto\([^)]*?['"`]([^'"`]*\/apps\/[\w./-]+\.html)/g;
  let m;
  while ((m = rx.exec(t))) {
    const rel = 'public' + m[1];
    if (fs.existsSync(path.join(WORTEL, rel))) uit.add(rel);
  }
  return [...uit];
}

/* Alleen binnen de inline <script> muteren. Buiten dat blok staat CSS en
   opmaak; een `if (` in een stijlregel bestaat niet, maar `appendChild` in een
   commentaar wel -- en een mutatie in commentaar verandert niets en zou als
   "overleefd" tellen terwijl er niets is gebeurd. */
function scriptBereik(bron) {
  const start = bron.indexOf('<script>');
  if (start < 0) return null;
  /* Via lib/bron.js: `</script >` met witruimte sluit ook, en een letterlijke
     indexOf mist dat (CodeQL, 3 september 2026). Derde van de drie plekken. */
  const dicht = require('./lib/bron').eindTag(bron, 'script', start);
  const eind = dicht ? dicht.begin : -1;
  if (eind < 0) return null;
  return { van: start + 8, tot: eind };
}

function muteerScherm(bron, op, index) {
  const bereik = scriptBereik(bron);
  if (!bereik) return null;
  const stuk = bron.slice(bereik.van, bereik.tot);
  const re = new RegExp(op.zoek.source, 'g');
  let m, n = 0;
  while ((m = re.exec(stuk))) {
    /* Commentaarregels overslaan: een mutatie daarin verandert niets en zou als
       "de toets merkte het niet" tellen. Dat is geen meting maar ruis. */
    const regelStart = stuk.lastIndexOf('\n', m.index) + 1;
    const regel = stuk.slice(regelStart, stuk.indexOf('\n', m.index + 1));
    if (/^\s*(\/\/|\*|\/\*)/.test(regel)) continue;
    if (n++ < (index || 0)) continue;
    const vervanging = m[0].replace(new RegExp(op.zoek.source), op.zet);
    const nieuw = stuk.slice(0, m.index) + vervanging + stuk.slice(m.index + m[0].length);
    return { bron: bron.slice(0, bereik.van) + nieuw + bron.slice(bereik.tot), regel: regel.trim().slice(0, 90) };
  }
  return null;
}

async function meetToets(toets, opties = {}) {
  const toetsPad = path.join(WORTEL, toets);
  const schermen = schermenVan(toetsPad);
  if (!schermen.length) return { toets, stand: 'geen scherm gevonden', schoten: 0 };

  /* EERST EERLIJK DRAAIEN. Een toets die al rood staat, meet niets: elke
     mutatie zou "gezakt" heten om een reden die er niets mee te maken heeft.

     En een toets die zichzelf helemaal overslaat (geen browser) meet ook niets;
     die krijgt zijn eigen stand, want "0 gezakt" van een toets die niets deed
     is geen overleving. Dezelfde regel als in de motor hiernaast. */
  const eerlijk = draaiToets(toetsPad, {}, opties.wacht || 240000);
  if (eerlijk.alGeslagen || eerlijk.toetsen === 0) return { toets, stand: 'slaat zichzelf over', schoten: 0 };
  if (eerlijk.gezakt > 0) return { toets, stand: 'stond al rood', schoten: 0 };

  const schoten = [];
  for (const scherm of schermen) {
    const pad = path.join(WORTEL, scherm);
    const origineel = fs.readFileSync(pad, 'utf8');
    for (const op of OPERATOREN) {
      for (let i = 0; i < (opties.perOperator || 3); i++) {
        const uit = muteerScherm(origineel, op, i);
        if (!uit) break;
        let gezakt = false;
        metMutatie(pad, uit.bron, () => {
          const r = draaiToets(toetsPad, {}, opties.wacht || 240000);
          /* Een time-out telt hier NIET als gezakt. Een scherm dat niet meer
             rendert kan een toets laten wachten tot hij afgekapt wordt, en dan
             weet je nog steeds niet of de ASSERTIE iets merkte. */
          gezakt = r.gezakt > 0 && !r.tijdout;
        });
        schoten.push({ scherm, operator: op.naam, regel: uit.regel, gezakt });
        process.stdout.write('  ' + (gezakt ? '✓' : '✗') + ' ' + op.naam + '  ' + uit.regel + '\n');
      }
    }
  }
  const gemist = schoten.filter(s => !s.gezakt);
  return {
    toets, schermen, schoten: schoten.length,
    gezakt: schoten.length - gemist.length,
    overleefd: gemist.length,
    /* GEEN OORDEEL, EEN STAND. Een overleefde mutatie betekent niet dat de toets
       slecht is; hij betekent dat van DIT stuk scherm niemand weet of het gedekt
       is. Dat verschil hoort in de uitslag te staan en niet in de uitleg erbij. */
    ongedekt: gemist.map(s => s.operator + ': ' + s.regel)
  };
}

/* GEEN TWEE RONDEN TEGELIJK, en dit komt uit een echte breuk. Ik startte een
   tweede ronde terwijl de eerste nog liep, allebei op hetzelfde bestand: de een
   zette het origineel terug terwijl de ander zijn mutatie er net in had staan.
   Wat overbleef was een pagina met een halve mutatie, en de meter meldde "stond
   al rood" over een toets die aantoonbaar groen was.

   De opruimwacht van de motor hiernaast redde de werkboom, en dat is precies
   waar hij voor is. Maar een meter die stille onzin KAN meten, hoort niet te
   starten. */
async function hoofd() {
  const args = process.argv.slice(2);
  if (SPOOR_BIJ_START && !args.includes('--toch')) {
    console.log('Er staat nog een mutatie open in:\n  ' + SPOOR_BIJ_START.join('\n  '));
    console.log('\nEr draait waarschijnlijk al een ronde. Twee ronden over hetzelfde bestand');
    console.log('verminken elkaar: de een zet terug wat de ander net muteerde.');
    console.log('Wacht die af, of ruim op met:  node scripts/mutatie.js --opruimen');
    process.exit(1);
  }
  const alles = args.includes('--alles');
  const gekozen = args.filter(a => !a.startsWith('--'));
  const lijst = alles
    ? fs.readdirSync(path.join(WORTEL, 'test')).filter(f => f.endsWith('.e2e.js')).map(f => 'test/' + f)
    : gekozen;
  if (!lijst.length) {
    console.log('Geef een schermtoets op, of --alles.');
    process.exit(1);
  }
  const uit = [];
  for (const t of lijst) {
    console.log('\n' + t);
    const r = await meetToets(t);
    if (r.stand) console.log('  ' + r.stand);
    else console.log('  ' + r.gezakt + '/' + r.schoten + ' gezakt' +
      (r.overleefd ? ', ' + r.overleefd + ' stuk(ken) scherm ongedekt' : ''));
    uit.push(r);
  }
  fs.writeFileSync(UITSLAG, JSON.stringify({ stempel: stempel(), gemeten: new Date().toISOString(),
    uitleg: 'Per schermtoets: hoeveel van de stukken scherm die hij beweert te dekken hij werkelijk mist als ze verdwijnen.',
    grens: 'Meet alleen wat er uit een scherm VERDWIJNT, niet wat er fout in staat; een toets die niet in de lijst staat wordt niet gemeten.',
    toetsen: uit }, null, 2) + '\n');
  console.log('\nUitslag in SCHERMMUTATIES.json');
}

if (require.main === module) hoofd().catch(e => { console.error(e); process.exit(1); });
module.exports = { OPERATOREN, muteerScherm, schermenVan, scriptBereik, meetToets };
