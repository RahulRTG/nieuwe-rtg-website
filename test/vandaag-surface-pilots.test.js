/* Subroutes houden het wereldpalet, maar krijgen geen cover of tweede chrome. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const lees = bestand => fs.readFileSync(path.join(ROOT, bestand), 'utf8');
const AGENDA = lees('public/apps/agenda.html');
const REISBOEK = lees('public/apps/reisboek.html');
const WORK = lees('public/apps/werk.html');
const WORK_ENTRY = lees('public/apps/werk/command-entry.js');
const FOUNDATION = lees('public/apps/foundation/os-publiek.html');
const CSS = lees('public/shared/rtg-vandaag-luxe.css');

test('oude production-cover modules en alle includes zijn volledig weg', () => {
  for (const bestand of [
    'public/shared/rtg-vandaag-surface-model.js',
    'public/shared/rtg-vandaag-surfaces.js'
  ]) assert.equal(fs.existsSync(path.join(ROOT, bestand)), false, bestand);
  for (const html of [AGENDA, REISBOEK, WORK, FOUNDATION]) {
    assert.doesNotMatch(html, /rtg-vandaag-(?:surface-model|surfaces)\.js/);
    assert.doesNotMatch(html, /rtg-vandaag-surface-production|rtg-vandaag-surface-cover/);
  }
  assert.doesNotMatch(CSS, /\.rtg-vandaag-luxe|rtg-vandaag-surface-cover/);
});

test('Agenda, Reisboek en Projecten behouden alleen hun wereldpalet', () => {
  assert.match(AGENDA, /<body[^>]+data-rtg-world="living"[^>]+data-rtg-vandaag-luxe="surface"/);
  assert.match(REISBOEK, /<body[^>]+data-rtg-world="travel"[^>]+data-rtg-vandaag-luxe="surface"/);
  assert.match(WORK, /<body[^>]+data-rtg-world="work"[^>]+data-rtg-vandaag-surface="projecten"/);
  for (const html of [AGENDA, REISBOEK, WORK]) {
    assert.equal((html.match(/\/shared\/rtg-vandaag-luxe\.css/g) || []).length, 1);
    assert.equal((html.match(/\/shared\/rtg-vandaag-luxe\.js/g) || []).length, 1);
    assert.doesNotMatch(html, /data-rtg-world-dashboard=/);
  }
});

function voerWerkRouteUit(hash, binnen) {
  const attrs = new Map([['data-rtg-vandaag-surface', 'projecten']]);
  const inhoud = { hidden: !binnen };
  let geklikt = null;
  const document = {
    body: {
      getAttribute: naam => attrs.get(naam) || null,
      setAttribute: (naam, waarde) => attrs.set(naam, waarde),
      removeAttribute: naam => attrs.delete(naam)
    },
    getElementById: id => id === 'inhoud' ? inhoud : null,
    querySelector: selector => ({ click: () => { geklikt = selector; } })
  };
  vm.runInNewContext(WORK_ENTRY, {
    location: { hash }, document, window: { addEventListener: () => {} }, Object, String,
    decodeURIComponent, MutationObserver: function () { this.observe = () => {}; }
  });
  return { attrs, geklikt };
}

test('alleen de veilige Work-projectenhash zet het palet; Edge opent zichtbaar en blijft auto', () => {
  const project = voerWerkRouteUit('#projecten', true);
  assert.equal(project.attrs.get('data-rtg-vandaag-luxe'), 'surface');
  assert.equal(project.attrs.get('data-rtg-edge-2-state'), 'overview');
  assert.equal(project.attrs.get('data-rtg-edge-2-auto'), 'true');
  assert.equal(project.geklikt, '[data-wk="projecten"]');

  const aanval = voerWerkRouteUit('#projecten%22%5D%5Bautofocus', true);
  assert.equal(aanval.attrs.has('data-rtg-vandaag-luxe'), false);
  assert.equal(aanval.geklikt, null);
});

function foundationModus(modus) {
  const attrs = new Map([['data-rtg-vandaag-luxe', '']]);
  const document = { body: {
    setAttribute: (naam, waarde) => attrs.set(naam, waarde),
    removeAttribute: naam => attrs.delete(naam)
  } };
  const begin = FOUNDATION.indexOf('function zetVandaagModus');
  const einde = FOUNDATION.indexOf('\n}\n\nfunction meldStad', begin) + 2;
  assert.ok(begin >= 0 && einde > begin);
  const functie = FOUNDATION.slice(begin, einde);
  vm.runInNewContext("const VANDAAG_ATTR='data-rtg-vandaag-luxe';\n" + functie +
    '\nzetVandaagModus(' + JSON.stringify(modus) + ", 'RTF Almere');", { document });
  return attrs;
}

test('een gevalideerde Foundation-stad blijft in hetzelfde volledige dashboard', () => {
  const stad = foundationModus('surface');
  assert.equal(stad.get('data-rtg-vandaag-luxe'), 'home');
  assert.equal(stad.get('data-rtg-foundation-city'), 'true');
  assert.equal(stad.get('data-rtg-edge-2-state'), 'overview');
  assert.equal(stad.get('data-rtg-edge-2-auto'), 'true');

  const home = foundationModus('home');
  assert.equal(home.get('data-rtg-vandaag-luxe'), 'home');
  assert.equal(home.has('data-rtg-foundation-city'), false);
});

test('alle inline scripts van de publieke Foundationpagina zijn geldige JavaScript', () => {
  const scripts = [...FOUNDATION.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length);
  scripts.forEach((match, index) => assert.doesNotThrow(
    () => new vm.Script(match[1], { filename: 'os-publiek-inline-' + index + '.js' })));
});
