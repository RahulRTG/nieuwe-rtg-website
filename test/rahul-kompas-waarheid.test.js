'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function scherm() {
  const nodes = new Map(), html = [];
  function querySelector(sel) {
    if (!nodes.has(sel)) nodes.set(sel, { textContent: '', dataset: {}, querySelector,
      classList: { toggle() {} }, insertAdjacentHTML(_positie, bron) { html.push(bron); } });
    return nodes.get(sel);
  }
  const window = { __rahulTabCommand: { page: { querySelector } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/shared/rahul-tab/kompas.js'), 'utf8'), { window });
  return { api: window.RTGKompas, html: html.join(''), tekst: sel => querySelector(sel).textContent,
    route: () => querySelector('[data-kompas]').dataset.route };
}
test('Kompas begint zonder veiligheids- of privacybewijs', () => {
  const s = scherm();
  assert.match(s.html, /ROUTE NOG ONBEKEND/);
  assert.match(s.html, /Nog geen actuele privacy-informatie ontvangen/);
  assert.doesNotMatch(s.html, /VEILIGE ROUTE|gecontroleerd/);
});
test('Kompas toont bestaande serverroutes en privacy letterlijk, onbekend krijgt geen positief fallbackbewijs', () => {
  const s = scherm();
  for (const [route, label] of Object.entries({ 'rtg-server': 'EIGEN RTG-SERVER', 'eigen-netwerk': 'EIGEN OMGEVING', hybride: 'LOKAAL + ZICHTBARE UITWIJK', extern: 'EXTERNE MODELROUTE', regels: 'REGELROUTE' })) {
    s.api.toon({ kompas: { route, privacy: '<servermelding>' } });
    assert.equal(s.tekst('[data-kompas-route]'), label);
    assert.equal(s.tekst('[data-kompas-privacy]'), '<servermelding>');
    assert.equal(s.route(), route);
  }
  for (const kompas of [{}, { route: 'nieuw' }, { route: 'constructor', privacy: {} }, { privacy: '  ' }]) {
    s.api.toon({ kompas });
    assert.equal(s.route(), 'onbekend');
    assert.equal(s.tekst('[data-kompas-route]'), 'ROUTE NOG ONBEKEND');
    assert.equal(s.tekst('[data-kompas-privacy]'), 'Geen privacy-informatie ontvangen');
  }
});
test('nieuwe vraag, ontbrekend antwoord en foutantwoord wissen vorige route en privacy', () => {
  for (const reset of [s => { s.api.denkt(true); s.api.denkt(false); }, s => s.api.toon({}),
    s => s.api.toon({ error: 'mislukt', kompas: { route: 'rtg-server' } }),
    s => s.api.toon({ ok: false, kompas: { route: 'rtg-server' } }), s => s.api.toon({ kompas: [] })]) {
    const s = scherm(); s.api.toon({ kompas: { route: 'rtg-server', privacy: 'oude melding' } }); reset(s);
    assert.equal(s.route(), 'onbekend');
    assert.equal(s.tekst('[data-kompas-privacy]'), 'Nog geen actuele privacy-informatie ontvangen');
  }
});
test('uitvoeringsherkomst vereist expliciete velden en onvolledige plaatsen crashen niet', () => {
  const { api } = scherm();
  for (const uitgevoerd of [null, {}, [], { plaatsen: null }, { plaatsen: 'rtg-server' },
    { plaatsen: [] }, { plaatsen: ['nieuw'] }, { plaatsen: ['eigen-netwerk', 'nieuw'] },
    { zonderModel: 'true' }, { extern: 'true' }, { zonderModel: true, plaatsen: ['rtg-server'] }]) {
    assert.equal(api.regel({ uitgevoerd }), '');
  }
  assert.equal(api.regel({ uitgevoerd: { zonderModel: true, plaatsen: [] } }), 'RTG Kompas · beantwoord zonder model');
  assert.equal(api.regel({ uitgevoerd: { plaatsen: ['rtg-server'] } }), 'RTG Kompas · eigen modelserver van RTG');
  assert.equal(api.regel({ uitgevoerd: { plaatsen: ['eigen-netwerk'] } }), 'RTG Kompas · lokaal in eigen omgeving');
  for (const uitgevoerd of [{ extern: true }, { plaatsen: ['eigen-netwerk', 'externe-provider'] }, { zonderModel: true, extern: true }])
    assert.equal(api.regel({ uitgevoerd }), 'RTG Kompas · externe aanbieder gebruikt');
  for (const fout of [{ error: 'mislukt' }, { ok: false }])
    assert.equal(api.regel({ ...fout, uitgevoerd: { plaatsen: ['rtg-server'] } }), '');
  // Beschikbaarheid is configuratie; daadwerkelijke uitvoeringsherkomst blijft zichtbaar.
  assert.equal(api.regel({ aiBeschikbaar: false, uitgevoerd: { zonderModel: true } }), 'RTG Kompas · beantwoord zonder model');
});
