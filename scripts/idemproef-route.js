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

   Draai:  node scripts/idemproef-route.js
           node scripts/idemproef-route.js --max=200
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');
const { draaiIdemproef } = require('./lib/idemproef');
const { plausibelLijf } = require('./lib/rolproef');
const { alleRoutes, isSchakel, verdeelOpRol, meldZonderRol } = require('./lib/routes');
/* Wanneer is dit gemeten, en waartegen. Zonder stempel is een register niet na
   te lopen: verouderd ziet er identiek uit aan vers. Zie scripts/lib/stempel.js. */
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'IDEMPROEF.json');
const argv = process.argv.slice(2);
const MAX = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 0;   // 0 = alles

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

(async () => {
  /* DE GEDEELDE WEGWERPSERVER. Hier stond de eigen kopie die de kop al een
     maand ontkende ('ze delen de wegwerpserver') -- de tekst beloofde wat de
     code niet deed, en zo lopen kopieen uiteen zonder dat iemand het ziet
     (LAT.md regel 4 en 6, en de post wegwerpserver-kopieen in
     BEWIJSSCHULD.json). */
  const server = await start({ naam: 'idemproef', env: { RTG_DEMO: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF' } });
  const { basis, klaar } = server;

  const post = async (pad, lijf, tok) => {
    try {
      const r = await fetch(basis + pad, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
        body: JSON.stringify(lijf || {}) });
      const tekst = await r.text();
      let data; try { data = JSON.parse(tekst); } catch (e) { data = tekst; }
      return { status: r.status, data, staat: r.headers.get('x-rtg-staat') };
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
  /* ALLEEN ROLLEN WAARVOOR DIT INSTRUMENT EEN TOKEN HEEFT. Sinds de
     bewakerskaart ook eigenrollen kent (boardroom, techniek, scim,
     werkplekbaas) kwamen 123 routes hier binnen als "met rol" terwijl er
     geen sleutel voor bestaat: de idemproef herhaalt een oproep MET de juiste rol; zonder token voor die rol
     wordt elke herhaling even hard geweigerd en zegt de gelijkheid niets.
     Ze komen nu met die reden terug in het uitslagbestand (LAT.md regel 3). */
  const verdeling = verdeelOpRol(kandidaten, Object.keys(inlog));
  const routes = verdeling.metRol;

  console.log('\n=== DE IDEMPOTENTIE PER ROUTE ===\n');
  console.log('  routes gevonden                      : ' + kandidaten.length);
  console.log('  routes met een herkenbare rol        : ' + routes.length);
  meldZonderRol(verdeling);
  console.log('  oproepen per route                   : 3  (K1, K1 opnieuw, K2 vers)');

  /* DE WERELD KLAARZETTEN, VOOR ER GEMETEN WORDT -- ./lib/idemwereld.js.

     Het plausibele lijf is voor alle routes hetzelfde en weet niet welke IBAN of
     welke codenaam er in DEZE database bestaan; het gevolg was dat 2.221 routes
     hun eerste oproep zagen stranden op "deed geen werk". Een route die niets
     doet, kun je niet betrappen op een tweede keer doen. Daarom bouwt die module
     eerst een echte wereld (rekening, saldo, pas, vaste betaling, twee klompjes)
     en levert per geldroute het lijf met de veldnamen van DIE route. Waarom per
     route, en waarom de kredietroutes NIET worden opengebroken, staat daar. */
  const { zetWereldKlaar } = require('./lib/idemwereld');
  const { extra, perRoute: geldLijven } = await zetWereldKlaar({ post, tokens, login: inlog });
  console.log('  wereld klaargezet                    : ' +
    (Object.keys(extra).length ? Object.keys(extra).join(', ') : 'NIETS -- de proef meet dan als vanouds'));
  console.log('  geldroutes met een eigen lijf        : ' + Object.keys(geldLijven).length);

  /* ============================================================================
     HET TWEEDE MEETPUNT IJKEN.

     Elk antwoord draagt de stand per collectie. Maar sommige collecties
     veranderen bij ELK verzoek -- `doorgeefjournaal` schrijft een regel per
     verzoek, ook bij lezen. Zonder die ruis eruit zou elke oproep "werk gedaan"
     lijken en was dit meetpunt meteen blind. In stand 2 weegt dit zwaarder dan
     in stand 1: een inhoudsafdruk ziet ook de tellers en tijdstempels die bij
     elk verzoek een tik krijgen, dus er is MEER te ijken en niet minder.

     Wie de ruis is, staat daarom nergens als lijst: we METEN het. Een handvol
     oproepen die niets doen (een leesroute), kijken wat er dan toch groeit, en
     dat uitsluiten. Een handgeschreven lijst zou stil verouderen zodra er een
     teller bij komt; deze ijking niet. Zelfde gedachte als de per-route ijking
     in de proef zelf: eerst zien dat de meter kan bewegen. */
  const staatlog = require('../server/staatlog');
  const ruis = new Set();
  let ijkStand = null, staatWerkt = false;
  {
    const eerste = await post('/api/pay/overzicht', {}, tokens.member);
    ijkStand = eerste.staat || null;
    for (let i = 0; i < 6 && ijkStand != null; i++) {
      const nu = await post('/api/pay/overzicht', {}, tokens.member);
      if (nu.staat == null) break;
      for (const k of Object.keys(staatlog.verschil(ijkStand, nu.staat))) ruis.add(k);
      ijkStand = nu.staat;
    }
    staatWerkt = ijkStand != null;
  }
  /* DE VASTLEGGING wordt hier NIET geijkt, en dat is een gemeten keuze. Deze
     ijking draait op een LEESroute en vindt daarmee alleen wat bij ELK verzoek
     groeit (`doorgeefjournaal`). Collecties die bij elke HANDELING een regel
     schrijven -- `kantoorAudit`, `commandJournaal`, `securityLog` -- groeien bij
     lezen niet en komen hier dus nooit boven. Twee automatische zeven zijn hier
     op gemeten data gestrand (een steekproefronde, en een verhouding over alle
     deltas: die vond er nul, want een kantoorjournaal groeit alleen bij
     kantoorroutes). Ze staan nu bij naam en met reden in IDEMBESLUIT.json --
     zie de uitleg in scripts/lib/idemproef.js voor waarom een besluit hier
     beter is dan een slimmigheid, en hoe die lijst zelf gecontroleerd wordt. */
  console.log('  tweede meetpunt (de opslag)          : ' + (staatWerkt
    ? 'aan; ruis geijkt op ' + (ruis.size ? [...ruis].join(', ') : 'niets')
    : 'UIT -- geen X-RTG-Staat-kop; de proef meet alleen het antwoord'));

  /* Het verschil dat DEZE oproep achterliet. De stand loopt door over de hele
     ronde: elk antwoord is het nieuwe ijkpunt voor het volgende. */
  let vorigeStand = ijkStand;
  const staatVan = !staatWerkt ? null : (antwoord) => {
    if (!antwoord || antwoord.staat == null) return {};
    const d = staatlog.verschil(vorigeStand, antwoord.staat, ruis);
    vorigeStand = antwoord.staat;
    return d;
  };

  let register = {};
  try { register = JSON.parse(fs.readFileSync(path.join(WORTEL, 'IDEMBESLUIT.json'), 'utf8')); } catch (e) {}
  const besluiten = register.routes || {};

  const uit = await draaiIdemproef({ post, routes, tokenVoor, hernieuw,
    lijfVoor: (r) => ({ ...plausibelLijf(r.pad), ...extra, ...(geldLijven[r.pad] || {}) }), maxRoutes: MAX, staatVan,
    vastlegging: register.vastlegging });

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
  console.log('      waarvan gezien aan de OPSLAG     : ' + (uit.uitOpslag || 0) +
    '   <- het antwoord zei niets; de opslag wel');
  console.log('  ongemeten                            : ' + t.ongemeten +
    '   <- geen werk gedaan, of het antwoord reageert niet op een nieuwe oproep');
  /* De lijst met vastleggingen uit IDEMBESLUIT.json, met de controle erop: onder
     hoeveel verschillende routefamilies groeide elk van die collecties? Een
     doorlopende vastlegging groeit onder routes die verder niets met elkaar te
     maken hebben; groeit er een onder maar EEN familie, dan is het domeinwerk
     dat in de lijst is gezet -- en dan verdwijnt er een bevinding achter een
     regel in een bestand. Dat hoort hardop te klinken. */
  console.log('  vastlegging (geldt niet als werk)    : ' + ((uit.vastleggingGemeten || []).length
    ? uit.vastleggingGemeten.map(v => v.collectie + ' (' + v.families + ' routefamilies)').join(', ')
    : 'niets in IDEMBESLUIT.json'));
  for (const k of (uit.vastleggingVerdacht || [])) {
    console.log('      LET OP: ' + k + ' groeide maar onder EEN routefamilie -- dat lijkt domeinwerk, ' +
      'geen doorlopende vastlegging. Haal hem uit IDEMBESLUIT.json of onderbouw hem opnieuw.');
  }
  if (uit.tegenspraken && uit.tegenspraken.length) {
    console.log('  TEGENSPRAAK antwoord vs opslag       : ' + uit.tegenspraken.length + '   (elk nagetrokken met een vierde oproep)');
    for (const p of uit.tegenspraken.slice(0, 10)) console.log('      ' + p);
  }
  if (uit.vermoedensVerworpen) {
    console.log('  vermoedens die niet herhaalbaar waren: ' + uit.vermoedensVerworpen +
      '   <- bij B bewoog er iets dat bij een vierde oproep niet terugkwam');
  }

  /* ============================================================================
     ELKE ONBESCHERMDE ROUTE DRAAGT EEN BESLUIT (TAKEN.md 4.30).

     "Onbeschermd" is een telling en geen defect -- twee keer op bewaren drukken
     hoort twee notities op te leveren. Maar dan moet iemand dat wel HEBBEN
     BESLOTEN, en niet: het stond er en niemand keek. Het verschil tussen die
     twee is precies wat deze lijst zonder besluitregister niet kon laten zien.

     IDEMBESLUIT.json draagt per route waarom een herhaling daar mag (of niet).
     Wat hier onbeschermd uitkomt en er NIET in staat, is een route waarover nog
     niemand heeft nagedacht. Die worden bij naam genoemd. Ze maken deze proef
     niet rood -- dat zou een bevinding zijn en geen blindheid -- maar ze staan
     in het register onder `zonderBesluit`, zodat het getal niet stilletjes kan
     groeien. */
  const onbeschermd = Object.values(uit.perRoute).filter(r => r.idempotentie === 'onbeschermd');
  const zonderBesluit = onbeschermd.filter(r => !besluiten[r.pad]).map(r => r.pad);
  for (const r of onbeschermd.slice(0, 20)) console.log('      ' + r.methode + ' ' + r.pad + (besluiten[r.pad] ? '' : '   <- GEEN BESLUIT'));
  if (onbeschermd.length > 20) console.log('      ... en nog ' + (onbeschermd.length - 20));
  console.log('  onbeschermd MET een besluit          : ' + (onbeschermd.length - zonderBesluit.length) + ' / ' + onbeschermd.length);
  if (zonderBesluit.length) console.log('      zonder besluit in IDEMBESLUIT.json: ' + zonderBesluit.length);

  fs.writeFileSync(UITSLAG, JSON.stringify({
    stempel: stempel(),
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
      uitOpslag: uit.uitOpslag || 0, ruisGeijkt: [...ruis], vastlegging: uit.vastleggingGemeten || [],
      blindeRondes: uit.meterStuk ? 1 : 0, begrenzing: MAX,
      wereldKlaargezet: Object.keys(extra), geldroutesMetEigenLijf: Object.keys(geldLijven).length,
      onbeschermdMetBesluit: onbeschermd.length - zonderBesluit.length },
    zonderBesluit, tegenspraken: uit.tegenspraken || [], vastleggingVerdacht: uit.vastleggingVerdacht || [],
    vermoedensVerworpen: uit.vermoedensVerworpen || 0,
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
