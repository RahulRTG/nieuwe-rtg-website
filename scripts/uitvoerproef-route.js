#!/usr/bin/env node
/* ============================================================================
   DE UITVOER, PER ROUTE -- de OUTPUT-kolom van de bewijsmatrix.

   Het oordeel staat in scripts/lib/uitvoerproef.js (en is daar los te toetsen);
   dit script zet er een echte server omheen en schrijft UITVOERPROEF.json.

   VIJFDE IN DEZELFDE FAMILIE: rolproef (verkeerde rol), invoerproef (rommel),
   idemproef (herhaling op het antwoord), staatproef (herhaling op de toestand)
   en deze -- de JUISTE rol, PLAUSIBELE invoer, en dan pas kijken wat er in het
   antwoord staat. Ze delen de wegwerpserver, de demo-tokens en het plausibele
   lijf, want vijf definities van "plausibel" zijn vijf plekken die uiteenlopen.

   HET SLACHTOFFER EN DE AANVALLER. Deze proef zet twee echte accounts neer. Het
   slachtoffer krijgt kanariewaarden: een naam, een e-mailadres en een
   telefoonnummer die nergens anders in dit huis voorkomen. Alle verzoeken gaan
   daarna als de AANVALLER. Staat er een kanarie van het slachtoffer in een
   2xx-antwoord van de aanvaller, dan is er data van iemand anders uit de deur
   gelopen -- geen smaakkwestie, geen meetverschil.

   DE KANARIES GAAN NOOIT MEE IN HET VERZOEK, en dat is geen detail maar de
   voorwaarde waaronder deze proef betekenis heeft. Zou het plausibele lijf een
   kanarie bevatten, dan meldt elke route die zijn invoer teruggeeft een lek en
   is de hele meting waardeloos. Er is dus een controle op vlak voor de ronde
   begint.

   Draai:  node scripts/uitvoerproef-route.js
           node scripts/uitvoerproef-route.js --max=500
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { draaiUitvoerproef, maakKanaries, kanarieLijst } = require('./lib/uitvoerproef');
const { stempel } = require('./lib/stempel');
const { plausibelLijf } = require('./lib/rolproef');
const { alleRoutes, isSchakel } = require('./lib/routes');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'UITVOERPROEF.json');
const argv = process.argv.slice(2);
const MAX = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 0;

/* Dezelfde afleiding als in de rol- en invoerproef: de rol uit de bewaker. */
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
  const datamap = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uitvoerproef-'));
  const basis = 'http://127.0.0.1:' + poort;

  const kind = spawn(process.execPath, [path.join(WORTEL, 'server', 'server.js')], {
    cwd: WORTEL, stdio: 'ignore',
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

  /* ---- het slachtoffer met de kanaries, en de aanvaller die alles doet ---- */
  const kenmerk = String(Date.now()).slice(-6);
  const kanaries = maakKanaries(kenmerk);
  const maakLid = async (naam, email, telefoon) => (await post('/api/auth/register', {
    name: naam, email, phone: telefoon, password: 'proefwachtwoord123',
    geboortedatum: '1990-03-03', tier: 'rtg', pasApp: 'rtg'
  })).data;

  const slachtoffer = await maakLid(kanaries.naam, kanaries.email, kanaries.telefoon);
  if (!slachtoffer || !slachtoffer.token) {
    console.error('het slachtofferaccount kwam er niet: dan meet deze proef niets');
    klaar(); process.exit(2);
  }
  const aanvaller = await maakLid('Aanvaller' + kenmerk, 'aanvaller' + kenmerk + '@proef.test', '0655' + kenmerk.padStart(6, '0').slice(-6));
  if (!aanvaller || !aanvaller.token) {
    console.error('het aanvallersaccount kwam er niet');
    klaar(); process.exit(2);
  }

  const inlog = {
    member: async () => (await post('/api/auth/login', { login: 'aanvaller' + kenmerk + '@proef.test', password: 'proefwachtwoord123' })).data.token,
    office: async () => (await post('/api/office/login', { code: 'RTG-OFFICE-PROEF' })).data.token,
    supplier: async () => (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).data.token
  };
  const tokens = { member: aanvaller.token };
  for (const rol of ['office', 'supplier']) { try { tokens[rol] = await inlog[rol](); } catch (e) {} }
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

  /* DE CONTROLE OP DE METER ZELF (LAT.md regel 2): zit er per ongeluk een
     kanarie in het verzoek, dan meldt elke echoënde route een lek en is de hele
     ronde waardeloos. Dan liever meteen stoppen dan een rapport vol vals alarm. */
  const lijfVoor = (r) => plausibelLijf(r.pad);
  const proeflijf = JSON.stringify(lijfVoor({ pad: '/api/proef' })).toLowerCase();
  for (const k of kanarieLijst(kanaries)) {
    if (proeflijf.includes(String(k.waarde).toLowerCase())) {
      console.error('DE METER IS BLIND: het plausibele lijf bevat de kanarie "' + k.waarde + '".\n' +
        'Elke route die zijn invoer teruggeeft zou dan als lek gelden.');
      klaar(); process.exit(2);
    }
  }

  /* EERST IJKEN, DAN PAS OORDELEN -- dezelfde regel als ijkVingerafdruk() in de
     rolproef, en om dezelfde reden: "nul lekken" is pas een bewering als de
     meter een lek KAN zien. De realistische fout is niet dat het orakel stuk is
     (dat toetst test/uitvoerproef.test.js), maar dat de kanaries waarmee het
     slachtoffer is aangemeld niet dezelfde zijn als die het orakel meekrijgt.
     Dan meldt de proef eeuwig schoon en klopt er niets van. */
  const { weegUitvoer } = require('./lib/uitvoerproef');
  for (const k of kanarieLijst(kanaries)) {
    const proef = weegUitvoer(200, { veld: k.waarde }, kanaries);
    if (!proef.lek) {
      console.error('DE METER IS BLIND: een antwoord met de kanarie "' + k.waarde + '" erin\n' +
        'wordt niet als lek gezien. Dan zegt "nul lekken" hieronder niets.');
      klaar(); process.exit(2);
    }
  }
  console.log('  ijking                               : de meter ziet elk van de ' +
    kanarieLijst(kanaries).length + ' kanaries');

  const routes = alleRoutes()
    .filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET')
    .filter(r => !isSchakel(r.pad))       // de schakelkast zou de rest van de meting vergiftigen
    .filter(r => !r.pad.includes(':'))    // een patroon is geen adres
    .map(r => ({ method: r.methode, pad: r.pad, rol: rolVan(r.bewakers) }))
    .filter(r => r.rol);

  console.log('\n=== DE UITVOER PER ROUTE (OUTPUT) ===\n');
  console.log('  kanariekenmerk                       : ' + kenmerk);
  console.log('  routes met een herkenbare rol        : ' + routes.length);

  const uit = await draaiUitvoerproef({ post, routes, tokenVoor, lijfVoor, kanaries, hernieuw, maxPogingen: MAX });

  const rijen = Object.values(uit.perRoute);
  const schoon = rijen.filter(r => r.uitvoer === 'schoon');
  const gezakt = rijen.filter(r => r.uitvoer === 'GEZAKT');
  const poortRijen = rijen.filter(r => r.uitvoer === 'poort');

  console.log('  verzoeken                            : ' + uit.pogingen);
  console.log('  gaf een 2xx (echt gemeten)           : ' + uit.gemeten + ' / ' + routes.length);
  console.log('  nooit een 2xx (ONGEMETEN)            : ' + poortRijen.length);
  console.log('  tokens onderweg opnieuw gehaald      : ' + uit.hernieuwd);
  console.log('  antwoord met gegevens van een ander  : ' + gezakt.length);
  for (const b of uit.bevindingen.lekken.slice(0, 20)) console.log('      ' + b);

  fs.writeFileSync(UITSLAG, JSON.stringify({
    /* Zonder stempel is een register een meting zonder datum, en die leest als
       vers. scripts/versheid.js en scripts/vertrouwen.js lezen hem allebei. */
    stempel: stempel({ begrenzing: MAX || 'geen' }),
    uitleg: 'Per route: met de JUISTE rol en plausibele invoer, en of het 2xx-antwoord gegevens ' +
      'van een ANDER account bevatte (kanaries) of een geheim veld. Een route die hier NIET in staat ' +
      'is niet beproefd. Een route met uitvoer:"poort" gaf nooit een 2xx en is ONGEMETEN, geen groen. ' +
      'Zie scripts/lib/uitvoerproef.js voor de grens en waarom de lekmerkers niet blind over een 2xx mogen.',
    kanariekenmerk: kenmerk,
    gemeten: { routesMetRol: routes.length, gemeten: uit.gemeten, pogingen: uit.pogingen,
      schoon: schoon.length, gezakt: gezakt.length, achterEenPoort: poortRijen.length,
      tokensHernieuwd: uit.hernieuwd, begrenzing: MAX },
    perRoute: rijen
  }, null, 1) + '\n');
  console.log('\n  weggeschreven in UITVOERPROEF.json');

  klaar();
  process.exit(gezakt.length ? 1 : 0);
})().catch(e => { console.error('de uitvoerproef viel om: ' + (e && e.stack || e)); process.exit(2); });
