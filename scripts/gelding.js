#!/usr/bin/env node
/* ============================================================================
   DE GELDING -- waar geldt een wet, waar leeft hij, en waar kan iemand hem zien?

   DE NAAM IS NIET `bereik`, EN DAT IS EEN GELEERDE LES. Dit register heette in
   zijn eerste uur BEREIK.json, en dat bestond al: het schermbereik-register dat
   scripts/check.js leest ("schermen zonder zichtbare klikroute"). Het werd er
   stilletjes door overschreven. Precies de naambotsing waar dit huis zes keer
   voor waarschuwt -- Pulse, envelop, Kanaal, capability, VERMOGENS, wallet --
   en ze werd gemaakt door de meter die over naamverwarring gaat.

   DRIE VRAGEN DIE ONDER EEN NAAM LIEPEN

   `bereik` betekende in de bewijsregisters drie dingen tegelijk (LAT.md regel
   14): wat een wachter RAAKT, waarover een oordeel GELDT, en wat een rol MAG.
   De eerste twee zijn de twee kanten van dezelfde vraag, en wie ze optelt leest
   waargenomen reik als verklaarde gelding. Dit script houdt ze uit elkaar:

     CLAIM   waar zegt de doctrine dat de regel geldt?
     DRAAG   waar wordt die regel in het PRODUCT uitgevoerd?
     WACHT   waar kan de wachter een overtreding werkelijk zien?

   DE DRIE ASSEN DELEN GEEN BRON, EN DAT IS DE HELE ONTWERPKEUZE

   Zou de DRAAG-as de woordenlijst van de wachter gebruiken, dan bewegen die twee
   bij elke wijziging samen en meet je een echo in plaats van een verschil. Het
   ijkcriterium staat daarom in test/gelding.test.js: een drager weghalen mag
   alleen de DRAAG-as verschuiven, een wachterpad weghalen alleen de WACHT-as.
   Beweegt er een tweede as mee zonder oorzaak, dan is er een verborgen gedeelde
   bron -- precies de fout die deze hele laag moet uitsluiten.

     CLAIM  komt uit de doctrine-documenten (verklaard, met citaten die bestaan)
     DRAAG  komt uit de VORMEN van bewaarde dingen (scripts/objectmodel.js)
     WACHT  komt uit de BRON van de wachter zelf (welke paden scant hij)

   EEN EERDERE DRAAG-SENSOR IS AFGEKEURD, en dat hoort hier te staan. Hij zocht
   modules die een verzameling mensen sorteren, en van drie nagekeken treffers
   waren er twee vals: `kandidaten` bleek ontmoetplekken (vonk/halfweg.js) en
   wallets (waarde/samenstellen.js) te betekenen. Een sensor met een derde
   precisie zou cellen vullen die er net zo verzorgd uitzien als de juiste. De
   vormsensor hieronder vraagt iets anders: welke BEWAARDE vorm koppelt een
   persoonssleutel aan een waarderend veld? Dat zijn er 5 van de 1391, en de
   scherpste is `{ leerling, vak, cijfer }` in server/school/klas.js.

   VIJF UITKOMSTEN, EN GEEN PERCENTAGE

     GEDRAGEN_EN_GEZIEN            claim, drager en wachter vallen samen
     GEDRAGEN_NIET_GEZIEN         er is een drager, de wachter ziet hem niet
     GECLAIMD_GEEN_DRAGER_GEVONDEN de wet claimt hier, de dragersensor vindt niets
     GEZIEN_BUITEN_CLAIM          de wachter kijkt waar de wet niets claimt
     ONBEPAALD                    geen van de sensoren kan hier iets zeggen

   TWEE VAN DIE VIJF ZIJN GEMAKKELIJK VERKEERD TE LEZEN, en daarom staat het er
   in het register zelf bij:

     GECLAIMD_GEEN_DRAGER_GEVONDEN betekent NIET dat er geen drager is. Alleen
     dat DEZE dragersensor er geen vond -- en die ziet vandaag alleen de
     handeling `opslaan`.

     GEDRAGEN_NIET_GEZIEN betekent NIET "ongetest". Misschien bewaakt een
     centrale laag de cel alsnog op een manier die deze wachtersensor niet ziet.

   Draai:  node scripts/gelding.js            (schrijft BEREIK.json)
           node scripts/gelding.js --toon      (laat zien, schrijft niets)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'GELDING.json');
const K = { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', grijs: '\x1b[90m', vet: '\x1b[1m', uit: '\x1b[0m' };
const TOON = process.argv.includes('--toon');

/* ------------------------------------------------- de projectieruimte */

/* EEN CEL IS objectfamilie x aspect x handeling x context x actor. De drie assen
   worden onafhankelijk gevuld en pas DAARNA vergeleken; zonder een gedeelde
   ruimte vergelijk je vier documenten met drie mappen, en dat is geen
   vergelijking maar twee aanleidingen naast elkaar. */
