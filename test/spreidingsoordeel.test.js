/* HET OORDEEL VAN DE SPREIDINGSPROEF (scripts/spreidingsproef.js).

   Het script meet doorvoer, percentielen en de rekentijd per proces. Dat zijn
   getallen. Het PRODUCT is de zin die eronder staat: waar klemt het, en wat doe
   je eraan. Die zin kan stilletjes onwaar worden zonder dat er iets rood wordt,
   en dan meet het script keurig door terwijl het de verkeerde reparatie
   aanwijst -- dus staat hij hier apart, zonder dat er een trio voor hoeft te
   starten.

   DE STANDEN HIERONDER ZIJN ECHT GEMETEN op 24 augustus 2026 (docs/meerkernig.md),
   op een verzonnen geval na dat er met opzet bij staat: een machine met ruimte.
   Zo toetst dit niet of de drempels "iets" doen, maar of ze het geval herkennen
   waar ze voor gemaakt zijn.

   Draai los: node --test test/spreidingsoordeel.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { oordeel } = require('../scripts/spreidingsproef.js');

const rij = (naam, doorvoer, voordeur, servers, clientKern = 0.5, mislukt = null) => mislukt
  ? { naam, mislukt }
  : { naam, doorvoer, p50: 5, p99: 20, fouten: 0, clientKern,
      kernen: { voordeur, servers }, processen: { voordeuren: 1, servers: 3 } };

const zoals24aug = () => [
  rij('spreiding uit, 1 voordeur', 7282, 0.86, 1.40),
  rij('spreiding aan, 1 voordeur', 7380, 0.88, 1.42),
  rij('spreiding aan, 3 voordeuren', 9596, 1.26, 1.58)
];
const tekst = (r) => r.regels.join(' | ');

test('1. de twee winsten worden APART gemeld, en niet door elkaar', () => {
  /* Hier zat de fout. Het oordeel zocht de rij met "1 voordeur" erin en vond
     daarmee de EERSTE rij -- die ook spreiding uit heeft. "Meer voordeuren
     levert X% op" vergeleek dan twee dingen tegelijk en zei dus niets over
     voordeuren. Een meting die overtuigend het verkeerde zegt is erger dan geen
     meting. */
  const r = oordeel(zoals24aug(), { kernen: 4, clients: 3 });
  const t = tekst(r);
  assert.match(t, /SPREIDING ALLEEN levert \+1% op \(7282 -> 7380\/s\)/,
    'spreiding wordt vergeleken met de stand ZONDER spreiding, bij gelijk aantal voordeuren');
  assert.match(t, /MEER VOORDEUREN levert daar bovenop \+30% op \(7380 -> 9596\/s\)/,
    'voordeuren worden vergeleken met dezelfde stand, alleen met een voordeur');
  assert.match(t, /SAMEN \+32%/);
});

test('2. hij wijst de poortwachter aan als die vol zit en de servers niet', () => {
  const r = oordeel(zoals24aug(), { kernen: 4, clients: 3 });
  assert.match(tekst(r), /PLAFOND IS DE POORTWACHTER/);
  assert.match(tekst(r), /RTG_POORTWACHTERS/, 'en hij zegt wat je eraan doet');
  assert.equal(r.bruikbaar, true);
});

test('3. zit de poortwachter NIET vol, dan wijst hij hem ook niet aan', () => {
  /* Een verzonnen geval, en dat staat er met zoveel woorden bij: een machine met
     ruimte, waar de servers het werk doen. Dan hoort er geen advies te staan dat
     niets oplevert -- een controle die altijd hetzelfde roept, is geen controle. */
  const r = oordeel([
    rij('spreiding uit, 1 voordeur', 12000, 0.35, 2.60, 0.3),
    rij('spreiding aan, 1 voordeur', 17000, 0.48, 3.90, 0.3),
    rij('spreiding aan, 7 voordeuren', 17400, 0.52, 3.95, 0.3)
  ], { kernen: 16, clients: 2 });
  assert.doesNotMatch(tekst(r), /PLAFOND IS DE POORTWACHTER/);
  assert.doesNotMatch(tekst(r), /MACHINE ZIT VOL/);
  assert.match(tekst(r), /SPREIDING ALLEEN levert \+42%/, 'daar levert spreiding wél iets op');
});

test('4. een verzadigde belastingsgenerator maakt de hele meting ongeldig', () => {
  /* Dit is de gevaarlijkste uitkomst: alle getallen zien er normaal uit, maar ze
     zijn van de generator en niet van de server. Dan hoort het script te zeggen
     dat het niet deugt EN met een foutcode te eindigen. */
  const r = oordeel([
    rij('spreiding uit, 1 voordeur', 5000, 0.40, 0.80, 0.97),
    rij('spreiding aan, 1 voordeur', 5010, 0.41, 0.81, 0.98),
    rij('spreiding aan, 3 voordeuren', 5020, 0.42, 0.82, 0.99)
  ], { kernen: 8, clients: 2 });
  assert.match(tekst(r), /DE METING DEUGT NIET/);
  assert.match(tekst(r), /0\.9[789] kern/);
  assert.equal(r.bruikbaar, false, 'en dat geeft exitcode 1');
});

