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

/* De instrumenten komen uit scripts/versheid.js -- daar staat al welk register
   door welk commando wordt gevuld. Een tweede lijst hier zou binnen een maand
   uit de pas lopen (LAT.md regel 4). Het SCRIPT wordt uit de herstelopdracht
   gehaald, want die noemt hem al. */
function instrumenten() {
  const uit = [];
  for (const [register, hoe] of versheid.REGISTERS.map(r => [r[0], r[1]])) {
    const m = /scripts\/([a-z0-9-]+\.js)/.exec(hoe) ||
      /--alleen=([a-z]+)/.exec(hoe);
    let script = null;
    if (m && m[1].endsWith('.js')) script = 'scripts/' + m[1];
    else if (m) script = 'scripts/' + m[1] + '-route.js';
    else {
      const n = /npm run ([a-z:]+)/.exec(hoe);
      if (n) {
        const kaart = { 'dekking:vast': 'scripts/dekking.js', 'bewijsmatrix:vast': 'scripts/bewijsmatrix.js',
          mutatie: 'scripts/mutatie.js', beproeving: 'scripts/beproeving.js' };
        script = kaart[n[1]] || null;
      }
    }
    if (script && !fs.existsSync(path.join(WORTEL, script))) script = null;
    uit.push({ register, script, hoe });
  }
  return uit;
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
      if (!s || !s.op) return { ok: false, reden: 'geen tijdstempel' };
      if (!s.commit) return { ok: false, reden: 'geen commit; niet te herleiden tot een versie van de code' };
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
      if (!tekst) return { ok: false, reden: 'geen uitleg en geen grens' };
      if (!j.grens && !/niet|geen|alleen/i.test(tekst)) {
        return { ok: false, reden: 'wel een uitleg, maar nergens wat het NIET aantoont' };
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
      if (!/writeFileSync/.test(bron)) return { ok: null, reden: 'dit script schrijft zelf geen register' };
      /* BEIDE SCHRIJFWIJZEN TELLEN. Deze regel gaf eerst een vals alarm op
         mutatie.js en sabotage.js: die dragen de wacht wel, maar als
         `if (require.main === module) { ... }` in plaats van de vroege
         `if (require.main !== module) return;`. Een keuring die onterecht
         aanslaat wordt binnen een week genegeerd, en dan handhaaft hij niets
         meer -- dat is duurder dan de regel waard is. */
      return /require\.main\s*(===|!==)\s*module/.test(bron)
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
      const regels = bron.split('\n');
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
  const telling = { gekeurd: 0, ok: 0, gezakt: 0, nvt: 0 };
  for (const i of lijst) {
    for (const regel of REGELS) {
      const u = regel.keur(i);
      telling.gekeurd++;
      if (u.ok === true) { telling.ok++; continue; }
      if (u.ok === null) { telling.nvt++; continue; }
      telling.gezakt++;
      bevindingen.push({ register: i.register, script: i.script, regel: regel.id,
        wat: regel.wat, reden: u.reden, waarom: regel.waarom });
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
  const eigen = uit.bevindingen.filter(b => b.regel === r.id);
  console.log((eigen.length ? '  X  ' : '  ok ') + r.id.padEnd(10) + r.wat);
  for (const b of eigen) console.log('        ' + b.register.padEnd(20) + b.reden);
}
console.log('\n  gekeurd ' + uit.telling.gekeurd + '   in orde ' + uit.telling.ok +
  '   gezakt ' + uit.telling.gezakt + '   niet van toepassing ' + uit.telling.nvt);
if (uit.telling.gezakt) {
  console.log('\n  Een instrument dat zich niet aan zijn eigen regels houdt, meet zichzelf mooier');
  console.log('  dan het is. Elke regel hierboven komt uit een fout die hier echt is gemaakt.');
}
process.exitCode = 0;
