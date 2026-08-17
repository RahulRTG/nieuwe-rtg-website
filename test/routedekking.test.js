/* DE ROUTEDEKKING: 100% VAN ALLE ROUTES, EN HET PERSONEEL KAN HET NAKIJKEN.

   Draai los: node --experimental-sqlite --test test/routedekking.test.js

   WAT HIER BEWEZEN WORDT, en waarom elk stuk ervan nodig is.

   1. DE EENHEID. Een route is een METHODE plus een PATROON. Dat was eerst een
      PAD onder /api/, en die twee versimpelingen kostten samen twintig routes
      die het cijfer niet kende: zeven pagina-routes (waaronder de bundelroutes
      die elke pagina van het huis dragen) en dertien methode/pad-paren die
      samenvielen met hun buurman -- op /api/scim/v2/Users/:id zette een toets
      op GET ook DELETE, PATCH en PUT op groen.

   2. DE POORT. Elke route die deze server NU registreert, staat in DEKKING.json
      als bewezen aangeraakt. Dit is de toets die "altijd 100%" waarmaakt: wie
      een route toevoegt zonder toets, ziet deze zakken -- in de gewone suite, en
      zonder dat er een norm bestaat om de eis mee te verlagen.

   3. HET SCHERM. Het kantoor rekent met dezelfde functie als de poort, achter
      dezelfde deur als de rest van het kantoor.

   DE MUTATIES (LAT.md regel 2), alle vier gedaan en alle vier zag ik de JUISTE
   toets zakken:
     - de HEAD-gelijkstelling uit kern/routedekking.js halen  -> toets 2 zakt
     - de ALL-tak eruit halen (dus stil overslaan)            -> toets 4 zakt
     - Math.floor terug naar Math.round                       -> toets 5 zakt
     - een route bij de app zetten zonder hem in DEKKING.json -> toets 6 zakt
   Toets 6 is de belangrijkste van de vier: die is de poort zelf. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const WORTEL = path.join(__dirname, '..');
const rd = require('../server/kern/routedekking');

/* ---------------------------------------------------------------------------
   1-5. DE REKENKANT. Geen server nodig, dus scherp en snel.
   --------------------------------------------------------------------------- */

test('een route is een METHODE plus een patroon: GET en POST op één pad zijn twee routes', () => {
  const kaart = [{ pad: '/api/pasprijzen', methoden: ['GET', 'POST'] }];
  const m = rd.meet(kaart, ['GET /api/pasprijzen']);
  assert.equal(m.totaal, 2, 'twee routes, niet één pad');
  assert.equal(m.geraakt, 1);
  assert.deepEqual(m.ongeraakt.map(r => r.methode + ' ' + r.pad), ['POST /api/pasprijzen'],
    'de POST is niet beproefd en hoort niet mee te liften op de GET');
  assert.equal(m.pct, 50);
});

test('HEAD komt langs de GET-laag en telt dus als de GET-route', () => {
  /* web/routing.js laat een HEAD-verzoek matchen op een GET-route, maar het
     journaal noteert req.method. Zonder de gelijkstelling telt dezelfde route
     twee keer verkeerd: als nooit aangeraakt EN als vreemd patroon. */
  const m = rd.meet([{ pad: '/scriptbundel.js', methoden: ['GET'] }], ['HEAD /scriptbundel.js']);
  assert.equal(m.nooitAangeraakt, 0, 'de GET-route is aangeraakt');
  assert.deepEqual(m.vreemd, [], 'en "HEAD /scriptbundel.js" is geen onbekend patroon');
});

test('een SCHERM-regel uit het journaal is geen route', () => {
  /* Hetzelfde journaal draagt ook paginabezoeken (server/routelog.js,
     noteerScherm). Die tellen hier niet mee -- ze hebben hun eigen meter -- en
     ze mogen al helemaal geen route dekken. */
  const m = rd.meet([{ pad: '/apps/index.html', methoden: ['GET'] }],
    ['SCHERM /apps/index.html deur.e2e.js navigatie']);
  assert.equal(m.nooitAangeraakt, 1, 'een schermbezoek dekt de route niet');
  assert.deepEqual(m.vreemd, [], 'en het is ook geen vreemd patroon');
});

