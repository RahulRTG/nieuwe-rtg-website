'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const maakPoort = require('../server/middleware/simulatiebrug-productiepoort');

function vraag(poort, pad, methode = 'POST') {
  const req = { method:methode, path:new URL(pad, 'http://rtg.test').pathname };
  const koppen = {};
  return new Promise(resolve => {
    const res = {
      statusCode:200,
      set(naam, waarde) { koppen[String(naam).toLowerCase()] = String(waarde); return res; },
      status(code) { res.statusCode = code; return res; },
      json(body) { resolve({ status:res.statusCode, body,
        cache:koppen['cache-control'] }); return res; }
    };
    poort(req, res, () => resolve({ status:200, body:{ ok:true },
      cache:koppen['cache-control'] }));
  });
}

test('productie sluit iedere issuer en consumer van de hospitality-simulatiecode', async () => {
  const poort = maakPoort({ productie:true });
  for (const pad of maakPoort.GESLOTEN_ROUTES) {
    const antwoord = await vraag(poort, pad + '?code=GEHEIM');
    assert.equal(antwoord.status, maakPoort.STATUS, pad);
    assert.deepEqual(antwoord.body, maakPoort.ANTWOORD, pad);
    assert.equal(antwoord.cache, 'no-store', pad);
  }
  assert.equal((await vraag(poort,
    '/API/SUPPLIER/HORECA/SIMULATIE/MAAK/')).status, maakPoort.STATUS);
  assert.equal((await vraag(poort,
    '/api/member/spel/hospitality-%6Boppel')).status, maakPoort.STATUS);
});

test('naastliggende spel- en horecaroutes blijven buiten de productiepoort', async () => {
  const poort = maakPoort({ productie:true });
  for (const pad of [
    '/api/member/spel/hospitality-start',
    '/api/member/spel/hospitality-stap',
    '/api/supplier/horeca/dashboard',
    '/api/supplier/horeca/simulatie'
  ]) assert.equal((await vraag(poort, pad)).status, 200, pad);
});

test('development en test houden de simulatiebrug beschikbaar voor regressieproeven', async () => {
  for (const nodeEnv of ['development', 'test']) {
    const poort = maakPoort({ env:{ NODE_ENV:nodeEnv } });
    for (const pad of maakPoort.GESLOTEN_ROUTES)
      assert.equal((await vraag(poort, pad)).status, 200, nodeEnv + ' ' + pad);
  }
});

test('de simulatiepoort staat eenmalig voor idemopslag en domeinhandlers', () => {
  const lijf = fs.readFileSync(path.join(__dirname, '..', 'server/opzet/lijfpoort.js'), 'utf8');
  const regel = "require('../middleware/simulatiebrug-productiepoort')()";
  const simulatie = lijf.indexOf(regel);
  const idem = lijf.indexOf("require('../lib/idem-poort')()");
  const spoor = lijf.indexOf("require('../lib/handelingsspoor')");
  assert.ok(simulatie > lijf.indexOf("express.json({ limit: '8mb' })"));
  assert.ok(simulatie < idem);
  assert.ok(simulatie < spoor);
  assert.equal(lijf.split(regel).length - 1, 1);
});
