/* DE PLANCOMPILER (server/kern/stuur/plan.js, EXECUTIE.md blok 3).

   De sprong van dit blok is dat een keten van handelingen een OBJECT wordt dat
   je kunt wegen voordat er iets gebeurt. De verleiding daarbij is dat zo'n
   compiler langzaam zelf gaat beslissen -- en dan is hij de tweede allowlist en
   de zesde gezagsschaal tegelijk. Deze suite bewaakt de vier regels die dat
   tegenhouden:

     1 PLAN VOERT NIETS UIT. Geen fetch, geen stuurRoep, geen enkele weg naar een
       effect -- en dat is hier een toets op de BRON, niet op gedrag, want een
       weg die er niet is kan ook niet per ongeluk gebruikt worden.
     2 PLAN BEZIT NIETS. Het oordeel per stap is exact wat beleidVoor() zegt.
     3 DE AUTORITEIT KOMT LIVE. EXECUTION_MAP.json weet hetzelfde maar kan een
       commit achterlopen; een plan dat op de projectie leunt, kan een route
       toestaan die vanochtend van de lijst is gehaald.
     4 EEN AFGEWEZEN STAP LAAT HET PLAN ZAKKEN. Hij wordt nooit stil
       overgeslagen: een keten waarvan stap 5 wegvalt, is een andere keten dan
       de gebruiker las. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { compileer, MAX_STAPPEN } = require('../server/kern/stuur/plan');
const { beleidVoor } = require('../server/kern/stuur/beleid');

/* Alleen de CODE telt. De kop van plan.js legt uit dat er geen fetch en geen
   stuurRoep in zit, en die uitleg is precies wat je wilt bewaren -- een toets
   die op het woord zoekt, slaat aan op zijn eigen documentatie. Commentaar gaat
   er dus eerst af. Dezelfde les als bij de noemer, waar een verwijzing in
   commentaar werd aangezien voor een import. */
const RUW = fs.readFileSync(path.join(__dirname, '..', 'server/kern/stuur/plan.js'), 'utf8');
const BRON = RUW.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const stap = (id, capability, extra) => Object.assign({ id, capability }, extra || {});

