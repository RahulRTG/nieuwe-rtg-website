/* DE SPELWERELD -- de echte software op spelgegevens, en de grens eromheen.

   VERHAAL.md stap 3. Acht beweringen, en ze zijn alle acht stil terug te
   draaien:

   1. EEN WERELD KOMT UIT DE ZAAISET en nooit uit de productiedatabase.
   2. WAT ER IN EEN WERELD GEBEURT, LANDT IN HET VAK. Gemeten met de ECHTE
      concern-motor en niet met een verzonnen schrijfactie.
   3. EEN WERELD KAN PRODUCTIE NIET LEZEN -- niet omdat er gefilterd wordt maar
      omdat het object dat hij ziet die collecties niet heeft.
   4. DE KANALEN NAAR BUITEN ZIJN AFWEZIG, NIET UITGESCHAKELD. Een spelhandeling
      laat geen echte bel rinkelen.
   5. EN HIJ GOOIT, HIJ ZWIJGT NIET -- undefined is de gevaarlijkste uitkomst.
   6. DE DOORKIJK IS EEN PROXY EN GEEN KOPIE, want de kern doet late binding.
   7. EEN WERELD VERVALT. Een rij oude werelden is een rij die niemand vertrouwt.
   8. ER IS EEN DAK op het aantal.

   Draai los: node --experimental-sqlite --test test/spelwereld.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const maakSpelwereld = require('../server/kern/spelwereld');
const seed = require('../server/seed');

/* Een productiedatabase met iets herkenbaars erin, zodat "komt dit uit
   productie" een echte vraag is en geen aanname. */
function opstelling(zaai) {
  const db = { data: { suppliers: [{ code: 'ECHT-1', name: 'Een echte zaak' }],
    users: [{ id: 1, email: 'iemand@echt.nl' }], geheimeSleutels: ['nooit-in-een-spel'] } };
  let bewaard = 0;
  const W = maakSpelwereld({ db, save: () => { bewaard++; }, zaai: zaai || seed });
  return { db, W, bewaard: () => bewaard };
}

/* ================= 1. uit de zaaiset ================= */

test('een wereld komt uit de zaaiset en nooit uit de productiedatabase', () => {
  /* Zou een wereld "de echte gegevens, maar dan een kopie" zijn, dan staan er
     persoonsgegevens in een omgeving waar mensen juist dingen mogen proberen --
     en dan is de spelwereld zelf het datalek. Woordelijk de redenering van
     ../server/kern/command/zandbak.js. */
  const { db, W } = opstelling();
  W.maak('p1', { door: 'anna' });
  const v = W.venster('p1');
  const alles = JSON.stringify(v.data);
  assert.ok(!alles.includes('ECHT-1'), 'geen productiezaak in de wereld');
  assert.ok(!alles.includes('iemand@echt.nl'), 'geen productiegebruiker in de wereld');
  assert.ok(!alles.includes('nooit-in-een-spel'), 'geen productiesleutel in de wereld');
  // en hij is niet leeg: er staat wel degelijk oefenmateriaal in
  assert.ok(Array.isArray(v.data.suppliers) && v.data.suppliers.length > 0,
    'een lege wereld is geen oefenruimte');
  assert.notEqual(v.data.suppliers[0].code, 'ECHT-1');
});

test('twee werelden delen niets met elkaar', () => {
  /* DEZE TOETS VOND EEN ECHTE FOUT, en niet in deze laag. `seed()` gaf een nieuw
     TOPobject maar deelde negentien collecties eronder -- suppliers, posts, dms
     -- want `maakVolledigeSeed()` bouwt met `Object.assign({}, require(...))` en
     een module-export is gecached. Twee werelden waren daarmee EEN wereld.

     En het brak de belofte in de kop van kern/command/zandbak.js: `zaai()` gaf
     een zandbak dezelfde arrays die db.data gebruikt zodra het proces vers uit
     de zaaiset is opgestart. Zie de uitleg in ../server/seed/index.js. */
  const { W } = opstelling();
  W.maak('p1', {}); W.maak('p2', {});
  const a = W.venster('p1'), b = W.venster('p2');
  assert.notEqual(a.data, b.data);
  a.data.suppliers.push({ code: 'ALLEEN-IN-P1' });
  assert.ok(!JSON.stringify(b.data).includes('ALLEEN-IN-P1'),
    'wat in de ene wereld gebeurt, hoort niet in de andere te staan');
});

