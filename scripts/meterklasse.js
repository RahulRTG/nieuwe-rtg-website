#!/usr/bin/env node
'use strict';
/* ============================================================================
   KENT EEN METER ZIJN EIGEN KLASSE? -- twee vragen, een script.

   BEWIJSMACHINE.md par. 6a zegt dat een bewijs zijn INDELING en zijn FOUTMODEL
   draagt. Dit script stelt die vraag aan de instrumenten zelf, op de twee
   plekken waar het hier al een keer is misgegaan.

   VRAAG 1 -- DE SCHONE BOOM. Een generator die een artefact wegschrijft dat
   zich als repo-waarheid gedraagt (het draagt een stempel met een commit), hoort
   te weigeren als de boom vuil is: dan hoort zijn uitslag bij een stand die
   nergens is vastgelegd. `eisSchoneBoom()` doet dat. Maar het stempel MELDT het
   achteraf en de poort GRENDELT vooraf, en dat is niet hetzelfde -- vandaar dat
   `registersUitVuileBoom` blijft terugkomen.

     Niet elke schrijver hoeft die poort. Uitvoer die bewust worktree-lokaal is,
     of een tussenronde, hoort hem juist niet te hebben. Het punt is niet dat de
     67 fout zijn -- het punt is dat een generator zijn KLASSE expliciet hoort te
     kennen, en dat vandaag alleen de 11 met de grendel dat aantoonbaar doen.

   VRAAG 2 -- CODE EN COMMENTAAR. 200 scripts lezen broncode. Dat is de verkeerde
   noemer: het merendeel telt bestanden of paden en raakt een regel commentaar
   nooit. De klasse die ertoe doet is smaller -- wie SEMANTIEK afleidt uit de VORM
   van de code (een regex of een includes op de ingelezen tekst) moet door
   `zonderCommentaar()`, want juist een toelichting beschrijft wat de code doet en
   bevat dus per definitie de woorden waar je op zoekt.

     Dat is hier twee keer echt gebeurd: test/mutatiewacht.test.js bleef groen met
     de bewaakte code weg omdat hij zijn eigen commentaar las, en de kop van
     kern/ai/prompt.js bevat `...md` letterlijk als voorbeeld van wat NIET mag.

   DE GRAAD IS `vermoed` EN DAT IS GEEN BESCHEIDENHEID. Beide vragen worden
   lexicaal beantwoord. "Leidt semantiek af uit codevorm" wordt herkend aan een
   patroonaanroep op een ingelezen tekst; een script dat dat op een andere manier
   doet valt erbuiten, en een script dat een regex voor iets anders gebruikt valt
   er ten onrechte in. Het getal wijst een klasse aan om na te lopen en velt geen
   oordeel per script -- daarom drukt hij de namen af en niet alleen een telling.

   HET REGISTER STAAT BEWUST NOG NIET IN DE REPO. Een meetbestand in de wortel
   hoort aan een ratel te hangen (`metingenZonderRatel`) en die ratel hoort geijkt
   te zijn (keuringsregel 35). Voor vraag 2 is die ratel evident -- het aantal
   vormlezers zonder scheiding hoort te dalen. Voor vraag 1 is hij dat NIET: het
   getal 67 kan alleen dalen door grendels toe te voegen, en een deel van die 67
   hoort er juist geen te hebben. Een ratel die daarop duwt, maakt het huis
   slechter en de meter groener.

   Wat die ratel goed maakt is de VERKLARING per generator (repo-waarheid of
   worktree-lokaal), en dat is een besluit dat nog openstaat -- zie
   BEWIJSMACHINE.md par. 6a.2. Tot dat besluit valt, is dit een commando dat je
   draait en geen bestand dat meetelt. `--vastleggen` bestaat voor de dag erna.

   Draaien:  npm run meterklasse            (print)
             npm run meterklasse:vast       (schrijft METERKLASSE.json -- zie hierboven)
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('./lib/bron');
const { stempel, eisSchoneBoom } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'METERKLASSE.json');
const MAP = path.join(WORTEL, 'scripts');

const lees = (n) => {
  try { return zonderCommentaar(fs.readFileSync(path.join(MAP, n), 'utf8')); } catch (e) { return ''; }
};

function meet() {
  const namen = fs.readdirSync(MAP).filter(n => n.endsWith('.js')).sort();
  const schrijvers = [], lezers = [];
  for (const n of namen) {
    const code = lees(n);
    if (/writeFileSync/.test(code)) {
      schrijvers.push({ naam: n, stempelt: /lib\/stempel/.test(code), grendel: /eisSchoneBoom/.test(code) });
    }
    if (/readFileSync/.test(code)) {
      /* Semantiek uit codeVORM: een patroonaanroep OP een ingelezen tekst. De
         namen waaronder zo'n tekst hier rondgaat staan expliciet -- een lijst
         die je kunt nalopen is eerlijker dan een regex die alles vangt. */
      const opTekst = /\b(?:bron|code|tekst|inhoud|src|ruw)\s*\.\s*(?:match|matchAll|includes|replace|split)\s*\(/.test(code);
      const execOp = /\.exec\s*\(\s*(?:bron|code|tekst|inhoud|src|ruw)\b/.test(code);
      lezers.push({ naam: n, vorm: opTekst || execOp, scheidt: /zonderCommentaar|zonderTekst|lib\/bron/.test(code) });
    }
  }
  const stempelend = schrijvers.filter(s => s.stempelt);
  const vormlezers = lezers.filter(l => l.vorm);
  return {
    graad: 'vermoed',
    waarom: 'beide vragen zijn lexicaal beantwoord; de klasse wijst een lijst aan om na te lopen ' +
      'en velt geen oordeel per script -- daarom staan de namen erbij',
    schoneBoom: {
      schrijvers: schrijvers.length,
      claimenRepoWaarheid: stempelend.length,
      metGrendel: stempelend.filter(s => s.grendel).length,
      zonderGrendel: stempelend.filter(s => !s.grendel).map(s => s.naam),
      grendelZonderStempel: schrijvers.filter(s => !s.stempelt && s.grendel).map(s => s.naam)
    },
    commentaar: {
      lezenBron: lezers.length,
      leidenSemantiekAfUitVorm: vormlezers.length,
      metScheiding: vormlezers.filter(l => l.scheidt).length,
      zonderScheiding: vormlezers.filter(l => !l.scheidt).map(l => l.naam)
    }
  };
}

