/* De Foundation is één ervaring: elk los hulpmiddel, School, Klas en Campus
   draagt dezelfde premiumlaag. Deze toets voorkomt dat een nieuwe pagina als
   visueel eiland verschijnt of dat mobiel opnieuw buiten beeld groeit. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const HUIS = path.join(ROOT, 'public', 'apps', 'foundation');
const htmlBestanden = fs.readdirSync(HUIS).filter((naam) => naam.endsWith('.html')).sort();
const css = fs.readFileSync(path.join(HUIS, 'premium.css'), 'utf8');
const js = fs.readFileSync(path.join(HUIS, 'premium.js'), 'utf8');
const hub = fs.readFileSync(path.join(HUIS, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(HUIS, 'sw.js'), 'utf8');

test('elk Foundation-scherm draagt de gedeelde premiumlaag', () => {
  assert.ok(htmlBestanden.length >= 70, 'de toets hoort het volledige Foundation-huis te bewaken');
  const zonderCss = htmlBestanden.filter((naam) => !/href="premium\.css"/.test(fs.readFileSync(path.join(HUIS, naam), 'utf8')));
  const zonderJs = htmlBestanden.filter((naam) => !/src="premium\.js"/.test(fs.readFileSync(path.join(HUIS, naam), 'utf8')));
  assert.deepEqual(zonderCss, [], 'zonder gedeelde vorm: ' + zonderCss.join(', '));
  assert.deepEqual(zonderJs, [], 'zonder gedeeld gedrag: ' + zonderJs.join(', '));
});

test('de premiumtaal bewaart goud, veiligheid en één beslissend actieaccent', () => {
  for (const kleur of ['--rtf-ink:#08090c', '--rtf-blue:#164a98', '--rtf-gold:#c39b4a', '--rtf-crimson:#a6002f', '--rtf-safe:#63d587']) {
    assert.ok(css.toLowerCase().includes(kleur), kleur + ' ontbreekt');
  }
  assert.match(css, /\.knop,\.doorgaan\{[^]*var\(--rtf-crimson\)/);
  assert.match(css, /\.veilig,\.school-veilig/);
});

test('hubtegels kunnen op telefoon niet door hun tekst uit het raster groeien', () => {
  assert.match(css, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /body\.rtg-stijl \.tile,\.tile\{[^]*min-width:0!important/);
  assert.match(css, /\.tile h2\{[^]*text-overflow:ellipsis/);
  assert.match(js, /icoon\.dataset\.code/);
});

test('de entree en leerwereld spreken dezelfde ambitieuze, toegankelijke belofte', () => {
  assert.match(hub, /Jouw toekomst\. <b>Op wereldniveau\.<\/b>/);
  assert.match(hub, /Toegankelijk voor ieder kind en ieder gezin/);
  assert.match(hub, /Veilige gezinsomgeving/);
  assert.doesNotMatch(hub, /const AVATARS = \['',''/);
});

test('de nieuwe vorm blijft ook offline onderdeel van de Foundation-schil', () => {
  assert.match(sw, /foundation\/premium\.css/);
  assert.match(sw, /foundation\/premium\.js/);
  assert.match(sw, /const CACHE = 'rtf-premium-foundation-/);
  assert.match(sw, /k\.startsWith\('rtf-premium-foundation-'\) && k !== CACHE/,
    'Foundation mag bij activeren niet de offline cache van RTG wissen');
});