const GEVAL = {
  id: 'geen-cijfer-op-mens',
  objectfamilie: 'MENS',
  aspect: 'PRESTATIEWAARDERING',
  handelingen: ['opslaan', 'projecteren', 'rangschikken', 'tonen'],
  contexten: ['foundation', 'school', 'work', 'living'],
  actoren: ['systeem', 'medewerker', 'partner', 'externeLezer'],

  /* DE CLAIM-AS: uit de doctrine en nergens anders vandaan. Dit is een VERKLAARDE
     lezing van een mens; wat de machine ervan controleert is dat elk citaat nog
     bestaat in het document dat het noemt (dezelfde vorm als de ankers in
     WETTEN.json). De strekking zelf is geen berekening. */
  claim: {
    soort: 'verklaard',
    strekking: 'platformbreed: geen cijfer op een mens, in geen enkele context en door geen enkele actor, ' +
      'ook niet intern als sorteersleutel',
    citaten: [
      { bestand: 'ONTMOETEN.md', anker: 'Geen cijfer op een mens' },
      { bestand: 'HDI.md', anker: 'De meeteenheid is nooit de mens' },
      { bestand: 'LEVEN.md', anker: 'De bijdrage-spiegel is nooit vergelijkend' },
      { bestand: 'FOUNDATION.md', anker: 'Geen capaciteitscijfer op een mens' },
    ],
    /* Waar de doctrine zelf een uitzondering maakt. Zonder deze zou elke cel in
       School als overtreding lezen, terwijl een cijfer op een toets juist het
       product is (SCHOOL.md par. 11 verbiedt een risicoscore, een uitvalkans en
       een blijvend niveau-label -- niet het cijferboek). */
    uitzonderingen: [
      { context: 'school', handeling: 'opslaan',
        waarom: 'SCHOOL.md par. 11.1 verbiedt een score BUITEN het potje (risicoscore, uitvalkans, ranglijst, ' +
          'blijvend niveau-label); een cijfer op een toets is de leerstof zelf en valt daar niet onder' },
    ],
  },

  /* DE WACHT-AS leest de bron van de wachter: welke paden scant hij werkelijk? */
  wachter: { bestand: 'test/cijferopmens.test.js', lijst: 'MAPPEN' },
};

/* Van modulepad naar context. Een BESLUIT en geen afleiding: welke map bij welke
   wereld hoort, staat nergens in de code (WERELDLIJST.md zegt dat met zoveel
   woorden over de laag tussen wereld en onderdeel). */
