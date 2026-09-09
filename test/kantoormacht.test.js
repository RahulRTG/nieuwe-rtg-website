/* DE KANTOORMACHT-METER (scripts/kantoormacht.js).

   KANTOORMACHT.md par. 26 zet deze meter als blok 0: "eerst, altijd". Par. 29
   zegt waarom -- de getallen in dat document zijn lexicaal geteld en dragen de
   graad `vermoed`, en een richtingsdocument dat in stilte veroudert wordt
   geciteerd alsof het vandaag beschrijft.

   Deze toets bewaakt niet of 385 het JUISTE getal is; dat is een meting en die
   beweegt. Hij bewaakt de vier dingen die machinaal te handhaven zijn en die
   allemaal een fout afvangen die de meter waardeloos zou maken zonder dat
   iemand het ziet:

     1 de meter BESLIST niets -- niets in server/ importeert hem. Zou dat wel
       gebeuren, dan is hij de 22e capabilitylijst uit OS.md in plaats van de
       laag eroverheen. Zelfde grens als test/gezagsnoemer.test.js.
     2 de harde as blijft HARD -- `deurEistMens` telt alleen bewakers die
       werkelijk een identiteit eisen. Een rol is geen mens, en `officeAuth`
       hoort daar dus nooit in te sluipen: dat is precies het gat dat gemeten
       wordt, en wie hem toevoegt meet het gat weg in plaats van te dichten.
     3 de graden staan ERBIJ -- een getal zonder graad wordt doorverteld als
       zekerheid. `anoniemUitvoerbaar` is lexicaal en dus `vermoed`.
     4 `ongemeten` is een eigen uitslag en nooit een 0. Een nul beweert "gemeten
       en niet aanwezig"; dat is een andere bewering dan "hier is niet gekeken",
       en die twee door elkaar halen is hoe een scorecard geruststellend wordt
       zonder iets te weten (zelfde regel als gevolg.js: `geen-effect-gemeten`
       tegenover `onbekend`). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { meet, EIST_MENS, KANTOORPAD } = require('../scripts/kantoormacht');

const WORTEL = path.join(__dirname, '..');

test('1. de meter beslist niets: niets in server/ importeert hem', () => {
  /* Op de IMPORT en niet op het woord. De eerste versie grepte op "kantoormacht"
     en sloeg aan op server/kern/kantoor/mensdeur.js, dat het script in een
     commentaarregel NOEMT -- een valse treffer die de toets waardeloos maakt
     zodra iemand hem wegwuift. Verwijzen mag; laden niet. */
  let treffers = '';
  try {
    treffers = execFileSync('grep',
      ['-rlE', "require\\([^)]*kantoormacht", path.join(WORTEL, 'server'), '--include=*.js'],
      { encoding: 'utf8' }).trim();
  } catch (e) { treffers = ''; }  // grep geeft 1 bij nul treffers
  assert.equal(treffers, '',
    'server/ importeert de kantoormacht-meter: ' + treffers +
    ' -- dan is hij een beslisser in plaats van een meetlaag, en hoort hij niet in scripts/');
});

