/* DE RTG LINK-DRAGER ALS CREDENTIAL (link.capability_aanvaarden, besluit B15):
   server/kern/link/cap-bak.js onder cap.js, cap-in.js en cap-beheer.js.

   Per control uit CODECREDENTIALS.json een toets: 128 bits, hash-only (en de
   opdracht versleuteld onder de code), issuer/doel/scope/onderwerp, minuten
   geldig, eenmalig en atomair geclaimd, intrekbaar zolang ongebruikt en alleen
   door de uitgever, constant-time opzoeken, en de kale code alleen in het
   antwoord op het maken. Plus: een oude drager van 72 bits opent niets.

   De opslag is de echte eenprocesweg (server/db/collectie-bewerken.js); de
   PostgreSQL-race staat in test/linkcap-credential.pg.test.js.

   Draai los: node --test test/linkcap-credential.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const maakHandelingen = require('../server/kern/link/handelingen');
const maakCap = require('../server/kern/link/cap');

const GEHEIM = 'KC-GEHEIM-VAN-DE-OPDRACHT';
function maak(extra = {}) {
  const dyncode = require('../server/kern/dyncode')({ crypto,
    dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-capcred-')) });
  const db = { data: {}, writable: true };
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'json', db, save() {} });
  const klok = { t: Date.now() };
  const gedaan = [];
  const handelingen = maakHandelingen();
  handelingen.registreer(Object.assign({ id: 'proef.doen', wat: 'Iets doen', uitgever: ['lid'], aanvaarder: ['lid', 'supplier'],
    ttlMs: 120000, eenmalig: true, lees: () => ({ geheim: GEHEIM, n: 3 }),
    beschrijf: (o) => ({ wat: 'Doen', velden: [{ naam: 'n', waarde: String(o.n) }] }),
    neem: (ruw) => ({ centen: Number(ruw && ruw.centen) || 1 }),
    doe: async (x) => { gedaan.push(x); await new Promise(r => setImmediate(r)); return { klaar: true }; } }, extra));
  const cap = maakCap({ db, crypto, bewerkCollectie, dyncodeGeef: () => dyncode, codenaamVan: k => 'Lid ' + k,
    bonSchrijf() {}, handelingen, rate: () => true, nu: () => klok.t });
  return { cap, db, dyncode, klok, gedaan };
}
const A = { soort: 'lid', key: 'A', codenaam: 'Lid A' };
const B = { soort: 'lid', key: 'B' }, C = { soort: 'lid', key: 'C' };
const rijen = (db) => Object.values(db.data.linkCapToegang || {});

test('128 bits, alleen de hash in de opslag, de opdracht versleuteld onder de code', async () => {
  const { cap, db, dyncode } = maak();
  const r = await cap.capMaak(A, { handeling: 'proef.doen' });
  const code = dyncode.lees(r.token).code;
  assert.match(code, /^[0-9A-F]{32}$/, '32 hextekens = 128 bits');
  const opslag = JSON.stringify(db.data.linkCapToegang);
  assert.ok(!opslag.includes(code) && !opslag.includes(code.toLowerCase()), 'de kale code staat niet in de opslag');
  assert.ok(!opslag.includes(GEHEIM), 'een geheim in de opdracht staat er versleuteld, niet kaal');
  const bearer = require('../server/kern/bearercode')({ crypto, namespace: 'link.capability' });
  const [rij] = rijen(db);
  assert.equal(rij.toegang.code_hash, bearer.hash(code));
  assert.equal(rij.toegang.issuer, 'rtg.link.lid');
  assert.equal(rij.toegang.doel, 'link.capability');
  assert.deepEqual(rij.toegang.scope, ['proef.doen']);
  assert.deepEqual(rij.toegang.onderwerp, { uitgeverId: 'A', soort: 'lid' }, 'gebonden aan wie hem maakte');
  assert.equal(rij.toegang.max_gebruik, 1);
  const duur = Date.parse(rij.toegang.expires_at) - Date.parse(rij.toegang.issued_at);
  assert.equal(duur, 120000, 'minuten geldig: de ttl van de handeling');
  // de kale code staat alleen in het antwoord op het maken, niet in "mijn koppelingen"
  const open = JSON.stringify(cap.capOpenVan(A));
  for (const x of [code, 'code_hash', 'inhoud', GEHEIM]) assert.ok(!open.includes(x), x);
});

test('een oude drager van 72 bits, netjes ondertekend, opent niets', async () => {
  const { cap, dyncode, gedaan } = maak();
  const oud = dyncode.maak({ soort: 'cap', code: crypto.randomBytes(9).toString('base64url') }).token;
  assert.equal((await cap.capKijk(B, oud)).status, 404);
  assert.equal((await cap.capAanvaard(B, oud, null)).status, 404);
  assert.equal((await cap.capTrek(A, oud)).status, 404);
  assert.deepEqual(gedaan, []);
});

test('de claim is eenmalig en atomair: twee aanvaarders tegelijk, precies een voert uit', async () => {
  const { cap, db, gedaan } = maak();
  const r = await cap.capMaak(A, { handeling: 'proef.doen' });
  const uit = await Promise.all([cap.capAanvaard(B, r.token, null), cap.capAanvaard(C, r.token, null)]);
  assert.deepEqual(uit.map(x => x.status).sort(), [200, 404]);
  assert.equal(gedaan.length, 1, 'de handeling liep een keer');
  const [rij] = rijen(db);
  assert.equal(rij.stand, 'gebruikt');
  assert.equal(rij.toegang.gebruik, 1);
});

test('een weigering geeft de code terug; een crash laat de claim staan voor dezelfde aanvaarder', async () => {
  let antwoord = { status: 402, error: 'Te weinig saldo.' };
  const { cap, db, klok, gedaan } = maak({ doe: async (x) => { gedaan.push(x); return antwoord; } });
  const r = await cap.capMaak(A, { handeling: 'proef.doen' });
  assert.equal((await cap.capAanvaard(B, r.token, null, { centen: 5 })).status, 402);
  assert.equal(rijen(db)[0].stand, 'open');
  assert.equal(rijen(db)[0].toegang.gebruik, 0, 'een weigering verbrandt niets');
  antwoord = { status: 503, error: 'Niet bevestigd.' };
  assert.equal((await cap.capAanvaard(B, r.token, null, { centen: 7 })).status, 503);
  assert.equal(rijen(db)[0].stand, 'claimend', 'onbekende afloop: de claim blijft staan');
  assert.equal((await cap.capAanvaard(B, r.token, null, { centen: 7 })).status, 409, 'binnen de lease: bezig');
  assert.equal((await cap.capAanvaard(C, r.token, null, { centen: 9 })).status, 404, 'een ander krijgt hem nooit');
  assert.equal((await cap.capTrek(A, r.token)).status, 404, 'een geclaimde code is niet meer ongebruikt');
  klok.t += 61000;
  antwoord = { klaar: true };
  assert.equal((await cap.capAanvaard(B, r.token, null, { centen: 999 })).ok, true, 'na de lease maakt B hem af');
  const idems = new Set(gedaan.slice(1).map(x => x.idem));
  assert.equal(idems.size, 1, 'hervatten met dezelfde idempotentiesleutel');
  assert.deepEqual(gedaan[gedaan.length - 1].invoer, { centen: 7 }, 'met de invoer die bij de claim bevroor');
  assert.equal(rijen(db)[0].stand, 'gebruikt');
});

test('intrekken: alleen de uitgever, alleen zolang ongebruikt, ook met het beheer-id', async () => {
  const { cap, db } = maak();
  const r = await cap.capMaak(A, { handeling: 'proef.doen' });
  const [{ id }] = cap.capOpenVan(A);
  assert.equal((await cap.capTrek(B, null, id)).status, 403);
  assert.equal(rijen(db)[0].stand, 'open');
  assert.equal((await cap.capTrek(A, null, id)).ok, true);
  assert.ok(rijen(db)[0].toegang.ingetrokken_at, 'server-side ingetrokken, met een tijd');
  assert.equal((await cap.capAanvaard(B, r.token, null)).status, 404);
  const op = await cap.capMaak(A, { handeling: 'proef.doen' });
  await cap.capAanvaard(B, op.token, null);
  assert.equal((await cap.capTrek(A, op.token)).status, 404, 'gebruikt is niet meer in te trekken');
});

test('verlopen is weg, en de bezem haalt de rij na tien minuten weg', async () => {
  const { cap, db, klok } = maak();
  const r = await cap.capMaak(A, { handeling: 'proef.doen' });
  klok.t += 121000;
  assert.equal((await cap.capKijk(B, r.token)).status, 404);
  assert.equal((await cap.capAanvaard(B, r.token, null)).status, 404);
  klok.t += 10 * 60000;
  await cap.capMaak(A, { handeling: 'proef.doen' });
  assert.equal(rijen(db).length, 1, 'de verlopen rij is opgeruimd');
});

test('opzoeken is constant-time over alle rijen, en er is geen tweede zoekweg', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server/kern/link/cap-bak.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(bron, /bearer\(\)\.vind\(Object\.values\(bron\)/, 'zoeken via bearercode.vind (timingSafeEqual, geen vroege uitgang)');
  assert.doesNotMatch(bron, /code_hash\s*===|\.find\(/, 'geen vergelijking met === en geen find()');
  for (const f of ['cap.js', 'cap-in.js', 'cap-beheer.js']) {
    const t = fs.readFileSync(path.join(__dirname, '..', 'server/kern/link', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(t, /new Map\(|linkCapToegang/, f + ' houdt geen eigen kluis bij');
  }
});
