'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { totaalHash, verifieer } = require('../scripts/release-bewijs');

test('releasebewijs accepteert exact dezelfde inhoud en merkt manipulatie', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-release-'));
  for (const map of ['server', 'public/dist', 'scripts', 'motor/src', 'motor/target/release']) fs.mkdirSync(path.join(root, map), { recursive: true });
  const files = {
    'package.json': '{"name":"x","version":"1"}', 'package-lock.json': '{}',
    'motor/Cargo.toml': '[package]', 'motor/Cargo.lock': '', Dockerfile: 'FROM scratch',
    'docker-compose.yml': 'services: {}', '.env.example': '', 'SLO.json': '{}',
    'RUST-MIGRATIES.json': '{"versie":1}',
    'server/app.js': 'ok', 'public/dist/app.js': 'bouw', 'scripts/start.js': 'start',
    'motor/src/lib.rs': 'pub fn x() {}', 'motor/target/release/rtg-motor': 'binair',
    'motor/target/release/rtg-sentinel': 'bewaker'
  };
  for (const [rel, inhoud] of Object.entries(files)) fs.writeFileSync(path.join(root, rel), inhoud);
  const bestanden = Object.keys(files).sort().map(padNaam => {
    const buf = fs.readFileSync(path.join(root, padNaam));
    return { pad: padNaam, bytes: buf.length, sha256: require('crypto').createHash('sha256').update(buf).digest('hex') };
  });
  const manifest = { formaat: 'rtg-release-bewijs-v1', bestanden, inhoudSha256: totaalHash(bestanden) };
  assert.equal(verifieer(root, manifest).ok, true);
  fs.writeFileSync(path.join(root, 'server/app.js'), 'geknoeid');
  const stuk = verifieer(root, manifest);
  assert.equal(stuk.ok, false);
  assert.ok(stuk.fouten.some(f => /server\/app\.js/.test(f)));
});

test('releasebewijs detecteert ook een toegevoegd runtimebestand', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-release-extra-'));
  for (const map of ['server', 'public/dist', 'scripts', 'motor/src', 'motor/target/release']) fs.mkdirSync(path.join(root, map), { recursive: true });
  for (const rel of ['package.json', 'package-lock.json', 'motor/Cargo.toml', 'motor/Cargo.lock', 'Dockerfile', 'docker-compose.yml', '.env.example', 'SLO.json', 'RUST-MIGRATIES.json'])
    fs.writeFileSync(path.join(root, rel), rel === 'package.json' ? '{"name":"x","version":"1"}' : 'x');
  fs.writeFileSync(path.join(root, 'motor/target/release/rtg-motor'), 'bin');
  fs.writeFileSync(path.join(root, 'motor/target/release/rtg-sentinel'), 'wacht');
  const bestanden = [];
  for (const rel of ['package.json', 'package-lock.json', 'motor/Cargo.toml', 'motor/Cargo.lock', 'Dockerfile', 'docker-compose.yml', '.env.example', 'SLO.json', 'RUST-MIGRATIES.json', 'motor/target/release/rtg-motor', 'motor/target/release/rtg-sentinel'].sort()) {
    const b = fs.readFileSync(path.join(root, rel));
    bestanden.push({ pad: rel, bytes: b.length, sha256: require('crypto').createHash('sha256').update(b).digest('hex') });
  }
  const manifest = { formaat: 'rtg-release-bewijs-v1', bestanden, inhoudSha256: totaalHash(bestanden) };
  fs.writeFileSync(path.join(root, 'server/nieuw.js'), 'nieuw');
  assert.ok(verifieer(root, manifest).fouten.some(f => /Nieuw bestand/.test(f)));
});
