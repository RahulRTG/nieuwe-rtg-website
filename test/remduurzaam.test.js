/* EEN REM DIE EEN MENS OVERHAALT, STAAT VAST VOORDAT HIJ BEVESTIGD WORDT.

   GELDLAT.md kreeg op 6 september 2026 een derde been in zijn reikwijdte. De
   eerste twee waren geld en werk van een lid; de faalproef vond een categorie
   die in geen van beide past en toch dezelfde belofte breekt:

     POST /api/office/techniek/integraties/noodstop   antwoordde `noodstop: true`
     POST /api/command/uitrol/pauze                   antwoordde stand `stil`

   Allebei met een kale save(), dus onder `schrijf-verloren` (de opslag
   bevestigt en bewaart niet) kwam er een keurige 200 uit terwijl er niets
   vaststond. Een bediener zet alle koppelingen uit, leest "uit", loopt weg --
   en na een herstart staat alles weer aan.

   WAT HIER WORDT BEWEERD:
     - zonder verraad doen beide remmen gewoon hun werk (de eerste vraag, niet
       de laatste: duurzaamheid gekocht met een kapotte knop is geen winst);
     - het antwoord wordt ECHT afgewacht -- routes/command/index.js had een
       SYNCHRONE `veilig`, en die stuurt een niet-afgewachte Promise als `{}`
       met een 200. Dat is erger dan de fout die we repareren;
     - onder een liegende opslag komt er GEEN 2xx uit;
     - de leugen raakt de SCHRIJFkant en niet de hele server.

   Draai los: node --test test/remduurzaam.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const mappen = [];
const verseMap = () => { const m = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rem-')); mappen.push(m); return m; };

const post = (basis, pad, lijf, tok) => fetch(basis + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
  body: JSON.stringify(lijf || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Boardroomwerk vraagt de eigenaar zelf; zijn accountlogin opent ook het
   kantoor. Zelfde weg als test/aidata.test.js. */
async function kantoor(basis) {
  const o = await post(basis, '/api/auth/login',
    { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' });
  return o.body && o.body.token;
}

/* Twee servers: een eerlijke en een liegende, elk met een eigen datamap. Een
   opslag die schrijfacties weggooit hoort niet in de map van een andere toets
   te wroeten. */
let eerlijk, leugen, tokEerlijk, tokLeugen;
test.before(async () => {
  eerlijk = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: verseMap(), OFFICE_CODE: 'KANTOOR-REM-1' } });
  leugen = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: verseMap(), OFFICE_CODE: 'KANTOOR-REM-2',
    RTG_VERRAAD: 'schrijf-verloren' } });
  tokEerlijk = await kantoor(eerlijk.base);
  tokLeugen = await kantoor(leugen.base);
  assert.ok(tokEerlijk && tokLeugen, 'beide kantoren loggen in');
});
test.after(() => {
  stop(eerlijk && eerlijk.child);
  stop(leugen && leugen.child);
  for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {} }
});

test('1. zonder verraad zet de noodstop alles uit en bevestigt dat', async () => {
  const r = await post(eerlijk.base, '/api/office/techniek/integraties/noodstop',
    { reden: 'proef' }, tokEerlijk);
  assert.equal(r.status, 200);
  assert.equal(r.body.noodstop, true, 'de bediener hoort te lezen dat het gelukt is');
  /* DE await-CONTROLE: zonder await stuurt de route een Promise, en die
     serialiseert naar {} met een keurige 200. Een toets die alleen naar de
     status kijkt, ziet dat verschil niet. */
  assert.ok(Array.isArray(r.body.tegels) && r.body.tegels.length,
    'een 200 zonder inhoud is een niet-afgewachte belofte');
});

test('2. zonder verraad pauzeert de uitrol en geeft de stand terug', async () => {
  const r = await post(eerlijk.base, '/api/command/uitrol/pauze', { reden: 'proef' }, tokEerlijk);
  assert.equal(r.status, 200);
  assert.equal(r.body.stand, 'stil', 'de regie hoort stil te staan');
  assert.ok(r.body.reden, 'en te zeggen waarom');
});

test('3. onder een liegende opslag bevestigt de noodstop NIET', async () => {
  const r = await post(leugen.base, '/api/office/techniek/integraties/noodstop',
    { reden: 'proef' }, tokLeugen);
  assert.notEqual(r.status, 200, 'bevestigen wat de opslag niet heeft, is de fout zelf');
  assert.ok(r.status >= 500, 'dit is geen invoerfout van het kantoor maar een opslagfout (kreeg ' + r.status + ')');
  assert.equal(r.body.noodstop, undefined, 'geen noodstop-bevestiging bij een mislukte commit');
  assert.match(String(r.body.error || ''), /niet vastgelegd/,
    'het kantoor hoort te horen dat het niet vastligt, niet alleen dat er "iets" misging');
});

test('4. onder een liegende opslag pauzeert de uitrol NIET', async () => {
  const r = await post(leugen.base, '/api/command/uitrol/pauze', { reden: 'proef' }, tokLeugen);
  assert.notEqual(r.status, 200, 'een uitrol die als stil is bevestigd, moet stil zijn');
  assert.ok(r.status >= 500, 'opslagfout, geen invoerfout (kreeg ' + r.status + ')');
  assert.equal(r.body.stand, undefined, 'geen stand terug bij een mislukte commit');
  assert.match(String(r.body.error || ''), /niet vastgelegd/);
});

test('5. de leugen raakt de SCHRIJFkant, niet de hele server', async () => {
  /* Zonder deze controle bewijzen 3 en 4 niets: een server die onder verraad
     helemaal omvalt, geeft ook 5xx en dat zou eruitzien als zorgvuldigheid. */
  const r = await post(leugen.base, '/api/command/uitrol', {}, tokLeugen);
  assert.equal(r.status, 200, 'lezen blijft gewoon werken onder schrijf-verloren');
});
