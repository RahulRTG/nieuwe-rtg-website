#!/usr/bin/env node
'use strict';

/* NACHTELIJKE KALIBRATIE VAN HET IMPACTMODEL

   De selectieve ronde voorspelt welke bewijzen niet geraakt zijn. De nachtelijke
   ronde voert desondanks alles uit en vergelijkt die voorspelling met de
   werkelijkheid. Groen bevestigt elke afzonderlijke uitsluitingsclaim. Rood
   zonder toetsniveau-attributie verlaagt ze allemaal naar nul: onbekend wordt
   nooit als vertrouwen opgeslagen. evidence-base.js zorgt er vervolgens voor
   dat ouder bewijs niet meer door een rode kalibratie heen kan worden gebruikt. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WORTEL = path.join(__dirname, '..');

function hash(waarde) {
  return crypto.createHash('sha256').update(JSON.stringify(waarde)).digest('hex');
}

function normaliseerResultaten(resultaten) {
  return Object.fromEntries(Object.entries(resultaten || {}).sort(([a], [b]) => a.localeCompare(b)));
}

function kalibreer(control, resultaten, opties) {
  const o = opties || {};
  const r = normaliseerResultaten(resultaten);
  const geldigControl = !!(control && control.formaat === 'rtg-evidence-control-v1' && control.controlHash);
  const rood = Object.entries(r).filter(([, stand]) => stand !== 'success');
  const bevestigd = geldigControl && control.kalibratie && control.kalibratie.vereist && rood.length === 0;
  const stand = bevestigd ? 'BEVESTIGD' : 'GEDEGRADEERD';
  const uitsluitingen = geldigControl ? (control.uitsluitingen || []).map((claim) => ({
    toets: claim.toets,
    claim: claim.claim,
    daarvoor: claim.vertrouwen,
    daarna: bevestigd ? claim.vertrouwen : 0,
    uitkomst: stand,
    reden: bevestigd ? 'volledige ronde bleef groen' : 'volledige ronde niet aantoonbaar groen'
  })) : [];
  const kanten = geldigControl ? (control.kanten || []).map((kant) => ({
    bron: kant.bron,
    doel: kant.doel,
    soort: kant.soort,
    daarvoor: kant.vertrouwen,
    daarna: bevestigd ? kant.vertrouwen : 0,
    uitkomst: stand
  })) : [];
  const kern = {
    formaat: 'rtg-evidence-calibration-v1',
    gemaakt: o.nu || new Date().toISOString(),
    controlHash: geldigControl ? control.controlHash : null,
    planHash: geldigControl ? control.plan.hash : null,
    commit: geldigControl ? control.commit : (o.commit || null),
    stand,
    volledig: geldigControl && !!control.kalibratie.vereist,
    resultaten: r,
    afwijkingen: rood.map(([naam, waarde]) => ({ naam, waarde })),
    vertrouwen: {
      uitsluitingen: uitsluitingen.length,
      bevestigd: uitsluitingen.filter((c) => c.daarna > 0).length,
      gedegradeerd: uitsluitingen.filter((c) => c.daarna === 0).length
    },
    uitsluitingen,
    kanten
  };
  return { ...kern, calibrationHash: hash(kern) };
}

function verifieren(rapport) {
  if (!rapport || rapport.formaat !== 'rtg-evidence-calibration-v1') throw new Error('onbekend kalibratierapport');
  const kern = { ...rapport }; delete kern.calibrationHash;
  if (rapport.calibrationHash !== hash(kern)) throw new Error('kalibratiehash klopt niet');
  if (!['BEVESTIGD', 'GEDEGRADEERD'].includes(rapport.stand)) throw new Error('onbekende kalibratiestand');
  if (rapport.stand === 'BEVESTIGD' && (!rapport.volledig || rapport.afwijkingen.length)) {
    throw new Error('bevestiging zonder volledige groene ronde');
  }
  return { geldig: true, stand: rapport.stand, hash: rapport.calibrationHash };
}

function vlag(args, naam, terugval) {
  const gevonden = args.find((a) => a.startsWith('--' + naam + '='));
  return gevonden ? gevonden.slice(naam.length + 3) : terugval;
}

function resultatenUit(args) {
  let uit = {};
  if (process.env.RTG_CALIBRATION_RESULTS) {
    const gelezen = JSON.parse(process.env.RTG_CALIBRATION_RESULTS);
    if (!gelezen || Array.isArray(gelezen) || typeof gelezen !== 'object') {
      throw new Error('RTG_CALIBRATION_RESULTS moet een object zijn');
    }
    uit = { ...gelezen };
  }
  for (const a of args.filter((x) => x.startsWith('--result='))) {
    const paar = a.slice(9);
    const i = paar.indexOf(':');
    if (i < 1 || !paar.slice(i + 1)) throw new Error('ongeldig resultaat: ' + paar);
    uit[paar.slice(0, i)] = paar.slice(i + 1);
  }
  return uit;
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const controlPad = path.resolve(WORTEL, vlag(args, 'control', '.evidence/control.json'));
    const out = path.resolve(WORTEL, vlag(args, 'out', 'EVIDENCE-CALIBRATION.json'));
    const control = fs.existsSync(controlPad) ? JSON.parse(fs.readFileSync(controlPad, 'utf8')) : null;
    const rapport = kalibreer(control, resultatenUit(args));
    verifieren(rapport);
    fs.writeFileSync(out, JSON.stringify(rapport, null, 2) + '\n');
    console.log('Evidence calibration ' + rapport.stand + ' ' + rapport.calibrationHash.slice(0, 16) +
      ': ' + rapport.vertrouwen.bevestigd + ' bevestigd, ' + rapport.vertrouwen.gedegradeerd + ' gedegradeerd');
  } catch (e) {
    console.error('[evidence-calibration] ' + e.message);
    process.exitCode = 1;
  }
}

module.exports = { hash, normaliseerResultaten, kalibreer, verifieren, resultatenUit };
