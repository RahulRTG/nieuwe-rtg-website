/* De idem-poort op een ECHTE server, langs een ECHTE route.

   test/idem-poort.test.js toetst de regel; dit toetst dat hij ook werkelijk in
   de keten hangt en dat er niets onder hem doorglipt. Dat verschil is niet
   academisch: de poort heeft de ONTLEDE body nodig (de sleutel mag erin zitten)
   en moet vóór elke route staan. Zit hij een plek verkeerd in
   server/opzet/lijfpoort.js, dan slagen de losse toetsen nog steeds en doet de
   server niets.

   De proef is dezelfde die scripts/lib/idemproef.js over alle routes doet:
   A met sleutel K1, B met K1 opnieuw, C met een verse K2. B mag niets nieuws
   doen; C moet WEL werken -- anders is het geen idempotentie maar een slot.

   Draai los: node --experimental-sqlite --test test/idem-poort-echt.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-idem-')); }

async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  let lijf = null;
  try { lijf = await r.json(); } catch (e) { lijf = null; }
  return { status: r.status, body: lijf };
}

async function lidToken(base) {
  const r = await api(base, '/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran' });
  return r.body && r.body.token;
}

test('een herhaald verzoek met dezelfde sleutel maakt niet twee concerns', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const tok = await lidToken(base);
    assert.ok(tok, 'ingelogd');

    const lijf = { naam: 'Proefconcern', idem: 'idemtoets-concern-1' };
    const a = await api(base, '/api/concern/nieuw', lijf, tok);
    /* HARD, en niet in een `if`. Zou deze route om welke reden dan ook een fout
       geven, dan slaagt de rest hieronder hol -- twee mislukkingen zijn immers
       ook aan elkaar gelijk. Dan toetst dit bestand niets en zegt het toch ja. */
    assert.ok(a.status >= 200 && a.status < 300, 'de eerste oproep moet echt slagen, kreeg ' + a.status + ': ' + JSON.stringify(a.body));
    assert.notEqual(a.body && a.body.ok, false, 'de eerste oproep moet echt werk doen');

    const b = await api(base, '/api/concern/nieuw', lijf, tok);
    assert.equal(a.status, b.status, 'de herhaling geeft dezelfde status');
    assert.equal(b.body.herhaald, true, 'de herhaling draagt het merk van de idem-laag');
    assert.deepEqual(
      Object.assign({}, b.body, { herhaald: undefined }),
      Object.assign({}, a.body, { herhaald: undefined }),
      'de herhaling geeft exact hetzelfde antwoord'
    );

    // C: een VERSE sleutel moet wel gewoon werken
    const c = await api(base, '/api/concern/nieuw', { naam: 'Proefconcern', idem: 'idemtoets-concern-2' }, tok);
    assert.ok(c.status >= 200 && c.status < 300, 'een verse sleutel hoort gewoon te werken');
    assert.ok(!c.body.herhaald, 'een verse sleutel is geen herhaling');
  } finally { await stop(child); fs.rmSync(TMP, { recursive: true, force: true }); }
});

test('zonder sleutel blijft alles zoals het was', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const tok = await lidToken(base);
    const a = await api(base, '/api/concern/nieuw', { naam: 'Zonder sleutel' }, tok);
    const b = await api(base, '/api/concern/nieuw', { naam: 'Zonder sleutel' }, tok);
    assert.ok(!a.body || !a.body.herhaald, 'geen sleutel, geen merk');
    assert.ok(!b.body || !b.body.herhaald, 'geen sleutel, geen herhaling -- gedrag ongewijzigd');
  } finally { await stop(child); fs.rmSync(TMP, { recursive: true, force: true }); }
});

test('dezelfde sleutel met een ander verzoek geeft 409 en nooit stil het oude antwoord', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const tok = await lidToken(base);
    const a = await api(base, '/api/concern/nieuw', { naam: 'Eerste', idem: 'idemtoets-bots' }, tok);
    assert.ok(a.status >= 200 && a.status < 300, 'de eerste oproep moet echt slagen, kreeg ' + a.status);
    const b = await api(base, '/api/concern/nieuw', { naam: 'Heel iets anders', idem: 'idemtoets-bots' }, tok);
    assert.equal(b.status, 409, 'een andere opdracht op dezelfde sleutel botst');
    assert.match(String(b.body.error), /al gebruikt voor een ander verzoek/);
  } finally { await stop(child); fs.rmSync(TMP, { recursive: true, force: true }); }
});
