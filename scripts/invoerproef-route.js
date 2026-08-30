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

   Draai:  node scripts/invoerproef-route.js
           node scripts/invoerproef-route.js --max=2000
           node scripts/invoerproef-route.js --seed=99
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');
const { draaiInvoerproef } = require('./lib/invoerproef');
const { alleRoutes, isSchakel, verdeelOpRol, meldZonderRol } = require('./lib/routes');
const { maakSleutels, haalSleutels, ONMISBAAR } = require('./lib/proefsleutels');
const { maakTeller, maakRommel } = require('./lib/rommel');
/* Wanneer is dit gemeten, en waartegen. Zonder stempel is een register niet na
   te lopen: verouderd ziet er identiek uit aan vers. Zie scripts/lib/stempel.js. */
const { stempel, eisSchoneBoom } = require('./lib/stempel');

/* WEIGEREN VOOR HET BEGINT. Deze ronde duurt minuten en levert een register op
   dat NERGENS meetelt zodra er ongecommit werk in de boom staat -- boomVuil
   wordt pas aan het eind vastgesteld. Zie de kop van ./lib/stempel.js voor de
   drie rondes die daar in een zitting aan zijn opgegaan. */
function wachtOpSchoneBoom() {
  const b = eisSchoneBoom('de invoerproef');
  if (b.ok) return;
  console.error('\n  DEZE RONDE ZOU NIET MEETELLEN\n');
  console.error('  ' + b.reden);
  for (const r of (b.bestanden || [])) console.error('    ' + r);
  process.exit(3);
}

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'INVOERPROEF.json');
const argv = process.argv.slice(2);
const MAX = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 0;   // 0 = geen begrenzing
const SEED = Number((argv.find(a => a.startsWith('--seed=')) || '').slice(7)) || 20260812;
const RONDES = Number((argv.find(a => a.startsWith('--rondes=')) || '').slice(9)) || 2;

/* rolVan() woont in ./lib/routes.js, samen met de REDEN waarom een rol soms niet
   te bepalen valt. Hij stond hier woordelijk, en in drie andere proef-scripts nog
   eens -- vier kopieen van dezelfde afleiding (LAT.md regel 4). */


/* ALLEEN DOEN ALS IEMAND DIT BESTAND DRAAIT. Zonder deze wacht start een
   VOLLEDIGE meetronde zodra iets dit bestand require't -- een toets, de keuring,
   of iemand die alleen even wil kijken of het laadt. Dat is hier echt gebeurd:
   een onschuldige laadcontrole draaide de rolproef met de STANDAARDbegrenzing en
   schreef ROLPROEF.json van 3377 beproefde routes terug naar 292. Het register
   zag er daarna volkomen normaal uit.

   scripts/bewijsmatrix.js heeft deze wacht al sinds hij ooit de hele testrunner
   meenam. Dezelfde wacht hoort op elk instrument dat bij het draaien een register
   OVERSCHRIJFT. */
if (require.main !== module) { module.exports = {}; return; }
wachtOpSchoneBoom();

(async () => {
  /* DE GEDEELDE WEGWERPSERVER. Hier stond de eigen kopie die de kop al een
     maand ontkende ('ze delen de wegwerpserver') -- de tekst beloofde wat de
     code niet deed, en zo lopen kopieen uiteen zonder dat iemand het ziet
     (LAT.md regel 4 en 6, en de post wegwerpserver-kopieen in
     BEWIJSSCHULD.json). */
  const server = await start({ naam: 'invoerproef', env: { RTG_DEMO: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF' } });
  const { basis, klaar } = server;

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
  /* De sleutelbos staat in ./lib/proefsleutels.js: zes instrumenten hadden hier
     dezelfde drie rollen staan, en dus alle zes dezelfde blinde vlek voor alles
     achter boardroomAuth en techAuth. */
  const bos = maakSleutels({ post, officeCode: 'RTG-OFFICE-PROEF' });
  const inlog = bos.inlog;
  const { tokens, mislukt } = await haalSleutels(bos);
  const ontbreekt = ONMISBAAR.filter(r => !tokens[r]);
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

  const kandidaten = alleRoutes()
    .filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET')
    /* De schakelkast krijgt geen rommel: die zou functies uitzetten en daarmee
       elke meting erna vergiftigen. Hij staat in lib/routes.js zodat de
       Beproeving en deze proef dezelfde lijst gebruiken. */
    .filter(r => !isSchakel(r.pad))
    /* Een pad met :parameters bestaat als patroon en niet als adres; er letterlijk
       heen posten meet een 404 en geen validatie. */
    .filter(r => !r.pad.includes(':'));
  /* De verdeling in plaats van een filter. `.filter(r => r.rol)` liet hier
     honderden routes verdwijnen zonder dat er ergens een getal omhoog ging; nu
     komen ze met hun reden terug en staan ze straks ook in het uitslagbestand. */
  /* ALLEEN ROLLEN WAARVOOR DIT INSTRUMENT EEN TOKEN HEEFT. Sinds de
     bewakerskaart ook eigenrollen kent (boardroom, techniek, scim,
     werkplekbaas) kwamen 123 routes hier binnen als "met rol" terwijl er
     geen sleutel voor bestaat: de invoerproef stuurt rommel MET de juiste rol; zonder token voor die rol
     meet hij de voordeur en niet de invoercontrole.
     Ze komen nu met die reden terug in het uitslagbestand (LAT.md regel 3). */
  const verdeling = verdeelOpRol(kandidaten, Object.keys(tokens));
  /* DE ROLLEN WAARVOOR ER WERKELIJK EEN SLEUTEL IS, en niet de rollen die dit
     instrument kon PROBEREN. Hier stond Object.keys(inlog), en dat is subtiel
     iets anders: mislukt een inlog (geen demo-eigenaar in deze database), dan
     zou die rol toch als "beproefbaar" tellen, zonder token worden aangeroepen,
     401 krijgen en dat als uitslag opleveren. Een meting zonder invoer die toch
     een cijfer geeft -- LAT.md regel 3. */
  const routes = verdeling.metRol;

  console.log('\n=== DE INVOER-ROBUUSTHEID PER ROUTE ===\n');
  console.log('  seed                                 : ' + SEED);
  console.log('  routes gevonden                      : ' + kandidaten.length);
  console.log('  routes met een herkenbare rol        : ' + routes.length);
  meldZonderRol(verdeling);
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
    stempel: stempel(),
    uitleg: 'Per route: rommel met de JUISTE rol, en of er een 5xx of een intern spoor uit kwam. ' +
      'Een route die hier NIET in staat is niet beproefd. Een route met invoer:"poort" stond achter ' +
      'een tweede grendel en is ONGEMETEN, geen groen. Zie scripts/lib/invoerproef.js voor de grens.',
    seed: SEED,
    /* WAT ER NIET IS BEPROEFD, met de reden erbij. Zonder dit veld leest
       routesMetRol als "dit zijn de routes" terwijl het "dit is wat we konden
       bereiken" betekent -- en dat verschil was jarenlang 1257 routes groot. */
    nietBeproefbaar: verdeling.zonderRol.length,
    redenenNietBeproefbaar: verdeling.redenen,
    routesGevonden: kandidaten.length,
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
