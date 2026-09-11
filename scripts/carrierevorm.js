#!/usr/bin/env node
/* ============================================================================
   DE CARRIEREVORM -- delen de domeinen van een talent werkelijk een lus?

   DE VRAAG KOMT UIT CARRIERE.md par. 0. Het voorstel voor een Human Career
   Infrastructure rust op een bewering die aantrekkelijk klinkt:

     "Een amateurvoetballer van 15, een dj van 22, een Olympisch sporter, een
      model, een creator en een acteur verschillen enorm -- maar hun
      onderliggende lus is bijna dezelfde."

   Dat KAN waar zijn. Of het waar IS, is een meting, en dit huis heeft die vraag
   al eens verkeerd beantwoord: `Asset` klonk net zo vanzelfsprekend over tafel,
   kamer, podium en leaseauto, en sneuvelde toen scripts/objectmodel.js hem
   tegen de code hield. Een lus die over vijftien domeinen wordt VERKLAARD, duwt
   alles wat ze onderscheidt naar een `extra`-veld -- en dan heeft wie erop
   bouwt vijftien keer werk in plaats van een keer.

   DAAROM DEZELFDE METHODE EN NIET EEN TWEEDE. Dit bestand leest niet zelf; het
   hergebruikt `lees()` en `domeinVan()` uit scripts/objectmodel.js. Twee meters
   met elk een eigen parser geven binnen een maand twee getallen over hetzelfde
   (LAT.md regel 4), en dan is de vergelijking met de Asset-meting waardeloos --
   want die is nu juist waar de conclusie op rust.

   WAT ER GEMETEN WORDT: over de domeinen waar een mens die van zijn talent
   leeft vandaag woont, hoeveel VELDEN staan er in alle domeinen, in de helft,
   en in precies een? De envelop gaat eraf (`id`, `at`, `naam`, `status` en de
   rest van de 29 velden die overal staan), want een gedeeld `id` is geen
   gedeelde lus.

   EN WAT HIJ MET OPZET NIET MEET: of de lus als PROCES bestaat. Dat is een
   andere vraag dan of de DATA een vorm deelt, en de uitkomst hieronder is
   precies waarom die twee uit elkaar moeten. Voor de procesvraag is de vorm de
   ketenproef (scripts/tafelproef.js en zijn twee zusters), niet deze meter.
   Wie deze nul leest als "er is geen lus", leest hem verkeerd; hij zegt dat de
   lus geen OBJECT is.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const om = require('./objectmodel.js');
/* Een register zonder tijdstempel is niet na te lopen: verouderd ziet er dan
   identiek uit aan vers. scripts/meetkeuring.js telt precies dat, en dit
   bestand stond er zelf op. */
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');

/* De domeinen waar een mens die van zijn talent leeft vandaag woont. Met opzet
   RUIM: een domein dat er ten onrechte bij staat, verlaagt hooguit de
   gedeeldheid; een domein dat ontbreekt, verbergt juist een gedeelde vorm. En
   de lijst staat hier en niet in CARRIERE.md, want een lijst in een document
   loopt achter op de code zodra iemand een domein hernoemt. */
const DOMEINEN = /^server\/(kern\/)?(sportclub|festival|muziek|studio|atelier|clips|creator|events|podium|theater|galerij|mediaos|leverancier|concern|rtfos)\b/;

