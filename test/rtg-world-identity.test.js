/* DE HERITAGE-ROUTEKAART IS FAIL-CLOSED.
   Een nieuw echt scherm mag niet ongemerkt een vijfde kleur erven en een oude
   redirect mag geen tweede productoppervlak worden. Daarom wordt het manifest
   hier tegen de werkelijke HTML-boom gehouden: 290 schermen, 16 doorwijzers,
   (290 sinds deze tak /apps/verificatie.html en /apps/vertegenwoordiging.html
   toevoegde -- het getal is een grendel tegen een scherm dat er stil bij komt,
   en hoort dus mee te bewegen met een scherm dat er BEWUST bij komt),
   ieder exact eenmaal. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const identiteit = require('../public/shared/rtg-world-identity.js');

const WORTEL = path.join(__dirname, '..');
const APPS = path.join(WORTEL, 'public', 'apps');

function htmlBestanden(map) {
  return fs.readdirSync(map, { withFileTypes: true }).flatMap((item) => {
    const volledig = path.join(map, item.name);
    if (item.isDirectory()) return htmlBestanden(volledig);
    return item.name.endsWith('.html') ? [volledig] : [];
  });
}

function route(bestand) {
  return '/' + path.relative(path.join(WORTEL, 'public'), bestand).split(path.sep).join('/');
}

const BESTANDEN = htmlBestanden(APPS).sort();
const ALLE_ROUTES = BESTANDEN.map(route).sort();
const ECHTE_ROUTES = BESTANDEN.filter((bestand) =>
  /\/shared\/basis\.js/.test(fs.readFileSync(bestand, 'utf8'))).map(route).sort();
const DOORWIJZERS = BESTANDEN.filter((bestand) =>
  !/\/shared\/basis\.js/.test(fs.readFileSync(bestand, 'utf8'))).map(route).sort();

test('het manifest dekt 290 echte schermen en 16 redirects precies eenmaal', () => {
  /* DE MUTATIE: voeg een HTML-scherm toe zonder manifestregel, of zet één pad
     in twee werelden. De setvergelijking of de lengtetoets moet dan zakken. */
  const echtManifest = identiteit.VALUES.flatMap((wereld) => identiteit.MANIFEST[wereld]);
  const allesManifest = echtManifest.concat(identiteit.REDIRECTS);

  assert.equal(BESTANDEN.length, 306, 'de appboom hoort 306 HTML-bestanden te bevatten');
  assert.equal(ECHTE_ROUTES.length, 290, 'exact 290 blijvende schermen horen basis.js te laden');
  assert.equal(DOORWIJZERS.length, 16, 'exact 16 oude adressen horen doorwijzers te blijven');
  assert.equal(echtManifest.length, 290, 'het vierwereldenmanifest hoort 290 schermen te bevatten');
  assert.deepEqual(identiteit.VALUES, ['living', 'travel', 'work', 'foundation'],
    'Core ondersteunt de werelden maar mag geen vijfde zichtbare wereld zijn');
  assert.equal(identiteit.REDIRECTS.length, 16, 'het redirectmanifest hoort 16 adressen te bevatten');
  assert.equal(new Set(allesManifest).size, allesManifest.length,
    'geen route mag in twee werelden of ook als redirect staan');
  assert.deepEqual(echtManifest.slice().sort(), ECHTE_ROUTES,
    'ieder blijvend scherm hoort exact één vaste wereldidentiteit te hebben');
  assert.deepEqual(identiteit.REDIRECTS.slice().sort(), DOORWIJZERS,
    'doorwijzers horen apart en volledig in het manifest te staan');
  assert.deepEqual(allesManifest.slice().sort(), ALLE_ROUTES,
    'manifest en fysieke appboom horen dezelfde routes te bevatten');
});

