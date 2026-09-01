/* ============================================================================
   MEET EN PLAN HETZELFDE KOSTENMODEL?

   Deze toets bestaat om een fout die twee keer is gemaakt, op twee niveaus.

   EEN NIVEAU HOGER: TOETSDUUR.json was lokaal zonder dekking gemeten en de
   keten draaide op runners MET dekking. De verdeler deed het goed op zijn eigen
   projectie (1,00x) en de scherven liepen 1348s tegen 526s uit elkaar.

   EEN NIVEAU LAGER, en dat is waar dit bestand over gaat: de modus stond alleen
   in de omgeving van het KINDPROCES. De loper mat dus keurig `dekking` en
   verdeelde intussen op `normaal`. Zelfde fout, zelfde onzichtbaarheid -- en
   niet te zien aan de uitkomst, want een verdeling op het verkeerde model ziet
   er van binnen perfect uit.

   De volgorde is hier dus de bewering: `zetModus()` staat VOOR `verdeel()`.
   =========================================================================== */
'use strict';
require('./toetsnaam');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const meetbron = require('../scripts/lib/meetbron');
const lees = (n) => fs.readFileSync(path.join(__dirname, '..', 'scripts', n), 'utf8');

/* ZONDER COMMENTAAR, want de bewering gaat over de volgorde van de CODE. De
   eerste versie hiervan zocht in de ruwe tekst en zakte op mijn eigen uitleg
   erboven -- daarin staat `verdeel()` genoemd. Een toets die op een toelichting
   afgaat, meet het verkeerde en gaat morgen weer stuk op een zin. */
const zonderUitleg = (tekst) => tekst
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

test('zetModus zet de modus in DIT proces, niet alleen in de omgeving van een kind', () => {
  const oud = process.env.RTG_TOETSMODUS;
  try {
    assert.equal(meetbron.zetModus(true), 'dekking');
    assert.equal(process.env.RTG_TOETSMODUS, 'dekking',
      'de planner leest process.env -- staat hij daar niet, dan plant hij op een ander model dan hij meet');
    assert.equal(meetbron.zetModus(false), 'normaal');
    assert.equal(process.env.RTG_TOETSMODUS, 'normaal');
  } finally {
    if (oud === undefined) delete process.env.RTG_TOETSMODUS;
    else process.env.RTG_TOETSMODUS = oud;
  }
});

test('de bron noemt waar, welke node, hoeveel kernen en welke commit', () => {
  const delen = meetbron.bron().split('|');
  assert.equal(delen.length, 4, 'vier velden, anders leest ontleedBron() iets anders dan er staat');
  assert.match(delen[0], /^(ci|lokaal)$/);
  assert.match(delen[1], /^v\d+\./, 'de nodeversie hoort er als versie in te staan');
  assert.ok(Number(delen[2]) > 0, 'het aantal kernen hoort een getal te zijn');
});

/* De ontleding aan de leeskant moet precies deze vorm aankunnen. Zouden die
   twee uit elkaar lopen, dan staat er een bronnentabel vol `onbekend` zonder
   dat iemand het merkt. */
test('de bron die geschreven wordt, is de bron die gelezen wordt', () => {
  const { ontleedBron } = require('../scripts/toetsduur');
  const b = ontleedBron(meetbron.bron());
  assert.match(b.waar, /^(ci|lokaal)$/);
  assert.ok(b.node && b.kernen && b.commit, 'alle vier de velden horen terug te komen: ' + JSON.stringify(b));
});

for (const loper of ['test-runner.js', 'e2e.js']) {
  test(loper + ' kiest zijn modus VOOR hij de scherven verdeelt', () => {
    const bron = zonderUitleg(lees(loper));
    const zet = bron.indexOf('zetModus(');
    const verdeel = bron.search(/\bverdeel\(/);
    assert.ok(zet > 0, loper + ' hoort een modus te kiezen');
    assert.ok(verdeel > 0, loper + ' hoort te verdelen');
    assert.ok(zet < verdeel,
      'de modus hoort VOOR de verdeling te staan, anders plant hij op een ander ' +
      'kostenmodel dan hij meet -- en dat is precies de fout die niets rood maakt');
  });
}

test('e2e draait zonder dekking, en zegt dat ook', () => {
  const bron = zonderUitleg(lees('e2e.js'));
  assert.doesNotMatch(bron, /experimental-test-coverage/,
    'draait deze loper wel met dekking, dan is zetModus(false) een leugen');
  assert.match(bron, /zetModus\(false\)/);
});

test('geen enkele loper rekent de herkomst zelf uit', () => {
  /* Twee kopieen van deze regel is LAT.md regel 4, en dan is het over een half
     jaar drie -- met een register dat zichzelf tegenspreekt. */
  for (const loper of ['test-runner.js', 'e2e.js']) {
    assert.doesNotMatch(zonderUitleg(lees(loper)), /rev-parse/,
      loper + ' hoort de bron uit scripts/lib/meetbron.js te halen');
  }
});
