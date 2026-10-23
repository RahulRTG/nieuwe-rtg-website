'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { paden } = require('../scripts/lib/schermroutepaden');

test('verfijnt een lokale API-helper met uitsluitend letterlijke aanroepen', () => {
  const r = paden(`
    const api = (pad, body) => fetch('/api/member/rechterhand/' + pad, { body });
    api('cellier');
    await api('cellier/zet', { naam: 'Een' });
  `);
  assert.deepEqual(r.exact, ['/api/member/rechterhand/cellier', '/api/member/rechterhand/cellier/zet']);
  assert.deepEqual(r.voorvoegsels, []);
  assert.deepEqual(r.verfijndeHelpers, [{
    naam: 'api', prefix: '/api/member/rechterhand/',
    exactePaden: ['/api/member/rechterhand/cellier', '/api/member/rechterhand/cellier/zet']
  }]);
});

test('houdt het brede voorvoegsel bij een variabel argument', () => {
  const r = paden(`
    const api = (pad, body) => fetch('/api/member/rechterhand/' + pad, { body });
    api(gekozenPad, {});
    api('cellier');
  `);
  assert.deepEqual(r.exact, []);
  assert.deepEqual(r.voorvoegsels, ['/api/member/rechterhand/']);
  assert.deepEqual(r.verfijndeHelpers, []);
});

test('houdt het brede voorvoegsel wanneer de helper wordt doorgegeven', () => {
  const r = paden(`
    const api = (pad) => fetch('/api/office/' + pad);
    const later = api;
    api('agenda');
  `);
  assert.deepEqual(r.exact, []);
  assert.deepEqual(r.voorvoegsels, ['/api/office/']);
});

test('vernauwt een prefix niet wanneer dezelfde prefix elders dynamisch voorkomt', () => {
  const r = paden(`
    const api = (pad) => fetch('/api/office/' + pad);
    api('agenda');
    fetch('/api/office/' + willekeurig);
  `);
  assert.deepEqual(r.exact, ['/api/office/agenda']);
  assert.deepEqual(r.voorvoegsels, ['/api/office/']);
});

test('behoudt bestaande exacte, template- en queryclassificatie', () => {
  const r = paden("fetch('/api/exact'); fetch(`/api/ding/${id}`); fetch('/api/doc?file=' + naam)");
  assert.deepEqual(r.exact, ['/api/exact']);
  assert.deepEqual(r.voorvoegsels, ['/api/ding/', '/api/doc?file=']);
});
