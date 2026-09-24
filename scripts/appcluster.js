#!/usr/bin/env node
/* ============================================================================
   npm run appcluster -- de rode cellen van APPWERKT.json, per oorzaak.

   Leest het register en schrijft niets. Per stand (defect, omgeving, niet
   getest, geen fixture) en per bewijs staan de kandidaat-oorzaken onder
   elkaar, met hoeveel apps ze raken, een paar namen en een ongewijzigd
   voorbeeld. De indeling en haar grenzen staan in ./lib/appcluster.js.

   node scripts/appcluster.js                   alles
   node scripts/appcluster.js --stand=NIET_GETEST   een stand
   node scripts/appcluster.js --register=pad.json   een ander register
   ========================================================================== */
'use strict';
if (require.main !== module) return;
const fs = require('fs');
const path = require('path');
const { cluster, STANDEN } = require('./lib/appcluster');

const arg = (n) => (process.argv.find((a) => a.startsWith('--' + n + '=')) || '').slice(n.length + 3);
const bron = arg('register') || path.join(__dirname, '..', 'APPWERKT.json');
const alleen = arg('stand');

const reg = JSON.parse(fs.readFileSync(bron, 'utf8'));
const c = cluster(reg);
const st = reg.stempel || {};
console.log('\n  ' + path.basename(bron) + ' -- gemeten ' + (st.op || '?') + ' op ' + (st.commit || '?') +
  ', ' + (reg.regels || []).length + ' onderdelen');
for (const stand of STANDEN) {
  if (alleen && stand !== alleen) continue;
  const lijst = c[stand] || [];
  console.log('\n  ' + stand + ' -- ' + lijst.length + ' kandidaat-oorzaak/-oorzaken');
  for (const x of lijst) {
    console.log('    ' + String(x.apps.length).padStart(3) + '  ' + x.bewijs.padEnd(17) + x.oorzaak.slice(0, 150));
    console.log('         ' + x.apps.slice(0, 6).join(', ') + (x.apps.length > 6 ? ' en ' + (x.apps.length - 6) + ' meer' : ''));
  }
}
console.log('\n  Een oorzaak is een KANDIDAAT: gelijk na normalisatie, niet bewezen gelijk opgelost. Standen worden nooit opgeteld.\n');
