#!/usr/bin/env node
/* ============================================================================
   DE AUDIT-PROEF, PER ROUTE -- laat deze schrijfroute een spoor na?

   WAAROM DIT ER IS. De AUDIT-kolom van de bewijsmatrix stond op 0 van 3987
   routes, en de reden was eerlijk: er viel niets te meten, want er was geen
   algemeen spoor. Sinds server/lib/handelingsspoor.js in de lijfpoort hangt is
   dat er wel. Maar een voorziening die bestaat is geen cel die gemeten is --
   precies wat er in de kop van bewijsmatrix.js staat -- en dus meet dit script.

   DE PROEF. Voor elke schrijfroute met een herkenbare rol: klop aan MET de
   juiste rol en plausibele invoer, en kijk daarna of er een geketende regel
   voor dat pad in het spoor staat.

   Dat is het spiegelbeeld van scripts/rolproef-route.js, en dat verschil is de
   moeilijkheid: die proef klopt aan met de VERKEERDE rol en wil dat er niets
   gebeurt. Deze heeft juist SUCCES nodig, en dus echte mutaties. Vandaar een
   eigen wegwerpserver met een eigen datamap -- er komt geen handeling van deze
   proef in de buurt van een echte installatie.

   DRIE OORDELEN, en het derde is waar de eerlijkheid zit:

     bewezen    de route gaf 2xx EN er staat een geketende regel voor zijn pad
     gezakt     de route gaf 2xx en er staat GEEN regel -- er is iets gebeurd
                zonder spoor, en dat is precies wat deze kolom moet vinden
     ongemeten  de route gaf geen 2xx. Er is dus niets gebeurd, en dan HOORT er
                geen regel te zijn. Zonder dit derde oordeel zou elke route die
                netjes weigert als defect tellen, en dan meet de proef zijn
                eigen invoer in plaats van de software.

   WAT DEZE PROEF NIET ZEGT. Dat het spoor VOLLEDIG is: hij kijkt of er een
   regel verscheen, niet of alles wat er in staat klopt. En hij zegt niets over
   de routes die hij niet bereikte -- die blijven ongemeten, en dat is geen
   groen.

   EEN BEKENDE RUIS, en die hoort hier genoemd: het spoor legt elke GESLAAGDE
   POST vast, ook een POST die eigenlijk alleen leest (dit huis gebruikt POST
   ook voor lezen). Die regels zijn geen handeling maar staan er wel. Voor deze
   proef maakt dat niets uit -- hij vraagt of er een spoor IS -- maar voor wie
   het spoor leest is het ruis, en dat staat als bekende beperking in
   server/lib/handelingsspoor.js.

   Draaien: node scripts/handelingproef-route.js [--max=N]
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { alleRoutes } = require('./lib/routes');
const wegwerp = require('./lib/wegwerpserver');
const { plausibelLijf } = require('./lib/rolproef');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'HANDELINGPROEF.json');
const argv = process.argv.slice(2);
const MAX = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 400;

/* De rol die een route TOEBEHOORT. Dezelfde afleiding als in
   rolproef-route.js -- daar om de VERKEERDE rol te kiezen, hier om de JUISTE
   te kiezen. Een route waarvan we de rol niet kennen slaan we over: aankloppen
   met de verkeerde rol levert een weigering op, en dat meet niets. */
function rolVan(bewakers) {
  const b = bewakers.join(' ');
  if (/supplierAuth/.test(b)) return 'supplier';
  if (/officeAuth|kantoorAuth|adminOnly/.test(b)) return 'office';
  if (/\bauth\b|eisAccount|\blid\b/.test(b)) return 'member';
  return null;
}

/* VIA DE GEDEELDE WEGWERPSERVER, en dat was hij niet. Dit bestand had een eigen
   `vrijePoort()`, een eigen `wacht()` en een eigen `spawn` met een eigen
   env-lijst -- alle drie een tweede uitvoering van wat scripts/lib/wegwerpserver.js
   al doet. Dat kostte meteen twee dingen: de standaard `RTG_SCHORSPOORT_UIT=1`
   die daar op 2 september 2026 bij kwam kreeg deze proef niet (zie de uitleg
   daar over de lus die zichzelf dichttrok), en `RTG_MAGNAAT_TEST` ontbrak
   waardoor de demo-deur dichtstond en de proef struikelde op "geen token voor:
   member, supplier". Een tweede plek voor een waarheid, en de zwakste won
   (LAT.md regel 4). */

/* DE WACHT VOOR HET REQUIREN, en die stond hier niet.

   Dit script SCHRIJFT een register. Een laadcontrole (`node -e "require(...)"`)
   startte daarmee de hele proef met de standaardbegrenzing en schreef het
   register terug -- dat is een keer echt gebeurd met ROLPROEF.json, dat van 3377
   beproefde routes terugviel naar 292 en er daarna volkomen normaal uitzag.
   scripts/meetkeuring.js handhaaft deze regel; hij zag dit bestand pas toen het
   op 2 september 2026 een stempel kreeg en daarmee als register meetelde. */
