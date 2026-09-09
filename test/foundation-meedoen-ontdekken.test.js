'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const html = lees('public/apps/foundation/meedoen-ontdekken.html');
const gedrag = lees('public/apps/foundation/meedoen-ontdekken.js');
const beeld = lees('public/apps/foundation/meedoen-ontdekken-weergave.js');

test('Meedoen en Ontdekken draagt de getekende hoofdschermen en vijf navigatiekeuzes', () => {
  for (const scherm of ['vandaag', 'buurt', 'detail', 'maken', 'kansen']) assert.match(html, new RegExp('data-mo-view="' + scherm + '"'));
  assert.match(html, /Er is meer mogelijk wanneer u weet waar u welkom bent\./);
  assert.match(html, /Iets om aan mee te doen\./);
  assert.match(html, /Uw plek is pas definitief nadat de organisator die heeft bevestigd\./);
  assert.equal((html.match(/class="mo-nav"[\s\S]*?<\/nav>/) || [''])[0].match(/<button|<a /g).length, 5);
});

test('buurtaanbod komt uitsluitend uit de bestaande poster-veilige bron', () => {
  assert.match(gedrag, /\/api\/rtfos\/publiek\//);
  assert.match(gedrag, /api\('steden'\)/);
  assert.match(gedrag, /api\('stad'/);
  assert.match(gedrag, /api\('campagnes'\)/);
  assert.doesNotMatch(gedrag, /geolocation|latitude|longitude/);
  assert.doesNotMatch(gedrag, /activiteit\/inschrijven/);
});

test('belangstelling blijft lokaal en beweert geen reservering', () => {
  assert.match(gedrag, /localStorage\.setItem\(sleutel/);
  assert.match(beeld, /Uw plek is nog niet gereserveerd/);
  assert.match(html, /er wordt vanuit dit scherm niets verstuurd/i);
  assert.match(html, /geen routekaart/);
});

test('publieke gegevens worden ontsnapt en gedragsmodules blijven klein', () => {
  assert.match(beeld, /function esc\(v\)/);
  assert.match(beeld, /&quot;/);
  assert.ok(Buffer.byteLength(gedrag) < 10240);
  assert.ok(Buffer.byteLength(beeld) < 10240);
});

test('Meedoen en Ontdekken zit in hub, catalogus, gids, route en offline schil', () => {
  assert.match(lees('public/apps/foundation/index.html'), /href="meedoen-ontdekken\.html"/);
  assert.match(lees('server/kern/rtfappcatalogus-data.js'), /foundation\/meedoen-ontdekken\.html/);
  assert.match(lees('server/kern/appcatalogus-rijen/deel2.js'), /rtf-meedoen-ontdekken/);
  assert.match(lees('server/kern/appgids-data/deel4.js'), /foundation\/meedoen-ontdekken\.html/);
  assert.match(lees('server/kern/wereldroutes/foundation.js'), /foundation\/meedoen-ontdekken\.html/);
  const sw = lees('public/apps/foundation/sw.js');
  for (const bestand of ['meedoen-ontdekken.html', 'meedoen-ontdekken.js', 'meedoen-ontdekken-weergave.js', 'rtg-foundation-meedoen-ontdekken-2026.css', 'foundation-meedoen-buurt-v2.jpg', 'foundation-meedoen-atelier-v1.jpg']) assert.match(sw, new RegExp(bestand.replace('.', '\\.')));
});
