#!/usr/bin/env node
/* ============================================================================
   DE GRAFEN EN HUN AS -- wordt de aandachtlaag een laag, of zijn het er drie?

   DE VRAAG. Boven de werelden hoort een laag te komen die zegt wat NU aandacht
   verdient: een kaart, geen twintig panelen. Zo'n laag moet uit de bestaande
   grafen kunnen putten, en dan is er precies een vraag die vooraf beantwoord
   moet worden: dragen die grafen dezelfde vorm, en vooral -- meten ze
   dringendheid op dezelfde as?

   WAAROM DIT GEMETEN WORDT EN NIET BESLOTEN. Dit huis heeft een keer een type
   over vier domeinen heen VERKLAARD (`Asset`, DEVELOPERCLOUD.md par. 2) en
   scripts/objectmodel.js liet zien dat het niet bestond: tafel, kamer, podium
   en leaseauto delen niets buiten hun verpakking. Een aandachtlaag die een
   gedeelde as aanneemt, maakt exact dezelfde fout -- alleen dan op het veld dat
   bepaalt WAT er bovenaan komt te staan, en dat is de duurste plek om het mis
   te hebben.

   HOE ER GEMETEN WORDT, IN DRIE STAPPEN

   1. HET REGISTER (hieronder) noemt per graaf waar hij woont, welke functie zijn
      eenheid maakt, en welk veld zijn dringendheidsas draagt -- met de reden
      erbij. Dat laatste is een BEWERING van een mens, geen parse-uitkomst: of
      een veld "dringendheid" uitdrukt, staat niet in de tekens.

   2. DE ZELFIJKING controleert die bewering tegen de code: de genoemde functie
      moet bestaan, en het genoemde as-veld moet werkelijk in zijn eenheid
      staan. Een register dat naast de code leeft, wordt binnen een jaar zelf de
      volgende botsing (BEWIJSMACHINE.md). Klopt een bewering niet, dan ZAKT
      deze meter in plaats van een verkeerd getal te melden.

   3. DE ONTDEKKING loopt daarnaast over server/kern en zoekt alles wat naar een
      graaf ruikt. Wat er niet in het register staat, wordt gemeld. Zo kan het
      register niet stilletjes achterlopen op een achtste graaf.

   WAT DEZE METER NIET ZEGT. Een gedeelde veldNAAM is geen gedeelde BETEKENIS --
   dezelfde waarschuwing als bij scripts/objectmodel.js en scripts/semantiek.js.
   `bron` in de levensgraaf zegt uit welke app een knoop komt; `bron` in de
   geldgraaf zegt welk gelddomein het feit leverde. Twee keer vier letters, twee
   vragen. Deze meter wijst kandidaten aan; of ze een laag zijn, beslist een mens
   die de bestanden ernaast legt.

   Draai: node scripts/graafas.js            (leesbaar)
          node scripts/graafas.js --json     (voor de ratel)
          npm run graafas:vast               (schrijft GRAAFAS.json)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'GRAAFAS.json');

/* HET REGISTER. Per graaf: het bestand waar zijn eenheid ontstaat, de functie
   die hem maakt, hoe die eenheid heet, en het veld waarop dringendheid wordt
   afgelezen -- met de reden waarom juist dat veld.

   `as: null` betekent: deze graaf meet geen dringendheid. Dat is een geldige
   uitkomst en geen ontbrekend werk; een leeslaag over een assortiment hoeft
   niet te weten wat er haast heeft. */