test('1. PLAN VOERT NIETS UIT: er is geen weg naar een effect in de bron', () => {
  for (const verboden of [/\bfetch\s*\(/, /stuurRoep/, /require\(['"][^'"]*stuur['"]\)/, /https?\.request/, /child_process/])
    assert.ok(!verboden.test(BRON),
      'plan.js bevat een weg naar uitvoering (' + verboden + ') -- wegen die er niet zijn, kunnen niet per ongeluk gebruikt worden');
  assert.ok(!/module\.exports[^]*voer|uitvoer\s*[:(]/.test(BRON.split('module.exports')[1] || ''),
    'plan.js exporteert iets dat op uitvoeren lijkt');
});

test('2. PLAN BEZIT NIETS: het oordeel per stap is exact beleidVoor()', () => {
  const paden = ['/api/pay/saldo', '/api/agenda/toevoegen', '/api/bijles/vraag', '/api/bank/overboek'];
  const r = compileer({ doel: 'gemengd', stappen: paden.map((p, i) => stap('s' + i, p)) }, 'member');
  for (const s of r.stappen)
    assert.equal(s.niveau, beleidVoor(s.capability, 'member').niveau,
      s.capability + ': de compiler zegt iets anders dan het beleid');
});

test('3. DE AUTORITEIT KOMT LIVE: de projectie veranderen verandert het oordeel niet', () => {
  const kaartPad = path.join(__dirname, '..', 'EXECUTION_MAP.json');
  const origineel = fs.readFileSync(kaartPad, 'utf8');
  const voor = compileer({ doel: 'x', stappen: [stap('a', '/api/bank/overboek')] }, 'member');
  try {
    const kapot = JSON.parse(origineel);
    for (const c of kapot.capabilities) if (c.pad === '/api/bank/overboek' && typeof c.bereik === 'object') c.bereik.member = 'lezen';
    fs.writeFileSync(kaartPad, JSON.stringify(kapot, null, 1) + '\n');
    delete require.cache[require.resolve('../EXECUTION_MAP.json')];
    const na = compileer({ doel: 'x', stappen: [stap('a', '/api/bank/overboek')] }, 'member');
    assert.equal(na.stappen[0].niveau, voor.stappen[0].niveau,
      'het oordeel bewoog mee met EXECUTION_MAP.json -- dan leunt PLAN op een bouwartefact');
    assert.equal(na.stappen[0].niveau, 'voorstel');
  } finally { fs.writeFileSync(kaartPad, origineel); }
});

test('4. EEN VERBODEN STAP LAAT HET PLAN ZAKKEN en wordt niet overgeslagen', () => {
  const r = compileer({ doel: 'stiekem', stappen: [
    stap('a', '/api/pay/saldo'), stap('b', '/api/auth/login'), stap('c', '/api/agenda/mijn')] }, 'member');
  assert.equal(r.uitvoerbaar, false);
  assert.ok(r.bezwaren.some(b => b.id === 'b'), 'het bezwaar noemt de stap niet');
  assert.ok(r.stappen.every(s => s.id !== 'b' || s.bezwaar), 'de verboden stap draagt geen bezwaar');
  assert.match(r.grens, /niet overgeslagen|andere keten/i);
});

test('5. een kringloop wordt gevonden en genoemd', () => {
  const r = compileer({ doel: 'rond', stappen: [
    stap('a', '/api/pay/saldo', { afhankelijkVan: ['b'] }),
    stap('b', '/api/agenda/mijn', { afhankelijkVan: ['a'] })] }, 'member');
  assert.equal(r.uitvoerbaar, false);
  assert.ok(r.bezwaren.some(b => /kringloop/.test(b.reden)), 'de kringloop wordt niet genoemd');
});

test('6. een stap die naar een onbekende stap wijst, zakt', () => {
  const r = compileer({ doel: 'los', stappen: [stap('a', '/api/pay/saldo', { afhankelijkVan: ['zz'] })] }, 'member');
  assert.equal(r.uitvoerbaar, false);
  assert.ok(r.bezwaren.some(b => /niet in dit plan/.test(b.reden)));
});

test('7. het plan zegt VOORAF hoeveel bevestigingen het gaat vragen', () => {
  const r = compileer({ doel: 'twee mutaties', stappen: [
    stap('a', '/api/agenda/toevoegen'), stap('b', '/api/bank/overboek', { afhankelijkVan: ['a'] }),
    stap('c', '/api/pay/saldo')] }, 'member');
  assert.equal(r.uitvoerbaar, true);
  assert.equal(r.bevestigingen, 2, 'het aantal bevestigingen klopt niet');
  assert.match(r.samenvatting, /bevestiging/i);
});

test('8. golven: wat niet van elkaar afhangt komt in dezelfde golf', () => {
  const r = compileer({ doel: 'parallel', stappen: [
    stap('a', '/api/pay/saldo'), stap('b', '/api/agenda/mijn'),
    stap('c', '/api/site/mijn', { afhankelijkVan: ['a', 'b'] })] }, 'member');
  assert.deepEqual(r.golven, [['a', 'b'], ['c']]);
});

test('9. grenzen: leeg plan, te veel stappen, dubbele kenmerken', () => {
  assert.equal(compileer({ doel: 'niets', stappen: [] }, 'member').uitvoerbaar, false);
  const veel = Array.from({ length: MAX_STAPPEN + 1 }, (_, i) => stap('s' + i, '/api/pay/saldo'));
  const r = compileer({ doel: 'te veel', stappen: veel }, 'member');
  assert.equal(r.uitvoerbaar, false);
  assert.ok(r.bezwaren.some(b => /splits/.test(b.reden)));
  const dub = compileer({ doel: 'dubbel', stappen: [stap('a', '/api/pay/saldo'), stap('a', '/api/agenda/mijn')] }, 'member');
  assert.equal(dub.uitvoerbaar, false);
});

test('10. een onbekende rol krijgt niets uitvoerbaars', () => {
  const r = compileer({ doel: 'x', stappen: [stap('a', '/api/pay/saldo')] }, 'directeur');
  assert.equal(r.uitvoerbaar, false);
});

test('11. het gereedschap vertelt het model dat plan niets uitvoert', () => {
  const { TOOLS } = require('../server/kern/stuur/gereedschap');
  const p = TOOLS.find(t => t.name === 'plan');
  assert.ok(p, 'het gereedschap `plan` ontbreekt');
  assert.match(p.description, /voert NIETS uit/i);
  assert.ok(p.input_schema.properties.stappen, 'plan vraagt geen stappen');
});
