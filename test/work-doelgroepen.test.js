/* WORK groepeert bestaande specialisten voor drie doelgroepen. De schil mag
   daarbij geen vierde rechtenbron worden: alle doelen blijven routes van WORK
   en de partneraanvraag houdt de bestaande Business Pass- en mensenpoort. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const doelgroepen = require('../public/apps/work-doelgroepen');
const wereldroutes = require('../server/kern/wereldroutes');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'kantoor.html'), 'utf8');

test('WORK toont de drie doelgroepen in de afgesproken volgorde', () => {
  assert.deepEqual(doelgroepen.VOLGORDE, ['personeel', 'ondernemers', 'aanmelden']);
  const keuzes = [...html.matchAll(/<a[^>]+data-work-kies="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(keuzes, doelgroepen.VOLGORDE);
  for (const doelgroep of doelgroepen.VOLGORDE)
    assert.match(html, new RegExp('data-work-paneel="' + doelgroep + '"'), doelgroep + ' mist een eigen WORK-paneel');
});

test('iedere doelgroep opent de bestaande specialist die erbij hoort', () => {
  const doelen = {
    personeel: ['/apps/personeel.html', '/apps/loonstrook.html', '/apps/werk.html'],
    ondernemers: ['/apps/onderneming.html', '/apps/leverancier.html', '/apps/concern.html'],
    aanmelden: ['/apps/partner-worden.html', '/apps/onderneming.html']
  };
  for (const [doelgroep, routes] of Object.entries(doelen)) {
    const begin = html.indexOf('data-work-paneel="' + doelgroep + '"');
    const einde = html.indexOf('</div>', begin);
    const paneel = html.slice(begin, einde);
    for (const route of routes) {
      assert.match(paneel, new RegExp('href="' + route.replace(/[.]/g, '\\.') + '"'),
        doelgroep + ' mist ' + route);
      assert.equal(wereldroutes.wereldVanRoute(route), 'WORK', route + ' hoort niet bij WORK');
    }
  }
});

test('de drie primaire ingangen staan ook in het volledige WORK-register', () => {
  const register = html.slice(html.indexOf('<nav class="wereldapps"'), html.indexOf('</nav>'));
  for (const route of ['/apps/personeel.html', '/apps/leverancier.html', '/apps/partner-worden.html'])
    assert.equal((register.match(new RegExp('href="' + route.replace(/[.]/g, '\\.') + '"', 'g')) || []).length, 1,
      route + ' hoort precies eenmaal in het WORK-register');
});

test('bedrijf aanmelden belooft geen automatische toegang', () => {
  const begin = html.indexOf('data-work-paneel="aanmelden"');
  const paneel = html.slice(begin, html.indexOf('</div>', begin));
  assert.match(paneel, /Business Pass/);
  assert.match(paneel, /Menselijke beoordeling/);
  assert.match(paneel, /Geen automatische toelating/);
  assert.equal(doelgroepen.normaliseer('onbekend'), 'personeel');
});
