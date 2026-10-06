/* De sleutels van een werkruimte (workos.workspace_access_tokens), control voor
   control: 128 bits en eenmaal tonen, hash-only, issuer/doel/scope/onderwerp,
   vervaltijd, het plafond op sessies (een sessie telt geen gebruik), intrekken,
   roteren en de epoch, constant-time zoeken, de legacy-migratie en de
   productiedeur die zonder verse stand dicht blijft. Toets 9 draait tegen een
   ECHTE server.

   Draai los: node --test test/werksleutels.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');
const S = require('../server/bedrijf/sleutels');

const T0 = Date.parse('2026-09-27T12:00:00.000Z');
function wereld() {
  let klok = T0;
  const z = S.maak({ nu: () => new Date(klok).toISOString() });
  const w = { code: 'W1', leden: { a: { id: 'a', status: 'actief' }, b: { id: 'b', status: 'actief' } } };
  return { z, w, schuif: ms => { klok += ms; } };
}

test('1. 128 bits, eenmaal kaal, en op de werkruimte alleen een hash', () => {
  const { z, w } = wereld();
  const lid = z.geefLid(w, w.leden.a), beheer = z.geefBeheer(w);
  assert.match(lid, /^WL\.[0-9A-F]{32}$/);
  assert.match(beheer, /^WB\.[0-9A-F]{32}$/);
  const opslag = JSON.stringify(w);
  for (const code of [lid, beheer]) assert.equal(opslag.includes(code.slice(3)), false, 'het geheim staat nergens');
  assert.match(w.leden.a.sessies[0].code_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(z.geefLid(w, w.leden.a), lid, 'een tweede uitgifte is een nieuwe sessie, nooit de oude');
  assert.equal(z.lidVan(w, lid).l.id, 'a', 'en de eerste blijft werken tot hij verloopt of wordt ingetrokken');
});

test('2. issuer, doel, scope en onderwerp: een lidsessie is geen beheersleutel, en hoort bij EEN lid', () => {
  const { z, w } = wereld();
  const lid = z.geefLid(w, w.leden.a), beheer = z.geefBeheer(w);
  const t = w.leden.a.sessies[0];
  assert.equal(t.issuer, 'rtg.werkos');
  assert.equal(t.doel, 'werkruimte-lid');
  assert.deepEqual(t.scope, ['werkos.lid']);
  assert.deepEqual(t.onderwerp, { werkruimte: 'W1', lidId: 'a', epoch: 0 });
  assert.equal(w.beheerSessies[0].doel, 'werkruimte-beheer');
  assert.equal(z.beheerVan(w, lid), null, 'een lidsessie opent geen beheer');
  assert.equal(z.lidVan(w, beheer), null, 'en een beheersleutel is geen lid');
  assert.equal(z.lidVan({ code: 'W2', leden: w.leden }, lid), null, 'een andere werkruimte kent hem niet');
  w.leden.b.sessies = w.leden.a.sessies; w.leden.a.sessies = [];
  assert.equal(z.lidVan(w, lid), null, 'op een ander lid geplakt opent hij niets');
  w.leden.a.sessies = w.leden.b.sessies; w.leden.b.sessies = [];
  t.scope = ['werkos.beheer'];
  assert.equal(z.lidVan(w, lid), null, 'een omgezette scope opent niets');
});

test('3. issued_at en expires_at: lid zeven dagen, beheer dertig', () => {
  const { z, w, schuif } = wereld();
  const lid = z.geefLid(w, w.leden.a), beheer = z.geefBeheer(w);
  assert.equal(w.leden.a.sessies[0].issued_at, new Date(T0).toISOString());
  assert.equal(w.leden.a.sessies[0].expires_at, new Date(T0 + S.LID_MS).toISOString());
  assert.equal(w.beheerSessies[0].expires_at, new Date(T0 + S.BEHEER_MS).toISOString());
  schuif(S.LID_MS + 1000);
  assert.equal(z.lidVan(w, lid), null, 'de lidsessie is verlopen');
  assert.ok(z.beheerVan(w, beheer), 'de beheersleutel nog niet');
  assert.equal(z.roteer(w, lid, 'lid'), null, 'een verlopen sessie roteert niet naar een verse');
  schuif(S.BEHEER_MS);
  assert.equal(z.beheerVan(w, beheer), null);
});

test('4. een sessie telt geen gebruik, maar er zijn er hooguit MAX_SESSIES per lid', () => {
  const { z, w } = wereld();
  const eerste = z.geefLid(w, w.leden.a);
  for (let i = 0; i < 20; i++) assert.ok(z.lidVan(w, eerste), 'lezen ' + i);
  assert.equal(w.leden.a.sessies[0].max_gebruik, 0, '0 = niet geteld: een sessie is geen eenmalige code');
  assert.equal(w.leden.a.sessies[0].gebruik, 0);
  for (let i = 1; i < S.MAX_SESSIES; i++) z.geefLid(w, w.leden.a);
  assert.ok(z.lidVan(w, eerste), 'bij het plafond werkt de eerste nog');
  z.geefLid(w, w.leden.a);
  assert.equal(w.leden.a.sessies.length, S.MAX_SESSIES);
  assert.equal(z.lidVan(w, eerste), null, 'daarboven valt de oudste af');
});

test('5. server-side roteren, intrekken en de epoch', () => {
  const { z, w } = wereld();
  const a1 = z.geefLid(w, w.leden.a), a2 = z.geefLid(w, w.leden.a), b1 = z.geefLid(w, w.leden.b);
  const nieuw = z.roteer(w, a1, 'lid');
  assert.match(nieuw, /^WL\.[0-9A-F]{32}$/);
  assert.equal(z.lidVan(w, a1), null, 'de geroteerde werkt niet meer');
  assert.ok(z.lidVan(w, nieuw));
  assert.equal(z.intrek(w, nieuw, 'lid'), true);
  assert.equal(z.lidVan(w, nieuw), null, 'ingetrokken');
  assert.ok(z.lidVan(w, a2), 'intrekken raakt alleen die ene sessie');
  S.sluit(w.leden.a);
  assert.equal(w.leden.a.sessieEpoch, 1);
  assert.equal(z.lidVan(w, a2), null, 'na sluit() werkt geen enkele sessie van dat lid');
  assert.equal(z.lidVan(w, b1).l.id, 'b', 'het andere lid blijft binnen');
  // een sessie van voor de epoch komt ook met een teruggezette lijst niet terug
  w.leden.a.sessies = [Object.assign({}, w.leden.b.sessies[0], { onderwerp: { werkruimte: 'W1', lidId: 'a', epoch: 0 } })];
  w.leden.b.sessies = [];
  assert.equal(z.lidVan(w, b1), null, 'epoch 0 tegen sessieEpoch 1: dicht');
  const beheer = z.geefBeheer(w);
  S.sluitBeheer(w);
  assert.equal(z.beheerVan(w, beheer), null, 'sluitBeheer sluit elke beheersleutel');
});

test('6. constant-time: elke sessie van elke medewerker, geen vroege uitgang', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'bedrijf', 'sleutels.js'), 'utf8');
  const lus = bron.slice(bron.indexOf('for (const [l, rij] of kandidaten)'), bron.indexOf('if (!hit || reden('));
  assert.ok(lus.length > 40);
  assert.match(lus, /bearer\.zelfdeHash\(/);
  assert.doesNotMatch(lus, /\b(return|break)\b/, 'de positie mag niet verraden welke rij raak was');
  const { z, w } = wereld();
  for (let i = 0; i < 40; i++) { w.leden['x' + i] = { id: 'x' + i, status: 'actief' }; z.geefLid(w, w.leden['x' + i]); }
  const doel = z.geefLid(w, w.leden.b);
  assert.equal(z.lidVan(w, doel).l.id, 'b');
  assert.equal(z.lidVan(w, doel.toLowerCase()).l.id, 'b');
});

test('7. legacy: een oude kale sleutel wordt hash met vervaltijd, en productie houdt er geen over', () => {
  const { z } = wereld();
  const oudBeheer = 'ab'.repeat(24), oudLid = 'cd'.repeat(24);
  const ws = { W1: { code: 'W1', beheerToken: oudBeheer, leden: {
    a: { id: 'a', status: 'actief', token: oudLid }, c: { id: 'c', status: 'uit dienst', token: 'ef'.repeat(24) } } } };
  assert.equal(z.migreer(ws), 3);
  const w = ws.W1;
  assert.equal('beheerToken' in w, false);
  assert.equal('token' in w.leden.a, false);
  assert.equal(JSON.stringify(ws).includes(oudLid), false, 'niets kaals meer op schijf');
  assert.equal(w.leden.a.sessies[0].legacy, 'legacy192');
  assert.ok(z.lidVan(w, oudLid), 'een actief lid houdt zijn sessie');
  assert.ok(z.beheerVan(w, oudBeheer));
  assert.equal((w.leden.c.sessies || []).length, 0, 'een lid uit dienst krijgt niets terug');
  const prod = { W1: { code: 'W1', beheerToken: oudBeheer, leden: { a: { id: 'a', status: 'actief', token: oudLid } } } };
  z.migreer(prod, { productie: true });
  assert.equal(JSON.stringify(prod).includes(oudLid) || JSON.stringify(prod).includes('sessies'), false,
    'productie vervangt niets: daar is het account de sleutel');
});

test('8. productie: de deur is het account plus een verse stand, en zonder die stand blijft hij dicht', async () => {
  const maak = require('../server/bedrijf/productie-identiteit');
  const res = () => { const u = { status: 200, body: null, koppen: {} }; return { u,
    set(k, v) { u.koppen[String(k).toLowerCase()] = v; return this; },
    status(c) { u.status = c; return this; }, json(b) { u.body = b; return this; } }; };
  for (const db of [{ data: {} }, { data: {}, async verversVerzoekCollectie() { throw new Error('PG weg'); } }]) {
    const r = res(); let door = 0;
    await maak({ productie: true, db }).laadContext({ body: { werkruimte: 'W1' },
      session: { key: 'user-1', account: { actief: 1 } } }, r, () => { door++; });
    assert.equal(r.u.status, 503); assert.equal(r.u.body.code, maak.CODE_OPSLAG); assert.equal(door, 0);
  }
  const ververst = [];
  const db = { data: { werkruimtes: { W1: { code: 'W1', leden: { a: { id: 'a', status: 'actief', rtgKey: 'user-1' } } } } },
    async verversVerzoekCollectie(k) { ververst.push(k); } };
  const r = res(); let door = 0;
  const req = { body: { werkruimte: 'W1' }, session: { key: 'user-1', account: { actief: 1 } } };
  await maak({ productie: true, db }).laadContext(req, r, () => { door++; });
  assert.equal(door, 1, 'met een verse stand en een actief lid gaat de deur open');
  assert.deepEqual(ververst, ['tenants', 'werkruimtes']);
  const r2 = res();
  await maak({ productie: true, db }).laadContext({ body: { werkruimte: 'W1', lidToken: 'WL.' + 'A'.repeat(32) },
    session: { key: 'user-1', account: { actief: 1 } } }, r2, () => { door++; });
  assert.equal(r2.u.status, 400, 'in productie opent geen enkele sessiesleutel iets');
  const idx = fs.readFileSync(path.join(__dirname, '..', 'server', 'db', 'index.js'), 'utf8');
  assert.match(idx, /db\.verversVerzoekCollectie = async/, 'de opslag levert de verse stand echt');
});

async function api(base, pad, body, extra) {
  const r = await fetch(base + pad, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, extra || {}), body: JSON.stringify(body || {}) });
  const tekst = await r.text(); let json = null; try { json = JSON.parse(tekst); } catch (e) {}
  return { status: r.status, body: json, tekst, koppen: r.headers };
}

test('9. echte server: eenmaal tonen, roteren, intrekken en uit dienst', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werksleutel-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const w = await api(base, '/api/bedrijf/werkruimte/maak', { naam: 'Sleutelproef B.V.' });
    assert.equal(w.status, 200);
    assert.match(w.body.beheerToken, /^WB\.[0-9A-F]{32}$/);
    const code = w.body.werkruimte, beheer = w.body.beheerToken;
    const aan = await api(base, '/api/bedrijf/lid/aanmeld', { werkruimte: code, naam: 'Pia' });
    assert.match(aan.body.lidToken, /^WL\.[0-9A-F]{32}$/);
    assert.equal((await api(base, '/api/bedrijf/lid/besluit', { werkruimte: code, beheerToken: beheer, lidId: aan.body.lidId, akkoord: true })).status, 200);
    const lid = aan.body.lidToken;
    assert.equal((await api(base, '/api/bedrijf/mijn-rechten', { werkruimte: code, lidToken: lid })).status, 200);
    const leden = await api(base, '/api/bedrijf/leden', { werkruimte: code, beheerToken: beheer });
    assert.equal(/W[BL]\.[0-9A-F]{32}|code_hash/.test(leden.tekst), false, 'geen sleutel en geen hash in de ledenlijst');

    const rot = await api(base, '/api/bedrijf/sleutel/roteer', { werkruimte: code, lidToken: lid });
    assert.equal(rot.status, 200);
    assert.equal(rot.koppen.get('cache-control'), 'no-store');
    const lid2 = rot.body.lidToken;
    assert.notEqual(lid2, lid);
    assert.equal((await api(base, '/api/bedrijf/mijn-rechten', { werkruimte: code, lidToken: lid })).status, 403, 'de oude is weg');
    assert.equal((await api(base, '/api/bedrijf/mijn-rechten', { werkruimte: code, lidToken: lid2 })).status, 200);
    const herhaal = await api(base, '/api/bedrijf/sleutel/roteer', { werkruimte: code, lidToken: lid });
    assert.equal(herhaal.status, 403, 'een geroteerde sleutel roteert niet nog eens');
    assert.equal(herhaal.tekst.includes(lid2), false, 'en een herhaling heronthult niets');

    // ook met een Idempotency-Key herhaalt geen antwoordcache de nieuwe sleutel
    const k = { 'Idempotency-Key': 'werksleutel-' + Date.now() };
    const k1 = await api(base, '/api/bedrijf/sleutel/roteer', { werkruimte: code, lidToken: lid2 }, k);
    const k2 = await api(base, '/api/bedrijf/sleutel/roteer', { werkruimte: code, lidToken: lid2 }, k);
    assert.equal(k1.status, 200);
    assert.equal(k2.tekst.includes(k1.body.lidToken), false, 'de retrycache toont de sessie geen tweede keer');

    const rotB = await api(base, '/api/bedrijf/sleutel/roteer', { werkruimte: code, beheerToken: beheer });
    assert.match(rotB.body.beheerToken, /^WB\./);
    assert.equal((await api(base, '/api/bedrijf/leden', { werkruimte: code, beheerToken: beheer })).status, 403);
    const beheer2 = rotB.body.beheerToken;

    const lid3 = k1.body.lidToken;
    assert.equal((await api(base, '/api/bedrijf/sleutel/intrek', { werkruimte: code, lidToken: lid3 })).status, 200);
    assert.equal((await api(base, '/api/bedrijf/mijn-rechten', { werkruimte: code, lidToken: lid3 })).status, 403, 'ingetrokken');

    const aan2 = await api(base, '/api/bedrijf/lid/aanmeld', { werkruimte: code, naam: 'Bram' });
    await api(base, '/api/bedrijf/lid/besluit', { werkruimte: code, beheerToken: beheer2, lidId: aan2.body.lidId, akkoord: true });
    const uit = await api(base, '/api/bedrijf/lid/uit-dienst', { werkruimte: code, beheerToken: beheer2, lidId: aan2.body.lidId, reden: 'Einde contract.' });
    assert.equal(uit.status, 200);
    assert.equal((await api(base, '/api/bedrijf/mijn-rechten', { werkruimte: code, lidToken: aan2.body.lidToken })).status, 403,
      'uit dienst sluit elke sessie van dat lid');
    /* En die sessies komen niet terug als hij later opnieuw wordt toegelaten:
       de epoch is omhoog, dus alleen een NIEUWE sessie opent weer. */
    assert.equal((await api(base, '/api/bedrijf/lid/besluit', { werkruimte: code, beheerToken: beheer2, lidId: aan2.body.lidId, akkoord: true })).status, 200);
    assert.equal((await api(base, '/api/bedrijf/mijn-rechten', { werkruimte: code, lidToken: aan2.body.lidToken })).status, 403,
      'een oude sessie herleeft niet met de status');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* FASE 1, PROEF B: de werkruimtesessie op bearercode v2. Het tegendeel van
   proef A (de cadeaukaart): een DUUR in plaats van een absoluut einde, gebruik
   'sessie' in plaats van een teller, en afgeleid 'perAanroep' -- de epoch wordt
   bij elke aanroep opnieuw getoetst, er ontstaat niets dat blijft. */
