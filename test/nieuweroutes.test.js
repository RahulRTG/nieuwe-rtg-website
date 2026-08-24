/* DE POORT OP DE INSTROOM VAN ONGETOETSTE ROUTES.

   scripts/nieuweroutes.js vergelijkt de routekaart van deze tak met die van
   main en eist een toets voor alles wat NIEUW is. Het onderscheid dat hij moet
   maken is scherp en makkelijk verkeerd te bouwen: de 1192 ongedekte endpoints
   die er al staan mogen er blijven staan (dat is een voorraad om af te bouwen),
   maar er mag er geen bij komen.

   De beoordeling staat los van git en van de bestanden, juist zodat hij hier
   met verzonnen invoer te ijken is.

   Draai los: node --experimental-sqlite --test test/nieuweroutes.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { nieuwZonderToets } = require('../scripts/nieuweroutes.js');
const { gedektIn } = require('../scripts/lib/routedekking.js');

test('een nieuwe route zonder toets wordt gemeld', () => {
  assert.deepEqual(
    nieuwZonderToets(['/api/oud', '/api/nieuw'], ['/api/oud'], 'niets over die route'),
    ['/api/nieuw']);
});

test('EN DIT IS DE HELE GRENS: een OUDE route zonder toets wordt niet gemeld', () => {
  /* Zou deze wel meetellen, dan zakte elke tak op de 1192 die er al staan en
     was de poort binnen een dag uitgezet. De voorraad is voor de ratel in
     NORM.json; deze keuring gaat alleen over de instroom. */
  assert.deepEqual(nieuwZonderToets(['/api/oud'], ['/api/oud'], 'geen enkele toets'), []);
});

test('een nieuwe route MET een toets komt er gewoon door, in alle drie de vormen', () => {
  const nu = ['/api/bank/overzicht', '/api/member/x', '/api/derde/y'];
  const basis = [];
  assert.deepEqual(nieuwZonderToets(nu, basis,
    "await api('bank/overzicht'); l.call('/member/x'); fetch(`/api/derde/y`);"), [],
    'de afgeknipte vorm, de vorm met slash en de volledige vorm tellen alle drie');
});

test('een pad in lopende tekst is geen aanroep', () => {
  assert.equal(gedektIn('/api/bank/overzicht', 'we moeten bank/overzicht nog toetsen'), false,
    'zonder aanhalingstekens is het een zin, geen aanroep');
  assert.equal(gedektIn('/api/bank/overzicht', "await api('bank/overzicht')"), true);
});

test('alleen /api-routes tellen mee', () => {
  assert.deepEqual(nieuwZonderToets(['/gezondheid', '/api/echt'], [], ''), ['/api/echt'],
    'een route buiten /api hoort niet bij deze telling');
});

/* DE TEGENPROEF. Zonder deze zou elke bewering hierboven ook slagen op een zeef
   die altijd "gedekt" zegt -- dan is de lijst per definitie leeg. */
test('DE TEGENPROEF: de zeef zegt niet overal ja', () => {
  const veel = ['/api/a', '/api/b', '/api/c', '/api/d'];
  assert.deepEqual(nieuwZonderToets(veel, [], ''), veel,
    'zonder een enkele toets horen ze er alle vier uit te komen');
  assert.deepEqual(nieuwZonderToets(veel, [], "api('a'); api('b'); api('c'); api('d');"), [],
    'en met vier toetsen geen enkele');
});

/* ---------------------------------------------------------------------------
   DE POORT KIJKT NU NAAR HET JOURNAAL, NIET ALLEEN NAAR DE TEKST

   De tekstzeef is een benadering, en dat staat in de kop van
   scripts/lib/routedekking.js. Voor een POORT is dat de verkeerde soort
   onzekerheid: hij zit er naar de kant naast waar hij TE VAAK zakt, en een poort
   die je regelmatig moet omzeilen houdt op een poort te zijn.

   Er lag al een betere bron. De servers in de testrun schrijven zelf op welk
   routepatroon ze hebben bediend, en in CI staat die stap VOOR deze -- het
   journaal is er dus al. Wat daarin staat is aangeroepen: een waarneming en geen
   zoektocht.
   --------------------------------------------------------------------------- */
const { weegNieuwe, gezienIn } = require('../scripts/nieuweroutes.js');

test('journaal: een route die ECHT is aangeroepen telt, ook zonder zijn pad in de tekst', () => {
  /* Precies het geval dat de tekstzeef mist: de toets stelt het pad samen achter
     een helper, dus het staat nergens voluit. Dat kostte 187 valse gaten in de
     oude teller, en hier zou het een valse CI-rood zijn. */
  const gezien = gezienIn('POST /api/nieuw/ding\nGET /api/oud\nSCHERM /apps/app.html');
  const w = weegNieuwe(['/api/oud', '/api/nieuw/ding'], ['/api/oud'], 'geen enkel pad in deze tekst', gezien);
  assert.deepEqual(w.kaal, [], 'niets om op te zakken');
  assert.deepEqual(w.waargenomen, ['/api/nieuw/ding']);
});

test('journaal: nooit aangeroepen en nergens genoemd -- daar zakt CI wel op', () => {
  const gezien = gezienIn('POST /api/iets/anders');
  const w = weegNieuwe(['/api/vers'], [], '', gezien);
  assert.deepEqual(w.kaal, ['/api/vers']);
});

test('journaal: wel in een toets, nooit aangeroepen -- dat is een melding en geen rood', () => {
  /* Kan kloppen (alleen een e2e raakt hem, en die draait later in de keten) en
     kan een dode verwijzing zijn. Te weinig om op te zakken, te veel om te
     verzwijgen -- dus een eigen stand in plaats van stilte. */
  const w = weegNieuwe(['/api/alleen/tekst'], [], "await api('alleen/tekst')", gezienIn(''));
  assert.deepEqual(w.kaal, [], 'hier zakt CI niet op');
  assert.deepEqual(w.alleenTekst, ['/api/alleen/tekst'], 'maar het staat er wel');
});

test('ZONDER journaal gedraagt de poort zich als voorheen', () => {
  /* Lokaal draait niemand eerst de hele suite. Dan is er geen derde stand: wat
     in een toets staat telt, zoals het altijd al ging. */
  const w = weegNieuwe(['/api/alleen/tekst'], [], "await api('alleen/tekst')");
  assert.deepEqual(w.kaal, []);
  assert.deepEqual(w.alleenTekst, [], 'geen journaal, geen tussenstand');
  assert.deepEqual(w.waargenomen, ['/api/alleen/tekst']);
});

test('gezienIn(): SCHERM-regels zijn geen endpoint', () => {
  /* Het journaal draagt ook geopende schermen, met SCHERM als methode. Zou die
     erdoorheen glippen, dan zou een pagina als endpoint gaan tellen. */
  const g = gezienIn('SCHERM /api/nep\nPOST /api/echt\nrommel zonder spatie');
  assert.deepEqual([...g], ['/api/echt']);
});
