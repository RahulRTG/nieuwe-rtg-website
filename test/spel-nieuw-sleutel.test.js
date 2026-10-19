/* Elk scherm dat "Nodig uit en start" aanroept, stuurt de herhaalsleutel mee
   (19 oktober 2026). De kern onthoudt hem bij het potje (kern/spellen/
   dubbeltik.js), maar een scherm dat hem niet meestuurt heeft die bescherming
   in de praktijk niet: een tweede tik maakt dan een tweede potje.

   Draai los: node --test test/spel-nieuw-sleutel.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const lees = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
/* De aanroep van "nieuw": spelen.html noemt het pad letterlijk (de gezinsmodus
   schrijft het om naar /api/rtf/spel/nieuw), de twee gezinsschermen roepen
   api('nieuw', ...) aan op /api/rtf/spel/. */
const SCHERMEN = {
  'public/apps/spelen.html': /api\('\/api\/member\/spel\/nieuw',\s*\{[^;]*\}\s*\)/g,
  'public/apps/foundation/societeit.html': /api\('nieuw',\s*\{[^;]*\}\s*\)/g,
  'public/apps/foundation/arena.html': /api\('nieuw',\s*\{[^;]*\}\s*\)/g
};

test('elk scherm stuurt bij "nieuw" een herhaalsleutel mee, en maakt hem een keer per handeling', () => {
  for (const [bestand, patroon] of Object.entries(SCHERMEN)) {
    const bron = lees(bestand);
    const aanroepen = bron.match(patroon) || [];
    assert.ok(aanroepen.length >= 1, bestand + ': geen aanroep van "nieuw" gevonden');
    for (const a of aanroepen) assert.match(a, /\bidem\s*:/, bestand + ' roept "nieuw" aan zonder herhaalsleutel: ' + a.slice(0, 80));
    assert.match(bron, /dataset\.idem\s*=\s*RTGIdem\(/, bestand + ': de sleutel hoort per handeling op de knop te staan, niet per verzoek');
  }
});
