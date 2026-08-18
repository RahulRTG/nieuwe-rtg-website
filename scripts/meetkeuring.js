#!/usr/bin/env node
/* ============================================================================
   DE MEETKEURING -- HOUDEN DE INSTRUMENTEN ZICH AAN HUN EIGEN REGELS?

   Dit huis meet zijn product uitputtend: 4193 routes, elf schakels, twaalf
   registers. Wat er NIET was, is een meting op de meetlaag zelf. En juist daar
   zijn deze maand de duurste fouten gevonden -- niet in het product maar in de
   instrumenten die erover rapporteren:

     de poortwacht printte 484 KB en riep process.exit aan; door een pipe kwam
       er 146 KB uit. Geldige tekst, kapotte JSON, exitcode 0.
     een laadcontrole van de rolproef startte een volledige ronde en schreef
       ROLPROEF.json van 3377 beproefde routes terug naar 292.
     de outputproef had een toerekeningsregel die NOOIT kon vuren: nul bewezen
       op 4185 routes, en de suite bleef groen.
     21 van de 24 registers droegen geen tijdstempel: verouderd zag er identiek
       uit aan vers.

   Vier fouten, vier keer dezelfde vorm: een meter die iets beweert wat hij niet
   heeft gemeten. Elk ervan is achteraf in commentaar vastgelegd, en commentaar
   handhaaft niets. Dit script maakt er regels van.

   DE REGELS ZIJN GEEN STIJLVOORKEUREN. Elke regel hieronder komt uit een fout
   die hier ECHT is gemaakt, en elke regel is met een mutatie na te trekken.

   Draai:  node scripts/meetkeuring.js
           node scripts/meetkeuring.js --json
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const versheid = require('./versheid');

const WORTEL = path.join(__dirname, '..');
const lees = (p) => { try { return fs.readFileSync(path.join(WORTEL, p), 'utf8'); } catch (e) { return null; } };

/* BRON ZONDER COMMENTAAR. Twee van de vier regels lezen code, en twee keer sloeg
   deze keuring aan op een TOELICHTING in plaats van op een overtreding:
   scripts/poortwacht.js legt in een commentaarblok uit waarom er GEEN
   process.exit() staat, en werd daarop aangewezen. Een keuring die je leert dat
   zijn meldingen soms onzin zijn, handhaaft binnen een week niets meer. De
   regelnummering blijft kloppen: commentaar wordt door spaties vervangen, niet
   weggehaald. */
function zonderCommentaar(bron) {
  return bron.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, v) => v + ' '.repeat(m.length - v.length));
}

/* De instrumenten komen uit scripts/versheid.js -- daar staat al welk register
   door welk commando wordt gevuld. Een tweede lijst hier zou binnen een maand
   uit de pas lopen (LAT.md regel 4). Het SCRIPT wordt uit de herstelopdracht
   gehaald, want die noemt hem al. */
function instrumenten() {
  const bestaat = (p) => p && fs.existsSync(path.join(WORTEL, p)) ? p : null;
  /* Eerst het gewone pad, dan de -route-variant. HIER ZAT EEN STILLE FOUT:
     `--alleen=poortwacht` werd onvoorwaardelijk scripts/poortwacht-route.js, dat
     niet bestaat, dus viel POORTWACHT.json terug op "geen script te herleiden"
     en werden twee van de vier regels er nooit op toegepast. Ze telden als
     `niet van toepassing` en zagen er dus uit als een keurige uitslag. Een
     keuring die drie van zijn twaalf instrumenten niet kan vinden en dat als
     n.v.t. presenteert, meet zichzelf mooier dan hij is -- precies waar deze
     keuring over gaat. */
  const scriptVoor = (naam) => bestaat('scripts/' + naam + '.js') || bestaat('scripts/' + naam + '-route.js');
  const uit = [];
  for (const [register, hoe] of versheid.REGISTERS.map(r => [r[0], r[1]])) {
    let script = null;
    let m;
    if ((m = /scripts\/([a-z0-9-]+)\.js/.exec(hoe))) script = scriptVoor(m[1]);
    else if ((m = /--alleen=([a-z]+)/.exec(hoe))) script = scriptVoor(m[1]);
    else if ((m = /npm run ([a-z:]+)/.exec(hoe))) {
      const kaart = { 'dekking:vast': 'dekking', 'bewijsmatrix:vast': 'bewijsmatrix',
        mutatie: 'mutatie', beproeving: 'beproeving' };
      script = kaart[m[1]] ? scriptVoor(kaart[m[1]]) : null;
    }
    /* Een instrument hoeft geen script te zijn. SCHERMLEUGEN.json wordt door een
       TOETS gemeten, en die toets is even goed de plek waar de regels gelden. */
    if (!script && (m = /(test\/[a-z0-9.-]+\.js)/.exec(hoe))) script = bestaat(m[1]);
    uit.push({ register, script, hoe });
  }
  return uit;
}

