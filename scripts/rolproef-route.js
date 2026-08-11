#!/usr/bin/env node
/* ============================================================================
   DE ROL-SCHEIDING, PER ROUTE -- zodat de bewijsmatrix er iets mee kan.

   WAAROM DIT ER IS. scripts/lib/rolproef.js meet al het goede ding: hij stuurt
   PLAUSIBELE invoer met de verkeerde rol (rommel wordt door de validatie
   geweigerd voordat de autorisatie aan de beurt is, en bewijst dus niets over
   rechten), kijkt of er een 2xx uitkomt, en scant de WEIGERING op gegevens die
   er niet in horen. Maar hij draait binnen de Beproeving en rapporteert
   geaggregeerd: "0 van de 900 pogingen kwam binnen".

   Dat getal is goed nieuws en geen bewijs per endpoint. De bewijsmatrix vraagt
   iets preciezers -- van WELKE route weten we dit? -- en zolang dat antwoord
   ontbreekt staan ACL en PRIVACY daar op ongemeten voor alle 3985 routes,
   terwijl er in werkelijkheid al honderden zijn beproefd.

   Dit script draait dezelfde proef los, tegen een EIGEN server met een eigen
   datamap, en schrijft ROLPROEF.json: per route welke verkeerde rollen zijn
   geprobeerd en wat eruit kwam. Geen tweede scanner, geen tweede oordeel --
   het oordeel valt in lib/rolproef.js en dit script zet het weg.

   WAT EEN ROUTE HIER VERDIENT, en wat niet:

     bewezen    er is met minstens één verkeerde rol op geklopt, met plausibele
                invoer, en er is naar het antwoord gekeken.
     ongemeten  er is niet op geklopt. Een leesroute, een publieke route, of hij
                viel buiten de begrenzing van deze ronde.

   Een route die niet is geprobeerd krijgt NIETS. Dat lijkt vanzelfsprekend en
   is het niet: de verleiding is om "geen bevinding" als groen te lezen, en dan
   dekt deze ronde 3985 routes af terwijl hij er een paar honderd heeft geraakt.

   Draai:  node --experimental-sqlite scripts/rolproef-route.js
           node --experimental-sqlite scripts/rolproef-route.js --max=300
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { draaiRolproef } = require('./lib/rolproef');
const { alleRoutes } = require('./lib/routes');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'ROLPROEF.json');
const argv = process.argv.slice(2);
const MAX = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 600;

/* De rol die een route TOEBEHOORT, uit de bewaker in de bron. Ruw maar
   voldoende: we hoeven alleen te weten welke rollen de VERKEERDE zijn, en een
   route waarvan we de rol niet kennen slaan we over in plaats van te gokken --
   met de juiste rol aankloppen bewijst niets over scheiding. */
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
  const datamap = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rolproef-'));
  const basis = 'http://127.0.0.1:' + poort;

  const kind = spawn(process.execPath, ['--experimental-sqlite', path.join(WORTEL, 'server', 'server.js')], {
    cwd: WORTEL, stdio: 'ignore',
    /* RTG_DEMO=1 op de EIGEN wegwerpserver, en dat verdient uitleg. De demo-inlogs
       zijn in de gewone stand uitgeschakeld; zonder die schakelaar komt deze proef
       aan geen enkel rol-token en meldt hij "geen bevindingen" over routes die hij
       nooit heeft aangeraakt. De demo-vlag mint alleen de TOKENS -- de routes die
       daarna worden beproefd zijn de echte, met hun echte bewakers ervoor. */
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

  /* De drie rollen. Lukt er een niet, dan zeggen we dat en gaan we NIET door met
     twee: een proef die de derde rol mist, meldt "geen bevindingen" over routes
     die nooit met de gevaarlijkste rol zijn benaderd. */
  const member = (await post('/api/login', { tier: 'rtg' })).data.token;
  const office = (await post('/api/office/login', { code: 'RTG-OFFICE-PROEF' })).data.token;
  const supplier = (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).data.token;
  const ontbreekt = Object.entries({ member, office, supplier }).filter(([, t]) => !t).map(([r]) => r);
  if (ontbreekt.length) {
    console.error('geen token voor: ' + ontbreekt.join(', ') + ' -- de proef zou dan doen alsof die rollen zijn beproefd');
    klaar(); process.exit(2);
  }

  const routes = alleRoutes()
    .filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET')
    .map(r => ({ method: r.methode, pad: r.pad, rol: rolVan(r.bewakers) }))
    .filter(r => r.rol);

  console.log('\n=== DE ROL-SCHEIDING PER ROUTE ===\n');
  console.log('  schrijfroutes met een herkenbare rol : ' + routes.length);
  console.log('  begrenzing per rol                   : ' + MAX);

  const uit = await draaiRolproef({ post, routes, tokensVoor: () => ({ member, supplier, office }), maxPerRol: MAX });

  if (uit.bevindingen.meterStuk) {
    console.error('\n  DE METER IS BLIND: ' + uit.bevindingen.meterStuk);
    klaar(); process.exit(2);
  }

  const perRoute = Object.values(uit.perRoute);
  const open = perRoute.filter(r => r.acl === 'OPEN');
  const lek = perRoute.filter(r => r.privacy === 'LEK');

  console.log('  routes werkelijk beproefd            : ' + perRoute.length);
  console.log('  pogingen                             : ' + uit.pogingen);
  console.log('  verkeerde rol kwam BINNEN            : ' + open.length);
  for (const r of open.slice(0, 10)) console.log('      ' + r.methode + ' ' + r.pad);
  console.log('  weigering gaf gegevens mee           : ' + lek.length);
  for (const r of lek.slice(0, 10)) console.log('      ' + r.methode + ' ' + r.pad);
  console.log('  blijvende wijziging na afloop        : ' +
    (uit.bevindingen.gewijzigd.length ? uit.bevindingen.gewijzigd.join(', ') : 'geen'));

  fs.writeFileSync(UITSLAG, JSON.stringify({
    uitleg: 'Per SCHRIJFroute welke verkeerde rollen zijn geprobeerd, met plausibele invoer. ' +
      'Een route die hier NIET in staat is niet beproefd -- dat is ongemeten en geen groen. ' +
      'Zie scripts/lib/rolproef.js voor wat de proef wel en niet uitsluit.',
    gemeten: { routesMetRol: routes.length, beproefd: perRoute.length, pogingen: uit.pogingen,
      aclOpen: open.length, privacyLek: lek.length,
      /* Blijvende wijziging na afloop: een handler die eerst schrijft en daarna
         pas de rechten controleert, geeft keurig 403 terug terwijl de mutatie al
         is gebeurd. De statuscode klopt dan en de database niet. */
      zijeffecten: uit.bevindingen.gewijzigd.length,
      /* Een ronde waarin de vingerafdruk blind was, telt niet als schoon maar
         als NIET GEMETEN -- zie de ijking in lib/rolproef.js. */
      blindeRondes: uit.bevindingen.meterStuk ? 1 : 0,
      begrenzing: MAX },
    perRoute
  }, null, 1) + '\n');
  console.log('\n  weggeschreven in ROLPROEF.json');

  klaar();
  process.exit(open.length || lek.length ? 1 : 0);
})().catch(e => { console.error('de rolproef viel om: ' + (e && e.message)); process.exit(2); });