test('de zaaiset geeft elke aanroep een eigen exemplaar', () => {
  /* De reparatie op zijn eigen plek getoetst, want hij geldt voor IEDERE
     aanroeper -- de zandbak net zo goed als de spelwereld, en db.data bij het
     opstarten. Zet de kopie weg en deze toets zakt, samen met die hierboven. */
  const a = seed(), b = seed();
  const gedeeld = Object.keys(a).filter(k => a[k] && typeof a[k] === 'object' && a[k] === b[k]);
  assert.deepEqual(gedeeld, [], 'geen enkele collectie hoort gedeeld te zijn');
  a.suppliers.push({ code: 'UIT-DE-EERSTE' });
  assert.ok(!JSON.stringify(b.suppliers).includes('UIT-DE-EERSTE'));
  // en de inhoud is er nog: een kopie die leeg is, is geen kopie
  assert.ok(b.suppliers.length > 0 && Object.keys(b).length > 15);
});

test('een zandbak schrijft niet in een productiecollectie', () => {
  /* De belofte uit de kop van kern/command/zandbak.js, nu voor het eerst
     gemeten. Op een vers opgestart proces is `db.data` letterlijk `seed()`, dus
     als `zaai()` dezelfde arrays teruggaf, zette een zandbak zijn zaken in de
     ledencatalogus van productie. */
  const productie = seed();          // zoals db/index.js doet bij een verse start
  const zandbak = seed();            // zoals kern/command/zandbak.js doet per zandbak
  assert.notEqual(zandbak.suppliers, productie.suppliers);
  const voor = productie.suppliers.length;
  zandbak.suppliers.push({ code: 'GEMAAKT-IN-DE-ZANDBAK' });
  assert.equal(productie.suppliers.length, voor, 'productie is niet gegroeid');
  assert.ok(!JSON.stringify(productie).includes('GEMAAKT-IN-DE-ZANDBAK'));
});

/* ================= 2 en 3. wat er in een wereld gebeurt ================= */

test('de ECHTE concern-motor draait op een wereld, en schrijft alleen daar', () => {
  /* DE PROEF WAAR DEZE HELE LAAG OM DRAAIT. Niet een verzonnen schrijfactie maar
     kern/concern -- dezelfde motor die achter /apps/concern.html hangt --
     samengesteld op het venster van een wereld. Als dit werkt, werken de
     schermen ook, want de routes zijn dun over de kern. */
  const { db, W } = opstelling();
  W.maak('p1', {});
  const v = W.venster('p1');
  const concern = require('../server/kern/concern')({ db: v, save() {}, crypto: require('crypto'),
    schoon: (x) => String(x || ''), findSupplier: () => null, ondernemingVind: () => null });
  assert.ok(Object.keys(concern).length > 50, 'de hele motor komt mee');
  const r = concern.entiteitNieuw('anna', { naam: 'Zeezicht Horeca BV', rechtsvorm: 'bv', land: 'NL' });
  assert.ok(r.entiteit && r.entiteit.naam === 'Zeezicht Horeca BV', JSON.stringify(r));
  // hij staat in het VAK
  assert.ok(JSON.stringify(v.data).includes('Zeezicht Horeca BV'));
  // en de productiecollecties zijn ongemoeid: er is er geen enkele bij gekomen
  assert.deepEqual(Object.keys(db.data).sort(),
    ['geheimeSleutels', 'spelwerelden', 'suppliers', 'users'],
    'productie kreeg er een collectie bij');
  assert.equal(db.data.concern, undefined, 'de concern-collectie hoort nergens in productie te staan');
  assert.equal(db.data.suppliers.length, 1, 'en de echte zaken zijn niet aangeraakt');
});

test('een wereld kan de productiecollecties niet eens ZIEN', () => {
  /* Niet omdat er gefilterd wordt maar omdat het object dat hij ziet ze niet
     heeft. Dat is het verschil tussen een grens en een gewoonte. */
  const { db, W } = opstelling();
  W.maak('p1', {});
  const v = W.venster('p1');
  assert.equal(v.data.users, undefined, 'de wereld ziet geen gebruikers');
  assert.equal(v.data.geheimeSleutels, undefined);
  assert.notEqual(v.data, db.data);
  // en er is maar EEN veld op het venster: daar zit alle scheiding in
  assert.deepEqual(Object.keys(v), ['data']);
});

/* ================= 4 en 5. de kanalen naar buiten ================= */

test('een spelhandeling laat geen echte bel rinkelen', () => {
  /* routes/member/werk.js vraagt eenentwintig namen uit de kern, en zes daarvan
     gaan naar buiten. Wie in een spelwereld een sollicitatie afwijst, hoort geen
     melding te sturen naar een echte leverancier. */
  const { db, W } = opstelling();
  W.maak('p1', {});
  let gepiept = 0;
  const kern = { db, save() {}, accounts: 'echt', ondernemingVind: () => 'gewoon',
    sseToOffice: () => { gepiept++; }, sseToSupplier: () => { gepiept++; },
    notifySupplier: () => { gepiept++; }, meldWerkgever: () => { gepiept++; },
    chatStuur: () => { gepiept++; }, commWerk: {}, anthropic: {}, nudge: () => { gepiept++; },
    mailStuur: () => { gepiept++; }, pushNaar: () => { gepiept++; } };
  const wk = W.kernVoor(kern, 'p1');
  for (const naam of ['sseToOffice', 'sseToSupplier', 'notifySupplier', 'meldWerkgever',
    'chatStuur', 'commWerk', 'anthropic', 'nudge', 'mailStuur', 'pushNaar']) {
    assert.throws(() => wk[naam], (e) => e.spelwereld && e.spelwereld.naam === naam,
      naam + ' hoort er niet doorheen te komen');
  }
  assert.equal(gepiept, 0, 'er is niets afgegaan');
  // en de gewone namen komen er gewoon door
  assert.equal(wk.ondernemingVind(), 'gewoon');
  assert.equal(wk.accounts, 'echt');
});

