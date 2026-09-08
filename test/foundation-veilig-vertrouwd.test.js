'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const html = lees('public/apps/foundation/veilig-vertrouwd.html');
const gedrag = lees('public/apps/foundation/veilig-vertrouwd.js');
const beeld = lees('public/apps/foundation/veilig-vertrouwd-weergave.js');

test('Veilig en Vertrouwd draagt vier rustige schermen en vijf navigatiekeuzes', () => {
  for (const scherm of ['vandaag', 'kring', 'hulp', 'regelen']) assert.match(html, new RegExp('data-vv-view="' + scherm + '"'));
  assert.match(html, /Veilig voelen begint met weten dat u er niet alleen voor staat\./);
  assert.match(html, /U bepaalt wie dichtbij mag komen\./);
  assert.match(html, /U hoeft het niet eerst alleen op te lossen\./);
  assert.equal((html.match(/class="vv-nav"[\s\S]*?<\/nav>/) || [''])[0].match(/<button|<a /g).length, 5);
});

test('gezinsstatus en kring komen uit bestaande echte bronnen', () => {
  assert.match(gedrag, /\/api\/foundation\/gezin\//);
  assert.match(gedrag, /\/api\/rtf\/leven\/kring/);
  assert.match(gedrag, /\/gezin\/locatie/);
  assert.match(beeld, /ikDeel/);
  assert.match(beeld, /ikZie/);
  assert.doesNotMatch(beeld, /\.lat|\.lon/);
});

test('korte status deelt geen GPS en hulp doet niets stilzwijgend', () => {
  assert.match(html, /Zonder uw precieze locatie/);
  assert.doesNotMatch(gedrag, /geolocation|latitude|longitude|\blat\b|\blon\b/);
  assert.match(html, /Door dit scherm te openen wordt niets verstuurd/);
  assert.match(html, /href="tel:112"/);
  assert.match(html, /href="tel:08002000"/);
});

test('gegevens uit de kring en gezinsstatus worden ontsnapt en modules blijven klein', () => {
  assert.match(beeld, /function esc\(v\)/);
  assert.match(beeld, /&quot;/);
  assert.ok(Buffer.byteLength(gedrag) < 10240);
  assert.ok(Buffer.byteLength(beeld) < 10240);
});

test('Veilig en Vertrouwd zit in hub, catalogus, gids, route en offline schil', () => {
  assert.match(lees('public/apps/foundation/index.html'), /href="veilig-vertrouwd\.html"/);
  assert.match(lees('server/kern/rtfappcatalogus-data.js'), /foundation\/veilig-vertrouwd\.html/);
  assert.match(lees('server/kern/appcatalogus-rijen/deel2.js'), /rtf-veilig-vertrouwd/);
  assert.match(lees('server/kern/appgids-data/deel4.js'), /foundation\/veilig-vertrouwd\.html/);
  assert.match(lees('server/kern/wereldroutes/foundation.js'), /foundation\/veilig-vertrouwd\.html/);
  const sw = lees('public/apps/foundation/sw.js');
  for (const bestand of ['veilig-vertrouwd.html', 'veilig-vertrouwd.js', 'veilig-vertrouwd-weergave.js', 'rtg-foundation-veilig-vertrouwd-2026.css', 'foundation-veilig-vertrouwd-v1.jpg']) assert.match(sw, new RegExp(bestand.replace('.', '\\.')));
});
