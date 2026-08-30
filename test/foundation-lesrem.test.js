/* ============================================================================
   DE LES-MAAKROUTE HEEFT DE REM DIE HAAR REDEN BELOOFDE.

   WAT ER MIS WAS. /api/foundation/les/maak stond in de openbaar-lijst
   (scripts/lib/publiek.js) met als reden "bewust zonder inlog: een quizbord in
   de klas. Wel een uurgrens per IP -- zie server/routes/lesmaker.js". Die
   uurgrens bestond, maar op een ANDERE route: /api/les/maak van de lesmaker.
   De foundation-route zelf maakte onbeperkt lessen aan, en elke les blijft in
   F().lessen staan. Een reden die naar de rem van de buurman wijst, is geen
   rem.

   Gevonden bij het gelijktrekken van de twee openbaar-lijsten (keuring vs.
   poortwacht) na scripts/handlerwacht.js.

   WAAROM DIT EEN EIGEN BESTAND IS. Zelfde reden als
   test/foundation-reisrem.test.js: de foundation-toetsen zetten remmen uit
   omdat ze bulk aanmaken, en een grendel meten in een opstelling waar hij uit
   staat is LAT.md regel 9.

   DE MUTATIE: haal de twee remregels uit /les/maak in
   server/foundation/onderwijs/les.js -> deze toets zakt.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lesrem-'));
let BASE, srv;

const maak = async () => {
  const r = await fetch(BASE + '/api/foundation/les/maak', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vak: 'Aardrijkskunde', naam: 'Meester' }) });
  let data = null; try { data = await r.json(); } catch (e) {}
  return { status: r.status, data };
};

test.before(async () => {
  srv = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  BASE = srv.base;
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('een docent maakt gewoon een les aan', async () => {
  const r = await maak();
  assert.equal(r.status, 200);
  assert.ok(r.data && r.data.code, 'een les hoort een lescode terug te geven');
  assert.ok(r.data.token, 'en een leraarsleutel');
});

test('een vloed stuit op de rem, en die zegt waarom', async () => {
  let geweigerd = 0, laatste = null;
  for (let i = 0; i < 26; i++) {
    const r = await maak();
    if (r.status !== 200) { geweigerd++; laatste = r; }
  }
  assert.ok(geweigerd > 0, 'zesentwintig lessen achter elkaar horen op een rem te stuiten');
  assert.equal(laatste.status, 429, 'en dat hoort een 429 te zijn, geen stille 200');
  assert.ok(laatste.data && laatste.data.error,
    'een geweigerd verzoek zegt waarom in plaats van stil te mislukken');
});