test('5. een volle machine wordt gemeld als ONDERGRENS, niet als "einde"', () => {
  /* Hier stond "meer processen kan hier niets meer opleveren", pal naast een
     regel die +30% van meer voordeuren meldde. Twee zinnen die elkaar
     tegenspreken maken een uitslag onbruikbaar. Wat er wél uit volgt is dat de
     gemeten winst een ondergrens is. */
  const r = oordeel(zoals24aug(), { kernen: 4, clients: 3 });
  const t = tekst(r);
  assert.match(t, /MACHINE ZIT VOL/);
  assert.match(t, /ONDERGRENS/);
  assert.doesNotMatch(t, /niets meer opleveren/, 'nooit naast een gemeten winst');
});

test('6. mislukte standen slepen het oordeel niet mee', () => {
  const r = oordeel([
    rij('spreiding uit, 1 voordeur', 7282, 0.86, 1.40),
    rij('spreiding aan, 1 voordeur', 0, 0, 0, 0, 'de opstelling kwam niet op'),
    rij('spreiding aan, 3 voordeuren', 9596, 1.26, 1.58)
  ], { kernen: 4, clients: 3 });
  const t = tekst(r);
  assert.doesNotMatch(t, /MEER VOORDEUREN levert/, 'zonder de tussenstand valt die vergelijking niet te maken');
  assert.doesNotMatch(t, /NaN|undefined|Infinity/, 'en er komt zeker geen NaN in de uitslag');

  const alles = oordeel([
    rij('a', 0, 0, 0, 0, 'kwam niet op'), rij('b', 0, 0, 0, 0, 'kwam niet op')
  ], { kernen: 4, clients: 2 });
  assert.match(tekst(alles), /Geen enkele opstelling kwam op/);
  assert.equal(alles.bruikbaar, false);
});

test('7. zonder rekentijd per proces wordt er geen plafond aangewezen', () => {
  /* Op een systeem zonder /proc en zonder bruikbare `ps` is de toewijzing niet
     te maken. Dan is "het plafond is de poortwachter" een gok, en een gok hoort
     hier niet als uitslag te staan. */
  const zonder = zoals24aug().map(r => Object.assign({}, r, { kernen: null }));
  const r = oordeel(zonder, { kernen: 4, clients: 3 });
  assert.doesNotMatch(tekst(r), /PLAFOND IS DE POORTWACHTER/);
  assert.doesNotMatch(tekst(r), /MACHINE ZIT VOL/);
  assert.match(tekst(r), /SPREIDING ALLEEN levert/, 'de doorvoervergelijking kan wel gewoon');
});

test('8. het bestand LADEN start niets -- geen proef, geen processen, geen mappen', () => {
  /* De mutatiemotor draaide `require.main !== module` om naar `===` en er werd
     NIETS rood: bij die stand begint een simpele require() de hele proef, die
     dan op de achtergrond trio's staat te starten terwijl de toets al geslaagd
     is. Een meetopstelling die zichzelf opstart omdat iemand de module inleest,
     is precies het soort schade dat niemand terugvindt. */
  const fs = require('fs');
  const os = require('os');
  const voor = fs.readdirSync(os.tmpdir()).filter(n => n.startsWith('rtg-spreiding-')).length;
  delete require.cache[require.resolve('../scripts/spreidingsproef.js')];
  const vers = require('../scripts/spreidingsproef.js');
  assert.equal(typeof vers.oordeel, 'function', 'de module levert wel gewoon zijn functies');
  const na = fs.readdirSync(os.tmpdir()).filter(n => n.startsWith('rtg-spreiding-')).length;
  assert.equal(na, voor, 'laden maakt geen datamap aan (' + voor + ' -> ' + na + ')');

  /* Het GEDRAG is hier de sterkere controle, en niet de vorm in de brontekst:
     hoofd() maakt zijn datamap met mkdtempSync als eerste, dus vóór de eerste
     await -- een module die zichzelf start, heeft die map al staan voordat deze
     regel draait. (Een controle op de brontekst sloeg trouwens aan op het
     COMMENTAAR hierboven, waarin de oude vorm geciteerd staat. Toetsen op tekst
     is toetsen op iets anders dan je bedoelt.) */
  assert.equal(fs.readdirSync(os.tmpdir()).filter(n => n.startsWith('rtg-spreiding-')).length, voor,
    'ook na het lezen van de exports staat er nog steeds geen datamap');
});