test('de grens gooit, hij zwijgt niet -- en noemt de naam', () => {
  /* Undefined is de gevaarlijkste uitkomst: `motor && motor.doeIets()` slaat er
     stil overheen en de route antwoordt vriendelijk het verkeerde. Dezelfde les
     als in ../server/opzet/domeingrens.js, daar met achttien zakkende toetsen
     betaald. */
  const { db, W } = opstelling();
  W.maak('p1', {});
  const wk = W.kernVoor({ db, sseToOffice: () => 'piep' }, 'p1');
  let fout = null;
  try { wk.sseToOffice; } catch (e) { fout = e; }
  assert.ok(fout, 'hij geeft geen undefined terug');
  assert.match(fout.message, /sseToOffice/);
  assert.match(fout.message, /p1/);
  assert.match(fout.message, /naar buiten/);
});

test('een naam die niet in de kern zit, is geen overtreding maar een typefout', () => {
  const { db, W } = opstelling();
  W.maak('p1', {});
  const wk = W.kernVoor({ db }, 'p1');
  assert.equal(wk.bestaatHelemaalNiet, undefined, 'geen vals alarm op iets dat er niet is');
  assert.equal(wk.notifyIetsDatNietBestaat, undefined,
    'ook niet als hij toevallig op een verboden voorvoegsel lijkt');
});

test('de lijst is een voorvoegsellijst, zodat een nieuw kanaal er vanzelf in valt', () => {
  /* Anders is de grens compleet op de dag dat hij geschreven werd en daarna
     niet meer. */
  const { db, W } = opstelling();
  W.maak('p1', {});
  const wk = W.kernVoor({ db, notifyEenNieuwDing: () => 1, sseToIetsNieuws: () => 1 }, 'p1');
  assert.throws(() => wk.notifyEenNieuwDing);
  assert.throws(() => wk.sseToIetsNieuws);
});

/* ================= 6. een proxy en geen kopie ================= */

test('de doorkijk leest elke keer opnieuw, want de kern doet late binding', () => {
  /* Een kopie op mountmoment bevriest de kern en levert undefined voor alles wat
     er later bij komt -- precies de stille breuk waar ../server/opzet/
     domeingrens.js zijn Proxy voor heeft. */
  const { db, W } = opstelling();
  W.maak('p1', {});
  const kern = { db, eerste: 1 };
  const wk = W.kernVoor(kern, 'p1');
  assert.equal(wk.eerste, 1);
  kern.laterOpgehangen = () => 'ook ik';
  assert.equal(wk.laterOpgehangen(), 'ook ik', 'wat er later bij komt, is er ook');
  // en de db blijft het venster, ook na een verbouwing van de kern
  assert.equal(wk.db.data, W.venster('p1').data);
  assert.notEqual(wk.db, db);
});

test('een wereld die niet bestaat geeft geen kern', () => {
  const { db, W } = opstelling();
  assert.equal(W.kernVoor({ db }, 'bestaat-niet'), null);
  assert.equal(W.venster('bestaat-niet'), null);
});

/* ================= 7 en 8. eindig ================= */

test('een wereld vervalt, en opruimen haalt hem echt weg', () => {
  const db = { data: {} };
  let klok = Date.parse('2026-01-01T00:00:00Z');
  const W = maakSpelwereld({ db, save() {}, zaai: seed, nu: () => klok });
  W.maak('kort', { dagen: 1 });
  W.maak('lang', { dagen: 30 });
  assert.equal(W.veeg().length, 0, 'niets vervalt op dag nul');
  klok += 2 * 86400000;
  assert.deepEqual(W.veeg(), ['kort']);
  assert.equal(W.venster('kort'), null);
  assert.ok(W.venster('lang'), 'en de andere staat er nog');
});

test('er is een dak op het aantal werelden', () => {
  const { W } = opstelling();
  for (let i = 0; i < maakSpelwereld.MAX_WERELDEN; i++) assert.ok(W.maak('w' + i, {}).ok, 'w' + i);
  const over = W.maak('een-te-veel', {});
  assert.equal(over.status, 409);
  assert.match(over.error, /Ruim er een op/);
});

