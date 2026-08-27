#!/usr/bin/env node
/* ============================================================================
   DE ZEKERHEID -- wat we weten, en vooral wat we niet weten.

   WAAROM DIT ER IS, EN WAAROM HET NIET NOG EEN RAPPORT IS

   Dit huis meet veel. `npm run check` doet 53 codeafspraken, `npm run norm`
   ratelt de meters, `npm run dekking` telt waargenomen endpoints, `npm run
   mutatie` probeert 646 toetsbestanden om te krijgen, `npm run samenhang`
   vraagt wie er kijkt, `npm run wetten` toont de systeemwetten en `npm run
   sabotage` probeert ze echt te overtreden. Elk van die getallen is eerlijk.
   Bij elkaar geven ze een gevoel dat gevaarlijker is dan elk getal apart: het
   gevoel dat het allemaal wel gedekt zal zijn.

   Dat gevoel klopt niet, en dit script bestaat om te zeggen waar het niet
   klopt. Het telt niet op wat er goed gaat -- daar zijn de andere zeven voor.
   Het zet naast elkaar wat er BEWEZEN is en wat er alleen maar OPGESCHREVEN is,
   en het noemt met naam de dingen waarvan we, na al dat meten, nog steeds niets
   weten.

   VIER LAGEN VAN ZEKERHEID, van hard naar zacht:

     BEWEZEN     de wet is echt overtreden en er werd echt iets rood.
     GEMETEN     er staat een getal, en de meter is een keer zien uitslaan.
     BEWEERD     er staat iets opgeschreven en niemand heeft het geprobeerd.
     ONBEKEND    we weten niet eens hoe we ernaar zouden kijken.

   DE REGEL DIE DIT SCRIPT OP ZICHZELF TOEPAST. LAT.md regel 3: een meter zakt
   als zijn invoer ontbreekt. Een overzicht van wat we weten dat vrolijk verder
   gaat terwijl de helft van zijn bronnen ontbreekt, is precies de leugen die
   het moest voorkomen. Ontbreekt een bron, dan staat dat er met naam EN krijgt
   dit script exitcode 1 -- niet omdat er iets stuk is, maar omdat "geen
   oordeel" geen groen is.

   Draai:  node scripts/zekerheid.js
           node scripts/zekerheid.js --json
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const W = require('./lib/wetboek');

const WORTEL = W.WORTEL;
const K = { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', grijs: '\x1b[90m', vet: '\x1b[1m', uit: '\x1b[0m' };
const jsonUit = process.argv.includes('--json');

function leesJson(rel) {
  try { return { ok: true, data: JSON.parse(fs.readFileSync(path.join(WORTEL, rel), 'utf8')) }; }
  catch (e) { return { ok: false, waarom: e.code === 'ENOENT' ? 'bestaat niet' : e.message }; }
}

/* ---------------------------------------------------------------------------
   DE BRONNEN. Elke bron zegt zelf wat hij dekt en hoe je hem maakt. Dat laatste
   is geen service maar noodzaak: een ontbrekende bron zonder recept wordt een
   ontbrekende bron die er over een jaar nog steeds niet is.
   --------------------------------------------------------------------------- */
const BRONNEN = [
  { naam: 'WETTEN.json', wat: 'de systeemwetten zelf', maak: 'met de hand -- een wet is een besluit' },
  { naam: 'SABOTAGE.json', wat: 'of het uitzetten van een handhaver echt iets rood maakt', maak: 'npm run sabotage' },
  { naam: 'NORM.json', wat: 'de geratelde meters', maak: 'npm run norm' },
  { naam: 'MUTATIES.json', wat: 'welke toetsen ooit zijn zien zakken op een mutatie', maak: 'npm run mutatie' }
];

function verzamel() {
  const bronnen = BRONNEN.map(b => Object.assign({}, b, leesJson(b.naam)));
  const bron = n => (bronnen.find(b => b.naam === n) || {});

  const wetboek = bron('WETTEN.json').ok ? W.lees() : null;
  const uitslag = bron('SABOTAGE.json').ok ? W.leesUitslag() : null;
  const norm = bron('NORM.json').data || {};
  const mutaties = bron('MUTATIES.json').data || {};

  const wetten = wetboek ? wetboek.boek.wetten.map(w => ({ wet: w, ...W.standVan(w, uitslag) })) : [];
  const perStand = {};
  for (const r of wetten) perStand[r.stand] = (perStand[r.stand] || 0) + 1;

  const toetsStanden = {};
  for (const v of Object.values(mutaties.toetsen || {})) toetsStanden[v.staat] = (toetsStanden[v.staat] || 0) + 1;

  return { bronnen, wetten, perStand, norm: norm.meters || {}, toetsStanden,
    toetsenGemeten: Object.keys(mutaties.toetsen || {}).length };
}

