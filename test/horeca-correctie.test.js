/* DE CORRECTIE OP EEN REKENINGREGEL (kern/horeca/correctie.js).

   Wat hier wordt vastgehouden is de reparatie van een DOOD SPOOR: wie een regel
   van de rekening haalde waar de keuken al aan begonnen was, werd verwezen naar
   "derving" -- en die bestaat alleen in de kassa, op losse items, zonder
   rekening. De melding stuurde je naar een deur die er niet was.

   De keten zelf draait in scripts/tafelproef.js (schakels 9-11 en drie
   storingen). Dit bestand toetst de rekenkern eromheen, want die is met een
   nagebootste rekening veel scherper te ondervragen dan via HTTP: wat gebeurt
   er met de totalen, wat blijft er staan, en wat wordt er NIET gedaan.

   Draai los: node --test test/horeca-correctie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

/* De echte rekenkern, met een lege database eronder: kern/horeca.js heeft
   alleen db/save nodig voor de opslag, en regelSom/totaal rekenen zonder. */
const horecaKern = require('../server/kern/horeca');
const db = { data: {} };
const horeca = horecaKern({ db, save: () => {}, crypto: require('crypto'),
  schoon: (v, n) => String(v == null ? '' : v).slice(0, n || 200) });
const maakCorrectie = require('../server/kern/horeca/correctie');
const C = maakCorrectie({ horeca, schoon: (v, n) => String(v == null ? '' : v).trim().slice(0, n || 200) });

const regel = (id, centen, aantal = 1, stand = 'besteld') =>
  ({ id, itemId: 'm1', naam: 'Gerecht ' + id, aantal, centen, gang: 0, stand });
const rekening = (regels, betalingen = []) =>
  ({ id: 'r1', status: 'open', regels, kortingen: [], betalingen, fooiCenten: 0 });

test('1. een correctie eist een grond uit de lijst en een reden', () => {
  const r = rekening([regel('a', 1600)]);
  assert.equal(C.corrigeer(r, { regelId: 'a', reden: 'koud' }).status, 400, 'zonder grond');
  assert.equal(C.corrigeer(r, { regelId: 'a', grond: 'verzonnen', reden: 'koud' }).status, 400, 'grond buiten de lijst');
  assert.equal(C.corrigeer(r, { regelId: 'a', grond: 'breuk' }).status, 400, 'zonder reden');
  assert.equal(C.corrigeer(r, { regelId: 'zz', grond: 'breuk', reden: 'x' }).status, 404, 'onbekende regel');
  assert.equal(r.regels[0].gecorrigeerd, undefined, 'geen van de mislukte pogingen heeft iets aangeraakt');
});

test('2. de regel BLIJFT staan en telt nul -- hij verdampt niet', () => {
  const r = rekening([regel('a', 1600), regel('b', 900)]);
  assert.equal(horeca.totaal(r).bruto, 2500);
  const uit = C.corrigeer(r, { regelId: 'a', grond: 'verkeerd-bereid', reden: 'koud geserveerd', door: 'Iemand' });
  assert.ok(uit.ok);
  assert.equal(r.regels.length, 2, 'de regel is weggehaald in plaats van gemarkeerd');
  assert.ok(r.regels[0].gecorrigeerd, 'de regel draagt de correctie niet');
  assert.equal(horeca.totaal(r).bruto, 900, 'de gecorrigeerde regel telt nog mee');
});

test('3. de somcontrole blijft kloppen bij splitsen -- daarom staat de nul in regelSom', () => {
  /* Zou de correctielaag zelf bedragen aftrekken, dan zou controleerSom() bij
     het splitsen van een tafel uiteenlopen met de totalen (LAT.md regel 4). */
  const r = rekening([regel('a', 1600), regel('b', 900)]);
  C.corrigeer(r, { regelId: 'a', grond: 'breuk', reden: 'gevallen' });
  const deelA = rekening([r.regels[0]]);
  const deelB = rekening([r.regels[1]]);
  assert.equal(horeca.controleerSom([r], [deelA, deelB]), true,
    'na een correctie sluit de som van de delen niet meer op het geheel');
});

test('4. het bedrag wordt BEVROREN op het moment van corrigeren', () => {
  const r = rekening([regel('a', 1600, 2)]);
  const uit = C.corrigeer(r, { regelId: 'a', grond: 'breuk', reden: 'gevallen' });
  assert.equal(uit.correctie.centen, 3200, '2 x 1600');
  r.regels[0].centen = 9999;                       // de kaart verandert later
  assert.equal(r.regels[0].gecorrigeerd.centen, 3200, 'de correctie rekent mee met een nieuwe prijs');
});

