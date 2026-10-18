/* TOESTEMMING VOOR COMMERCIËLE POST, DE RANDEN, EN DE BEWAARTERMIJN OP DE
   GEGEVENSKAART (server/kern/identiteit/commercieel.js, gegevenstermijn.js).

   commercieel.mag() is de poort waar elke verzender langs moet: alleen een
   VASTGELEGDE toestemming voor DIT kanaal is ja. test/commercieel.test.js
   toetst de hoofdlijn; hier staan de randen die een verzender zou kunnen
   misbruiken (een onbekend kanaal, een lege soort, een lid zonder rij) en de
   geschiedenis die bij een klacht het bewijs is.

   Wat hier niet mag sneuvelen:
   1. een onbekend kanaal wordt weggefilterd, en een lijst die geen lijst is,
      is intrekken -- nooit "dan maar alles";
   2. mag() is nee voor een lid zonder rij, een soort zonder stand, een leeg
      of onbekend kanaal;
   3. de geschiedenis zegt gegeven, gewijzigd of ingetrokken, met herkomst (of
      'onbekend'), en groeit niet voorbij 200 regels;
   4. alles uit zet elke soort uit, ook bij een lid zonder rij (0 uitgezet);
   5. een bewaartermijn die niet te vinden is, is "niet vast te stellen" en
      nooit "geen termijn"; korte termijnen in dagen, lange in jaren.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in zet `kanalen.filter(k => KANAAL_IDS.includes(k))` vervangen door
     `kanalen` -> "1." ZAKT (RAAK: 'fax' kwam in de stand);
   - `if (r.geschiedenis.length > MAX_GESCHIEDENIS)` vervangen door `if (false)`
     -> "3." ZAKT (RAAK);
   - in termijnVan `if (!r) return { bekend: false ... }` weggehaald -> "5."
     ZAKT (RAAK: TypeError op r.dagen).

   Draai: node --test test/commercieel-weerbaar.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { maakCommercieel } = require('../server/kern/identiteit/commercieel');
const { termijnVan } = require('../server/kern/identiteit/gegevenstermijn');

const opzet = () => { let opgeslagen = 0; const c = maakCommercieel({ db: { data: {} }, save() { opgeslagen++; } }); c.opgeslagen = () => opgeslagen; return c; };

test('1. onbekende kanalen eruit; geen lijst is intrekken', () => {
  const c = opzet();
  assert.equal(c.zet('user-1', undefined, ['email']).status, 400);
  assert.equal(c.zet('user-1', 'spam', ['email']).status, 400);
  c.zet('user-1', 'aanbiedingen', ['email', 'fax', 'sms']);
  assert.equal(c.mag('user-1', 'aanbiedingen', 'fax'), false);
  assert.equal(c.mag('user-1', 'aanbiedingen', 'sms'), true);
  c.zet('user-1', 'aanbiedingen', 'email');
  assert.equal(c.mag('user-1', 'aanbiedingen', 'email'), false, 'een tekst is geen lijst: ingetrokken');
  assert.equal(c.geschiedenisVan('user-1').geschiedenis[0].handeling, 'ingetrokken');
});

test('2. mag() is nee bij elke twijfel', () => {
  const c = opzet();
  c.zet('user-2', 'onderzoek', ['push'], 'scherm');
  assert.equal(c.mag('user-2', 'onderzoek', 'push'), true);
  for (const [k, s, kanaal] of [['user-9', 'onderzoek', 'push'], ['user-2', 'partners', 'push'], ['user-2', 'onderzoek', undefined],
    ['user-2', undefined, 'push'], ['user-2', 'onderzoek', '']])
    assert.equal(c.mag(k, s, kanaal), false, JSON.stringify([k, s, kanaal]));
});

test('3. de geschiedenis: gegeven, gewijzigd, ingetrokken, met herkomst, begrensd', () => {
  const c = opzet();
  c.zet('user-3', 'partners', ['email']);
  c.zet('user-3', 'partners', ['email', 'sms'], 'x'.repeat(80));
  c.zet('user-3', 'partners', ['email', 'sms'], 'nogmaals');
  c.zet('user-3', 'partners', [], 'scherm');
  const g = c.geschiedenisVan('user-3').geschiedenis;
  assert.deepEqual(g.map(r => r.handeling), ['ingetrokken', 'gewijzigd', 'gegeven'], 'niets veranderd is geen regel');
  assert.deepEqual([g[2].bron, g[1].bron.length, g[0].bron], ['onbekend', 60, 'scherm']);
  assert.deepEqual([g[1].van, g[1].naar], [['email'], ['email', 'sms']]);
  for (let i = 0; i < 210; i++) c.zet('user-3', 'partners', i % 2 ? [] : ['push'], 'lus');
  assert.equal(c.geschiedenisVan('user-3').geschiedenis.length, 200);
  assert.deepEqual(c.geschiedenisVan('nooit-gezien').geschiedenis, []);
});

test('4. alles uit, ook bij een lid zonder rij', () => {
  const c = opzet();
  assert.equal(c.allesUit('leeg').uitgezet, 0);
  c.zet('user-4', 'aanbiedingen', ['email']); c.zet('user-4', 'productnieuws', ['push']);
  const uit = c.allesUit('user-4');
  assert.equal(uit.uitgezet, 2);
  assert.equal(c.mag('user-4', 'aanbiedingen', 'email') || c.mag('user-4', 'productnieuws', 'push'), false);
  assert.ok(c.geschiedenisVan('user-4').geschiedenis.slice(0, 2).every(r => r.bron === 'afmeldknop'));
  assert.ok(c.opgeslagen() >= 4);
});

test('5. een bewaartermijn die niet te vinden is, is niet vast te stellen', () => {
  assert.equal(termijnVan(undefined), null);
  assert.equal(termijnVan('bestaat-niet').bekend, false);
  assert.match(termijnVan('bestaat-niet').waarom, /niet vast te stellen/);
  assert.equal(termijnVan('notifications').inWoorden, '180 dagen');
  assert.equal(termijnVan('invoices').inWoorden, '7 jaar');
  assert.equal(termijnVan('securityLog').inWoorden, '1 jaar');
});
