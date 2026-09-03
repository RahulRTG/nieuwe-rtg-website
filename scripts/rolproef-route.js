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

   Draai:  node scripts/rolproef-route.js
           node scripts/rolproef-route.js --max=300
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');
const { maakPool } = require('./lib/objectpool');
const { maakSessiewacht } = require('./lib/sessiewacht');
const { draaiRolproef, plausibelLijf } = require('./lib/rolproef');
const { alleRoutes, verdeelOpRol, meldZonderRol } = require('./lib/routes');
/* Wanneer is dit gemeten, en waartegen. Zonder stempel is een register niet na
   te lopen: verouderd ziet er identiek uit aan vers. Zie scripts/lib/stempel.js. */
const { stempel, eisSchoneBoom } = require('./lib/stempel');

/* WEIGEREN VOOR HET BEGINT. Deze ronde duurt minuten en levert een register op
   dat NERGENS meetelt zodra er ongecommit werk in de boom staat -- boomVuil
   wordt pas aan het eind vastgesteld. Zie de kop van ./lib/stempel.js voor de
   drie rondes die daar in een zitting aan zijn opgegaan. */
function wachtOpSchoneBoom() {
  const b = eisSchoneBoom('de rolproef');
  if (b.ok) return;
  console.error('\n  DEZE RONDE ZOU NIET MEETELLEN\n');
  console.error('  ' + b.reden);
  for (const r of (b.bestanden || [])) console.error('    ' + r);
  process.exit(3);
}

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'ROLPROEF.json');
const argv = process.argv.slice(2);
const MAX = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 600;

