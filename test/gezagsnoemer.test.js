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
      assert.ok(['evident', 'aangenomen', 'onbepaald'].includes(v.grond), waar + ' heeft geen geldige grond');
      if (v.grond === 'evident') assert.ok(v.citaat && v.citaat.length > 2, waar + ' noemt zich evident zonder citaat uit de bron');
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
  const raak = [];
  (function loop(dir) {
    for (const naam of fs.readdirSync(dir)) {
      const p = path.join(dir, naam);
      const st = fs.statSync(p);
      if (st.isDirectory()) { if (naam !== 'node_modules' && naam !== 'data') loop(p); continue; }
      if (!naam.endsWith('.js')) continue;
      if (/gezagsnoemer/.test(fs.readFileSync(p, 'utf8'))) raak.push(path.relative(WORTEL, p));
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

test('9. de openstaande besluiten worden geteld en niet weggepoetst', () => {
  const open = R.aangenomen.length + R.onbepaald.length;
  assert.ok(open > 0, 'nul open besluiten zou betekenen dat vijf verschillende schalen naadloos passen; ' +
    'dat is precies de bewering die GEZAG.json weerspreekt');
  for (const a of R.aangenomen.concat(R.onbepaald))
    assert.ok(a.vraag, 'open besluit zonder vraag bij ' + a.bestand + ' :: ' + a.trede);
});
