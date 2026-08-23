#!/usr/bin/env node
/* ============================================================================
   DE INVOER-ROBUUSTHEID, PER ROUTE -- de INPUT-kolom van de bewijsmatrix.

   Het oordeel staat in scripts/lib/invoerproef.js (en is daar los te toetsen);
   dit script zet er een echte server omheen en schrijft INVOERPROEF.json.

   DEZELFDE OPZET ALS DE ROLPROEF, EN DAT IS GEEN TOEVAL. Eigen wegwerpserver,
   eigen datamap, tokens per rol uit de demo-inlog, en per route een regel in een
   register. Wat er anders is, is de invoer: rommel in plaats van plausibel, en
   de JUISTE rol in plaats van de verkeerde.

   WAAROM DIT EEN EIGEN SERVER MOET HEBBEN. Rommel met de juiste rol raakt echte
   handlers en verandert echt dingen -- dat is de prijs van voorbij de poort
   komen. Op een wegwerpmap is dat precies goed; op een gedeelde installatie zou
   het onvergeeflijk zijn.

   Draai:  node --experimental-sqlite scripts/invoerproef-route.js
           node --experimental-sqlite scripts/invoerproef-route.js --max=2000
           node --experimental-sqlite scripts/invoerproef-route.js --seed=99
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { draaiInvoerproef } = require('./lib/invoerproef');
const { alleRoutes, isSchakel } = require('./lib/routes');
const { maakTeller, maakRommel } = require('./lib/rommel');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'INVOERPROEF.json');
const argv = process.argv.slice(2);
const MAX = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 0;   // 0 = geen begrenzing
const SEED = Number((argv.find(a => a.startsWith('--seed=')) || '').slice(7)) || 20260812;
const RONDES = Number((argv.find(a => a.startsWith('--rondes=')) || '').slice(9)) || 2;

/* Dezelfde afleiding als in de rolproef: de rol uit de bewaker in de bron. Een
   route waarvan we de rol niet kennen slaan we over -- met een gokrol kloppen
   levert een 403 en dus een lege meting. */
