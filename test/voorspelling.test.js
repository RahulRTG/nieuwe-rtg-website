/* DE VIERDE DETECTOR: een voorspelling als feit (scripts/lib/voorspelling.js).

   Puur, zonder browser, zodat de oordeelslogica ook op een kale CI wordt
   beproefd en de mutatiemotor eraan kan (zelfde reden als
   test/schermleugen.test.js). Elke toets zet een antwoord van de backend naast
   de zichtbare tekst van een scherm.

   Draai los: node --test test/voorspelling.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../scripts/lib/voorspelling');
const { zekerheid } = require('../server/kern/fiscaal/zekerheid');

const cockpit = { pad: '/api/geld/cockpit', body: { ok: true, vooruitblik: { d7: 12000, d30: 34000 } } };

test('een vooruitblik zonder enig voorbehoud op het scherm is een voorspelling als feit', () => {
  const k = V.vindVoorspellingAlsFeit({ antwoorden: [cockpit], tekst: 'Over 7 dagen € 120 · over 30 dagen € 340' });
  assert.equal(k.length, 1);
  assert.match(k[0], /^voorspelling als feit: \/api\/geld\/cockpit .*klasse advies/);
});

test('met een voorbehoud ("verwachting", "ongeveer", de kop van de klasse) is het geen klacht', () => {
  for (const tekst of ['Over 7 dagen € 120 · verwachting', 'ongeveer € 340 einde maand',
    'Te betalen (indicatie)', 'Vraag een fiscalist · € 1.200', 'Bij dit tempo (extrapolatie)']) {
    assert.deepEqual(V.vindVoorspellingAlsFeit({ antwoorden: [cockpit], tekst }), [], tekst);
  }
});

test('een zekerheidsblok met klasse advies of uitlegbaar telt, ook op een onbekend pad', () => {
  const advies = { pad: '/api/iets/nieuws', body: { ok: true, bedrag: 5, zekerheid: zekerheid('zzp.berekening') } };
  assert.equal(V.onzekereUitkomsten([advies]).length, 1);
  assert.equal(V.onzekereUitkomsten([advies])[0].bron, 'zekerheid');
  const uitleg = { pad: '/api/x', body: { lijst: [{ zekerheid: zekerheid('btw.categorie') }] } };
  assert.equal(V.onzekereUitkomsten([uitleg])[0].klasse, 'uitlegbaar');
  assert.equal(V.vindVoorspellingAlsFeit({ antwoorden: [advies], tekst: 'U betaalt € 5' }).length, 1);
});

test('een bepaalde uitkomst, een fout en een leeg antwoord zijn geen onzekere uitkomst', () => {
  const bepaald = { pad: '/api/x', body: { ok: true, zekerheid: zekerheid('btw.aangifte') } };
  assert.deepEqual(V.onzekereUitkomsten([bepaald]), []);
  assert.deepEqual(V.onzekereUitkomsten([{ pad: '/api/geld/cockpit', body: { ok: false, error: 'nee' } }]), []);
  assert.deepEqual(V.onzekereUitkomsten([{ pad: '/api/geld/cockpit', body: null }]), []);
  assert.deepEqual(V.vindVoorspellingAlsFeit({ antwoorden: [bepaald], tekst: 'Te betalen € 400' }), []);
});

test('het oordeel per rij gebruikt de bestaande standen, en zegt waarom', () => {
  assert.equal(V.oordeelVoorspelling({ antwoorden: [cockpit], tekst: '€ 120', pad: '/a' }).status, 'GEBLOKKEERD_DOOR_DEFECT');
  const goed = V.oordeelVoorspelling({ antwoorden: [cockpit], tekst: '€ 120 verwacht', pad: '/a' });
  assert.equal(goed.status, 'BEWEZEN');
  assert.deepEqual(goed.uitkomsten, ['/api/geld/cockpit']);
  assert.match(goed.reden, /per scherm en niet per getal/);
  assert.equal(V.oordeelVoorspelling({ antwoorden: [], tekst: '€ 120', pad: '/a' }).status, 'NIET_GETEST');
  assert.equal(V.oordeelVoorspelling({ antwoorden: [cockpit], tekst: '€ 120', pad: '/a', landing: '/b' }).status, 'NIET_GETEST');
  assert.equal(V.oordeelVoorspelling({ antwoorden: [cockpit], tekst: '€ 120', pad: '/a', deur: '#poort' }).status, 'NIET_GETEST');
});

test('een voorbehoudwoord telt alleen aan het begin van een woord', () => {
  assert.equal(V.heeftVoorbehoud('Bedrag € 120'), false);
  assert.equal(V.heeftVoorbehoud('naar verwachting € 120'), true);
  assert.equal(V.heeftVoorbehoud('xverwacht'), false);
});

test('de lijst bekende voorspellingen gebruikt alleen de bestaande klassen', () => {
  const { KLASSEN } = require('../server/kern/fiscaal/zekerheid');
  for (const [pad, r] of Object.entries(V.ONZEKER)) {
    assert.ok(KLASSEN[r.klasse], pad + ' noemt de onbekende klasse ' + r.klasse);
    assert.ok(V.ONZEKERE_KLASSEN.has(r.klasse), pad + ' staat in de lijst maar is niet onzeker');
    assert.match(pad, /^\/api\//);
  }
});
