#!/usr/bin/env node
/* ============================================================================
   DE IDEMPOTENTIE, PER ROUTE -- de IDEMPOTENCY-kolom van de bewijsmatrix.

   Het oordeel staat in scripts/lib/idemproef.js (en is daar los te toetsen);
   dit script zet er een echte server omheen en schrijft IDEMPROEF.json.

   Derde in dezelfde familie: rolproef (verkeerde rol, plausibele invoer),
   invoerproef (juiste rol, rommel), idemproef (juiste rol, plausibele invoer,
   drie keer). Ze delen de wegwerpserver, de demo-tokens en het plausibele lijf,
   want drie definities van "plausibel" is drie plekken die uiteenlopen.

   DEZE PROEF MUTEERT ECHT, en meer dan de andere twee: hij voert per route
   twee opdrachten uit die kunnen slagen. Dat is de prijs van meten of een
   herhaling iets doet -- en de reden dat hij nooit ergens anders dan op een
   wegwerpmap draait.

   Draai:  node --experimental-sqlite scripts/idemproef-route.js
           node --experimental-sqlite scripts/idemproef-route.js --max=200
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { draaiIdemproef } = require('./lib/idemproef');
const { plausibelLijf } = require('./lib/rolproef');
const { alleRoutes, isSchakel, verdeelOpRol, meldZonderRol } = require('./lib/routes');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'IDEMPROEF.json');
const argv = process.argv.slice(2);
const MAX = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 0;   // 0 = alles

/* rolVan() woont in ./lib/routes.js, samen met de REDEN waarom een rol soms niet
   te bepalen valt. Hij stond hier woordelijk, en in drie andere proef-scripts nog
   eens -- vier kopieen van dezelfde afleiding (LAT.md regel 4). */

function vrijePoort() {
  const net = require('net');
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.unref(); s.on('error', rej);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}