test('10. bearercode v2: sessie in plaats van max_gebruik 0, een contracthash, en legacy blijft v1', () => {
  const { z, w, schuif } = wereld();
  const lid = z.geefLid(w, w.leden.a);
  const t = w.leden.a.sessies[0];
  assert.deepEqual([t.contractversie, t.gebruiksvorm, t.afgeleid], [2, 'sessie', 'perAanroep']);
  for (let i = 0; i < 50; i++) assert.ok(z.lidVan(w, lid), 'een sessie raakt niet op');

  const einde = t.expires_at;
  t.expires_at = '2099-01-01T00:00:00.000Z';
  assert.equal(z.lidVan(w, lid), null, 'een verlengd einde opent niets');
  t.expires_at = einde;
  t.onderwerp.lidId = 'b';
  assert.equal(z.lidVan(w, lid), null, 'een sessie omhangen naar een ander lid opent niets');
  t.onderwerp.lidId = 'a';
  assert.ok(z.lidVan(w, lid), 'teruggezet werkt hij weer');

  S.sluit(w.leden.a);
  assert.equal(z.lidVan(w, lid), null, 'de epoch sluit nog steeds elke sessie');

  const ws = { W1: { code: 'W1', leden: { a: { id: 'a', status: 'actief', token: 'cd'.repeat(24) } } } };
  z.migreer(ws);
  const oud = ws.W1.leden.a.sessies[0];
  assert.equal(oud.contractversie, undefined, 'een oude sleutel blijft v1: zijn hash kwam niet uit maak()');
  assert.ok(z.lidVan(ws.W1, 'cd'.repeat(24)), 'en werkt onder de v1-regels');
  const nieuw = z.roteer(ws.W1, 'cd'.repeat(24), 'lid');
  assert.equal(ws.W1.leden.a.sessies.find(x => !x.ingetrokken_at).contractversie, 2, 'na roteren is hij v2');
  assert.ok(z.lidVan(ws.W1, nieuw));
  schuif(8 * 86400000);
  assert.equal(z.lidVan(ws.W1, nieuw), null, 'zeven dagen, ook na de overstap');
});