test('5. is er nog niet betaald, dan is er geen teruggave -- alleen minder te betalen', () => {
  const r = rekening([regel('a', 1600), regel('b', 900)]);
  const uit = C.corrigeer(r, { regelId: 'a', grond: 'niet-gebracht', reden: 'nooit gekomen' });
  assert.equal(uit.correctie.teruggave, null);
  assert.equal(horeca.totaal(r).teBetalen, 900);
});

test('6. is er AL betaald, dan ontstaat een teruggaveRECHT dat niet is uitgevoerd', () => {
  const r = rekening([regel('a', 1600), regel('b', 900)], [{ wijze: 'pin', centen: 2500 }]);
  const uit = C.corrigeer(r, { regelId: 'a', grond: 'niet-gebracht', reden: 'nooit gekomen' });
  assert.equal(uit.correctie.teruggave.centen, 1600);
  assert.equal(uit.correctie.teruggave.uitgevoerd, false,
    'een klaargezet bedrag mag er nooit uitzien als een uitbetaald bedrag');
  assert.match(uit.correctie.teruggave.let, /mens|medewerker/i, 'de teruggave zegt niet dat een mens hem uitvoert');
  /* De invariant uit de kop: wat er te veel binnen is, is precies de teruggave. */
  assert.equal(horeca.openstaand(r), -uit.correctie.teruggave.centen);
});

test('7. deels betaald: de teruggave is nooit meer dan het teveel', () => {
  /* 2500 op de bon, 1000 aanbetaald, en er gaat voor 1600 mis. Er is dan niets
     te veel betaald boven wat er nog staat: 900 blijft openstaan. */
  const r = rekening([regel('a', 1600), regel('b', 900)], [{ wijze: 'pin', centen: 1000 }]);
  const uit = C.corrigeer(r, { regelId: 'a', grond: 'breuk', reden: 'gevallen' });
  assert.equal(uit.correctie.teruggave.centen, 100, '1000 betaald, 900 te betalen -> 100 te veel');
  assert.equal(horeca.openstaand(r), -100);
});

test('8. dezelfde regel twee keer corrigeren kan niet', () => {
  const r = rekening([regel('a', 1600)]);
  assert.ok(C.corrigeer(r, { regelId: 'a', grond: 'breuk', reden: 'een' }).ok);
  const twee = C.corrigeer(r, { regelId: 'a', grond: 'breuk', reden: 'twee' });
  assert.equal(twee.status, 409);
  assert.equal(horeca.totaal(r).bruto, 0, 'de rekening is twee keer gezakt voor hetzelfde gerecht');
  assert.equal(r.correcties.length, 1);
});

test('9. wat de gast leest, draagt geen medewerkersnaam', () => {
  const r = rekening([regel('a', 1600)]);
  C.corrigeer(r, { regelId: 'a', grond: 'verkeerd-bereid', reden: 'koud', door: 'Sanne' });
  const voor = C.voorGast(r);
  assert.equal(voor.length, 1);
  assert.ok(voor[0].grondLabel && voor[0].reden, 'de gast hoort te lezen wat er misging');
  assert.equal(voor[0].door, undefined, 'de naam van de medewerker gaat mee naar de gast (HORECA.md: geen ranglijst)');
  assert.doesNotMatch(JSON.stringify(voor), /Sanne/);
});

test('10. de gronden zijn een gesloten lijst, en elke grond zegt wie hem meldt', () => {
  assert.ok(C.GRONDEN.length >= 4);
  for (const g of C.GRONDEN) {
    assert.ok(['gast', 'zaak'].includes(g.wie), g.id + ': onbekende kant');
    assert.ok(g.label && g.wat && g.wat.length > 20, g.id + ': geen uitleg');
  }
  const ids = C.GRONDEN.map(g => g.id);
  assert.equal(new Set(ids).size, ids.length, 'dubbele grond-id');
});

test('11. wat deze laag NIET doet, staat in de code en niet alleen in een document', () => {
  assert.ok(C.NIET_GEBOUWD['automatisch-terugboeken'], 'de belangrijkste grens ontbreekt');
  assert.match(C.NIET_GEBOUWD['automatisch-terugboeken'], /GELD\.md/);
  for (const [k, v] of Object.entries(C.NIET_GEBOUWD))
    assert.ok(v.length > 40, k + ': de reden is te kort om een grens te zijn');
});

test('12. de correctielaag verplaatst zelf geen geld', () => {
  const bron = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'server', 'kern', 'horeca', 'correctie.js'), 'utf8');
  assert.doesNotMatch(bron, /require\(.*kern\/pay/,
    'deze laag raakt de betaalpoort aan; een uitkomst hoort te worden KLAARGEZET (GELD.md par. 3)');
  assert.doesNotMatch(bron, /betalingen\.push|betalingen\s*=\s*\[/,
    'deze laag schrijft in de betalingen van een rekening');
});