test('bestaande expliciete body-werelden spreken het manifest niet tegen', () => {
  /* DE MUTATIE: verplaats camera naar Work terwijl camera.html living zegt. */
  const afwijkingen = [];
  for (const bestand of BESTANDEN) {
    const verwacht = identiteit.classify(route(bestand));
    if (verwacht === 'redirect') continue;
    const html = fs.readFileSync(bestand, 'utf8');
    const gevonden = /<body\b[^>]*\bdata-rtg-world=["']([^"']+)["']/i.exec(html);
    if (gevonden && verwacht !== gevonden[1]) {
      afwijkingen.push(route(bestand) + ': body=' + gevonden[1] +
        ', manifest=' + verwacht);
    }
  }
  assert.deepEqual(afwijkingen, [], 'expliciete schermidentiteit blijft de hoogste autoriteit');
});

function nepBody(begin) {
  const waarden = Object.assign({}, begin);
  return {
    hasAttribute: (naam) => Object.prototype.hasOwnProperty.call(waarden, naam),
    getAttribute: (naam) => Object.prototype.hasOwnProperty.call(waarden, naam) ? waarden[naam] : null,
    setAttribute: (naam, waarde) => { waarden[naam] = String(waarde); },
    waarden
  };
}

test('classificatie normaliseert adressen en toepassen bewaakt het centrale manifest', () => {
  assert.equal(identiteit.classify('https://rtg.example/apps/rtg.html?pas=rtg#nu'), 'living');
  assert.equal(identiteit.classify('/apps/'), 'living');
  assert.equal(identiteit.classify('/apps/foundation/'), 'foundation');
  assert.equal(identiteit.classify('/apps/onbekend.html'), null);
  assert.equal(identiteit.classify('/apps/wallet.html'), 'redirect');

  const leeg = nepBody();
  assert.equal(identiteit.apply({ body: leeg, defaultView: { location: { pathname: '/apps/reizen.html' } } }), 'travel');
  assert.equal(leeg.waarden['data-rtg-skin'], 'heritage');
  assert.equal(leeg.waarden['data-rtg-world'], 'travel');

  const eigen = nepBody({ 'data-rtg-world': 'living' });
  assert.equal(identiteit.apply({ body: eigen }, '/apps/kantoor.html'), 'work');
  assert.equal(eigen.waarden['data-rtg-world'], 'work', 'een route kan het centrale wereldmanifest niet overschrijven');
  assert.equal(eigen.waarden['data-rtg-skin'], 'heritage');
});

test('basis laadt de routekaart vroeg en het heritage-blad laat en uniek', () => {
  const bron = fs.readFileSync(path.join(WORTEL, 'public', 'shared', 'basis', 'basis-01.js'), 'utf8');
  assert.equal((bron.match(/\.src = '\/shared\/rtg-world-identity\.js'/g) || []).length, 1);
  assert.equal((bron.match(/\.href = '\/shared\/rtg-heritage\.css'/g) || []).length, 1);
  assert.ok(bron.includes("getElementById('rtgWorldIdentityJs')"));
  assert.ok(bron.includes("getElementById('rtgHeritageCss')"));
  assert.ok(bron.indexOf('/shared/rtg-world-identity.js') < bron.indexOf('/shared/i18n.js'),
    'wereldidentiteit hoort voor de overige gedeelde lagen te starten');
  assert.ok(/window\.RTGWorldIdentity\.apply\([\s\S]*finally \{ laadHeritageBlad\(\); \}/.test(bron),
    'de heritage-stylesheet hoort pas na de identiteit te worden toegevoegd');
});


test('de gedeelde werkruimte kent uitsluitend centraal toegewezen gebieden', () => {
  const identity = require('../public/shared/rtg-world-identity');
  for (const [area,world] of [['reizen','travel'],['living','living'],['foundation','foundation'],['kantoor','work'],['persoonlijk','work'],['random','work'],['constructor','work'],['toString','work'],['__proto__','work']])
    assert.equal(identity.classify('/apps/werkruimte.html?gebied='+area),world);
  assert.equal(identity.classify('/apps/kantoor.html?gebied=living'),'work','een willekeurige route kan niet van wereld wisselen');
});