if (require.main !== module) return;

(async () => {
  /* RTG_DEMO + RTG_MAGNAAT_TEST minten alleen de TOKENS; de routes die daarna
     worden beproefd zijn de echte, met hun echte bewakers ervoor. Zelfde
     afweging als in rolproef-route.js, en om dezelfde reden daar uitgelegd. */
  const server = await wegwerp.start({ naam: 'handelingproef',
    env: { RTG_DEMO: '1', RTG_MAGNAAT_TEST: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF' } });
  const basis = server.basis;
  const klaar = () => server.klaar();

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

  const member = (await post('/api/login', { tier: 'rtg' })).data.token;
  const office = (await post('/api/office/login', { code: 'RTG-OFFICE-PROEF' })).data.token;
  const supplier = (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).data.token;
  const tokens = { member, office, supplier };
  const ontbreekt = Object.entries(tokens).filter(([, t]) => !t).map(([r]) => r);
  if (ontbreekt.length) {
    console.error('geen token voor: ' + ontbreekt.join(', ') + ' -- dan zou de proef doen alsof die rollen zijn beproefd');
    klaar(); process.exit(2);
  }

  const routes = alleRoutes()
    .filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET')
    .map(r => ({ methode: r.methode, pad: r.pad, rol: rolVan(r.bewakers) }))
    .filter(r => r.rol)
    .slice(0, MAX);

  console.log('\n=== DE AUDIT-PROEF PER ROUTE ===\n');
  console.log('  schrijfroutes met een rol : ' + routes.length + ' (begrenzing ' + MAX + ')');

  /* EERST AANKLOPPEN, DAN EEN KEER HET SPOOR LEZEN.

     Het spoor na elke oproep opvragen zou het kwadratisch maken EN het spoor
     vervuilen met de leesoproepen zelf. Nu is het een ronde en een lezing. */
  const gedaan = [];
  for (const r of routes) {
    const st = await post(r.pad, plausibelLijf(r.pad), tokens[r.rol]);
    gedaan.push({ methode: r.methode, pad: r.pad, rol: r.rol, status: st.status });
  }

  const spoor = await post('/api/office/handelingen', { max: 1000 }, office);
  if (spoor.status !== 200 || !Array.isArray(spoor.data && spoor.data.regels)) {
    console.error('het handelingsspoor was niet te lezen (status ' + spoor.status + ') -- ' +
      'dan zou elke route hier onterecht als "gezakt" tellen');
    klaar(); process.exit(2);
  }
  const metSpoor = new Set(spoor.data.regels.map(x => x.pad));
  const ketenOk = spoor.data.keten && spoor.data.keten.ok;

  const perRoute = gedaan.map(g => {
    const gelukt = g.status >= 200 && g.status < 300;
    const spoorErvan = metSpoor.has(g.pad);
    return Object.assign({}, g, {
      audit: !gelukt ? 'ongemeten' : (spoorErvan ? 'bewezen' : 'gezakt'),
      reden: !gelukt ? 'de oproep deed geen werk (status ' + g.status + '), dus er hoort geen regel te zijn'
        : (spoorErvan ? 'er staat een geketende regel voor dit pad' : 'de oproep slaagde maar liet geen spoor na')
    });
  });

  const tel = (s) => perRoute.filter(r => r.audit === s).length;
  console.log('  bewezen                   : ' + tel('bewezen'));
  console.log('  GEZAKT (werk zonder spoor): ' + tel('gezakt'));
  for (const r of perRoute.filter(x => x.audit === 'gezakt').slice(0, 10)) console.log('      ' + r.methode + ' ' + r.pad);
  console.log('  ongemeten (geen 2xx)      : ' + tel('ongemeten'));
  console.log('  keten van het spoor       : ' + (ketenOk ? 'klopt' : 'GEBROKEN'));

  fs.writeFileSync(UITSLAG, JSON.stringify({
    /* Zonder stempel is een register een meting zonder datum, en die leest als
       vers. scripts/versheid.js en scripts/vertrouwen.js lezen hem allebei. */
    stempel: stempel({ begrenzing: MAX || 'geen' }),
    uitleg: 'Per schrijfroute: liet een geslaagde oproep een geketende regel na in het handelingsspoor? ' +
      'Een route die hier NIET in staat is niet beproefd, en dat is ongemeten en geen groen. ' +
      '"ongemeten" betekent hier: de oproep gaf geen 2xx, dus er is niets gebeurd en er hoort geen regel te zijn.',
    gemeten: {
      routesMetRol: routes.length, beproefd: perRoute.length,
      bewezen: tel('bewezen'), gezakt: tel('gezakt'), ongemeten: tel('ongemeten'),
      ketenOk: !!ketenOk, begrenzing: MAX
    },
    perRoute
  }, null, 1) + '\n');
  console.log('\n  weggeschreven in HANDELINGPROEF.json');

  klaar();
  process.exit(tel('gezakt') || !ketenOk ? 1 : 0);
})().catch(e => { console.error('de handelingproef viel om: ' + (e && e.message)); process.exit(2); });
