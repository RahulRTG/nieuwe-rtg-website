/* DE HERITAGE-ROUTEKAART IS FAIL-CLOSED.
   Een nieuw echt scherm mag niet ongemerkt een vijfde kleur erven en een oude
   redirect mag geen tweede productoppervlak worden. Daarom wordt het manifest
   hier tegen de werkelijke HTML-boom gehouden: 292 schermen, 18 doorwijzers,
   (290 sinds deze tak /apps/verificatie.html en /apps/vertegenwoordiging.html
   toevoegde, 292 sinds /apps/loopbaan.html en /apps/loopbaanbewijs.html erbij
   kwamen, 293 sinds /apps/mijn-neigingen.html en 294 sinds /apps/connect.html,
   en terug naar 293 met 17 doorwijzers sinds /apps/vandaag.html in RTG Life
   opging (SCHERMEIGENAAR.json), en 292 met 18 sinds /apps/toestemming.html een
   weergave van Wie heeft toegang tot mij werd --
   het getal is een grendel tegen
   een scherm dat er stil bij komt, en hoort dus mee te bewegen met een scherm
   dat er BEWUST bij komt), ieder exact eenmaal. */
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

test('het manifest dekt 292 echte schermen en 18 redirects precies eenmaal', () => {
  /* DE MUTATIE: voeg een HTML-scherm toe zonder manifestregel, of zet één pad
     in twee werelden. De setvergelijking of de lengtetoets moet dan zakken. */
  const echtManifest = identiteit.VALUES.flatMap((wereld) => identiteit.MANIFEST[wereld]);
  const allesManifest = echtManifest.concat(identiteit.REDIRECTS);

  assert.equal(BESTANDEN.length, 310, 'de appboom hoort 310 HTML-bestanden te bevatten');
  assert.equal(ECHTE_ROUTES.length, 292, 'exact 292 blijvende schermen horen basis.js te laden');
  assert.equal(DOORWIJZERS.length, 18, 'exact 18 oude adressen horen doorwijzers te blijven');
  assert.equal(echtManifest.length, 292, 'het vierwereldenmanifest hoort 292 schermen te bevatten');
  assert.deepEqual(identiteit.VALUES, ['living', 'travel', 'work', 'foundation'],
    'Core ondersteunt de werelden maar mag geen vijfde zichtbare wereld zijn');
  assert.equal(identiteit.REDIRECTS.length, 18, 'het redirectmanifest hoort 18 adressen te bevatten');
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

/* HET MANIFEST IS OP DE GEDEELDE ROUTES EEN AFGELEIDE VAN MAPPEN.

   `MAPPEN` in de app-main-bundel is de enige lijst werelden (WERELD.md); daaruit
   wordt WERELDLIJST.md geschreven, met dezelfde lezer als hier
   (scripts/lib/wereldregister.js -- een tweede lezer zou LAT.md regel 4 zijn).
   Het MANIFEST hierboven kent daarnaast een vaste kamer per scherm. Waar ze
   allebei een route noemen, is het manifest dus geen tweede eigenaar maar een
   afgeleide die met MAPPEN moet kloppen. Zo niet, dan zegt de wereldbank "dit
   hoort in Foundation" en verft de Edge het scherm als Living -- dat gebeurde met
   Vrienden, die op 7 september naar FoundationOS verhuisde (WERELDEN.md) en in
   het manifest bleef hangen.

   De routes die ALLEEN in het manifest staan (een paar honderd: kassa's, PDA's,
   juridische pagina's, foundationschermen die niet in een wereldbank hangen)
   krijgen hier geen tweede eigenaar: MAPPEN zegt over hen niets, en deze toets
   verzint dat niet. Dat hun enige wereld uit het manifest komt is een bestaande
   spanning met WERELD.md, en hij staat hier genoemd in plaats van opgelost.

   Een verschil dat bewust is, draagt zijn reden. Een verklaring die niet meer
   nodig is, laat de toets ook zakken: een uitzondering die blijft liggen nadat
   haar grond verdween, dekt de volgende drift af. */
const reg = require('../scripts/lib/wereldregister');
const WERELD_VAN = { LivingOS: 'living', WorkOS: 'work', TravelOS: 'travel', FoundationOS: 'foundation' };
const STAND = 'een stand binnen de ledenapp en geen eigen pagina: /apps/app.html heeft een vaste kamer (living), ' +
  'terwijl MAPPEN de stand in de wereld zet waar de mens hem gebruikt';
const UITZONDERINGEN = {
  'TravelOS tab:reizen': STAND,
  'TravelOS tab:terplaatse': STAND,
  'FoundationOS tab:zorg': STAND
};

function vergelijkMetMappen(uitzonderingen) {
  const afwijkingen = [], gedeeld = new Set();
  for (const w of reg.WERELDEN) for (const item of w.items) {
    const los = reg.los(item);
    if (!los.url || !los.url.startsWith('/')) continue;
    const pad = reg.kaal(los.url.split(' ')[0]);
    gedeeld.add(pad);
    const sleutel = w.naam + ' ' + item, verwacht = WERELD_VAN[w.naam], manifest = identiteit.classify(pad);
    if (manifest === verwacht) {
      if (sleutel in uitzonderingen) afwijkingen.push(sleutel + ': verklaard maar klopt al; haal de uitzondering weg');
      continue;
    }
    const reden = uitzonderingen[sleutel];
    if (typeof reden !== 'string' || reden.trim().length < 20) {
      afwijkingen.push(sleutel + ' -> ' + pad + ': MAPPEN=' + verwacht + ', manifest=' + manifest +
        (sleutel in uitzonderingen ? ' (uitzondering zonder reden)' : ''));
    }
  }
  for (const sleutel of Object.keys(uitzonderingen)) {
    const [wereld, item] = sleutel.split(' ');
    if (!reg.WERELDEN.some((w) => w.naam === wereld && w.items.includes(item))) {
      afwijkingen.push(sleutel + ': verklaard maar staat niet (meer) in MAPPEN');
    }
  }
  return { afwijkingen, gedeeld };
}

test('manifest en MAPPEN zeggen hetzelfde over de routes die ze delen', () => {
  /* DE MUTATIES: zet /apps/geld.html in het manifest bij work (MAPPEN zegt
     LivingOS), zet foundation/vrienden terug bij living, of maak de reden van
     tab:zorg leeg. Elk van de drie hoort hier bij naam te verschijnen. */
  const { afwijkingen, gedeeld } = vergelijkMetMappen(UITZONDERINGEN);
  assert.ok(gedeeld.size >= 60, 'er horen gedeelde routes te zijn; gevonden: ' + gedeeld.size);
  assert.deepEqual(afwijkingen, [], 'MAPPEN is de wereldlijst; het manifest volgt waar het dezelfde route noemt');
});

test('de vergelijking ziet een verschuiving en een reden die ontbreekt', () => {
  /* Zelfijking: een uitzondering zonder reden en een verzonnen uitzondering
     horen allebei te zakken, anders is de toets hierboven blind. */
  const zonderReden = Object.assign({}, UITZONDERINGEN, { 'FoundationOS tab:zorg': '' });
  assert.match(vergelijkMetMappen(zonderReden).afwijkingen.join('\n'), /tab:zorg.*zonder reden/);
  const verzonnen = Object.assign({}, UITZONDERINGEN, { 'LivingOS link:geldcommand': STAND });
  assert.match(vergelijkMetMappen(verzonnen).afwijkingen.join('\n'), /geldcommand: verklaard maar klopt al/);
});

test('elk wereldbureau draagt de wereld die het manifest hem geeft', () => {
  /* DE MUTATIE: zet data-world-home op reizen.html op living. */
  const bureaus = [];
  for (const bestand of BESTANDEN) {
    const html = fs.readFileSync(bestand, 'utf8');
    const thuis = /<body\b[^>]*\bdata-world-home=["']([^"']+)["']/i.exec(html);
    if (!thuis) continue;
    bureaus.push(route(bestand) + '=' + thuis[1] + (identiteit.classify(route(bestand)) === thuis[1] ? '' : ' (manifest: ' +
      identiteit.classify(route(bestand)) + ')'));
  }
  assert.deepEqual(bureaus.sort(), ['/apps/foundation/index.html=foundation', '/apps/foundation/os-publiek.html=foundation',
    '/apps/kantoor.html=work', '/apps/reizen.html=travel', '/apps/rtg.html=living', '/apps/wereld.html=living']);
});