test('een wereld maken, vinden en weghalen bewaart telkens', () => {
  const { W, bewaard } = opstelling();
  assert.equal(bewaard(), 0);
  W.maak('p1', {});
  assert.equal(bewaard(), 1, 'maken bewaart');
  assert.equal(W.lijst().length, 1);
  assert.equal(W.maak('p1', {}).status, 409, 'dezelfde naam twee keer kan niet');
  assert.ok(W.weg('p1').ok);
  assert.equal(bewaard(), 2, 'weghalen bewaart');
  assert.equal(W.weg('p1').status, 404);
});

test('de kaart van een wereld zegt wat hij is, en verklapt zijn inhoud niet', () => {
  const { W } = opstelling();
  const r = W.maak('p1', { door: 'anna', waarvoor: 'magnaat', potje: 'pot-7' });
  assert.equal(r.wereld.door, 'anna');
  assert.equal(r.wereld.potje, 'pot-7');
  assert.ok(/spelwereld/i.test(r.wereld.uitleg), 'een scherm hoort te kunnen zeggen waar je bent');
  assert.equal(r.wereld.data, undefined, 'de kaart draagt de gegevens niet mee');
});

/* ================= DE MOUNT: dezelfde routes, op een ander vak ================= */

const web = require('../server/web');
const maakMount = require('../server/kern/spelwereld-mount');

function metMount() {
  const db = { data: { suppliers: [{ code: 'ECHT-1' }], users: [{ id: 1 }] } };
  const W = maakSpelwereld({ db, save() {}, zaai: seed });
  const kern = { db, save() {}, crypto: require('crypto'), schoon: (x) => String(x || ''),
    auth: (req, res, next) => next(), accounts: {} };
  const M = maakMount({ spelwereld: W, kern, Router: web.Router, log() {} });
  return { db, W, kern, M };
}
/* Een verzoek nabootsen zonder een server te starten: de handler is een gewone
   functie van (req, res, next). Zo blijft deze toets meten wat hij zegt te
   meten -- de dispatcher -- en niet of een poort vrij was. */
const nepVerzoek = (url) => ({ url, method: 'POST', headers: {} });
function nepAntwoord() {
  const uit = { code: 200, body: null };
  return { status(c) { uit.code = c; return this; }, json(b) { uit.body = b; return this; }, uit };
}

test('een onbekende wereld geeft 404 en bouwt niets', () => {
  const { M } = metMount();
  const res = nepAntwoord();
  M.handler(nepVerzoek('/bestaat-niet/api/concern/overzicht'), res, () => {});
  assert.equal(res.uit.code, 404);
  assert.equal(M.aantalGebouwd(), 0, 'er is geen router voor een wereld die er niet is');
});

test('zonder wereld-id in het pad komt er niets door', () => {
  const { M } = metMount();
  const res = nepAntwoord();
  M.handler(nepVerzoek('/'), res, () => {});
  assert.equal(res.uit.code, 404);
  assert.match(res.uit.body.error, /Geen spelwereld/);
});

test('een bestaande wereld krijgt een router, en maar een keer', () => {
  const { W, M } = metMount();
  W.maak('p1', {});
  let doorgelaten = 0;
  const req = nepVerzoek('/p1/api/concern/overzicht');
  M.handler(req, nepAntwoord(), () => { doorgelaten++; });
  assert.equal(M.aantalGebouwd(), 1);
  /* HET PAD IS GEKNIPT. Zonder deze regel komt de subrouter een pad binnen dat
     hij niet kent, en dan valt elk verzoek stil door naar de 404 van de site --
     met een router die er wel is. */
  assert.equal(req.url, '/api/concern/overzicht');
  assert.equal(req.spelwereld, 'p1', 'een route mag weten waar hij draait');
  M.handler(nepVerzoek('/p1/api/concern/overzicht'), nepAntwoord(), () => {});
  assert.equal(M.aantalGebouwd(), 1, 'de tweede keer wordt hij niet opnieuw gebouwd');
});

test('de query blijft aan het pad hangen', () => {
  const { W, M } = metMount();
  W.maak('p1', {});
  const req = nepVerzoek('/p1/api/concern/overzicht?ding=1&ander=2');
  M.handler(req, nepAntwoord(), () => {});
  assert.equal(req.url, '/api/concern/overzicht?ding=1&ander=2');
});

