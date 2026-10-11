/* DE BEZORGPROEF (scripts/bezorgproef.js) -- de tweede horecaketen, gelopen.

   De tafelproef noemt bezorging zelf als eigen naad. Deze toets LOOPT die keten
   (een wegwerpserver, zeven seconden) in plaats van alleen de bron te lezen,
   want de twee gebreken die hij vond zag geen enkele losse routetoets:
   bezorgd zonder ooit onderweg te zijn, en een tweede bericht aan het lid bij
   een herhaalde "bezorgd". De regel daarvoor staat in kern/horeca/bezorgovergang.js.

   Draai: node --test test/bezorgproef.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { overgang } = require('../server/kern/horeca/bezorgovergang');

test('1. de keten sluit: elke schakel gesloten, elke storing gehouden', { timeout: 120000 }, async () => {
  const { meet } = require('../scripts/bezorgproef');
  const u = await meet();
  const mis = u.schakels.filter((s) => s.stand !== 'gesloten').map((s) => s.nr + ' ' + s.stand + ': ' + s.wat + ' -- ' + (s.ziet || s.antwoord || s.fout))
    .concat(u.storingen.filter((s) => s.stand !== 'gehouden').map((s) => 'storing ' + s.naam + ': ' + s.wat));
  assert.deepEqual(mis, [], 'de bezorgketen sluit niet');
  assert.ok(u.telling.schakels >= 10 && u.telling.storingen >= 7, 'een lege keten sluit niet');
  assert.equal(u.sluit, true);
  assert.match(u.grens, /niet echt betaald/, 'de uitslag draagt zijn eigen grens');
});

test('2. de overgang: alleen vooruit voor een levering, en een herhaling is geen tweede gebeurtenis', () => {
  const lev = (status) => ({ levering: 'bezorgen', status });
  assert.equal(overgang(lev('in bereiding'), 'bezorgd').code, 'nooit-vertrokken');
  assert.equal(overgang(lev('nieuw'), 'bezorgd').status, 409);
  assert.deepEqual(overgang(lev('onderweg'), 'bezorgd'), {});
  assert.equal(overgang(lev('bezorgd'), 'bezorgd').herhaling, true);
  assert.equal(overgang(lev('bezorgd'), 'onderweg').code, 'al-klaar');
  // een afhaalbon en een tafelbestelling vallen niet onder de bezorgvolgorde
  assert.deepEqual(overgang({ levering: 'ophalen', status: 'klaar' }, 'opgehaald'), {});
  assert.deepEqual(overgang({ status: 'nieuw' }, 'klaar'), {});
  assert.equal(overgang({ status: 'klaar' }, 'klaar').herhaling, true, 'ook buiten de bezorging geen tweede bericht');
  assert.equal(overgang(null, 'bezorgd').status, 404);
});
