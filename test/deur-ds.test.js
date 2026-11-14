'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const bron = fs.readFileSync('public/shared/deur.js', 'utf8');

function omgeving(ds) {
  const stijlen = [];
  const html = { hasAttribute(naam) { return naam === 'data-ds' && ds; } };
  const document = {
    documentElement: html,
    title: 'Reizen · RTG',
    head: { appendChild(node) { stijlen.push(node); return node; } },
    createElement(tag) { return { tagName: tag.toUpperCase() }; },
    getElementById(id) { return stijlen.find(node => node.id === id) || null; }
  };
  const localStorage = { getItem() { return null; } };
  const fetch = () => Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
  const window = { document };
  const context = vm.createContext({ window, document, localStorage, fetch, location: { pathname: '/apps/reizen.html' } });
  vm.runInContext(bron, context);
  return { api: window.RTGDeur, stijlen };
}

test('iedere deur gebruikt één centraal presentatieblad en behoudt de eerlijke toegangstekst', () => {
  const e = omgeving(false), doel = { innerHTML: '' };
  e.api.toon(doel, { soort: 'pas', pas: 'Lifestyle' });
  e.api.toon(doel, { soort: 'pas', pas: 'Lifestyle' });
  assert.equal(e.stijlen.length, 1);
  assert.deepEqual({ tag: e.stijlen[0].tagName, id: e.stijlen[0].id, rel: e.stijlen[0].rel, href: e.stijlen[0].href },
    { tag: 'LINK', id: 'rtgDsRuntimeCss', rel: 'stylesheet', href: '/ds/rtg-ds.css' });
  assert.match(doel.innerHTML, /uitsluitend op uitnodiging of na goedkeuring/);
  assert.match(doel.innerHTML, /niet deze app en niet Rahul/);
});

test('DS deur gebruikt centrale componentklassen zonder extra presentatie', () => {
  const e = omgeving(true), doel = { innerHTML: '' };
  e.api.toon(doel, { soort: 'gezin' });
  assert.equal(e.stijlen.length, 0);
  assert.match(doel.innerHTML, /ds-accountdeur ds-accountdeur--poort ds-lezer ds-lezer--pagina/);
  assert.match(doel.innerHTML, /Maak een gezin aan of sluit je aan/);
});

test('de deur ontsmet gidsinhoud voordat die in de interface kan komen', async () => {
  const e = omgeving(true), doel = { innerHTML: '' };
  const oudFetch = global.fetch;
  e.api.toon(doel, { soort: 'personeel', naar: '\" onmouseover=\"alert(1)' });
  assert.doesNotMatch(doel.innerHTML, /href="" onmouseover=/);
  assert.match(doel.innerHTML, /&quot; onmouseover=&quot;/);
  global.fetch = oudFetch;
});