const REGISTER = [
  { id: 'levensgraaf', bestand: 'server/kern/levensgraaf/graaf.js', maker: 'knoop', eenheid: 'knoop',
    as: 'vervalt',
    waarom: 'Een ding in het leven van een lid is dringend als er een TERMIJN onder hangt die afloopt: een verzekering, een visum, een keuring.' },
  { id: 'geldgraaf', bestand: 'server/kern/geldgraaf/hulp.js', maker: 'feit', eenheid: 'feit',
    as: 'richting',
    waarom: 'Geld heeft geen wachtstand maar een richting: er komt iets binnen of er gaat iets uit, en dat verschil bepaalt of een feit aandacht vraagt.' },
  { id: 'socialegraaf', bestand: 'server/kern/socialegraaf/hulp.js', maker: 'moment', eenheid: 'moment',
    as: 'wacht',
    waarom: 'Het staat in de kop van dat bestand uitgeschreven: een gesprek van drie weken oud is niets, een gesprek waar iemand op antwoord wacht is iets anders.' },
  { id: 'commandgraaf', bestand: 'server/kern/command/graaf.js', maker: null, eenheid: 'knoop',
    as: null,
    waaromGeenEenheid: 'De kennisgraaf bouwt zijn knopen inline uit het soortenregister; er is geen functie die EEN knoop maakt.',
    waarom: 'De kennisgraaf beantwoordt "wat hangt waaraan vast" en niet "wat heeft haast"; dringendheid komt daar uit kern/command/risico.js.' },
  { id: 'commercegraaf', bestand: 'server/kern/commerce/graaf.js', maker: null, eenheid: 'koopbaar',
    as: null,
    waaromGeenEenheid: 'De commerce-graaf levert een lijst koopbaren uit andermans vormen; hij maakt zelf geen eenheid.',
    waarom: 'Een leeslaag over het assortiment. Hij schrijft niet en hij prioriteert niet.' },
  { id: 'concerngraaf', bestand: 'server/kern/concern/graaf.js', maker: null, eenheid: 'knoop',
    as: null,
    waaromGeenEenheid: 'De eigendomsgraaf werkt op concern-rijen uit de opslag; die vorm hoort bij kern/concern en niet bij de graaf.',
    waarom: 'De eigendomsgraaf gaat over zeggenschap. Wat er verloopt, hangt aan de vergunning en niet aan de graaf.' },
  { id: 'waardegraaf', bestand: 'server/kern/pay/graaf.js', maker: null, eenheid: 'stroom',
    as: null,
    waaromGeenEenheid: 'De waardegraaf telt stromen op uit grootboekregels; er is geen eenheid die hij zelf vormt.',
    waarom: 'Waar ging deze euro heen -- een herkomstvraag over het verleden, niet over wat er nu moet.' }
];

/* Commentaar en tekenreeksen eruit, zodat een veldnaam in een uitleg niet
   meetelt. Zelfde wringer als scripts/objectmodel.js; die wordt hier
   hergebruikt en niet overgetypt (LAT.md regel 4). */
const { wring } = require('./objectmodel');

/* De velden van EEN object-literaal: die van de functie `maker`, of -- als er
   geen maker is opgegeven -- de grootste literaal in het bestand. De tweede weg
   is expres zwakker en wordt in de uitslag als zodanig gemerkt: een graaf
   zonder benoemde makerfunctie is gemeten met een aanname. */
