#!/usr/bin/env node
/* Bewaakt dat identiteit niet als los scherm naast het platform leeft. Iedere
   credential- of registratiepagina krijgt RTG Access Experience via basis.js;
   de ervaringslaag zelf bezit nooit tokens, transport of authenticatie. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function htmlBestanden(dir, uit = []) {
  for (const naam of fs.readdirSync(dir)) {
    const p = path.join(dir, naam), st = fs.statSync(p);
    if (st.isDirectory()) htmlBestanden(p, uit); else if (naam.endsWith('.html')) uit.push(p);
  }
  return uit;
}
function controleer(wortel = ROOT) {
  const fouten = [], apps = path.join(wortel, 'public', 'apps');
  const basis = fs.readFileSync(path.join(wortel, 'public', 'shared', 'basis', 'basis-01.js'), 'utf8');
  const gedrag = fs.readFileSync(path.join(wortel, 'public', 'shared', 'toegang.js'), 'utf8');
  const stijl = fs.readFileSync(path.join(wortel, 'public', 'shared', 'toegang.css'), 'utf8');
  const ledenPoort = fs.readFileSync(path.join(wortel, 'public', 'apps', 'app-main', 'app-main-04b.js'), 'utf8');
  const ledenStart = fs.readFileSync(path.join(wortel, 'public', 'apps', 'app-main', 'app-main-06.js'), 'utf8');
  if (!/\/shared\/toegang\.js/.test(basis)) fouten.push('basis.js laadt RTG Access Experience niet');
  if (!/\/shared\/toegang\.css/.test(gedrag)) fouten.push('RTG Access Experience laadt haar ontwerpcontract niet');
  if (/fetch\s*\(|localStorage|sessionStorage|Authorization|document\.cookie/.test(gedrag))
    fouten.push('de pre-auth ervaringslaag probeert identiteit of transport te bezitten');
  if (!/RTGAccessExperience/.test(gedrag) || !/data-rtg-toegang/.test(stijl))
    fouten.push('toegangslaag mist haar publieke ingang of afgeschermde stijlselector');
  for (const onderdeel of ['ag-welkom', 'ag-passkey-kaart', 'ag-werelden']) {
    if (!ledenPoort.includes(onderdeel)) fouten.push('de officiële ledeningang mist ' + onderdeel);
  }
  if (/setTimeout\s*\(\s*\(\)\s*=>\s*passkeyInlog/.test(ledenStart))
    fouten.push('de ledeningang opent biometrie zonder bewuste handeling');

  const schermen = [];
  for (const bestand of htmlBestanden(apps)) {
    const bron = fs.readFileSync(bestand, 'utf8');
    const toegang = /data-inlogkleur|data-rtg-toegang|type=["']password["']|id=["'](?:gate|login|inlog|vLogin|vPoort|dlgLogin|lrInlog)["']/i.test(bron);
    if (!toegang) continue; schermen.push(path.relative(wortel, bestand).replace(/\\/g, '/'));
    if (!/\/shared\/basis\.js/.test(bron)) fouten.push(path.relative(wortel, bestand) + ' heeft toegang maar mist basis.js');
  }
  for (const rel of ['public/apps/foundation/registreren.html', 'public/apps/reisuitnodiging.html']) {
    const bron = fs.readFileSync(path.join(wortel, rel), 'utf8');
    if (!/data-rtg-toegang=["']registratie["']/.test(bron)) fouten.push(rel + ' verklaart registratie niet aan RTG Access Experience');
  }
  return { fouten, schermen };
}

if (require.main === module) {
  const r = controleer();
  if (r.fouten.length) { r.fouten.forEach(x => console.error('  x ' + x)); process.exit(1); }
  console.log('  ' + r.schermen.length + ' inlog-, registratie- en operationele toegangsschermen volgen RTG Access Experience.');
}
module.exports = { controleer };
