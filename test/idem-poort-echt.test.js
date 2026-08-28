/* De idem-poort op een ECHTE server, langs een ECHTE route.

   test/idem-poort.test.js toetst de regel; dit toetst dat hij ook werkelijk in
   de keten hangt en dat er niets onder hem doorglipt. Dat verschil is niet
   academisch: de poort heeft de ONTLEDE body nodig (de sleutel mag erin zitten)
   en moet vóór elke route staan. Zit hij een plek verkeerd in
   server/opzet/lijfpoort.js, dan slagen de losse toetsen nog steeds en doet de
   server niets.

   De proef heeft dezelfde vorm als scripts/lib/idemproef.js: A met sleutel K1,
   B met K1 opnieuw, C met een verse K2. B mag niets nieuws doen; C moet WEL
   werken -- anders is het geen idempotentie maar een slot.

   Het verschil met die proef is de PLAATS van de sleutel: hier de
   `Idempotency-Key` header, daar het body-veld `idem`. Dat is geen detail maar
   de grens van deze laag: het body-veld is van de applicatie en wordt door
   sommige routes zelf gebruikt. Zie de kop van server/lib/idem-poort.js.

   Draai los: node --experimental-sqlite --test test/idem-poort-echt.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-idem-')); }

async function api(base, pad, body, token, sleutel) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  if (sleutel) h['Idempotency-Key'] = sleutel;
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

    const lijf = { naam: 'Proefconcern' };
    const a = await api(base, '/api/concern/nieuw', lijf, tok, 'idemtoets-concern-1');
    /* HARD, en niet in een `if`. Zou deze route om welke reden dan ook een fout
       geven, dan slaagt de rest hieronder hol -- twee mislukkingen zijn immers
       ook aan elkaar gelijk. Dan toetst dit bestand niets en zegt het toch ja. */
    assert.ok(a.status >= 200 && a.status < 300, 'de eerste oproep moet echt slagen, kreeg ' + a.status + ': ' + JSON.stringify(a.body));
    assert.notEqual(a.body && a.body.ok, false, 'de eerste oproep moet echt werk doen');

    const b = await api(base, '/api/concern/nieuw', lijf, tok, 'idemtoets-concern-1');
    assert.equal(a.status, b.status, 'de herhaling geeft dezelfde status');
    assert.equal(b.body.herhaald, true, 'de herhaling draagt het merk van de idem-laag');
    assert.deepEqual(
      Object.assign({}, b.body, { herhaald: undefined }),
      Object.assign({}, a.body, { herhaald: undefined }),
      'de herhaling geeft exact hetzelfde antwoord'
    );

    // C: een VERSE sleutel moet wel gewoon werken
    const c = await api(base, '/api/concern/nieuw', { naam: 'Proefconcern' }, tok, 'idemtoets-concern-2');
    assert.ok(c.status >= 200 && c.status < 300, 'een verse sleutel hoort gewoon te werken');
    assert.ok(!c.body.herhaald, 'een verse sleutel is geen herhaling');
  } finally { await stop(child); fs.rmSync(TMP, { recursive: true, force: true }); }
});

/* Deze toets legde eerst vast dat er ZONDER sleutel niets verandert. Dat is
   sinds de verklaarde sleutel niet meer waar, en met opzet: /api/concern/nieuw
   verklaart in server/lib/idemsleutels.js dat een woordelijk gelijk verzoek een
   herhaling is, juist zodat een dubbeltik geen tweede concern maakt.

   Wat er WEL nog geldt, en wat deze toets nu bewaakt: een route die niets
   verklaart, blijft volledig ongemoeid. Dat is de grens van deze laag -- hij
   raakt alleen wat om hem gevraagd heeft. */
test('een route die niets verklaart, blijft ongemoeid', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const tok = await lidToken(base);
    const { SLEUTELS } = require('../server/lib/idemsleutels');
    assert.ok(!SLEUTELS['POST /api/gewoonten/lijst'], 'deze route hoort onverklaard te zijn');

    const a = await api(base, '/api/agenda/lijst', {}, tok);
    const b = await api(base, '/api/agenda/lijst', {}, tok);
    assert.ok(!a.body || !a.body.herhaald, 'onverklaard, dus geen merk');
    assert.ok(!b.body || !b.body.herhaald, 'onverklaard, dus geen herhaling');
  } finally { await stop(child); fs.rmSync(TMP, { recursive: true, force: true }); }
});

test('dezelfde sleutel met een ander verzoek geeft 409 en nooit stil het oude antwoord', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const tok = await lidToken(base);
    const a = await api(base, '/api/concern/nieuw', { naam: 'Eerste' }, tok, 'idemtoets-bots');
    assert.ok(a.status >= 200 && a.status < 300, 'de eerste oproep moet echt slagen, kreeg ' + a.status);
    const b = await api(base, '/api/concern/nieuw', { naam: 'Heel iets anders' }, tok, 'idemtoets-bots');
    assert.equal(b.status, 409, 'een andere opdracht op dezelfde sleutel botst');
    assert.match(String(b.body.error), /al gebruikt voor een ander verzoek/);
  } finally { await stop(child); fs.rmSync(TMP, { recursive: true, force: true }); }
});

/* DE VERKLAARDE SLEUTEL OP EEN ECHTE SERVER.

   Een route die in server/lib/idemsleutels.js verklaart dat een woordelijk
   gelijk verzoek een herhaling is, hoort de dubbeltik af te vangen ZONDER dat
   de client iets meestuurt. Dat is het verschil met de header-vorm hierboven,
   en het is precies wat de idemproef op 94 routes miste.

   Dit hoort op een echte server getoetst te worden en niet alleen los: de
   verklaring werkt via de lijfpoort, en een verkeerd gemonteerde laag valt in
   een pure toets nooit op. */
test('een verklaarde route vangt de dubbeltik op, zonder Idempotency-Key', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const tok = await lidToken(base);

    /* Op IDENTITEIT toetsen en niet op een telling: elk nieuw concern krijgt een
       eigen id, dus twee gelijke id's betekent letterlijk dat er maar EEN is
       gemaakt. Een telling zou een lijstroute nodig hebben en daarmee een tweede
       aanname over de vorm van het antwoord. */
    const a = await api(base, '/api/concern/nieuw', { naam: 'Dubbeltikconcern' }, tok);
    const b = await api(base, '/api/concern/nieuw', { naam: 'Dubbeltikconcern' }, tok);
    assert.ok(a.status >= 200 && a.status < 300, 'de eerste slaagt: ' + JSON.stringify(a.body));
    assert.ok(a.body.concern && a.body.concern.id, 'de eerste levert een concern op');
    assert.equal(b.body.herhaald, true, 'de tweede hoort een herhaling te zijn');
    assert.equal(b.body.concern.id, a.body.concern.id,
      'hetzelfde concern, dus er is er maar EEN opgericht');

    // een ANDER concern is gewoon een tweede handeling
    const c = await api(base, '/api/concern/nieuw', { naam: 'Heel iets anders' }, tok);
    assert.ok(!c.body.herhaald, 'een ander verzoek is geen herhaling');
    assert.notEqual(c.body.concern.id, a.body.concern.id, 'en levert een eigen concern op');
  } finally { await stop(child); fs.rmSync(TMP, { recursive: true, force: true }); }
});
