/* De LIFE-schil presenteert de bestaande passen als drie lagen. Deze toets
   bewaakt zowel de gevraagde schermvolgorde als de echte servertrap, zodat een
   mooi tabblad nooit meer belooft dan de routes erachter toestaan. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const lagen = require('../public/apps/life-lagen');
const rechten = require('../server/kern/wereld/rechten');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'rtg.html'), 'utf8');

test('LIFE toont de drie lagen in de afgesproken volgorde', () => {
  assert.deepEqual(lagen.VOLGORDE, ['rtg', 'business', 'lifestyle']);
  const knoppen = [...html.matchAll(/<button[^>]+data-life-laag="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(knoppen, lagen.VOLGORDE);
  for (const laag of lagen.VOLGORDE)
    assert.match(html, new RegExp('data-life-laagpaneel="' + laag + '"'), laag + ' mist een eigen LIFE-paneel');
});

test('de LIFE-laagtoegang volgt de bestaande cumulatieve pasrechten', () => {
  assert.deepEqual(lagen.TOEGANG.rtg, ['rtg']);
  assert.deepEqual(lagen.TOEGANG.lifestyle, ['rtg', 'lifestyle']);
  assert.deepEqual(lagen.TOEGANG.business, ['rtg', 'business', 'lifestyle']);

  assert.equal(lagen.magOpenen('rtg', 'business'), false);
  assert.equal(lagen.magOpenen('rtg', 'lifestyle'), false);
  assert.equal(lagen.magOpenen('lifestyle', 'business'), false);
  assert.equal(lagen.magOpenen('business', 'lifestyle'), true,
    'Business erft de Lifestyle-suite, zoals de serverroutes doen');

  assert.equal(rechten.magVan('rtg', 'zakelijk.feed'), false);
  assert.equal(rechten.magVan('lifestyle', 'zakelijk.feed'), true);
  assert.equal(rechten.magVan('business', 'zakelijk.feed'), true);
});

test('alle bestaande premiumdiensten in LIFE dragen de Lifestyle-poort', () => {
  const premium = [
    'reisboek', 'hangar', 'mecenaat', 'nalatenschap', 'logboek', 'cercle',
    'entourage', 'rendezvous', 'attenties', 'maison', 'table', 'cellier',
    'garderobe', 'lifestyle'
  ];
  for (const app of premium) {
    const kaart = new RegExp('<a[^>]+href="/apps/' + app + '\\.html"[^>]+data-life-eist="lifestyle"');
    assert.match(html, kaart, app + ' staat zonder Lifestyle-poort in LIFE');
  }
  assert.equal((html.match(/data-life-eist="lifestyle"/g) || []).length, premium.length,
    'de LIFE-schil en de bestaande premiumlijst lopen uiteen');
});

test('een ongeldige of ontbrekende pas valt veilig terug op RTG', () => {
  assert.equal(lagen.normaliseer(), 'rtg');
  assert.equal(lagen.normaliseer('guest'), 'rtg');
  assert.equal(lagen.heeftVereiste('rtg', 'lifestyle'), false);
  assert.equal(lagen.heeftVereiste('business', 'lifestyle'), true);
});
