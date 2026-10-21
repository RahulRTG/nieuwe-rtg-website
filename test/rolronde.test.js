'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { meetRol, beoordeelRoute, beoordeel, METER_N } = require('../scripts/rolronde');
const r = status => ({ status, data: {} });
const levend = () => ({ leverancier:{voor:r(200),na:r(200)}, kantoor:{voor:r(200),na:r(200)} });
const oordeel = (anon=401, lid=200, leverancier=401, kantoor=403) =>
  beoordeelRoute('POST /api/prive', r(anon), r(lid), { leverancier:r(leverancier), kantoor:r(kantoor) }, levend());
test('alleen een succesvolle eigenaar en twee expliciete weigeringen bewijzen rolscheiding', () => {
  assert.equal(oordeel().bewezen, true);
  assert.equal(oordeel(403, 204, 403, 401).bewezen, true);
});
test('fout, validatie, rate limit en timeout zijn nooit negatief bewijs', () => {
  for (const status of [0, 302, 400, 404, 409, 422, 429, 500, 503]) {
    const uit = oordeel(401, 200, status, 401);
    assert.equal(uit.bewezen, false, String(status));
    assert.equal(uit.onbekend.length, 1);
    assert.equal(uit.gaten.length, 0, 'onbekend is geen bewezen datalek');
  }
  const uit = beoordeelRoute('POST /api/prive', r(401), r(200), { leverancier:{status:503,data:{functie:'uit'}}, kantoor:r(403) }, levend());
  assert.equal(uit.bewezen, false, 'functie-vlag maakt503 niet tot autorisatiebewijs');
});
test('zonder2xx eigenaar bestaat geen positieve controle', () => {
  for (const status of [0, 301, 400, 401, 403, 404, 409, 429, 500, 503]) {
    const uit = oordeel(401, status);
    assert.equal(uit.bewezen, false);
    assert.ok(uit.onbekend.length);
  }
  assert.equal(oordeel(404).bewezen, false);
});
test('ongewenste2xx is een gat, ook als de andere rol onbekend blijft', () => {
  const uit = oordeel(401, 200, 200, 503);
  assert.equal(uit.gaten.length, 1);
  assert.equal(uit.onbekend.length, 1);
  assert.equal(uit.bewezen, false);
});
test('expliciet gedeeld contract blijft apart van bewezen scheiding', () => {
  const uit = beoordeelRoute('GET /api/push/key', r(401), {status:200,data:{key:'open'}},
    { leverancier:{status:200,data:{key:'open'}}, kantoor:r(403) }, levend());
  assert.equal(uit.gedeeld.length, 1);
  assert.equal(uit.gaten.length, 0);
  assert.equal(uit.bewezen, false);
});
test('ontbrekende rol en ontbrekend antwoord kunnen niet stil slagen; normvloer blijft hard', () => {
  assert.equal(beoordeelRoute('POST /api/prive', r(401), r(200), {}).bewezen, false);
  assert.equal(beoordeel({gaten:0,gemeten:1},{[METER_N]:2}).zakt, true);
});

test('eigen positieve controles vóór en na zijn verplicht voor iedere vreemde rol', () => {
  const antwoorden = {leverancier:r(401),kantoor:r(403)};
  assert.equal(beoordeelRoute('POST /api/prive',r(401),r(200),antwoorden).bewezen,false);
  for (const rol of ['leverancier','kantoor']) {
    for (const kant of ['voor','na']) {
      for (const status of [0,301,400,401,403,404,429,500,503]) {
        const controles=levend(); controles[rol][kant]=r(status);
        const uit=beoordeelRoute('POST /api/prive',r(401),r(200),antwoorden,controles);
        assert.equal(uit.bewezen,false,`${rol}/${kant}/${status}`);
        assert.equal(uit.onbekend.length,1);
        assert.equal(uit.gaten.length,0);
        assert.equal(uit.onbekend[0].reden,'eigen-sessie-niet-bewezen');
      }
    }
  }
});
test('verlopen vreemde sessie bewijst ook geen gedeelde toegang', () => {
  const controles=levend(); controles.leverancier.na=r(401);
  const uit=beoordeelRoute('GET /api/push/key',r(401),r(200),
    {leverancier:r(200),kantoor:r(403)},controles);
  assert.equal(uit.gedeeld.length,0);
  assert.equal(uit.onbekend.length,1);
});
test('ruwe rolproef gebruikt exact dezelfde token voor eigen loket vóór en na de tegenproef', async () => {
  for (const [rol,eigen] of [['leverancier','/api/supplier/state'],['kantoor','/api/office/state']]) {
    const token=Symbol(rol), calls=[], statuses=[200,401,401];
    const proef=await meetRol(async (...args) => {calls.push(args);return r(statuses.shift());},rol,token,'GET','/api/prive');
    assert.deepEqual(calls,[['POST',eigen,token],['GET','/api/prive',token],['POST',eigen,token]]);
    assert.deepEqual(proef,{voor:r(200),antwoord:r(401),na:r(401)});
    const controles=levend(); controles[rol]=proef;
    const uit=beoordeelRoute('GET /api/prive',r(401),r(200),{leverancier:r(401),kantoor:r(403)},controles);
    assert.equal(uit.bewezen,false,'verval tijdens de tegenproef kan niet groen worden');
  }
});
