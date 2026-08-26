/* DE GEBEURTENISENVELOP -- deelt hij werkelijk alleen vorm?

   kern/envelop.js heeft precies een regel: de envelop deelt VORM, nooit
   BETEKENIS. Die regel is makkelijk op te schrijven en makkelijk te slopen --
   een lijstje geldige soorten, een schoonmaak van de lading, een veldje voor een
   domein dat het toevallig nodig heeft, en de gedeelde vorm is een gedeeld model
   geworden dat niemand meer kan wijzigen.

   Deze toets houdt die regel vast op de vier plekken waar hij sneuvelt:

     1. de envelop kent geen domeinen (geen lijst van geldige soorten);
     2. de envelop kijkt niet in de lading;
     3. de envelop kent GEEN domeinmodule -- te zien aan zijn requires;
     4. een binnenkomende envelop wordt niet stilzwijgend aangevuld.

   En daarnaast: dat de vorm zelf werkelijk streng is, want een envelop die
   alles doorlaat is geen afspraak.

   Draai los: node --test test/envelop.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const E = require('../server/kern/envelop');

const goed = (extra) => Object.assign({
  soort: 'website.gepubliceerd', bron: 'kern/webmaker', klasse: 'codenaam'
}, extra || {});

test('1 - de envelop kent geen domeinen', () => {
  /* Een verzonnen domein hoort door te komen. Zou de envelop een lijst geldige
     soorten hebben, dan wist hij welke domeinen bestaan -- en dan deelt hij
     betekenis. */
  const r = E.maak(goed({ soort: 'kapperszaak.geknipt' }));
  assert.equal(r.ok, true, r.fouten && JSON.stringify(r.fouten));
  assert.equal(r.envelop.soort, 'kapperszaak.geknipt');

  // de VORM van een soort wordt wel bewaakt: dat is vorm, geen betekenis
  assert.equal(E.maak(goed({ soort: 'zomaarwat' })).ok, false);
  assert.equal(E.maak(goed({ soort: 'Website.Gepubliceerd' })).ok, false);
});

test('2 - de lading wordt niet gelezen, alleen begrensd', () => {
  const raar = { '<script>': 'x', 'veld met spaties': { diep: [1, 2, { nog: 'dieper' }] }, leeg: null };
  const r = E.maak(goed({ lading: raar }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.envelop.lading, raar, 'de lading hoort er onaangeroerd uit te komen');

  // alleen de omvang is een grens
  const groot = { veel: 'x'.repeat(E.LADING_MAX + 100) };
  const g = E.maak(goed({ lading: groot }));
  assert.equal(g.ok, false);
  assert.match(g.fouten[0].wat, /kB/);
});

test('3 - de envelop hangt aan geen enkel domein', () => {
  /* Dit is de toets die de regel het hardst vasthoudt, en hij kijkt naar de
     BRON: wie een domein wil kennen, moet er een require voor schrijven, en dat
     is een regel die opvalt in een diff (zelfde truc als kern/appstore/brug.js
     met de identiteitskluis). */
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'envelop.js'), 'utf8');
  const requires = [...bron.matchAll(/require\(\s*'([^']+)'\s*\)/g)].map(m => m[1]);
  const vreemd = requires.filter(r => r !== '../lib/klok' && r !== 'crypto');
  assert.deepEqual(vreemd, [], 'de envelop hoort niets te kennen behalve de klok en crypto');
});

test('4 - een binnenkomende envelop wordt niet aangevuld', () => {
  // maken mag aanvullen: dan ben JIJ de afzender
  const vers = E.maak(goed());
  assert.equal(vers.ok, true);
  assert.ok(vers.envelop.id, 'een verse envelop krijgt een id');
  assert.ok(vers.envelop.op, 'en een tijdstip');

  // lezen niet: een envelop zonder id komt ergens vandaan waar de vorm niet geldt
  const binnen = E.lees(goed());
  assert.equal(binnen.ok, false);
  assert.deepEqual(binnen.fouten.map(f => f.veld).sort(), ['id', 'op']);
  assert.match(binnen.fouten[0].wat, /niet aangevuld/);
});

test('5 - onbekende velden worden geweigerd, niet genegeerd', () => {
  const r = E.maak(goed({ hotelkamer: 'A12' }));
  assert.equal(r.ok, false);
  assert.equal(r.fouten[0].veld, 'hotelkamer');
  assert.match(r.fouten[0].wat, /lading/, 'en de fout wijst de weg: dat hoort in de lading');
});

test('6 - de klasse is een gesloten lijst, met codenaam apart van gevoelig', () => {
  assert.equal(E.maak(goed({ klasse: 'codenaam' })).ok, true);
  assert.equal(E.maak(goed({ klasse: 'persoonsgegevens' })).ok, false);
  assert.ok(Object.keys(E.KLASSEN).includes('codenaam'));
  assert.match(E.KLASSEN.codenaam, /zonder naam/, 'het onderscheid waar dit huis op draait hoort uitgeschreven te staan');
});

test('7 - keten en oorzaak binden een handeling, de klok niet', () => {
  const eerste = E.maak(goed({ soort: 'website.bewaard' })).envelop;
  assert.equal(eerste.keten, eerste.id, 'een envelop zonder keten begint er een');
  assert.equal(eerste.oorzaak, null);

  const tweede = E.volgOp(eerste, goed({ soort: 'website.gepubliceerd' }));
  assert.equal(tweede.ok, true);
  assert.equal(tweede.envelop.keten, eerste.keten, 'dezelfde handeling, dezelfde keten');
  assert.equal(tweede.envelop.oorzaak, eerste.id);

  const derde = E.volgOp(tweede.envelop, goed({ soort: 'zaak.gemeld' }));
  assert.equal(derde.envelop.keten, eerste.keten, 'de keten overleeft meerdere stappen');
  assert.equal(derde.envelop.oorzaak, tweede.envelop.id);
});

test('8 - een envelop kan niet zijn eigen oorzaak zijn', () => {
  const r = E.maak(goed({ id: 'abcdefgh12345678', oorzaak: 'abcdefgh12345678' }));
  assert.equal(r.ok, false);
  assert.ok(r.fouten.some(f => f.veld === 'oorzaak'));
});

test('9 - wat er niet is, staat er met een reden', () => {
  /* Zelfde afspraak als machtigingen.NIET_GEBOUWD: een ontbrekende belofte hoort
     te lezen als een besluit en niet als een lege plek. */
  for (const [wat, reden] of Object.entries(E.NIET_GEBOUWD)) {
    assert.ok(reden.length > 40, wat + ' hoort een echte reden te dragen');
  }
  assert.ok(E.NIET_GEBOUWD.levering, 'dat een envelop geen leveringsbelofte is, hoort er te staan');
  assert.match(E.NIET_GEBOUWD.volgorde, /keten|oorzaak/, 'en de volgorde-val hoort de uitweg te noemen');
});

test('10 - de dertien velden liggen vast', () => {
  assert.equal(E.VELDEN.length, 13);
  for (const v of ['id', 'soort', 'versie', 'actor', 'onderwerp', 'organisatie',
    'doel', 'op', 'keten', 'oorzaak', 'klasse', 'bron', 'lading']) {
    assert.ok(E.VELDEN.includes(v), v + ' hoort in de envelop te zitten');
  }
});
