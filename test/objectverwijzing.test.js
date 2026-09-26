/* DE OBJECTPOORT: een object is een verwijzing, en er is een plek die dat beslist.

   shared/objectverwijzing.js kapt af wat een scherm als object meegeeft: soort,
   id, label en hooguit acht velden. Het register (adaptief/register.js), de schil
   (rtg-schil/06b-objecten.js) en het blikveld (edge/blikveld.js) lezen allemaal
   deze poort; voordien kapte alleen de schil af en nam het register een dossier
   over zoals het binnenkwam.

   Wat hier vastligt:

   1. een dossier met velden op het hoogste niveau (naam, adres) komt door het
      register als soort, id, label en velden -- de rest valt weg;
   2. twintig velden in o.velden worden er acht;
   3. zonder id is er geen verwijzing: de poort geeft null met een reden, en het
      blikveld toont een leeg veld met die reden;
   4. zonder poort komt er geen object door -- niet onbewerkt.

   DE MUTATIES, elk nagetrokken: laat het register c.object weer onbewerkt
   overnemen (toets 1 zakt), zet GRENS.velden op 20 (toets 2 zakt), en laat de
   poort een object zonder id doorlaten (toets 3 zakt). De volgorde in
   werkruimte.html houdt werkruimte-objecten.e2e.js vast: de schil pakt de poort
   bij het laden, dus een poort na rtg-schil.js betekent: geen sleep. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WORTEL = path.join(__dirname, '..');
const lees = (p) => fs.readFileSync(path.join(WORTEL, p), 'utf8');
const Poort = require('../public/shared/objectverwijzing.js');
const leer = require('../public/shared/adaptief.js');
const gram = require('../public/shared/adaptief/grammatica.js');
const { maak } = require('../public/shared/edge/blikveld.js');

/* Het echte register in een nagemaakt venster, met of zonder poort. */
function register(metPoort = true) {
  const window = { RTGAdaptiefLeer: leer, RTGGrammatica: gram, console: { warn() {}, error() {} },
    matchMedia: () => ({ matches: false, addEventListener() {} }) };
  const ctx = vm.createContext({ window, document: { documentElement: { setAttribute() {} } } });
  const delen = ['adaptief/vorm.js', 'adaptief/register.js'];
  if (metPoort) delen.unshift('objectverwijzing.js');
  for (const f of delen) vm.runInContext(lees('public/shared/' + f), ctx, { filename: f });
  return window;
}

test('1. een dossier in de context wordt een verwijzing: soort, id, label en velden', () => {
  const A = register().RTGAdaptief;
  const c = A.context({ bron: 'proef', object: { soort: 'dossier', id: 'k1', label: 'Klant',
    naam: 'Jan Jansen', adres: 'Kerkstraat 1', velden: { stad: 'Utrecht' } } });
  assert.deepEqual(JSON.parse(JSON.stringify(c.object)),
    { soort: 'dossier', id: 'k1', label: 'Klant', velden: { stad: 'Utrecht' } });
});

test('2. twintig velden worden er acht, en elke waarde blijft kort', () => {
  const velden = {};
  for (let i = 0; i < 20; i++) velden['v' + i] = 'x'.repeat(500);
  const v = Poort.verwijzing({ soort: 'bestand', id: 'b1', velden });
  assert.equal(Object.keys(v.velden).length, 8);
  assert.ok(Object.values(v.velden).every((x) => x.length === 120));
  const lang = Poort.verwijzing({ soort: 's'.repeat(99), id: 'i'.repeat(99), label: 'l'.repeat(999) });
  assert.deepEqual([lang.soort.length, lang.id.length, lang.label.length], [32, 64, 120]);
});

test('3. zonder id geen verwijzing: null met een reden, ook in het blikveld', () => {
  assert.equal(Poort.verwijzing({ soort: 'document', label: 'Brief' }), null);
  assert.match(Poort.reden({ soort: 'document' }), /id/);
  assert.equal(Poort.verwijzing('geen object'), null);
  assert.ok(Poort.reden('geen object').length > 5);
  /* Het blikveld krijgt de context rechtstreeks, zoals op een scherm zonder
     register ervoor: ook daar beslist de poort. */
  const w = { document: { title: 'Proef', body: { getAttribute: () => null }, documentElement: { getAttribute: () => null },
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
  location: { pathname: '/apps/proef.html', origin: 'https://rtg.test' }, navigator: { onLine: true },
  RTGObjectverwijzing: Poort,
  RTGAdaptief: { context: () => ({ bron: 'proef', titel: 'Proef', acties: [], object: { soort: 'document' } }),
    opContext() { return () => {}; }, voorNu: () => [], capability: () => null } };
  const o = maak(w).lees().velden.object;
  assert.equal(o.waarde, null, 'een object zonder id is geen verwijzing');
  assert.match(o.reden, /id/, 'en het lege veld zegt waarom');
});

test('4. zonder poort komt er geen object door, en zeker niet onbewerkt', () => {
  const A = register(false).RTGAdaptief;
  assert.ok(A, 'het register laadt ook zonder poort');
  assert.equal(A.context({ bron: 'proef', object: { soort: 'dossier', id: 'k1', naam: 'Jan' } }).object, null);
});
