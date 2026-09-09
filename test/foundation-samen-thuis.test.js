'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const wortel = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(wortel, p), 'utf8');
const html = lees('public/apps/foundation/samen-thuis.html');
const gedrag = lees('public/apps/foundation/samen-thuis.js');
const beeld = lees('public/apps/foundation/samen-thuis-weergave.js');
const stijl = lees('public/shared/rtg-foundation-samen-thuis-2026.css');

test('Samen Thuis draagt de drie getekende schermen en vijf herkenbare navigatiekeuzes', () => {
  for (const scherm of ['vandaag', 'gezin', 'regelen']) assert.match(html, new RegExp('data-st-view="' + scherm + '"'));
  for (const woord of ['Vandaag', 'Gezin', 'Regelen', 'Berichten', 'Meer']) assert.match(html, new RegExp('>' + woord + '<'));
  assert.match(html, /Samen begint met overzicht/);
  assert.match(html, /Alleen zichtbaar voor uw gezin/);
  assert.match(stijl, /foundation-heritage-v2\.jpg/);
});

test('het overzicht leest uitsluitend de bestaande gezinsbronnen', () => {
  for (const route of ['/gezin/agenda/bereik', '/klussen', '/ochtend', '/keuken', '/mij']) assert.match(gedrag, new RegExp(route.replaceAll('/', '\\/')));
  assert.match(beeld, /Geen eigen afspraak/);
  assert.match(html, /Er wordt geen locatie of aanwezigheid geraden/);
  for (const verzinsel of ["'Onderweg'", "'Thuis'", "'Heeft hulp nodig'"]) assert.ok(!beeld.includes(verzinsel));
});

test('regelen schrijft terug naar agenda, klusjes en het echte gezinsbericht', () => {
  assert.match(gedrag, /api\('\/gezin\/agenda'/);
  assert.match(gedrag, /api\('\/gezin\/klus'/);
  assert.match(gedrag, /api\('\/gezin\/bericht'/);
  assert.match(gedrag, /soort:'hulp'/);
  assert.match(gedrag, /\['beheerder','ouder'\]/);
});

test('profieltekst en gezinsdata worden ontsnapt voordat ze in de pagina komen', () => {
  assert.ok(beeld.includes('replace(/[&<>\"]/g'));
  assert.match(beeld, /esc\(p\.naam\)/);
  assert.match(beeld, /opKleur/);
  assert.ok(Buffer.byteLength(gedrag) < 10 * 1024);
  assert.ok(Buffer.byteLength(beeld) < 10 * 1024);
});

test('Samen Thuis zit in hub, appgids, wereldroute en offline Foundation-schil', () => {
  assert.match(lees('public/apps/foundation/index.html'), /href="samen-thuis\.html"/);
  assert.match(lees('server/kern/appgids-data/deel4.js'), /foundation\/samen-thuis\.html/);
  assert.match(lees('server/kern/wereldroutes/foundation.js'), /foundation\/samen-thuis\.html/);
  const sw = lees('public/apps/foundation/sw.js');
  for (const bestand of ['samen-thuis.html', 'samen-thuis.js', 'samen-thuis-weergave.js', 'rtg-foundation-samen-thuis-2026.css']) assert.match(sw, new RegExp(bestand.replace('.', '\\.')));
});
