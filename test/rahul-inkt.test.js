/* Gerichte regressies voor de echte contrastkeuze van Rahul. De VM levert
   berekende kleuren aan; dit bewijst geen browsercascade of visuele kwaliteit. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const bron = fs.readFileSync(path.join(__dirname, '../public/shared/rahul-tab/inkt.js'), 'utf8');
const licht = 'rgb(250, 247, 242)';
const donker = 'rgb(12, 12, 11)';

function kies({ ds = false, tabgrond, hostgrond }) {
  const wijzigingen = [];
  let metingen = 0;
  const html = { hasAttribute: naam => naam === 'data-ds' && ds };
  const host = { parentElement: html, backgroundColor: hostgrond, color: 'rgb(255, 255, 255)' };
  const stijl = naam => ({ setProperty: (...waarden) => wijzigingen.push([naam, ...waarden]) });
  const sub = { style: stijl('onderregel') };
  const tab = {
    parentElement: host, backgroundColor: tabgrond, color: 'rgb(255, 255, 255)',
    style: stijl('tab'), querySelector: selector => selector === 'small' ? sub : null
  };
  const document = {
    querySelector: selector => selector === '.rtg-rahul-tab' ? tab : null,
    documentElement: html, readyState: 'complete'
  };
  vm.runInNewContext(bron, {
    window: {}, document,
    getComputedStyle: element => { metingen++; return element; }
  }, { filename: 'public/shared/rahul-tab/inkt.js' });
  return { wijzigingen, metingen };
}

function verwachtInkt(resultaat, waarde) {
  assert.deepEqual(resultaat.wijzigingen, [
    ['tab', 'color', waarde, 'important'],
    ['onderregel', 'color', waarde, 'important']
  ], 'de tab en onderregel krijgen dezelfde leesbare inkt');
  assert.ok(resultaat.metingen > 0);
}

test('Rahul-inkt: een volledig DS-scherm houdt zijn centrale inkt zonder meting of inline override', () => {
  const r = kies({ ds: true, tabgrond: licht, hostgrond: donker });
  assert.deepEqual(r.wijzigingen, []);
  assert.equal(r.metingen, 0);
});

test('Rahul-inkt: een dekkende lichte tab gaat vóór de donkere legacy-host', () => {
  verwachtInkt(kies({ tabgrond: licht, hostgrond: donker }), '#3A3733');
});

test('Rahul-inkt: een dekkende donkere tab gaat vóór de lichte legacy-host', () => {
  verwachtInkt(kies({ tabgrond: donker, hostgrond: licht }), '#F2EEE8');
});

test('Rahul-inkt: een transparante tab gebruikt de werkelijke lichte of donkere host', () => {
  const tabgrond = 'rgba(0, 0, 0, 0)';
  verwachtInkt(kies({ tabgrond, hostgrond: licht }), '#3A3733');
  verwachtInkt(kies({ tabgrond, hostgrond: donker }), '#F2EEE8');
});
