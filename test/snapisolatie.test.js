'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ROUTES, meet, oordeel, voegToe } = require('../scripts/lib/snapisolatie');
const { antwoordVan } = require('../scripts/lib/snapisolatie-oordeel');
const { beoordeelIdorRij } = require('../scripts/bevoegdronde');
// Eén echte HTTP-uitvoering levert de uitgangsdata voor meter-tegenproeven.
// Zonder geslaagde positieve controle wordt geen synthetisch groen verzonnen.
test('snapmeter: echte eigen ontvangers en negatieve controles; ruwe tegenproeven', async () => {
  const uit = await meet();
  for (const pad of ROUTES) {
    const r = uit['POST ' + pad];
    assert.equal(oordeel(r).stand, 'gemeten', JSON.stringify(r));
    assert.equal(beoordeelIdorRij(r, { methode: 'POST', pad }).stand, 'gemeten');
    assert.equal(beoordeelIdorRij(r, { methode: 'GET', pad }).stand, 'open');
    assert.equal(beoordeelIdorRij(r, { methode: 'POST', pad: '/api/verkeerd' }).stand, 'open');
  }
  const origineel = uit['POST ' + ROUTES[2]];
  const wijzig = fn => { const r = structuredClone(origineel); fn(r.proef); return oordeel(r); };
  assert.equal(wijzig(p => { p.stappen.find(x => x.id === 'view:a').status = 403; }).stand, 'open', 'een dichte eigen deur is geen bewijs');
  assert.equal(wijzig(p => { p.stappen.find(x => x.id === 'weigering:view:c').status = 200; }).stand, 'gebroken');
  assert.equal(wijzig(p => { p.stappen.find(x => x.id === 'weigering:view:c').lek = true; }).stand, 'gebroken');
  assert.equal(wijzig(p => { p.stappen.find(x => x.id === 'lijst:c').antwoord.snaps = [{ id: p.objecten.a.id, tekst: p.objecten.a.tekst }]; }).stand, 'gebroken');
  assert.equal(wijzig(p => { p.stappen.find(x => x.id === 'view:a').antwoord.tekst = p.objecten.a.tekst; }).stand, 'gebroken');
  assert.equal(wijzig(p => { p.stappen.find(x => x.id === 'weigering:send:c').na.snaps = []; }).stand, 'gebroken');
  assert.equal(wijzig(p => { p.stappen.find(x => x.id === 'weigering:view:c').status = 500; }).stand, 'open');
  assert.equal(wijzig(p => { p.stappen.find(x => x.id === 'weigering:view:c').doel = p.actors[0]; }).stand, 'open', '404 op verkeerd object bewijst niets');
  assert.equal(wijzig(p => { p.sessies[2].voor = 401; }).stand, 'open');
  assert.equal(wijzig(p => { p.fout = 'opslaan onderbroken'; }).stand, 'open');
  assert.equal(wijzig(p => { p.fout = 'opslaan onderbroken'; p.stappen.find(x => x.id === 'weigering:view:c').lek = true; }).stand, 'gebroken');
  assert.notEqual(wijzig(p => { p.objecten.a.media = p.actors[0]; }).stand, 'gemeten', 'aantal bestanden is geen objectbinding');
  assert.equal(wijzig(p => { p.actors[2] = p.actors[0]; }).stand, 'open');
  assert.equal(wijzig(p => { p.stappen = p.stappen.filter(x => x.id !== 'weigering:anoniem:2'); }).stand, 'open');
  assert.equal(wijzig(p => { p.stappen.push(p.stappen.find(x => x.id === 'view:a')); }).stand, 'open');
  assert.equal(wijzig(p => { p.omgeving = 'production'; }).stand, 'open', 'lokale proef wordt geen productieclaim');
  for (const id of ['lijst:a', 'lijst:b', 'lijst:c']) {
    assert.equal(wijzig(p => { p.stappen.find(x => x.id === id).antwoord.email = p.actors[0]; }).stand, 'gebroken', 'top-level lek: ' + id);
    assert.equal(wijzig(p => { p.stappen.find(x => x.id === id).antwoord.extra = { geheim: p.actors[0] }; }).stand, 'gebroken', 'genest lek: ' + id);
  }
  assert.equal(wijzig(p => { p.stappen.find(x => x.id === 'lijst:a').antwoord.snaps[0].extra = { foto: p.objecten.a.foto }; }).stand, 'gebroken');
  assert.equal(wijzig(p => { p.stappen.find(x => x.id === 'view:a').antwoord.foto = p.objecten.a.foto; }).stand, 'gebroken', 'foto andere ontvanger');
  assert.equal(wijzig(p => { p.objecten.b.foto = p.objecten.a.foto; }).stand, 'open', 'de beelden moeten verschillen');
  assert.equal(wijzig(p => { p.sessies[0].na.me = p.actors[1]; }).stand, 'open', '200 van verkeerde actor');
  assert.equal(wijzig(p => { p.sessies[0].voor.codenaam = p.codenamen[1]; }).stand, 'open', 'verkeerde codenaam');
  assert.equal(wijzig(p => { p.objecten.a.opslag.naar = p.actors[2]; }).stand, 'open', 'snapshot hoort bij bedoelde ontvanger');
  assert.equal(wijzig(p => { p.stappen.find(x => x.id === 'send:a').na.snaps[0].inhoud = p.actors[0]; }).stand, 'open', 'nieuwe opslaginhoud moet exact passen');
  assert.equal(wijzig(p => { p.actors = []; p.stappen.push(null); p.stappen.find(x => x?.id === 'weigering:view:c').lek = true; }).stand, 'gebroken', 'concreet lek blijft staan bij onvolledige fixture');
  assert.equal(wijzig(p => { p.actors = []; p.stappen.find(x => x.id === 'lijst:a').antwoord.extra = { geheim: 'lek' }; }).stand, 'gebroken');
});

// Pure regressies draaien ook zonder HTTP-server of geslaagde fixture.
test('IDOR samenvoegen bewaart elk bestaand concreet tegenbewijs', () => {
  for (const oud of [{ staat: 'doorbraak' }, { staat: 'lek' }, { staat: 'onbereikbaar', lek: true }]) {
    for (const nieuw of [{ staat: 'snapgescheiden' }, { staat: 'onbereikbaar' }]) {
      const register = { route: oud };
      assert.equal(voegToe(register, { route: nieuw }).route, oud);
    }
  }
  const defect = { staat: 'doorbraak' };
  assert.equal(voegToe({ route: { staat: 'onbereikbaar' } }, { route: defect }).route, defect);
});
test('antwoordnormalisatie bewaart alle onbekende en geneste velden', () => {
  const antwoord = antwoordVan({ snaps: [{ id: '1', tekst: 'x', geheim: { email: 'a@example.test' } }], extra: { foto: 'geheim' } });
  assert.deepEqual(Object.keys(antwoord).sort(), ['extra', 'snaps']);
  assert.match(antwoord.snaps[0].geheim.email, /^[a-f0-9]{64}$/);
  assert.match(antwoord.extra.foto, /^[a-f0-9]{64}$/);
});
