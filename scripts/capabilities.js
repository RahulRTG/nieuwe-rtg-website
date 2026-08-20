#!/usr/bin/env node
/* ============================================================================
   DE CALLER-METING -- wordt elke capability ergens gevraagd?

   CONTROLPLANE.md par. 6.1: "Meet per capability of er een caller is buiten de
   eigen module. Dat is precies de meting die de zes stille capabilities vond, en
   zij hoort automatisch te draaien in plaats van met de hand."

   Dit script is die hand die eruit gaat. De weging zelf zit in
   server/kern/commercie/handhaving.js; hier staat alleen wat er gelezen wordt.

   Draai: node scripts/capabilities.js              (het overzicht)
          node scripts/capabilities.js --controle   (zakt bij een stille capability)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const handhaving = require('../server/kern/commercie/handhaving');

const WORTEL = path.join(__dirname, '..');

/* server/ en test/ allebei, want het VERSCHIL tussen die twee is de hele
   meting: een capability die alleen in test/ voorkomt, ziet er gedekt uit en is
   het niet. */
function bestanden() {
  const uit = [];
  for (const map of ['server', 'test']) {
    (function loop(dir) {
      let namen = [];
      try { namen = fs.readdirSync(dir); } catch (e) { return; }
      for (const naam of namen) {
        const vol = path.join(dir, naam);
        let st;
        try { st = fs.statSync(vol); } catch (e) { continue; }
        if (st.isDirectory()) { if (naam !== 'data' && naam !== 'node_modules') loop(vol); continue; }
        if (!naam.endsWith('.js')) continue;
        uit.push({ pad: path.relative(WORTEL, vol), bron: fs.readFileSync(vol, 'utf8') });
      }
    })(path.join(WORTEL, map));
  }
  return uit;
}

function plek(p) { return p.pad + ':' + p.regel; }

function toon() {
  const r = handhaving.poort(bestanden());
  console.log('');
  console.log('DE CALLER-METING -- ' + r.aantal + ' capabilities');
  console.log('');
  for (const rij of r.rijen) {
    const merk = rij.stil ? 'STIL      ' : 'AFGEDWONGEN ';
    console.log(merk + rij.cap);
    console.log('            ' + rij.uitleg);
    console.log('            treden: ' + (rij.treden.join(', ') || '(geen)'));
    if (rij.poorten.length) console.log('            poort: ' + rij.poorten.map(plek).join(', '));
    if (rij.routes.length) {
      console.log('            routepoort: ' + rij.routes.map(x => x.pad).join(', '));
      const raakt = rij.routes[0].raakt || [];
      console.log('            ' + (raakt.length
        ? 'houdt vandaag tegen: zaken op ' + raakt.join(', ')
        : 'houdt vandaag niemand tegen: elke zakelijke trede bevat dit onderdeel'));
    }
    if (rij.beschrijvingen.length) console.log('            beschrijving: ' + rij.beschrijvingen.map(plek).join(', '));
    if (rij.overig.length) console.log('            overig: ' + rij.overig.map(plek).join(', '));
    if (rij.toetsen.length) console.log('            toetsen: ' + rij.toetsen.length);
    if (rij.vermeldingen.length) console.log('            alleen commentaar: ' + rij.vermeldingen.map(v => v.pad).join(', '));
    console.log('');
  }
  console.log(r.ok ? 'Elke capability heeft een caller.'
    : 'STIL: ' + r.stil.length + ' van ' + r.aantal + ' -- ' + r.stil.join(', '));
  return r;
}

const r = toon();
if (process.argv.includes('--controle') && !r.ok) {
  console.error('');
  for (const p of r.problemen) console.error('  - ' + p);
  process.exit(1);
}
