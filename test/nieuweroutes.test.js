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
