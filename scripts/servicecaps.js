#!/usr/bin/env node
/* ============================================================================
   DE SERVICECAPABILITIES -- wie mag wat, en LEEST er iemand die toestemming?

   WAAROM DIT SCRIPT BESTAAT. `kern/service/teams.js` zegt per team welke
   bevoegdheden zijn werk vraagt, en een medewerker krijgt die per zaak en
   tijdelijk uitgereikt nadat het lid heeft bevestigd. Die tabel bepaalt dus wat
   iemand met een bevestiging werkelijk kan openen -- inclusief het zware werk
   dat een tweede handtekening vraagt. Zo'n tabel hoort door een MENS te worden
   nagekeken vóór productie, en dat kan alleen als hij te overzien is.

   DE SCHERPSTE VRAAG IS NIET WIE WAT MAG, MAAR OF ER IEMAND LEEST.
   CONTROLPLANE.md: geen capability zonder caller. Een bevoegdheid die nergens
   wordt uitgelezen, legt toestemming vast en opent niets -- precies de toestand
   waarin `magNu()` verkeerde voordat er een eerste poort naast kwam. Zo'n
   capability is geen bescherming maar een woord: hij laat een lid iets
   bevestigen wat het systeem daarna nergens afdwingt, en hij laat een keurder
   denken dat er een grendel zit.

   Dit script telt daarom drie dingen per capability:
     - welke TEAMS hem kunnen vragen;
     - of hij ZWAAR is (tweede mens, kern/service/machtiging-grenzen.js);
     - of er ergens in server/ een `magNu(..., '<capability>')` staat.

   Draai: node scripts/servicecaps.js
          node scripts/servicecaps.js --controle   (zakt bij een stille capability)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { TEAMS, GROND } = require('../server/kern/service/teams');
const { ZWAAR } = require('../server/kern/service/machtiging-grenzen');

function bestanden(map, uit) {
  for (const naam of fs.readdirSync(map, { withFileTypes: true })) {
    const p = path.join(map, naam.name);
    if (naam.isDirectory()) { if (naam.name !== 'node_modules' && naam.name !== 'data') bestanden(p, uit); }
    else if (naam.name.endsWith('.js')) uit.push(p);
  }
  return uit;
}

/* De roepers. Een aanroep telt alleen als hij de capability als LETTERLIJKE
   tekenreeks noemt: een variabele doorgeven kan deze meting niet volgen, en dan
   is "wij weten het niet" het eerlijke antwoord -- niet "hij wordt gebruikt". */
function roepers(cap) {
  const uit = [];
  for (const f of bestanden(path.join(ROOT, 'server'), [])) {
    const t = fs.readFileSync(f, 'utf8');
    if (!t.includes(cap)) continue;
    /* De tabel zelf en de grenzenlijst tellen niet mee: daar STAAT hij, daar
       wordt hij niet gevraagd. Dezelfde regel als in capabilityroepers.js -- een
       caller binnen de eigen module is geen caller. */
    const rel = path.relative(ROOT, f);
    if (rel.endsWith('kern/service/teams.js') || rel.endsWith('kern/service/machtiging-grenzen.js')) continue;
    /* De naam gaat als LETTERLIJKE tekenreeks de regex in: elk metateken
       ontsnapt, niet alleen de punt (CodeQL: incomplete string escaping). Een
       capability heet 'bank.gegevens' en draagt geen backslash, maar een
       ontsnapping die de helft doet is er geen. */
    const letterlijk = cap.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp('magNu\\([^)]*[\'"]' + letterlijk + '[\'"]').test(t)) uit.push(rel);
  }
  return uit;
}

const alle = new Map();
for (const [team, t] of Object.entries(TEAMS)) {
  for (const c of t.capabilities) {
    if (!alle.has(c)) alle.set(c, []);
    alle.get(c).push(team);
  }
}

const rijen = [...alle.entries()].sort().map(([cap, teams]) => ({
  capability: cap, teams, grond: GROND[cap] || 'ONBEKEND',
  zwaar: !!ZWAAR[cap], zwaarWat: ZWAAR[cap] || null, roepers: roepers(cap)
}));

/* ALLEEN WAT HET LID BEVESTIGT HOEFT EEN LEZER TE HEBBEN. Wat de ZETEL verleent
   (`zaak.lezen`) wordt door de gewone kantoorroutes gebruikt en niet door
   `magNu()` -- daar een lezer voor eisen zou betekenen dat een medewerker de
   wachtrij pas ziet nadat een lid iets heeft bevestigd, en dan is er niets om te
   bevestigen. Een bevoegdheid ZONDER grond telt wel mee: die is vergeten, en
   vergeten is hier geen vrijstelling. */
const stil = rijen.filter(r => r.grond !== 'zetel' && !r.roepers.length);
const breed = rijen.filter(r => r.teams.length >= 4);

console.log('\nSERVICECAPABILITIES -- ' + rijen.length + ' bevoegdheden over ' +
  Object.keys(TEAMS).length + ' teams\n');
for (const r of rijen) {
  const merk = r.zwaar ? ' [ZWAAR: tweede mens]' : '';
  console.log('  ' + r.capability.padEnd(24) + merk);
  console.log('      grond   : ' + (r.grond === 'zetel'
    ? 'de ZETEL verleent hem al -- het lid wordt hier niets gevraagd'
    : r.grond === 'bevestiging' ? 'het LID bevestigt, en pas dan gaat hij open'
    : 'ONBEKEND -- niet ingedeeld in kern/service/teams.js'));
  console.log('      teams   : ' + r.teams.join(', '));
  if (r.grond !== 'zetel') {
    console.log('      gelezen : ' + (r.roepers.length ? r.roepers.join(', ')
      : 'NERGENS -- deze bevoegdheid opent niets'));
  }
}

const teBevestigen = rijen.filter(r => r.grond !== 'zetel');
console.log('\n  ' + stil.length + ' van ' + teBevestigen.length +
  ' bevoegdheden die het LID bevestigt, worden NERGENS uitgelezen.');
if (stil.length) {
  console.log('  Dat is geen bescherming maar een woord: een lid bevestigt iets dat daarna');
  console.log('  nergens wordt afgedwongen, en een keurder denkt dat er een grendel zit.');
  console.log('  ' + stil.map(r => r.capability).join(', '));
}
console.log('  ' + rijen.filter(r => r.zwaar).length + ' zijn ZWAAR en vragen een tweede mens.');
if (breed.length) {
  console.log('  ' + breed.length + ' staan bij vier of meer teams -- kijk of dat klopt: ' +
    breed.map(r => r.capability).join(', '));
}
console.log('');

if (process.argv.includes('--controle') && stil.length) {
  console.error('servicecaps: ' + stil.length + ' bevoegdheid(en) zonder lezer.');
  process.exit(1);
}
