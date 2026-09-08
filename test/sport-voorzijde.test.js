'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const lees = bestand => fs.readFileSync(path.join(root, bestand), 'utf8');

test('LivingOS Sport heeft de drie getekende ervaringen in de Heritage-stijl', () => {
  const html = lees('public/apps/sport.html');
  assert.match(html, /rtg-sport-flow/);
  assert.match(html, /\/shared\/rtg-sport-2026\.css/);
  assert.match(html, /Sport · samen · beleven/);
  assert.match(html, /Alles rondom de wedstrijd\. Op het juiste moment/);
  assert.match(html, /Van uw vak tot de aftrap/);
  assert.match(html, /Dichter bij de club\. Zonder iets te missen/);
  for (const stand of ['bord', 'mijn', 'tickets', 'club', 'stand']) {
    assert.match(html, new RegExp('data-sport="' + stand + '"'));
  }
});

test('Vandaag, Wedstrijddag en Mijn club blijven op de bestaande Sport-kern', () => {
  const html = lees('public/apps/sport.html');
  for (const route of ['/bord', '/stand', '/plattegrond', '/ticket/koop', '/tickets', '/momenten', '/sponsors', '/sponsor']) {
    assert.ok(html.includes("api('" + route + "'"), route + ' ontbreekt');
  }
  assert.match(html, /data-koop/);
  assert.match(html, /data-vak/);
  assert.match(html, /data-sp/);
  assert.match(html, /de club beslist zelf en neemt contact op/);
});

test('toegang is een echte QR van de ticketcode en betaling blijft bij de club', () => {
  const html = lees('public/apps/sport.html');
  assert.match(html, /\/shared\/qrteken\.js/);
  assert.match(html, /RTGQRteken\.dataURL\(img\.dataset\.ticketCode/);
  assert.match(html, /contant of RTG Pay/);
  assert.match(html, /Betalen doet u bij de club/);
  assert.match(html, /\/apps\/navigatie\.html/);
  assert.doesNotMatch(html, /Betaal alles|automatisch betaald/i);
});

test('de sportschil blijft een klein zelfstandig stijlbestand', () => {
  assert.ok(Buffer.byteLength(lees('public/shared/rtg-sport-2026.css')) < 10 * 1024);
});
