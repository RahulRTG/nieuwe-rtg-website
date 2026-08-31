/* DE GEDEELDE NOEMER VAN DE GEZAGSSCHALEN (scripts/gezagsnoemer.js).

   GEZAG.json houdt vast dat dit huis de vraag "mag de machine dit zelf?" op vijf
   plekken met vijf eigen woordenlijsten beantwoordt, en zegt erbij dat niemand ze
   naast elkaar kan leggen. De noemer verklaart die vijf in vier treden. Deze toets
   bewaakt niet of die verklaring de JUISTE is -- dat is een besluit van de eigenaar,
   en het script houdt zulke gevallen apart als `aangenomen` en `onbepaald`. Hij
   bewaakt de drie dingen die wel machinaal te handhaven zijn:

     1 de noemer is COMPLEET tegenover scripts/gezag.js -- een zesde schaal of een
       nieuwe trede kan er niet stil bij komen;
     2 de projectie VERRUIMT nooit -- een trede die "een mens doet het" zegt kan
       niet op `uitvoeren` uitkomen;
     3 de noemer BESLIST niets -- niets in server/ importeert hem, want dan was hij
       de zesde gezagsschaal in plaats van de meetlaag eroverheen.

   Regel 1 is de belangrijkste. Zonder hem is dit register precies wat WETTEN.json
   over zichzelf zegt: het bevat alleen wat iemand heeft opgeschreven. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { bouw, NOEMER, TREDEN, PROJECTIES } = require('../scripts/gezagsnoemer');
const { REGISTER } = require('../scripts/gezag');

const WORTEL = path.join(__dirname, '..');
const R = bouw();

test('0. de meter ijkt zichzelf: elke schaal staat nog letterlijk in zijn bron', () => {
  assert.deepEqual(R.meterstuk.map(m => m.bestand + ': ' + m.reden), [],
    'een geregistreerde schaal is uit zijn bronbestand verdwenen -- dan meet dit script een register en geen code');
});

test('1. COMPLEET: elke schaal uit scripts/gezag.js heeft een projectie', () => {
  const geprojecteerd = new Set(PROJECTIES.map(p => p.bestand));
  const ontbreekt = REGISTER.map(r => r.bestand).filter(b => !geprojecteerd.has(b));
  assert.deepEqual(ontbreekt, [],
    'gezagsschaal zonder plek in de noemer: ' + ontbreekt.join(', ') +
    ' -- een zesde schaal hoort een besluit te zijn, geen stille toevoeging');
});

test('2. COMPLEET: elke trede van elke geregistreerde schaal is verklaard', () => {
  for (const reg of REGISTER) {
    const p = PROJECTIES.find(x => x.bestand === reg.bestand);
    assert.ok(p, 'geen projectie voor ' + reg.bestand);
    const ontbreekt = reg.schaal.filter(t => !Object.prototype.hasOwnProperty.call(p.treden, t));
    assert.deepEqual(ontbreekt, [],
      reg.bestand + ' heeft onverklaarde trede(n): ' + ontbreekt.join(' '));
  }
});

test('3. en andersom: de noemer verzint geen treden die de schaal niet heeft', () => {
  for (const p of PROJECTIES) {
    const reg = REGISTER.find(x => x.bestand === p.bestand);
    if (!reg) continue;
    const verzonnen = Object.keys(p.treden).filter(t => !reg.schaal.includes(t));
    assert.deepEqual(verzonnen, [],
      p.bestand + ': trede(n) geprojecteerd die in gezag.js niet bestaan: ' + verzonnen.join(' '));
  }
});

test('4. DE PROJECTIE VERRUIMT NOOIT: wat "geen" of "mens" zegt, wordt geen uitvoering', () => {
  for (const p of PROJECTIES)
    for (const [trede, v] of Object.entries(p.treden)) {
      const doel = Array.isArray(v.noemer) ? v.noemer : [v.noemer];
      if (/^(verboden|hand)$/.test(trede))
        assert.deepEqual(doel, ['geen'],
          p.bestand + ' :: ' + trede + ' mag alleen op "geen" uitkomen, niet op ' + doel.join('|'));
      if (/^(kijken|waarnemen|informeren|adviseren|aanbevelen)$/.test(trede))
        assert.ok(!doel.includes('uitvoeren'),
          p.bestand + ' :: ' + trede + ' is een kijk-trede en mag nooit op uitvoeren uitkomen');
    }
});

test('5. elke trede draagt een grond, en elke grond draagt zijn onderbouwing', () => {
  for (const p of PROJECTIES)
    for (const [trede, v] of Object.entries(p.treden)) {
      const waar = p.bestand + ' :: ' + trede;
      assert.ok(['evident', 'besloten', 'aangenomen', 'onbepaald'].includes(v.grond), waar + ' heeft geen geldige grond');
      if (v.grond === 'evident') assert.ok(v.citaat && v.citaat.length > 2, waar + ' noemt zich evident zonder citaat uit de bron');
      else if (v.grond === 'besloten') assert.ok(v.besluit && v.besluit.length > 40,
        waar + ' heet BESLOTEN zonder de reden die de eigenaar gaf -- dan is het een aanname met een ander etiket');
      else assert.ok(v.vraag && v.vraag.length > 20, waar + ' is ' + v.grond + ' zonder de vraag die een mens moet beantwoorden');
      for (const d of (Array.isArray(v.noemer) ? v.noemer : [v.noemer]))
        assert.ok(TREDEN.includes(d), waar + ' valt op een noemertrede die niet bestaat: ' + d);
    }
});

test('6. een "evident" citaat staat echt in de bron waar het uit heet te komen', () => {
  for (const p of PROJECTIES) {
    const tekst = fs.readFileSync(path.join(WORTEL, p.bestand), 'utf8');
    for (const [trede, v] of Object.entries(p.treden)) {
      if (v.grond !== 'evident' || v.citaat.length < 12) continue; // korte citaten zijn de trede zelf
      assert.ok(tekst.includes(v.citaat),
        p.bestand + ' :: ' + trede + ' citeert "' + v.citaat + '", maar die zin staat er niet');
    }
  }
});

test('7. DE NOEMER BESLIST NIETS: niets in server/ importeert hem', () => {
  /* Alleen een ECHTE import telt. Deze toets zocht eerst op elke vermelding van
     het woord, en sloeg toen aan op het commentaar in stuur/beleid.js dat naar
     de noemer verwijst om uit te leggen waarom `direct` gesplitst is. Dat is
     precies het tegenovergestelde van het gevaar: een verwijzing in commentaar
     maakt de herkomst van een besluit navolgbaar, een require maakt de meetlaag
     tot beslisser. */
  const raak = [];
  (function loop(dir) {
    for (const naam of fs.readdirSync(dir)) {
      const p = path.join(dir, naam);
      const st = fs.statSync(p);
      if (st.isDirectory()) { if (naam !== 'node_modules' && naam !== 'data') loop(p); continue; }
      if (!naam.endsWith('.js')) continue;
      const tekst = fs.readFileSync(p, 'utf8');
      if (/require\([^)]*gezagsnoemer|import[^;]*gezagsnoemer/.test(tekst)) raak.push(path.relative(WORTEL, p));
    }
  })(path.join(WORTEL, 'server'));
  assert.deepEqual(raak, [],
    'server/ gebruikt de noemer: ' + raak.join(', ') + ' -- dan is hij de zesde gezagsschaal ' +
    'in plaats van de meetlaag eroverheen, en dat is een besluit van de eigenaar');
});

