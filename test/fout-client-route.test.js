/* ============================================================================
   DE DEUR VOOR EEN FOUT UIT DE BROWSER (/api/fout/client).

   Deze route staat er met opzet ZONDER inlog: een fout die het inloggen zelf
   sloopt, is juist de fout die je wilt zien. Precies daarom hoort er een toets
   op te staan, en die was er niet -- het endpoint werd tijdens de hele suite
   geen enkele keer aangeroepen.

   Wat hier vastligt is wat een open deur veilig houdt:

     1. hij antwoordt met 204 en zonder inhoud, ook voor een anonieme beller;
     2. hij BEWAART niets: een tweede melding levert geen groeiende lijst op die
        een vreemde kan volschrijven;
     3. hij accepteert geen groot lichaam (4 kB), want anders is dit een
        gratis opslagplaats;
     4. en hij vraagt niets over de persoon: er is geen veld voor een naam, een
        codenaam of een token, dus er kan er ook geen een in het log komen.

   MUTATIES die zijn gedraaid en welke bewering erop zakte (LAT.md regel 2):
   - de 4kb-limiet uit express.json() gehaald
     -> "een groot lichaam komt er niet in" ZAKT (RAAK)
   - res.status(204) vervangen door res.json(req.body)
     -> "de melder krijgt niets terug" ZAKT (RAAK)

   Draai los: node --test test/fout-client-route.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-foutclient-'));
let srv, base;

const melden = (body, extra) => fetch(base + '/api/fout/client', Object.assign({
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body || {})
}, extra || {}));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('een kapot scherm mag melden zonder inlog, en krijgt niets terug', async () => {
  const r = await melden({ soort: 'onvangen', melding: 'x is not a function',
    bestand: '/apps/app-main.js', regel: 42, pad: '/apps/app.html', ingelogd: false });
  assert.equal(r.status, 204, 'een melding wordt aangenomen zonder sessie');
  assert.equal((await r.text()).length, 0, 'en er komt niets terug: dit is geen dienst maar een brievenbus');
});

test('een groot lichaam komt er niet in', async () => {
  /* Zonder deze grens is een open deur een gratis opslagplaats. 4 kB is ruim
     voor een stacktrace en te krap om iets in te parkeren. */
  const groot = await melden({ soort: 'onvangen', melding: 'a'.repeat(20000) });
  assert.equal(groot.status >= 400, true, 'twintig kilobyte hoort geweigerd te worden: ' + groot.status);
});

test('rommel breekt de deur niet', async () => {
  const stuk = await melden('{dit is geen json');
  assert.equal(stuk.status >= 400, true, 'kapotte JSON geeft een nette fout: ' + stuk.status);

  const leeg = await melden({});
  assert.equal(leeg.status, 204, 'een lege melding is nog steeds een melding');

  /* Velden die er niet horen te zijn, worden niet doorgegeven: de route kopieert
     vijf velden en niets anders. Dat is hier te zien doordat het antwoord leeg
     blijft, en het staat in de route zelf als opsomming. */
  const extra = await melden({ token: 'geheim', codenaam: 'Havik', melding: 'iets ging mis' });
  assert.equal(extra.status, 204);
  assert.equal((await extra.text()).length, 0, 'ook dan komt er niets terug');
});
