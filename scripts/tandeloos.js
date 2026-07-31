#!/usr/bin/env node
/* ============================================================================
   TANDELOZE BEWERINGEN -- toetsen die niet kunnen falen.

   Een bewering over een LEGE verzameling is vanzelf waar:

       [].every(x => x.klopt)          is true
       ![].some(x => x.fout)           is true
       assert.equal([].length, 0)      slaagt altijd
       assert.deepEqual([], [])        slaagt altijd

   Dat is geen theorie. In deze ronde overkwam het mij zes keer, en vier keer
   met precies dezelfde oorzaak: de lijst waarin de toets iets dacht aan te
   wijzen was leeg. De toets stond groen boven een fout die er gewoon nog zat.
   Alle zes zijn ontdekt door te MUTEREN, geen enkele door de toets zelf.

   Dit script zoekt die vorm op. Per toetsblok kijkt het of er een bewering
   staat die op een lege verzameling vanzelf slaagt, EN of datzelfde blok
   ergens vaststelt dat die verzameling niet leeg is. Ontbreekt dat tweede,
   dan is de bewering hoogstens een vermoeden.

   HET IS EEN VERMOEDEN, GEEN VONNIS. Soms is "er staat niets" precies wat je
   wilt toetsen (een verse zaak heeft geen ritten). Daarom meldt dit script en
   faalt het niet: het is een leeslijst voor wie een toets schrijft, geen
   poort. Wie een melding bekijkt en hem terecht vindt, zet er een regel bij.

   Draaien:  node scripts/tandeloos.js [--stil]
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const stil = process.argv.includes('--stil');
const K = { rood: '\x1b[31m', geel: '\x1b[33m', grijs: '\x1b[90m', groen: '\x1b[32m', reset: '\x1b[0m' };

/* De vier vormen die op een lege verzameling vanzelf slagen. De vangst is de
   uitdrukking waarover de bewering gaat, zodat we kunnen kijken of DIE ergens
   niet-leeg is verklaard. */
const VORMEN = [
  { naam: 'every op een lege lijst is waar', re: /assert\.ok\(\s*([\w.[\]() ]+?)\.every\(/g },
  { naam: 'geen enkele voldoet, ook als er niets is', re: /assert\.ok\(\s*!\s*([\w.[\]() ]+?)\.some\(/g },
  { naam: 'lengte nul, terwijl hij misschien altijd nul is', re: /assert\.equal\(\s*([\w.[\]() ]+?)\.length\s*,\s*0\s*[,)]/g },
  { naam: 'gelijk aan een lege lijst', re: /assert\.deepEqual\(\s*([\w.[\]() ]+?)\s*,\s*\[\s*\]\s*[,)]/g }
];
/* Wat een verzameling niet-leeg verklaart. Ruim opgevat: elke bewering die
   over de lengte gaat en niet "nul" zegt, of een positieve some/find. */
function isNietLeegVerklaard(blok, expr) {
  const kern = expr.replace(/[.[\]()]/g, '\\$&');
  const kop = kern.split('\\.')[0];
  const kandidaten = [
    new RegExp('assert\\.ok\\(\\s*' + kern + '\\.length'),
    new RegExp('assert\\.ok\\(\\s*' + kern + '\\.some\\('),
    new RegExp('assert\\.equal\\(\\s*' + kern + '\\.length\\s*,\\s*[1-9]'),
    new RegExp('assert\\.ok\\(\\s*' + kern + '\\.length\\s*>=?\\s*[1-9]'),
    // ook een losse controle op de kop van de uitdrukking telt mee
    new RegExp('assert\\.ok\\(\\s*' + kop + '\\.length')
  ];
  return kandidaten.some(r => r.test(blok));
}

/* Een toetsbestand in blokken hakken: alles vanaf een test('...' tot de
   volgende. Ruw maar genoeg -- we hoeven alleen te weten wat er in dezelfde
   toets staat. */
function blokken(bron) {
  const uit = [];
  const re = /^test(?:\.\w+)?\(\s*['"`](.+?)['"`]/gm;
  let m, vorige = null;
  while ((m = re.exec(bron))) {
    if (vorige) uit.push({ naam: vorige.naam, tekst: bron.slice(vorige.start, m.index), lijn: vorige.lijn });
    vorige = { naam: m[1], start: m.index, lijn: bron.slice(0, m.index).split('\n').length };
  }
  if (vorige) uit.push({ naam: vorige.naam, tekst: bron.slice(vorige.start), lijn: vorige.lijn });
  return uit;
}

function main() {
  const map = path.join(WORTEL, 'test');
  const bestanden = fs.readdirSync(map).filter(f => f.endsWith('.js')).sort();
  let meldingen = 0, bekeken = 0;
  const perBestand = [];

  for (const f of bestanden) {
    const bron = fs.readFileSync(path.join(map, f), 'utf8');
    const hier = [];
    for (const b of blokken(bron)) {
      for (const v of VORMEN) {
        v.re.lastIndex = 0;
        let m;
        while ((m = v.re.exec(b.tekst))) {
          bekeken++;
          const expr = m[1].trim();
          if (!expr || expr.length > 60) continue;
          /* Alleen verzamelingen die UIT EEN ANTWOORD komen. Een lijst die de
             toets zelf opbouwt -- de fouten van een pagina, een lijstje
             missers -- is juist bedoeld om leeg te zijn; daar is "er staat
             niets" de hele bewering. Het risico zit bij wat de server
             teruggeeft, want dat kan leeg zijn door de OPZET en niet door de
             code. Zonder deze afbakening meldde dit script 266 van de 334
             gevallen, en dan leest niemand het meer. */
          if (!/\bbody\b/.test(expr)) continue;
          if (isNietLeegVerklaard(b.tekst, expr)) continue;
          hier.push({ toets: b.naam, expr, vorm: v.naam, lijn: b.lijn });
          meldingen++;
        }
      }
    }
    if (hier.length) perBestand.push({ f, hier });
  }

  if (!stil) {
    console.log('\n\x1b[1mTANDELOZE BEWERINGEN\x1b[0m ' + K.grijs + '(een bewering die op een lege verzameling vanzelf slaagt)' + K.reset + '\n');
    for (const { f, hier } of perBestand) {
      console.log('  ' + f);
      for (const h of hier)
        console.log('    ' + K.geel + h.expr + K.reset + '  ' + K.grijs + h.vorm + ' -- ' + h.toets.slice(0, 60) + K.reset);
    }
    console.log('\n  ' + bekeken + ' beweringen van deze vorm bekeken, ' + meldingen + ' zonder een controle dat de verzameling gevuld is.');
    console.log('  ' + K.grijs + 'Dit is een leeslijst, geen poort: soms is "er staat niets" precies wat je toetst.' + K.reset + '\n');
  }
  return 0;
}
if (require.main === module) process.exit(main());
