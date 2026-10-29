#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const child = require('node:child_process');
const {build,validate,serializeRegistry} = require('./lib/experience/coverage');

const ROOT = path.join(__dirname,'..');
const TARGET = path.join(ROOT,'EXPERIENCEWERKT.json');
const contract = JSON.parse(fs.readFileSync(path.join(ROOT,'experience-architecture/coverage-contract.json'),'utf8'));
const signatures = JSON.parse(fs.readFileSync(path.join(ROOT,'experience-architecture/signatures.json'),'utf8'));
const args = new Set(process.argv.slice(2));
const evidencePath = process.env.RTG_EXPERIENCE_EVIDENCE;
const evidence = evidencePath && fs.existsSync(evidencePath) ? JSON.parse(fs.readFileSync(evidencePath,'utf8')) : {version:1,records:[]};
const candidateCommit = args.has('--gate') ? child.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim() : null;
const report = build(ROOT,{contract,signatures,evidence,commit:candidateCommit});
const errors = validate(ROOT,report,contract,signatures);
const text = serializeRegistry(report);

if (errors.length) {
  for (const error of errors) console.error('NIET OK: ' + error);
  process.exit(1);
}
if (args.has('--write')) {
  fs.writeFileSync(TARGET,text);
  console.log('EXPERIENCEWERKT.json afgeleid: ' + report.summary.logicalApps.total + ' apps, ' + report.summary.screens.total + ' schermen.');
} else if (args.has('--check')) {
  if (!fs.existsSync(TARGET) || fs.readFileSync(TARGET,'utf8') !== text) {
    console.error('NIET OK: EXPERIENCEWERKT.json loopt achter op de bron. Draai npm run experience:coverage:write.');
    process.exit(1);
  }
  console.log('OK: Experience-register klopt met 100% van de inventaris (' + report.summary.logicalApps.total + ' apps, ' + report.summary.screens.total + ' schermen).');
} else if (args.has('--gate')) {
  console.log(JSON.stringify(report.summary));
  if (report.status !== 'PROVEN') {
    console.error('NIET OK: Premium Ready is fail-closed; ontbrekend, vervallen, geblokkeerd of niet-menselijk bewijs telt niet als geslaagd.');
    process.exit(1);
  }
  console.log('OK: alle toepasselijke APPWERKT- en EXPERIENCEWERKT-voorwaarden moeten op dezelfde kandidaatversie worden samengesteld door de vrijgavepoort.');
} else process.stdout.write(text);
