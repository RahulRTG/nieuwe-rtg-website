'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture, body, tekenen } = require('./abonnementsaanbod-fixture.cjs');
const PADEN = Object.freeze({
  stand: '/api/mijn/abonnement/automatisch/stand',
  aanbod: '/api/mijn/abonnement/automatisch/aanbod',
  teken: '/api/mijn/abonnement/automatisch/teken',
  betalen: '/api/mijn/abonnement/automatisch/betalen',
  herstel: '/api/mijn/abonnement/automatisch/herstel',
  intrekken: '/api/mijn/abonnement/automatisch/intrekken'
});
function deur(env = {}) {
  const f = fixture(), handlers = new Map(), calls = [];
  const automatisch = { ...f.motor,
    async betaal(id, input) { calls.push({ id, input }); return { ok: true }; },
    async herstel(id, input) { calls.push({ id, input }); return { ok: true }; } };
  const auth = (req, res, next) => req.tokenAccount == null ? res.status(401).json({ error: 'Geen sessie' }) : next();
  require('../server/routes/aanmeldingen/automatisch')({ env, auth,
    aanvragerVan: req => req.tokenAccount, aanmeldingen: { automatisch },
    app: { post(pad, ...rij) { handlers.set(pad, rij); } } });
  async function api(pad, input, accountId) {
    const rij = handlers.get(PADEN[pad]);
    const req = { tokenAccount: accountId, body: input }, uit = { status: 200, headers: {} };
    const res = { set(k, v) { uit.headers[k] = v; return this; }, status(s) { uit.status = s; return this; },
      json(data) { uit.body = data; return this; } };
    let n = 0; const next = async () => { if (rij[n]) return rij[n++](req, res, next); };
    await next(); return uit;
  }
  return { ...f, api, calls, automatisch };
}

test('alle nieuwe schrijfroutes zijn standaard dicht; stand zegt beschikbaar=false zonder kernmutatie', async () => {
  const f = deur();
  assert.equal((await f.api('stand', {}, 1)).body.beschikbaar, false);
  for (const pad of ['aanbod', 'teken', 'betalen', 'herstel', 'intrekken'])
    assert.equal((await f.api(pad, body(), 1)).status, 409);
  assert.deepEqual(f.db.data, {}); assert.deepEqual(f.calls, []);
  assert.equal((await f.api('stand', {}, null)).status, 401);
});

test('async aanbod/teken gebruiken sessieaccount en bewaren concrete ondertekening, niet bodyaccount', async () => {
  const f = deur({ RTG_ABONNEMENTEN_ZELFSERVICE: '1' });
  const r = await f.api('aanbod', { ...body(), accountId: 2, prijs: 1, door: 'Kantoor' }, 1);
  assert.equal(r.status, 200); assert.equal(r.body.contract.aanbod.accountId, 1);
  assert.equal(r.body.contract.aanbod.prijs.maand.brutoCenten, 25000);
  const vreemd = await f.api('teken', { ...tekenen(r.body), accountId: 1 }, 2);
  assert.equal(vreemd.status, 404);
  const eigen = await f.api('teken', { ...tekenen(r.body), accountId: 2 }, 1);
  assert.equal(eigen.status, 200); assert.equal(eigen.body.contract.status, 'GEACCEPTEERD');
  assert.equal(eigen.headers['Cache-Control'], 'no-store');
  const stand = await f.api('stand', {}, 1);
  assert.equal(stand.body.beschikbaar, true); assert.equal(stand.body.contracten.length, 1);
  assert.deepEqual((await f.api('stand', { accountId: 1 }, 2)).body.contracten, []);
});

test('betalings- en herstelbody zijn beperkt tot contractId, met actor uit geverifieerd token', async () => {
  const f = deur({ RTG_ABONNEMENTEN_ZELFSERVICE: '1' });
  for (const pad of ['betalen', 'herstel']) {
    assert.equal((await f.api(pad, { contractId: 'c-1', accountId: 2, centen: 1, providerId: 'fake', status: 'paid' }, 1)).status, 200);
    assert.deepEqual(f.calls.at(-1), { id: 1, input: { contractId: 'c-1' } });
  }
});

test('async fout of opslagrollback kan over route geen succes worden; dezelfde UUID kan herstellen', async () => {
  const f = deur({ RTG_ABONNEMENTEN_ZELFSERVICE: '1' }), b = body();
  f.stand.saveFout = true;
  assert.equal((await f.api('aanbod', b, 1)).status, 503); assert.deepEqual(f.db.data, {});
  f.stand.saveFout = false; assert.equal((await f.api('aanbod', b, 1)).status, 200);
  f.automatisch.mijn = async () => { throw Error('Interne details niet uitsturen'); };
  const fout = await f.api('stand', {}, 1);
  assert.equal(fout.status, 503); assert.doesNotMatch(JSON.stringify(fout.body), /Interne details/);
  f.automatisch.mijn = () => ({ ok: true, beschikbaar: false, contracten: [] });
  assert.equal((await f.api('stand', {}, 1)).body.beschikbaar, false, 'routeflag kan een gesloten runtimepoort niet openen');
});