test('de MOTOREN van een wereld schrijven in het vak en niet in productie', () => {
  /* DE HELFT VAN DE GRENS DIE HET MAKKELIJKST WORDT VERGETEN. Een `db`
     verwisselen is niet genoeg: de kern draagt AL GEBOUWDE functies die de
     productiedatabase in hun closure hebben. Wie alleen db vervangt, krijgt een
     wereld waarin het scherm naar het vak kijkt en de motor naar productie
     schrijft. */
  const { db, W, kern, M } = metMount();
  W.maak('p1', {});
  const v = W.venster('p1');
  const wk = W.kernVoor(kern, 'p1', M.motorenVoor(v));
  const r = wk.entiteitNieuw('anna', { naam: 'Wereld BV', rechtsvorm: 'bv', land: 'NL' });
  assert.ok(r.entiteit && r.entiteit.naam === 'Wereld BV', JSON.stringify(r));
  assert.ok(JSON.stringify(v.data).includes('Wereld BV'), 'hij staat in het vak');
  assert.equal(db.data.concern, undefined, 'en nergens in productie');
  assert.deepEqual(Object.keys(db.data).sort(), ['spelwerelden', 'suppliers', 'users']);
});

test('een wereld die weg is, raakt ook zijn router kwijt', () => {
  const { W, M } = metMount();
  W.maak('p1', {});
  M.handler(nepVerzoek('/p1/api/concern/overzicht'), nepAntwoord(), () => {});
  assert.equal(M.aantalGebouwd(), 1);
  W.weg('p1');
  M.vergeet('p1');
  assert.equal(M.aantalGebouwd(), 0);
  const res = nepAntwoord();
  M.handler(nepVerzoek('/p1/api/concern/overzicht'), res, () => {});
  assert.equal(res.uit.code, 404, 'een verwijderde wereld blijft niet bereikbaar');
});

test('een route die naar buiten reikt, valt om met de naam erin', () => {
  /* DIT IS EEN BEVINDING EN GEEN GEBREK, en hij hoort vast te staan.
     routes/member/werk.js knelt op `chatStuur`, en terecht: die stuurt live
     seintjes naar echte schermen en `meldWerkgever` een echte pushmelding. Zo
     lang die kanalen niet wereld-lokaal zijn, hoort dat scherm hier niet.
     Zwijgend overslaan zou een wereld opleveren waarin sommige knoppen niets
     doen -- precies wat de gooiende grens moest voorkomen. */
  const { W, kern } = metMount();
  W.maak('p1', {});
  const wk = W.kernVoor(kern, 'p1', { app: web.Router() });
  Object.assign(kern, { talen: {}, LANDEN: [], openVacatures: () => [], findSupplier: () => null,
    cvReady: () => true, leeftijdVan: () => 30, geborenVan: () => null, PERSONAS: {},
    automatisering: null, applyChatVertaald: async (c) => c, chatStuur: () => null,
    meldWerkgever: () => null, notifySupplier: () => null, sseToSupplier: () => null,
    sseToOffice: () => null, commWerk: null });
  assert.throws(() => require('../server/routes/member/werk')(wk),
    (e) => e.spelwereld && ['chatStuur', 'commWerk', 'meldWerkgever'].includes(e.spelwereld.naam),
    'hij hoort te knellen, en te zeggen waarop');
});

/* ================= HET BASISADRES VAN EEN PAGINA ================= */

/* De schermkant, in Node gedraaid met een nagebootste browser. Dit is de plek
   waar een fout STIL naar productie zou schrijven -- een gemiste aanroep gaat
   gewoon naar /api/... en niemand merkt het -- dus hij hoort onder toets. */
function inBrowser(pad) {
  const bron = require('fs').readFileSync(
    require.resolve('../public/shared/spelwereld.js'), 'utf8');
  const gevraagd = [];
  const doc = { documentElement: { kenmerk: {}, setAttribute(k, v) { this.kenmerk[k] = v; } } };
  const win = {
    location: { pathname: pad, origin: 'https://rtg.test' },
    fetch: (u, o) => { gevraagd.push(typeof u === 'string' ? u : u.url); return Promise.resolve({ u, o }); },
    Request: function (url, init) { return { url, init }; }
  };
  const fn = new Function('window', 'location', 'document', 'Request', bron);
  fn(win, win.location, doc, win.Request);
  return { win, doc, gevraagd, fetch: (u, o) => win.fetch(u, o) };
}

test('buiten een spelwereld verandert er helemaal niets', () => {
  const b = inBrowser('/apps/personeel.html');
  b.fetch('/api/concern/overzicht');
  assert.deepEqual(b.gevraagd, ['/api/concern/overzicht'], 'geen omleiding op een gewone pagina');
  assert.equal(b.win.RTG_SPELWERELD, undefined);
  assert.equal(b.doc.documentElement.kenmerk['data-spelwereld'], undefined);
});

test('in een spelwereld gaat alleen de lijn om, niet de pagina', () => {
  const b = inBrowser('/spelwereld/p1/apps/personeel.html');
  b.fetch('/api/concern/overzicht');
  b.fetch('/apps/personeel.js');       // een script hoort gewoon van de site te komen
  b.fetch('/fonts/inter.woff2');       // een spelwereld heeft geen eigen lettertypen
  b.fetch('https://elders.test/x');    // en een absolute URL blijft absoluut
  assert.deepEqual(b.gevraagd, [
    '/spelwereld/p1/api/concern/overzicht',
    '/apps/personeel.js',
    '/fonts/inter.woff2',
    'https://elders.test/x'
  ]);
});

