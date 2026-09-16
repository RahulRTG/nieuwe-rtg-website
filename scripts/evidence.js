#!/usr/bin/env node
'use strict';

/* De uitvoerder van een bewijsplan. Hij beslist niets: scripts/plan.js levert
   het besluit, deze laag voert REPROVE uit en weigert UNKNOWN te versmallen. */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const planner = require('./plan');
const bewijsboek = require('./lib/bewijsboek');

const WORTEL = path.join(__dirname, '..');

function leesPlan(pad) {
  const plan = JSON.parse(fs.readFileSync(pad, 'utf8'));
  if (plan.formaat !== 'rtg-evidence-plan-v2' || !Array.isArray(plan.toetsen)) {
    throw new Error('geen geldig rtg-evidence-plan-v2: ' + pad);
  }
  return plan;
}

function selectie(plan) {
  const volledig = plan.mode === 'full';
  const gekozen = volledig ? plan.toetsen : plan.toetsen.filter((t) => t.status !== 'REUSED');
  return {
    volledig,
    unit: gekozen.filter((t) => t.toets.endsWith('.test.js')).map((t) => path.basename(t.toets)),
    e2e: gekozen.filter((t) => t.toets.endsWith('.e2e.js')).map((t) => path.basename(t.toets)),
    reused: plan.toetsen.filter((t) => t.status === 'REUSED').length
  };
}

function draai(script, args, env) {
  const r = spawnSync(process.execPath, [path.join(__dirname, script), ...args], {
    cwd: WORTEL, stdio: 'inherit', env: { ...process.env, ...env }
  });
  if (r.error) throw r.error;
  return r.status == null ? 2 : r.status;
}

function voerUit(plan, opties) {
  const o = opties || {};
  const s = selectie(plan);
  if (o.droog) return { ...s, code: 0 };
  let code = 0;
  if (s.unit.length) {
    const args = s.volledig ? [] : ['--bestanden=' + s.unit.join(',')];
    code = draai('test-runner.js', args, { RTG_EVIDENCE_MODE: s.volledig ? 'full' : 'incremental' });
  }
  if (code === 0 && s.e2e.length) {
    const args = s.volledig ? [] : ['--bestanden=' + s.e2e.join(',')];
    code = draai('e2e.js', args, { RTG_EVIDENCE_MODE: s.volledig ? 'full' : 'incremental' });
  }
  return { ...s, code };
}

function tijdlijn(plan, resultaat) {
  return [
    'snapshot ' + plan.snapshot.bestanden + ' bestanden in ' + plan.snapshot.duurMs + 'ms',
    plan.telling.REUSED + ' bewijzen hergebruikt',
    plan.telling.REPROVE + ' bewijzen opnieuw nodig',
    plan.telling.UNKNOWN + ' onbekend' + (plan.telling.UNKNOWN ? ' → volledige ronde' : ''),
    resultaat.unit.length + ' unitbestanden · ' + resultaat.e2e.length + ' browserbestanden geselecteerd'
  ];
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const opdracht = args[0] || 'run';
  try {
    if (opdracht === 'plan') {
      const out = (args.find((a) => a.startsWith('--out=')) || '--out=.evidence/plan.json').slice(6);
      const p = planner.plan(); planner.schrijfUitvoer(p, out);
      const serial = planner.serialiseer(p);
      const gekozen = selectie(serial);
      if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT,
          'mode=' + serial.mode + '\nreused=' + serial.telling.REUSED +
          '\nreprove=' + serial.telling.REPROVE + '\nunknown=' + serial.telling.UNKNOWN +
          '\nunit=' + gekozen.unit.length + '\ne2e=' + gekozen.e2e.length + '\n');
      }
      console.log(tijdlijn(serial, gekozen).join('\n'));
    } else if (opdracht === 'install') {
      const bron = (args.find((a) => a.startsWith('--from=')) || '').slice(7);
      if (!bron || !fs.existsSync(bron)) throw new Error('bewijsboek ontbreekt: ' + bron);
      const boek = JSON.parse(fs.readFileSync(bron, 'utf8'));
      if (boek.versie < 2 || !boek.integriteit) throw new Error('bewijsboek heeft geen v2-integriteit');
      if (boek.integriteit !== bewijsboek.boekHash(boek)) throw new Error('bewijsboekintegriteit klopt niet');
      fs.copyFileSync(bron, path.join(WORTEL, 'BEWIJSBOEK.json'));
      console.log('bewijsboek geïnstalleerd uit ' + bron);
    } else if (opdracht === 'record') {
      const r = planner.vastleggen({ vertrouwd: args.includes('--trusted') });
      console.log(JSON.stringify(r, null, 2));
    } else if (opdracht === 'run') {
      const pad = (args.find((a) => a.startsWith('--plan=')) || '--plan=.evidence/plan.json').slice(7);
      const plan = leesPlan(pad);
      const resultaat = voerUit(plan, { droog: args.includes('--dry-run') });
      console.log(tijdlijn(plan, resultaat).join('\n'));
      process.exitCode = resultaat.code;
    } else throw new Error('onbekende opdracht: ' + opdracht + ' (plan, install, run of record)');
  } catch (e) {
    console.error('[evidence] ' + e.message);
    process.exitCode = 1;
  }
}

module.exports = { leesPlan, selectie, voerUit, tijdlijn };