test('een route zonder eigen methode (app.all) telt als NIET te meten, nooit als gedekt', () => {
  /* De valkuil: web/routing.js noteert een patroon alleen als de laag een
     methode draagt, dus een app.all()-route komt nooit in het journaal. Hem
     overslaan zou hem gratis groen geven -- en dat is de stilste manier om een
     route buiten elke meting te houden. */
  const m = rd.meet([{ pad: '/api/overal', methoden: ['ALL'] }], []);
  assert.equal(m.totaal, 0, 'hij staat niet als meetbare route in de telling');
  assert.deepEqual(m.onmeetbaar.map(r => r.pad), ['/api/overal']);
  assert.ok(m.gaten >= 1, 'maar hij is wel een GAT, dus de poort zakt erop');
});

test('het percentage rondt naar beneden af: 99 van 100 is geen 100%', () => {
  /* Een afgerond percentage dekte bij ruim tweeduizend routes tot een stuk of
     twaalf endpoints die nooit waren aangeraakt. Alleen echt alles geeft 100. */
  const kaart = [], geraakt = [];
  for (let i = 0; i < 1000; i++) {
    kaart.push({ pad: '/api/x' + i, methoden: ['POST'] });
    if (i) geraakt.push('POST /api/x' + i);
  }
  const m = rd.meet(kaart, geraakt);
  assert.equal(m.nooitAangeraakt, 1);
  assert.equal(m.pct, 99, 'één gat van duizend mag geen 100% heten');
  assert.equal(rd.meet(kaart, [...geraakt, 'POST /api/x0']).pct, 100, 'en alles is wél 100%');
});

/* ---------------------------------------------------------------------------
   6. DE POORT: ELKE ROUTE VAN NU STAAT IN HET BEWIJSSTUK.

   Dit is de toets die de eis handhaaft. Hij vraagt de routekaart aan de SERVER
   (scripts/routekaart.js start de app en leest app._routes() uit) en houdt die
   naast DEKKING.json. Een broncode-scanner kan dat niet: routes hangen hier op
   vier manieren, waarvan twee via een hulpje dat het pad zelf samenstelt.
   --------------------------------------------------------------------------- */

test('POORT: elke route die de server registreert staat in DEKKING.json als aangeraakt', () => {
  const bewijspad = path.join(WORTEL, 'DEKKING.json');
  assert.ok(fs.existsSync(bewijspad),
    'DEKKING.json ontbreekt. Zonder bewijsstuk is van geen enkele route bekend of hij beproefd is; ' +
    'dat is geen 100% en ook geen 0%, maar een ongemeten huis. Herstellen: npm run dekking:vast');
  const bewijs = JSON.parse(fs.readFileSync(bewijspad, 'utf8'));
  assert.ok(Array.isArray(bewijs.aangeraakt) && bewijs.aangeraakt.length > 100,
    'het bewijsstuk hoort de volle lijst aangeraakte routes te dragen (' +
    (bewijs.aangeraakt || []).length + ')');

  const kaart = JSON.parse(execFileSync(process.execPath,
    ['--experimental-sqlite', path.join(WORTEL, 'scripts', 'routekaart.js'), '--json'],
    { cwd: WORTEL, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, PORT: '', RTG_DATA_DIR: '' } }));
  assert.ok((kaart.routes || []).length > 1000, 'de routekaart geeft routes (' + (kaart.routes || []).length + ')');

  const m = rd.meet(kaart.routes, bewijs.aangeraakt);
  /* De lus over ongeraakt kan leeg zijn en bewijst dan niets; de bewering staat
     daarom op de TELLING, met de namen alleen in de melding (LAT.md regel 9). */
  const namen = m.ongeraakt.map(r => r.methode + ' ' + r.pad);
  assert.equal(m.gaten, 0,
    m.gaten + ' van de ' + m.totaal + ' routes zijn nooit door een toets aangeraakt of niet te meten:\n  ' +
    namen.slice(0, 25).join('\n  ') + (namen.length > 25 ? '\n  ... en nog ' + (namen.length - 25) : '') +
    (m.onmeetbaar.length ? '\n  niet te meten: ' + m.onmeetbaar.map(r => r.pad).join(', ') : '') +
    '\n\nSchrijf er een toets voor en leg de meting opnieuw vast (npm run dekking:vast). ' +
    'Er is geen norm om deze eis mee te verlagen.');
  assert.equal(m.pct, 100, 'de dekking is 100%');
  assert.equal(m.totaal, bewijs.gemeten.routesToen,
    'het bewijsstuk is van een andere routekaart dan de server nu heeft (' + bewijs.gemeten.routesToen +
    ' toen, ' + m.totaal + ' nu); leg de meting opnieuw vast met npm run dekking:vast');
  assert.deepEqual(m.vreemd, [],
    'het bewijsstuk noemt routes die de server niet meer registreert; het is dus ouder dan de code');
});

