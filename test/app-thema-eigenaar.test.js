const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORTEL = path.join(__dirname, '..');
const lees = (p) => fs.readFileSync(path.join(WORTEL, p), 'utf8');

test('de ledenapp heeft een thema-eigenaar en geen oude licht-donkerlaag', () => {
  const html = lees('public/apps/app.html');
  const bron = [
    'public/apps/app-main/app-main-02b.js',
    'public/apps/app-main/app-main-27.js',
    'public/apps/app-main/app-main-27b.js',
    'public/apps/app-main/app-main-29.js'
  ].map(lees).join('\n');

  assert.doesNotMatch(html, /\/shared\/thema\.js/,
    'de oude licht-donkerlaag is weer actief in de ledenapp');
  assert.doesNotMatch(bron, /rtg-thema-knop|window\.RTGThema\b/,
    'een ingang gebruikt nog de verborgen oude thema-eigenaar');
  assert.match(bron, /window\.RTGOSThema\s*=\s*\{/,
    'de OS-controller is niet de expliciete thema-eigenaar');
  assert.match(bron, /wissel:\s*pasThemaWissel/,
    'de korte licht-donkerhandeling loopt niet via de OS-controller');
  assert.match(bron, /RTGOSThema\.zet\(licht \? 'parelmoer' : 'standaard'\)/,
    'Rahul vertaalt licht en donker niet deterministisch naar de actuele themawaarden');
});

test('de thema-eigenaar weigert onbekende waarden en bewaart alle drie geldige keuzes', () => {
  const bron = lees('public/apps/app-main/app-main-02b.js');
  assert.match(bron, /t !== 'standaard' && t !== 'bordeaux' && t !== 'parelmoer'/,
    'een onbekende themawaarde kan de gedeelde opslag nog vervuilen');
  assert.match(bron, /pasThemaHuidig\(\) === 'parelmoer' \? 'standaard' : 'parelmoer'/,
    'de korte wissel heeft geen voorspelbaar licht-donkercontract');
  assert.match(lees('public/apps/app.html'), /data-thema="parelmoer"[\s\S]*data-thema="standaard"[\s\S]*data-thema="bordeaux"/,
    'de drie bestaande zichtbare keuzes zijn niet behouden');
});