/* ---- SCHRIJFT DE CODE HET, OF LIGT ALLEEN HET REGISTER ACHTER? ----

   DE FOUT DIE DEZE KEURING ZELF MAAKTE. Hij keurde het REGISTER en trok daaruit
   een conclusie over het INSTRUMENT. Een instrument dat de regel nooit heeft
   geleerd en een instrument dat hem vanochtend leerde maar sindsdien niet meer
   heeft gedraaid, zien er in het register precies hetzelfde uit -- en ze vragen
   om twee heel verschillende reparaties: de een om code, de ander om een ronde.

   Dat is dezelfde verwisseling als bij het schermjournaal (zie
   test/schermronde.test.js): een meetopstelling die niet heeft gedraaid,
   voorgesteld als een slechte uitslag. Een keuring die dat over ZICHZELF niet
   doorheeft, heeft weinig recht van spreken.

   Vandaar `stale`: de bron draagt het veld, het register nog niet. Dat is geen
   overtreding maar een openstaande ronde. */
function bronSchrijft(script, velden) {
  if (!script) return false;
  const bron = lees(script);
  if (!bron) return false;
  const code = zonderCommentaar(bron);
  return velden.some(v => new RegExp('(^|[^a-zA-Z])' + v + '\\s*:').test(code));
}

/* Een uitslag die zegt: de code is in orde, de meting is oud. */
function oudRegister(i, velden, reden) {
  return bronSchrijft(i.script, velden)
    ? { ok: 'stale', reden: reden + ' -- maar ' + i.script + ' schrijft het inmiddels wel; dit register is van voor die ronde' }
    : { ok: false, reden };
}

