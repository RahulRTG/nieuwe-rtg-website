'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const html = lees('public/apps/foundation/gezondheid-welzijn.html');
const gedrag = lees('public/apps/foundation/gezondheid-welzijn.js');
const beeld = lees('public/apps/foundation/gezondheid-welzijn-weergave.js');

test('Gezondheid en Welzijn draagt de drie getekende schermen en vijf navigatiekeuzes', () => {
  for (const scherm of ['vandaag', 'ritme', 'zorg']) assert.match(html, new RegExp('data-gw-view="' + scherm + '"'));
  assert.match(html, /Goed voor uzelf\. Stap voor stap\./);
  assert.match(html, /Een ritme dat bij u past\./);
  assert.match(html, /De juiste hulp\. Dichtbij\./);
  assert.equal((html.match(/class="gw-nav"[\s\S]*?<\/nav>/) || [''])[0].match(/<button|<a /g).length, 5);
});

test('vandaag en zorg gebruiken echte Foundation- en Care-bronnen', () => {
  assert.match(gedrag, /\/api\/foundation\/gezin\//);
  assert.match(gedrag, /\/api\/care\/mijn/);
  assert.match(gedrag, /\/gezin\/gezondheid\/medicijn\/gegeven/);
  assert.match(beeld, /medicijnen/);
  assert.match(beeld, /afspraken/);
  assert.match(beeld, /boekingen/);
  assert.doesNotMatch(gedrag + beeld, /diagnose|gezondheidsscore|risicoscore/i);
});

test('ritme en gevoel blijven op het toestel en doen geen medische belofte', () => {
  assert.match(gedrag, /rtf_gezondheid_ritme_v1_/);
  assert.match(gedrag, /localStorage\.setItem/);
  assert.match(html, /geen medisch oordeel of gezondheidsscore/i);
  assert.match(html, /Uw keuze blijft alleen op dit toestel/);
});

test('externe zorgtekst wordt ontsnapt en de modules blijven klein', () => {
  assert.match(beeld, /function esc\(v\)/);
  assert.match(beeld, /&quot;/);
  assert.ok(Buffer.byteLength(gedrag) < 10240);
  assert.ok(Buffer.byteLength(beeld) < 10240);
});

test('Gezondheid en Welzijn zit in hub, catalogus, gids, route en offline schil', () => {
  assert.match(lees('public/apps/foundation/index.html'), /href="gezondheid-welzijn\.html"/);
  assert.match(lees('server/kern/rtfappcatalogus-data.js'), /foundation\/gezondheid-welzijn\.html/);
  assert.match(lees('server/kern/appcatalogus-rijen/deel2.js'), /rtf-gezondheid-welzijn/);
  assert.match(lees('server/kern/appgids-data/deel4.js'), /foundation\/gezondheid-welzijn\.html/);
  assert.match(lees('server/kern/wereldroutes/foundation.js'), /foundation\/gezondheid-welzijn\.html/);
  const sw = lees('public/apps/foundation/sw.js');
  for (const bestand of ['gezondheid-welzijn.html', 'gezondheid-welzijn.js', 'gezondheid-welzijn-weergave.js', 'rtg-foundation-gezondheid-welzijn-2026.css', 'foundation-gezondheid-vandaag-v1.jpg', 'foundation-zorg-dichtbij-v1.jpg']) assert.match(sw, new RegExp(bestand.replace('.', '\\.')));
});
