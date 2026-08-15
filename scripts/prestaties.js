#!/usr/bin/env node
/* Reproduceerbare microbenchmarks voor de zware Magnaat-paden. Alleen Node-std;
   de proef schrijft niets en gebruikt uitsluitend synthetische toestand. Draai
   met RTG_MOTOR_REKEN_URL + RTG_MAGNAAT_RUST=motor om ook de volledige
   JS->HTTP->Rust-keten mee te nemen. */
'use strict';
const { performance } = require('node:perf_hooks');
const crypto = require('node:crypto');
const functies = require('../server/functies');
const maakScanner = require('../server/kern/magnaat-capabilities');
const maakControle = require('../server/kern/magnaat-controle');
const maakEconomie = require('../server/kern/magnaat-economie');

const SNEL = process.argv.includes('--snel');

function percentiel(rijen, deel) {
  return rijen[Math.min(rijen.length - 1, Math.floor((rijen.length - 1) * deel))];
}

function resultaat(naam, tijden) {
  tijden.sort((a, b) => a - b);
  return {
    naam, rondes: tijden.length,
    p50Ms: Number(percentiel(tijden, .50).toFixed(3)),
    p95Ms: Number(percentiel(tijden, .95).toFixed(3)),
    p99Ms: Number(percentiel(tijden, .99).toFixed(3)),
    maxMs: Number(tijden[tijden.length - 1].toFixed(3))
  };
}

function meet(naam, rondes, werk) {
  const tijden = [];
  for (let i = 0; i < rondes; i += 1) {
    const begin = performance.now();
    werk(i);
    tijden.push(performance.now() - begin);
  }
  return resultaat(naam, tijden);
}

async function meetAsync(naam, rondes, werk) {
  const tijden = [];
  for (let i = 0; i < rondes; i += 1) {
    const begin = performance.now();
    await werk(i);
    tijden.push(performance.now() - begin);
  }
  return resultaat(naam, tijden);
}

function maakEconomieMotor(motorklant) {
  const wereld = {};
  return maakEconomie({ wereldState: () => wereld, save() {}, motorklant });
}

async function hoofd() {
  const scanner = maakScanner({ root: require('node:path').join(__dirname, '..'), functies });
  scanner.scan();
  const uit = [meet('capability-scan', SNEL ? 2 : 7, () => scanner.scan())];
  const graph = scanner.scan();
  const wereld = {};
  const controle = maakControle({ wereldState: () => wereld, getGraph: () => graph, crypto });
  const boardroom = { key: 'benchmark', boardroom: true, rol: 'Boardroom-regisseur' };
  const kantoor = { key: 'benchmark', kantoorId: 'klantenservice', rol: 'Klantenservice-medewerker' };
  for (let i = 0; i < 20; i += 1) {
    controle.overzicht(boardroom, { limiet: 40 });
    controle.overzicht(kantoor, { limiet: 40 });
  }
  const overzichtRondes = SNEL ? 100 : 1000;
  uit.push(meet('codecontrole-boardroom', overzichtRondes, i =>
    controle.overzicht(boardroom, { limiet: 40, pagina: i % 10 + 1, zoek: i % 2 ? 'api' : '' })));
  uit.push(meet('codecontrole-kantoor', overzichtRondes, i =>
    controle.overzicht(kantoor, { limiet: 40, pagina: i % 4 + 1, zoek: i % 2 ? 'reis' : '' })));

  const javascript = maakEconomieMotor({ aan: false });
  for (let i = 0; i < 20; i += 1) javascript.volgendeDag('benchmark', 'js-warm-' + i);
  uit.push(meet('magnaat-dag-javascript', SNEL ? 100 : 1000, i =>
    javascript.volgendeDag('benchmark', 'js-dag-' + i)));

  if (process.env.RTG_MOTOR_REKEN_URL && String(process.env.RTG_MAGNAAT_RUST).toLowerCase() === 'motor') {
    const rust = maakEconomieMotor();
    const eerste = await rust.volgendeDagAsync('benchmark', 'rust-warm');
    if (eerste.rekenmotor !== 'rust') throw new Error('Rust-benchmark viel terug op JavaScript.');
    uit.push(await meetAsync('magnaat-dag-rust-keten', SNEL ? 30 : 200, async i => {
      const dag = await rust.volgendeDagAsync('benchmark', 'rust-dag-' + i);
      if (dag.rekenmotor !== 'rust') throw new Error('Rust-benchmark viel terug op JavaScript.');
    }));
  }

  console.log(JSON.stringify({
    gemeten: new Date().toISOString(),
    node: process.version,
    platform: process.platform + '-' + process.arch,
    omvang: {
      controlepunten: graph.controlepunten.length,
      apiActies: graph.endpoints.length,
      apps: graph.apps.length,
      werkprocessen: graph.workflows.length
    },
    resultaten: uit
  }, null, 2));
}

hoofd().catch(fout => {
  console.error('[prestaties]', fout && fout.stack || fout);
  process.exitCode = 1;
});
