#!/usr/bin/env node
/* ============================================================================
   WAAROM IS DEZE ROUTE ONGEMETEN? -- de ronde.

   De staatproef beproeft 3364 routes en bewijst er 252. De andere 3112 dragen
   allemaal hetzelfde woord: ONGEMETEN. Dit instrument vraagt ze waarom, en het
   antwoord komt uit hun eigen mond: status en boodschap, ingedeeld door
   scripts/lib/waarom.js in zeven soorten met per soort wat eraan te doen is.

   HET VERSCHIL DAT DIT MAAKT. Voor: "3112 routes ongemeten". Na: "1136 willen
   een bestaand object, 385 willen andere velden, 617 willen een andere rol". Het
   eerste is een zorg, het tweede is werk.

   DE OPZET IS DIE VAN DE ANDERE PROEVEN: een eigen wegwerpserver met een eigen
   datamap, de demo-inlog, en aanroepen MET de rol die bij de route hoort. Wie
   dit op de ontwikkeldata loslaat, doet duizenden schrijfverzoeken op echte
   gegevens -- vandaar de eigen map.

   HIJ SCHRIJFT NIETS VAST TENZIJ JE HET VRAAGT. Zonder --vastleggen komt de
   uitslag op het scherm; met --vastleggen gaat hij naar WAAROM.json.

     node --experimental-sqlite scripts/waarom.js
     node --experimental-sqlite scripts/waarom.js --vastleggen
     node --experimental-sqlite scripts/waarom.js --max=200      (steekproef)
     node --experimental-sqlite scripts/waarom.js --json

   WAT HIJ NIET DOET: oordelen over de route. Een 404 op een verzonnen
   identiteit is precies goed gedrag. Dit is een uitspraak over ons meetwerk.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { start, WORTEL } = require('./lib/wegwerpserver');
const { alleRoutes, verdeelOpRol } = require('./lib/routes');
const { plausibelLijf } = require('./lib/rolproef');
const wm = require('./lib/waarom');
const { maakPool } = require('./lib/objectpool');
const { maakSessiewacht } = require('./lib/sessiewacht');
const { stempel } = require('./lib/stempel');

const REGISTER = path.join(WORTEL, 'WAAROM.json');
const vastleggen = process.argv.includes('--vastleggen');
const jsonUit = process.argv.includes('--json');
const maxArg = (process.argv.find(a => a.startsWith('--max=')) || '').slice(6);
const MAX = Number(maxArg) || 0;

/* ALLEEN DOEN ALS IEMAND DIT BESTAND DRAAIT. Zonder deze wacht start een hele
   ronde zodra iets dit bestand require't -- de keuring, een toets, of iemand die
   even wil kijken of het laadt. Bij de rolproef kostte precies dat een meting.
   Zie scripts/meetkeuring.js, regel `wacht`. */
if (require.main !== module) { module.exports = {}; return; }

