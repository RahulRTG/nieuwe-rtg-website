#!/usr/bin/env node
/* ============================================================================
   DE TRECHTER ONDER "ONBEWEZEN" -- waarom heeft deze route geen geldig bewijs?

   HET PROBLEEM DAT DIT OPLOST. Het mutatieboek zegt van elke mutatie WAAR hij
   staat (scripts/mutatieboek.js). Dat is genoeg om te weten hoeveel er nog
   openstaat en veel te weinig om te weten WAT je eraan moet doen. "3430 zonder
   bewijs" is een werkvoorraad waar niemand aan begint, en erger: wie eraan
   begint, gaat broncode lezen voor routes die alleen op een ontbrekende fixture
   vastlopen. Dan wordt menselijke tijd besteed aan een meetprobleem.

   DE ORDE IS DE HELE TRUC. De bakken staan van GOEDKOOP naar DUUR, en een route
   valt in de EERSTE bak die op hem past:

     STALE_BEWIJS        de meting hoort niet meer bij deze code. Opnieuw meten,
                         geen handwerk.
     GEEN_PROEFSLEUTEL   dit instrument heeft geen sleutel voor die deur. Een
                         tekort van de opstelling, niet van de route.
     FIXTURE_401..overig de eerste geldige oproep lukt niet. Uitgesplitst op de
                         GEMETEN statuscode, want die bepaalt de reparatie:
                         401 een inlogfixture, 403 een rol of recht, 404 een
                         ontbrekend object, 409 een toestand, 400/422 een lijf.
     GEEN_EFFECT_BEREIKT de oproep slaagt, maar raakt een no-op toestand. De
                         fixture moet het bedoelde effect mogelijk maken (saldo
                         voor een veegopdracht, een kijker voor een vertrek).
     STAAT_NIET_ZICHTBAAR de route muteert vermoedelijk wel, maar het
                         waarnemingsvlak kijkt er niet naar. Dan hoort het VLAK
                         uitgebreid te worden en niet de route aangepast.
     BIJWERKING_ALLEEN   er bewoog alleen een journaal, een tijdstempel of
                         andere technische bijhouding.
     SEMANTIEK_NODIG     alles hierboven is in orde en toch valt er niets af te
                         leiden. PAS HIER gaat een mens de bron lezen.
     ECHT_DEFECT         fixture klopt, effect treedt op, en een herhaling doet
                         het werk gewoon nog een keer.

   DE INVARIANT DIE DIT EERLIJK HOUDT, en hij is de reden dat dit een register
   is en geen uitdraai:

     ONBEWEZEN mag alleen kleiner worden doordat een route geldig BEWIJS krijgt
     -- nooit doordat een foutreden wordt hernoemd.

   Daarom telt de ratel op het TOTAAL en niet op de bakken. Een route van
   FIXTURE_404 naar SEMANTIEK_NODIG schuiven is vooruitgang in inzicht en nul
   vooruitgang in bewijs, en dat hoort niet als winst te kunnen worden geboekt.
   De bakken bewegen vrij; alleen de som staat vast.

   WAT DIT NIET IS. Geen oordeel over een route, en geen tweede waarheid naast
   het mutatieboek: de statussen komen daarvandaan en de blokkadereden uit
   IDEMPROEF.json. Dit bestand groepeert, het meet niet.

   Draai: node scripts/onbewezen.js            (leesbaar)
          node scripts/onbewezen.js --json
          npm run onbewezen:vast               (schrijft ONBEWEZEN.json)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'ONBEWEZEN.json');
const { alleRoutes, isSchakel, verdeelOpRol } = require('./lib/routes');
const { ROLLEN: ROLLEN_MET_TOKEN } = require('./lib/proefsleutels');
/* Een deur waarvan de sleutel in het LIJF reist heeft geen rol en is toch te
   openen; zie de kop van ./lib/lijfsleutels.js. Zonder deze kennis telt zo'n
   route hier als instrumenttekort terwijl er een sleutel voor te maken is. */
const { dektPad } = require('./lib/lijfsleutels');
const { stempel } = require('./lib/stempel');
const { meting } = require('./lib/idemmeting');
const { SLEUTELS } = require('../server/lib/idemsleutels');