function meet() {
  const g = om.lees();
  const envelop = new Set(JSON.parse(fs.readFileSync(path.join(WORTEL, 'OBJECTMODEL.json'), 'utf8')).envelop);

  const perDomein = new Map();
  let vormen = 0;
  for (const v of g.vormen) {
    if (!DOMEINEN.test(v.module)) continue;
    vormen++;
    const d = om.domeinVan(v.module);
    if (!perDomein.has(d)) perDomein.set(d, new Set());
    for (const f of v.velden) if (!envelop.has(f)) perDomein.get(d).add(f);
  }

  const domeinen = [...perDomein.keys()].sort();
  const veldDom = new Map();
  for (const d of domeinen) {
    for (const f of perDomein.get(d)) {
      if (!veldDom.has(f)) veldDom.set(f, []);
      veldDom.get(f).push(d);
    }
  }

  const n = domeinen.length;
  const helft = Math.ceil(n / 2);
  const lijst = [...veldDom.entries()]
    .map(([veld, waar]) => ({ veld, domeinen: waar.length, waar }))
    .sort((a, b) => b.domeinen - a.domeinen || a.veld.localeCompare(b.veld));

  const eigen = lijst.filter(x => x.domeinen === 1).length;
  return {
    gemeten: {
      vormen,
      domeinen: n,
      velden: lijst.length,
      inAlleDomeinen: lijst.filter(x => x.domeinen === n).length,
      inMinstensDeHelft: lijst.filter(x => x.domeinen >= helft).length,
      helftDrempel: helft,
      veldenDomeineigen: eigen,
      domeineigenPct: lijst.length ? Math.round((eigen / lijst.length) * 1000) / 10 : 0
    },
    perDomein: domeinen.map(d => ({ domein: d, velden: perDomein.get(d).size })),
    gedeeld: lijst.filter(x => x.domeinen >= 2).slice(0, 20)
  };
}

module.exports = { meet, DOMEINEN };

if (require.main === module) {
  const r = meet();
  const g = r.gemeten;
  /* GEEN process.exit() NA GROTE UITVOER. Node sluit dan af terwijl de pipe nog
     leegloopt: geldige tekst, kapotte JSON, exitcode 0. Dat is een van de vier
     fouten waar scripts/meetkeuring.js voor bestaat, en dit bestand maakte hem. */
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r)); process.exitCode = 0; return; }
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(path.join(WORTEL, 'CARRIEREVORM.json'), JSON.stringify(Object.assign({
      stempel: stempel({ instrument: 'scripts/carrierevorm.js' }),
      uitleg: 'Gemeten met scripts/carrierevorm.js, op de lezer van scripts/objectmodel.js. De vraag staat in CARRIERE.md par. 0. Dit meet of de talentdomeinen een DATAVORM delen; of zij een PROCES delen is een andere vraag, waarvoor de ketenproef de vorm is.',
      grens: 'Wat deze meter NIET aantoont: dat de talentdomeinen geen gedeelde LUS hebben -- hij kijkt naar bewaarde VORMEN (velden van objectliteralen) en niet naar werkwoorden, volgorde of uitkomst. Een nul hier zegt dus dat er geen gedeeld OBJECT is, niet dat er geen gedeeld PROCES is; die tweede vraag beantwoordt een ketenproef (scripts/ketenvorm.js). Hij zegt ook niets over de vraag of een domein TERECHT in de lijst staat: DOMEINEN is met opzet ruim, en een domein dat er ten onrechte bij staat verlaagt hooguit de gedeeldheid. En hij leest alleen wat er in de bron STAAT -- een veld dat pas bij runtime ontstaat, ziet hij niet.',
      vastgelegd: new Date().toISOString().slice(0, 10)
    }, r), null, 2) + '\n');
    console.log('CARRIEREVORM.json geschreven.');
  }
  console.log('\n  DE CARRIEREVORM\n');
  console.log('  ' + g.vormen + ' bewaarde vormen in ' + g.domeinen + ' talentdomeinen, samen ' + g.velden + ' velden (envelop eraf).');
  console.log('');
  console.log('  In ALLE ' + g.domeinen + ' domeinen:            ' + g.inAlleDomeinen + ' velden');
  console.log('  In minstens ' + g.helftDrempel + ' van de ' + g.domeinen + ':        ' + g.inMinstensDeHelft + ' velden');
  console.log('  In precies EEN domein:        ' + g.veldenDomeineigen + ' velden (' + g.domeineigenPct + '%)');
  console.log('');
  if (r.gedeeld.length) {
    console.log('  WAT ER WEL GEDEELD WORDT\n');
    for (const x of r.gedeeld.slice(0, 10)) {
      console.log('    ' + x.veld.padEnd(16) + x.domeinen + '/' + g.domeinen + '   ' + x.waar.join(', '));
    }
    console.log('');
  }
  console.log('  Lees deze uitkomst met CARRIERE.md par. 0 ernaast: een nul hier zegt');
  console.log('  dat de carrierelus geen OBJECT is, niet dat hij niet bestaat.\n');
}
