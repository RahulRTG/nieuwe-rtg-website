#!/usr/bin/env node
/* ============================================================================
   DE MUTATIEPOORT -- geen release zolang er een onverklaarde schrijfroute is.

   BESLUIT VAN DE EIGENAAR, 30 augustus 2026. De zachte vorm bestond al: het
   aantal onverklaarde schrijfroutes mag alleen krimpen, en een nieuwe route
   zonder contract laat de bouw zakken (regel 64 van scripts/check.js plus
   test/mutatiecontract.test.js). Dit is de harde: LEGACY_PENDING_CLASSIFICATION
   op nul, of er gaat niets naar buiten.

   WAT DAT VANDAAG BETEKENT, EN DAT MOET ERBIJ STAAN. Er staan er 1594. Deze
   poort blokkeert dus vanaf nu ELKE release, en dat is geen bijwerking maar de
   bedoeling: onverklaarde mutaties zijn architectonisch verboden verklaard.

   HET RISICO DAT DAARBIJ HOORT, ook eerlijk. Een poort die maanden dichtstaat,
   wordt op een dag uitgezet -- en dan is hij erger dan geen poort, want iedereen
   heeft dan geleerd dat hij uit mag. Twee dingen houden dat tegen:

     - hij vertelt bij ELKE weigering hoeveel er nog staan, in welke vier bakken
       ze vallen en wat elke bak nodig heeft. Een poort die alleen "nee" zegt,
       is een muur; deze is een werklijst.
     - uitzetten kan alleen met RTG_MUTATIEPOORT_UIT=1 EN dan zegt hij hardop
       dat hij is overgeslagen, met het getal erbij. Stil passeren bestaat niet.

   Draaien:  node scripts/mutatiepoort.js
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'MUTATIECONTRACT.json');

let reg = null;
try { reg = JSON.parse(fs.readFileSync(REGISTER, 'utf8')); } catch (e) {
  console.error('\n  MUTATIEPOORT: MUTATIECONTRACT.json ontbreekt of is onleesbaar.');
  console.error('  Draai: node scripts/mutatiecontract.js --vastleggen\n');
  process.exit(1);
}

const totaal = reg.gemeten.totaal;
const open = reg.gemeten.perStand.LEGACY_PENDING_CLASSIFICATION || 0;
const mens = reg.gemeten.vastgesteldDoorMens || 0;
const script = reg.gemeten.afgeleidDoorScript || 0;

/* De vier bakken, met per bak wat hij nodig heeft. Ze worden hier AFGELEID en
   niet overgetypt: een lijst die naast het register leeft, loopt erop achter. */
const bakken = { besluit: 0, toegang: 0, tweedeLijn: 0, ongemeten: 0 };
for (const r of reg.rijen || []) {
  if (r.stand !== 'LEGACY_PENDING_CLASSIFICATION') continue;
  if (!r.bewijs) bakken.ongemeten++;
  else if (r.bewijs.zonderSleutel === 'onbeschermd') bakken.besluit++;
  else if (r.bewijs.hindernis && !r.toegang.waargenomen) bakken.toegang++;
  else bakken.tweedeLijn++;
}

console.log('\n=== DE MUTATIEPOORT ===\n');
console.log('  ' + String(totaal).padStart(5) + '  schrijfroutes');
console.log('  ' + String(mens).padStart(5) + '  vastgesteld door een mens');
console.log('  ' + String(script).padStart(5) + '  afgeleid (geblokkeerd, met reden)');
console.log('  ' + String(open).padStart(5) + '  ONVERKLAARD');

if (process.env.RTG_MUTATIEPOORT_UIT === '1') {
  console.log('\n  OVERGESLAGEN met RTG_MUTATIEPOORT_UIT=1, terwijl er ' + open + ' onverklaard zijn.');
  console.log('  Dat is een bewuste uitzondering en hoort in de releasenotitie te staan.\n');
  process.exit(0);
}

if (!open) {
  console.log('\n  POORT OPEN: elke schrijfroute heeft een contract.\n');
  process.exit(0);
}

console.log('\n  POORT DICHT. Wat er nog staat, en wat elke bak nodig heeft:\n');
console.log('  ' + String(bakken.tweedeLijn).padStart(5) + '  kandidaat-leesroutes -- wachten op de tweede bewijslijn');
console.log('         (de runtime-effectmeter in server/staatlog.js; zie MUTATIECONTRACT.md par. 5b)');
console.log('  ' + String(bakken.toegang).padStart(5) + '  hindernis wel, toegang niet af te leiden');
console.log('         (de resterende poorten in server/kern/handlerpoorten/lijst.js lezen)');
console.log('  ' + String(bakken.besluit).padStart(5) + '  de dubbeltik deed het werk OPNIEUW -- vraagt een MENSELIJK besluit');
console.log('         (dubbeltik of tweede handeling? geen meting beantwoordt dat)');
if (bakken.ongemeten) {
  console.log('  ' + String(bakken.ongemeten).padStart(5) + '  nooit gemeten en zonder contract');
  console.log('         (hoort nul te zijn -- zie test/mutatiecontract.test.js)');
}
console.log('\n  Werklijst: node scripts/mutatiecontract.js --open');
console.log('  Uitzetten kan met RTG_MUTATIEPOORT_UIT=1, en dan zegt deze poort dat hardop.\n');
process.exit(1);