/* De statussen die GELDIG BEWIJS of een controleerbare reden dragen. Wie hier
   staat, staat niet in de trechter. NIET_BEPROEFBAAR staat er met opzet NIET
   bij: "de proef kan er niet bij" is een tekort van de opstelling en hoort in
   de trechter thuis, niet in de eindstand. */
const KLAAR = new Set(['BESCHERMD', 'BEWUST_NIET_IDEMPOTENT', 'NIET_VAN_TOEPASSING']);

const BAKKEN = [
  ['STALE_BEWIJS', 'de meting hoort niet meer bij deze code -- opnieuw meten, geen handwerk'],
  ['GEEN_PROEFSLEUTEL', 'dit instrument heeft geen sleutel voor deze deur; zonder sleutel aankloppen bewijst niets'],
  ['FIXTURE_401', 'de eerste oproep gaf 401 -- er is een authenticatiefixture nodig'],
  ['FIXTURE_403', 'de eerste oproep gaf 403 -- verkeerde rol of ontbrekend recht'],
  ['FIXTURE_404', 'de eerste oproep gaf 404 -- het object of de relatie bestaat niet'],
  ['FIXTURE_409', 'de eerste oproep gaf 409 -- de toestand is niet voorbereid'],
  ['FIXTURE_422', 'de eerste oproep gaf 400 of 422 -- lijf, velden of query kloppen niet'],
  ['FIXTURE_OVERIG', 'de eerste oproep kwam niet door om een andere reden (o.a. 402, 503)'],
  ['GEEN_EFFECT_BEREIKT', 'de oproep slaagt, maar raakt een no-op toestand; de fixture moet het effect mogelijk maken'],
  ['STAAT_NIET_ZICHTBAAR', 'de route muteert vermoedelijk wel, maar het waarnemingsvlak kijkt er niet naar'],
  ['BIJWERKING_ALLEEN', 'er bewoog alleen een journaal, tijdstempel of andere technische bijhouding'],
  ['SEMANTIEK_NODIG', 'niets hierboven blokkeert en toch valt er niets af te leiden -- hier leest een mens de bron'],
  ['ECHT_DEFECT', 'fixture klopt, effect treedt op, en een herhaling doet het werk gewoon nog een keer']
];

/* WANNEER IS EEN METING STALE VOOR EEN ROUTE?

   Niet "het register is oud" -- dat vangt de poort in ./lib/idemmeting.js al
   voor alles tegelijk. Hier gaat het om het geval dat de poort openstaat en de
   meting toch niet meer klopt voor DEZE route: haar bronbestand of haar
   verklaring is na de meting nog gewijzigd. Dat kan in een repo waarin de
   meting op commit X staat en de laatste wijziging aan dat bestand later kwam.

   Gemeten met de commit-tijd van het bestand, gecached per bestand. Is de tijd
   niet te bepalen (geen git, nieuw bestand), dan telt hij NIET als stale: een
   onbekende ouderdom mag geen route in de goedkoopste bak duwen. */
