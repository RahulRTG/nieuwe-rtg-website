#!/usr/bin/env node
/* ============================================================================
   EEN WERELD OPBOUWEN, EN ZIEN OF HIJ ER STAAT.

   node scripts/wereld.js horeca school     bouwt die twee op een wegwerpserver
   node scripts/wereld.js --alles           bouwt elke wereld uit het register
   node scripts/wereld.js --plan horeca     toont alleen het plan, zonder server

   Het register en de volgorde staan in ./lib/wereldcompositor.js. Dit script
   meet niets en schrijft geen register: het zegt per wereld klaar of niet, met
   de reden, en daarna of de wereld NA afloop nog staat (./lib/wereldcontrole.js).
   Een wereld die niet klaar komt laat het script zakken -- een opbouw die "bijna"
   lukte is voor wie hem gebruikt een wereld die er niet is.

   Waarom geen register: welke wereld opkomt hangt af van de code van vandaag,
   en de plek waar dat bewijs hoort is de proef die de wereld GEBRUIKT (de
   bewijsbron van APPWERKT.json, BETROUWBAARHEID.md par. 4a). Een los register
   ernaast zou een tweede waarheid over dezelfde opbouw zijn.
   ========================================================================== */
'use strict';
if (require.main !== module) return;

const { WERELDEN, plan, bouw } = require('./lib/wereldcompositor');

const args = process.argv.slice(2);
const alleenPlan = args.includes('--plan');
const namen = args.includes('--alles') ? Object.keys(WERELDEN) : args.filter((a) => !a.startsWith('--'));

(async () => {
  if (!namen.length) {
    console.error('Noem een of meer werelden, of --alles. Bekend: ' + Object.keys(WERELDEN).join(', '));
    process.exit(2);
  }
  let p;
  try { p = plan(namen); } catch (e) { console.error(e.message); process.exit(2); }
  console.log('\n  plan      : ' + p.werelden.join(' -> '));
  console.log('  fundering : ' + (p.fundering.join(', ') || 'geen'));
  if (p.families.length) console.log('  families  : ' + p.families.join(', '));
  if (alleenPlan) process.exit(0);

  const w = await bouw(namen);
  let zakt = false;
  console.log('');
  for (const [naam, f] of Object.entries(w.fundering)) {
    console.log('  ' + (f.klaar ? '✓' : '✗') + ' fundering ' + naam.padEnd(11) + (f.reden || ''));
  }
  for (const n of p.werelden) {
    const r = w.werelden[n] || { klaar: false, reden: 'niet gebouwd' };
    if (!r.klaar) zakt = true;
    console.log('  ' + (r.klaar ? '✓' : '✗') + ' wereld    ' + n.padEnd(11) + (r.klaar ? 'klaar' : r.reden || ''));
    if (!r.klaar && Array.isArray(r.stappen)) {
      for (const s of r.stappen.filter((x) => !x.ok).slice(0, 3)) {
        console.log('      ' + s.naam + ': ' + s.status + ' ' + (s.waarom || ''));
      }
    }
  }
  try {
    const c = await w.controleer();
    if (c && Array.isArray(c.gecontroleerd) && !c.gecontroleerd.length) console.log('\n  controle na afloop: ' + c.reden);
    else console.log('\n  controle na afloop: ' + JSON.stringify(c).slice(0, 400));
  } catch (e) { console.log('\n  controle na afloop liep vast: ' + e.message); zakt = true; }
  w.klaar();
  console.log('');
  process.exit(zakt ? 1 : 0);
})();
