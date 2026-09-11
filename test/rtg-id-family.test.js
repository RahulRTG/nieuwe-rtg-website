'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const lees = (bestand) => fs.readFileSync(path.join(ROOT, bestand), 'utf8');
const VORM = lees('public/apps/app-main/app-main-04aaaa.js') +
  lees('public/apps/app-main/app-main-04aaaaa.js');
const INHOUD = lees('public/apps/app-main/app-main-04b.js');
const GEDRAG = lees('public/apps/app-main/app-main-05.js');
const EDGE = lees('public/shared/rtg-edge-library.js');

test('RTG ID gebruikt op breed en klein scherm dezelfde Edge-insets', () => {
  assert.match(VORM, /#gate:has\(\.ag-doos\.ag-ballotage\)/);
  assert.match(VORM, /var\(--edge-top,44px\)/);
  assert.match(VORM, /var\(--edge-bottom,48px\)/);
  assert.match(VORM, /grid-template-columns:minmax\(20rem,1fr\) minmax\(27rem,\.88fr\)/);
  assert.match(VORM, /@media \(max-width:899px\)/);
  assert.match(VORM, /--klokschaal:\.42/);
});

test('het officiële RTG-woordmerk ligt zonder eigen kleurvlak in de Edge-balk', () => {
  assert.match(EDGE, /rtg-edge-mark-lockup/);
  assert.match(EDGE, /Rahul Travel Group/);
  assert.match(EDGE, /Experience the elite class/);
  assert.match(VORM, /\.rtg-edge-mark-lockup strong/);
  assert.match(VORM, /\.rtg-edge-top\{[^}]*background:var\(--edge-bar-bg\)!important/);
  assert.match(VORM, /\.rtg-edge-mark\{[^}]*background:transparent!important/);
  assert.match(VORM, /\.rtg-edge-mark-lockup strong\{[^}]*background:transparent!important/);
  assert.match(VORM, /color:#d8bd6b/);
});

test('de ballotage gebruikt geen tweede functierail of Command-laag', () => {
  assert.match(VORM, /\.rtg-edge-side\{[^}]*transform:translateX\(-101%\)!important;visibility:hidden/);
  assert.match(VORM, /#rtgCommand \.cmd-bank/);
  assert.match(VORM, /#rtgCommand \.cmd-balk\{display:none!important/);
});

test('de ballotage geeft de vraag prioriteit en behoudt Rahuls signatuur', () => {
  assert.match(VORM, /\.ag-doos\.ag-ballotage \.ag-zin/);
  assert.match(VORM, /text-align:left/);
  assert.match(VORM, /\.ag-doos\.ag-ballotage \.ag-mond/);
  assert.doesNotMatch(VORM, /\.ag-doos\.ag-ballotage \.ag-mond\{[^}]*display:none/);
  assert.match(VORM, /#f4ede1/);
  assert.match(VORM, /\.rtg-id-story h1/);
  assert.match(INHOUD, /Uw toegang begint met een gesprek/);
  assert.match(INHOUD, /ag-id-privacy/);
});

test('de vier stappen zijn ook voor hulptechnologie betekenisvol', () => {
  assert.match(INHOUD, /id="agStappen" role="status" aria-live="polite"/);
  assert.match(GEDRAG, /T\('ag\.stap','Stap'\)/);
  assert.match(GEDRAG, /T\('ag\.van','van'\)/);
  assert.match(GEDRAG, /removeAttribute\('aria-label'\)/);
});
