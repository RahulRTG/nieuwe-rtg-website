#!/usr/bin/env node
'use strict';

/* RTG EVIDENCE CONTROL PLANE

   GitHub voert uit; dit contract beslist en legt uit. Het bindt de wijziging,
   impactclaims, onzekerheid, bewijsselectie en uitsluitingsgronden aan één hash.
   Een REUSED-toets zonder expliciete negatieve claim is ongeldig: minder werk
   mag alleen omdat RTG kan uitleggen waarom dat werk niet geraakt is. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');

function hash(waarde) {
  return crypto.createHash('sha256').update(typeof waarde === 'string'
    ? waarde : JSON.stringify(waarde)).digest('hex');
}

function commit() {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: WORTEL, encoding: 'utf8' }).trim(); }
  catch (e) { return null; }
}

function score(via) {
  if (via === 'zeker') return 1;
  if (via === 'mogelijk') return 0.5;
  return 0;
}

function bouwen(plan, opties) {
  const o = opties || {};
  if (!plan || plan.formaat !== 'rtg-evidence-plan-v2') throw new Error('onbekend of ontbrekend bewijsplan');
  if (!Array.isArray(plan.toetsen) || !Array.isArray(plan.impactClaims)) {
    throw new Error('bewijsplan mist toetsen of impactclaims');
  }
  const kanten = plan.impactClaims.map((c) => ({
    doel: c.pad, bron: c.van || null, soort: c.kant || c.via || 'onbekend',
    vertrouwen: Number.isFinite(c.vertrouwen) ? c.vertrouwen : score(c.via),
    afstand: c.afstand, grond: c.reden
  }));
  const uitsluitingen = plan.toetsen.filter((t) => t.status === 'REUSED').map((t) => ({
    toets: t.toets,
    claim: 'niet-geraakt',
    vertrouwen: plan.betrouwbaar === false || t.onbegrensd ? 0 : 1,
    grond: t.reden,
    bewijsSleutel: t.bewijsSleutel,
    invoerHash: t.invoerHash,
    omgeving: t.omgeving
  }));
  const onzeker = kanten.filter((k) => k.vertrouwen < 1);
  const kern = {
    formaat: 'rtg-evidence-control-v1',
    commit: o.commit || commit(),
    gemaakt: o.nu || new Date().toISOString(),
    plan: { hash: hash(plan), snapshot: plan.snapshot.rootHash, basis: plan.basis,
      mode: plan.mode, baan: plan.baan, besluit: plan.besluit },
    wijziging: plan.gewijzigd,
    vertrouwen: {
      model: 'resolved=1; approximated=0.5; unresolved=0',
      betrouwbaar: plan.betrouwbaar !== false,
      kanten: kanten.length,
      onzeker: onzeker.length,
      minimum: kanten.length ? Math.min(...kanten.map((k) => k.vertrouwen)) : 1
    },
    kanten,
    uitsluitingen,
    uitvoering: {
      vereist: plan.toetsen.filter((t) => t.status !== 'REUSED').map((t) => t.toets),
      hergebruikt: uitsluitingen.map((u) => u.toets),
      telling: plan.telling
    },
    kalibratie: {
      vereist: !!plan.gedwongenVolledig,
      voorspelling: plan.toetsen.map((t) => ({ toets: t.toets, status: t.status })),
      stand: plan.gedwongenVolledig ? 'WORDT_GEMETEN' : 'NIET_DEZE_RONDE'
    }
  };
  return { ...kern, controlHash: hash(kern) };
}

function verifieren(control, plan) {
  if (!control || control.formaat !== 'rtg-evidence-control-v1') throw new Error('onbekend control-plane-contract');
  if (control.plan.hash !== hash(plan)) throw new Error('control plane hoort niet bij dit bewijsplan');
  const kern = { ...control }; delete kern.controlHash;
  if (control.controlHash !== hash(kern)) throw new Error('control-plane-hash klopt niet');
  const claims = new Set((control.uitsluitingen || []).map((u) => u.toets));
  const zonder = plan.toetsen.filter((t) => t.status === 'REUSED' && !claims.has(t.toets));
  if (zonder.length) throw new Error('REUSED zonder uitsluitingsgrond: ' + zonder.slice(0, 3).map((t) => t.toets).join(', '));
  if (plan.mode === 'incremental' && plan.betrouwbaar === false) throw new Error('onbetrouwbaar plan mag niet incrementeel');
  return { geldig: true, hash: control.controlHash, uitsluitingen: claims.size };
}

function leesVlag(args, naam, terugval) {
  const v = args.find((a) => a.startsWith('--' + naam + '='));
  return v ? v.slice(naam.length + 3) : terugval;
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const opdracht = args[0] || 'build';
    const planPad = path.resolve(WORTEL, leesVlag(args, 'plan', '.evidence/plan.json'));
    const out = path.resolve(WORTEL, leesVlag(args, 'out', '.evidence/control.json'));
    const plan = JSON.parse(fs.readFileSync(planPad, 'utf8'));
    if (opdracht === 'build') {
      const control = bouwen(plan);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, JSON.stringify(control, null, 2) + '\n');
      console.log('Evidence Control Plane ' + control.controlHash.slice(0, 16) + ': ' +
        control.uitvoering.vereist.length + ' uitvoeren, ' + control.uitsluitingen.length + ' onderbouwd hergebruiken');
    } else if (opdracht === 'verify') {
      const control = JSON.parse(fs.readFileSync(out, 'utf8'));
      console.log(JSON.stringify(verifieren(control, plan)));
    } else throw new Error('onbekende opdracht: ' + opdracht);
  } catch (e) {
    console.error('[evidence-control] ' + e.message);
    process.exitCode = 1;
  }
}

module.exports = { hash, score, bouwen, verifieren };
