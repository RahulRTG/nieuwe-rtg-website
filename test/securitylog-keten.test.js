/* HET INLOG-AUDITLOG AAN DE HASHKETEN.

   Waarom juist dit log. Wie binnen is, poetst als eerste zijn eigen bezoek weg:
   één reeks mislukte pogingen uit het securityLog halen en er is nooit iemand
   aan de deur geweest. Sinds elke regel de hash van zijn voorganger draagt,
   breekt zo'n ingreep MIDDEN in het log aantoonbaar.

   Wat deze toets NIET beweert, en dat verschil is de hele eerlijkheid van de
   voorziening: hij bewijst niet dat een beheerder tegengehouden wordt. Wie de
   NIEUWSTE regels wegknipt, houdt een keten over die perfect met zichzelf
   klopt. Daarvoor is het anker nodig (lib/keten-anker.js), en dat is nog niet
   in bedrijf. Zie de kop van server/lib/keten.js.

   Draai los: node --experimental-sqlite --test test/securitylog-keten.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');
const keten = require('../server/lib/keten');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-seclog-')); }

async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  let lijf = null;
  try { lijf = await r.json(); } catch (e) { lijf = null; }
  return { status: r.status, body: lijf };
}

/* Het kantoor binnenkomen met de gedeelde code, zoals de bestaande toetsen dat
   ook doen. Zonder OFFICE_CODE in de omgeving kiest de server er zelf een, dus
   zetten we hem hier expliciet. */
const CODE = 'PROEFCODE-1234';

test('elke inlogpoging komt geketend in het log, en sleutelen valt op', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  try {
    // drie mislukte pogingen en één geslaagde: vier regels in het log
    await api(base, '/api/office/login', { code: 'FOUT-1' });
    await api(base, '/api/office/login', { code: 'FOUT-2' });
    const goed = await api(base, '/api/office/login', { code: CODE });
    assert.ok(goed.body && goed.body.token, 'kantoor ingelogd, kreeg ' + JSON.stringify(goed.body));

    const uit = await api(base, '/api/office/securitylog', {}, null);
    // securitylog zit achter officeAuth; die gebruikt het kantoortoken
    const met = await fetch(base + '/api/office/securitylog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + goed.body.token },
      body: '{}'
    }).then(r => r.json());

    assert.ok(Array.isArray(met.log), 'het log komt terug, kreeg ' + JSON.stringify(uit.body));
    assert.ok(met.log.length >= 3, 'drie pogingen horen erin te staan, kreeg ' + met.log.length);

    // 1. elke regel draagt een hash en een volgnummer
    for (const r of met.log) {
      assert.ok(r.hash, 'elke regel hoort een hash te dragen: ' + JSON.stringify(r));
      assert.ok(Number.isInteger(r.nr), 'en een volgnummer');
    }

    // 2. de keten klopt met zichzelf
    assert.equal(met.keten.ok, true, 'een ongemoeid log hoort heel te zijn: ' + JSON.stringify(met.keten.gebroken));
    assert.equal(met.keten.gebroken.length, 0);
    assert.ok(met.keten.top, 'er hoort een ketentop te zijn');

    // 3. NU SLEUTELEN. Een mislukte poging omkatten naar "gelukt" -- precies wat
    //    iemand zou doen die zijn eigen bezoek wil witwassen.
    const gesleuteld = met.log.map(r => Object.assign({}, r));
    const doelwit = gesleuteld.findIndex(r => r.ok === false);
    assert.ok(doelwit >= 0, 'er hoort een mislukte poging in te staan om aan te sleutelen');
    gesleuteld[doelwit].ok = true;

    const oordeel = keten.verifieer(gesleuteld);
    assert.equal(oordeel.ok, false, 'aan een regel sleutelen HOORT op te vallen');
    assert.ok(oordeel.gebroken.length > 0, 'en wel op een aanwijsbaar punt');
  } finally { await stop(child); fs.rmSync(TMP, { recursive: true, force: true }); }
});

test('een regel uit het midden weghalen valt op bij zijn opvolger', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  try {
    await api(base, '/api/office/login', { code: 'FOUT-1' });
    await api(base, '/api/office/login', { code: 'FOUT-2' });
    await api(base, '/api/office/login', { code: 'FOUT-3' });
    const goed = await api(base, '/api/office/login', { code: CODE });

    const met = await fetch(base + '/api/office/securitylog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + goed.body.token },
      body: '{}'
    }).then(r => r.json());

    assert.equal(met.keten.ok, true, 'ongemoeid is heel');
    assert.ok(met.log.length >= 4);

    const zonderMidden = met.log.filter((_, i) => i !== 1);
    const oordeel = keten.verifieer(zonderMidden);
    assert.equal(oordeel.ok, false, 'een regel uit het midden weghalen hoort op te vallen');
  } finally { await stop(child); fs.rmSync(TMP, { recursive: true, force: true }); }
});

/* ---------------------------------------------------------------------------
   De opnamefunctie zelf. De regel die hier wordt vastgelegd is dat er aan de
   STAART gesnoeid wordt en nooit aan de kop: wie aan de kop snoeit gooit de
   nieuwste hash weg en houdt een keten over die nog steeds klopt.
   ------------------------------------------------------------------------- */

test('noteerIn hangt aan, zet nieuwste vooraan en snoeit aan de staart', () => {
  const journaal = [];
  for (let i = 1; i <= 5; i++) keten.noteerIn(journaal, { n: i }, 3);

  assert.equal(journaal.length, 3, 'de grens hoort gehandhaafd te worden');
  assert.equal(journaal[0].n, 5, 'nieuwste vooraan');
  assert.equal(journaal[2].n, 3, 'de oudste twee zijn eruit gelopen');

  const oordeel = keten.verifieer(journaal);
  assert.equal(oordeel.gebroken.length, 0, 'snoeien aan de staart breekt de keten niet');
  assert.equal(oordeel.afgekapt, true, 'maar het meldt wel dat er iets afliep');
  assert.equal(keten.top(journaal), journaal[0].hash, 'de top is de hash van de nieuwste');
});

test('noteerIn zonder grens laat het journaal groeien', () => {
  const journaal = [];
  for (let i = 0; i < 10; i++) keten.noteerIn(journaal, { n: i }, 0);
  assert.equal(journaal.length, 10);
  assert.equal(keten.verifieer(journaal).ok, true);
});

test('noteerIn weigert iets dat geen journaal is', () => {
  assert.throws(() => keten.noteerIn(null, { n: 1 }, 10), /geen lijst/);
});

test('regels van vóór de keten blijven staan en worden niet veroordeeld', () => {
  // een bestaand log, zoals het op schijf stond voordat de keten er was
  const journaal = [{ at: 'toen', ok: false }, { at: 'eerder', ok: true }];
  keten.noteerIn(journaal, { at: 'nu', ok: true }, 100);

  const oordeel = keten.verifieer(journaal);
  assert.equal(oordeel.gebroken.length, 0, 'een bestaande installatie hoort hier niet op stuk te gaan');
  assert.equal(oordeel.zonderKeten, 2, 'de oude regels worden geteld');
  assert.equal(journaal[0].at, 'nu', 'de nieuwe regel staat vooraan');
});
