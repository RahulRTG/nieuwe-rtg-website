/* DE TERUGWEG PER ROUTE (scripts/herstel.js, EXECUTIE.md blok 5).

   Wat hier bewaakt wordt is niet de KWALITEIT van de afleiding -- die is
   aantoonbaar zwak, en dat is de uitkomst van de meting zelf -- maar dat die
   zwakte zichtbaar blijft. Een lijst met 74 "tegenhangers" ziet er van een
   afstand uit als kennis, en zodra iemand hem als kennis gebruikt staat er een
   terugweg-knop onder een handeling die niet terug kan.

   DRIE EISEN, en ze komen alle drie uit server/kern/stuur/bon.js: een terugweg
   beloven die niet bestaat is erger dan geen terugweg tonen.

     1 niets is `exact` of `bewezen` -- de hoogste graad is `vermoed`;
     2 wat op meer dan een naam past is `onbepaald` MET beide kandidaten, nooit
       de eerste die toevallig matcht;
     3 elk woord in een paar bestaat ook echt als laatste segment van een route,
       anders wijst het paar nergens heen (de les van de cap `rooms`). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { bouw, PAREN, laatste } = require('../scripts/herstel');

const R = bouw();
const ROUTES = [...new Set((require('../IDEMPROEF.json').perRoute || [])
  .filter(r => r && r.methode === 'POST' && typeof r.pad === 'string').map(r => r.pad))];

test('0. de meting deugt: er zijn routes en er is iets gevonden', () => {
  assert.ok(!R.fout, R.fout);
  assert.ok(R.gemeten.routes > 1000, 'te weinig routes: ' + R.gemeten.routes);
  assert.ok(R.gemeten.vermoed > 0, 'geen enkele kandidaat gevonden -- dan is de afleiding stuk, niet streng');
});

test('1. een NAAM bewijst niets: bevestigen kan alleen de uitgevoerde proef', () => {
  /* Deze toets stond er eerst als `bevestigd` moet leeg zijn, en dat was de
     goede regel voor de stand van toen: een register dat namen vergelijkt mag
     nooit zeggen dat een terugweg werkt. De regel is niet vervallen maar
     scherper geworden -- er mag nu een graad `bevestigd` in, en dan UITSLUITEND
     met een uitgevoerde proef eronder. Zonder die eis was de nieuwe tak precies
     het gat dat de oude toets dichthield. */
  const proef = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'HERSTELPROEF.json'), 'utf8')); }
    catch (e) { return null; }
  })();
  const uitProef = new Map((proef && proef.per || []).map(u => [u.heen, u]));

  for (const [pad, v] of Object.entries(R.per)) {
    assert.ok(['vermoed', 'onbepaald', 'bevestigd'].includes(v.graad), pad + ' draagt graad "' + v.graad + '"');
    if (v.graad !== 'bevestigd') continue;
    const u = uitProef.get(pad);
    assert.ok(u, pad + ' heet bevestigd zonder dat de herstelproef hem ooit heeft uitgevoerd');
    assert.equal(u.terug, v.tegenhanger, pad + ': bevestigd op een andere tegenhanger dan er beproefd is');
    assert.ok(['exact', 'compensatie'].includes(u.uitslag),
      pad + ': de proef gaf "' + u.uitslag + '", en dat is geen bevestiging');
    assert.equal(v.soort, u.uitslag, pad + ': de soort moet mee, anders leest exact en compensatie hetzelfde');
  }

  for (const b of R.bevestigd) {
    const u = uitProef.get(b.heen);
    assert.ok(u && u.terug === b.terug && u.uitslag === b.soort,
      b.heen + ' staat in de bevestigde lijst zonder overeenkomstige uitslag in de proef');
  }
  if (!proef) assert.deepEqual(R.bevestigd, [],
    'er is geen HERSTELPROEF.json, en toch staat er iets bevestigd -- dat kan alleen met de hand zijn gezet');
});

test('2. dubbelzinnig blijft dubbelzinnig, met beide kandidaten erbij', () => {
  const dub = Object.entries(R.per).filter(([, v]) => v.graad === 'onbepaald');
  assert.ok(dub.length > 0, 'geen enkele dubbelzinnigheid gevonden -- verdacht, want /site/offline past op twee namen');
  for (const [pad, v] of dub) {
    assert.ok(Array.isArray(v.kandidaten) && v.kandidaten.length > 1, pad + ': onbepaald zonder kandidaten');
    assert.ok(v.reden && v.reden.length > 20, pad + ': onbepaald zonder reden');
  }
});

test('3. elk woord in een paar bestaat echt als laatste segment van een route', () => {
  const segmenten = new Set(ROUTES.map(laatste));
  const dood = [];
  for (const [a, b] of PAREN) {
    if (!segmenten.has(a)) dood.push(a);
    if (!segmenten.has(b)) dood.push(b);
  }
  assert.deepEqual(dood, [], 'woord(en) in een paar die nergens als route-einde voorkomen: ' + dood.join(' '));
});

test('4. elke vermoede tegenhanger is een route die bestaat', () => {
  const bestaat = new Set(ROUTES);
  for (const [pad, v] of Object.entries(R.per)) {
    for (const k of [v.tegenhanger, ...(v.kandidaten || [])].filter(Boolean))
      assert.ok(bestaat.has(k), pad + ' wijst naar ' + k + ', en die route bestaat niet');
    assert.notEqual(v.tegenhanger, pad, pad + ' is zijn eigen tegenhanger');
  }
});

test('5. de grens van de methode staat in de uitslag en niet in een commentaarregel', () => {
  assert.ok(R.grens && R.grens.length > 80, 'de meting draagt geen uitgeschreven grens');
  assert.match(R.grens, /bovengrens|namen/i);
  assert.ok(R.gemeten.dekkingPct < 50,
    'de dekking is opeens hoog -- controleer of de afleiding niet is gaan raden');
});

/* DE RATEL OP HERSTEL.json. Bevestigde paren mogen alleen MEER worden en
   vermoede alleen minder -- dat is de aflosrichting van deze post in
   BEWIJSSCHULD.json (`herstel-onbevestigd`, doel 0). Zakt dit, dan is er een
   terugweg stukgegaan of is de proef minder gaan meten, en die twee wil je
   allebei zien. */
test('7. bevestigd groeit, vermoed krimpt', () => {
  const grond = { bevestigd: 11, vermoed: 63 };
  const vermoed = Object.values(R.per).filter(v => v.graad === 'vermoed').length;
  assert.ok(R.bevestigd.length >= grond.bevestigd,
    'bevestigde tegenhangers: ' + R.bevestigd.length + ' < ' + grond.bevestigd +
    ' -- een terugweg die bewezen was is dat niet meer, of de proef meet minder');
  assert.ok(vermoed <= grond.vermoed,
    'vermoede tegenhangers: ' + vermoed + ' > ' + grond.vermoed +
    ' -- deze post moet naar nul, dus hij mag niet groeien zonder dat iemand het ziet');
});
