/* MAGNAAT DAILY -- de stad van vandaag, en er valt niets te halen.

   Fase C, het laatste open stuk. "Daily" is in deze industrie de naam van
   precies het patroon dat CLAUDE.md uitsluit, dus de meeste beweringen
   hieronder gaan over wat hij NIET doet.

   Zeven beweringen, en ze zijn alle zeven stil terug te draaien:

   1. ER IS NIETS TE HALEN. Geen beloning, geen reeks, geen opgave, geen klok.
   2. ER IS NIETS TE MISSEN. Elke editie is terug te rekenen, ook die van
      gisteren en die van vorige maand.
   3. HIJ IS VOOR IEDEREEN HETZELFDE, en hangt aan geen enkele speler.
   4. ER STAAT GEEN PERSOON IN -- daarom valt hij buiten de 18+-poort.
   5. ER STAAN GEEN BEDRAGEN EN GEEN RANGLIJST IN.
   6. HIJ IS DETERMINISTISCH: stad plus datum, en verder niets.
   7. HIJ VERANDERT DOORDAT ER GESPEELD IS, niet doordat de dag verstrijkt.

   Draai los: node --experimental-sqlite --test test/spelstadskrant.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const maakKrant = require('../server/kern/spellen/stadskrant');
const F = require('../server/kern/spellen/magnaat/foundation');

const DAG = Date.parse('2026-08-12T09:00:00Z');
const DAG2 = Date.parse('2026-08-13T09:00:00Z');

/* Een stad met wat erin gebouwd is. Het geheugen is een stub omdat deze laag
   er alleen UIT leest -- wat er in dat geheugen hoort te staan, meet
   test/spelstad.test.js. */
const geheugen = (perZone, potjes = 12) => ({ beeld: () => ({ stad: 'ijmuiden', potjes, perZone }) });
const VOL = { boulevard: [{ id: 'park', sterkte: 80 }],
  centrum: [{ id: 'bibliotheek', sterkte: 40 }, { id: 'speeltuin', sterkte: 10 }] };
const daily = (perZone, potjes) => maakKrant({ stadsgeheugen: geheugen(perZone, potjes) });

/* ================= 1. er is niets te halen ================= */

test('er valt niets te claimen, en dat staat er ook', () => {
  const r = daily(VOL)('IJmuiden', DAG);
  const tekst = JSON.stringify(r).toLowerCase();
  for (const haakje of ['beloning', 'claim', 'reeks', 'streak', 'bonus', 'punten',
    'opdracht', 'opgave', 'verloopt', 'aftellen', 'vandaag nog', 'mis je', 'laatste kans'])
    assert.ok(!tekst.includes(haakje), 'de krant bevat een haakje: ' + haakje);
  assert.match(r.uitleg, /niets te halen/);
  /* En er is geen enkel veld dat een voortgang bijhoudt. */
  for (const veld of ['reeks', 'streak', 'punten', 'beloning', 'geclaimd', 'volgende'])
    assert.ok(!(veld in r), r + ' heeft een veld ' + veld);
});

test('de bron kent geen beloning en schrijft niets weg', () => {
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/stadskrant.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  for (const woord of ['save(', 'db.data', 'beloon', 'punten', 'reeks'])
    assert.ok(!bron.includes(woord), 'stadskrant.js doet aan ' + woord);
});

/* ================= 2. er is niets te missen ================= */

test('de editie van gisteren is morgen nog precies zo terug te vragen', () => {
  const k = daily(VOL);
  const eerst = k('IJmuiden', DAG);
  k('IJmuiden', DAG2);
  k('IJmuiden', Date.parse('2026-09-01T09:00:00Z'));
  assert.deepEqual(k('IJmuiden', DAG), eerst, 'een editie is te rekenen, niet te missen');
});

test('een maand niet lezen kost niets', () => {
  const k = daily(VOL);
  const trouw = k('IJmuiden', DAG2);
  const weg = daily(VOL)('IJmuiden', DAG2);
  assert.deepEqual(weg, trouw, 'wie een maand wegbleef krijgt dezelfde krant');
});

/* ================= 3. voor iedereen hetzelfde ================= */

test('hij hangt aan geen enkele speler', () => {
  /* De functie neemt een stad en een moment, en verder niets. Zou er een speler
     in gaan, dan is de krant te personaliseren -- en een krant die zich naar de
     lezer voegt is geen krant maar een haakje. */
  const k = daily(VOL);
  assert.equal(k.length, 2, 'daily(stad, nu) -- geen derde argument voor een lezer');
  /* De module kent geen enkel begrip waarmee je een lezer kunt aanwijzen. Het
     woord "spelers" staat er wel -- in een zin OVER de stad ("door spelers
     neergezet"), en dat is precies het tegenovergestelde van personaliseren. */
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/stadskrant.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/'[^']*'/g, "''");
  for (const woord of ['codenaam', 'handle', 'progressieMag', 'lezer'])
    assert.ok(!bron.includes(woord), 'stadskrant.js kent het begrip ' + woord);
});

