'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('../scripts/lib/wegwerpserver');
const { maakVraag } = require('../scripts/rolproef-route');
const { maakProeflid, metToestellen } = require('../scripts/lib/proeftoestel');
const { maakRolfixtures, FIXTURE_ROUTES } = require('../scripts/lib/rolproeffixtures');
const { draaiRolproef } = require('../scripts/lib/rolproef');

test('standaard-uit deuren en verificatie worden met echte positieve routecontroles gekruist', { timeout: 120000 }, async () => {
  const server = await start({ naam: 'rolfixture-http', env: {
    RTG_DEMO: '1', RTG_MAGNAAT_TEST: '1', OFFICE_CODE: 'RTG-OFFICE-PROEF'
  } });
  try {
    const vraag = maakVraag({ basis: server.basis });
    const post = (pad, lijf, token, koppen) => vraag('POST', pad, lijf, token, koppen);
    const tokens = {
      member: (await post('/api/login', { tier: 'rtg' })).data.token,
      supplier: (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).data.token,
      office: (await post('/api/office/login', { code: 'RTG-OFFICE-PROEF' })).data.token
    };
    assert.ok(Object.values(tokens).every(Boolean), 'alle drie rollen moeten bestaan');
    for (const route of FIXTURE_ROUTES.filter(r => r.functie !== 'verificatie')) {
      assert.equal((await vraag(route.methode, route.pad, {}, tokens[route.rol] || tokens.office)).status, 503,
        route.pad + ' is zonder eigenaarbesluit standaard uit');
    }
    const lid = await maakProeflid({ post, naam: 'Rolfixture HTTP', basis: server.basis });
    assert.ok(lid.klaar?.gekeurd, lid.reden || lid.klaar?.keurReden);
    const fixtures = await maakRolfixtures({ post, basis: server.basis, tokens, proeflid: lid.klaar });
    for (const [route, fixture] of Object.entries(fixtures)) {
      assert.equal(fixture.eigenRoute.status, 200, route + ': ' + JSON.stringify(fixture.eigenRoute));
    }
    const uit = await draaiRolproef({ post: metToestellen(post, { voorLid: { lid: lid.klaar, van: () => tokens.member } }),
      vraag, routes: FIXTURE_ROUTES, tokensVoor: () => tokens, fixtureVoor: r => fixtures[r.methode + ' ' + r.pad] });
    assert.equal(uit.bevindingen.meterStuk, undefined, JSON.stringify(uit.bevindingen));
    assert.equal(uit.pogingen, 17);
    assert.deepEqual(uit.bevindingen.gewijzigd, []);
    assert.deepEqual(uit.bevindingen.onbeslist, []);
    for (const rij of Object.values(uit.perRoute)) {
      assert.equal(rij.acl, 'dicht', JSON.stringify(rij));
      assert.equal(rij.privacy, 'schoon', JSON.stringify(rij));
      assert.equal(rij.eigenRoute.status, 200);
      for (const a of rij.antwoorden) {
        assert.ok(a.status === 401 || a.status === 403, JSON.stringify(a));
        assert.equal(a.eigenVoor, 200);
        assert.equal(a.eigenNa, 200);
      }
    }
  } finally { server.klaar(); }
});
