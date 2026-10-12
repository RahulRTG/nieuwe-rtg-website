/* DE GEMEENSCHAPSPROEF -- de samenwerkingsketen van FoundationOS.

   scripts/gemeenschapsproef.js loopt de keten uit GEMEENSCHAP-FASE0.md par. 7:
   drager (B1) -> verbond (B2) -> beraad (B3) -> besluit -> bijeenkomst ->
   terugkoppeling, met per schakel een actor die handelt en een andere die het
   langs zijn eigen route ziet, en per storing het EFFECT.

   TWEE HELFTEN, EN DE TWEEDE IS DE REDEN DAT DIT BESTAND BESTAAT. De andere
   ketenproeven worden in CI alleen statisch bewaakt (hun register). Deze toets
   doet dat ook (toets 0-5), maar draait de keten daarnaast ECHT, tegen een
   wegwerpserver, in een gewone CI-run (toets 6): de drie bouwstenen zijn net
   samengevoegd, en een keten die alleen in een ingecheckt register sluit, sluit
   alleen op de dag dat iemand hem draaide.

   Draai los: node --test test/gemeenschapsproef.test.js
   De keten zelf: npm run gemeenschapsproef && npm run ketenvorm */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'gemeenschapsproef.js'), 'utf8');
const lees = (n) => JSON.parse(fs.readFileSync(path.join(WORTEL, n), 'utf8'));

test('0. de proef zakt op een open schakel, en kent sluit en sluitMetBevinding apart', () => {
  assert.match(bron, /uit\.sluit = .*t\.open === 0 && t\.stuk === 0 && t\.gebroken === 0 && t\.openBekend === 0/);
  assert.match(bron, /uit\.sluitMetBevinding = t\.open === 0 && t\.stuk === 0 && t\.gebroken === 0/);
  assert.match(bron, /process\.exit\(u\.sluitMetBevinding \? 0 : 1\)/,
    'zonder foutcode op een echte open schakel is dit een meting en geen proef');
  // een 5xx is altijd stuk, ook met een reden erbij
  assert.match(bron, /r\.status >= 400 && r\.status < 500\) && s\.bekend/);
});

test('1. wegwerpserver, en geen gedeelde ketenmodule', () => {
  assert.match(bron, /require\('\.\/lib\/wegwerpserver'\)/);
  assert.doesNotMatch(bron, /localhost:3000|127\.0\.0\.1:3000/);
  assert.doesNotMatch(bron, /require\(.*(lib\/keten|lib\/ketenvorm|lib\/proefvorm)/,
    'de gemeenschapsproef hangt aan een gedeelde ketenmodule; dan meet ketenvorm.js zijn eigen aanname');
});

test('2. het register: geen open of stuk, elke storing gehouden, en de bevindingen dragen een reden', () => {
  const u = lees('GEMEENSCHAPSPROEF.json');
  assert.ok(u.telling.schakels >= 11, 'minder dan elf schakels is niet de keten uit par. 7');
  assert.equal(u.telling.open, 0);
  assert.equal(u.telling.stuk, 0);
  assert.equal(u.telling.gebroken, 0, 'een gebroken belofte hoort de proef te laten zakken');
  assert.ok(u.telling.storingen >= 12);
  assert.equal(u.sluitMetBevinding, true);
  assert.equal(u.bevindingen.length, u.telling.openBekend);
  for (const b of u.bevindingen) assert.ok(b.reden && b.reden.length > 120 && /besluit/i.test(b.reden),
    'schakel ' + b.schakel + ': een open schakel met een etiket in plaats van een reden');
});

test('3. de drie bouwstenen staan er alle drie in, en de menselijke naad is benoemd', () => {
  const u = lees('GEMEENSCHAPSPROEF.json');
  const tekst = u.schakels.map(s => s.wat).join(' | ');
  for (const w of [/drager/, /verbond/, /beraad/, /bijeenkomst/, /terugkoppeling/])
    assert.match(tekst, w, 'de keten mist ' + w);
  const drager = u.schakels.filter(s => /drager/.test(s.wat));
  assert.ok(drager.length >= 2 && drager.every(s => s.stand === 'gesloten'),
    'de drager staat er niet als gesloten schakel in -- B1 is samengevoegd, dan hoort hij gelopen te zijn');
  assert.ok(u.naden.some(n => /menselijk/.test(n.naad)),
    'de stap van besluit naar bijeenkomst is een mens; dat hoort er te staan, anders leest hij als bedrading');
});

test('4. Rahul is een actor, en de storing waarin hij wil stemmen staat erin', () => {
  const u = lees('GEMEENSCHAPSPROEF.json');
  assert.ok(u.schakels.some(s => s.van === 'rahul'), 'de AI als actor ontbreekt');
  const s = u.storingen.find(x => /Rahul/.test(x.naam));
  assert.ok(s && s.stand === 'gehouden');
});

test('5. de ketenvorm telt deze keten mee', () => {
  const { KETENS } = require('../scripts/ketenvorm');
  assert.ok(KETENS.some(k => k.register === 'GEMEENSCHAPSPROEF.json'));
  const v = lees('KETENVORM.json');
  assert.ok(v.ketens.some(k => k.naam === 'gemeenschap'), 'KETENVORM.json is niet opnieuw gemeten met deze keten');
});

/* DE KETEN ZELF, ECHT GELOPEN. Mutaties die deze toets hebben laten zakken
   (elk een keer gedraaid, daarna teruggezet):
   (a) kern/genootschap/bijeenkomst.js afgelast(): de regel `if (b.afgelast) return ...`
       weggehaald -> storing "twee keer afgelasten" gebroken;
   (b) kern/beraad/terugkoppeling.js wek(): notify op 'rtg' in plaats van de sleutel
       -> schakel 14 open. */
test('6. de keten sluit tegen een echte server: geen open schakel en elke storing gehouden', { timeout: 600000 }, async () => {
  const { meet } = require('../scripts/gemeenschapsproef');
  const u = await meet();
  const slecht = u.schakels.filter(s => s.stand === 'open' || s.stand === 'stuk')
    .map(s => s.nr + ' ' + s.stand + ': ' + s.wat + ' -- ' + (s.ziet || s.antwoord || s.fout));
  assert.deepEqual(slecht, [], 'open of stuk:\n' + slecht.join('\n'));
  const gebroken = u.storingen.filter(s => s.stand !== 'gehouden').map(s => s.naam + ' -- ' + s.wat);
  assert.deepEqual(gebroken, [], 'gebroken:\n' + gebroken.join('\n'));
  assert.equal(u.sluitMetBevinding, true);
  assert.ok(u.telling.schakels >= 11);
});
