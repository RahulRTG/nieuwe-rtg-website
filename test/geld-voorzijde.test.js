'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(root, p), 'utf8');

test('RTG Geld opent met drie rustige hoofdtaken en houdt alle bestaande standen', () => {
  const html = lees('public/apps/geld.html');
  const schil = lees('public/apps/geld/schil.js');
  const voor = lees('public/apps/geld/voorzijde.js');
  assert.match(html, /\/shared\/rtg-geld-2026\.css/);
  assert.match(html, /\/apps\/geld\/voorzijde\.js/);
  for (const id of ['overzicht', 'betalen', 'vooruit', 'meer']) {
    assert.match(schil + voor, new RegExp("['\"]" + id + "['\"]"));
  }
  for (const id of ['wallet', 'waarde', 'bank', 'wbw', 'rtgcode', 'kosten', 'metier',
    'balans', 'labfonds', 'mecenaat', 'logboek', 'nalatenschap']) {
    assert.match(voor, new RegExp("['\"]" + id + "['\"]"), id + ' blijft onder Meer bereikbaar');
  }
});

test('de nieuwe Geld-schermen lezen bestaande bronnen en verzinnen geen bedragen', () => {
  const voor = lees('public/apps/geld/voorzijde.js');
  for (const route of ['/api/wbw/mijn', '/api/bank/vastelasten', '/api/geld/cockpit',
    '/api/geld/beleid', '/api/geld/pot/zet']) assert.match(voor, new RegExp(route.replace(/\//g, '\\/')));
  assert.doesNotMatch(voor, /€\s*[0-9]/, 'voorbeeldbedragen horen alleen in de tekening, niet in de app');
  assert.match(voor, /Verwachtingen komen uit uw geldbeeld/);
  assert.ok(Buffer.byteLength(voor) < 10 * 1024);
  assert.ok(Buffer.byteLength(lees('public/shared/rtg-geld-2026.css')) < 10 * 1024);
});

test('de primaire Geld-navigatie gebruikt Meer als actieve ingang voor een detailstand', () => {
  const schil = lees('public/apps/geld/schil.js');
  assert.match(schil, /navId = hoofd\.indexOf\(s\.id\) >= 0 \? s\.id : 'meer'/);
  assert.match(schil, /class="gx-plus" href="\/apps\/pay\.html"/);
});
