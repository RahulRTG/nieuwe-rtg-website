#!/usr/bin/env node
/* ============================================================================
   DE TOESTAND PER ROUTE -- STATE, SIDE_EFFECT, ROLLBACK en IDEMPOTENCY.

   Het oordeel staat in scripts/lib/staatproef.js (en is daar los te toetsen);
   dit script zet er een echte server omheen en schrijft STAATPROEF.json.

   Vierde in dezelfde familie: rolproef (verkeerde rol), invoerproef (rommel),
   idemproef (herhaling, gemeten op het ANTWOORD) en deze (herhaling en alles
   eromheen, gemeten op de TOESTAND). Ze delen de wegwerpserver, de demo-tokens
   en het plausibele lijf.

   WAT DEZE ERBIJ HEEFT: de vingerafdruk uit /api/techniek/vingerafdruk. Daarvoor
   logt hij in als de EIGENAAR -- die staat in de seed, dus op een wegwerpserver
   is dat gewoon een inlog en geen achterdeur. Lukt dat niet, dan stopt de proef
   in plaats van te doen alsof hij de toestand heeft gezien.

   DEZE PROEF MUTEERT ECHT, twee keer per route. Dat is de prijs van meten of een
   herhaling iets doet, en de reden dat hij nooit ergens anders dan op een
   wegwerpmap draait.

   Draai:  node --experimental-sqlite scripts/staatproef-route.js
           node --experimental-sqlite scripts/staatproef-route.js --max=200
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { draaiStaatproef } = require('./lib/staatproef');
const { plausibelLijf } = require('./lib/rolproef');
const { alleRoutes, isSchakel } = require('./lib/routes');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'STAATPROEF.json');
const argv = process.argv.slice(2);
const MAX = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 0;

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
    const s = net.createServer(); s.unref(); s.on('error', rej);
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
  const datamap = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-staatproef-'));
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
  const mist = Object.keys(inlog).filter(r => !tokens[r]);
  if (mist.length) { console.error('geen token voor: ' + mist.join(', ')); klaar(); process.exit(2); }

  /* DE EIGENAAR, voor de vingerafdruk. Hij staat in de seed; dit is een gewone
     inlog en geen achterdeur. Lukt hij niet, dan STOPT de proef -- een ronde
     zonder vingerafdruk zou over elke route "geen wijziging" melden, en dat is
     de gevaarlijkste uitkomst die dit gereedschap kan geven. */
  const eigenaar = (await post('/api/auth/login', {
    login: process.env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com',
    password: process.env.DEMO_PASS || 'Imran' })).data.token;
  if (!eigenaar) {
    console.error('geen eigenaarstoken: zonder /api/techniek/vingerafdruk meet deze proef niets');
    klaar(); process.exit(2);
  }
  const vingerafdruk = async () => {
    const r = await post('/api/techniek/vingerafdruk', {}, eigenaar);
    return r.status === 200 && r.data && r.data.collecties ? r.data : null;
  };
  const proef = await vingerafdruk();
  if (!proef) { console.error('de vingerafdruk kwam niet terug; is /api/techniek/vingerafdruk gemount?'); klaar(); process.exit(2); }

  /* Het VERSCHIL laat de SERVER bepalen, met dezelfde functie die de
     vingerafdruk maakt. Zou dit script zijn eigen vergelijking doen, dan staat
     de regel voor "wat telt als een wijziging" op twee plekken en lopen ze uit
     elkaar (LAT.md regel 4). */
  const verschilVan = async (voor, na) => {
    const r = await post('/api/techniek/vingerafdruk/verschil', { voor, na }, eigenaar);
    return r.status === 200 ? r.data : { aantal: 0, collecties: [], gewijzigd: [] };
  };

  /* DE OMGEVINGSRUIS EERST METEN, niet raden. Een paar verzoeken die niets
     horen te veranderen; wat er dan toch beweegt, is het huis dat opschrijft dat
     er is aangeklopt (doorgeefjournaal, rtgai). Zonder deze stap meldde de
     eerste ronde negentien loze 'geweigerd en toch veranderd' op rij.
     Empirisch en niet met de hand: een geschreven lijst loopt achter zodra er
     een journaal bijkomt, en dan komen de valse bevindingen terug. */
  const routes = alleRoutes()
    .filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET')
    .filter(r => !isSchakel(r.pad))
    .filter(r => !r.pad.includes(':'))
    /* De vingerafdruk-routes zelf niet bestoken: een proef die zijn eigen
       meetinstrument als proefkonijn gebruikt, meet zichzelf. */
    .filter(r => !r.pad.startsWith('/api/techniek/vingerafdruk'))
    .map(r => ({ method: r.methode, pad: r.pad, rol: rolVan(r.bewakers) }))
    .filter(r => r.rol);

  const ruwRoutes = routes;

  const RONDES = 4;
  const geteld = new Map();
  const ijk = async (doe) => {
    for (let i = 0; i < RONDES; i++) {
      const v0 = await vingerafdruk();
      await doe();
      const v1 = await vingerafdruk();
      for (const c of (await verschilVan(v0, v1)).collecties || []) geteld.set(c, (geteld.get(c) || 0) + 1);
    }
  };
  /* TWEE IJKINGEN, EN DE TWEEDE IS ER BIJ GEKOMEN NA EEN RONDE MET ZES VALSE
     BEVINDINGEN. Een GESLAAGD verzoek beweegt andere journalen dan een GEWEIGERD:
     bij een 401 schrijft het huis `securityLog` en `sessions` -- het noteert dat
     iemand met een dood token klopte. Dat is correct gedrag en geen lek, maar de
     eerste ijking zag het niet omdat die met een geldig token las.
     Dus ijken we allebei de kanten op: een geslaagde leesroute en een geweigerd
     verzoek. Wat in ELKE ronde van een van beide beweegt, is ruis. */
  await ijk(() => post('/api/notities/mijn', {}, tokens.member));          // geslaagd
  /* EN DE WEIGERING OP EEN STEEKPROEF UIT DE ECHTE ROUTELIJST. Eerst stond hier
     een vaste route, en dat was te smal: elke auth-laag weigert op zijn eigen
     manier. De RTFoundation-laag schrijft bij een 401 in securityLog en sessions,
     de gewone ledenpoort niet -- en dus meldde de ronde zeven keer 'geweigerd en
     toch veranderd' over een huis dat opschreef dat er was geklopt. De steekproef
     raakt elke poort die er is, zonder dat er ergens een lijst met namen komt. */
  const steek = ruwRoutes.filter((_, i) => i % 120 === 0).slice(0, 30);
  for (const r of steek) await ijk(() => post(r.pad, {}, 'dit-token-bestaat-niet'));
  const ruis = new Set([...geteld].filter(([, n]) => n >= RONDES).map(([c]) => c));
  const eenmalig = [...geteld].filter(([, n]) => n < RONDES).map(([c]) => c);

  console.log('\n=== DE TOESTAND PER ROUTE ===\n');
  console.log('  routes met een herkenbare rol        : ' + routes.length);
  console.log('  collecties in de vingerafdruk        : ' + proef.aantalCollecties);
  console.log('  oproepen per route                   : 2, met 3 vingerafdrukken');
  console.log('  omgevingsruis (elke ronde, genegeerd): ' + (ruis.size ? [...ruis].join(', ') : 'geen'));
  console.log('  eenmalig bewogen (WEL beoordeeld)    : ' + (eenmalig.length ? eenmalig.join(', ') : 'geen') + '\n');

  const uit = await draaiStaatproef({ post, vingerafdruk, routes, tokenVoor: (r) => tokens[r],
    hernieuw: async (rol) => { try { const t = await inlog[rol](); if (t) { tokens[rol] = t; return true; } } catch (e) {} return false; },
    lijfVoor: (r) => plausibelLijf(r.pad), verschilVan, ruis, maxRoutes: MAX });

  if (uit.meterStuk) { console.error('\n  DE METER IS BLIND: ' + uit.meterStuk); klaar(); process.exit(2); }

  const t = uit.telling;
  const rijen = Object.values(uit.perRoute);
  const beoordeeld = rijen.filter(r => r.state === 'bewezen' || r.rollback !== 'ongemeten').length;
  console.log('  oproepen                             : ' + uit.oproepen);
  console.log('  BEOORDEELD                           : ' + beoordeeld + ' / ' + routes.length);
  /* GEEN STILLE AFKAPPING. Draait de ronde met een begrenzing, dan hoort er te
     staan wat er NIET is beproefd -- anders leest 'geen bevindingen' als een
     uitspraak over alle routes terwijl hij er een deel heeft gezien. */
  if (MAX && rijen.length < routes.length) {
    console.log('  NIET BEPROEFD (begrenzing ' + MAX + ')      : ' + (routes.length - rijen.length) +
      '   <- geen bevinding is hier geen uitspraak');
  }
  console.log('      STATE bewezen                    : ' + t.state);
  console.log('      SIDE_EFFECT bewezen              : ' + t.sideEffect);
  console.log('      ROLLBACK bewezen                 : ' + t.rollback);
  console.log('      ROLLBACK GEZAKT                  : ' + t.rollbackGezakt + (t.rollbackGezakt ? '   <- geweigerd en toch veranderd' : ''));
  console.log('      IDEMPOTENCY bewezen              : ' + t.idemBewezen);
  console.log('      IDEMPOTENCY gezakt               : ' + t.idemGezakt);
  console.log('  ongemeten                            : ' + t.ongemeten);

  for (const r of rijen.filter(x => x.rollback === 'GEZAKT').slice(0, 20)) {
    console.log('      ! ' + r.methode + ' ' + r.pad + ' -- ' + r.reden);
  }

  fs.writeFileSync(UITSLAG, JSON.stringify({
    uitleg: 'Per route drie vingerafdrukken rond twee gelijke oproepen. De eerste oproep IJKT: ' +
      'bewoog de toestand niet, dan is er over deze route niets te zeggen en staat alles op ongemeten. ' +
      'Een route die hier NIET in staat is niet beproefd. Zie scripts/lib/staatproef.js voor de grens.',
    gemeten: { routesMetRol: routes.length, beoordeeld, oproepen: uit.oproepen,
      state: t.state, sideEffect: t.sideEffect, rollback: t.rollback, rollbackGezakt: t.rollbackGezakt,
      idemBewezen: t.idemBewezen, idemGezakt: t.idemGezakt, ongemeten: t.ongemeten,
      tokensHernieuwd: uit.hernieuwd, blindeRondes: uit.meterStuk ? 1 : 0,
      collectiesInVingerafdruk: proef.aantalCollecties, ruisCollecties: ruis.size, begrenzing: MAX },
    omgevingsruis: [...ruis],
    perRoute: rijen
  }, null, 1) + '\n');
  console.log('\n  weggeschreven in STAATPROEF.json');
  klaar();
  /* Zakken op ROLLBACK GEZAKT: een verzoek dat wordt geweigerd terwijl de
     toestand toch verandert, is geen bevinding maar een gat in de belofte zelf.
     Op de rest niet -- dat zijn tellingen. */
  process.exit(t.rollbackGezakt ? 1 : 0);
})().catch(e => { console.error('de staatproef viel om: ' + (e && e.stack || e)); process.exit(2); });
