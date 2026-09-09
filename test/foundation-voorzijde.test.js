'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(root, p), 'utf8');
const html = lees('public/apps/foundation/index.html');
const gedrag = lees('public/apps/foundation/voorzijde.js');
const beeld = lees('public/apps/foundation/voorzijde-weergave.js');
const css = lees('public/shared/rtg-foundation-thuis-2026.css');

test('FoundationOS draagt het goedgekeurde persoonlijke drieluik', () => {
  assert.match(html, /FoundationOS persoonlijk overzicht/);
  for (const paneel of ['vandaag', 'groei', 'kring']) assert.match(html, new RegExp('data-rtf-paneel="' + paneel + '"'));
  for (const kop of ['Vandaag hoeft u het niet alleen te doen', 'Groeien op uw eigen tempo', 'De juiste mensen, dichtbij']) assert.match(html, new RegExp(kop));
  for (const bestand of ['rtg-foundation-thuis-2026.css', 'voorzijde-weergave.js', 'voorzijde.js']) assert.equal((html.match(new RegExp(bestand.replace(/[.]/g, '\\.'), 'g')) || []).length, 1, bestand);
});

test('de voorzijde gebruikt alleen bestaande Foundation-bronnen', () => {
  for (const pad of ['/gezin/agenda/bereik', '/api/rtf/leerling/paspoort', '/api/rtf/leerling/dag', '/api/rtf/leven/kring']) assert.ok(gedrag.includes(pad), pad);
  assert.match(beeld, /info\.profielen/);
  assert.doesNotMatch(beeld, /Samira|Sanne de Vries|09:30|15:00/);
  assert.match(beeld, /Er staat niets in uw agenda/);
});

test('privacy en bestaande gereedschappen blijven zichtbaar', () => {
  assert.match(html, /Een band geeft nooit automatisch toegang/);
  assert.match(html, /Volledig FoundationOS|Alle apps/);
  assert.match(html, /Rustig overzicht/);
  assert.match(css, /foundation-heritage-v2\.jpg/);
  assert.match(css, /--ft-wijn:#861936/);
});

test('de nieuwe FoundationOS-modules blijven klein', () => {
  for (const bestand of ['public/apps/foundation/voorzijde.js', 'public/apps/foundation/voorzijde-weergave.js', 'public/shared/rtg-foundation-thuis-2026.css']) assert.ok(Buffer.byteLength(lees(bestand)) < 10 * 1024, bestand + ' is te groot');
});
