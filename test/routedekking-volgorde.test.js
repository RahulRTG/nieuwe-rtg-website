/* De werkelijke schermcontroller behoudt de nieuwste zoekopdracht wanneer
   antwoorden in omgekeerde volgorde binnenkomen. Dit is een gerichte
   ontwikkelcontrole van request-eigenaarschap, geen visuele kwalificatie. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const bron = fs.readFileSync(path.join(__dirname, '..', 'public/apps/routedekking-voorzijde.js'), 'utf8');
const afgehandeld = () => new Promise(resolve => setImmediate(resolve));

function scherm() {
  const nodes = new Map(), requests = [];
  function node(selector) {
    if (!nodes.has(selector)) nodes.set(selector, {
      value: '', checked: false, dataset: {}, options: [], textContent: '', innerHTML: '',
      events: {}, addEventListener(naam, fn) { this.events[naam] = fn; },
      appendChild(child) { this.options.push(child); }
    });
    return nodes.get(selector);
  }
  vm.runInNewContext(bron, {
    document: { documentElement: { lang: 'nl' }, querySelector: node,
      querySelectorAll: () => [], createElement: () => ({}) },
    localStorage: { getItem: key => key === 'rtg_office_token' ? 'geisoleerd-testtoken' : null },
    location: { pathname: '/apps/routedekking.html', replace: () => { throw Error('Onverwachte inlog'); } },
    fetch: (url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject }))
  });
  return { node, requests, zoek(tekst) { node('#zoek').value = tekst; node('#zoeken').events.click(); } };
}
const resultaat = (naam, aantal) => ({
  stand: 'achterhaald', totaal: aantal, gedekt: 0, ongedekt: aantal, pct: 0,
  gemeten: null, perDomein: [], lijst: { totaal: 1, pagina: 1, paginas: 1,
    resultaten: [{ methode: 'GET', pad: '/api/' + naam, gedekt: false, bewakers: [] }] }
});
async function antwoord(request, body, status = 200) {
  request.resolve({ ok: status === 200, status, json: async () => body });
  await afgehandeld();
}

test('routedekking: trage oude zoekuitkomst vervangt de nieuwe stand en lijst niet', async () => {
  const ui = scherm();
  ui.zoek('actuele keuze');
  assert.equal(ui.requests.length, 2);
  assert.deepEqual(JSON.parse(ui.requests[1].options.body), {
    zoek: 'actuele keuze', domein: '', alleenGaten: false, pagina: 1, limiet: 50
  });
  assert.equal(ui.requests[1].url, '/api/office/routedekking');
  assert.equal(ui.requests[1].options.headers.Authorization, 'Bearer geisoleerd-testtoken');
  await antwoord(ui.requests[1], resultaat('actueel', 22));
  await antwoord(ui.requests[0], resultaat('oud', 11));
  assert.equal(ui.node('#cTotaal').textContent, '22');
  assert.match(ui.node('#lijst').innerHTML, /actueel/);
  assert.doesNotMatch(ui.node('#lijst').innerHTML, /oud/);
});

test('routedekking: een fout uit een oude vraag overschrijft een geslaagde actuele vraag niet', async () => {
  for (const soort of ['netwerk', 'server']) {
    const ui = scherm();
    ui.zoek('actueel');
    await antwoord(ui.requests[1], resultaat('actueel', 22));
    const melding = ui.node('#melding').textContent;
    if (soort === 'netwerk') { ui.requests[0].reject(Error('Oude verbinding')); await afgehandeld(); }
    else await antwoord(ui.requests[0], { error: 'Oude serverfout' }, 503);
    assert.equal(ui.node('#melding').textContent, melding);
    assert.match(ui.node('#lijst').innerHTML, /actueel/);
  }
});

test('routedekking: actuele fout blijft zichtbaar tot een nieuwe bewuste zoekopdracht slaagt', async () => {
  const ui = scherm();
  ui.zoek('actueel');
  await antwoord(ui.requests[1], { error: 'Tijdelijk geen routegegevens' }, 503);
  await antwoord(ui.requests[0], resultaat('oud', 11));
  assert.equal(ui.node('#melding').textContent, 'Tijdelijk geen routegegevens');
  assert.match(ui.node('#lijst').innerHTML, /Tijdelijk geen routegegevens/);
  ui.zoek('opnieuw');
  await antwoord(ui.requests[2], resultaat('hersteld', 33));
  assert.equal(ui.node('#cTotaal').textContent, '33');
  assert.match(ui.node('#lijst').innerHTML, /hersteld/);
});
