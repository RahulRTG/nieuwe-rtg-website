/* DE LUS DIE ZICHZELF DICHTTROK -- en waarom een meetserver de schorspoort uit heeft.

   server/middleware/schorspoort.js weigert met 503 elke schrijvende aanroep op
   een route die in VERTROUWEN.json `geschorst` heet (PROOF.md fase 3). Dat is
   precies de bedoeling in productie. Op een MEETserver sluit het een lus:

     1. een route krijgt een gezakte bewijscel  -> geschorst
     2. de schorspoort geeft 503 op die route
     3. de volgende proefronde kan hem niet meer uitvoeren -> ongemeten
     4. ongemeten wordt nooit meer bewezen
     5. de route blijft voor altijd geschorst

   Het register zegt zelf dat de weg omhoog "een geslaagde hermeting" is, en
   precies die hermeting werd geblokkeerd door de staat die zij moest opheffen.

   DIT IS ECHT GEBEURD, op 2 september 2026. Acht routes stonden geschorst; in de
   verse idemproef gaven ze alle acht `de eerste oproep deed geen werk (status
   503)`, en het aantal `onbeschermd` in dat register viel naar NUL -- niet omdat
   er iets gerepareerd was, maar omdat er niets meer te meten viel. Een register
   dat leegloopt doordat de deur dichtzit, leest als vooruitgang. Twee toetsen in
   test/aidata.test.js zakten eraan.

   Draai los: node --test test/meetserver-schorspoort.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const wegwerp = require('../scripts/lib/wegwerpserver');

/* Een route zonder inlog die echt iets DOET, zodat een 200 ook betekent dat hij
   is uitgevoerd. Schrijvend, want alleen daar kijkt de schorspoort naar. */
const PAD = '/api/foundation/les/maak';
const LIJF = { vak: 'Meetproef', naam: 'Begeleider' };

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-schorslus-'));
const REGISTER = path.join(TMP, 'VERTROUWEN.json');

test.before(() => {
  /* Een verzonnen stand met precies deze ene route geschorst. Niet het echte
     VERTROUWEN.json: die verandert bij elke meetronde, en een toets die op zijn
     inhoud leunt zakt op de dag dat het huis beter wordt. */
  fs.writeFileSync(REGISTER, JSON.stringify({
    stempel: { op: new Date(0).toISOString(), commit: 'toets', boomVuil: false },
    perRoute: { ['POST ' + PAD]: { staat: 'geschorst', reden: 'verzonnen stand voor deze toets' } }
  }, null, 1));
});
test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

const roep = (basis) => fetch(basis + PAD, { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(LIJF) });

test('DE TEGENPROEF EERST: met de poort AAN weigert deze route wel degelijk', async () => {
  /* Zonder deze bewijst de toets hieronder niets: een route die toch al 200 geeft
     omdat het register niet wordt gelezen, haalt hem ook. Hier wordt de poort
     uitdrukkelijk teruggezet via `o.env` -- die gaat na de standaardwaarden en
     wint dus, en dat is meteen de toets op die volgorde. */
  const srv = await wegwerp.start({ naam: 'schorslus-aan',
    env: { RTG_VERTROUWEN: REGISTER, RTG_SCHORSPOORT_UIT: '0' } });
  try {
    const r = await roep(srv.basis);
    assert.equal(r.status, 503, 'met de poort aan is een geschorste route dicht');
    assert.equal(r.headers.get('X-Vervalstaat'), 'geschorst', 'en hij zegt waarom');
  } finally { srv.klaar(); }
});

test('een meetserver bereikt een GESCHORSTE route, zodat hermeting mogelijk blijft', async () => {
  /* Dezelfde server, hetzelfde register, alleen zonder de override. De
     standaardwaarde uit scripts/lib/wegwerpserver.js hoort de poort uit te
     zetten. Mutatie nagetrokken: `RTG_SCHORSPOORT_UIT: '1'` daar weghalen laat
     deze toets zakken op 503 -- en dan is de lus terug. */
  const srv = await wegwerp.start({ naam: 'schorslus-uit', env: { RTG_VERTROUWEN: REGISTER } });
  try {
    const r = await roep(srv.basis);
    assert.equal(r.status, 200,
      'een instrument moet een geschorste route kunnen uitvoeren, anders kan hij nooit meer worden vrijgemeten');
    const d = await r.json();
    assert.ok(d.code, 'en de oproep deed echt werk (er kwam een lescode uit)');
  } finally { srv.klaar(); }
});
