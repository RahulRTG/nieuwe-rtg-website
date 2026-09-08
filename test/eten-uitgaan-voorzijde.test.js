'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const lees = bestand => fs.readFileSync(path.join(root, bestand), 'utf8');

test('LivingOS Eten en Uitgaan heeft drie herkenbare schermen in een gedeelde stijl', () => {
  const ontdekken = lees('public/apps/foodcourt.html');
  const avond = lees('public/apps/uitgaan.html');
  const tafel = lees('public/apps/gast.html');

  assert.match(ontdekken, /rtg-night-discover/);
  assert.match(avond, /rtg-night-evening/);
  assert.match(tafel, /rtg-night-table/);
  for (const html of [ontdekken, avond, tafel]) {
    assert.match(html, /\/shared\/rtg-eten-uitgaan-2026\.css/);
    assert.match(html, /LivingOS/);
  }
  assert.match(ontdekken, /Van zin hebben naar iets dat bij u past/);
  assert.match(avond, /Alles voor vanavond\. In de juiste volgorde/);
  assert.match(tafel, /Samen genieten\. Zonder het regelwerk/);
});

test('Ontdekken en Mijn avond gebruiken de bestaande horeca- en aanbiederdata', () => {
  const ontdekken = lees('public/apps/foodcourt.html');
  const avond = lees('public/apps/uitgaan.html');

  for (const route of ['/api/foodcourt', '/api/foodcourt/tijden', '/api/reserveer']) {
    assert.match(ontdekken, new RegExp(route));
  }
  assert.match(ontdekken, /id="avondZoek"/);
  assert.match(ontdekken, /Het restaurant bevestigt hem/);

  for (const route of ['/api/uitgaan', '/api/uitgaan/mijn', '/api/mall/bestellingen']) {
    assert.match(avond, new RegExp(route));
  }
  assert.match(avond, /r\.soort === 'reservering' \|\| r\.soort === 'ticket'/);
  assert.match(avond, /r\.pagina/);
  assert.match(avond, /De aanbieder bevestigt, wijzigt of annuleert/);
  assert.doesNotMatch(ontdekken + avond, /Betaal alles/);
});

test('Aan tafel houdt de echte QR-functies en blijft zonder accountchrome werken', () => {
  const tafel = lees('public/apps/gast.html');
  assert.match(tafel, /data-ios-uit/);
  for (const id of ['menuVraag', 'allergie', 'bBestel', 'bVerdeel', 'bBetaal', 'vraagKnoppen']) {
    assert.match(tafel, new RegExp('id="' + id + '"'));
  }
  for (const handeling of ["api('bestel'", "api('rekening'", "api('verdeel'"]) {
    assert.ok(tafel.includes(handeling));
  }
  assert.doesNotMatch(tafel, /eten-uitgaan-voorzijde\.js/);
});

test('de mobiele navigatie verbindt de echte onderdelen zonder nieuwe nepbestemming', () => {
  const schil = lees('public/apps/eten-uitgaan-voorzijde.js');
  for (const route of [
    '/apps/foodcourt.html',
    '/apps/uitgaan.html#mijn',
    '/apps/bestellen.html',
    '/apps/app.html#scan',
    '/apps/uitgaan.html#ontdekken'
  ]) assert.ok(schil.includes(route));
  assert.match(schil, /rtg-night-discover/);
  assert.match(schil, /rtg-night-evening/);
  assert.doesNotMatch(schil, /href="\/apps\/gast\.html"/);
  assert.match(lees('public/apps/app-main/app-main-56b.js'), /location\.hash === '#scan'/);
  assert.ok(Buffer.byteLength(schil) < 5 * 1024);
  assert.ok(Buffer.byteLength(lees('public/shared/rtg-eten-uitgaan-2026.css')) < 12 * 1024);
});
