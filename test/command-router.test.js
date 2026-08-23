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
    'open mijn tijdlijn': ['/apps/rtg.html', 'LIFE'],
    'open de media studio': ['/apps/rtg.html', 'LIFE'],
    'toon het gastdossier': ['/apps/rtg.html', 'LIFE'],
    'breng me naar mijn vlucht': ['/apps/rtg.html', 'LIFE'],
    'open mijn bank': ['/apps/rtg.html', 'LIFE'],
    'ga naar home': ['/apps/rtg.html', 'LIFE'],
    'open Private Office': ['/apps/rtg.html', 'LIFE'],
    'open het restaurant': ['/apps/kantoor.html', 'WORK'],
    'toon mijn onderneming': ['/apps/kantoor.html', 'WORK'],
    /* os-portaal.html en niet index.html: dat laatste is de speeltuin (de
       kinder- en gezinskant) en een binnenscherm. Zie de toelichting boven
       de lijst in shared/command/catalog.js. */
    'open de stichting': ['/apps/foundation/os-portaal.html', 'FOUNDATION'],
    'open mijn passkeys': ['/apps/ik.html', 'INSTELLINGEN']
  };
  for (const [vraag, verwacht] of Object.entries(gevallen)) {
    const uit = r.herken(vraag);
    assert.deepEqual([uit.url, uit.naam], verwacht, vraag);
  }
});

test('een onbekende opdracht opent niet stil een willekeurige app', () => {
  assert.equal(router().herken('bereken een onbekende kwantumroute'), null);
});
