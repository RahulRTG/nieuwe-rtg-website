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

   Draai:  node scripts/staatproef-route.js
           node scripts/staatproef-route.js --max=200
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');
const { draaiStaatproef, stapelRijen, zonderRuis, ruisUit, zonderTijdtik } = require('./lib/staatproef');
const { maakPool } = require('./lib/objectpool');
const { plausibelLijf } = require('./lib/rolproef');
const { alleRoutes, isSchakel, verdeelOpRol, meldZonderRol } = require('./lib/routes');
/* Wanneer is dit gemeten, en waartegen. Zonder stempel is een register niet na
   te lopen: verouderd ziet er identiek uit aan vers. Zie scripts/lib/stempel.js. */
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'STAATPROEF.json');
const argv = process.argv.slice(2);
const MAX = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 0;

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
  const server = await start({ naam: 'staatproef', env: { RTG_DEMO: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF' } });
  const { basis, klaar } = server;

  /* De objectpool oogst in de post-wikkel: elk geslaagd antwoord op DEZE
     server draagt echte id's, en lijfVoor verrijkt er de volgende lijven mee
     (scripts/lib/objectpool.js). Zo bereikt de proef ook de routes die een
     bestaand object willen -- de grootste ongemeten groep. */
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
  const kandidaten = alleRoutes()
    .filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET')
    .filter(r => !isSchakel(r.pad))
    .filter(r => !r.pad.includes(':'))
    /* De vingerafdruk-routes zelf niet bestoken: een proef die zijn eigen
       meetinstrument als proefkonijn gebruikt, meet zichzelf. */
    .filter(r => !r.pad.startsWith('/api/techniek/vingerafdruk'));
  /* De verdeling in plaats van een filter. `.filter(r => r.rol)` liet hier
     honderden routes verdwijnen zonder dat er ergens een getal omhoog ging; nu
     komen ze met hun reden terug en staan ze straks ook in het uitslagbestand. */
  /* ALLEEN ROLLEN WAARVOOR DIT INSTRUMENT EEN TOKEN HEEFT. Sinds de
     bewakerskaart ook eigenrollen kent (boardroom, techniek, scim,
     werkplekbaas) kwamen 123 routes hier binnen als "met rol" terwijl er
     geen sleutel voor bestaat: de staatproef roept aan MET de rol van de route; zonder token voor die rol
     klopt hij zonder sleutel aan en meet hij niets.
     Ze komen nu met die reden terug in het uitslagbestand (LAT.md regel 3). */
  const verdeling = verdeelOpRol(kandidaten, Object.keys(inlog));
  /* DE RONDE STAPELT, NET ALS DE OUTPUT-BAND. Een volle ronde duurt uren en
     een container haalt dat niet; met --max=N mat hij vroeger telkens DEZELFDE
     eerste N routes en gooide de rest van het register weg. Nu: wat er al
     staat blijft staan (met zijn eigen op-stempel), de rij begint bij routes
     ZONDER rij en daarna bij de oudste meting, en de uitslag hieronder is de
     samenvoeging. Zo bereikt een reeks begrensde rondes de hele populatie,
     over herstarts heen -- en de normtand bewijsCellenBewezen kan niet meer
     zakken doordat een kleine ronde een groot register overschrijft. */
  let oudeRijen = [], oudOp = '1970-01-01T00:00:00Z';
  try {
    const oud = JSON.parse(fs.readFileSync(UITSLAG, 'utf8'));
    oudOp = (oud.stempel && oud.stempel.op) || oudOp;
    oudeRijen = oud.perRoute || [];
  } catch (e) {}
  const eerder = new Map(oudeRijen.map(rij => [rij.methode + ' ' + rij.pad, { ...rij, op: rij.op || oudOp }]));
  /* De rij: eerst wat geen rij heeft, dan wat GESCHORST staat (een gezakte
     cel sluit alleen door hermeting, PROOF.md par. 2), dan de oudste meting. */
  const zakte = (r) => r && (r.rollback === 'GEZAKT' || r.idempotentie === 'GEZAKT') ? 0 : 1;
  const routes = verdeling.metRol.slice().sort((x, y) => {
    const a = eerder.get(x.methode + ' ' + x.pad), b = eerder.get(y.methode + ' ' + y.pad);
    if (!a && !b) return 0;
    if (!a) return -1;
    if (!b) return 1;
    return (zakte(a) - zakte(b)) || String(a.op).localeCompare(String(b.op));
  });
  console.log('  routes gevonden                      : ' + kandidaten.length);
  console.log('  routes met een herkenbare rol        : ' + routes.length);
  console.log('  waarvan al een rij in het register   : ' + routes.filter(r => eerder.has(r.methode + ' ' + r.pad)).length);
  meldZonderRol(verdeling);

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
  const aanvraagRuis = ruisUit(geteld, RONDES);
  const eenmalig = [...geteld].filter(([, n]) => n < RONDES).map(([c]) => c);

  /* DE DERDE IJKING: RUIS DIE VAN DE KLOK KOMT, niet van een verzoek.

     WAAROM HIJ ER IS. De twee ijkingen hierboven meten wat een VERZOEK in
     beweging zet. Ze zien per definitie niets van een tijdschakelaar, en die
     staan hier wel: server/opzet/diensten2.js zet elke tien seconden een meting
     in `db.data.wacht`. Landt zo'n tik tussen de eerste en de tweede oproep van
     een route, dan meldt de proef "de herhaling bewoog de toestand opnieuw"
     over een route die niets deed. Dat is precies wat er gebeurde: drie routes
     stonden op GEZAKT in de IDEMPOTENCY-kolom (/api/office/ideeen,
     /api/overheid/water/meld, /api/wereld/feed) met als enige bewogen collectie
     `wacht`.

     WAAROM DIT NIETS KAN WEGPOETSEN. Er wordt in deze rondes NIETS gevraagd op
     de proefroutes -- alleen de vingerafdruk zelf, en die staat al in de
     ruislijst hierboven. Wat hier beweegt, kan dus per definitie niet het werk
     van een route zijn. En de drempel is dezelfde als hierboven: alleen wat in
     ELKE stille ronde bewoog telt mee. Een eenmalige naloper van eerder werk
     haalt die drempel niet.

     WAT HIJ NIET VANGT, en dat hoort erbij: schakelaars die trager lopen dan het
     venster. Gemeten in stilte bewegen ook `techniek`, `ledenSites`, `veilig`,
     `commandAlarmen` en `commandJournaal`, maar niet in elke ronde -- die staan
     hieronder onder "soms". Ze worden dus NIET genegeerd; wie ze in een uitslag
     ziet, weet nu waar hij moet kijken. Het venster oprekken tot ze er allemaal
     in vallen zou de proef minuten kosten en de drempel juist verzwakken. */
  const STIL_RONDES = 3;
  const STIL_MS = Number(process.env.RTG_STAATPROEF_STIL_MS || 11000);   // net over de tik van tien seconden
  const stilGeteld = new Map();
  for (let i = 0; i < STIL_RONDES; i++) {
    const v0 = await vingerafdruk();
    await new Promise(r => setTimeout(r, STIL_MS));
    const v1 = await vingerafdruk();
    for (const c of (await verschilVan(v0, v1)).collecties || []) stilGeteld.set(c, (stilGeteld.get(c) || 0) + 1);
  }
  const tijdruis = ruisUit(stilGeteld, STIL_RONDES);

  /* EN EEN LANGE STILTE, voor de schakelaars die TRAGER lopen dan het venster
     hierboven. kern/command/alarm.js weegt eens per zestig seconden; die tik
     haalt drie rondes van elf seconden nooit alle drie, maar kan wel net tussen
     de twee oproepen van een route vallen -- en dan las de proef "de herhaling
     bewoog de toestand opnieuw" over een route die niets deed.

     Deze ene ronde is NIET voor de globale ruislijst. Wat hij oplevert is
     `stilOoit`: collecties die in stilte uberhaupt bewegen. Die worden alleen
     overgeslagen als de route ze bij zijn EERSTE oproep ook niet aanraakte --
     twee voorwaarden tegelijk, zie zonderTijdtik in ./lib/staatproef.js. Zo
     hoeft de globale lijst niet te verruimen en blijft `commandJournaal` scherp.

     Vijfenzestig seconden: elk venster van meer dan zestig seconden bevat ten
     minste een tik van een minuutschakelaar. */
  const STIL_LANG_MS = Number(process.env.RTG_STAATPROEF_STIL_LANG_MS || 65000);
  const v0 = await vingerafdruk();
  await new Promise(r => setTimeout(r, STIL_LANG_MS));
  const v1 = await vingerafdruk();
  const stilOoit = new Set((await verschilVan(v0, v1)).collecties || []);
  for (const c of stilGeteld.keys()) stilOoit.add(c);
  for (const c of aanvraagRuis) stilOoit.delete(c);   // die gaan er toch al globaal uit

  const somsStil = [...stilGeteld].filter(([c, n]) => n < STIL_RONDES && !aanvraagRuis.has(c)).map(([c]) => c);
  const ruis = new Set([...aanvraagRuis, ...tijdruis]);

  console.log('\n=== DE TOESTAND PER ROUTE ===\n');
  console.log('  routes met een herkenbare rol        : ' + routes.length);
  console.log('  collecties in de vingerafdruk        : ' + proef.aantalCollecties);
  console.log('  oproepen per route                   : 2, met 3 vingerafdrukken');
  console.log('  ruis bij een VERZOEK    (genegeerd)  : ' + (aanvraagRuis.size ? [...aanvraagRuis].join(', ') : 'geen'));
  console.log('  ruis van de KLOK        (genegeerd)  : ' + (tijdruis.size ? [...tijdruis].join(', ') : 'geen') +
    '   <- ' + STIL_RONDES + ' stille rondes van ' + STIL_MS + ' ms');
  console.log('  in stilte OOIT bewogen  (voorwaardelijk): ' + (stilOoit.size ? [...stilOoit].join(', ') : 'geen') +
    '\n' + ' '.repeat(41) + '<- alleen overgeslagen als de route ze bij de EERSTE oproep ook niet raakte');
  console.log('  in stilte SOMS bewogen  (in de korte ronde): ' + (somsStil.length ? somsStil.join(', ') : 'geen'));
  console.log('  eenmalig bewogen (WEL beoordeeld)    : ' + (eenmalig.length ? eenmalig.join(', ') : 'geen') + '\n');

  const uit = await draaiStaatproef({ post, vingerafdruk, routes, tokenVoor: (r) => tokens[r],
    hernieuw: async (rol) => { try { const t = await inlog[rol](); if (t) { tokens[rol] = t; return true; } } catch (e) {} return false; },
    lijfVoor: (r) => pool.verrijk(plausibelLijf(r.pad), r.pad).lijf, verschilVan, ruis, maxRoutes: MAX });

  if (uit.meterStuk) { console.error('\n  DE METER IS BLIND: ' + uit.meterStuk); klaar(); process.exit(2); }

  /* De samenvoeging: vers wint, en wat niet is hermeten houdt zijn oude rij en
     zijn eigen op-stempel. De telling gaat over de SAMENVOEGING; die van
     draaiStaatproef gaat alleen over deze ronde. Regel en toets wonen in
     scripts/lib/staatproef.js (stapelRijen). */
  const { rijen, telling: t, versGemeten } =
    stapelRijen(oudeRijen, oudOp, uit.perRoute, new Date().toISOString());
  const beoordeeld = rijen.filter(r => r.state === 'bewezen' || r.rollback !== 'ongemeten').length;
  console.log('  vers gemeten deze ronde              : ' + versGemeten);
  console.log('  oproepen                             : ' + uit.oproepen);
  console.log('  BEOORDEELD                           : ' + beoordeeld + ' / ' + routes.length);
  /* GEEN STILLE AFKAPPING. Draait de ronde met een begrenzing, dan hoort er te
     staan wat er NIET is beproefd -- anders leest 'geen bevindingen' als een
     uitspraak over alle routes terwijl hij er een deel heeft gezien. */
  if (MAX && rijen.length < routes.length) {
    console.log('  NOG GEEN RIJ (begrenzing ' + MAX + ')       : ' + (routes.length - rijen.length) +
      '   <- geen bevinding is hier geen uitspraak; de volgende ronde begint daar');
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
    stempel: stempel(),
    uitleg: 'Per route drie vingerafdrukken rond twee gelijke oproepen. De eerste oproep IJKT: ' +
      'bewoog de toestand niet, dan is er over deze route niets te zeggen en staat alles op ongemeten. ' +
      'Een route die hier NIET in staat is niet beproefd. De rijen STAPELEN over rondes heen: elke rij ' +
      'draagt zijn eigen op-stempel, een nieuwe ronde hermeet eerst wat geen rij heeft en dan de oudste. ' +
      'Zie scripts/lib/staatproef.js voor de grens.',
    /* WAT ER NIET IS BEPROEFD, met de reden erbij. Zonder dit veld leest
       routesMetRol als "dit zijn de routes" terwijl het "dit is wat we konden
       bereiken" betekent -- en dat verschil was jarenlang 1257 routes groot. */
    nietBeproefbaar: verdeling.zonderRol.length,
    redenenNietBeproefbaar: verdeling.redenen,
    routesGevonden: kandidaten.length,
    gemeten: { routesMetRol: routes.length, beoordeeld, versGemeten, oproepen: uit.oproepen,
      state: t.state, sideEffect: t.sideEffect, rollback: t.rollback, rollbackGezakt: t.rollbackGezakt,
      idemBewezen: t.idemBewezen, idemGezakt: t.idemGezakt, ongemeten: t.ongemeten,
      tokensHernieuwd: uit.hernieuwd, blindeRondes: uit.meterStuk ? 1 : 0,
      collectiesInVingerafdruk: proef.aantalCollecties, ruisCollecties: ruis.size,
      tijdruisCollecties: tijdruis.size, stilleRondes: STIL_RONDES, stilteMs: STIL_MS, begrenzing: MAX },
    /* Drie lijsten in plaats van een. Wie later leest waarom een collectie niet
       meetelde, hoort te zien OF dat kwam doordat elk verzoek hem beweegt of
       doordat de klok dat doet -- en welke tragere schakelaars wel gezien maar
       NIET genegeerd zijn. */
    omgevingsruis: [...ruis],
    ruisBijVerzoek: [...aanvraagRuis],
    ruisVanDeKlok: [...tijdruis],
    inStilteOoitBewogen: [...stilOoit],
    inStilteSomsBewogen: somsStil,
    perRoute: rijen
  }, null, 1) + '\n');
  console.log('\n  weggeschreven in STAATPROEF.json');
  klaar();
  /* Zakken op ROLLBACK GEZAKT: een verzoek dat wordt geweigerd terwijl de
     toestand toch verandert, is geen bevinding maar een gat in de belofte zelf.
     Op de rest niet -- dat zijn tellingen. */
  process.exit(t.rollbackGezakt ? 1 : 0);
})().catch(e => { console.error('de staatproef viel om: ' + (e && e.stack || e)); process.exit(2); });