test('de pagina weet waar ze is, en het staat op de wortel', () => {
  const b = inBrowser('/spelwereld/oefen-1/apps/concern.html');
  assert.equal(b.win.RTG_SPELWERELD.id, 'oefen-1');
  assert.equal(b.win.RTG_SPELWERELD.basis, '/spelwereld/oefen-1');
  assert.equal(b.doc.documentElement.kenmerk['data-spelwereld'], 'oefen-1',
    'een oefenruimte die eruitziet als het echte werk is een valstrik');
});

test('ook een Request-object wordt verlegd', () => {
  /* Zonder deze tak zou een pagina die Request gebruikt STIL op productie
     uitkomen, en stil is precies wat hier niet mag. */
  const b = inBrowser('/spelwereld/p1/apps/x.html');
  b.fetch(new b.win.Request('https://rtg.test/api/concern/overzicht', { method: 'POST' }));
  assert.deepEqual(b.gevraagd, ['/spelwereld/p1/api/concern/overzicht']);
});

test('een verzoek DOOR de mount leest de wereld en niet productie', () => {
  /* DE PROEF DIE HET GEHEEL SLUIT, en hij kwam er na een mutatie die bleef
     staan: de eerdere toets riep `motorenVoor` rechtstreeks aan, dus hij bleef
     groen toen die stap uit `bouw` werd gehaald. Nu loopt hij door de handler,
     langs de router, tot in de route -- precies de weg die een browser aflegt.

     De opzet is een tegenproef: de entiteit staat ALLEEN in het vak. Kijkt de
     route naar productie, dan komt hij met lege handen terug. */
  const { db, W, kern, M } = metMount();
  W.maak('p1', {});
  const v = W.venster('p1');
  const motoren = M.motorenVoor(v);
  motoren.entiteitNieuw('anna', { naam: 'Alleen In De Wereld BV', rechtsvorm: 'bv', land: 'NL' });
  assert.equal(db.data.concern, undefined, 'de opzet zelf raakt productie niet');

  const vraag = (wereld) => {
    const req = Object.assign(nepVerzoek('/' + wereld + '/api/concern/overzicht'),
      { session: { key: 'anna' }, body: {} });
    const res = nepAntwoord();
    M.handler(req, res, () => {});
    return res.uit.body || {};
  };
  const tel = (b) => ((b && b.telling) || {}).entiteiten || 0;
  const gezien = vraag('p1');
  assert.equal(tel(gezien), 1,
    'de route hoort de entiteit van de WERELD te zien: ' + JSON.stringify(gezien).slice(0, 200));

  /* DE TEGENPROEF, want een toets die alleen "hij ziet er een" zegt, blijft ook
     groen als hij er overal een ziet. Een TWEEDE wereld hoort er nul te hebben,
     want daar is niets aangemaakt -- en dat is meteen het bewijs dat twee
     werelden elkaar niet lezen. */
  W.maak('p2', {});
  assert.equal(tel(vraag('p2')), 0, 'een andere wereld ziet hem niet');
  assert.equal(db.data.concern, undefined, 'en productie nog steeds niet');
});

/* ================= DE VIER VEILIGHEIDSVRAGEN =================

   Vier dingen die absoluut vast moeten staan voordat een spelwereld veilig
   heet. Ze staan hier bij elkaar en niet verspreid, want ze horen als GROEP
   gesteld te worden: wie er een weghaalt, hoort te zien dat de rij niet meer
   compleet is. */

const kaal = (data) => {
  const k = JSON.parse(JSON.stringify(data));
  delete k.spelwerelden;                 // de werelden zelf horen in productie te staan
  return JSON.stringify(k);
};

