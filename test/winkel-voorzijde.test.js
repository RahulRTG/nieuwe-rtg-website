'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const lees = bestand => fs.readFileSync(path.join(root, bestand), 'utf8');

test('LivingOS Winkel vormt drie herkenbare ingangen op de bestaande Mall', () => {
  const mall = lees('public/apps/mall.html');
  const mijn = lees('public/apps/mijnmall.html');
  const schil = lees('public/apps/winkel-voorzijde.js');
  for (const html of [mall, mijn]) {
    assert.match(html, /rtg-shop-flow/);
    assert.match(html, /\/shared\/rtg-winkel-2026\.css/);
    assert.match(html, /\/apps\/winkel-voorzijde\.js/);
  }
  for (const ingang of ['ontdekken', 'bewaard', 'bestellingen', 'meer']) {
    assert.match(schil, new RegExp('data-shop=\\"' + ingang + '\\"'));
  }
});

test('de nieuwe voordeur gebruikt echte Mall-doelen en belooft geen centrale afrekening', () => {
  const mall = lees('public/apps/mall.html');
  const mijn = lees('public/apps/mijnmall.html');
  const schil = lees('public/apps/winkel-voorzijde.js');
  const bestellingen = lees('public/apps/mijnmall-mijn.js');
  assert.match(mall, /id="zoek"/);
  assert.match(mall, /id="nuOpen"/);
  assert.match(mall, /id="opVoorraad"/);
  assert.match(mijn, /id="bewaard"/);
  assert.match(mijn, /id="wijzigingen"/);
  assert.match(mijn, /id="bestellingen"/);
  assert.match(schil, /\/apps\/commerce\.html#mand-sec/);
  assert.match(bestellingen, /r\.pagina/);
  assert.match(mijn, /Betalen, wijzigen en annuleren doet u bij de aanbieder/);
  assert.doesNotMatch(mall + mijn + schil + bestellingen, /Betaal alles/);
});

test('voorraad thuis blijft een handmatige geheugensteun', () => {
  const mijn = lees('public/apps/mijnmall.html');
  assert.match(mijn, /RTG meet geen voorraad in uw woning/);
  assert.match(mijn, /U kiest zelf wat u bewaart/);
  assert.doesNotMatch(mijn, /automatisch aangevuld|sensor/i);
  assert.ok(Buffer.byteLength(lees('public/apps/winkel-voorzijde.js')) < 5 * 1024);
  assert.ok(Buffer.byteLength(lees('public/shared/rtg-winkel-2026.css')) < 12 * 1024);
});
