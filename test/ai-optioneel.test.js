'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('AI-beschikbaarheid onderscheidt verrijking van de werkende kern', () => {
  const { maakAI, beschikbaarheid } = require('../server/ai');
  const ai = maakAI({ anthropicKey: '', openaiKey: '', geminiKey: '', volgorde: [] });
  assert.equal(ai, null);
  assert.deepEqual(beschikbaarheid(ai), {
    beschikbaar: false,
    modus: 'handmatig',
    aanbieders: [],
    kernprocessen: 'beschikbaar',
    uitwijk: {
      navigatie: 'menu-en-zoeken',
      uitvoering: 'schermen-en-workflows',
      samenvatten: 'lokale-extractie',
      beslissingen: 'menselijk-akkoord'
    }
  });
});

test('de centrale bedieningslaag houdt een handmatige route zichtbaar', () => {
  const lees = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  const tab = lees('public/shared/rahul-tab.js');
  const consoleLaag = lees('public/shared/command/console.js');
  assert.match(tab, /Handmatige werkmodus · alles blijft bruikbaar/);
  assert.match(tab, /werkblad, navigatie en alle handmatige functies blijven gewoon beschikbaar/i);
  assert.match(consoleLaag, /Navigatie, instellingen en alle werkbladen blijven werken/);
});

test('de vrije assistent noemt de regelstand geen demo', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server/routes/member/assistent.js'), 'utf8');
  assert.match(bron, /source: 'regels'/);
  assert.match(bron, /modus: 'handmatig'/);
  assert.doesNotMatch(bron, /source: 'demo'/);
});
