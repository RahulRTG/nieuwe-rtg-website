#!/usr/bin/env node
'use strict';

/* Genereert bewijs uit de werkelijke tests en machineleesbare contracten. Een
   rood testproces schrijft geen groen bewijsbestand. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const policy = require('../server/kern/connection-policy');
const projection = require('../server/kern/connection-projection');

const ROOT = path.resolve(__dirname, '..');
const TESTS = [
  'test/vonk.test.js',
  'test/rendezvous.test.js',
  'test/connection-constitution.test.js',
  'test/connection-cross-product.test.js',
  'test/connection-projection.test.js'
];
const BRONNEN = [
  'scripts/connection-constitution.js',
  'server/kern/connection-policy.json',
  'server/kern/connection-policy.js',
  'server/kern/connection-blocking.js',
  'server/kern/connection-consent.js',
  'server/kern/connection-projection.js',
  'server/kern/rendezvous.js',
  'server/kern/rendezvous-acties.js',
  'server/kern/rendezvous-arrange.js',
  'server/kern/rendezvous-date.js',
  'server/kern/rendezvous-kring.js',
  'server/kern/rendezvous-ontdek.js',
  'server/kern/rendezvous-samen.js',
  'server/kern/rendezvous-tafels.js',
  'server/kern/vonk/index.js',
  'server/kern/vonk/kiezen.js',
  'server/kern/vonk/match.js',
  'server/kern/vonk/selectie.js',
  'server/opzet/kernlaag4.js',
  'server/opzet/kernlaag7.js',
  'server/routes/connection-policy.js',
  'server/routes/member/rendezvous.js',
  'server/routes/office/rendezvous.js',
  'server/routes/vonk.js',
  ...TESTS
];

const tekst = bestand => fs.readFileSync(path.join(ROOT, bestand), 'utf8');
const telTests = bestand => (tekst(bestand).match(/^test\(/gm) || []).length;

const ronde = spawnSync(process.execPath, ['--test', ...TESTS], {
  cwd: ROOT, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }, maxBuffer: 20 * 1024 * 1024
});
process.stdout.write(ronde.stdout || '');
process.stderr.write(ronde.stderr || '');
if (ronde.status !== 0) process.exit(ronde.status || 1);

const productTests = telTests('test/vonk.test.js') + telTests('test/rendezvous.test.js');
const constitutionCore = telTests('test/connection-constitution.test.js') + telTests('test/connection-cross-product.test.js');
const projectionSource = tekst('test/connection-projection.test.js');
const ronde2Tests = telTests('test/connection-projection.test.js');
const consentTests = (projectionSource.match(/^test\('(consent|revoke|een actieve toestemming|wederzijdse toestemming)/gm) || []).length;
const projectionTests = ronde2Tests - consentTests;
const matrix = policy.matrix();
const names = Object.values(projection.NAMES);
const alleTestnamen = TESTS.map(tekst).join('\n');
const heeft = zin => alleTestnamen.includes("test('" + zin);
const hash = crypto.createHash('sha256');
for (const bestand of BRONNEN) hash.update(bestand).update('\0').update(tekst(bestand)).update('\0');

const bewijs = {
  schema: 'RTG_CONNECTION_CONSTITUTION',
  version: 2,
  source_sha256: hash.digest('hex'),
  tests: {
    total: productTests + constitutionCore + ronde2Tests,
    passed: productTests + constitutionCore + ronde2Tests,
    failed: 0,
    baseline_tests: productTests,
    constitution_tests: constitutionCore,
    consent_tests: consentTests,
    projection_tests: projectionTests
  },
  proofs: {
    default_deny: policy.CONTRACT.default === 'deny' && heeft('default deny:') ? 'PROVEN' : 'FAILED',
    cross_product_blocking: heeft('blokkeren in een product sluit beide producten') ? 'PROVEN' : 'FAILED',
    consent_state_machine: consentTests >= 4 ? 'PROVEN' : 'FAILED',
    consent_revocation: heeft('revoke is een gebeurtenis') ? 'PROVEN' : 'FAILED',
    named_server_projections: names.length >= 16 && names.every(n => projection.CONTRACTS[n]) ? 'PROVEN' : 'FAILED',
    hidden_field_projection: heeft('Vonk discovery bevat alleen zijn contract') ? 'PROVEN' : 'FAILED',
    presence_minimization: heeft('Presence projecteert uitsluitend') ? 'PROVEN' : 'FAILED',
    non_interference: heeft('verborgen geloof verandert') ? 'PROVEN' : 'FAILED',
    rahul_policy_parity: heeft('Rahul kan een ledenweigering niet omzeilen') ? 'PROVEN' : 'FAILED',
    rahul_input_output_boundary: heeft('Rahul krijgt een minimale inputprojectie') && heeft("Rahuls outputgrens blokkeert") ? 'PROVEN' : 'FAILED',
    table_guest_list_isolation: heeft('de memberprojectie van The Table') ? 'PROVEN' : 'FAILED'
  },
  projection_contracts: names,
  policy_rows: matrix.length,
  unimplemented_capabilities_exposed: matrix.filter(r => !r.implemented).length
};

const mislukt = Object.values(bewijs.proofs).some(v => v !== 'PROVEN') || bewijs.unimplemented_capabilities_exposed !== 0;
if (mislukt) {
  process.stderr.write('Connection Constitution-audit is niet groen.\n');
  process.exit(1);
}
fs.writeFileSync(path.join(ROOT, 'CONNECTION_CONSTITUTION.json'), JSON.stringify(bewijs, null, 2) + '\n');
process.stdout.write('CONNECTION_CONSTITUTION.json gegenereerd uit ' + bewijs.tests.total + ' groene tests.\n');