/* WAT ONS GEREEDSCHAP ZELF NIET WEET. Deze lijst wordt AFGELEID uit de meters
   en niet met de hand bijgehouden -- een opgeschreven lijst met blinde vlekken
   veroudert precies zoals elke andere belofte in tekst (LAT.md regel 6), en dan
   staat er straks een geruststellende opsomming van gaten die allang anders
   liggen.

   EN ELKE REGEL ZEGT WAAR ZIJN GETAL VANDAAN KOMT, want die twee bronnen zijn
   niet hetzelfde en het verschil is precies waar dit script over gaat:

     NORM.json    de LAATST VASTGELEGDE stand -- het plafond van de ratel, niet
                  wat er vandaag gemeten wordt. Het echte getal kan hoger liggen
                  (dan staat `npm run norm` rood en is dat daar te lezen). Deze
                  regels hier live meten zou minuten kosten per aanroep, en dan
                  wordt dit overzicht iets wat niemand meer opent.
     MUTATIES.json de uitslag van de mutatiemotor: wel een echte meting.

   Zonder dat onderscheid leest een normwaarde als een meting, en dat is exact
   de vorm van liegen waar LAT.md regel 10 over gaat. */
function blindeVlekken(g) {
  const uit = [];
  const m = g.norm;
  const zet = (n, tekst, meter, bron) => { if (n) uit.push({ n, tekst, meter, bron: bron || 'NORM.json' }); };

  zet(m.endpointsZonderTest, 'endpoints zonder eigen gedragstoets -- de grens-sweep legt er een vloer onder (geen 500, geen kluisveld van een ander), maar dat is niet hetzelfde als weten dat de kamer klopt', 'endpointsZonderTest');
  zet(m.toetsenNietGemeten, 'toetsbestanden waar de mutatiemotor nooit langs is geweest: van die toetsen weet niemand of ze kunnen zakken', 'toetsenNietGemeten');
  zet(g.toetsStanden.overleefd, 'toetsbestanden die ELKE mutatie hebben overleefd -- ze staan groen zonder aantoonbaar iets vast te leggen', 'overleefd', 'MUTATIES.json');
  zet(m.metersOngeijkt, 'meters die met een REDEN in de ijkregistratie staan in plaats van met een proef: hun getal is nooit zien uitslaan', 'metersOngeijkt');
  zet(m.onbewaakt, 'dingen die geen enkele handhaver noemt (uit de census)', 'onbewaakt');
  zet(m.routesNietSchakelbaar, 'routes die niet vanuit de boardroom te schakelen zijn: die staan buiten de functieschakelaars', 'routesNietSchakelbaar');
  zet(m.zelfpoortendeToetsen, 'toetsen die zichzelf kunnen overslaan -- ze draaien alleen als hun draaier ze meeneemt', 'zelfpoortendeToetsen');
  zet(m.schermenZonderToets, 'schermen die geen enkele toets ooit heeft geopend', 'schermenZonderToets');
  return uit;
}

