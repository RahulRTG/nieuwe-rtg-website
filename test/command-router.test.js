'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function router() {
  const document = { readyState: 'loading', addEventListener() {} };
  const window = { matchMedia() { return { matches: false, addEventListener() {} }; } };
  const catalogus = fs.readFileSync(path.join(__dirname, '../public/shared/command/catalog.js'), 'utf8');
  const bron = fs.readFileSync(path.join(__dirname, '../public/shared/command.js'), 'utf8');
  const context = { window, document, location: { href: '' }, setTimeout, clearTimeout, console };
  vm.runInNewContext(catalogus, context);
  vm.runInNewContext(bron, context);
  return window.RTGCommand;
}

test('Rahul routeert op appnaam en niet op de positie in de catalogus', () => {
  const r = router();
  const gevallen = {
    'open mijn tijdlijn': ['/apps/sociaal.html', 'Sociaal'],
    'open de media studio': ['/apps/media.html', 'Media'],
    'toon het gastdossier': ['/apps/reisboek.html', 'Gastdossier'],
    'open het restaurant': ['/apps/horeca.html', 'Horeca'],
    'breng me naar mijn vlucht': ['/apps/reizen-veilig.html', 'Reizen & Veilig'],
    'open mijn bank': ['/apps/geld-command.html', 'Geld'],
    'ga naar home': ['/apps/vandaag.html', 'Vandaag']
  };
  for (const [vraag, verwacht] of Object.entries(gevallen)) {
    const uit = r.herken(vraag);
    assert.deepEqual([uit.url, uit.naam], verwacht, vraag);
  }
});

test('een onbekende opdracht opent niet stil een willekeurige app', () => {
  assert.equal(router().herken('bereken een onbekende kwantumroute'), null);
});
