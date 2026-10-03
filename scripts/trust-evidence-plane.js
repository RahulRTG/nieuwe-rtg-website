#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const out = path.join(root, 'TRUST_EVIDENCE_PLANE.json');
const contracts = require('../server/kern/bewijsvlak/contracts');
const sloProfiles = require('../server/kern/bewijsvlak/slo-profiles');
const { INVARIANTS } = require('../server/kern/bewijsvlak/constitution');
const { STAPPEN } = require('../server/kern/bewijsvlak/hospitality-chain');
const v3Profiles = require('../server/kern/bewijsvlak/v3-profiles');
const v3Authorities = require('../server/kern/bewijsvlak/v3-authorities');
const v3Contract = require('../server/kern/bewijsvlak/v3-contract');

const files = ['canon.js', 'context.js', 'contract.js', 'ledger.js', 'claims.js',
  'capabilities.js', 'compatibility.js', 'retry.js', 'transport.js', 'migration.js',
  'provenance.js', 'constitution.js', 'slo-profiles.js', 'metrics-slo.js', 'metrics.js', 'plane.js',
  'runtime.js', 'hospitality-chain.js', 'v3-contract.js', 'v3-store.js', 'v3-authority-contracts.js',
  'v3-authorities.js', 'v3-profiles.js',
  'v3-resolver.js', 'v3-decisions.js', 'v3-reconciliation.js', 'v3-pilots.js', 'v3-plane.js',
  'v3-money-hook.js', 'v3-external-hook.js', 'v3-authority-hook.js'];
const digest = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

function report() {
  const base = path.join(root, 'server', 'kern', 'bewijsvlak');
  return {
    format: 'rtg-trust-evidence-plane-v3', mode: 'shadow',
    promise: 'evidence coordinates domains; domains retain meaning and ownership',
    universalProtocol: v3Contract.PROTOCOL,
    truthClasses: v3Contract.TRUTH,
    finality: v3Contract.FINALITY,
    correlationChain: STAPPEN.map(x => x[0]),
    capabilities: contracts.map(c => ({ id: c.id, version: c.version, owner: c.owner,
      phase: c.phase, risk: c.risk.tier, sloProfile: c.slo.profile, implemented: c.implemented })),
    sloProfiles: Object.values(sloProfiles.PROFILES).map(p => ({ id: p.id, version: p.version,
      availabilityTarget: p.availabilityTarget, windowDays: p.windowDays,
      minimumSamples: p.minimumSamples, minimumCoverage: p.minimumCoverage,
      freshnessMinutes: p.freshnessMinutes, latency: p.latency })),
    constitution: INVARIANTS,
    requirementProfiles: v3Profiles.BUILTIN.map(p => ({ id: p.id, version: p.version,
      claimType: p.claimType, requirements: p.requirements.map(r => r.id), completeFinality: p.completeFinality })),
    authorityContracts: v3Authorities.BUILTIN.map(a => ({ id: a.id, version: a.version,
      signer: a.signer, factTypes: a.factTypes })),
    integration: {
      allHttpRequests: 'server/opzet/verzoekketen.js', allBusEvents: 'server/kern/envelop.js',
      experienceBroker: 'server/kern/experience/broker.js', hospitalityBooking: 'server/kern/ervaring/tafels.js',
      hospitalityFulfillment: 'server/kern/ervaring/tafelplanning.js', connectionPayment: 'server/kern/vonk/payment.js',
      hospitalityOutcome: 'server/kern/ervaring/leden/waardering.js', commandSlo: 'server/kern/command/slo.js',
      moneyIntegrity: 'server/kern/betaalwaarheid/index.js',
      externalDependencyIntegrity: 'server/kern/vonk/payment.js',
      authorityRevocationIntegrity: 'server/kern/connection-communication.js'
    },
    proof: { command: 'npm run trust:proof', tests: ['test/trust-evidence-plane.test.js',
      'test/trust-evidence-plane-v3.test.js'],
      status: 'EXECUTED_BY_TEST_RUNNER' },
    modules: Object.fromEntries(files.map(f => [f, digest(path.join(base, f))]))
  };
}

const tekst = JSON.stringify(report(), null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== tekst) {
    console.error('TRUST_EVIDENCE_PLANE.json is verouderd; draai npm run trust:manifest');
    process.exitCode = 1;
  } else console.log('Trust & Evidence Plane-manifest klopt.');
} else {
  fs.writeFileSync(out, tekst);
  console.log('TRUST_EVIDENCE_PLANE.json bijgewerkt.');
}

module.exports = { report };