test('1. wereld A en wereld B delen geen enkele veranderbare toestand', () => {
  /* Niet alleen hun gegevens maar ook hun TELLERS. Een module-level teller of
     cache in een motor is precies het soort gedeelde toestand dat je niet ziet
     aan de data: hij verraadt zich doordat de tweede wereld verder telt waar de
     eerste ophield. Dus krijgen beide werelden dezelfde handeling, en de
     uitkomsten horen identiek te zijn -- niet opeenvolgend. */
  const { W, kern, M } = metMount();
  W.maak('a', {}); W.maak('b', {});
  const motorA = M.motorenVoor(W.venster('a'));
  const motorB = M.motorenVoor(W.venster('b'));
  const inA = motorA.entiteitNieuw('anna', { naam: 'Alleen In A BV', rechtsvorm: 'bv', land: 'NL' });
  const inB = motorB.entiteitNieuw('anna', { naam: 'Alleen In B BV', rechtsvorm: 'bv', land: 'NL' });
  assert.ok(inA.entiteit && inB.entiteit);

  /* DE SONDE VOOR EEN GEDEELDE CACHE, en hij is scherper dan een vergelijking
     van de gegevens: een module-level geheugen in een motor verraadt zich niet
     in het vak maar in het OPZOEKEN. Kan B iets van A vinden, dan is er ergens
     een object dat beide werelden delen -- ook al staat het in geen van beide
     vakken. Dus wordt er over en weer gezocht, en beide keren hoort het
     antwoord leeg te zijn.

     (Een eerdere versie van deze toets vergeleek de eerste id van A en B, in de
     verwachting dat een gedeelde teller zich zou verraden. Dat mat niets: deze
     motor geeft willekeurige ids. Een toets die niet kan zakken is geen toets.) */
  const vindInB = motorB.entiteitVind ? motorB.entiteitVind(inA.entiteit.id) : undefined;
  const vindInA = motorA.entiteitVind ? motorA.entiteitVind(inB.entiteit.id) : undefined;
  assert.ok(!vindInB, 'B vindt de entiteit van A: er is gedeelde toestand');
  assert.ok(!vindInA, 'A vindt de entiteit van B: er is gedeelde toestand');
  assert.ok(motorA.entiteitVind(inA.entiteit.id), 'en in de eigen wereld wordt hij wel gevonden');

  /* En de tegenproef op de gegevens: druk werk in A laat B letterlijk
     ongemoeid, tot op de byte. */
  const bVoor = JSON.stringify(W.venster('b').data);
  for (let i = 0; i < 25; i++)
    motorA.entiteitNieuw('anna', { naam: 'Nummer ' + i + ' BV', rechtsvorm: 'bv', land: 'NL' });
  assert.equal(JSON.stringify(W.venster('b').data), bVoor, 'B is niet veranderd');
  assert.ok(JSON.stringify(W.venster('a').data).includes('Nummer 24 BV'));
});

test('2. geen enkele mutatie in een wereld raakt de productiegegevens', () => {
  /* Uitputtend en niet steekproefsgewijs: de HELE productiedatabase gaat op de
     foto (minus de werelden zelf, die er per definitie in staan), er wordt in
     de wereld flink gewerkt, en daarna moet de foto byte voor byte gelijk zijn.
     Zo vangt hij ook een lek dat geen nieuwe collectie maakt maar een
     bestaande rij aanpast -- precies het soort lek dat de gedeelde zaaiset had. */
  const { db, W, kern, M } = metMount();
  db.data.posts = [{ id: 'p', tekst: 'een echte post' }];
  db.data.invoices = [{ id: 'f1', bedrag: 100 }];
  W.maak('p1', {});
  const voor = kaal(db.data);
  const v = W.venster('p1');
  const motoren = M.motorenVoor(v);
  const wk = W.kernVoor(kern, 'p1', motoren);
  const e = motoren.entiteitNieuw('anna', { naam: 'Drukke BV', rechtsvorm: 'bv', land: 'NL' });
  motoren.vestigingNieuw('anna', { entiteit: e.entiteit.id, naam: 'Filiaal', plaats: 'IJmuiden' });
  for (let i = 0; i < 10; i++)
    motoren.entiteitNieuw('anna', { naam: 'Nog een ' + i, rechtsvorm: 'bv', land: 'NL' });
  const req = Object.assign(nepVerzoek('/p1/api/concern/overzicht'), { session: { key: 'anna' }, body: {} });
  M.handler(req, nepAntwoord(), () => {});
  assert.equal(kaal(db.data), voor, 'de productiegegevens zijn tot op de byte gelijk gebleven');
  assert.ok(JSON.stringify(v.data).includes('Drukke BV'), 'en er is wel degelijk gewerkt');
  assert.ok(wk.db.data === v.data);
});

test('3. mail, betalen, boeken, reserveren en push zijn onmogelijk', () => {
  /* De eerste lijst dekte het RINKELEN af en niet het BETALEN, en dat is de
     duurdere helft: een spelhandeling die een betaalprovider aanroept of een
     tafel reserveert, doet iets in de echte wereld dat niet terug te draaien is.
     CLAUDE.md zegt het ook: nooit claimen dat een boeking verwerkt is -- hier
     kan het niet eens. De namen hieronder komen uit GRENZEN.json en zijn dus de
     ECHTE kern-namen, niet verzonnen. */
  const { db, W } = metMount();
  W.maak('p1', {});
  let gebeurd = 0;
  const tik = () => { gebeurd++; return 'gedaan'; };
  const kern = { db, save() {},
    // geld
    betaal: tik, betaalSplits: tik, betaalBoekingVoor: tik, betaalRitVoor: tik,
    pay: tik, payVan: tik, munten: tik, muntbetaal: tik,
    // verplichtingen in de echte wereld
    boeken: tik, boekingMetRef: tik, boekingenVoegToe: tik,
    reserveerTafel: tik, reserveerSlot: tik, reserveringKomst: tik,
    // een mens bereiken
    mailQ: tik, mailIn: tik, notifySupplier: tik, notifyApplicant: tik,
    pushLive: tik, sseToCustomer: tik, meldMisbruik: tik, nudge: tik,
    // en de AI, want die praat met de buitenwereld
    anthropic: tik, gemini: tik };
  const wk = W.kernVoor(kern, 'p1');
  const namen = Object.keys(kern).filter(n => n !== 'db' && n !== 'save');
  assert.ok(namen.length >= 22, 'de lijst is breed genoeg om iets te betekenen');
  for (const naam of namen)
    assert.throws(() => wk[naam], (e) => e.spelwereld && e.spelwereld.naam === naam,
      naam + ' hoort onbereikbaar te zijn vanuit een spelwereld');
  assert.equal(gebeurd, 0, 'er is niets afgegaan, niet een keer');
});

