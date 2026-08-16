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
    verwerking: 'geen-model',
    privacy: 'geen-model',
    aanbieders: [],
    mogelijkheden: { tekst: false, hulpmiddelen: false, beeld: false },
    routes: { tekst: [], hulpmiddelen: [], beeld: [] },
    kernprocessen: 'beschikbaar',
    uitwijk: {
      navigatie: 'menu-en-zoeken',
      uitvoering: 'schermen-en-workflows',
      samenvatten: 'lokale-extractie',
      beslissingen: 'menselijk-akkoord'
    }
  });
});

test('lokale AI wordt als prive lokale verwerking getoond', () => {
  const { maakAI, beschikbaarheid } = require('../server/ai');
  const ai = maakAI({ localUrl: 'http://127.0.0.1:11434', local: { model: 'rtg-local', tools: true }, externUit: true });
  const s = beschikbaarheid(ai);
  assert.equal(s.beschikbaar, true);
  assert.equal(s.modus, 'lokaal');
  assert.equal(s.verwerking, 'op-dit-apparaat');
  assert.deepEqual(s.aanbieders, ['local']);
  assert.equal(s.mogelijkheden.tekst, true);
  assert.equal(s.mogelijkheden.hulpmiddelen, true);
  assert.equal(s.mogelijkheden.beeld, false);
});

test('een modelserver op het eigen netwerk wordt niet als verwerking op dit apparaat gelabeld', () => {
  const { maakAI, beschikbaarheid } = require('../server/ai');
  const ai = maakAI({ localUrl: 'http://192.168.1.20:11434',
    local: { model: 'rtg-local', lanToestaan: true }, externUit: true });
  const s = beschikbaarheid(ai);
  assert.equal(s.modus, 'lokaal');
  assert.equal(s.verwerking, 'eigen-netwerk');
  assert.equal(s.privacy, 'eigen-netwerk');
});

test('een externe uitwijk naast lokaal wordt zichtbaar als hybride, nooit als volledig prive', () => {
  const { maakAI, beschikbaarheid } = require('../server/ai');
  const ai = maakAI({ localUrl: 'http://127.0.0.1:11434', local: { model: 'rtg-local', tools: false },
    anthropicKey: 'sk-test', anthropic: { apiKey: 'sk-test' } });
  const s = beschikbaarheid(ai);
  assert.equal(s.modus, 'hybride');
  assert.equal(s.verwerking, 'lokaal-met-externe-uitwijk');
  assert.equal(s.privacy, 'kan-extern-verwerken');
  assert.equal(s.routes.tekst[0], 'local');
  assert.ok(s.routes.tekst.includes('claude'));
});

test('productiegrens laat lokaal draaien terwijl externe AI bewust uit staat', () => {
  const { keurAi } = require('../server/config/productie-ai');
  const fouten = [], waarschuwingen = [];
  keurAi({ RTG_EXTERNE_AI_UIT: '1', LOCAL_AI_URL: 'http://127.0.0.1:11434', LOCAL_AI_MODEL: 'rtg-local' }, fouten, waarschuwingen);
  assert.deepEqual(fouten, []);
  assert.ok(waarschuwingen.some(w => /lokale AI/i.test(w) && /externe AI.*uit/i.test(w)));
});

test('de centrale bedieningslaag houdt een handmatige route zichtbaar', () => {
  const lees = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  const tab = lees('public/shared/rahul-tab.js');
  const consoleLaag = lees('public/shared/command/console.js');
  assert.match(tab, /Handmatige werkmodus · alles blijft bruikbaar/);
  assert.match(tab, /Lokale intelligentie · privé op dit apparaat/);
  assert.match(tab, /Lokale intelligentie · eigen omgeving/);
  assert.match(tab, /Lokaal eerst · externe uitwijk zichtbaar/);
  assert.match(tab, /werkblad, navigatie en alle handmatige functies blijven gewoon beschikbaar/i);
  assert.match(consoleLaag, /Navigatie, instellingen en alle werkbladen blijven werken/);
});

test('de vrije assistent noemt de regelstand geen demo', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server/routes/member/assistent.js'), 'utf8');
  assert.match(bron, /source: 'regels'/);
  assert.match(bron, /modus: 'handmatig'/);
  assert.doesNotMatch(bron, /source: 'demo'/);
});

test('de centrale healthroute meldt de werkelijke modelgrens, niet claude of demo', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server/server.js'), 'utf8');
  const health = bron.slice(bron.indexOf("app.get('/api/health'"), bron.indexOf("app.get('/api/health'") + 500);
  assert.match(health, /beschikbaarheid\(anthropic\)/);
  assert.doesNotMatch(health, /anthropic \? 'claude' : 'demo'/);
});
