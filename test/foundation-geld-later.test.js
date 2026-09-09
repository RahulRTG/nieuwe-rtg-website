'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const html = lees('public/apps/foundation/geld-later.html');
const gedrag = lees('public/apps/foundation/geld-later.js');
const beeld = lees('public/apps/foundation/geld-later-weergave.js');

test('Geld en Later draagt de drie getekende schermen en vijf navigatiekeuzes', () => {
  for (const scherm of ['vandaag', 'toekomst', 'regelen']) assert.match(html, new RegExp('data-gl-view="' + scherm + '"'));
  assert.match(html, /Vandaag begrijpen\. Voor morgen bouwen\./);
  assert.match(html, /Uw route\. Uw toekomst\./);
  assert.equal((html.match(/class="gl-nav"[\s\S]*?<\/nav>/) || [''])[0].match(/<button|<a /g).length, 5);
});

test('de geldsamenvatting komt uit het echte profielpotje en de vacaturebron', () => {
  assert.match(gedrag, /\/tiener\/potje/);
  assert.match(gedrag, /\/vacatures/);
  assert.match(beeld, /saldoCenten/);
  assert.match(beeld, /doelCenten/);
  assert.match(beeld, /transacties/);
  assert.doesNotMatch(gedrag + beeld, /crypto|beleggen|rendement|investeringsadvies/i);
});

test('regelen gebruikt het bestaande spaardoel en bewaart budget en cv alleen lokaal', () => {
  assert.match(gedrag, /\/tiener\/doel-maak/);
  assert.match(gedrag, /rtf_cv/);
  assert.match(gedrag, /rtf_geld_later_budget_v1/);
  assert.match(gedrag, /localStorage\.setItem/);
  assert.match(html, /budget\.html|Budget maken/);
  assert.match(gedrag, /href=\"cv\.html\"/);
  assert.match(gedrag, /href=\"rechten\.html\"/);
});

test('externe tekst wordt ontsnapt en de modules blijven klein', () => {
  assert.match(beeld, /function esc\(t\)/);
  assert.match(beeld, /&quot;/);
  assert.ok(Buffer.byteLength(gedrag) < 10240);
  assert.ok(Buffer.byteLength(beeld) < 10240);
});

test('Geld en Later zit in hub, catalogus, gids, route en offline schil', () => {
  assert.match(lees('public/apps/foundation/index.html'), /href="geld-later\.html"/);
  assert.match(lees('server/kern/rtfappcatalogus-data.js'), /foundation\/geld-later\.html/);
  assert.match(lees('server/kern/appcatalogus-rijen/deel2.js'), /rtf-geld-later/);
  assert.match(lees('server/kern/appgids-data/deel4.js'), /foundation\/geld-later\.html/);
  assert.match(lees('server/kern/wereldroutes/foundation.js'), /foundation\/geld-later\.html/);
  const sw = lees('public/apps/foundation/sw.js');
  for (const bestand of ['geld-later.html', 'geld-later.js', 'geld-later-weergave.js', 'rtg-foundation-geld-later-2026.css']) assert.match(sw, new RegExp(bestand.replace('.', '\\.')));
});
