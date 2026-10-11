/* DE ACTOR-AS VAN scripts/kantoormacht.js KIJKT NIET MEER BLIND (11 oktober 2026).

   Een tegenlezing vond twee routes die een getypte naam als actor gebruikten
   terwijl de meter `actorUitVerzoek: 0` publiceerde: de stadsraadstem
   (`req.body.naam`, en `naam` stond niet in de veldlijst) en de
   lab-veiligheidstoets (de handler gaf het hele lijf door, en de kern las
   `b.door`). Deze toets houdt vast:
     1. `naam` is een treffer, tenzij de route met een REDEN op de
        uitzonderingslijst staat;
     2. een handler die het hele lijf aan de kern geeft is ONBEPAALD -- geen
        treffer, maar ook geen schone route;
     3. de uitslag zegt dat een nul een ondergrens is.

   Draai los: node --test test/kantoormacht-actor.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { actorVan, NAAM_GEEN_ACTOR, meet } = require('../scripts/kantoormacht');

test('1. een getypte naam in het lijf is een treffer', () => {
  const r = actorVan("stadsraad.stem(id, 'rtg', req.body.naam || boardroomWie(req), true)", 'POST /x');
  assert.equal(r.treffer, 'req.body.naam');
  assert.equal(actorVan('lab.zet(id, { door: b.door })', 'POST /x').treffer, 'b.door');
});

test('2. de uitzonderingslijst draagt per route een reden, en geldt alleen voor naam', () => {
  for (const [route, reden] of NAAM_GEEN_ACTOR) {
    assert.match(route, /^POST \//);
    assert.ok(String(reden).length > 10, 'een uitzondering zonder reden: ' + route);
  }
  const [route] = [...NAAM_GEEN_ACTOR.keys()];
  assert.equal(actorVan('f(req.body.naam)', route).treffer, null, 'de uitzondering werkt voor naam');
  assert.equal(actorVan('f(req.body.door)', route).treffer, 'req.body.door', 'maar niet voor een ander veld');
});

test('3. het hele lijf aan de kern geven is onbepaald, en geen schone route', () => {
  assert.equal(actorVan("lab.veiligheidZet(String(req.body.id || ''), req.body || {})", 'POST /x').onbepaald, 'lijf-naar-kern');
  assert.equal(actorVan('T().zet(b.org, { ...b, door: wie(req) })', 'POST /x').onbepaald, 'lijf-naar-kern');
  assert.equal(actorVan("f(String(req.body.id || ''))", 'POST /x').onbepaald, null, 'een losse veldlezing is niet onbepaald');
});

test('4. de meting: de veiligheidstoets staat in beeld, en een nul heet een ondergrens', () => {
  const u = meet().uitvoeren;
  assert.ok(u.actorUitVerzoek > 0, 'met naam erbij vindt de meter treffers');
  assert.ok(u.actorOnbepaald > 0, 'en onbepaalde routes');
  assert.match(u.actorLezing, /ondergrens/);
  assert.equal(u.graden.actorOnbepaald, 'onbepaald');
  assert.ok(u.buitenKantoorpad.actorOnbepaald.some(x => x.route === 'POST /api/lab/project/veiligheid'),
    'de lab-veiligheidstoets geeft het lijf door en hoort onbepaald te zijn');
});
