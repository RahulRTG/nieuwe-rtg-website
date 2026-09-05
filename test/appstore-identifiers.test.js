'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { maakContext } = require('../server/kern/appstore/context');

const ROOT = path.join(__dirname, '..');
const GROEPEN = Object.freeze({
  'server/routes/appstore/lid.js': {
    poort:'auth', routes:[
      '/api/appstore/berichten', '/api/appstore/berichten/gelezen',
      '/api/appstore/brug', '/api/appstore/context/geef',
      '/api/appstore/context/klaarzet', '/api/appstore/dossier',
      '/api/appstore/installeer', '/api/appstore/open',
      '/api/appstore/tijdlijn', '/api/appstore/verleen',
      '/api/appstore/vernietig', '/api/appstore/weg',
      '/api/appstore/wis-opslag'
    ]
  },
  'server/routes/appstore/kopen.js': {
    poort:'auth', routes:['/api/appstore/bon', '/api/appstore/koop']
  },
  'server/routes/appstore/kantoor.js': {
    poort:'officeAuth', routes:['/api/appstore/kantoor/intrekken']
  },
  'server/routes/appstore/persoon.js': {
    poort:'auth', routes:[
      '/api/appstore/persoon/dossier', '/api/appstore/persoon/intrekken'
    ]
  },
  'server/routes/appstore/uitgever.js': {
    poort:'supplierAuth', routes:[
      '/api/appstore/uitgever/dossier', '/api/appstore/uitgever/intrekken',
      '/api/appstore/uitgever/voorbeeld'
    ]
  }
});

function escape(waarde) {
  return waarde.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('iedere gecategoriseerde App Store-route heeft zijn echte identiteitspoort', () => {
  for (const [bestand, groep] of Object.entries(GROEPEN)) {
    const bron = fs.readFileSync(path.join(ROOT, bestand), 'utf8');
    for (const route of groep.routes) {
      const patroon = new RegExp("app\\.post\\('" + escape(route) + "',\\s*" + groep.poort + "[,)]");
      assert.match(bron, patroon, bestand + ' ' + route);
    }
  }
});

test('een context-id is alleen binnen dezelfde ledensessie en voor de bedoelde app bruikbaar', () => {
  const staat = {};
  let saves = 0;
  const context = maakContext({ S:() => staat, save:() => { saves++; },
    nu:() => '2026-09-05T10:00:00.000Z' });
  const gemaakt = context.klaarzet('lid-a', 'calculator', { bedrag:12.5 });
  assert.equal(gemaakt.ok, true);
  assert.match(gemaakt.id, /^[a-f0-9]{18}$/);
  assert.equal(context.lees('lid-b', gemaakt.id).status, 404,
    'bezit van de id zonder eigenaarsessie geeft niets');
  assert.equal(context.geef('lid-a', gemaakt.id, 'andere-app').status, 403,
    'dezelfde eigenaar kan hem niet aan een andere app geven');
  assert.equal(context.geef('lid-a', gemaakt.id, 'calculator').ok, true);
  assert.equal(context.geef('lid-a', gemaakt.id, 'calculator').status, 404,
    'de overdracht is na gebruik verdwenen');
  assert.equal(saves, 2, 'alleen uitgifte en echte consumptie schrijven');
});

test('de registerroutes zijn exact de routes die deze classificatie bewijst', () => {
  const register = JSON.parse(fs.readFileSync(path.join(ROOT, 'CODECREDENTIALS.json'), 'utf8'));
  const deur = register.deuren.find(x => x.id === 'appstore.session_bound_identifiers');
  assert.ok(deur);
  const verwacht = Object.values(GROEPEN).flatMap(g => g.routes)
    .map(route => 'POST ' + route).sort();
  assert.deepEqual([...deur.routes].sort(), verwacht);
  assert.equal(deur.classificatie, 'authenticated_identifier');
  assert.equal(deur.status, 'closed');
  assert.equal(deur.release_blocker, false);
});

module.exports = { GROEPEN };