const REGELS = [
  {
    id: 'stempel',
    wat: 'elk register zegt WANNEER het is gemeten en tegen welke commit',
    waarom: '21 van de 24 registers droegen er geen. Een verouderd register ziet er identiek ' +
      'uit aan een verse, en getallen worden geloofd. POORTWACHT.json liep 196 routes achter ' +
      'en dat was alleen te ontdekken door het te vermoeden.',
    keur: (i) => {
      const s = versheid.stempelVan(i.register);
      if (s === undefined) return { ok: null, reden: 'het register bestaat nog niet' };
      if (!s || !s.op) return oudRegister(i, ['stempel'], 'geen tijdstempel');
      if (!s.commit) return oudRegister(i, ['stempel'], 'geen commit; niet te herleiden tot een versie van de code');
      return { ok: true };
    }
  },
  {
    id: 'grens',
    wat: 'elk register zegt wat het NIET aantoont',
    waarom: 'zonder grens leest elke uitslag als een dekkende garantie. De rolproef zegt zelf ' +
      'dat hij geen IDOR ziet; zonder die zin zou "0 bevindingen" als "geen toegangsfouten" lezen.',
    keur: (i) => {
      const j = (() => { try { return JSON.parse(lees(i.register)); } catch (e) { return null; } })();
      if (!j) return { ok: null, reden: 'het register bestaat nog niet of is onleesbaar' };
      const tekst = [j.grens, j.uitleg].filter(Boolean).join(' ');
      if (!tekst) return oudRegister(i, ['grens', 'uitleg'], 'geen uitleg en geen grens');
      if (!j.grens && !/niet|geen|alleen/i.test(tekst)) {
        return oudRegister(i, ['grens'], 'wel een uitleg, maar nergens wat het NIET aantoont');
      }
      return { ok: true };
    }
  },
  {
    id: 'wacht',
    wat: 'een instrument dat een register overschrijft, start niet bij het requiren',
    waarom: 'een laadcontrole (node -e "require(...)") startte de rolproef met de ' +
      'STANDAARDbegrenzing en schreef ROLPROEF.json van 3377 beproefde routes terug naar 292. ' +
      'Het register zag er daarna volkomen normaal uit.',
    keur: (i) => {
      if (!i.script) return { ok: null, reden: 'geen script te herleiden' };
      const bron = lees(i.script);
      if (!bron) return { ok: null, reden: 'bron niet te lezen' };
      const code = zonderCommentaar(bron);
      if (!/writeFileSync/.test(code)) return { ok: null, reden: 'dit script schrijft zelf geen register' };
      /* BEIDE SCHRIJFWIJZEN TELLEN. Deze regel gaf eerst een vals alarm op
         mutatie.js en sabotage.js: die dragen de wacht wel, maar als
         `if (require.main === module) { ... }` in plaats van de vroege
         `if (require.main !== module) return;`. Een keuring die onterecht
         aanslaat wordt binnen een week genegeerd, en dan handhaaft hij niets
         meer -- dat is duurder dan de regel waard is. */
      return /require\.main\s*(===|!==)\s*module/.test(code)
        ? { ok: true }
        : { ok: false, reden: 'schrijft een register maar heeft geen require.main-wacht' };
    }
  },
  {
    id: 'pipe',
    wat: 'geen process.exit vlak na een grote console.log',
    waarom: 'de poortwacht printte 484 KB JSON en riep process.exit aan. Naar een BESTAND ging ' +
      'dat goed (node schrijft dan synchroon), naar een PIPE kwam er 146176 bytes uit: geldige ' +
      'tekst, kapotte JSON, exitcode 0. Twee derde van de uitslag verdween zonder signaal.',
    keur: (i) => {
      if (!i.script) return { ok: null, reden: 'geen script te herleiden' };
      const bron = lees(i.script);
      if (!bron) return { ok: null, reden: 'bron niet te lezen' };
      const regels = zonderCommentaar(bron).split('\n');
      for (let n = 0; n < regels.length; n++) {
        if (!/console\.log\(JSON\.stringify\(/.test(regels[n])) continue;
        const venster = regels.slice(n, n + 2).join(' ');
        if (/process\.exit\(/.test(venster)) {
          return { ok: false, reden: 'regel ' + (n + 1) + ': grote uitvoer gevolgd door process.exit(); ' +
            'gebruik process.exitCode zodat een pipe leegloopt' };
        }
      }
      return { ok: true };
    }
  }
];

function meet() {
  const lijst = instrumenten();
  const bevindingen = [];
  const telling = { gekeurd: 0, ok: 0, gezakt: 0, oud: 0, nvt: 0 };
  for (const i of lijst) {
    for (const regel of REGELS) {
      const u = regel.keur(i);
      telling.gekeurd++;
      if (u.ok === true) { telling.ok++; continue; }
      if (u.ok === null) { telling.nvt++; continue; }
      if (u.ok === 'stale') telling.oud++; else telling.gezakt++;
      bevindingen.push({ register: i.register, script: i.script, regel: regel.id, soort: u.ok === 'stale' ? 'oud register' : 'de code',
        wat: regel.wat, reden: u.reden, waarom: regel.waarom, hoe: i.hoe });
    }
  }
  return { instrumenten: lijst.length, regels: REGELS.length, telling, bevindingen };
}

module.exports = { meet, REGELS, instrumenten };

if (require.main !== module) return;

const uit = meet();
if (process.argv.includes('--json')) { console.log(JSON.stringify(uit, null, 1)); process.exitCode = 0; return; }

console.log('\n=== DE MEETKEURING ===\n');
console.log('  ' + uit.instrumenten + ' instrumenten x ' + uit.regels + ' regels\n');
for (const r of REGELS) {
  const eigen = uit.bevindingen.filter(b => b.regel === r.id && b.soort === 'de code');
  const oud = uit.bevindingen.filter(b => b.regel === r.id && b.soort === 'oud register');
  console.log((eigen.length ? '  X  ' : oud.length ? '  ~  ' : '  ok ') + r.id.padEnd(10) + r.wat);
  for (const b of eigen) console.log('        ' + b.register.padEnd(20) + b.reden);
  for (const b of oud) console.log('        ' + b.register.padEnd(20) + '(oud register) draai: ' + b.hoe);
}
console.log('\n  gekeurd ' + uit.telling.gekeurd + '   in orde ' + uit.telling.ok +
  '   gezakt ' + uit.telling.gezakt + '   oud register ' + uit.telling.oud +
  '   niet van toepassing ' + uit.telling.nvt);
if (uit.telling.oud) {
  console.log('\n  ~ is geen overtreding maar een openstaande ronde: de code draagt de regel,');
  console.log('    het register is van ervoor. Draai het instrument en het verschil verdwijnt.');
}
if (uit.telling.gezakt) {
  console.log('\n  Een instrument dat zich niet aan zijn eigen regels houdt, meet zichzelf mooier');
  console.log('  dan het is. Elke regel hierboven komt uit een fout die hier echt is gemaakt.');
}
process.exitCode = 0;
