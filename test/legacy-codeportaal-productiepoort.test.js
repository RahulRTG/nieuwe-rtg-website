'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const maakPoort = require('../server/middleware/legacy-codeportaal-productiepoort');

function vraag(poort, pad, methode = 'POST') {
  const req = { method:methode, path:new URL(pad, 'http://rtg.test').pathname };
  const koppen = {};
  return new Promise(resolve => {
    const res = {
      statusCode:200,
      set(naam, waarde) { koppen[String(naam).toLowerCase()] = String(waarde); return res; },
      status(code) { res.statusCode = code; return res; },
      json(body) { resolve({ status:res.statusCode, body, cache:koppen['cache-control'] }); return res; }
    };
    poort(req, res, () => resolve({ status:200, body:{ ok:true }, cache:koppen['cache-control'] }));
  });
}

test('productie sluit alle legacy codeportalen ongeacht methode of Foundation-vrijgave', async () => {
  const poort = maakPoort({ productie:true, env:{ RTF_BESCHERMDE_FUNCTIES_VRIJGEGEVEN:'1' } });
  const paden = [
    '/api/rtf/club/portaal',
    '/api/rtf/club/bericht?code=geheim',
    '/api/rtf/partner/raad',
    '/api/rtf/partner/besluit-start',
    '/api/rtf/partner/stem',
    '/api/rtf/partner/besluit-sluit',
    '/API/RTF/CLUB/PORTAAL',
    '/api/rtf/%63lub/portaal',
    '/api/rtf/%70artner/stem',
    '/api/rtfos/portaal/partner',
    '/api/rtfos/portaal/gemeente/',
    '/api/rtfos/portaal/ondernemer'
  ];
  for (const pad of paden) {
    const antwoord = await vraag(poort, pad);
    assert.equal(antwoord.status, maakPoort.STATUS, pad);
    assert.deepEqual(antwoord.body, maakPoort.ANTWOORD, pad);
    assert.equal(antwoord.cache, 'no-store', pad);
  }
  assert.equal((await vraag(poort, '/api/rtf/partner/stem', 'GET')).status, maakPoort.STATUS);
});

test('nieuwe persoonsportalen en gelijknamige openbare routes blijven buiten deze poort', async () => {
  const poort = maakPoort({ productie:true });
  const open = [
    '/api/rtfos/portaal/deelnemer',
    '/api/rtfos/portaal/vrijwilliger',
    '/api/rtfos/portaal/donateur',
    '/api/rtfos/portaal/partnerlijk',
    '/api/rtf/clubs-openbaar',
    '/api/rtf/partners'
  ];
  for (const pad of open) assert.equal((await vraag(poort, pad)).status, 200, pad);
});

test('development en test blijven open voor migratie- en regressieproeven', async () => {
  for (const nodeEnv of ['development', 'test']) {
    const poort = maakPoort({ env:{ NODE_ENV:nodeEnv } });
    assert.equal((await vraag(poort, '/api/rtf/club/portaal')).status, 200, nodeEnv);
    assert.equal((await vraag(poort, '/api/rtfos/portaal/gemeente')).status, 200, nodeEnv);
  }
});

test('de legacy-poort staat eenmalig vóór Foundation, idem en het handelingsspoor', () => {
  const lijf = fs.readFileSync(path.join(__dirname, '..', 'server/opzet/lijfpoort.js'), 'utf8');
  const legacy = lijf.indexOf("require('../middleware/legacy-codeportaal-productiepoort')()");
  const foundation = lijf.indexOf("require('../middleware/foundation-productiepoort')()");
  const idem = lijf.indexOf("require('../lib/idem-poort')()");
  const spoor = lijf.indexOf("require('../lib/handelingsspoor')");
  assert.ok(legacy > lijf.indexOf("express.json({ limit: '8mb' })"));
  assert.ok(legacy < foundation);
  assert.ok(legacy < idem);
  assert.ok(legacy < spoor);
  assert.equal((lijf.match(/require\('\.\.\/middleware\/legacy-codeportaal-productiepoort'\)\(\)/g) || []).length, 1);
});
