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
const { RICHTING } = require('../scripts/contextdoorgifte');

test('een deelronde tegen een echte server haalt de ratel, en de peiling is geijkt', { timeout: 240000 }, () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'contextdoorgifte.js'), '--max=400'],
    { encoding: 'utf8', timeout: 230000 });
  assert.ok(r.status !== null, 'de deelronde liep niet af binnen de tijd');
  const uit = (r.stdout || '') + (r.stderr || '');
  assert.notStrictEqual(r.status, 2, 'meterStuk -- de peiling ziet haar eigen ijking niet:\n' + uit);
  assert.strictEqual(r.status, 0, 'de contextdoorgifte valt terug ten opzichte van de ratel:\n' + uit);
  /* Elke tand van de ratel behalve I1 en I8: of er in de eerste routes een
     envelop ontstaat is toeval, en een deelronde zonder noemer slaat die tanden
     over. Hier stond `startsWith('i1')`, en dat sloeg ook I10 tot en met I14
     over -- een uitzondering voor een tand die er vijf wegliet. */
  const ZONDER_NOEMER = ['i1AandeelMetCorrelatie', 'i8ActorSleutel'];
  for (const tand of Object.keys(RICHTING).filter(t => !ZONDER_NOEMER.includes(t))) {
    assert.ok(uit.includes(tand), 'de deelronde mat "' + tand + '" niet; dan bewijst hij niets:\n' + uit);
  }
});

/* Een kostenhaak in een benoemde achtergrondtaak is geen HTTP-auth-punt.
   De bekende ontbrekende verzoekcontext moet tegelijkertijd zichtbaar blijven. */
test('de peiling scheidt dienstwerk van een ontbrekende HTTP-context', () => {
  const fs = require('node:fs'), os = require('node:os');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-contextpeil-'));
  const uit = path.join(map, 'peiling.json');
  const bron = `
    const vf = require('./server/opzet/verzoekframe');
    const haak = require('./server/kern/kosten/haak');
    setTimeout(() => {
      for (const soort of ['dienst', 'overdracht'])
        vf.achtergrond(soort, { drager: 'dienst:peiling', herkomst: 'dienst' }, () => {});
      haak.binnen(haak.HUIS, () => {});
    }, 60);
    setTimeout(() => process.exit(0), 250);
  `;
  try {
    const r = spawnSync(process.execPath, ['-r', './scripts/lib/contextdoorgifte-peil.js', '-e', bron],
      { cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 10000,
        env: { ...process.env, CONTEXTDOORGIFTE_UIT: uit } });
    assert.equal(r.status, 0, r.stderr);
    const peiling = JSON.parse(fs.readFileSync(uit, 'utf8'));
    assert.equal(peiling.ijkKlaar, true);
    assert.ok(peiling.ijk.auth.frameOneens > 0, 'de ijking blijft een verkeerd frame zien');
    assert.equal(peiling.meting.auth.n, 1, 'alleen de ontbrekende HTTP-context telt');
    assert.equal(peiling.meting.auth.metHandeling, 0, 'het ontbrekende verzoek blijft zichtbaar');
    assert.equal(peiling.meting.auth.frameOneens, 0, 'benoemd dienstwerk is geen HTTP-framefout');
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});
