/* ============================================================================
   DE REIS-AANVRAAG HEEFT EEN REM.

   WAT ER MIS WAS. /api/foundation/reis/aanvraag is met opzet zonder sleutel: wie
   een reis aanvraagt of iemand voordraagt heeft geen foundation-account, en dat
   is het punt ervan. Maar de lijst kapt op duizend (`slice(0, 1000)` op een
   `unshift`), en er stond geen rem op. Wie duizend keer post, wist dus elke
   echte aanvraag -- niet stelen maar WISSEN, en er kwam gewoon `ok: true` terug.
   Aan het antwoord was niets te zien.

   Gevonden door scripts/handlerwacht.js: van de 612 schrijfroutes zonder
   bewakerslaag was dit de enige die geen enkele controle deed en ook geen deur
   is (inloggen, een uitnodiging accepteren).

   WAAROM DIT EEN EIGEN BESTAND IS. test/foundation.test.js zet
   RTG_GEZIN_REM_UIT=1, want het maakt zeventien gezinnen achter elkaar vanaf
   hetzelfde adres. In precies die omgeving is deze rem onzichtbaar. Een toets
   die een grendel meet, hoort niet te draaien in een opstelling waar die
   grendel uit staat -- dat is LAT.md regel 9 (zie ook de kop van
   server/foundation/rem.js, waar dezelfde les al een keer is geleerd).

   DE MUTATIE: haal de twee remregels uit /reis/aanvraag in
   server/foundation/onderwijs/schrift.js -> deze toets zakt.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisrem-'));
let BASE, srv;

const api = async (pad, lijf) => {
  const r = await fetch(BASE + '/api/foundation' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lijf || {}) });
  let data = null; try { data = await r.json(); } catch (e) {}
  return { status: r.status, data };
};

test.before(async () => {
  /* GEEN RTG_GEZIN_REM_UIT hier: dat is de hele bedoeling. */
  srv = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  BASE = srv.base;
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

const lijf = (n) => ({ soort: 'aanvraag', naam: 'Vloed ' + n, contact: 'v' + n + '@voorbeeld.test',
  gezin: '1 volwassene', waarom: 'Een aanvraag die de lijst zou moeten vullen.' });

test('een gewone aanvraag komt gewoon binnen', async () => {
  const r = await api('/reis/aanvraag', { soort: 'aanvraag', naam: 'Fatima',
    contact: 'fatima@voorbeeld.test', gezin: '2 volwassenen, 3 kinderen',
    waarom: 'Na een zwaar jaar zou even weg heel veel betekenen.' });
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
});

test('een vloed stuit op de rem, en die zegt waarom', async () => {
  let geweigerd = 0, laatste = null;
  for (let i = 0; i < 12; i++) {
    const r = await api('/reis/aanvraag', lijf(i));
    if (r.status !== 200) { geweigerd++; laatste = r; }
  }
  assert.ok(geweigerd > 0, 'twaalf aanvragen achter elkaar horen op een rem te stuiten');
  assert.equal(laatste.status, 429, 'en dat hoort een 429 te zijn, geen stille 200');
  assert.ok(laatste.data && laatste.data.error,
    'een geweigerd verzoek zegt waarom in plaats van stil te mislukken');
});

test('een onvolledige aanvraag wordt nog steeds geweigerd op inhoud', async () => {
  /* De rem mag de gewone validatie niet vervangen: zonder contact is het geen
     aanvraag, ook als er nog ruimte op de teller staat. */
  const r = await api('/reis/aanvraag', { naam: 'Fatima', waarom: 'zwaar jaar' });
  assert.ok(r.status === 400 || r.status === 429, 'onvolledig hoort geweigerd te worden, kreeg ' + r.status);
});
