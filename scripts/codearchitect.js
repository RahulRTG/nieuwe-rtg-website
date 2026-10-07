#!/usr/bin/env node
/* ============================================================================
   DE ARCHITECT -- vier commando's, alleen lezend (ARCHITECTOPDRACHT.md fase 4)

     npm run codearchitect -- map
     npm run codearchitect -- explain <route | bestand | domein | wet-ID | symbool>
     npm run codearchitect -- impact <bestand> [<bestand> ...]
     npm run codearchitect -- unknowns [scope]

   Met --json krijgt een agent dezelfde regels als data. Elke regel draagt een
   waarde, graad, versheid, tegenspraak en herkomst (register + pad); een leeg
   vak draagt zijn reden. Dit script schrijft nergens heen.

   De naam is codearchitect en niet rtg of architect: `rtg` is het gereedschap
   voor App Store-ontwikkelaars (scripts/rtg.js), en `architect` is een domein
   (server/kern/architect).
   ========================================================================== */
'use strict';
const A = require('./lib/codearchitect');

const args = process.argv.slice(2);
const json = args.includes('--json');
const rest = args.filter((a) => a !== '--json');
const [opdracht, ...onderwerp] = rest;
const lezer = A.maakLezer();

const assen = (r) => '[' + r.graad + ' · ' + r.versheid + ' · ' + r.tegenspraak + ']';
const toon = (w) => (w == null ? '—' : Array.isArray(w) ? (w.length ? w.length + ': ' + w.slice(0, 6).join(', ') + (w.length > 6 ? ', …' : '') : 'geen') : typeof w === 'object' ? JSON.stringify(w) : String(w));
function drukRegels(regels) {
  for (const r of regels) {
    console.log('  ' + r.veld.padEnd(30) + ' ' + toon(r.waarde));
    console.log('  ' + ''.padEnd(30) + ' ' + assen(r) + '  ← ' + r.herkomst.register + (r.herkomst.pad ? ' ' + r.herkomst.pad : ''));
    if (r.reden) console.log('  ' + ''.padEnd(30) + ' waarom leeg: ' + r.reden);
    if (r.toelichting) console.log('  ' + ''.padEnd(30) + ' ' + r.toelichting);
  }
}

function main() {
  if (opdracht === 'map') {
    const k = A.kaart(lezer);
    if (json) return console.log(JSON.stringify(k, null, 1)), 0;
    console.log('\nDe structuur staat in ' + k.structuur + '. De Architect leest uit:\n');
    for (const b of k.bronnen) console.log('  ' + b.register.padEnd(20) + ' graad ' + b.graad.padEnd(8) + ' versheid ' + b.versheid + (b.versheid !== 'actueel' ? ' — ' + b.reden : ''));
    console.log('');
    drukRegels(k.omvang);
    return 0;
  }
  if (opdracht === 'explain') {
    const u = A.uitleg(lezer, onderwerp.join(' '));
    if (json) return console.log(JSON.stringify(u, null, 1)), u.gevonden ? 0 : 1;
    if (!u.gevonden) {
      console.log('\n' + u.reden);
      for (const k of u.kandidaten) console.log('  ' + k.soort.padEnd(8) + ' ' + k.id);
      return 1;
    }
    console.log('\n' + u.soort + ': ' + u.id + '\n');
    drukRegels(u.regels);
    console.log('\n  assen: [graad · versheid · tegenspraak]. Doel en invarianten staan in de documenten; die zijn een bewering, geen meting.');
    return 0;
  }
  if (opdracht === 'impact') {
    if (!onderwerp.length) { console.error('noem een of meer bestanden'); return 2; }
    const i = A.impact(lezer, onderwerp);
    if (json) return console.log(JSON.stringify(i, null, 1)), 0;
    console.log('\nSTATISCH');
    drukRegels(i.statisch);
    console.log('\nWAARGENOMEN');
    drukRegels(i.waargenomen);
    console.log('\nKENNISGATEN');
    for (const g of i.kennisgaten) console.log('  - ' + g);
    console.log('\nTOETSREDUCTIE: niet toegestaan — ' + i.toetsreductie.reden);
    console.log('  (de drie blokken worden nooit opgeteld)');
    return 0;
  }
  if (opdracht === 'unknowns') {
    const o = A.onbekenden(lezer, onderwerp[0]);
    if (json) return console.log(JSON.stringify(o, null, 1)), 0;
    console.log('\nWAAR DE KENNIS OVER RTG OPHOUDT' + (onderwerp[0] ? ' (scope: ' + onderwerp[0] + ')' : '') + '\n');
    console.log('  1. graad onbekend: ' + o.graadOnbekend.ontbrekendeBronnen.length + ' verwachte bron(nen) ontbreken');
    for (const b of o.graadOnbekend.ontbrekendeBronnen) console.log('       ' + b.register + ' — ' + b.reden);
    console.log('  2. versheid: ' + o.versheid.actueel.length + ' actueel, ' + o.versheid['mogelijk-verouderd'].length + ' mogelijk-verouderd, ' + o.versheid.onbekend.length + ' onbekend');
    for (const x of o.versheid['mogelijk-verouderd']) console.log('       mogelijk-verouderd  ' + x.register + ' — ' + x.reden);
    console.log('  3. tegenspraak:');
    for (const t of o.tegenspraak) console.log('       ' + t.register + ' ' + t.pad + ': ' + t.aantal + (t.ook ? ' (en ' + JSON.stringify(t.ook) + ')' : ''));
    const s = o.verklaardeSchuld;
    console.log('  4. verklaarde schuld (BEWIJSSCHULD.json): ' + (Array.isArray(s) ? s.length + ' post(en)' : s.reden));
    if (Array.isArray(s)) for (const p of s.slice(0, 12)) console.log('       ' + String(p.id).padEnd(28) + ' ' + (p.aantal == null ? '' : p.aantal + '  ') + String(p.wat).slice(0, 80));
    console.log('\n  Vier bakken die vier dingen meten; er is met opzet geen totaal.');
    return 0;
  }
  console.error('gebruik: codearchitect map | explain <ding> | impact <bestand...> | unknowns [scope]  [--json]');
  return 2;
}

process.exitCode = main();
