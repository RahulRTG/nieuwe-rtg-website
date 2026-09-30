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

/* ELKE OPROEP EEN EIGEN VAK -- EN DAT IS GEEN VERSIERING.

   Deze proef stuurde zesentwintig WOORDELIJK GELIJKE verzoeken, en zag geen
   enkele rem. De rem was niet stuk: de idem-poort beantwoordde ze. De route
   stond in server/lib/idemsleutels-kaleronde.js als `zelfdeVerzoek` (vak +
   docentnaam; weg sinds B17), dus een tweede identiek verzoek binnen het dubbeltikvenster
   kreeg het EERSTE antwoord terug -- 200, dezelfde lescode, geen tweede les,
   en de handler wordt niet eens aangeroepen. Van de zesentwintig oproepen kwam
   er precies EEN bij de rem uit.

   Dat is twee keer goed gedrag en een verkeerd gestelde vraag. De dubbeltik
   hoort bij de idem-poort; de rem gaat over een VLOED, en een vloed bestaat uit
   verschillende lessen. Meten in een opstelling waar een andere grendel het werk
   al wegvangt is LAT.md regel 9 met een omweg: hij stond groen te staan om een
   reden die niets met hem te maken had.

   Het vak is daarom per oproep anders. test/foundation-lesrem-dubbeltik.test.js
   hieronder houdt de andere helft vast, zodat het wegvallen van de idem-regel
   ook opvalt. */
let teller = 0;
const maak = async () => {
  const r = await fetch(BASE + '/api/foundation/les/maak', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vak: 'Aardrijkskunde ' + (++teller), naam: 'Meester' }) });
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
  assert.ok(r.data && r.data.lescode, 'een les hoort een lescode terug te geven');
  assert.ok(r.data.token, 'en een leraarsleutel');
});

/* DE ANDERE HELFT: en hij staat VOOR de vloed-toets, want die laat de rem dicht
   achter (zelfde adres, zelfde teller).

   SINDS 29 SEPTEMBER 2026 (B17) HERHAALT NIEMAND HET ANTWOORD NOG. De lescode en
   de leraarssleutel zijn hash-only en staan precies een keer in een antwoord
   (lib/eenmalig-geheim-routes.js); de duplicaatregel `zelfdeVerzoek` die hier
   het eerste antwoord teruggaf, zou ze heronthullen en is weg. De dubbeltik
   wordt nu door de kern gevangen op de `idem` die het scherm meestuurt
   (public/apps/foundation/leren-groei.js): een tweede keer is 409, zonder codes
   en zonder tweede les. */
test('een dubbeltik met dezelfde idem maakt geen tweede les en toont de codes niet opnieuw', async () => {
  const zelfde = () => fetch(BASE + '/api/foundation/les/maak', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vak: 'Zelfde vak', naam: 'Zelfde meester', idem: 'dubbeltik-1' }) })
    .then(async r => ({ status: r.status, data: await r.json() }));
  const een = await zelfde();
  const twee = await zelfde();
  assert.ok(een.data && een.data.lescode, 'de eerste oproep hoort een lescode te geven');
  assert.equal(twee.status, 409, 'een tweede oproep met dezelfde idem maakt geen tweede les');
  assert.equal(twee.data.lescode, undefined, 'en toont de lescode niet opnieuw');
  assert.equal(twee.data.token, undefined, 'en de leraarssleutel ook niet');
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