test('8. de noemer is geordend van minst naar meest machine, en staat letterlijk in zijn bestand', () => {
  assert.deepEqual(TREDEN, ['geen', 'tonen', 'klaarzetten', 'uitvoeren']);
  const tekst = fs.readFileSync(path.join(WORTEL, 'scripts/gezagsnoemer.js'), 'utf8');
  for (const t of TREDEN) assert.ok(tekst.includes("'" + t + "'"), 'trede ' + t + ' staat niet letterlijk in het bestand');
  assert.equal(NOEMER.length, TREDEN.length);
});

test('9. niets valt tussen wal en schip: elke niet-evidente trede is open OF beslist', () => {
  /* Dit ving eerst iets anders: zolang er open besluiten waren, eiste deze toets
     er minstens een. Nu de eigenaar ze heeft beantwoord zou die eis de toets
     laten zakken op een OPGELOST probleem -- en dat is precies hoe een toets een
     hindernis wordt in plaats van een vangnet. Wat overblijft is de eis die niet
     verjaart: geen trede zonder grond, en geen grond zonder onderbouwing. */
  for (const a of R.aangenomen.concat(R.onbepaald))
    assert.ok(a.vraag, 'open besluit zonder vraag bij ' + a.bestand + ' :: ' + a.trede);
  for (const b of R.besloten)
    assert.ok(b.besluit && b.besluit.length > 40,
      'beslist zonder reden bij ' + b.bestand + ' :: ' + b.trede);
  const verklaard = R.evident + R.besloten.length + R.aangenomen.length + R.onbepaald.length;
  assert.equal(verklaard, R.treden, 'er zijn treden zonder grond: ' + (R.treden - verklaard));
});