/* rolVan() stond hier woordelijk, en in de drie andere proef-scripts nog eens.
   Hij woont nu in ./lib/routes.js, samen met de REDEN waarom een rol soms niet te
   bepalen valt -- want die redenen horen geteld te worden en niet stil te
   verdwijnen achter een filter. */


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
      /* RTG_MAGNAAT_TEST=1 ERBIJ, en dat is geen tweede vlag voor hetzelfde.
         `server/testomgeving.js` bepaalt of de synthetische demo-accounts
         bestaan, en die vraagt sinds zijn aanscherping OF `RTG_MAGNAAT_TEST=1`,
         OF `NODE_ENV=test` SAMEN met `RTG_DEMO=1`. Deze ronde zette alleen die
         laatste helft, dus stond de demo-deur dicht en gaf zowel
         /api/login als /api/supplier/login een 403 -- de proef struikelde met
         "geen token voor: member, supplier" en het register bleef staan zoals
         het was. Dat is precies goed van hem (een proef zonder rol hoort niet te
         doen alsof hij die rol beproefde), maar het betekende wel dat dit
         register stil verouderde.

         WAAROM NIET `NODE_ENV=test` erbij. Dat zou ook werken en het is de
         verkeerde helft: zestien plekken in server/ versoepelen hun controle
         onder NODE_ENV=test (gezinsvalidatie, pincode-eisen, een limiet in
         bedrijf/index.js). Een proefronde die dat aanzet, meet een LOSSER huis
         dan er draait. RTG_MAGNAAT_TEST opent alleen de synthetische accounts;
         de routes die daarna worden beproefd zijn de echte. scripts/auditproef-route.js
         deed het al zo. */
  const server = await start({ naam: 'rolproef',
    env: { RTG_DEMO: '1', RTG_MAGNAAT_TEST: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF' } });
  const { basis, klaar } = server;

  /* De objectpool: oogsten in de wikkel, verrijken via lijfVoor. Een verkeerde
     rol met een ECHT object-id bereikt de eigenaarschapsvraag zelf -- precies
     de laag waar de kale lijven op 404 strandden. */
  const pool = maakPool();
  const post = async (pad, lijf, tok) => {
    try {
      const r = await fetch(basis + pad, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
        body: JSON.stringify(lijf || {}) });
      const tekst = await r.text();
      let data; try { data = JSON.parse(tekst); } catch (e) { data = tekst; }
      if (r.status >= 200 && r.status < 300 && data && typeof data === 'object') pool.leer(data, pad);
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

  const kandidaten = alleRoutes()
    .filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET');
  /* De verdeling in plaats van een filter. `.filter(r => r.rol)` liet hier 937
     routes verdwijnen zonder dat er ergens een getal omhoog ging; nu komen ze
     met hun reden terug en staan ze straks ook in het uitslagbestand. */
  const verdeling = verdeelOpRol(kandidaten);
  const routes = verdeling.metRol;

  console.log('\n=== DE ROL-SCHEIDING PER ROUTE ===\n');
  console.log('  schrijfroutes gevonden               : ' + kandidaten.length);
  console.log('  schrijfroutes met een herkenbare rol : ' + routes.length);
  meldZonderRol(verdeling);
  console.log('  begrenzing (pogingen in totaal)      : ' + MAX);

  /* DE OOGSTGANG: een keer langs alle routes met de EIGEN rol, alleen om de
     pool te vullen. De kruisronde daarna roept met verkeerde rollen en die
     slagen (hopelijk) nooit -- zonder deze gang blijft de pool leeg en is
     het verrijkte lijf een leeg gebaar.

     EN HIJ LOGDE ZICHZELF UIT. Alle routes langsgaan betekent ook /api/logout
     aanroepen, en daarna liep de rest van deze gang zonder sessie: van de 609e
     route af kreeg elke member-route een 401, oogstte de pool niets meer, en
     was de VINGERAFDRUK dood. De ijking eronder zag daardoor geen enkele
     legitieme wijziging meer en zette de hele proef stil met "DE METER IS
     BLIND" -- terecht, maar de oorzaak lag hier en niet in de meter. Gevonden
     door na elke member-route te kijken of /api/pay/overzicht nog antwoordde.

     De reparatie is geen lijst met uitzonderingen (die veroudert stil, LAT.md
     regel 4) maar herstel op de waarneming: een 401 op je EIGEN rol betekent
     dat je sessie weg is, en dan halen we een verse. Zo mag deze gang de deur
     achter zich dichttrekken; hij loopt gewoon terug naar binnen. */
  const versToken = {
    member: async () => (await post('/api/login', { tier: 'rtg' })).data.token,
    office: async () => (await post('/api/office/login', { code: 'RTG-OFFICE-PROEF' })).data.token,
    supplier: async () => (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).data.token
  };
  const eigenTokens = { member, supplier, office };
  const wacht = maakSessiewacht({ post, rollen: Object.fromEntries(Object.keys(versToken).map(rol => [rol, {
    vers: async () => { try { return await versToken[rol](); } catch (e) { return null; } },
    zet: (t) => { eigenTokens[rol] = t; }
  }])) });
  for (const r of routes) {
    const tk = eigenTokens[r.rol];
    if (!tk) continue;
    await wacht.roep(r.pad, plausibelLijf(r.pad), r.rol, Array.isArray(tk) ? tk[0] : tk);
  }
  if (wacht.hernieuwd()) console.log('  sessie hernieuwd tijdens de oogstgang : ' + wacht.hernieuwd() +
    '  (deze gang raakt ook de uitlogroutes aan)');

  /* tokensVoor leest uit eigenTokens en niet uit de drie constanten van de
     inlog: na de oogstgang kunnen die vervangen zijn. */
  const uit = await draaiRolproef({ post, routes, tokensVoor: () => ({ ...eigenTokens }), maxPogingen: MAX,
    lijfVoor: (r) => pool.verrijk(plausibelLijf(r.pad), r.pad).lijf });

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
    stempel: stempel(),
    uitleg: 'Per SCHRIJFroute welke verkeerde rollen zijn geprobeerd, met plausibele invoer. ' +
      'Een route die hier NIET in staat is niet beproefd -- dat is ongemeten en geen groen. ' +
      'Zie scripts/lib/rolproef.js voor wat de proef wel en niet uitsluit.',
    /* WAT ER NIET IS BEPROEFD, met de reden erbij. Zonder dit veld leest
       routesMetRol als "dit zijn de routes" terwijl het "dit is wat we konden
       bereiken" betekent -- en dat verschil was jarenlang 1257 routes groot. */
    nietBeproefbaar: verdeling.zonderRol.length,
    /* MET DE NAMEN ERBIJ, en niet alleen de aantallen. Een reden met een getal
       ("objectpoort: 106") is niet na te trekken en niet af te trekken: toen de
       IDOR-proef 56 van deze routes bewezen-gescheiden verklaarde, viel er geen
       enkele manier te bedenken om te zeggen WELKE, want dit register kende hun
       namen niet. Nu wel, en BEWIJSSCHULD.json kan de post objectpoort daardoor
       laten krimpen met precies wat een ander instrument heeft beslist. */
    redenenNietBeproefbaar: verdeling.redenen.map(x => Object.assign({}, x, {
      routes: verdeling.zonderRol.filter(z => z.reden === x.reden)
        .map(z => z.methode + ' ' + z.pad).sort()
    })),
    routesGevonden: kandidaten.length,
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
