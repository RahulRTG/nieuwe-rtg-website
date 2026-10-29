'use strict';
/* Voer de echte helpers uit: een bronassert op een routesuffix bewees niet
   waar fetch terechtkwam. Geen server/mock-UI: dit bewijst uitsluitend de
   requestgrens, inclusief de aparte gegevenspoort en begrensde herhaling. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const definities = [
  { naam: 'Sport', bestand: 'public/apps/sport.html', begin: 'const api=', eind: 'const eur=',
    prefix: '/api/member/sport', routes: ['/bord', '/stand', '/plattegrond', '/ticket/koop', '/tickets', '/momenten', '/sponsors', '/sponsor'] },
  { naam: 'Media', bestand: 'public/apps/media/wereld.js', begin: '  function api(', eind: '  var meldT',
    prefix: '/api/mediaos', routes: ['/wereld', '/bewaar', '/bieb'] },
  { naam: 'Vlucht', bestand: 'public/apps/vluchten-voorzijde.js', begin: 'const api =', eind: 'const START_VIEW',
    prefix: '/api/member/vluchten', routes: ['/bord', '/boek', '/mijn', '/incheck', '/pass/roteer', '/pass/intrek', '/charter'] }
];
function bron(d) {
  const tekst = fs.readFileSync(path.join(__dirname, '..', d.bestand), 'utf8');
  const begin = tekst.indexOf(d.begin), eind = tekst.indexOf(d.eind, begin);
  assert.ok(begin >= 0 && eind > begin, 'de echte helper moet herkenbaar blijven: ' + d.naam);
  return tekst.slice(begin, eind);
}
function laad(d, fetch, poort, verander = s => s) {
  return vm.runInNewContext(verander(bron(d)) + '\napi;', { fetch, TOKEN: 'test-lid', window: { RTGGegevensPoort: poort } });
}
const antwoord = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data });
function verzoek(pad, opties, verwacht, body) {
  assert.equal(pad, verwacht, 'geen dubbele prefix of relatieve route');
  assert.equal(opties.method, 'POST');
  assert.equal(opties.headers.Authorization, 'Bearer test-lid');
  assert.equal(opties.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(opties.body), body);
}
for (const d of definities) {
  async function controle(verander) {
    for (const suffix of d.routes) {
      const pad = d.prefix + suffix, body = { id: 'test-object', aantal: 2 };
      let n = 0;
      const api = laad(d, async (p, o) => { n++; verzoek(p, o, pad, body); return antwoord(200, { id: 'antwoord' }); }, null, verander);
      assert.equal((await api(pad, body)).id, 'antwoord');
      assert.equal(n, 1);
    }
  }
  test(d.naam + ': exacte API-route, actor en inhoud blijven behouden', () => controle());
  test(d.naam + ': de requestproef detecteert prefix- en autorisatiemutaties', async () => {
    await assert.rejects(controle(s => s.replace('fetch(pad,', "fetch('" + d.prefix + "' + pad,")), /dubbele prefix/);
    await assert.rejects(controle(s => s.replace(/Authorization:\s*'Bearer '\s*\+\s*TOKEN/, "Authorization: 'Bearer ander'")), /Bearer ander/);
  });
}
for (const d of definities.filter(x => x.naam !== 'Media')) {
  test(d.naam + ': gegevenspoort opent eigen route en hervat uitsluitend de oorspronkelijke aanvraag', async () => {
    const pad = d.prefix + (d.naam === 'Sport' ? '/ticket/koop' : '/boek');
    const body = { id: 'vlucht-of-wedstrijd', idem: 'vaste-aanvraag' }, stappen = [];
    let poorten = 0;
    const api = laad(d, async (p, o) => {
      stappen.push(p);
      if (p === '/api/gegevens/start') {
        verzoek(p, o, p, { soort: 'vlucht' });
        return antwoord(200, { klaar: true });
      }
      verzoek(p, o, pad, body);
      return stappen.length === 1 ? antwoord(428, { error: 'Paspoortgegevens ontbreken.', soort: 'vlucht' }) : antwoord(200, { boeking: 'bevestigd' });
    }, { vang(data, status, opnieuw, call) {
      if (status !== 428) return null;
      poorten++;
      return call('/api/gegevens/start', { soort: data.soort }).then(() => opnieuw());
    } });
    assert.equal((await api(pad, body)).boeking, 'bevestigd');
    assert.deepEqual(stappen, [pad, '/api/gegevens/start', pad]);
    assert.equal(poorten, 1);
  });
  test(d.naam + ': tweede 428 wordt niet eindeloos herhaald en gewone fout blijft afgewezen', async () => {
    let n = 0, poorten = 0;
    const api = laad(d, async () => { n++; return antwoord(428, { error: 'Nog steeds gegevens nodig.' }); },
      { vang(data, status, opnieuw) { poorten++; return opnieuw(); } });
    await assert.rejects(api(d.prefix + '/boek', {}), /Nog steeds gegevens nodig/);
    assert.equal(n, 2); assert.equal(poorten, 1);
    const fout = laad(d, async () => antwoord(403, { error: 'Niet bevoegd.' }));
    await assert.rejects(fout(d.prefix + '/boek', {}), /Niet bevoegd/);
  });
}