/* ================= 4 en 5. geen persoon, geen bedrag ================= */

test('er staat geen naam, geen codenaam, geen bedrag en geen ranglijst in', () => {
  const r = daily(VOL)('IJmuiden', DAG);
  const tekst = JSON.stringify(r);
  assert.ok(!/\d{4,}/.test(tekst.replace(/"dag":"[^"]*"/, '')),
    'geen bedragen: ' + tekst);
  for (const woord of ['CN-', 'winnaar', 'ranglijst', 'eerste plaats', 'vermogen', 'omzet'])
    assert.ok(!tekst.includes(woord), 'de krant noemt ' + woord);
  /* Het aantal campagnes mag er wel in: dat is de klok van de STAD en geen
     prestatie van iemand. */
  assert.equal(r.campagnes, 12);
});

test('hij valt buiten de 18+-poort, en dat kan omdat er niemand in staat', () => {
  /* Woordelijk dezelfde reden als bij stadsgeheugen.js en bij de dagtelling in
     grens.js: daar staat geen persoon in. De toets is de bouw zelf -- deze
     module krijgt geen `progressieMag` en kan er dus ook niet omheen. */
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/stadskrant.js'), 'utf8');
  assert.ok(!bron.includes('progressieMag'), 'hij kent de poort niet');
  assert.match(bron, /geen persoon in/, 'en zegt zelf waarom dat mag');
});

/* ================= 6. deterministisch ================= */

test('stad plus datum bepalen de krant, en verder niets', () => {
  const a = daily(VOL)('IJmuiden', DAG);
  const b = daily(VOL)('ijmuiden', DAG + 3600 * 1000 * 5);
  assert.deepEqual(a.berichten, b.berichten, 'hetzelfde etmaal geeft dezelfde krant');
  assert.equal(maakKrant.draai('ijmuiden', '2026-08-12'), maakKrant.draai('ijmuiden', '2026-08-12'));
  assert.notEqual(maakKrant.draai('ijmuiden', '2026-08-12'), maakKrant.draai('ijmuiden', '2026-08-13'));
});

test('de dag draait de volgorde, hij verandert de inhoud niet', () => {
  const k = daily(VOL);
  const a = k('IJmuiden', DAG), b = k('IJmuiden', DAG2);
  const sorteer = (r) => r.berichten.map(x => x.id).sort();
  assert.deepEqual(sorteer(a), sorteer(b), 'dezelfde stukken, andere volgorde');
});

/* ================= 7. hij verandert door te spelen ================= */

test('wat er in staat komt uit wat spelers bouwden', () => {
  const leeg = daily({}, 0)('IJmuiden', DAG);
  assert.match(leeg.kop, /staat nog niets/);
  assert.deepEqual(leeg.berichten, []);
  /* En geen aansporing om te gaan spelen: dat is precies het haakje dat deze
     laag niet mag zijn. */
  assert.ok(!/speel|begin|start/i.test(leeg.kop), leeg.kop);
  const vol = daily(VOL)('IJmuiden', DAG);
  assert.ok(vol.berichten.length >= 3, 'een gebouwde stad heeft wat te melden');
});

test('een project vertelt in welke staat het verkeert, zonder percentage', () => {
  const r = daily({ boulevard: [{ id: 'park', sterkte: 80 }, { id: 'sporthal', sterkte: 50 }],
    haven: [{ id: 'halte', sterkte: 5 }] })('IJmuiden', DAG);
  const standen = r.berichten.map(x => x.staat).sort();
  assert.deepEqual(standen, ['ingeburgerd', 'nieuw', 'verweerd']);
  for (const b of r.berichten) {
    assert.ok(!/%/.test(b.zin), 'geen percentage op het scherm: ' + b.zin);
    assert.ok(b.zin.includes(b.zoneNaam), 'de buurt staat erin: ' + b.zin);
  }
});

test('wat er nog niet staat, staat er als mogelijkheid en niet als doel', () => {
  const r = daily(VOL)('IJmuiden', DAG);
  assert.ok(r.nogNiet.includes('Sporthal'));
  assert.ok(!r.nogNiet.includes('Stadspark'), 'wat er staat, staat er niet meer bij');
  for (const n of r.nogNiet) assert.ok(F.PROJECTEN.some(p => p.naam === n));
});

test('een stad die niet bestaat, krijgt geen krant', () => {
  const r = daily(VOL)('Atlantis', DAG);
  assert.equal(r.status, 404);
});
