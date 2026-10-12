'use strict';
/* Draait IN het gepubliceerde image (scripts/lib/artefacttest.js mount dit bestand
   read-only en zet RTG_IN_IMAGE=1) EN in de gewone suite. De aanwijzing waar de
   bytes vandaan komen is APP: binnen het image /app, daarbuiten de werkboom. Wat
   hier slaagt in de werkboom zegt niets over de gepubliceerde bytes; alleen de
   run in het image doet dat, en alleen daar wordt de commit tegen het ingebakken
   releasebewijs gehouden. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BINNEN = process.env.RTG_IN_IMAGE === '1';
const APP = BINNEN ? '/app' : path.join(__dirname, '..');

test('het ingebakken releasebewijs hoort bij de commit die getest wordt (binnen het image)', () => {
  if (!BINNEN) return assert.ok(true, 'buiten het image: er is geen ingebakken bewijs om te vergelijken');
  const b = JSON.parse(fs.readFileSync('/app/release-bewijs.json', 'utf8'));
  assert.match(process.env.RTG_VERWACHTE_COMMIT || '', /^[a-f0-9]{40,64}$/);
  assert.equal(String(b.bron && b.bron.commit).toLowerCase(), process.env.RTG_VERWACHTE_COMMIT);
});

test('de vertrouwenslaag en het auditboek laden uit dezelfde bytes als waar ze draaien', () => {
  const trust = require(path.join(APP, 'server/config/release-trust'));
  assert.equal(Object.keys(trust.anchors(APP)).length, 3);
  const boek = require(path.join(APP, 'server/kern/auditboek'));
  assert.equal(typeof boek.maak, 'function');
  assert.equal(boek.BEWAARDAGEN, 730);
});

test('de ketenmodule weigert een lege keten en een onbekend anker', () => {
  const k = require(path.join(APP, 'scripts/lib/artefactketen'));
  assert.equal(k.controleer({ formaat: k.FORMAAT, records: [] }, null).ok, false);
  assert.equal(k.controleer(null, null).ok, false);
});
