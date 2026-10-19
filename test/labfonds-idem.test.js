/* Een toezegging per tik (server/kern/labfonds.js, doneer).

   Gevonden door de voltooiproef van het Lab-fonds (scripts/lib/voltooi/labfonds.js):
   een toezegging, een SIGKILL, en dezelfde tik opnieuw zette de bijdrage twee
   keer in de pot -- doneer kende geen herhaalsleutel. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const maak = () => require('../server/kern/labfonds')({ db: { data: {} }, save: () => {}, crypto, anthropic: null }).labfonds;

test('dezelfde sleutel legt de toezegging een keer in de pot', () => {
  const lf = maak();
  assert.equal(lf.doneer('lid1', 'Amber', 'ibiza', 10, 'k1').ok, true);
  const weer = lf.doneer('lid1', 'Amber', 'ibiza', 10, 'k1');
  assert.equal(weer.ok, true);
  assert.equal(weer.herhaald, true);
  assert.equal(lf.fonds('lid1').mijnBijdrage, 10);
  assert.equal(lf.fonds('lid1').locaties.find((l) => l.id === 'ibiza').pot, 10);
});

test('dezelfde sleutel voor een ander bedrag is een conflict, geen stille herhaling', () => {
  const lf = maak();
  lf.doneer('lid1', 'Amber', 'ibiza', 10, 'k1');
  assert.equal(lf.doneer('lid1', 'Amber', 'ibiza', 20, 'k1').status, 409);
  assert.equal(lf.fonds('lid1').mijnBijdrage, 10);
});

test('de sleutel is per lid: een ander lid met dezelfde sleutel zegt gewoon toe', () => {
  const lf = maak();
  lf.doneer('lid1', 'Amber', 'ibiza', 10, 'k1');
  assert.equal(lf.doneer('lid2', 'Bram', 'ibiza', 10, 'k1').ok, true);
  assert.equal(lf.fonds('lid2').mijnBijdrage, 10);
  assert.equal(lf.fonds('lid1').locaties.find((l) => l.id === 'ibiza').pot, 20);
});

test('zonder sleutel blijft het oude gedrag: elke tik een toezegging', () => {
  const lf = maak();
  lf.doneer('lid1', 'Amber', 'ibiza', 10);
  lf.doneer('lid1', 'Amber', 'ibiza', 10);
  assert.equal(lf.fonds('lid1').mijnBijdrage, 20);
});

/* Een voorstel per tik (voorstelMaak): een dubbele tik op Indienen gaf twee
   voorstellen voor dezelfde pot, met twee stemmingen ernaast. */
const DOEL = 'Tien bomen langs de gracht, geplant met de buurt en twee jaar onderhouden.';

test('dezelfde sleutel dient een voorstel een keer in', () => {
  const lf = maak();
  const a = lf.voorstelMaak('lid1', 'Amber', 'ibiza', 'Bomen', DOEL, 20, '', 'v1');
  const b = lf.voorstelMaak('lid1', 'Amber', 'ibiza', 'Bomen', DOEL, 20, '', 'v1');
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(b.herhaald, true);
  assert.equal(b.voorstel.id, a.voorstel.id);
  assert.equal(lf.fonds('lid1').voorstellen.length, 1);
});

test('dezelfde sleutel voor een ander voorstel is een conflict', () => {
  const lf = maak();
  lf.voorstelMaak('lid1', 'Amber', 'ibiza', 'Bomen', DOEL, 20, '', 'v1');
  assert.equal(lf.voorstelMaak('lid1', 'Amber', 'ibiza', 'Bankjes', DOEL, 20, '', 'v1').status, 409);
  assert.equal(lf.fonds('lid1').voorstellen.length, 1);
});
