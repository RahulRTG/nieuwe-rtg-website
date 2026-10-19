/* GEEN NIEUWE ANONIEME DEUR (eigenaarsbesluit 19 oktober 2026, AGENTS.md:
   gebruiken vraagt een account).

   Buiten de demo bestaat er geen gastsessie meer, en een uitgelogde bezoeker
   bereikt alleen de uitzonderingen: inlog en registratie, de ballotage, de
   ondertekende webhooks, de landing, de beschermingsdeur en machineverkeer met
   een eigen handtekening. Die staan met hun reden in scripts/lib/publiek.js.

   Deze toets start een server ZONDER demo en laat scripts/poortwacht.js bij
   elke route anoniem aankloppen. Elke route die een 2xx geeft en niet op die
   lijst staat, laat hem zakken: een nieuwe deur is dan een besluit dat iemand
   in het register moet zetten, met een reden, of een poort die ontbreekt.

   De statische tegenhanger is check.js regel 28 (elke route een poort of een
   reden), en de doelgroepkant is toets 16 van test/doelgroepbereik.test.js.
   Er komt geen tweede register: dit leest dezelfde lijst. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { startServer, stop } = require('./helper');

test('buiten de demo geeft geen enkele route een uitgelogde bezoeker antwoord, behalve de uitzonderingen', { timeout: 300000 }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_MAGNAAT_TEST: '', RTG_DEMO: '' } });
  try {
    const uit = await new Promise((klaar) => execFile(process.execPath,
      [path.join(__dirname, '..', 'scripts', 'poortwacht.js'), '--json', srv.base],
      { maxBuffer: 1e8 }, (fout, stdout) => klaar(String(stdout || ''))));
    const j = JSON.parse(uit);
    assert.equal(j.fout, 0, 'de poortwacht kon niet elke route bereiken; een onvolledige meting is geen bewijs');
    assert.ok(j.totaal > 1000, 'de poortwacht heeft het huis gezien (' + j.totaal + ' routes)');
    assert.deepEqual(j.open.map((r) => r.status + ' ' + r.methode + ' ' + r.pad), [],
      'een uitgelogde bezoeker krijgt antwoord buiten de uitzonderingen; zet er een poort voor, of neem de route met een reden op in scripts/lib/publiek.js');
  } finally { await stop(srv); }
});
