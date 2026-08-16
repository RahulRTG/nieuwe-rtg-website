'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const functies = require('../server/functies');
const maakIncident = require('../server/kern/incidentcontrole');
const maakIntegriteit = require('../server/kern/integriteitswacht');
const { totaalHash } = require('../scripts/release-bewijs');

function incident(db) {
  return maakIncident({ db, save() {}, functies, beveilig: null });
}

test('gericht beperken en herstellen bewaart elke eerdere schakelstand exact', () => {
  const db = { data: { techniek: { functies: { charter: { aan: true, perLand: { ES: false } }, tickets: { aan: false } },
    zekeringen: { onderhoud: { aan: true, naam: 'Onderhoud' } } } } };
  const voor = JSON.parse(JSON.stringify(db.data.techniek.functies));
  const c = incident(db);
  const dicht = c.beperk({ ids: ['charter', 'tickets'], reden: 'Verdachte code in reisfuncties' }, { id: 7 });
  assert.equal(dicht.modus, 'beperkt');
  assert.equal(functies.functieAan('charter', db.data.techniek.functies), false);
  c.herstel('Controle afgerond en schoon bevonden', { id: 7 });
  assert.deepEqual(db.data.techniek.functies, voor);
  assert.equal(c.status().modus, 'normaal');
  assert.equal(c.status().auditAantal, 2);
});

test('isolatie sluit alle productfuncties en onderhoud, maar is volledig herstelbaar', () => {
  const db = { data: { techniek: { functies: {}, zekeringen: { onderhoud: { aan: true, code: 'M' } } } } };
  const c = incident(db);
  const iso = c.isoleer('Mogelijke malware in de live omgeving', { id: 1 });
  assert.equal(iso.modus, 'isolatie');
  assert.equal(iso.onderhoud, true);
  assert.ok(functies.FUNCTIES.every(f => !functies.functieAan(f.id, db.data.techniek.functies)));
  c.herstel('Schone release opnieuw uitgerold en gecontroleerd', { id: 1 });
  assert.deepEqual(db.data.techniek.functies, {});
  assert.deepEqual(db.data.techniek.zekeringen.onderhoud, { aan: true, code: 'M' });
});

test('incidentbediening weigert vage redenen en onbekende functies', () => {
  const c = incident({ data: {} });
  assert.throws(() => c.waakzaam('virus', { id: 1 }), /minimaal 8/);
  assert.throws(() => c.beperk({ id: '__proto__', reden: 'Concrete verdachte handeling' }, { id: 1 }), /Onbekende functie/);
  assert.throws(() => c.herstel('Er is niets actief om te herstellen', { id: 1 }), /geen actief incident/);
});

function maakRelease(root) {
  for (const map of ['server', 'public/dist', 'scripts', 'motor/src', 'motor/target/release', '.release'])
    fs.mkdirSync(path.join(root, map), { recursive: true });
  const inhoud = {
    'package.json': '{"name":"x","version":"1"}', 'package-lock.json': '{}',
    'motor/Cargo.toml': '[package]', 'motor/Cargo.lock': '', Dockerfile: 'FROM scratch',
    'docker-compose.yml': 'services: {}', '.env.example': '', 'SLO.json': '{}',
    'server/app.js': 'veilig', 'public/dist/app.js': 'bouw', 'scripts/start.js': 'start',
    'motor/src/lib.rs': 'pub fn x() {}', 'motor/target/release/rtg-motor': 'binair',
    'motor/target/release/rtg-sentinel': 'bewaker'
  };
  for (const [rel, waarde] of Object.entries(inhoud)) fs.writeFileSync(path.join(root, rel), waarde);
  const bestanden = Object.keys(inhoud).sort().map(padNaam => {
    const b = fs.readFileSync(path.join(root, padNaam));
    return { pad: padNaam, bytes: b.length, sha256: crypto.createHash('sha256').update(b).digest('hex') };
  });
  const manifest = { formaat: 'rtg-release-bewijs-v1', gemaakt: new Date().toISOString(),
    bestandAantal: bestanden.length, bestanden, inhoudSha256: totaalHash(bestanden) };
  const rauw = Buffer.from(JSON.stringify(manifest));
  const bewijsPad = path.join(root, '.release/release-bewijs.json');
  fs.writeFileSync(bewijsPad, rauw);
  return { bewijsPad, pin: crypto.createHash('sha256').update(rauw).digest('hex') };
}

test('integriteitswacht detecteert bronmanipulatie en een verkeerde externe pin', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-integraal-'));
  const b = maakRelease(root);
  const wacht = maakIntegriteit({ root, bewijsPad: b.bewijsPad, pin: b.pin });
  assert.equal(wacht.controleer().laatst.ok, true);
  fs.writeFileSync(path.join(root, 'server/app.js'), 'kwaadaardig');
  const stuk = wacht.controleer();
  assert.equal(stuk.laatst.ok, false);
  assert.ok(stuk.laatst.details.some(x => x.soort === 'grootte' && x.pad === 'server/app.js'));
  const verkeerdePin = maakIntegriteit({ root, bewijsPad: b.bewijsPad, pin: '0'.repeat(64) }).controleer();
  assert.equal(verkeerdePin.pinGeldig, false);
  assert.ok(verkeerdePin.laatst.details.some(x => x.soort === 'pin'));
});