function rolVan(bewakers) {
  const b = bewakers.join(' ');
  if (/supplierAuth/.test(b)) return 'supplier';
  if (/officeAuth|kantoorAuth|adminOnly/.test(b)) return 'office';
  if (/\bauth\b|eisAccount|\blid\b/.test(b)) return 'member';
  return null;
}

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
  const datamap = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-invoerproef-'));
  const basis = 'http://127.0.0.1:' + poort;

  const kind = spawn(process.execPath, ['--experimental-sqlite', path.join(WORTEL, 'server', 'server.js')], {
    cwd: WORTEL, stdio: 'ignore',
    /* RTG_DEMO=1 mint alleen de TOKENS; de routes die daarna rommel krijgen zijn
       de echte, met hun echte validatie ervoor. Zelfde afweging als in de
       rolproef, en om dezelfde reden opgeschreven. */
    env: { ...process.env, PORT: String(poort), RTG_DATA_DIR: datamap, SMTP_URL: '', STUN_UIT: '1',
      RTG_MAGNAAT_TEST: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF' }
  });

  const klaar = () => { try { kind.kill('SIGKILL'); } catch (e) {} try { fs.rmSync(datamap, { recursive: true, force: true }); } catch (e) {} };
  process.on('exit', klaar);

  if (!await wacht(basis, 60000)) { console.error('de server kwam niet op'); klaar(); process.exit(2); }

  const post = async (pad, lijf, tok) => {
    try {
      const r = await fetch(basis + pad, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
        body: JSON.stringify(lijf == null ? {} : lijf) });
      const tekst = await r.text();
      let data; try { data = JSON.parse(tekst); } catch (e) { data = tekst; }
      return { status: r.status, data };
    } catch (e) { return { status: 0, data: String(e.message) }; }
  };

  /* De drie inlogwegen, elk apart, zodat een token onderweg opnieuw te halen is. */
  const inlog = {
    member: async () => (await post('/api/login', { tier: 'rtg' })).data.token,
    office: async () => (await post('/api/office/login', { code: 'RTG-OFFICE-PROEF' })).data.token,
    supplier: async () => (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).data.token
  };
  const tokens = {};
  for (const rol of Object.keys(inlog)) { try { tokens[rol] = await inlog[rol](); } catch (e) {} }
  const ontbreekt = Object.keys(inlog).filter(r => !tokens[r]);
  if (ontbreekt.length) {
    console.error('geen token voor: ' + ontbreekt.join(', ') +
      ' -- de proef zou dan doen alsof die routes zijn beproefd');
    klaar(); process.exit(2);
  }
  const tokenVoor = (rol) => tokens[rol];
  const hernieuw = async (rol) => {
    try { const t = await inlog[rol](); if (t) { tokens[rol] = t; return true; } } catch (e) {}
    return false;
  };

  const rng = maakTeller(SEED);
  const { chaosBody } = maakRommel(rng);

  const routes = alleRoutes()
    .filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET')
    /* De schakelkast krijgt geen rommel: die zou functies uitzetten en daarmee
       elke meting erna vergiftigen. Hij staat in lib/routes.js zodat de
       Beproeving en deze proef dezelfde lijst gebruiken. */
    .filter(r => !isSchakel(r.pad))
    /* Een pad met :parameters bestaat als patroon en niet als adres; er letterlijk
       heen posten meet een 404 en geen validatie. */
    .filter(r => !r.pad.includes(':'))
    .map(r => ({ method: r.methode, pad: r.pad, rol: rolVan(r.bewakers) }))
    .filter(r => r.rol);

  console.log('\n=== DE INVOER-ROBUUSTHEID PER ROUTE ===\n');
  console.log('  seed                                 : ' + SEED);
  console.log('  routes met een herkenbare rol        : ' + routes.length);
  console.log('  rommelverzoeken per route            : ' + RONDES);

  const uit = await draaiInvoerproef({ post, routes, tokenVoor, hernieuw,
    rommelVoor: () => chaosBody(0), perRoute: RONDES, maxPogingen: MAX });

  if (uit.meterStuk) {
    console.error('\n  DE METER IS BLIND: ' + uit.meterStuk);
    klaar(); process.exit(2);
  }

  const rijen = Object.values(uit.perRoute);
  const bereikt = rijen.filter(r => r.invoer === 'dicht' || r.invoer === 'GEZAKT');
  const poortRijen = rijen.filter(r => r.invoer === 'poort');
  const gezakt = rijen.filter(r => r.invoer === 'GEZAKT');

  console.log('  rommelverzoeken                      : ' + uit.pogingen);
  console.log('  voorbij de poort (echt gemeten)      : ' + bereikt.length + ' / ' + routes.length);
  console.log('  achter een grendel (ONGEMETEN)       : ' + poortRijen.length);
  console.log('  tokens onderweg opnieuw gehaald      : ' + uit.hernieuwd);
  console.log('  viel om op rommel (5xx/geen antwoord): ' + uit.bevindingen.breuken.length);
  for (const b of uit.bevindingen.breuken.slice(0, 15)) console.log('      ' + b);
  console.log('  gaf interne details mee              : ' + uit.bevindingen.sporen.length);
  for (const b of uit.bevindingen.sporen.slice(0, 15)) console.log('      ' + b);

  fs.writeFileSync(UITSLAG, JSON.stringify({
    uitleg: 'Per route: rommel met de JUISTE rol, en of er een 5xx of een intern spoor uit kwam. ' +
      'Een route die hier NIET in staat is niet beproefd. Een route met invoer:"poort" stond achter ' +
      'een tweede grendel en is ONGEMETEN, geen groen. Zie scripts/lib/invoerproef.js voor de grens.',
    seed: SEED,
    gemeten: { routesMetRol: routes.length, bereikt: bereikt.length, pogingen: uit.pogingen,
      breuken: uit.bevindingen.breuken.length, sporen: uit.bevindingen.sporen.length,
      achterEenPoort: poortRijen.length, tokensHernieuwd: uit.hernieuwd,
      blindeRondes: uit.meterStuk ? 1 : 0, rondesPerRoute: RONDES, begrenzing: MAX },
    perRoute: rijen
  }, null, 1) + '\n');
  console.log('\n  weggeschreven in INVOERPROEF.json');

  klaar();
  process.exit(gezakt.length ? 1 : 0);
})().catch(e => { console.error('de invoerproef viel om: ' + (e && e.stack || e)); process.exit(2); });
