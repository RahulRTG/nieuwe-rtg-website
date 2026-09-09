'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(root, p), 'utf8');
const html = lees('public/apps/office.html');
const gedrag = lees('public/apps/office/voorzijde.js');
const dossier = lees('public/apps/office/voorzijde-dossier.js');
const besluit = lees('public/apps/office/voorzijde-besluit.js');
const bron = lees('public/apps/office/app/app-03.js');
const css = lees('public/shared/rtg-docs-2026.css');

test('RTDocs opent met Nodig, Levend dossier en Besluitklaar in WorkOS-stijl', () => {
  assert.match(html, /class="rtg-stijl rtg-work-flow rtd-voorzijde-actief"/);
  for (const paneel of ['nodig', 'dossier', 'besluit']) {
    assert.match(html, new RegExp('data-rtd-paneel="' + paneel + '"'));
  }
  assert.match(html, /Niet zoeken\. Meteen verder\./);
  assert.match(html, /Klaar om te besluiten, met zicht op wat nog ontbreekt\./);
  assert.equal((html.match(/\/shared\/rtg-docs-2026\.css/g) || []).length, 1);
  assert.equal((html.match(/\/apps\/office\/voorzijde\.js/g) || []).length, 1);
  for (const kleur of ['--docs-nacht:#061116', '--docs-goud:#c99b55', '--docs-teal:#7d9f98', '--docs-wijn:#7a1830']) {
    assert.ok(css.includes(kleur), kleur);
  }
  assert.match(css, /\.rtd-nav\{position:fixed/);
});

test('de rustige voorzijde gebruikt de bestaande Office-documentmotor', () => {
  assert.match(bron, /window\.RTGOffice = Object\.freeze/);
  assert.match(bron, /api: api/);
  assert.match(gedrag, /office\.api\('mijn'/);
  assert.match(dossier, /office\.api\('open'/);
  assert.match(dossier, /office\.api\('versies'/);
  assert.doesNotMatch(gedrag + dossier + besluit, /Nora|Campagnebegroting|€18\.000/);
});

test('besluitklaar toont echte controles en houdt goedkeuring menselijk', () => {
  assert.match(besluit, /openActies/);
  assert.match(besluit, /werkstroom\.fase/);
  assert.match(besluit, /office\.api\('fase'/);
  assert.match(besluit, /mens: false/);
  assert.match(besluit, /De mens beslist/);
  assert.doesNotMatch(besluit, /naar: 'goedgekeurd'/);
});

test('de volledige Office-suite en versiehistorie blijven bereikbaar', () => {
  assert.match(html, /data-rtd-diep="lijst"/);
  assert.match(gedrag, /office\.openen\(id\)/);
  assert.match(gedrag, /getElementById\('versiesBtn'\)/);
  assert.match(gedrag, /Rustig overzicht/);
  assert.match(gedrag, /classList\.remove\('rtd-voorzijde-actief'\)/);
});
