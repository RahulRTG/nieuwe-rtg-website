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
    if (pad === '/api/auth/register') data = { token: 'apart-verificatielid' };
    if (pad === '/api/auth/me') data = { user: { id: 42 } };
    if (pad.endsWith('/mijn')) data = { lijst: [] };
    if (pad.endsWith('/bewaar')) data = { design: { id: token + '-site' } };
    return { status: 200, data };
  };
  return { gezien, draai: () => maakRolfixtures({ post, basis: 'http://127.0.0.1:1234',
    proeflid: { token: 'lid-eigen' }, tokens: { supplier: 'zaak-eigen' }, kantoorVoor: async () => 'kantoor-naam' }) };
}

test('fixturecontroles gebruiken echte eigenaarbesluiten en hun eigen actor/invoer', async () => {
  const w = wereld();
  const fixtures = await w.draai();
  assert.equal(Object.keys(fixtures).length, FIXTURE_ROUTES.length);
  assert.deepEqual(w.gezien.filter(x => x.pad === '/api/techniek/functie').map(x => x.lijf),
    [{ id: 'leerhuis', aan: true }, { id: 'dom-eigendomein', aan: true }]);
  assert.deepEqual(w.gezien.filter(x => x.pad === '/api/techniek/functie/besluit').map(x => x.lijf.verzoekId),
    ['leerhuis', 'dom-eigendomein']);
  for (const r of FIXTURE_ROUTES) {
    const fixture = fixtures[r.methode + ' ' + r.pad];
    const call = w.gezien.find(x => x.pad === r.pad);
    assert.deepEqual(fixture.lijf, call.lijf);
    assert.deepEqual(fixture.eigenRoute, { methode: r.methode, pad: r.pad, status: 200 });
    assert.equal(call.token, r.functie === 'verificatie' ? 'apart-verificatielid' : r.rol === 'supplier' ? 'zaak-eigen' : r.rol === 'member' ? 'lid-eigen' : 'kantoor-naam');
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

test('bestaande sites worden alleen onder de eigen actor gelezen en niet overschreven', async () => {
  const w = wereld((pad, lijf, token) => pad.endsWith('/mijn') ? { status: 200, data: { lijst: [{ id: token + '-site' }] } }
    : pad.endsWith('/haal') ? { status: 200, data: { design: { id: lijf.id, titel: 'Bestaand', adres: token + '-adres' } } } : null);
  const fixtures = await w.draai();
  assert.equal(w.gezien.some(x => x.pad.endsWith('/bewaar')), false);
  for (const [prefix, token] of [['/api/site', 'lid-eigen'], ['/api/supplier/site', 'zaak-eigen']]) {
    assert.equal(fixtures['POST ' + prefix + '/domein'].eigenRoute.status, 200);
    const gelezen = w.gezien.find(x => x.pad === prefix + '/haal');
    assert.equal(gelezen.token, token);
    assert.equal(gelezen.lijf.id, token + '-site');
    assert.equal(w.gezien.find(x => x.pad === prefix + '/publiceer').lijf.adres, token + '-adres');
  }
});

test('een kapotte of onleesbare eigen voorraad blijft onbeslist zonder een nieuwe site te maken', async () => {
  for (const antwoord of [
    pad => pad.endsWith('/mijn') ? { status: 500, data: {} } : null,
    pad => pad.endsWith('/mijn') ? { status: 200, data: {} } : null,
    pad => pad.endsWith('/mijn') ? { status: 200, data: { lijst: [{}] } } : null,
    pad => pad.endsWith('/mijn') ? { status: 200, data: { lijst: [{ id: 'eigen' }] } }
      : pad.endsWith('/haal') ? { status: 403, data: {} } : null,
    pad => pad.endsWith('/mijn') ? { status: 200, data: { lijst: [{ id: 'eigen' }] } }
      : pad.endsWith('/haal') ? { status: 200, data: { design: { id: 'anders' } } } : null
  ]) {
    const w = wereld(antwoord);
    const fixtures = await w.draai();
    assert.equal(fixtures['POST /api/site/domein'].eigenRoute.status, 0);
    assert.equal(w.gezien.some(x => /\/(bewaar|publiceer|domein)$/.test(x.pad)), false);
  }
});
