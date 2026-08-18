#!/usr/bin/env node
/* ============================================================================
   DE IDEM-SCHULD -- welke schrijfroute heeft nog niet verklaard wat "hetzelfde
   verzoek" voor hem betekent.

   WAAROM DIT ER IS. De idemproef vond 94 routes waar een herhaling het werk nog
   een keer deed. Die 94 zijn te repareren, en dan is het gevoel: opgelost. Maar
   er zijn 3650 schrijfroutes, en de proef bereikte er 106. De andere 3544 zijn
   niet veilig maar ONBEKEND -- en een onbekende die niemand telt, leest na
   verloop van tijd als groen.

   Dit script telt ze. Elke schrijfroute zonder verklaring in
   server/lib/idemsleutels.js staat op de schuldlijst, en die lijst wordt
   vastgelegd in IDEMSCHULD.json met een getal dat ALLEEN MAG KRIMPEN --
   dezelfde vorm als POORTWACHT (0 routes open) en BEREIK.json (0 schermen
   zonder route). Zo kan een nieuwe route er niet stil bij komen: wie er een
   toevoegt zonder verklaring, laat de keuring zakken.

   WAT DIT NIET IS. Geen meting of de idempotentie WERKT -- dat doet
   scripts/idemproef-route.js op het antwoord en scripts/staatproef-route.js op
   de toestand. Dit telt alleen of er een BESLUIT is genomen. Een route met
   `nietIdempotent: true` staat niet in de schuld: er is over nagedacht, en dat
   is precies wat hier geteld wordt.

   Draaien: node scripts/idemschuld.js [--vastleggen]
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { alleRoutes } = require('./lib/routes');
const { SLEUTELS } = require('../server/lib/idemsleutels');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'IDEMSCHULD.json');
const vastleggen = process.argv.includes('--vastleggen');

/* Wat telt als schrijfroute. GET valt af (lezen is al idempotent), en zo ook de
   paden die geen API zijn. */
const routes = alleRoutes()
  .filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET')
  .map(r => ({ methode: r.methode, pad: r.pad }));

const verklaard = [];
const schuld = [];
for (const r of routes) {
  const sleutel = r.methode.toUpperCase() + ' ' + r.pad;
  if (SLEUTELS[sleutel]) verklaard.push(sleutel); else schuld.push(sleutel);
}

/* Een verklaring voor een route die niet meer bestaat is geen dekking maar
   rommel, en die hoort op te vallen: hij houdt het schuldgetal kunstmatig laag. */
const bekend = new Set(routes.map(r => r.methode.toUpperCase() + ' ' + r.pad));
const wees = Object.keys(SLEUTELS).filter(s => !bekend.has(s));

const uit = {
  uitleg: 'Schrijfroutes zonder verklaring in server/lib/idemsleutels.js. MAG ALLEEN KRIMPEN -- ' +
    'zie test/idemschuld.test.js. Een route met nietIdempotent staat NIET in de schuld: daar is over ' +
    'nagedacht. Dit telt of er een besluit is, niet of de idempotentie werkt (dat doet de idemproef).',
  gemeten: {
    schrijfroutes: routes.length,
    verklaard: verklaard.length,
    schuld: schuld.length,
    weesverklaringen: wees.length
  },
  weesverklaringen: wees,
  schuld: schuld.sort()
};

console.log('\n=== DE IDEM-SCHULD ===\n');
console.log('  schrijfroutes            : ' + routes.length);
console.log('  verklaard                : ' + verklaard.length);
console.log('  nog te verklaren         : ' + schuld.length);
console.log('  verklaringen zonder route: ' + wees.length);
for (const w of wees) console.log('      ' + w);

if (vastleggen) {
  fs.writeFileSync(UITSLAG, JSON.stringify(uit, null, 1) + '\n');
  console.log('\n  vastgelegd in IDEMSCHULD.json');
} else if (fs.existsSync(UITSLAG)) {
  const oud = JSON.parse(fs.readFileSync(UITSLAG, 'utf8'));
  const was = oud.gemeten.schuld;
  console.log('\n  vastgelegd stond op      : ' + was);
  if (schuld.length > was) {
    console.error('\n  DE SCHULD IS GEGROEID (' + was + ' -> ' + schuld.length + ').');
    console.error('  Nieuw zonder verklaring:');
    for (const s of schuld.filter(x => !(oud.schuld || []).includes(x))) console.error('      ' + s);
    process.exit(1);
  }
  if (wees.length) { console.error('\n  er staan verklaringen voor routes die niet bestaan'); process.exit(1); }
  console.log('  krimp                    : ' + (was - schuld.length));
}
