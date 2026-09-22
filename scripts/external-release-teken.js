#!/usr/bin/env node
/* Onderteken een reeds door onafhankelijke partijen aangeleverd dossier.
   Dit maakt geen enkele controle groen: iedere PASS en ieder bewijsbestand
   moet al bestaan en kloppen. De privésleutel komt uitsluitend uit de secret
   RTG_EVIDENCE_SIGN_KEY; het vaste evidence-anker staat in deploy/. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const extern = require('../server/config/external-release');
const trust = require('../server/config/release-trust');
const { eisSchoneReleasebron } = require('./lib/productie-vrijgave');

const ROOT = path.join(__dirname, '..');

function priveSleutel(env) {
  return trust.privateKey('EVIDENCE', env);
}

function teken(root = ROOT, env = process.env) {
  const commit = eisSchoneReleasebron(root);
  const paden = extern.padenVoorDossier(path.join(root, '.release', 'external-release.json'), root);
  const dossierBytes = extern.leesRegulier(paden.dossierPad, extern.MAX_DOSSIER_BYTES);
  const dossier = JSON.parse(dossierBytes.toString('utf8'));
  const structuur = extern.controleerStructuur(dossier, commit, extern.ALLE_CONTROLES);
  if (!structuur.ok) throw new Error('Dossier geweigerd: ' + structuur.reden + '.');
  const map = fs.lstatSync(paden.bewijsRoot);
  if (!map.isDirectory() || map.isSymbolicLink()) throw new Error('Externe bewijsmap is niet regulier.');
  for (const naam of extern.ALLE_CONTROLES) {
    const bewijs = dossier.controles[naam].bewijs;
    const bytes = extern.leesRegulier(path.join(paden.bewijsRoot, bewijs.bestand), extern.MAX_BEWIJS_BYTES);
    if (extern.sha256(bytes) !== String(bewijs.sha256).toLowerCase())
      throw new Error('Bewijsbytes wijken af voor ' + naam + '.');
  }
  const prive = trust.authorizedPrivate(root, 'EVIDENCE', env);
  const handtekening = trust.sign('EVIDENCE', dossierBytes, prive) + '\n';
  const tijdelijk = paden.handtekeningPad + '.tmp-' + process.pid;
  fs.writeFileSync(tijdelijk, handtekening, { mode:0o600, flag:'wx' });
  fs.renameSync(tijdelijk, paden.handtekeningPad);
  fs.chmodSync(paden.handtekeningPad, 0o600);
  const controle = extern.controleerReleaseRoot(root, commit);
  if (!controle.ok) throw new Error('Terugcontrole van handtekening faalde: ' + controle.reden + '.');
  return controle;
}

if (require.main === module) {
  try {
    const resultaat = teken();
    console.log('Extern dossier ondertekend voor ' + resultaat.commit + '.');
    console.log('Dossier SHA-256: ' + resultaat.dossierSha256);
  } catch (e) { console.error('[external-release] ' + e.message); process.exitCode = 1; }
}

module.exports = { priveSleutel, teken };
