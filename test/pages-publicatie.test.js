/* PUBLIEKE WEBSITE -- main integreren is geen toestemming om te publiceren.
   Bewaakt de werkelijke Pages-werkstroom: uitsluitend een bewuste handmatige
   opdracht mag de beschermde main-bron publiceren. Beide verboden toestanden
   (automatisch starten en publiceren vanaf een andere tak) zijn afzonderlijk
   met de voorafgaande werkstroom rood aangetoond. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const bron = fs.readFileSync(path.join(__dirname, '../.github/workflows/pages.yml'), 'utf8');

test('Pages heeft uitsluitend een handmatige start, geen push-, PR- of vervolgtrigger', () => {
  const blok = /^on:\s*\n([\s\S]*?)(?=^\S|$(?![\s\S]))/m.exec(bron);
  assert.ok(blok, 'het triggerblok moet expliciet aanwezig zijn');
  assert.equal(blok[1].trim(), 'workflow_dispatch:');
});

test('de publicatiejob eist zowel een handmatige opdracht als de main-tak', () => {
  const blok = /^  deploy:\s*\n([\s\S]*?)(?=^  \S|$(?![\s\S]))/m.exec(bron);
  assert.ok(blok, 'de publicatiejob moet expliciet aanwezig zijn');
  const voorwaarde = /^    if:\s*(.+)$/m.exec(blok[1]);
  assert.ok(voorwaarde, 'de publicatiejob moet zelf afgeschermd zijn');
  assert.equal(voorwaarde[1], "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'");
});