async function wacht(basis, ms) {
  const eind = Date.now() + ms;
  while (Date.now() < eind) {
    try { const r = await fetch(basis + '/api/health'); if (r.ok) return true; } catch (e) {}
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

(async () => {
  const poort = await vrijePoort();
  const datamap = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-idemproef-'));
  const basis = 'http://127.0.0.1:' + poort;

  const kind = spawn(process.execPath, ['--experimental-sqlite', path.join(WORTEL, 'server', 'server.js')], {
    cwd: WORTEL, stdio: 'ignore',
    env: { ...process.env, PORT: String(poort), RTG_DATA_DIR: datamap, SMTP_URL: '', STUN_UIT: '1',
      RTG_DEMO: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF' }
  });

  const klaar = () => { try { kind.kill('SIGKILL'); } catch (e) {} try { fs.rmSync(datamap, { recursive: true, force: true }); } catch (e) {} };
  process.on('exit', klaar);

  if (!await wacht(basis, 60000)) { console.error('de server kwam niet op'); klaar(); process.exit(2); }

  const post = async (pad, lijf, tok) => {
    try {
      const r = await fetch(basis + pad, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
        body: JSON.stringify(lijf || {}) });
      const tekst = await r.text();
      let data; try { data = JSON.parse(tekst); } catch (e) { data = tekst; }
      return { status: r.status, data };
    } catch (e) { return { status: 0, data: String(e.message) }; }
  };

  const inlog = {
    member: async () => (await post('/api/login', { tier: 'rtg' })).data.token,
    office: async () => (await post('/api/office/login', { code: 'RTG-OFFICE-PROEF' })).data.token,
    supplier: async () => (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).data.token
  };
  const tokens = {};
  for (const rol of Object.keys(inlog)) { try { tokens[rol] = await inlog[rol](); } catch (e) {} }
  const ontbreekt = Object.keys(inlog).filter(r => !tokens[r]);
  if (ontbreekt.length) {
    console.error('geen token voor: ' + ontbreekt.join(', ') + ' -- de proef zou dan doen alsof die routes zijn beproefd');
    klaar(); process.exit(2);
  }
  const tokenVoor = (rol) => tokens[rol];
  const hernieuw = async (rol) => {
    try { const t = await inlog[rol](); if (t) { tokens[rol] = t; return true; } } catch (e) {}
    return false;
  };

  const kandidaten = alleRoutes()
    .filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET')
    .filter(r => !isSchakel(r.pad))
    .filter(r => !r.pad.includes(':'));
  /* De verdeling in plaats van een filter. `.filter(r => r.rol)` liet hier
     honderden routes verdwijnen zonder dat er ergens een getal omhoog ging; nu
     komen ze met hun reden terug en staan ze straks ook in het uitslagbestand. */
  const verdeling = verdeelOpRol(kandidaten);
  const routes = verdeling.metRol;

  console.log('\n=== DE IDEMPOTENTIE PER ROUTE ===\n');
  console.log('  routes gevonden                      : ' + kandidaten.length);
  console.log('  routes met een herkenbare rol        : ' + routes.length);
  meldZonderRol(verdeling);
  console.log('  oproepen per route                   : 3  (K1, K1 opnieuw, K2 vers)');

  const uit = await draaiIdemproef({ post, routes, tokenVoor, hernieuw,
    lijfVoor: (r) => plausibelLijf(r.pad), maxRoutes: MAX });

  if (uit.meterStuk) {
    console.error('\n  DE METER IS BLIND: ' + uit.meterStuk);
    klaar(); process.exit(2);
  }

  const t = uit.telling;
  const beoordeeld = t.beschermd + t.onbeschermd;
  console.log('  oproepen                             : ' + uit.oproepen);
  console.log('  tokens onderweg opnieuw gehaald      : ' + uit.hernieuwd);
  console.log('  BEOORDEELD (tweede effect zichtbaar) : ' + beoordeeld + ' / ' + routes.length);
  console.log('      herhaling herkend (beschermd)    : ' + t.beschermd);
  console.log('      deed het opnieuw (onbeschermd)   : ' + t.onbeschermd);
  console.log('  ongemeten                            : ' + t.ongemeten +
    '   <- geen werk gedaan, of het antwoord reageert niet op een nieuwe oproep');

  const onbeschermd = Object.values(uit.perRoute).filter(r => r.idempotentie === 'onbeschermd');
  for (const r of onbeschermd.slice(0, 20)) console.log('      ' + r.methode + ' ' + r.pad);
  if (onbeschermd.length > 20) console.log('      ... en nog ' + (onbeschermd.length - 20));

  fs.writeFileSync(UITSLAG, JSON.stringify({
    uitleg: 'Per route drie oproepen: twee met dezelfde sleutel en een met een verse. De derde is de ' +
      'IJKING -- verschilt hij van de eerste, dan is het antwoord gevoelig voor een nieuwe oproep en ' +
      'pas dan betekent een gelijke herhaling iets. Een route die hier NIET in staat is niet beproefd. ' +
      '"onbeschermd" is een telling en geen defect-oordeel; zie de grens in scripts/lib/idemproef.js.',
    /* WAT ER NIET IS BEPROEFD, met de reden erbij. Zonder dit veld leest
       routesMetRol als "dit zijn de routes" terwijl het "dit is wat we konden
       bereiken" betekent -- en dat verschil was jarenlang 1257 routes groot. */
    nietBeproefbaar: verdeling.zonderRol.length,
    redenenNietBeproefbaar: verdeling.redenen,
    routesGevonden: kandidaten.length,
    gemeten: { routesMetRol: routes.length, beoordeeld,
      beschermd: t.beschermd, onbeschermd: t.onbeschermd, ongemeten: t.ongemeten,
      oproepen: uit.oproepen, tokensHernieuwd: uit.hernieuwd,
      blindeRondes: uit.meterStuk ? 1 : 0, begrenzing: MAX },
    perRoute: Object.values(uit.perRoute)
  }, null, 1) + '\n');
  console.log('\n  weggeschreven in IDEMPROEF.json');

  klaar();
  /* GEEN EXITCODE 1 OP "ONBESCHERMD". Dat is een telling en geen defect: twee
     keer op bewaren drukken hoort twee notities op te leveren. Alleen blindheid
     laat deze proef zakken -- LAT.md: een bevinding maakt CI niet rood,
     blindheid wel. */
  process.exit(0);
})().catch(e => { console.error('de idemproef viel om: ' + (e && e.stack || e)); process.exit(2); });