(async () => {
  const kandidaten = alleRoutes().filter(r => r.pad.startsWith('/api/') && r.methode === 'POST' &&
    !/\/(login|logout|register)$/.test(r.pad));
  const server = await start({ naam: 'waarom', env: { RTG_DEMO: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF' } });
  const basis = server.basis;

  const post = async (pad, lijf, tok) => {
    try {
      const r = await fetch(basis + pad, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
        body: JSON.stringify(lijf || {}) });
      const tekst = await r.text();
      let data = null; try { data = JSON.parse(tekst); } catch (e) {}
      return { status: r.status, data, tekst };
    } catch (e) { return { status: 0, data: null, tekst: String((e && e.message) || e) }; }
  };

  /* Dezelfde demo-inlog als de staatproef: in RTG_DEMO-modus is dat een gewone
     inlog en geen achterdeur. Lukt een rol niet, dan komen zijn routes met die
     reden terug in plaats van zonder sleutel te worden aangeklopt. */
  const inlog = {
    member: async () => (await post('/api/login', { tier: 'rtg' })).data.token,
    office: async () => (await post('/api/office/login', { code: 'RTG-OFFICE-PROEF' })).data.token,
    supplier: async () => (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).data.token
  };
  const tokens = {};
  for (const rol of Object.keys(inlog)) { try { tokens[rol] = await inlog[rol](); } catch (e) {} }
  /* DE SESSIEWACHT. Deze ronde loopt langs ALLE schrijfroutes, en /api/logout
     hoort daarbij: vanaf dat punt deelde hij routes in op een antwoord dat
     alleen maar "u bent niet ingelogd" was. Zie scripts/lib/sessiewacht.js voor
     de regel en waarom hij op drie instrumenten tegelijk zat. */
  const wacht = maakSessiewacht({ post, rollen: Object.fromEntries(Object.keys(inlog).map(rol => [rol, {
    vers: async () => { try { return await inlog[rol](); } catch (e) { return null; } },
    zet: (t) => { tokens[rol] = t; }
  }])) });
  const roep = (pad, lijf, rol) => wacht.roep(pad, lijf, rol, tokens[rol]);
  const mist = Object.keys(inlog).filter(r => !tokens[r]);
  if (mist.length) { console.error('geen token voor: ' + mist.join(', ')); server.klaar(); process.exitCode = 2; return; }

  const verdeling = verdeelOpRol(kandidaten, Object.keys(inlog));
  let routes = verdeling.metRol;
  if (MAX) routes = routes.slice(0, MAX);

  /* DE EERSTE GANG oogst en passant: elk geslaagd antwoord draagt echte id's,
     en de objectpool onthoudt ze per domein (scripts/lib/objectpool.js). */
  const pool = maakPool();
  const indelingen = [];
  for (const r of routes) {
    const u = await roep(r.pad, plausibelLijf(r.pad), r.rol);
    if (u.status >= 200 && u.status < 300) pool.leer(u.data, r.pad);
    const d = wm.deel(u.status, wm.boodschapVan(u.data, u.tekst));
    indelingen.push({ route: r.methode + ' ' + r.pad, rol: r.rol, status: u.status,
      soort: d.soort, door: d.door, omdat: d.omdat });
  }

  /* DE TWEEDE GANG: de routes die een bestaand object wilden, nu met een lijf
     dat echte id's uit hun eigen domein draagt. Oogsten is geen raden -- de
     waarden komen uit antwoorden die deze ronde zelf zag, op deze server.
     Alleen een indeling die daadwerkelijk verandert wordt overgenomen, met
     metPool erbij zodat het register laat zien welk deel van het antwoord op
     de pool leunt. */
  let herwonnen = 0, herprobeerd = 0;
  for (const i of indelingen) {
    /* Ook veld-ontbreekt: "welk bedrijf?" is vaak een id-VELDNAAM die de pool
       inmiddels uit dat domein kent. Niet-van-jou en conflict bewust niet --
       daar is het object er wel en zegt een tweede id niets nieuws. */
    if (i.soort !== 'object-ontbreekt' && i.soort !== 'veld-ontbreekt') continue;
    const pad = i.route.slice(i.route.indexOf(' ') + 1);
    const { lijf, velden } = pool.verrijk(plausibelLijf(pad), pad);
    if (!velden.length) continue;
    herprobeerd++;
    const u2 = await roep(pad, lijf, i.rol);
    if (u2.status >= 200 && u2.status < 300) pool.leer(u2.data, pad);
    const d2 = wm.deel(u2.status, wm.boodschapVan(u2.data, u2.tekst));
    if (d2.soort !== i.soort) {
      Object.assign(i, { status: u2.status, soort: d2.soort, door: d2.door, omdat: d2.omdat, metPool: true });
      herwonnen++;
    }
  }
  const poolStand = pool.grootte();
  server.klaar();

  const geteld = wm.telling(indelingen);
  /* DE ROUTES ZONDER ROL HOREN ERBIJ, en niet als voetnoot. Ze zijn niet
     beproefd omdat dit instrument geen sleutel voor hun rol heeft -- dat is een
     ontbrekende voorwaarde als alle andere, en de enige met een naam. */
  const zonderRol = verdeling.redenen.map(x => ({ reden: x.reden, aantal: x.aantal }));

  const uit = {
    stempel: stempel(),
    uitleg: 'Per POST-route: waarom hij niet te bewijzen valt, in de woorden van de route zelf. ' +
      'Zeven soorten met per soort wat eraan te doen is; zie scripts/lib/waarom.js.',
    grens: wm.CONTROL.grens,
    gemeten: { kandidaten: kandidaten.length, routes: routes.length,
      bereikt: geteld.find(s => s.id === 'bereikt').aantal,
      onbekend: geteld.find(s => s.id === 'onbekend').aantal,
      /* HOE HARD IS DEZE INDELING. Zie scripts/lib/waarom.js: wie het laatste
         woord had, de boodschap van de route of alleen zijn statuscode. */
      uitBoodschap: indelingen.filter(i => i.door === 'boodschap').length,
      uitStatus: indelingen.filter(i => i.door === 'status').length,
      pool: { ...poolStand, herprobeerd, herwonnen }, sessieHernieuwd: wacht.hernieuwd() },
    zonderRol,
    soorten: geteld,
    perRoute: Object.fromEntries(indelingen.map(i => [i.route, { rol: i.rol, status: i.status, soort: i.soort, omdat: i.omdat,
      ...(i.metPool ? { metPool: true } : {}) }]))
  };

  if (jsonUit) { console.log(JSON.stringify(uit, null, 1)); process.exitCode = 0; return; }

  console.log('\n=== WAAROM ONGEMETEN ===\n');
  console.log('  ' + routes.length + ' routes bevraagd met de rol die erbij hoort\n');
  for (const s of geteld) {
    console.log('  ' + String(s.aantal).padStart(5) + '  ' + s.id.padEnd(18) + s.wat);
    if (s.aantal) console.log('           nodig: ' + s.nodig);
  }
  for (const z of zonderRol) console.log('  ' + String(z.aantal).padStart(5) + '  (geen ronde)      ' + z.reden);
  console.log('\n  objectpool: ' + poolStand.domeinen + ' domeinen, ' + poolStand.velden + ' velden geoogst; ' +
    herprobeerd + ' object-routes herprobeerd, ' + herwonnen + ' herwonnen');
  console.log('  sessie hernieuwd na een dode 401: ' + wacht.hernieuwd() +
    '  (deze ronde loopt ook langs de uitlogroutes)');
  const uitB = indelingen.filter(i => i.door === 'boodschap').length;
  console.log('\n  ' + uitB + ' van de ' + indelingen.length + ' ingedeeld op wat de route ZEGT, ' +
    (indelingen.length - uitB) + ' alleen op zijn statuscode.');
  console.log('  Die tweede groep is grover: 404 is zowel "bestaat niet" als "niet van jou".');
  console.log('\n  "ongemeten" is geen uitspraak over de route maar over ons meetwerk.');
  console.log('  Elke regel hierboven noemt de voorwaarde die eraan ontbreekt.\n');

  if (vastleggen) {
    fs.writeFileSync(REGISTER, JSON.stringify(uit, null, 1) + '\n');
    console.log('  vastgelegd in WAAROM.json\n');
  }
  process.exitCode = 0;
})().catch(e => { console.error('de ronde viel om: ' + (e && e.stack || e)); process.exitCode = 2; });
