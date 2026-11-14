#!/usr/bin/env node
'use strict';

/* Vernieuw alleen bewijshelften die uit bestaande registers komen. De echte
   browserwaarneming (bereikbaar, bedienbaar en de schermhelft van menselijk)
   blijft ongewijzigd. Zo hoeft een nieuwe lieg-, bevoegdheids- of voltooiproef
   niet opnieuw 114 apps te openen wanneer hun eigen raakvlakken nog vers zijn. */
const fs = require('fs');
const path = require('path');
const B = require('./lib/bewijsbron');
const { BEWIJZEN, CONTRACT, ZONDER_APP } = require('./lib/appcontract');
const { eisSchoneBoom, magSchrijven } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'APPWERKT.json');

function eindstand(r) {
  const standen = Object.values(r.bewijzen || {}).map((b) => b.status);
  if (standen.includes('GEBLOKKEERD_DOOR_DEFECT')) return 'GEBLOKKEERD_DOOR_DEFECT';
  if (standen.includes('GEBLOKKEERD_DOOR_CONFIG')) return 'GEBLOKKEERD_DOOR_CONFIG';
  if (standen.includes('GEEN_FIXTURE')) return 'GEEN_FIXTURE';
  if (standen.includes('NIET_GETEST')) return 'NIET_GETEST';
  return standen.length === BEWIJZEN.length && standen.every((s) => s === 'BEWEZEN') ? 'BEWEZEN' : 'NIET_GETEST';
}

function tel(reg) {
  reg.telling = {};
  reg.perBewijs = {};
  for (const r of reg.regels || []) {
    reg.telling[r.status] = (reg.telling[r.status] || 0) + 1;
    for (const [naam, b] of Object.entries(r.bewijzen || {})) {
      reg.perBewijs[naam] = reg.perBewijs[naam] || {};
      reg.perBewijs[naam][b.status] = (reg.perBewijs[naam][b.status] || 0) + 1;
    }
  }
}

function samenstelling(reg) {
  const oud = reg.samenstelling || {};
  reg.samenstelling = {
    uitleg: oud.uitleg || 'Bewijshelften uit bestaande, verse registers worden per app samengesteld.',
    koppelingen: (reg.regels || []).filter((r) => (r.samengesteld || []).length).map((r) => ({
      app: r.app, functie: r.functie,
      bewijzen: Object.fromEntries(r.samengesteld.map((naam) => [naam, {
        status: r.bewijzen[naam].status,
        bron: r.bewijzen[naam].bron ? r.bewijzen[naam].bron.instrument : null,
        commit: r.bewijzen[naam].bewijs ? r.bewijzen[naam].bewijs.commit : null
      }]))
    })),
    contractZonderRij: Object.keys(CONTRACT).filter((f) => !(reg.regels || []).some((r) => r.functie === f)),
    ketensZonderApp: ZONDER_APP
  };
}

function vernieuw(reg, opties = {}) {
  const stelSamen = opties.stelSamen || B.stelSamen;
  for (const r of reg.regels || []) {
    r.samengesteld = stelSamen(r, opties.bewijsOpties || {});
    r.status = eindstand(r);
  }
  tel(reg);
  samenstelling(reg);
  return reg;
}

if (require.main === module) {
  const reg = vernieuw(JSON.parse(fs.readFileSync(DOEL, 'utf8')));
  if (magSchrijven(eisSchoneBoom('appwerkt-samenstellen'), DOEL)) {
    fs.writeFileSync(DOEL, JSON.stringify(reg, null, 1) + '\n');
  }
  console.log('APPWERKT samengesteld: ' + JSON.stringify(reg.telling) + '; per bewijs ' + JSON.stringify(reg.perBewijs));
}

module.exports = { eindstand, vernieuw };
