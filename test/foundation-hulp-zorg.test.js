/* De Hulp & Zorg-voorzijde mag warm en persoonlijk ogen, maar nooit een
   zorgverlener, dossier of toestemming verzinnen. Deze toets bewaakt de
   drie getekende schermen en hun echte databronnen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const html = lees('public/apps/foundation/zorg.html');
const gedrag = lees('public/apps/foundation/zorg-hulp.js');
const beeld = lees('public/apps/foundation/zorg-hulp-weergave.js');
const stijl = lees('public/shared/rtg-foundation-hulp-2026.css');
const sw = lees('public/apps/foundation/sw.js');

test('Hulp & Zorg bouwt de drie goedgekeurde Foundation-schermen', () => {
  for (const scherm of ['overzicht', 'hulp', 'begeleider']) {
    assert.match(html, new RegExp('data-fh-view="' + scherm + '"'));
    assert.match(html, new RegExp('data-fh-tab="' + scherm + '"'));
  }
  assert.match(html, /Hulp die met uw leven meebeweegt/);
  assert.match(html, /Waar kunnen we bij helpen/);
  assert.match(html, /Mijn begeleider/);
  assert.match(html, /href="premium\.css"/);
  assert.match(html, /src="premium\.js"/);
  assert.match(html, /<div class="fh-top" role="banner">/,
    'de premiumlaag mag de eigen Hulp & Zorg-bovenbalk niet vervangen');
});

test('afspraken, begeleider en toestemming komen uit bestaande bronnen', () => {
  assert.match(gedrag, /care\('\/api\/care\/mijn'/);
  assert.match(gedrag, /care\('\/api\/care'/);
  assert.match(gedrag, /\/api\/foundation\/gezin\//);
  assert.match(beeld, /function delen\(intakes,beschikbaar\)/);
  assert.match(beeld, /behandelaarNaam\|\|volgende\.aanbiederNaam/);
  assert.match(beeld, /intakes\|\|\[\]/);
  assert.doesNotMatch(html + gedrag + beeld, /Sanne de Vries|Samira|medicatieronde/i);
});

test('hulpvragen maken geen dossier en bewaren de tekst niet', () => {
  assert.match(html, /er wordt hiermee geen dossier of aanvraag gemaakt/i);
  assert.match(html, /Uw tekst wordt niet bewaard/i);
  assert.match(gedrag, /fetch\('\/api\/foundation\/hulp\/ai'/);
  assert.match(html, /Bel bij direct gevaar 112/);
  assert.match(html, /href="wegwijzer\.html"/);
});

test('de nieuwe app blijft onderdeel van de offline Foundation-schil', () => {
  for (const bestand of ['zorg.html', 'zorg-hulp.js', 'zorg-hulp-weergave.js']) {
    assert.match(sw, new RegExp('/apps/foundation/' + bestand.replace('.', '\\.')));
  }
  assert.match(sw, /rtg-foundation-hulp-2026\.css/);
  assert.ok(Buffer.byteLength(gedrag) <= 10240);
  assert.ok(Buffer.byteLength(beeld) <= 10240);
  assert.match(stijl, /--fh-diep:#123c3a/);
  assert.match(stijl, /--fh-wijn:#8f1538/);
  assert.match(stijl, /--fh-papier:#f7f0e3/);
  assert.match(stijl, /foundation-zorg-dichtbij-v1\.jpg/,
    'Hulp & Zorg gebruikt het eigen zorgbeeld en niet de algemene Foundation-foto');
  assert.match(stijl, /\.foundation-hulp \.fh-nav\{z-index:8901\}/,
    'de vaste Foundation-systeembalk mag de appnavigatie niet afvangen');
});