const _tijd = new Map();
function laatstGewijzigd(bestand) {
  if (!bestand) return null;
  if (_tijd.has(bestand)) return _tijd.get(bestand);
  let t = null;
  try {
    const uit = execFileSync('git', ['log', '-1', '--format=%ct', '--', bestand],
      { cwd: WORTEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    t = uit ? Number(uit) * 1000 : null;
  } catch (e) { t = null; }
  _tijd.set(bestand, t);
  return t;
}

function bakVan(r, m, metingOp, geenSleutel) {
  /* EERST DE OPSTELLING, DAN PAS HET REGISTER. Een route waarvoor dit
     instrument geen sleutel heeft, staat niet in IDEMPROEF.json -- en die
     afwezigheid las de eerste versie als "de meting hoort niet meer bij deze
     code", oftewel STALE. Dat is de goedkoopste bak, en er belandden 873 routes
     in die met opnieuw meten geen millimeter opschieten: er is niets om mee aan
     te kloppen. Twee verschillende oorzaken die op hetzelfde symptoom lijken
     (afwezig in het register), met tegengestelde reparaties. */
  if (geenSleutel) return 'GEEN_PROEFSLEUTEL';
  if (!m) return 'STALE_BEWIJS';
  const gewijzigd = laatstGewijzigd(r.bestand);
  if (metingOp && gewijzigd && gewijzigd > metingOp) return 'STALE_BEWIJS';

  const reden = String(m.reden || '');
  const code = Array.isArray(m.statussen) ? m.statussen[0] : 0;
  if (/deed geen werk/.test(reden)) {
    if (code === 401) return 'FIXTURE_401';
    if (code === 403) return 'FIXTURE_403';
    if (code === 404) return 'FIXTURE_404';
    if (code === 409) return 'FIXTURE_409';
    if (code === 400 || code === 422) return 'FIXTURE_422';
    return 'FIXTURE_OVERIG';
  }
  if (m.idempotentie === 'onbeschermd') return 'ECHT_DEFECT';
  if (/alleen een vastlegging|alleen een journaal/.test(reden)) return 'BIJWERKING_ALLEEN';
  /* Het onderscheid dat de eigenaar aanwees: slaagde de oproep en gebeurde er
     niets (no-op toestand), of KEEK het meetpunt gewoon niet mee? Het eerste is
     een fixture-vraag, het tweede een vraag aan het waarnemingsvlak -- en ze
     vragen tegengestelde reparaties. De proef zegt zelf welke van de twee het
     is: alleen als hij de opslag KON zien, is "niets veranderd" een waarneming. */
  if (/veranderde de opslag niet/.test(reden)) return 'GEEN_EFFECT_BEREIKT';
  if (/een tweede effect zou hier niet te zien zijn/.test(reden)) return 'STAAT_NIET_ZICHTBAAR';
  return 'SEMANTIEK_NODIG';
}

function meet() {
  const M = meting();
  const perRoute = M.perRoute;
  /* FAIL-CLOSED, NET ALS DE POORT ZELF. Staat de meting niet toe, dan is er
     geen enkele blokkadereden te noemen: alles zou dan naar de bak vallen die
     toevallig als laatste in de keten staat, en dat is een uitsplitsing die
     gezaghebbend LIJKT en nergens op slaat. Hij is hier ook echt gebeurd: op
     een vuile boom meldde deze trechter 1020 routes als SEMANTIEK_NODIG -- de
     duurste bak, precies de routes waarvan de meting zegt dat ze BESCHERMD
     zijn. Wie daarop was gaan lezen, had duizend keer broncode opengeslagen
     voor een gesloten poort. */
  /* De ruwe uitslag per route, want de bakken hierboven hebben meer nodig dan
     de STATUS die idemmeting.js eruit afleidt. Zelfde bestand, andere vraag. */
  let ruw = {};
  let metingOp = null;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(WORTEL, 'IDEMPROEF.json'), 'utf8'));
    for (const r of (j.perRoute || [])) ruw[r.methode.toUpperCase() + ' ' + r.pad] = r;
    metingOp = j.stempel && j.stempel.op ? Date.parse(j.stempel.op) : null;
  } catch (e) {}

  /* De statussen uit het mutatieboek, want dat is de plek waar ze wonen. Een
     tweede afleiding hier zou binnen een week uit de pas lopen (LAT.md regel 4). */
  const boek = JSON.parse(execFileSync(process.execPath,
    [path.join(__dirname, 'mutatieboek.js'), '--json'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  const statusVan = new Map();
  for (const st of boek.statussen) for (const s of (st.leden || st.voorbeelden || [])) statusVan.set(s, st.id);

  const mutaties = alleRoutes().filter(r => r.pad.startsWith('/api/') && r.methode !== 'GET');
  /* Voor welke routes bestaat er uberhaupt een proefsleutel? Uit dezelfde
     verdeling die het mutatieboek gebruikt, en niet uit een eigen afleiding. */
  const beproefbaar = mutaties.filter(r => !isSchakel(r.pad) && !r.pad.includes(':'));
  const zonderSleutel = new Set();
  for (const x of verdeelOpRol(beproefbaar, ROLLEN_MET_TOKEN).zonderRol) {
    if (dektPad(x.pad)) continue;   // een lijfsleutel is ook een sleutel
    zonderSleutel.add(x.methode.toUpperCase() + ' ' + x.pad);
  }
  for (const r of mutaties) {
    /* Een schakelpad of een :parameter heeft geen sleutel-probleem maar een
       ander probleem, en die staan al in het mutatieboek met hun eigen reden;
       hier tellen ze mee als "geen sleutel" want dit instrument komt er niet. */
    if (isSchakel(r.pad) || r.pad.includes(':')) zonderSleutel.add(r.methode + ' ' + r.pad);
  }
  const uit = {};
  for (const [id] of BAKKEN) uit[id] = [];
  let klaar = 0;
  for (const r of mutaties) {
    const sleutel = r.methode + ' ' + r.pad;
    const v = SLEUTELS[sleutel];
    const st = statusVan.get(sleutel);
    const heeftBewijs = (v && (v.leest || v.nietIdempotent || v.zelfdeVerzoek || v.velden)) ||
      (st && KLAAR.has(st)) || (perRoute[sleutel] && perRoute[sleutel].status === 'BESCHERMD');
    if (heeftBewijs) { klaar++; continue; }
    const bak = bakVan(r, ruw[sleutel], metingOp, zonderSleutel.has(sleutel));
    uit[bak].push(sleutel);
  }

  const onbewezen = Object.values(uit).reduce((n, l) => n + l.length, 0);
  return {
    metingGebruikt: M.klaar,
    metingReden: M.reden,
    stempel: stempel({ metingGebruikt: M.klaar, metingReden: M.reden }),
    uitleg: 'Waarom heeft deze mutatie geen geldig bewijs? De bakken staan van GOEDKOOP naar DUUR en ' +
      'een route valt in de EERSTE die past. De invariant: ONBEWEZEN mag alleen kleiner worden doordat ' +
      'een route geldig bewijs krijgt, nooit doordat een foutreden wordt hernoemd -- daarom ratelt het ' +
      'TOTAAL en niet de bakken. Zie de kop van scripts/onbewezen.js.',
    gemeten: {
      mutaties: mutaties.length,
      metBewijs: klaar,
      onbewezen,
      sluit: klaar + onbewezen === mutaties.length
    },
    bakken: BAKKEN.map(([id, uitleg]) => ({
      id, uitleg, aantal: uit[id].length, voorbeelden: uit[id].slice(0, 4)
    })),
    perRoute: uit
  };
}

function toon(u) {
  const g = u.gemeten;
  console.log('\n=== DE TRECHTER ONDER ONBEWEZEN ===\n');
  if (!u.metingGebruikt) {
    console.log('  DEZE TRECHTER IS ONGELDIG: ' + u.metingReden);
    console.log('  Zonder verse meting valt er geen blokkadereden te noemen; de uitsplitsing');
    console.log('  hieronder zou gezaghebbend lijken en nergens op slaan.');
    console.log('  herstel: npm run idemproef  (op een schone boom), daarna dit opnieuw\n');
  }
  console.log('  mutaties        : ' + g.mutaties);
  console.log('  met bewijs      : ' + g.metBewijs);
  console.log('  ONBEWEZEN       : ' + g.onbewezen + (g.sluit ? '   (de optelling sluit)' : '   WIJKT AF'));
  console.log('\n  van GOEDKOOP naar DUUR -- een route valt in de eerste bak die past\n');
  for (const b of u.bakken) {
    console.log('  ' + String(b.aantal).padStart(5) + '  ' + b.id.padEnd(22) + b.uitleg.slice(0, 74));
    if (b.aantal && b.voorbeelden.length) console.log('         ' + b.voorbeelden.slice(0, 2).join('   '));
  }
  console.log('\n  ONBEWEZEN mag alleen kleiner worden door BEWIJS, nooit door een andere foutreden.');
}

if (require.main === module) {
  const u = meet();
  if (process.argv.includes('--json')) console.log(JSON.stringify(u, null, 2));
  else toon(u);
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(UITSLAG, JSON.stringify(u, null, 2) + '\n');
    console.log('\n  weggeschreven in ONBEWEZEN.json');
  }
}
module.exports = { meet, BAKKEN, KLAAR };