const CONTEXT_VAN = [
  [/^server\/school\//, 'school'],
  [/^server\/kern\/(rtfos|leven|levensgraaf|gezin|foundation)/, 'foundation'],
  [/^server\/kern\/(onderneming|concern|payroll|vakwerk|werk|kantoor|vertegenwoordiging|carriereledger|rugdekking)/, 'work'],
  [/^server\/bedrijf\//, 'work'],
  [/^server\/kern\//, 'living'],
];
const contextVan = (p) => (CONTEXT_VAN.find(([re]) => re.test(p)) || [null, null])[1];

/* ------------------------------------------------------------ de drie assen */

/* CLAIM. Geeft per cel of de doctrine daar iets claimt. De strekking is
   platformbreed, dus elke cel telt -- behalve waar de doctrine zelf een
   uitzondering maakt. */
function asClaim() {
  const cellen = new Map();
  for (const handeling of GEVAL.handelingen) {
    for (const context of GEVAL.contexten) {
      for (const actor of GEVAL.actoren) {
        const uitz = GEVAL.claim.uitzonderingen.find(u =>
          (!u.context || u.context === context) && (!u.handeling || u.handeling === handeling));
        cellen.set(sleutel(handeling, context, actor), uitz ? { claimt: false, waarom: uitz.waarom } : { claimt: true });
      }
    }
  }
  /* De citaten moeten bestaan; een claim die naar een verdwenen zin wijst, is
     een claim die niemand meer kan nalezen. */
  const kapot = GEVAL.claim.citaten.filter(c => {
    try { return !fs.readFileSync(path.join(WORTEL, c.bestand), 'utf8').includes(c.anker); }
    catch (e) { return true; }
  });
  return { cellen, kapot };
}

/* DRAAG. Uit de VORMEN van bewaarde dingen -- welke koppelt een persoonssleutel
   aan een waarderend veld? Deze as ziet vandaag alleen de handeling `opslaan`;
   voor de andere drie geeft hij niets, en dat is een tekort van de sensor en
   geen uitspraak over het product. */
const MENSVELD = /^(handle|codenaam|lid|lidSleutel|staffId|persoon|persoonId|member|memberKey|leerling|medewerker|deelnemer|speler)$/i;
const WAARDEVELD = /^(score|punten|rang|ranking|niveau|positie|gemiddelde|percentiel|beoordeling|cijfer|waardering|sterren|rapport)$/i;

function asDraag(vormen) {
  const cellen = new Map();
  const dragers = [];
  for (const v of vormen) {
    const mens = v.velden.filter(x => MENSVELD.test(x));
    const waarde = v.velden.filter(x => WAARDEVELD.test(x));
    if (!mens.length || !waarde.length) continue;
    const context = contextVan(v.module);
    if (!context) continue;
    dragers.push({ module: v.module, context, mens, waarde });
    /* Een bewaarde vorm is de handeling `opslaan`. Wie hem leest is niet uit de
       vorm af te leiden, dus de actor blijft hier onbepaald: de cel wordt gezet
       voor elke actor en de onzekerheid staat in de uitslag. */
    for (const actor of GEVAL.actoren) cellen.set(sleutel('opslaan', context, actor), true);
  }
  return { cellen, dragers };
}

/* WACHT. Uit de BRON van de wachter: welke paden scant hij? */
function asWacht(bronTekst) {
  /* De bron is een PARAMETER zodat test/gelding.test.js hem kan verhangen zonder
     een bestand aan te raken -- en zodat deze as aantoonbaar niets anders leest
     dan deze tekst. */
  let bron = bronTekst;
  if (bron === undefined) {
    try { bron = fs.readFileSync(path.join(WORTEL, GEVAL.wachter.bestand), 'utf8'); }
    catch (e) { return { cellen: new Map(), paden: [], bron: 'geenBron' }; }
  }

  const m = bron.match(new RegExp('const\\s+' + GEVAL.wachter.lijst + '\\s*=\\s*\\[([^\\]]*)\\]'));
  if (!m) return { cellen: new Map(), paden: [], bron: 'lijstNietGevonden' };
  const paden = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);

  const cellen = new Map();
  const contexten = new Set();
  for (const p of paden) {
    const context = contextVan('server/kern/' + p);
    if (!context) continue;
    contexten.add(context);
    /* De scan leest broncode; wat hij daarmee ziet is de OPSLAG-kant. Over
       projecteren, rangschikken en tonen doet hij geen uitspraak. */
    for (const actor of GEVAL.actoren) cellen.set(sleutel('opslaan', context, actor), true);
  }
  return { cellen, paden, contexten: [...contexten], bron: 'gemeten' };
}

const sleutel = (h, c, a) => h + ' | ' + c + ' | ' + a;

/* --------------------------------------------------------------- de uitslag */

function oordeel(claimt, draagt, wacht) {
  if (!claimt && wacht) return 'GEZIEN_BUITEN_CLAIM';
  if (!claimt) return 'ONBEPAALD';
  if (draagt && wacht) return 'GEDRAGEN_EN_GEZIEN';
  if (draagt) return 'GEDRAGEN_NIET_GEZIEN';
  return 'GECLAIMD_GEEN_DRAGER_GEVONDEN';
}

function meet(vormen) {
  const claim = asClaim();
  const draag = asDraag(vormen);
  const wacht = asWacht();

  const cellen = [];
  for (const handeling of GEVAL.handelingen) {
    for (const context of GEVAL.contexten) {
      for (const actor of GEVAL.actoren) {
        const s = sleutel(handeling, context, actor);
        const c = claim.cellen.get(s) || { claimt: false };
        cellen.push({
          handeling, context, actor,
          claim: c.claimt, draag: !!draag.cellen.get(s), wacht: !!wacht.cellen.get(s),
          uitslag: oordeel(c.claimt, !!draag.cellen.get(s), !!wacht.cellen.get(s)),
          ...(c.waarom ? { claimWaarom: c.waarom } : {}),
        });
      }
    }
  }
  return { claim, draag, wacht, cellen };
}

function stempel() {
  const git = (...a) => { try { return execFileSync('git', a, { cwd: WORTEL, encoding: 'utf8' }).trim(); } catch (e) { return null; } };
  const vuil = git('status', '--porcelain');
  return { op: new Date().toISOString(), commit: git('rev-parse', '--short', 'HEAD'),
    boomVuil: vuil === null ? null : vuil.length > 0, instrument: 'scripts/gelding.js', node: process.version };
}

function draai() {
  const O = require('./objectmodel.js');
  const vormen = O.lees().vormen;
  const m = meet(vormen);

  const telling = {};
  for (const c of m.cellen) telling[c.uitslag] = (telling[c.uitslag] || 0) + 1;

  const uit = {
    stempel: stempel(),
    uitleg: 'Waar geldt een wet (CLAIM), waar leeft hij (DRAAG), en waar kan een wachter hem zien (WACHT)? ' +
      'De drie assen worden onafhankelijk gevuld en pas daarna vergeleken; zij delen geen bron, en ' +
      'test/gelding.test.js houdt dat vast.',
    graad: 'vermoed',
    grens: 'GEEN PERCENTAGE, en dat is een ontwerpkeuze: voor een verhouding moet eerst vaststaan wat een ' +
      'telbare eenheid is, en bij een centrale architectuur kan een objectfamilie zwaarder wegen dan twintig ' +
      'mappen. TWEE UITSLAGEN ZIJN GEMAKKELIJK VERKEERD TE LEZEN: GECLAIMD_GEEN_DRAGER_GEVONDEN betekent ' +
      'NIET dat er geen drager is, alleen dat DEZE sensor er geen vond -- en die ziet vandaag alleen de ' +
      'handeling `opslaan`. GEDRAGEN_NIET_GEZIEN betekent NIET "ongetest": misschien bewaakt een centrale ' +
      'laag de cel op een manier die deze wachtersensor niet ziet.',
    geval: { id: GEVAL.id, objectfamilie: GEVAL.objectfamilie, aspect: GEVAL.aspect,
      handelingen: GEVAL.handelingen, contexten: GEVAL.contexten, actoren: GEVAL.actoren },
    assen: {
      claim: { soort: GEVAL.claim.soort, strekking: GEVAL.claim.strekking,
        citaten: GEVAL.claim.citaten, citaatKapot: m.claim.kapot.map(c => c.bestand + ': ' + c.anker),
        uitzonderingen: GEVAL.claim.uitzonderingen },
      draag: { bron: 'scripts/objectmodel.js (vormen van bewaarde dingen)',
        ziet: ['opslaan'], zietNiet: ['projecteren', 'rangschikken', 'tonen'],
        zietNietWaarom: 'een bewaarde vorm toont wat er is opgeslagen, niet wat ermee wordt getoond of geordend',
        dragers: m.draag.dragers },
      wacht: { bron: GEVAL.wachter.bestand + ' :: ' + GEVAL.wachter.lijst, stand: m.wacht.bron,
        paden: m.wacht.paden, contexten: m.wacht.contexten || [] },
    },
    telling,
    cellen: m.cellen,
  };

  if (TOON) { toon(uit); return; }
  fs.writeFileSync(DOEL, JSON.stringify(uit, null, 2) + '\n');
  toon(uit);
  console.log(K.grijs + 'GELDING.json geschreven.' + K.uit);
}

function toon(uit) {
  console.log('');
  console.log(K.vet + '  HET BEREIK -- ' + uit.geval.objectfamilie + ' x ' + uit.geval.aspect + K.uit);
  console.log(K.grijs + '  (graad: vermoed -- drie assen, geen gedeelde bron, geen percentage)' + K.uit);
  console.log('');
  const kleur = { GEDRAGEN_EN_GEZIEN: K.groen, GEDRAGEN_NIET_GEZIEN: K.geel,
    GECLAIMD_GEEN_DRAGER_GEVONDEN: K.grijs, GEZIEN_BUITEN_CLAIM: K.geel, ONBEPAALD: K.grijs };
  for (const [naam, n] of Object.entries(uit.telling).sort((a, b) => b[1] - a[1])) {
    console.log('    ' + (kleur[naam] || '') + String(n).padStart(4) + '  ' + naam + K.uit);
  }
  console.log('');
  console.log(K.vet + '  DE DRAGERS DIE DE VORMSENSOR VOND' + K.uit);
  for (const d of uit.assen.draag.dragers) {
    console.log('    ' + d.context.padEnd(11) + d.module.padEnd(42) + K.grijs + d.mens.join(',') + ' + ' + d.waarde.join(',') + K.uit);
  }
  if (!uit.assen.draag.dragers.length) console.log(K.grijs + '    (geen)' + K.uit);
  console.log('');
  console.log(K.vet + '  WAT DE WACHTER WERKELIJK SCANT' + K.uit);
  console.log('    ' + (uit.assen.wacht.paden.join(', ') || '(niets)') +
    K.grijs + '  -> context: ' + (uit.assen.wacht.contexten.join(', ') || 'geen') + K.uit);
  console.log('');
  const cel = uit.cellen.filter(c => c.uitslag === 'GEDRAGEN_NIET_GEZIEN');
  if (cel.length) {
    console.log(K.vet + '  GEDRAGEN, NIET GEZIEN' + K.uit + K.grijs + '  (een drager gevonden, deze wachter ziet hem niet)' + K.uit);
    for (const c of cel.slice(0, 8)) console.log('    ' + c.handeling + ' | ' + c.context + ' | ' + c.actor);
    console.log('');
  }
}

if (require.main === module) draai();
module.exports = { meet, asClaim, asDraag, asWacht, oordeel, contextVan, GEVAL, sleutel, DOEL };