/* ---------------------------------------------------------------------------
   7-8. HET SCHERM VAN HET PERSONEEL.
   --------------------------------------------------------------------------- */

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-routedekking-'));

test.before(async () => {
  srv = await startServer({ env: { RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-DEKKING-1' } });
  base = srv.base;
  token = await kantoorAlsPersoon(base);
  assert.ok(token, 'het kantoor logt in');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const vraag = (body, mee) => fetch(base + '/api/office/routedekking', {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' },
    mee === false ? {} : { Authorization: 'Bearer ' + token }),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('de routedekking zit achter de kantoordeur', async () => {
  assert.equal((await vraag({}, false)).status, 401, 'zonder kantoorsessie blijft de deur dicht');
  assert.equal((await vraag({})).status, 200, 'met kantoorsessie gaat hij open');
});

test('het kantoor ziet de volle stand, en kan er doorheen zoeken', async () => {
  const d = (await vraag({ limiet: 10 })).body;
  assert.equal(d.eis, 100, 'de eis staat op het scherm en is niet onderhandelbaar');
  assert.equal(d.stand, 'in orde',
    'de stand is "' + d.stand + '": ' + d.ongedekt + ' van ' + d.totaal + ' routes ongedekt' +
    (d.verdwenenSindsMeting.length ? ', ' + d.verdwenenSindsMeting.length + ' verdwenen sinds de meting' : ''));
  assert.equal(d.ongedekt, 0);
  assert.equal(d.pct, 100);
  assert.ok(d.totaal > 1000, 'alle routes van het huis, niet alleen /api/ (' + d.totaal + ')');
  assert.ok(d.gemeten && d.gemeten.op, 'het scherm zegt WANNEER er gemeten is');

  /* De pagina-routes horen erbij te staan. Dat is de hele reden dat deze meting
     is verbreed, dus is het hier een bewering en geen aanname. */
  assert.ok(d.perDomein.some(x => x.domein === 'pagina' && x.totaal >= 5),
    'ook de routes buiten /api/ staan in de telling: ' + JSON.stringify(d.perDomein.map(x => x.domein)));

  // doorbladeren
  assert.equal(d.lijst.resultaten.length, 10, 'een pagina van tien');
  assert.equal(d.lijst.totaal, d.totaal);
  assert.ok(d.lijst.paginas > 1);
  const twee = (await vraag({ limiet: 10, pagina: 2 })).body;
  assert.notDeepEqual(twee.lijst.resultaten, d.lijst.resultaten, 'pagina 2 is een andere pagina');

  // zoeken, en het eigen scherm moet zichzelf kunnen vinden
  const zoek = (await vraag({ zoek: 'routedekking' })).body;
  assert.ok(zoek.lijst.resultaten.some(r => r.pad === '/api/office/routedekking' && r.gedekt),
    'de dekkingsroute vindt zichzelf, en is zelf beproefd');

  // filteren op de gaten: bij 100% is dat met opzet een lege lijst
  const gaten = (await vraag({ alleenGaten: true })).body;
  assert.equal(gaten.lijst.totaal, 0, 'geen enkele route zonder toets');
  // en het filter WERKT, ook al is de uitkomst leeg: op een domein levert het wel iets
  const domein = (await vraag({ domein: 'office', limiet: 250 })).body;
  assert.ok(domein.lijst.totaal > 0 && domein.lijst.totaal < d.totaal, 'het domeinfilter knipt echt');
  assert.ok(domein.lijst.resultaten.every(r => r.pad.startsWith('/api/office/') || r.pad === '/api/office'),
    'en levert alleen office-routes');
});
