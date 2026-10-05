/* ============================================================================
   DE SERVERHELFT VAN DE CONTEXTDOORGIFTE -- een echte server, een deelronde.

   scripts/contextdoorgifte.js start een wegwerpserver met de peiling als
   preload, rijdt de eerste routes en vergelijkt I1, I3, I4 en I10 met de ratel
   in CONTEXTDOORGIFTE.json. Een deelronde schrijft het register niet, maar
   bijt wel: een spoeltimer die weer de identiteit van een verzoek erft, of een
   context die de body-lezer niet overleeft, laat deze toets zakken. En de
   ijking in de server draait mee: ziet de peiling zijn eigen bekend-foute
   verzoek niet, dan eindigt het script met 2 (`meterStuk`).

   Draai los: node --test test/contextdoorgifte-server.test.js
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('een deelronde tegen een echte server haalt de ratel, en de peiling is geijkt', { timeout: 240000 }, () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'contextdoorgifte.js'), '--max=400'],
    { encoding: 'utf8', timeout: 230000 });
  const uit = (r.stdout || '') + (r.stderr || '');
  assert.notStrictEqual(r.status, 2, 'meterStuk -- de peiling ziet haar eigen ijking niet:\n' + uit);
  assert.strictEqual(r.status, 0, 'de contextdoorgifte valt terug ten opzichte van de ratel:\n' + uit);
  for (const tand of ['i3CorrelatieOneens', 'i10AuthZonderContext', 'i4LekPlekken']) {
    assert.ok(uit.includes(tand), 'de deelronde mat "' + tand + '" niet; dan bewijst hij niets:\n' + uit);
  }
});
