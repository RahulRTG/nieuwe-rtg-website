/* Leren & Groei toont de bestaande leerroute in de drie goedgekeurde
   schermen. De toets bewaakt dat vorm nooit wordt verward met bewijs. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const html = lees('public/apps/foundation/leren.html');
const gedrag = lees('public/apps/foundation/leren-groei.js');
const beeld = lees('public/apps/foundation/leren-groei-weergave.js');
const stijl = lees('public/shared/rtg-foundation-leren-2026.css');
const sw = lees('public/apps/foundation/sw.js');

test('Leren & Groei draagt de drie getekende schermen', () => {
  for (const scherm of ['vandaag', 'groei', 'hulp']) {
    assert.match(html, new RegExp('data-lg-view="' + scherm + '"'));
    assert.match(html, new RegExp('data-lg-tab="' + scherm + '"'));
  }
  assert.match(html, /Vandaag één stap verder/);
  assert.match(html, /Zie wat er al groeit/);
  assert.match(html, /Vastgelopen\? We kijken samen/);
  assert.match(html, /<div class="lg-top" role="banner">/,
    'de premiumlaag mag de eigen bovenbalk niet vervangen');
});

test('dag, groei en onderwerpen komen uit de echte leerlingroute', () => {
  for (const pad of ['/api/rtf/leerling/paspoort', '/api/rtf/leerling/dag', '/api/rtf/leerling/vakken']) {
    assert.ok(gedrag.includes(pad), pad);
  }
  assert.match(beeld, /plan&&plan\.stukken/);
  assert.match(beeld, /v\.doelen\|\|\[\]/);
  assert.doesNotMatch(html + gedrag + beeld, /20 minuten|Zelfvertrouwen|Je vroeg om hulp/i);
});

test('leerhulp gebruikt de bestaande bijles en bewaart de eerlijke privacytekst', () => {
  assert.match(gedrag, /\/api\/rtf\/leerling\/bijles\/gesprek/);
  assert.match(gedrag, /\/api\/rtf\/leerling\/bijles\/vraag/);
  assert.match(html, /blijft bij uw profiel en wordt niet automatisch met een begeleider gedeeld/i);
  assert.match(html, /geen reeks, achterstand of ranglijst/i);
});

test('de bestaande live les blijft volledig bereikbaar', () => {
  assert.match(gedrag, /\/api\/foundation\/les\/maak/);
  assert.match(gedrag, /\/api\/foundation\/les\/join/);
  assert.match(gedrag, /RTGSchoolSession\.zet\('rtf_docent'/);
  assert.match(gedrag, /RTGSchoolSession\.zet\('rtf_leerling'/);
  assert.match(html, /id="dlgDocent"/);
  assert.match(html, /id="dlgLeerling"/);
});

test('vorm en gedrag blijven onderdeel van de offline Foundation-schil', () => {
  for (const bestand of ['leren-groei.js', 'leren-groei-weergave.js']) {
    assert.match(sw, new RegExp('/apps/foundation/' + bestand.replace('.', '\\.')));
  }
  assert.match(sw, /rtg-foundation-leren-2026\.css/);
  assert.ok(Buffer.byteLength(gedrag) <= 10240);
  assert.ok(Buffer.byteLength(beeld) <= 10240);
  assert.match(stijl, /--lg-diep:#123c3a/);
  assert.match(stijl, /--lg-wijn:#8f1538/);
  assert.match(stijl, /\.lg-nav\{position:fixed;z-index:8901/);
});
