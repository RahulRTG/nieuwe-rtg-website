'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakRolfixtures, FIXTURE_ROUTES } = require('../scripts/lib/rolproeffixtures');

function wereld(antwoord) {
  const gezien = [];
  const post = async (pad, lijf, token) => {
    gezien.push({ pad, lijf, token });
    const afwijking = antwoord?.(pad, lijf, token);
    if (afwijking) return afwijking;
    let data = { ok: true };
    if (pad === '/api/techniek/inloggen') data = { token: 'eigenaar', eigenaar: true };
    if (pad === '/api/techniek/functie') data = { status: 'wacht', verzoekId: lijf.id };
    if (pad === '/api/techniek/functie/besluit') data = { status: 'akkoord' };
    if (pad === '/api/auth/me') data = { user: { id: 42 } };
    if (pad.endsWith('/bewaar')) data = { design: { id: token + '-site' } };
    return { status: 200, data };
  };
  return { gezien, draai: () => maakRolfixtures({ post, basis: 'http://127.0.0.1:1234',
    proeflid: { token: 'lid-eigen' }, tokens: { supplier: 'zaak-eigen' }, kantoorVoor: async () => 'kantoor-naam' }) };
}

test('vijf fixturecontroles gebruiken echte eigenaarbesluiten en hun eigen actor/invoer', async () => {
  const w = wereld();
  const fixtures = await w.draai();
  assert.equal(Object.keys(fixtures).length, 5);
  assert.deepEqual(w.gezien.filter(x => x.pad === '/api/techniek/functie').map(x => x.lijf),
    [{ id: 'leerhuis', aan: true }, { id: 'dom-eigendomein', aan: true }]);
  assert.deepEqual(w.gezien.filter(x => x.pad === '/api/techniek/functie/besluit').map(x => x.lijf.verzoekId),
    ['leerhuis', 'dom-eigendomein']);
  for (const r of FIXTURE_ROUTES) {
    const fixture = fixtures[r.methode + ' ' + r.pad];
    const call = w.gezien.find(x => x.pad === r.pad);
    assert.deepEqual(fixture.lijf, call.lijf);
    assert.deepEqual(fixture.eigenRoute, { methode: r.methode, pad: r.pad, status: 200 });
    assert.equal(call.token, r.rol === 'supplier' ? 'zaak-eigen' : r.rol === 'member' ? 'lid-eigen' : 'kantoor-naam');
  }
});

test('een geweigerd eigenaarbesluit geeft ontbrekend bewijs en voert geen Academy-actie uit', async () => {
  const w = wereld((pad, lijf) => pad === '/api/techniek/functie/besluit' && lijf.verzoekId === 'leerhuis'
    ? { status: 200, data: { status: 'geweigerd' } } : null);
  const fixtures = await w.draai();
  for (const r of FIXTURE_ROUTES.filter(r => r.functie === 'leerhuis')) {
    assert.equal(fixtures[r.methode + ' ' + r.pad].eigenRoute.status, 0);
    assert.equal(w.gezien.some(x => x.pad === r.pad), false);
  }
  assert.equal(fixtures['POST /api/site/domein'].eigenRoute.status, 200, 'onafhankelijke domeinfixture blijft meetbaar');
});

test('een 503 of kapotte eigen-site-opbouw wordt niet vervangen door een groene fixture', async () => {
  const w = wereld(pad => pad === '/api/leerhuis/doe' ? { status: 503, data: { error: 'uitval' } }
    : pad === '/api/site/bewaar' ? { status: 200, data: {} } : null);
  const fixtures = await w.draai();
  assert.equal(fixtures['POST /api/leerhuis/doe'].eigenRoute.status, 503);
  assert.equal(fixtures['POST /api/leerhuis/lees'].eigenRoute.status, 0);
  assert.equal(fixtures['POST /api/site/domein'].eigenRoute.status, 0);
  assert.equal(w.gezien.some(x => x.pad === '/api/site/domein'), false);
});
