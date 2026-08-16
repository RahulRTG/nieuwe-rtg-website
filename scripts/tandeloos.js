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
const regexVeilig = (waarde) => String(waarde).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
  const kern = regexVeilig(expr);
  const kop = regexVeilig(expr.split('.')[0]);
  /* Het VELD, los van de variabele waar het toevallig in zat. Dit scheelde het
     meeste ruis: heel vaak staat de niet-leeg-controle er wel, maar op een
     andere schrijfwijze --

        assert.equal((await api('/api/site/fotos', {}, lid)).body.fotos.length, 1);
        ...
        assert.equal(weg.body.fotos.length, 0, 'en een foto gaat er weer af');

     Dat is een keurige toets: eerst staat er een foto, daarna geen. Maar de
     eerste regel gaat over een anonieme uitdrukking en de tweede over "weg", en
     op de variabelenaam vergeleken zijn dat twee vreemden. Sinds we op het VELD
     kijken (".fotos.length" met iets anders dan nul) vallen die weg. Het is
     grover -- twee verschillende lijsten die toevallig hetzelfde veld heten
     dekken elkaar nu af -- maar een lijst die niemand leest is nuttelozer dan
     een lijst die af en toe een geval mist. */
  const veld = (expr.match(/([A-Za-z_$][\w$]*)\s*$/) || [])[1];
  const kandidaten = [
    new RegExp('assert\\.ok\\(\\s*' + kern + '\\.length'),
    new RegExp('assert\\.ok\\(\\s*' + kern + '\\.some\\('),
    new RegExp('assert\\.equal\\(\\s*' + kern + '\\.length\\s*,\\s*[1-9]'),
    new RegExp('assert\\.ok\\(\\s*' + kern + '\\.length\\s*>=?\\s*[1-9]'),
    // ook een losse controle op de kop van de uitdrukking telt mee
    new RegExp('assert\\.ok\\(\\s*' + kop + '\\.length')
  ];
  if (veld) kandidaten.push(
    /* Vergeleken met iets anders dan nul. Let op de vorm: niet "[1-9]" maar
       "niet-nul", want de eerlijkste variant van deze controle is vaak geen
       vast getal maar een onthouden lengte --
           assert.equal(weg.body.minibar.length, minibarNa - 1, ...)
       -- "er ging er precies een af". Op [1-9] zou die regel niet meetellen en
       zou het script zijn eigen reparatie blijven melden; dat is me hier
       letterlijk gebeurd. */
    /* De \S aan het eind is niet cosmetisch. Zonder hem mag \s* terugvallen naar
       nul tekens, staat de vooruitblik op een spatie in plaats van op de nul, en
       stelt de regel juist de vacuum-vorm vrij die hij moest melden -- precies
       wat er bij mijn eerste poging gebeurde, en de proef in scripts/ liet dat
       zien voordat het in de lijst kon gaan zitten. */
    new RegExp('\\.' + veld + '\\.length\\s*,\\s*(?!0\\s*[,)])\\S'),
    new RegExp('\\.' + veld + '\\.length\\s*[>=]=?\\s*[1-9]'),
    /* some/find ergens in een grotere uitdrukking: (await api('...')).body.X.some(
       Zonder ! ertussen, anders dekt "!x.some(...)" zichzelf af. */
    new RegExp('assert\\.ok\\(\\s*\\(?[^;\\n!]*?\\.' + veld + '\\.some\\('),
    new RegExp('\\.' + veld + '\\.find\\(')
  );
  return kandidaten.some(r => r.test(blok));
}

/* HOE ERG IS DIT GEVAL? Zeventig meldingen op een hoop is geen werklijst maar
   behang. De vorm van de bewering zegt al veel over het risico:

     HOOG   "na het weghalen staat hij er niet meer" -- weg/na/verwijderd, met
            !some of every. Dit is precies de val waar ik zes keer in liep: de
            lijst was al leeg voordat er iets weggehaald werd, dus de bewering
            slaagde zonder ook maar iets te bewijzen. Van alle vormen is dit de
            enige die stelselmatig een ECHTE fout kan verbergen.
     HOOG   "de buurman ziet alleen zijn eigen spullen" -- vreemd/ander/buur.
            Op een lege lijst van de buurman is scheiding vanzelf waar, en dan
            staat er een groene toets boven een deur die misschien openstaat.
     LAAG   "hier hoort niets te staan" -- leeg/zonder/geen/dicht. Daar IS de
            leegte de bewering. Meestal terecht, en dan hoort er hooguit een
            regel bij die zegt waarom.

   Het blijft een vermoeden en geen vonnis; de rangschikking zegt alleen in
   welke volgorde je ze het beste leest. */