const stand = meet();
if (process.argv.includes('--vastleggen')) {
  const poort = eisSchoneBoom('meterklasse');
  if (!poort.ok) { console.error('[meterklasse] ' + poort.reden); process.exit(2); }
  fs.writeFileSync(DOEL, JSON.stringify(Object.assign({ stempel: stempel() }, stand), null, 2) + '\n');
  console.log('METERKLASSE.json geschreven.');
}
const b = stand.schoneBoom, c = stand.commentaar;
console.log('\nKENT EEN METER ZIJN EIGEN KLASSE?\n');
console.log('  DE SCHONE BOOM');
console.log('    ' + b.schrijvers + ' scripts schrijven een artefact');
console.log('    ' + b.claimenRepoWaarheid + ' daarvan stempelen (en claimen dus repo-waarheid)');
console.log('    ' + b.metGrendel + ' daarvan weigeren een vuile boom, ' + b.zonderGrendel.length + ' niet');
console.log('    ' + b.grendelZonderStempel.length + ' grendelen zonder te stempelen');
console.log('\n  CODE EN COMMENTAAR');
console.log('    ' + c.lezenBron + ' scripts lezen broncode');
console.log('    ' + c.leidenSemantiekAfUitVorm + ' daarvan leiden semantiek af uit de VORM van die code');
console.log('    ' + c.metScheiding + ' daarvan scheiden code en commentaar, ' + c.zonderScheiding.length + ' niet');
console.log('\n  graad: ' + stand.graad + ' -- ' + stand.waarom + '\n');
