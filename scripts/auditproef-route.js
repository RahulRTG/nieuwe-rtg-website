#!/usr/bin/env node
/* ============================================================================
   HET AUDITSPOOR, PER ROUTE -- de AUDIT-kolom van de bewijsmatrix.

   Het oordeel staat in scripts/lib/auditproef.js (en is daar los te toetsen);
   dit script zet er een echte server omheen en schrijft AUDITPROEF.json.

   Vierde in dezelfde familie: rolproef (verkeerde rol), invoerproef (rommel),
   idemproef (twee keer dezelfde sleutel), auditproef (blijft er iets van
   staan). Ze delen de wegwerpserver, de demo-tokens en het plausibele lijf,
   want vier definities van "plausibel" is vier plekken die uiteenlopen.

   DEZE PROEF MUTEERT ECHT: hij voert per route een opdracht uit die kan
   slagen. Dat is de prijs van meten of er een spoor achterblijft -- en de reden
   dat hij nooit ergens anders dan op een wegwerpmap draait.

   WAAROM HIJ HET SPOOR VIA DE OFFICE-ROUTE LEEST en niet uit de database:
   omdat dat de weg is die een echte auditor ook heeft. Kan een mens het spoor
   niet opvragen, dan bestaat het voor hem niet, en dan hoort deze proef daar
   over te vallen in plaats van in het bestand op schijf gelijk te krijgen.

   Draai:  node scripts/auditproef-route.js
           node scripts/auditproef-route.js --max=200
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { draaiAuditproef } = require('./lib/auditproef');
const { plausibelLijf } = require('./lib/rolproef');
const { alleRoutes, isSchakel } = require('./lib/routes');
const { gereedschapsomgeving } = require('./lib/wegwerpserver');
const { maakSleutels, haalSleutels, ONMISBAAR } = require('./lib/proefsleutels');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'AUDITPROEF.json');
const argv = process.argv.slice(2);
const MAX = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 0;   // 0 = alles

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

async function wachtOpServer(basis, ms) {
  const eind = Date.now() + ms;
  while (Date.now() < eind) {
    try { const r = await fetch(basis + '/api/health'); if (r.ok) return true; } catch (e) {}
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

(async () => {
  const poort = await vrijePoort();
  const datamap = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-auditproef-'));
  const basis = 'http://127.0.0.1:' + poort;

  const kind = spawn(process.execPath, [path.join(WORTEL, 'server', 'server.js')], {
    cwd: WORTEL, stdio: 'ignore',
    /* De omgeving komt uit lib/wegwerpserver: RTG_DEMO=1 is op zichzelf een
       no-op geworden (server/testomgeving.js), en deze twee instrumenten hebben
       nog hun eigen spawn en zouden die reparatie dus mislopen. Dat is precies
       hoe de andere elf hem wel kregen en deze twee niet. */
    env: gereedschapsomgeving({ poort, datamap },
      { RTG_DEMO: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF' })
  });

  const klaar = () => { try { kind.kill('SIGKILL'); } catch (e) {} try { fs.rmSync(datamap, { recursive: true, force: true }); } catch (e) {} };
  process.on('exit', klaar);

  if (!await wachtOpServer(basis, 60000)) { console.error('de server kwam niet op'); klaar(); process.exit(2); }

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

  /* De sleutelbos staat in ./lib/proefsleutels.js: zes instrumenten hadden hier
     dezelfde drie rollen staan, en dus alle zes dezelfde blinde vlek voor alles
     achter boardroomAuth en techAuth. */
  const bos = maakSleutels({ post, officeCode: 'RTG-OFFICE-PROEF' });
  const inlog = bos.inlog;
  const { tokens, mislukt } = await haalSleutels(bos);
  const ontbreekt = ONMISBAAR.filter(r => !tokens[r]);
  if (ontbreekt.length) {
    console.error('geen token voor: ' + ontbreekt.join(', ') + ' -- de proef zou dan doen alsof die routes zijn beproefd');
    klaar(); process.exit(2);
  }
  const tokenVoor = (rol) => tokens[rol];
  const hernieuw = async (rol) => {
    try { const t = await inlog[rol](); if (t) { tokens[rol] = t; return true; } } catch (e) {}
    return false;
  };

  /* Het spoor lezen gaat via de kantoorroute -- dezelfde weg die een auditor
     heeft. Zonder office-token is er niets te lezen en valt de proef om, en dat
     hoort ook: een spoor dat niemand kan opvragen is geen spoor. */
  const spoorVan = async (actie) => {
    const r = await post('/api/command/apispoor', { n: 5, actie }, tokens.office);
    return r.status === 200 && r.data && typeof r.data === 'object' ? r.data : null;
  };
  const stand = async () => {
    const r = await post('/api/command/apispoor', { n: 1 }, tokens.office);
    return r.status === 200 && r.data && typeof r.data.aantal === 'number' ? r.data.aantal : null;
  };

  const routes = alleRoutes()
    .filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET')
    .filter(r => !isSchakel(r.pad))
    .filter(r => !r.pad.includes(':'))
    .filter(r => r.pad !== '/api/command/apispoor')     // de leesroute meet zichzelf niet
    .map(r => ({ method: r.methode, pad: r.pad, rol: rolVan(r.bewakers) }))
    .filter(r => r.rol);

  console.log('\n=== HET AUDITSPOOR PER ROUTE ===\n');
  console.log('  routes met een herkenbare rol        : ' + routes.length);

  /* De tegenproef van de meter: een kantoorinlog met de VERKEERDE code wordt
     geweigerd (en hoort dus geen spoor te maken), met de goede code slaagt hij
     (en hoort dat wel te doen). Twee keer dezelfde route, zodat het verschil
     alleen in de uitkomst zit en niet in het pad. */
  const ijking = {
    geweigerd: () => post('/api/office/login', { code: 'DIT-IS-NIET-DE-CODE' }),
    geslaagd: () => post('/api/office/login', { code: 'RTG-OFFICE-PROEF' })
  };

  const uit = await draaiAuditproef({
    post, routes, tokenVoor, hernieuw, spoorVan, stand, ijking,
    lijfVoor: (r) => plausibelLijf(r.pad), maxRoutes: MAX,
    wacht: (ms) => new Promise(r => setTimeout(r, ms))
  });

  if (uit.meterStuk) {
    console.error('\n  DE METER IS BLIND: ' + uit.meterStuk);
    klaar(); process.exit(2);
  }

  /* IJKING 3: is de keten na afloop nog heel? Duizenden regels erbij en dan een
     breuk, betekent dat het spoor zelf niet deugt -- en dan is geen enkele
     "bewezen" hierboven iets waard. */
  const slot = await post('/api/command/apispoor', { n: 1 }, tokens.office);
  const keten = slot.status === 200 && slot.data ? slot.data.keten : null;
  const ketenHeel = !!(keten && keten.heel);

  const t = uit.telling;
  const beoordeeld = t.bewezen + t.gezakt;
  console.log('  ijking                               : geweigerde handeling bleef stil, geslaagde telde ' +
    ((uit.ijking && uit.ijking.geslaagdGeteld) || 0));
  console.log('  oproepen                             : ' + uit.oproepen);
  console.log('  tokens onderweg opnieuw gehaald      : ' + uit.hernieuwd);
  console.log('  BEOORDEELD (de oproep deed werk)     : ' + beoordeeld + ' / ' + routes.length);
  console.log('      liet een spoor na (bewezen)      : ' + t.bewezen);
  console.log('      geen spoor (GEZAKT)              : ' + t.gezakt);
  console.log('  ongemeten                            : ' + t.ongemeten + '   <- de oproep kwam niet door');
  console.log('  keten na afloop                      : ' + (ketenHeel ? 'heel (' + (keten.regels || 0) + ' regels)' : 'GEBROKEN -- ' + JSON.stringify(keten)));

  const gezakt = Object.values(uit.perRoute).filter(r => r.audit === 'gezakt');
  for (const r of gezakt.slice(0, 20)) console.log('      ' + r.methode + ' ' + r.pad);
  if (gezakt.length > 20) console.log('      ... en nog ' + (gezakt.length - 20));

  fs.writeFileSync(UITSLAG, JSON.stringify({
    uitleg: 'Per schrijfroute: is er na een geslaagde oproep een regel bijgekomen in het API-spoor ' +
      '(server/opzet/auditspoor.js), gelezen via dezelfde kantoorroute die een auditor gebruikt. ' +
      '"gezakt" is hier WEL een defect-oordeel: een handeling die lukt zonder spoor is achteraf niet ' +
      'terug te vinden. De ronde ijkt twee keer: de stand mag niet uit zichzelf oplopen, en de keten ' +
      'moet na afloop heel zijn.',
    gemeten: { routesMetRol: routes.length, beoordeeld,
      bewezen: t.bewezen, gezakt: t.gezakt, ongemeten: t.ongemeten,
      oproepen: uit.oproepen, tokensHernieuwd: uit.hernieuwd,
      ketenHeel, ketenRegels: (keten && keten.regels) || 0,
      ijkingGeweigerdStil: !!(uit.ijking && uit.ijking.geweigerdStil),
      ijkingGeslaagdGeteld: (uit.ijking && uit.ijking.geslaagdGeteld) || 0,
      blindeRondes: uit.meterStuk ? 1 : 0, begrenzing: MAX },
    perRoute: Object.values(uit.perRoute)
  }, null, 1) + '\n');
  console.log('\n  weggeschreven in AUDITPROEF.json');

  klaar();
  /* Een gebroken keten laat deze proef WEL zakken: dat is geen bevinding over
     een route maar een defect aan het instrument zelf. Een route zonder spoor
     is een bevinding en maakt CI niet rood -- zie LAT.md. */
  process.exit(ketenHeel ? 0 : 1);
})().catch(e => { console.error('de auditproef viel om: ' + (e && e.stack || e)); process.exit(2); });
