/* Regel 42 zelf, zonder de volledige keuring of een gekopieerde analyser.
   De bron en parser/walker zijn echt; alleen de ene gelezen bundel is geheugen.
   Een factory kan functies teruggeven die buiten opnieuw gebonden worden.
   Dat is geen scopelek, maar een objectsleutel of default-RHS bindt geen naam. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse } = require('../scripts/ast/parser');
const { bundel } = require('../scripts/bundel');

const ROOT = path.join(__dirname, '..');
const CHECK = path.join(ROOT, 'scripts/check.js');
const bron = fs.readFileSync(CHECK, 'utf8');
const begin = bron.indexOf("console.log('\\n42) ");
const eind = bron.indexOf('/* 43)', begin);
assert.ok(begin >= 0 && eind > begin, 'de echte regel 42 heeft herkenbare grenzen');
const regel = bron.slice(begin, eind);

function meet(inhoud) {
  const fouten = [], goed = [];
  const modules = {
    './ast/walk': require('../scripts/ast/walk'),
    './lib/vrijenamen': require('../scripts/lib/vrijenamen'),
    './bundel': { bundels: { 'apps/proef.js': 'apps/proef' } }
  };
  vm.runInNewContext(regel, {
    ROOT, path, ontleed: parse,
    fs: { readFileSync: (bestand, encoding) => {
      assert.equal(bestand, path.join(ROOT, 'public/apps/proef.js'));
      assert.equal(encoding, 'utf8'); return inhoud;
    } },
    require: naam => {
      assert.ok(Object.hasOwn(modules, naam), 'geen onverwachte afhankelijkheid: ' + naam);
      return modules[naam];
    },
    console: { log() {} }, fout: melding => fouten.push(melding), ok: melding => goed.push(melding)
  }, { filename: CHECK + ':regel42' });
  return { fouten, goed };
}
const programma = gebruik => '(function(){ function maak(){ function doel(){} return {doel}; } ' + gebruik + ' })();';

test('regel42 blijft de oorspronkelijke functies binnen renderFacturenLid afwijzen', () => {
  const uit = meet('(function(){ function renderFacturenLid(){ function renderVooruit(){} function postVoorstel(){} } renderVooruit(); postVoorstel(); })();');
  assert.equal(uit.fouten.length, 2);
  assert.match(uit.fouten[0], /renderVooruit\(\).*buiten de functie/);
  assert.match(uit.fouten[1], /postVoorstel\(\).*buiten de functie/);
  assert.deepEqual(uit.goed, []);
});

test('regel42 telt de echte destructuringbinding naast de interne factoryfunctie', () => {
  const uit = meet(programma('const {doel} = maak(); doel();'));
  assert.deepEqual(uit.fouten, []);
  assert.equal(uit.goed.length, 1);
});

test('regel42 loopt geneste object-, array-, default- en restbindingsdoelen af', () => {
  for (const declaratie of [
    'const {nest: {doel}} = bron;',
    'const [, doel] = bron;',
    'const {waarde: doel = alternatief} = bron;',
    'const {nest: [doel = alternatief]} = bron;',
    'const {...doel} = bron;',
    'const [eerste, ...doel] = bron;'
  ]) {
    // Deze regel bewijst naam-bereik, niet of iedere gebonden waarde callable is.
    assert.deepEqual(meet(programma(declaratie + ' doel();')).fouten, [], declaratie);
  }
});

test('regel42 telt bindingspatronen van declaratie-, expressie- en pijlparameters', () => {
  for (const gebruik of [
    'function buiten({doel}){ doel(); }',
    'const buiten = function([doel]){ doel(); };',
    'const buiten = ({nest:{doel = alternatief}}) => doel();',
    'function buiten(...doel){ doel(); }'
  ]) assert.deepEqual(meet(programma(gebruik)).fouten, [], gebruik);
});

test('regel42 blijft alias-sleutels, computed keys en default-RHS als niet-binding afwijzen', () => {
  for (const declaratie of [
    'const {doel: ander} = maak();',
    'const {[doel]: ander} = bron;',
    'const {ander = doel} = bron;',
    'const [ander = doel] = bron;',
    'const object = {doel: alternatief};'
  ]) {
    const uit = meet(programma(declaratie + ' doel();'));
    assert.equal(uit.fouten.length, 1, declaratie);
    assert.match(uit.fouten[0], /doel\(\).*buiten de functie/, declaratie);
  }
});

test('regel42 houdt een ongebonden default-parameter-RHS rood', () => {
  const uit = meet(programma('function buiten(ander = doel){ doel(); }'));
  assert.equal(uit.fouten.length, 1);
  assert.match(uit.fouten[0], /doel\(\).*buiten de functie/);
});

test('regel42 leest de huidige echte app-bronbundel zonder factory-vals-alarmen', () => {
  const uit = meet(bundel('apps/app-main.js').toString('utf8'));
  assert.deepEqual(uit.fouten, []);
  assert.equal(uit.goed.length, 1);
});

test('regel42 blijft een niet-ontleedbare bundel als fout melden', () => {
  const uit = meet('(function(){');
  assert.equal(uit.fouten.length, 1);
  assert.match(uit.fouten[0], /ontleedt niet/);
  assert.deepEqual(uit.goed, []);
});
