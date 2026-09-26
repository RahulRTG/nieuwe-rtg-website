#!/usr/bin/env node
/* Een artefact (model of uitvoerder) ondertekend op een omgeving zetten.
   TOESTEL.md par. 9.3. OFFLINE gereedschap voor een mens; niets hiervan draait
   op de server.

     node scripts/toestel-artefact.js nieuwe-sleutel <id> <pad-buiten-de-repo.pem>
         maakt een Ed25519-sleutelpaar, schrijft de PRIVATE helft naar het pad en
         drukt de regel af die in public/shared/toestel/sleutels.js hoort.

     node scripts/toestel-artefact.js voeg <bestand> --id x --versie 1 --soort model
         --licentie MIT --bron "..." --vermelding "..." --contract a,b
         [--kwaliteit '{"wer":{"waarde":0.12,"graad":"gemeten","proefset":"nl-v1"}}']
         --sleutel <id> --prive <pad.pem> [--map <toesteldir>]
         kopieert het bestand als artefacten/<sha256> en zet een ondertekende
         regel in manifest.json (een regel met dezelfde id en versie vervangt).

   Twee weigeringen die er met opzet in zitten: een private sleutel in de repo
   schrijven of lezen, en tekenen met een sleutel die niet `actief` is. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { nieuweSleutel, teken, sha256 } = require('./lib/toestelteken');

const WORTEL = path.resolve(__dirname, '..');
const binnenRepo = (p) => { const r = path.relative(WORTEL, path.resolve(p)); return !r.startsWith('..') && !path.isAbsolute(r); };
function stop(m) { console.error(m); process.exit(1); }
function vlag(args, n) { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; }

const [cmd, ...rest] = process.argv.slice(2);

if (cmd === 'nieuwe-sleutel') {
  const [id, uit] = rest;
  if (!id || !uit) stop('Gebruik: nieuwe-sleutel <id> <pad.pem>');
  if (binnenRepo(uit)) stop('De private sleutel hoort niet in de repo. Kies een pad erbuiten.');
  const s = nieuweSleutel(id);
  fs.writeFileSync(uit, s.privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ id, publiek: s.publiek, vanaf: new Date().toISOString().slice(0, 10), stand: 'actief' }));
  console.log('Zet deze regel in public/shared/toestel/sleutels.js; dat is een release.');
} else if (cmd === 'voeg') {
  const bestand = rest[0];
  const nodig = ['id', 'versie', 'soort', 'licentie', 'bron', 'contract', 'sleutel', 'prive'];
  for (const n of nodig) if (!vlag(rest, n)) stop('Ontbrekend: --' + n);
  if (binnenRepo(vlag(rest, 'prive'))) stop('Een private sleutel in de repo wordt niet gelezen.');
  const sleutels = require('../public/shared/toestel/sleutels.js');
  const sleutel = sleutels.find(k => k.id === vlag(rest, 'sleutel'));
  if (!sleutel) stop('De sleutel ' + vlag(rest, 'sleutel') + ' staat niet in public/shared/toestel/sleutels.js.');
  const buf = fs.readFileSync(bestand);
  const sha = sha256(buf);
  const doel = vlag(rest, 'map') || process.env.RTG_TOESTEL_DIR ||
    path.join(process.env.RTG_DATA_DIR || path.join(WORTEL, 'server', 'data'), 'toestel');
  fs.mkdirSync(path.join(doel, 'artefacten'), { recursive: true });
  fs.writeFileSync(path.join(doel, 'artefacten', sha), buf);
  const kw = vlag(rest, 'kwaliteit');
  const regel = teken({
    id: vlag(rest, 'id'), versie: vlag(rest, 'versie'), soort: vlag(rest, 'soort'), sha256: sha, grootte: buf.length,
    licentie: vlag(rest, 'licentie'), bron: vlag(rest, 'bron'), naamsvermelding: vlag(rest, 'vermelding') || null,
    contracten: vlag(rest, 'contract').split(',').map(s => s.trim()).filter(Boolean),
    kwaliteit: kw ? JSON.parse(kw) : {}
  }, sleutel, crypto.createPrivateKey(fs.readFileSync(vlag(rest, 'prive'))));
  const mp = path.join(doel, 'manifest.json');
  let m = { versie: 1, artefacten: [] };
  try { m = JSON.parse(fs.readFileSync(mp, 'utf8')); } catch (e) { /* eerste regel: een nieuw manifest */ }
  m.artefacten = (m.artefacten || []).filter(r => !(r.id === regel.id && r.versie === regel.versie)).concat([regel]);
  fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n');
  console.log('Ondertekend: ' + regel.id + ' ' + regel.versie + ' (' + sha.slice(0, 12) + ', ' + buf.length + ' bytes).');
} else {
  stop('Gebruik: nieuwe-sleutel <id> <pad.pem> | voeg <bestand> --id ... (zie de kop van dit bestand)');
}