test('2. de harde as blijft hard: een gedeelde rol telt nooit als een mens', () => {
  assert.ok(!EIST_MENS.has('officeAuth'),
    'officeAuth staat in EIST_MENS -- maar de gedeelde kantoorcode maakt een sessie ' +
    'zonder lidKey (kern/kantoor/kluispoort.js). Wie hem meetelt, meet het gat weg.');
  assert.ok(!EIST_MENS.has('techAuth'),
    'een bewaker die alleen een ROL controleert hoort niet in EIST_MENS: een rol is geen mens');

  /* BALIEAUTH STOND HIER BIJ TECHAUTH, EN DAT WAS FEITELIJK ONJUIST -- 9 sep 2026.
     De regel groepeerde hem als "controleert alleen een rol", maar zijn bron zegt
     iets anders: server/routes/ledenbalie.js haalt de sleutel op met
     boardroomWie(req) -- null bij de gedeelde code -- en laat hem langs
     magBalie(). En kern/ledenbalie-zetels.js opent met `if (!key) return false`
     en eist daarna een zetel OP NAAM. De gedeelde kantoorcode krijgt daar een 403
     met zoveel woorden: "de gedeelde kantoorcode opent wel de ruimte, maar wijst
     niemand aan".

     Die fout kostte een ondertelling van eenendertig routes: het register meldde
     126 kantoorroutes met een mens erachter terwijl het er 157 waren. Een meter
     die te STRENG staat is niet veilig -- hij stuurt werk naar routes die al
     beschermd zijn, en dat is precies wat hier gebeurde.

     De toets eist daarom niet langer dat balieAuth eruit blijft, maar dat hij
     blijft DOEN waarop hij hier is toegelaten. Wordt de mens-vraag ooit uit die
     poort gehaald, dan zakt deze regel. */
  assert.ok(EIST_MENS.has('balieAuth'), 'balieAuth eist aantoonbaar een mens en hoort in EIST_MENS');
  const balie = fs.readFileSync(path.join(WORTEL, 'server/routes/ledenbalie.js'), 'utf8');
  const tak = balie.slice(balie.indexOf('function balieAuth'), balie.indexOf('function balieAuth') + 400);
  assert.match(tak, /boardroomWie\(req\)/,
    'balieAuth vraagt niet meer welke MENS er achter de sessie zit; dan is het een rolcontrole ' +
    'en hoort hij uit EIST_MENS');
  assert.match(tak, /magBalie\(/,
    'balieAuth toetst de zetel niet meer; zonder die tweede helft laat hij elke naam door');
  const zetels = fs.readFileSync(path.join(WORTEL, 'server/kern/ledenbalie-zetels.js'), 'utf8');
  assert.match(zetels, /function magBalie\(key\)\s*\{\s*\n?\s*if \(!key\) return false;/,
    'magBalie laat een lege sleutel door; dan komt de gedeelde code er alsnog langs');
  assert.ok(EIST_MENS.has('kluisAuth') && EIST_MENS.has('boardroomAuth'),
    'de twee poorten die aantoonbaar een identiteit eisen horen er wel in');
});

test('3. elke gemeten as draagt een graad, en de lexicale assen zijn `vermoed`', () => {
  const u = meet();
  for (const as of Object.keys(u.gemeten)) {
    if (as === 'bestanden') continue;
    assert.ok(u.graden[as], 'as zonder graad: ' + as + ' -- een getal zonder graad wordt doorverteld als zekerheid');
  }
  assert.equal(u.graden.deurEistMens, 'gemeten', 'de deur-as komt uit de router en is hard');
  assert.equal(u.graden.anoniemUitvoerbaar, 'vermoed',
    'anoniemUitvoerbaar is lexicaal op bestandsniveau en mag nooit `gemeten` heten');
});

test('4. ongemeten is een eigen uitslag met een reden, nooit een 0', () => {
  const u = meet();
  assert.ok(Object.keys(u.ongemeten).length > 0, 'er is niets als ongemeten gemarkeerd');
  for (const [k, reden] of Object.entries(u.ongemeten)) {
    assert.equal(typeof reden, 'string', k + ' heeft geen reden');
    assert.ok(reden.length > 20, k + ': een ongemeten as hoort te zeggen WAAROM er niet gekeken is');
    assert.ok(!(k in u.gemeten), k + ' staat zowel in gemeten als in ongemeten');
  }
});

test('5. de meter kijkt naar de kantoordeur en niet naar het hele huis', () => {
  assert.ok(KANTOORPAD.test('/api/office/state'));
  assert.ok(KANTOORPAD.test('/api/boardroom/bank'));
  assert.ok(!KANTOORPAD.test('/api/member/profiel'),
    'een ledenroute is geen kantoorroute');
  const u = meet();
  assert.ok(u.gemeten.routes > 0, 'geen enkele kantoorroute gevonden -- dan meet dit script niets');
  assert.equal(u.gemeten.deurEistMens + u.gemeten.deurGedeeld, u.gemeten.routes,
    'elke route valt in precies een van beide bakken; anders telt er iets dubbel of valt er iets weg');
});

test('6. het vastgelegde register loopt niet achter op de meter', () => {
  const doel = path.join(WORTEL, 'KANTOORMACHT.json');
  assert.ok(fs.existsSync(doel), 'KANTOORMACHT.json ontbreekt -- draai npm run kantoormacht:vast');
  const oud = JSON.parse(fs.readFileSync(doel, 'utf8'));
  const nu = meet();
  assert.ok(nu.gemeten.anoniemUitvoerbaar <= oud.gemeten.anoniemUitvoerbaar,
    'anoniem uitvoerbare kantoorroutes gestegen van ' + oud.gemeten.anoniemUitvoerbaar +
    ' naar ' + nu.gemeten.anoniemUitvoerbaar + ' -- deze teller mag alleen dalen (PROOF.md normtand)');
});

/* DE UITGANG VAN DE RATEL, en waarom die zelf ook een slot heeft. Toets 6
   vergelijkt met het VASTGELEGDE register, dus wie de teller wil laten stijgen
   legt gewoon een hoger getal vast. Dat is een echte uitgang en die moet
   bestaan -- een ratel zonder uitgang wordt bij de eerste terechte stijging
   omzeild in plaats van gebruikt. Maar hij hoort hardop te zijn: SERVICE.md
   par. 13 schrijft bij de OPEN_MAX-verhoging voor dat een verhoging de reden
   EN het adres van wat hem omlaag brengt draagt. Deze toets houdt dat vast, en
   hij is niet met een leeg lijstje te bevredigen: staat er een verhoging in,
   dan draagt hij beide velden en beweegt hij echt omhoog. */
test('6b. een verhoging van de ratel draagt een reden en een weg omlaag', () => {
  const oud = JSON.parse(fs.readFileSync(path.join(WORTEL, 'KANTOORMACHT.json'), 'utf8'));
  const lijst = oud.ratelverhogingen;
  assert.ok(Array.isArray(lijst), 'KANTOORMACHT.json hoort een lijst ratelverhogingen te dragen -- ' +
    'ook een lege, want dan is zichtbaar dat er geen zijn');
  for (const v of lijst) {
    assert.ok(v.as && typeof v.van === 'number' && typeof v.naar === 'number',
      'een verhoging noemt de as en de twee getallen: ' + JSON.stringify(v));
    assert.ok(v.naar > v.van, 'dit is geen verhoging: ' + JSON.stringify(v));
    assert.ok(String(v.reden || '').length > 60,
      v.as + ': een verhoging zonder uitgeschreven reden is een omzeiling met een JSON-veld eromheen');
    assert.ok(String(v.omlaag || '').length > 40,
      v.as + ': een verhoging hoort te zeggen wat hem weer omlaag brengt, anders is hij het nieuwe normaal');
  }
});

/* ============================================================================
   DE TWEEDE ZWAAR-AS (scripts/lib/zwaareffect.js).

   De padas herkent een zware handeling aan zijn naam en is daarmee een
   ondergrens: een route die geld beweegt onder een onschuldige naam valt
   erbuiten. De effectas stelt dezelfde vraag langs de andere kant -- wat heeft
   deze route werkelijk AANGERAAKT -- en is een ondergrens om een andere reden:
   hij ziet alleen wat de idempotentieproef aan het werk kreeg.

   De gevaarlijkste faalvorm van deze as is niet dat hij te weinig vindt maar
   dat hij zijn eigen blindheid verzwijgt. `raaktZonderMens: 0` naast een
   dekking van 10% leest als "in orde" terwijl het "we keken bijna nergens"
   betekent. Deze toetsen bewaken precies dat.
   ========================================================================== */
const { meetEffect, GELDCOLLECTIES } = require('../scripts/lib/zwaareffect.js');

/* Een nagebouwde proefronde, zodat deze toetsen niet meebewegen met de echte
   meting. Vier routes: een die geld raakt, een die de proef niet aan het werk
   kreeg, een die werkte zonder iets te raken, en een die er niet in staat. */
function nepProef() {
  return [
    { methode: 'POST', pad: '/api/office/geld/schuif', reden: 'ok',
      opslag: { a: { bankSaldi: 3 }, b: {}, c: {} } },
    { methode: 'POST', pad: '/api/office/bank/incasso',
      reden: 'de eerste oproep deed geen werk (status 404)', opslag: { a: {}, b: {}, c: {} } },
    { methode: 'POST', pad: '/api/office/kijk', reden: 'ok', opslag: { a: {}, b: {}, c: {} } }
  ];
}

test('7. de effectas telt geen route mee die de proef niet aan het werk kreeg', () => {
  const routes = [
    { methode: 'POST', pad: '/api/office/geld/schuif', bewakers: [] },
    { methode: 'POST', pad: '/api/office/bank/incasso', bewakers: [] },
    { methode: 'POST', pad: '/api/office/kijk', bewakers: [] },
    { methode: 'POST', pad: '/api/office/nergens', bewakers: [] }
  ];
  const uit = meetEffect(routes, p => /incasso|schuif/.test(p), () => false, WORTEL, nepProef());
  assert.strictEqual(uit.dekking.gemeten, 1, 'alleen de route die echt iets raakte is gemeten');
  assert.strictEqual(uit.dekking.geenWerk, 1, 'de 404-route telt als geenWerk');
  assert.strictEqual(uit.dekking.geenOpslag, 1, 'de route die werkte zonder effect telt apart');
  assert.strictEqual(uit.dekking.nietInProef, 1, 'en wat er niet in staat ook');
  /* DE KERN: `geenWerk` mag NOOIT als `geenOpslag` worden geteld. "de proef kwam
     er niet doorheen" is iets anders dan "er gebeurde niets", en die twee door
     elkaar halen maakt van een gat een geruststelling. */
  assert.notStrictEqual(uit.dekking.geenWerk, 0);
});

test('8. de effectas noemt hardop over welke zware routes hij zwijgt', () => {
  const routes = [
    { methode: 'POST', pad: '/api/office/bank/incasso', bewakers: [] },
    { methode: 'POST', pad: '/api/office/nergens', bewakers: [] }
  ];
  const uit = meetEffect(routes, p => /incasso|nergens/.test(p), () => false, WORTEL, nepProef());
  const blind = uit.blindVoor.map(b => b.pad).sort();
  assert.deepStrictEqual(blind, ['/api/office/bank/incasso', '/api/office/nergens'],
    'allebei de zware routes zijn onmeetbaar en horen dus in blindVoor');
  for (const b of uit.blindVoor)
    assert.ok(String(b.waarom || '').length > 10, b.pad + ' zegt niet WAAROM hij blind is');
});

test('9. een geldtreffer draagt de collectie die hem aanwees', () => {
  const routes = [{ methode: 'POST', pad: '/api/office/geld/schuif', bewakers: [] }];
  const uit = meetEffect(routes, () => false, () => false, WORTEL, nepProef());
  assert.strictEqual(uit.raakt.length, 1);
  assert.deepStrictEqual(uit.raakt[0].collecties, ['bankSaldi'],
    'een treffer zonder de collectie erbij is niet na te rekenen');
  assert.ok(GELDCOLLECTIES.bankSaldi, 'en die collectie draagt een reden in het register');
  for (const [naam, reden] of Object.entries(GELDCOLLECTIES))
    assert.ok(String(reden).length > 15, naam + ' staat in de geldlijst zonder uitgeschreven reden');
});

/* De idempotentie-administratie is met opzet GEEN geldcollectie: daar landt een
   afdruk van een verzoek, niet een bedrag. Zou `bankIdem` erin sluipen, dan
   telt elke herhaalbare bankroute mee als geldbeweging en is de as waardeloos. */
test('10. de idempotentie-administratie telt niet als geld', () => {
  for (const naam of ['bankIdem', 'bankIdemAfdruk', 'payIdem', 'payIdemAfdruk', 'betaalIdem'])
    assert.ok(!GELDCOLLECTIES[naam],
      naam + ' is een afdruk van een verzoek en geen bedrag; hem meetellen maakt elke ' +
      'herhaalbare bankroute een geldbeweging');
});