test('3b. een wereld-lokale vervanger mag een geblokkeerde naam bezetten', () => {
  /* De grens is geen verbod maar een richting: naar buiten mag niet, wereld-
     lokaal wel. Anders is de enige oplossing voor een knellende route "de grens
     verzwakken", en dat is precies hoe grenzen sneuvelen. */
  const { db, W } = metMount();
  W.maak('p1', {});
  let inDeWereld = 0;
  const wk = W.kernVoor({ db, notifySupplier: () => { throw new Error('echt'); } }, 'p1',
    { notifySupplier: () => { inDeWereld++; } });
  wk.notifySupplier();
  assert.equal(inDeWereld, 1, 'de wereld-lokale versie draait');
});

test('4. je speelt als jezelf, maar een spelrol geeft nooit een echt recht', () => {
  /* DE SCHERPSTE VAN DE VIER. Een echt lid mag met zijn eigen identiteit spelen
     -- dat is de bedoeling, je leert de echte software als jezelf. Maar:
       - de identiteitskluis blijft dicht (geen echte naam, geen e-mail),
       - er valt niets aan een account te veranderen,
       - en een rol die je in een spel krijgt, staat in het VAK en nergens
         anders: de echte rechtencontrole blijft nee zeggen. */
  const { db, W, M } = metMount();
  W.maak('p1', {});
  const accounts = {
    getUserById: (id) => ({ id, tier: 'rtg' }), publicUser: (u) => ({ id: u.id }),
    isActief: () => true, verifyToken: () => ({ id: 1 }), count: () => 1,
    realNameOf: () => 'Echte Naam', emailOf: () => 'echt@mens.nl', phoneOf: () => '0612345678',
    createUser: () => ({ id: 99 }), renameUser: () => true, setTier: () => true,
    issueToken: () => 'token', trekIn: () => true, schrijfKluisRing: () => true
  };
  const wk = W.kernVoor({ db, save() {}, accounts }, 'p1');

  // je bent jezelf: lezen mag
  assert.deepEqual(wk.accounts.getUserById(1), { id: 1, tier: 'rtg' });
  assert.equal(wk.accounts.isActief(), true);

  // de kluis blijft dicht -- CLAUDE.md: echte namen staan in de gescheiden kluis
  for (const naam of ['realNameOf', 'emailOf', 'phoneOf'])
    assert.throws(() => wk.accounts[naam], (e) => e.spelwereld && e.spelwereld.soort === 'identiteit',
      naam + ' hoort een spel niets aan te gaan');

  // en er valt niets te veranderen
  for (const naam of ['createUser', 'renameUser', 'setTier', 'issueToken', 'trekIn', 'schrijfKluisRing'])
    assert.throws(() => wk.accounts[naam], (e) => e.spelwereld && e.spelwereld.soort === 'identiteit', naam);
  assert.throws(() => { wk.accounts.getUserById = () => ({ id: 2 }); });

  /* EN DE RECHTEN. Een rol die in een wereld wordt gegeven, landt in het vak.
     De productie-rechtenlijst (db.data.accountRollen) blijft leeg, dus wie
     daarop kijkt ziet niets -- en dat is precies de bewering: een spelrol
     veroorzaakt geen bedrijfsrecht. */
  const v = W.venster('p1');
  const motoren = M.motorenVoor(v);
  const e = motoren.entiteitNieuw('lid-echt', { naam: 'Spel BV', rechtsvorm: 'bv', land: 'NL' });
  assert.ok(e.entiteit, JSON.stringify(e));
  v.data.accountRollen = { 'lid-echt': [{ rol: 'bestuurder', zaak: 'spel' }] };
  assert.equal(db.data.accountRollen, undefined,
    'de productie-rechtenlijst hoort niet te bestaan, laat staan een spelrol te dragen');
  assert.ok(JSON.stringify(v.data).includes('bestuurder'), 'de rol staat in het vak');
});