function veldenVanLiteraal(code, vanaf) {
  /* DE EERSTE ACCOLADE NA EEN FUNCTIEKOP IS HET FUNCTIELIJF EN NIET DE VORM.

     Dat was de eerste fout van deze meter: hij pakte `{` direct na `function
     feit(o)` en las daarmee het lijf, met een bewakingsregel erin en geen
     velden. De vorm ontstaat een paar tekens verderop, achter `return {` of
     `= {` -- en zo staan ze alle drie geschreven. */
  const opening = /(?:return|=)\s*\{/g;
  opening.lastIndex = vanaf;
  const m = opening.exec(code);
  const start = m ? code.indexOf('{', m.index) : code.indexOf('{', vanaf);
  if (start < 0) return null;
  let diepte = 0, eind = -1;
  for (let i = start; i < code.length; i++) {
    if (code[i] === '{') diepte++;
    else if (code[i] === '}') { diepte--; if (diepte === 0) { eind = i; break; } }
  }
  if (eind < 0) return null;
  const binnen = code.slice(start + 1, eind);
  /* Alleen de BUITENSTE laag: een geneste literaal draagt andermans velden. */
  let d = 0; const stukken = [];
  let vorig = 0;
  for (let i = 0; i < binnen.length; i++) {
    const c = binnen[i];
    if (c === '{' || c === '[' || c === '(') d++;
    else if (c === '}' || c === ']' || c === ')') d--;
    else if (c === ',' && d === 0) { stukken.push(binnen.slice(vorig, i)); vorig = i + 1; }
  }
  stukken.push(binnen.slice(vorig));
  const velden = [];
  for (const s of stukken) {
    const m = s.match(/^\s*([A-Za-z_$][\w$]*)\s*:/);
    if (m) velden.push(m[1]);
  }
  return velden.length ? [...new Set(velden)] : null;
}

function eenheidVan(g) {
  const pad = path.join(WORTEL, g.bestand);
  if (!fs.existsSync(pad)) return { fout: 'het bestand bestaat niet' };
  const code = wring(fs.readFileSync(pad, 'utf8'));
  if (g.maker) {
    const re = new RegExp('function\\s+' + g.maker + '\\s*\\(|(?:const|let)\\s+' + g.maker + '\\s*=\\s*(?:function|\\()');
    const m = re.exec(code);
    if (!m) return { fout: 'de opgegeven makerfunctie "' + g.maker + '" staat niet in het bestand' };
    const velden = veldenVanLiteraal(code, m.index + m[0].length);
    if (!velden) return { fout: 'de makerfunctie "' + g.maker + '" bouwt geen leesbare literaal' };
    return { velden, hoe: 'makerfunctie' };
  }
  /* GEEN MAKER OPGEGEVEN IS GEEN REDEN OM IETS TE VERZINNEN.

     De eerste versie pakte hier "de grootste literaal in het bestand" en
     merkte dat aan als aanname. Wat daar uitkwam was niet de eenheid van de
     graaf maar zijn ANTWOORD -- {knopen, lagen, diepte, grens, start} voor de
     kennisgraaf. Die velden vervolgens naast `feit` en `moment` leggen levert
     een overlapgetal op dat nergens over gaat, en een getal dat nergens over
     gaat wordt gelezen alsof het ergens over gaat.

     Deze vier grafen vormen werkelijk geen eigen eenheid; ze lezen andermans
     vormen. Dat is een geldige uitkomst en staat als zodanig in de uitslag.
     KOSTEN.md par. 3 zegt hetzelfde over getallen: er staat nooit een getal
     waar er geen is. */
  return { geenEenheid: true };
}

/* De ontdekking: wat ruikt naar een graaf en staat niet in het register? */
function ontdek() {
  const gevonden = [];
  const loop = (map) => {
    for (const naam of fs.readdirSync(path.join(WORTEL, map), { withFileTypes: true })) {
      const rel = map + '/' + naam.name;
      if (naam.isDirectory()) { if (/graaf/i.test(naam.name)) gevonden.push(rel); loop(rel); }
      else if (/graaf.*\.js$/i.test(naam.name)) gevonden.push(rel);
    }
  };
  loop('server/kern');
  const bekend = new Set(REGISTER.map(g => g.bestand));
  const bekendeMappen = new Set(REGISTER.map(g => path.dirname(g.bestand)));
  return gevonden.filter(p => !bekend.has(p) && !bekendeMappen.has(p) && !p.endsWith('/graaf-bevoegdheid.js'));
}

function meet() {
  const grafen = [];
  const klachten = [];
  for (const g of REGISTER) {
    const uit = eenheidVan(g);
    if (uit.fout) { klachten.push(g.id + ': ' + uit.fout); grafen.push({ id: g.id, fout: uit.fout }); continue; }
    if (uit.geenEenheid) {
      grafen.push({ id: g.id, bestand: g.bestand, eenheidVastgesteld: false,
        waaromGeenEenheid: g.waaromGeenEenheid || 'geen makerfunctie opgegeven', as: g.as, waarom: g.waarom });
      continue;
    }
    /* DE ZELFIJKING. Het register beweert dat de as in de eenheid staat; als dat
       niet zo is, is de bewering verouderd en meet de rest niets meer. */
    if (g.as && !uit.velden.includes(g.as))
      klachten.push(g.id + ': de opgegeven as "' + g.as + '" staat niet in de eenheid (' + uit.velden.join(', ') + ')');
    grafen.push({ id: g.id, bestand: g.bestand, eenheid: g.eenheid, eenheidVastgesteld: true, hoe: uit.hoe,
      velden: uit.velden.slice().sort(), as: g.as, waarom: g.waarom });
  }

  const met = grafen.filter(g => g.velden);
  const tel = {};
  for (const g of met) for (const v of g.velden) (tel[v] = tel[v] || []).push(g.id);
  const gedeeld = Object.entries(tel).filter(([, w]) => w.length > 1)
    .map(([veld, waar]) => ({ veld, grafen: waar.sort(), aantal: waar.length }))
    .sort((a, b) => b.aantal - a.aantal || a.veld.localeCompare(b.veld));

  /* Overlap tussen elk paar, over de VOLLEDIGE veldenlijst. Geen envelop eraf:
     zeven grafen is te weinig voor een drempel die uit de data zelf komt, en
     een verzonnen drempel zou de uitkomst maken. Dat staat hier omdat het de
     lezer scheelt te denken dat er is gefilterd. */
  const paren = [];
  for (let i = 0; i < met.length; i++) for (let j = i + 1; j < met.length; j++) {
    const a = new Set(met[i].velden), b = new Set(met[j].velden);
    const snee = [...a].filter(v => b.has(v));
    const unie = new Set([...a, ...b]);
    paren.push({ a: met[i].id, b: met[j].id, gedeeld: snee.sort(),
      overlap: Math.round((snee.length / unie.size) * 100) / 100 });
  }
  paren.sort((x, y) => y.overlap - x.overlap);

  const assen = met.filter(g => g.as).map(g => ({ graaf: g.id, as: g.as, waarom: g.waarom }));
  const asNamen = [...new Set(assen.map(a => a.as))];

  return {
    uitleg: 'Per graaf: de velden van zijn eenheid, en het veld waarop dringendheid wordt afgelezen. ' +
      'Zie de kop van scripts/graafas.js voor wat deze meter wel en niet zegt. ' +
      'Een gedeelde veldnaam is geen gedeelde betekenis.',
    vastgelegd: new Date().toISOString().slice(0, 10),
    gemeten: {
      grafen: grafen.length,
      metEenEigenEenheid: met.length,
      zonderEigenEenheid: grafen.length - met.length,
      metEenAs: assen.length,
      verschillendeAssen: asNamen.length,
      assenGedeeld: assen.length - asNamen.length,
      veldenTotaal: Object.keys(tel).length,
      veldenGedeeld: gedeeld.length,
      hoogsteOverlap: paren.length ? paren[0].overlap : 0,
      buitenHetRegister: ontdek().length
    },
    klachten,
    assen,
    grafen,
    gedeeld,
    paren,
    buitenHetRegister: ontdek()
  };
}

function toon(u) {
  const g = u.gemeten;
  console.log('\n=== DE GRAFEN EN HUN AS ===\n');
  console.log('  grafen in het register : ' + g.grafen);
  console.log('  met een eigen eenheid  : ' + g.metEenEigenEenheid +
    '   (' + g.zonderEigenEenheid + ' lezen andermans vorm en zijn niet vergeleken)');
  console.log('  met een dringendheidsas: ' + g.metEenAs);
  console.log('  verschillende assen    : ' + g.verschillendeAssen +
    (g.assenGedeeld === 0 ? '   -- geen enkele as wordt gedeeld' : '   (' + g.assenGedeeld + ' gedeeld)'));
  console.log('  hoogste veldoverlap    : ' + g.hoogsteOverlap + (u.paren.length ? '   ' + u.paren[0].a + ' <-> ' + u.paren[0].b : ''));
  console.log('\n  DE ASSEN');
  for (const a of u.assen) console.log('    ' + a.graaf.padEnd(16) + a.as.padEnd(10) + a.waarom);
  console.log('\n  VELDEN DIE MEER DAN EEN GRAAF DEELT');
  for (const d of u.gedeeld.slice(0, 12)) console.log('    ' + d.veld.padEnd(14) + d.aantal + '   ' + d.grafen.join(', '));
  if (u.buitenHetRegister.length) {
    console.log('\n  BUITEN HET REGISTER (ruikt naar een graaf, staat er niet in)');
    for (const p of u.buitenHetRegister) console.log('    ' + p);
  }
  if (u.klachten.length) {
    console.log('\n  DE METER ZAKT:');
    for (const k of u.klachten) console.log('    ! ' + k);
  }
  console.log('');
  return u.klachten.length ? 1 : 0;
}

function main() {
  const argv = process.argv.slice(2);
  const u = meet();
  if (argv.includes('--json')) { console.log(JSON.stringify(u, null, 1)); return u.klachten.length ? 1 : 0; }
  const code = toon(u);
  if (argv.includes('--vastleggen')) {
    if (u.klachten.length) { console.log('  NIET vastgelegd: een meter die zakt, legt niets vast.\n'); return 1; }
    fs.writeFileSync(UITSLAG, JSON.stringify(u, null, 1) + '\n');
    console.log('  vastgelegd in GRAAFAS.json\n');
  }
  return code;
}

module.exports = { meet, REGISTER, veldenVanLiteraal, eenheidVan, ontdek, UITSLAG };
if (require.main === module) process.exit(main());