test('10. de vier besluiten van de eigenaar staan vast en zijn niet stilletjes teruggedraaid', () => {
  /* De splitsing van `direct` is de enige die ook CODE veranderde; de andere
     drie zijn keuzes in de projectie. Alle vier horen ze na te trekken te zijn,
     want een besluit dat alleen in een gesprek bestond is over een half jaar
     een aanname. */
  const vind = (bestand, trede) => (PROJECTIES.find(p => p.bestand === bestand) || { treden: {} }).treden[trede];
  assert.ok(!vind('server/kern/stuur/beleid.js', 'direct'), '`direct` bestaat weer als trede: de splitsing is teruggedraaid');
  assert.equal(vind('server/kern/stuur/beleid.js', 'lezen').noemer, 'tonen');
  assert.equal(vind('server/kern/stuur/beleid.js', 'klein').noemer, 'uitvoeren');
  assert.equal(vind('server/kern/geldbeleid/regels.js', 'voorstellen').noemer, 'tonen');
  assert.equal(vind('server/kern/stadsweefsel/ainiveau.js', 'begrensd').noemer, 'uitvoeren');
  assert.equal(vind('server/kern/bureau/delegatie.js', 'autonoom').noemer, 'uitvoeren');
  assert.equal(TREDEN.length, 4, 'de noemer heeft geen vier treden meer, terwijl de eigenaar juist besloot hem op vier te houden');
});

/* DE RATEL OP GEZAGSNOEMER.json. De toetsen hierboven beproeven de BOUW; het
   register zelf hing aan geen enkele ratel. Wat hier vastligt is de stand die
   verdiend is: nul onbepaald en nul aangenomen. Een trede die terugvalt naar
   "we nemen aan dat het dit betekent" is precies de vorm waar deze noemer
   tegen bestaat, en dat mag niet stil gebeuren. */
test('9. GEZAGSNOEMER.json zakt niet terug naar aannames', () => {
  const b = path.join(WORTEL, 'GEZAGSNOEMER.json');
  if (!fs.existsSync(b)) return;
  const u = JSON.parse(fs.readFileSync(b, 'utf8'));
  assert.equal(u.onbepaald.length, 0,
    'er staat een ONBEPAALDE trede in het register; die zijn alle vier besloten en horen zo te blijven');
  assert.equal(u.aangenomen.length, 0,
    'er staat een AANGENOMEN trede in het register; aangenomen is geen grond, en de drie die er ' +
    'stonden zijn met een besluit vervangen');
  assert.ok(u.evident >= 18,
    'minder evidente treden dan er waren (' + u.evident + ' < 18): een citaat dat niet meer ' +
    'letterlijk in zijn bron staat, laat een trede zakken en dat hoort hier op te vallen');
  assert.ok(u.tredenZonderSchaal.length === 0 || Array.isArray(u.tredenZonderSchaal));
});