function risico(expr, toets) {
  const v = expr.split('.')[0].toLowerCase();
  const t = (toets || '').toLowerCase();
  if (/^(weg|na|verwijderd?|gewist|leeggehaald)/.test(v) || /weghalen|verwijder|opruimen|wissen|intrekken/.test(t)) return 'hoog';
  if (/^(vreemd|ander|buur|derde|gast)/.test(v) || /buren|andere zaak|niet van mij|iemand anders/.test(t)) return 'hoog';
  if (/^(leeg|zonder|geen|dicht|niets)/.test(v)) return 'laag';
  return 'midden';
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

/* BEOORDEELD, MET REDEN. Een leeslijst die je elke keer opnieuw moet doorlezen
   is geen leeslijst maar een straf. Wie een melding bekijkt en hem terecht
   vindt, repareert de toets; wie hem onterecht vindt, zet hem hier neer met de
   reden waarom. Zo blijft er staan wat nog werk is.

   Deze lijst hoort te KRIMPEN als de heuristiek scherper wordt, niet te groeien
   als het ongemakkelijk wordt. Elke regel hieronder is een oordeel dat iemand
   kan nalezen en omdraaien. */
const BEOORDEELD = new Map([
  ['zaak-inrichting.test.js::vreemd.body.rooms',
    'de tegenhanger staat ernaast: bij de buren staat de kamer er nog wel (some), dus beide kanten zijn afgedekt'],
  ['zaak-inrichting.test.js::weg.body.rooms',
    'direct erna volgt assert.equal(weg.body.rooms.length, mijn.length - 1): precies een korter, niet toevallig nul'],
  ['genootschap-beheer.test.js::na.body.groepen',
    'in hetzelfde blok wordt de groep na het openzetten WEL gevonden; was zoeken stuk, dan zakt die regel'],
  ['gegevenspoort.test.js::na.body.ontbreekt',
    '"er mist niets meer" heeft in hetzelfde blok een tegenhanger die wel iets mist (adres), dus de poort meldt aantoonbaar nog'],
  ['gegevenspoort.test.js::bezorg2.body.ontbreekt',
    'zelfde blok, zelfde tegenhanger: de poort meldt aantoonbaar nog wat er mist'],
  ['webauthn.test.js::lijst.body.sleutels',
    'hier IS de leegte de bewering: er staat geen sleutel tot de browser-ceremonie er een zet, en die kan een toets niet doen'],
  ['boardroom-poort.test.js::weg.body.lijst',
    'de echte bewering staat eronder: na het intrekken geeft de boardroom 403. Die zakt wel als het intrekken niets doet'],
  ['eigen-website.test.js::leeg.body.fotos',
    'de bibliotheek van de buurman hoort leeg te zijn -- dat is de scheiding zelf, en de eigen kant staat ernaast op 1'],
  ['galerij.test.js::gb.body.beelden',
    'de galerij van B hoort leeg te zijn: beelden zijn van het lid zelf. De leegte IS hier de bewering, en de kant van A staat ernaast met een find()'],
  ['synergie.test.js::p.body.pakketten',
    '"zolang niet iedereen tekende is er geen pakket" -- nul is precies wat er getoetst wordt; de gevulde kant staat in het volgende blok'],
  ['regie.test.js::apps.body.uit',
    'de standaardindeling zet niets uit, dus een lege uit-lijst is de bewering zelf'],
  ['webauthn.test.js::lijst.body.sleutels',
    'hier IS de leegte de bewering: er staat geen sleutel tot de browser-ceremonie er een zet, en die kan een toets niet doen']
]);

/* ZELFTOETS. Dit script bestaat om vacuum-beweringen te vinden, en het is zelf
   een verzameling reguliere uitdrukkingen -- dus kan het net zo goed stilletjes
   stoppen met vinden. Dat gebeurde ook echt: een \s* die mocht terugvallen naar
   nul tekens zette de vooruitblik op een spatie in plaats van op de nul, en
   toen stelde de regel juist de vorm vrij die hij moest melden. Alle meldingen
   verdwenen en dat zag eruit als vooruitgang.

   Daarom deze vijf regels: twee die GEMELD horen te worden en drie die terecht
   worden vrijgesteld. Draait dit niet goed, dan klopt het gereedschap niet en
   zegt een lege lijst niets.

   Draaien: node scripts/tandeloos.js --zelftoets */
function zelftoets() {
  const proeven = [
    [true, 'kale lengte-nul', "assert.equal(r.body.items.length, 0, 'leeg');"],
    [true, 'kale !some', 'assert.ok(!weg.body.items.some(x => x.id === id));'],
    [false, 'eerst lengte 1, daarna nul', "assert.equal(a.body.items.length, 1);\nassert.equal(weg.body.items.length, 0);"],
    [false, 'precies een korter dan onthouden', 'assert.equal(weg.body.items.length, naLengte - 1);'],
    [false, 'some in een grotere uitdrukking', "assert.ok((await api('/api/x', {}, t)).body.items.some(x => x.id === id));"]
  ];
  let stuk = 0;
  for (const [moetMelden, naam, tekst] of proeven) {
    const gemeld = !isNietLeegVerklaard(tekst, 'r.body.items');
    const goed = gemeld === moetMelden;
    if (!goed) stuk++;
    console.log('  ' + (goed ? K.groen + 'goed' : K.rood + 'FOUT') + K.reset + '  '
      + (gemeld ? 'gemeld     ' : 'vrijgesteld') + '  ' + naam);
  }
  console.log('\n  ' + (stuk ? K.rood + stuk + ' van de ' + proeven.length + ' fout: het gereedschap ziet niet meer wat het moet zien'
    : K.groen + 'alle ' + proeven.length + ' goed') + K.reset + '\n');
  return stuk ? 1 : 0;
}

function main() {
  if (process.argv.includes('--zelftoets')) return zelftoets();
  const map = path.join(WORTEL, 'test');
  const bestanden = fs.readdirSync(map).filter(f => f.endsWith('.js')).sort();
  let meldingen = 0, bekeken = 0, beoordeeld = 0;
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
          if (BEOORDEELD.has(f + '::' + expr)) { beoordeeld++; continue; }
          hier.push({ toets: b.naam, expr, vorm: v.naam, lijn: b.lijn, risico: risico(expr, b.naam) });
          meldingen++;
        }
      }
    }
    if (hier.length) perBestand.push({ f, hier });
  }

  if (!stil) {
    const alleen = (process.argv.find(a => a.startsWith('--risico=')) || '').split('=')[1] || null;
    console.log('\n\x1b[1mTANDELOZE BEWERINGEN\x1b[0m ' + K.grijs + '(een bewering die op een lege verzameling vanzelf slaagt)' + K.reset);
    console.log(K.grijs + '  op risico gesorteerd; hoog = "na het weghalen is hij weg" of "de buurman ziet niets",'
      + '\n  en dat zijn de twee vormen die echt een fout kunnen verbergen.' + K.reset + '\n');
    const kleur = { hoog: K.rood, midden: K.geel, laag: K.grijs };
    for (const rang of ['hoog', 'midden', 'laag']) {
      if (alleen && alleen !== rang) continue;
      const rijen = perBestand.map(({ f, hier }) => ({ f, hier: hier.filter(h => h.risico === rang) })).filter(x => x.hier.length);
      if (!rijen.length) continue;
      console.log('  \x1b[1m' + rang.toUpperCase() + '\x1b[0m ' + K.grijs + '(' + rijen.reduce((n, x) => n + x.hier.length, 0) + ')' + K.reset);
      for (const { f, hier } of rijen) {
        console.log('    ' + f);
        for (const h of hier)
          console.log('      ' + kleur[rang] + h.expr + K.reset + '  ' + K.grijs + h.vorm + ' -- ' + h.toets.slice(0, 58) + K.reset);
      }
      console.log('');
    }
    console.log('  ' + bekeken + ' beweringen van deze vorm bekeken, ' + meldingen + ' zonder een controle dat de verzameling gevuld is'
      + (beoordeeld ? ', ' + beoordeeld + ' eerder beoordeeld en met reden vrijgesteld' : '') + '.');
    console.log('  ' + K.grijs + 'Dit is een leeslijst, geen poort: soms is "er staat niets" precies wat je toetst.' + K.reset + '\n');
  }
  return 0;
}
if (require.main === module) process.exit(main());
