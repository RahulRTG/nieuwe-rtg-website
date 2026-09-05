/* De eerste subschermen gebruiken dezelfde luxeschil, maar alleen nadat hun
   bestaande route veilig is opgelost. Deze toets borgt de twee pilotdeuren;
   businessdata en autorisatie blijven bij de bestaande apps. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const luxe = require('../public/shared/rtg-vandaag-luxe.js');

const ROOT = path.join(__dirname, '..');
const lees = bestand => fs.readFileSync(path.join(ROOT, bestand), 'utf8');
const WORK_HTML = lees('public/apps/werk.html');
const WORK_ENTRY = lees('public/apps/werk/command-entry.js');
const FOUNDATION = lees('public/apps/foundation/os-publiek.html');
const AGENDA = lees('public/apps/agenda.html');
const REISBOEK = lees('public/apps/reisboek.html');
const EXPERIENCE = lees('public/shared/experience-kernel.js');

test('de gedeelde runtime kent beide pilots en tekent niets in een embed', () => {
  assert.equal(luxe.normaliseerSurface('projecten'), 'projecten');
  assert.equal(luxe.normaliseerSurface('public-city'), 'public-city');
  assert.equal(luxe.normaliseerSurface('onbekend'), null);
  assert.equal(luxe.presentatieVoor('surface', true), null);
});

test('Work laadt de luxelaag na zijn eigen stijl en vóór zijn appcode', () => {
  assert.match(WORK_HTML, /<body[^>]+data-rtg-world="work"[^>]+data-rtg-vandaag-surface="projecten"/);
  assert.ok(WORK_HTML.indexOf('/shared/rtg-vandaag-luxe.css') >
    WORK_HTML.indexOf('/shared/workos-premium.css'));
  assert.ok(WORK_HTML.indexOf('/shared/rtg-vandaag-luxe.js') <
    WORK_HTML.indexOf('/apps/werk/kern.js'));
  assert.equal((WORK_HTML.match(/\/shared\/rtg-vandaag-luxe\.css/g) || []).length, 1);
  assert.equal((WORK_HTML.match(/\/shared\/rtg-vandaag-luxe\.js/g) || []).length, 1);
});

test('Living Agenda verklaart één surface en laadt de luxelaag op de veilige plaats', () => {
  assert.match(AGENDA,
    /<body[^>]+data-rtg-world="living"[^>]+data-rtg-vandaag-luxe="surface"[^>]+data-rtg-vandaag-surface="agenda"[^>]+data-rtg-vandaag-surface-title="Uw agenda"/);
  assert.equal((AGENDA.match(/data-rtg-vandaag-luxe/g) || []).length, 1);
  assert.equal((AGENDA.match(/\/shared\/rtg-vandaag-luxe\.css/g) || []).length, 1);
  assert.equal((AGENDA.match(/\/shared\/rtg-vandaag-luxe\.js/g) || []).length, 1);
  assert.ok(AGENDA.indexOf('/shared/rtg-vandaag-luxe.css') >
    AGENDA.indexOf('/shared/kantoor-tools.css?v=enterprise1'));
  assert.ok(AGENDA.indexOf('/shared/rtg-vandaag-luxe.js') >
    AGENDA.indexOf('/apps/agenda/app.js'));
  assert.ok(AGENDA.indexOf('/shared/rtg-vandaag-luxe.js') <
    AGENDA.indexOf('/shared/schermbeeld.js'));
});

test('Travel Reisboek verklaart één surface en laadt de luxelaag na zijn appcode', () => {
  assert.match(REISBOEK,
    /<body[^>]+data-rtg-world="travel"[^>]+data-rtg-vandaag-luxe="surface"[^>]+data-rtg-vandaag-surface="reisboek"[^>]+data-rtg-vandaag-surface-title="Uw reis"/);
  assert.equal((REISBOEK.match(/data-rtg-vandaag-luxe/g) || []).length, 1);
  assert.equal((REISBOEK.match(/\/shared\/rtg-vandaag-luxe\.css/g) || []).length, 1);
  assert.equal((REISBOEK.match(/\/shared\/rtg-vandaag-luxe\.js/g) || []).length, 1);
  assert.ok(REISBOEK.indexOf('/shared/rtg-vandaag-luxe.css') >
    REISBOEK.indexOf('/shared/rtg-edge-system.css'));
  assert.ok(REISBOEK.indexOf('/shared/rtg-vandaag-luxe.js') >
    REISBOEK.lastIndexOf('\nlaad();\n</script>'));
  assert.ok(REISBOEK.indexOf('/shared/rtg-vandaag-luxe.js') <
    REISBOEK.indexOf('/shared/deelmenu.js'));
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
    decodeURIComponent, setTimeout: fn => fn()
  });
  return { attrs, geklikt };
}

test('alleen de whitelisted Work-projectenhash activeert de surface', () => {
  const projecten = voerWerkRouteUit('#projecten', true);
  assert.equal(projecten.attrs.get('data-rtg-vandaag-luxe'), 'surface');
  assert.equal(projecten.attrs.get('data-rtg-vandaag-surface-title'), 'Projecten en taken');
  assert.equal(projecten.geklikt, '[data-wk="projecten"]');

  const onbekend = voerWerkRouteUit('#projecten%22%5D%5Bautofocus', true);
  assert.equal(onbekend.attrs.has('data-rtg-vandaag-luxe'), false);
  assert.equal(onbekend.geklikt, null);

  const people = voerWerkRouteUit('#people', true);
  assert.equal(people.attrs.has('data-rtg-vandaag-luxe'), false);
  assert.equal(people.geklikt, '[data-wk="people"]');
});

test('Foundation verklaart een publieke city-capability zonder de home te verliezen', () => {
  assert.match(FOUNDATION,
    /<body[^>]+data-rtg-world="foundation"[^>]+data-rtg-vandaag-luxe[^>]+data-rtg-vandaag-surface="public-city"/);
  assert.equal((FOUNDATION.match(/data-rtg-vandaag-luxe/g) || []).length, 1,
    'de statische home-opt-in blijft één keer declaratief aanwezig');
  assert.match(FOUNDATION, /r\.steden\.find\(s => stadSlug\(s\.naam\) === STADSAANVRAAG\)/);
  assert.match(FOUNDATION, /api\('stad', \{ id \}\)/);
  assert.doesNotMatch(FOUNDATION, /\/api\/rtfos\/(?!publiek\/)/,
    'de stadsroute gebruikt geen intern Foundation-endpoint');
  assert.match(FOUNDATION, /data-rtg-experience', 'off'/);
  assert.match(EXPERIENCE, /getAttribute\('data-rtg-experience'\) === 'off'/);
});

test('alle inline scripts van de publieke Foundationpagina zijn geldige JavaScript', () => {
  const scripts = [...FOUNDATION.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length, 'geen inline appcode gevonden');
  scripts.forEach((match, index) => assert.doesNotThrow(
    () => new vm.Script(match[1], { filename: 'os-publiek-inline-' + index + '.js' })));
});