function main() {
  const g = verzamel();
  const ontbreekt = g.bronnen.filter(b => !b.ok);

  if (jsonUit) {
    console.log(JSON.stringify({ bronnen: g.bronnen.map(b => ({ naam: b.naam, ok: b.ok, waarom: b.waarom })),
      perStand: g.perStand, blindeVlekken: blindeVlekken(g),
      wetten: g.wetten.map(r => ({ id: r.wet.id, stand: r.stand, reden: r.reden })) }, null, 2));
    return ontbreekt.length ? 1 : 0;
  }

  console.log('\n' + K.vet + 'DE ZEKERHEID' + K.uit + K.grijs + ' -- wat we weten, en vooral wat we niet weten' + K.uit);

  /* Eerst de bronnen, en met opzet vooraan. Wie een overzicht leest waarvan de
     helft van de invoer ontbreekt, moet dat weten voordat hij de getallen ziet
     -- niet in een voetnoot eronder. */
  const stukkeBron = ontbreekt.length;
  console.log('\n  ' + K.vet + 'WAAR DIT OP RUST' + K.uit);
  for (const b of g.bronnen) {
    console.log('    ' + (b.ok ? K.groen + 'er' + K.uit : K.rood + 'WEG' + K.uit) + '  ' +
      b.naam.padEnd(16) + K.grijs + b.wat + (b.ok ? '' : K.rood + '  (' + b.waarom + ' -- maak hem met: ' + b.maak + ')') + K.uit);
  }

  const bewezen = g.wetten.filter(r => r.stand === 'raak');
  console.log('\n  ' + K.vet + 'WAT WE WETEN' + K.uit + K.grijs + '  (de wet is echt overtreden, en er werd echt iets rood)' + K.uit);
  if (!bewezen.length) console.log('    ' + K.rood + 'niets.' + K.uit + K.grijs + ' Geen enkele systeemwet is ooit op de proef gesteld.' + K.uit);
  for (const r of bewezen) console.log('    ' + K.groen + '+' + K.uit + ' ' + r.wet.wet.slice(0, 104) +
    K.grijs + '  [' + (r.wachter || '?') + ']' + K.uit);

  console.log('\n  ' + K.vet + 'WAT WE NIET WETEN' + K.uit);
  const groepen = [
    ['afgeslagen', K.rood, 'de wet is echt overtreden en er werd NIETS rood -- opgeschreven, niet gehandhaafd'],
    ['blind', K.geel, 'de wachter kon geen oordeel geven (hij was al rood, of hij kan hier niet draaien)'],
    ['losgeraakt', K.rood, 'het sabotagerecept wijst nergens meer naar; deze wet is niet te proberen'],
    ['verlopen', K.geel, 'het recept of de wettekst veranderde na de meting -- het oude bewijs geldt niet meer'],
    ['nietGemeten', K.geel, 'er is nooit iets geprobeerd'],
    ['nietGeprobeerd', K.geel, 'overgeslagen in de laatste ronde'],
    ['mensenwerk', K.grijs, 'met opzet geen machine -- hier wordt op mensen vertrouwd, en dat blijft zo tot iemand het anders bouwt']
  ];
  for (const [stand, kleur, uitleg] of groepen) {
    const rijen = g.wetten.filter(r => r.stand === stand);
    if (!rijen.length) continue;
    console.log('    ' + kleur + stand.toUpperCase() + K.uit + K.grijs + ' (' + rijen.length + ') -- ' + uitleg + K.uit);
    for (const r of rijen) {
      console.log('      ' + kleur + '-' + K.uit + ' ' + r.wet.wet.slice(0, 100));
      if (r.reden) console.log('        ' + K.grijs + r.reden.slice(0, 118) + K.uit);
    }
  }

  console.log('\n  ' + K.vet + 'WAT ONS GEREEDSCHAP ZELF NIET WEET' + K.uit +
    K.grijs + '  (afgeleid uit de meters, niet met de hand bijgehouden)' + K.uit);
  console.log(K.grijs + '    De NORM.json-regels zijn de LAATST VASTGELEGDE stand, niet de meting van vandaag:' +
    '\n    het echte getal kan hoger liggen, en dat leest u bij `npm run norm`.' + K.uit);
  const vlekken = blindeVlekken(g);
  if (!vlekken.length) console.log('    ' + K.geel + 'geen enkele meter meldt een gat -- controleer of NORM.json wel gelezen is.' + K.uit);
  for (const v of vlekken)
    console.log('    ' + K.geel + String(v.n).padStart(6) + K.uit + '  ' + v.tekst.slice(0, 108) +
      K.grijs + '  [' + v.bron + ': ' + v.meter + ']' + K.uit);

  /* De laatste alinea is met opzet TEKST en geen getal. Dit zijn de grenzen van
     de methode zelf, en die veranderen niet met een meting -- ze veranderen
     alleen als iemand het gereedschap anders bouwt. Wie hier een getal van
     maakt, doet alsof ze wegmeetbaar zijn. */
  console.log('\n  ' + K.vet + 'WAT DEZE HELE OPSTELLING NIET KAN WETEN' + K.uit);
  console.log(K.grijs + [
    '    - BEWEZEN betekent: deze wachter is gevoelig voor DEZE ene overtreding. Niet dat hij',
    '      elke overtreding ziet, en niet dat de wet goed geformuleerd is.',
    '    - Het register bevat alleen wat iemand heeft OPGESCHREVEN. Een regel die dit huis wel',
    '      naleeft maar nergens noemt, is hier onzichtbaar -- en dat is de grootste blinde vlek',
    '      van allemaal, want hij is per definitie niet te tellen.',
    '    - Waar een recept de HANDHAVER uitzet in plaats van de gedraging (dat gebeurt bij de',
    '      keuringsregels), bewijst RAAK dat de regel tanden heeft. Niet dat de code eronder deugt.',
    '    - Niets hiervan zegt iets over de vraag of een wet de JUISTE wet is. Dat is geen meting.'
  ].join('\n') + K.uit);

  const totaal = g.wetten.length;
  console.log('\n  ' + K.groen + bewezen.length + ' bewezen' + K.uit + ' van de ' + totaal + ' systeemwetten' +
    K.grijs + '  ·  ' + (totaal - bewezen.length) + ' onbewezen (meter: wettenOnbewezen)' + K.uit);

  if (stukkeBron) {
    console.log('\n  ' + K.rood + stukkeBron + ' van de ' + g.bronnen.length + ' bronnen ontbreekt.' + K.uit +
      ' Dit overzicht is daarmee onvolledig, en dat is\n  ' + K.grijs +
      'geen detail: een stand die op halve invoer rust leest als een hele.' + K.uit + '\n');
    return 1;
  }
  console.log('');
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { verzamel, blindeVlekken };
