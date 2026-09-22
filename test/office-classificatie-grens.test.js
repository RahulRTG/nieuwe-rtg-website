'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { startServer, stopNet } = require('./helper');

test('strikte gezinsdocumenten blijven privé via API, lijst, opslag en herstart', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-office-strikt-'));
  const env = { RTG_DATA_DIR: dir, RTG_STORE: 'sqlite', RTG_ENC_KEY: '', SMTP_URL: '', RTG_BIND: '127.0.0.1', STUN_UIT: '1' };
  let srv;
  const api = async (pad, body) => {
    const r = await fetch(srv.base + pad, { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  };
  const opgeslagen = id => {
    const db = new DatabaseSync(path.join(dir, 'store.db'), { readOnly: true });
    try { return JSON.parse(db.prepare('SELECT val FROM kv WHERE key=?').get('officeDocs').val)[id]; }
    finally { db.close(); }
  };
  try {
    srv = await startServer({ env });
    const gezin = await api('/api/foundation/gezin/maak', { gezinsnaam: 'Classificatieproef', naam: 'Eigenaar', pin: '1234' });
    assert.equal(gezin.status, 200);
    const owner = { code: gezin.body.code, token: gezin.body.token };
    const profiel = await api('/api/foundation/gezin/profiel/maak', { ...owner, naam: 'Tweede', rol: 'kind', groep: 'kind' });
    assert.equal(profiel.status, 200);
    const kies = await api('/api/foundation/gezin/profiel/kies', { code: owner.code, profielId: profiel.body.profiel.id });
    assert.equal(kies.status, 200);
    const reader = { code: owner.code, token: kies.body.token };
    const rtf = (actie, data = {}, actor = owner) => api('/api/rtf/kantoorpakket/' + actie, { ...actor, ...data });
    const maak = await rtf('maak', { soort: 'tekst', titel: 'Privé document' });
    assert.equal(maak.status, 200);
    const id = maak.body.id;
    assert.equal((await rtf('beheer', { id, classificatie: 'strikt' })).status, 200);
    const before = opgeslagen(id);
    for (const rechten of ['lezen', 'bewerken']) {
      assert.equal((await rtf('gezin', { id, rechten })).status, 409, 'strikt blokkeert ook gezinsdeling');
      assert.deepEqual(opgeslagen(id), before, 'weigering laat document en audit ongemoeid');
    }
    assert.equal((await rtf('open', { id }, reader)).status, 403);
    const list = await rtf('mijn', {}, reader);
    assert.ok(!list.body.gedeeld.some(d => d.id === id));

    // De omgekeerde volgorde mag evenmin een tegenstrijdige staat opslaan.
    assert.equal((await rtf('beheer', { id, classificatie: 'intern' })).status, 200);
    assert.equal((await rtf('gezin', { id, rechten: 'lezen' })).status, 200);
    const sharedList = await rtf('mijn', {}, reader);
    assert.ok(sharedList.body.gedeeld.some(d => d.id === id), 'dezelfde lijst toont een toegelaten deling wel');
    const shared = opgeslagen(id);
    assert.equal((await rtf('beheer', { id, classificatie: 'strikt' })).status, 409);
    assert.deepEqual(opgeslagen(id), shared);
    assert.equal((await rtf('open', { id }, reader)).status, 200, 'bestaande toestemming wordt niet stil ingetrokken');
    assert.equal((await rtf('gezin', { id, rechten: 'uit' })).status, 200);
    assert.equal((await rtf('beheer', { id, classificatie: 'strikt' })).status, 200);
    const final = opgeslagen(id);
    await stopNet(srv.child); srv = null;
    srv = await startServer({ env });
    assert.equal((await rtf('open', { id }, reader)).status, 403);
    assert.equal((await rtf('open', { id })).status, 200);
    assert.deepEqual(opgeslagen(id), final, 'strikt en ingetrokken toegang blijven duurzaam');
  } finally {
    if (srv) await stopNet(srv.child);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('oude tegenstrijdige strikte documenten lekken niet via lezen, schrijven, lijsten of meldingen', () => {
  const db = { data: {} }, events = [];
  let saves = 0;
  const office = require('../server/kern/office').maakOffice({ db, crypto,
    save() { saves++; }, schoon: (v, n) => String(v || '').slice(0, n), codenaamVan: k => k,
    sseToCustomer: (...args) => events.push(args) }).office;
  const owner = 'rtf:TEST:maker', other = 'rtf:TEST:ander', circle = 'rtfgezin:TEST';
  const made = office.maak(owner, { titel: 'Historische ongeldige stand' }, circle);
  const doc = db.data.officeDocs[made.id];
  // Alleen de fixture construeert de oude ongeldige opslag. De publieke API mag dit niet meer maken.
  doc.beheer.classificatie = 'strikt'; doc.kringDeel = 'bewerken';
  doc.bewerkers = [other]; doc.gedeeldMet = [other];
  const before = structuredClone(doc), count = saves;
  assert.equal(office.open(other, doc.id, circle).status, 403);
  assert.equal(office.bewaar(other, doc.id, { inhoud: { tekst: 'ongewenst' } }, circle).status, 403);
  assert.equal(office.versies(other, doc.id, circle).status, 403);
  assert.equal(office.samen(other, doc.id, circle).status, 403);
  assert.equal(office.aanwezig(other, doc.id, { client: 'x' }, circle).status, 403);
  assert.equal(office.opmerking(other, doc.id, { tekst: 'ongewenst' }, circle).status, 403);
  assert.equal(office.fase(other, doc.id, { naar: 'beoordeling' }, circle).status, 403);
  assert.ok(!office.mijn(other, circle).gedeeld.some(d => d.id === doc.id));
  assert.deepEqual(doc, before);
  assert.equal(saves, count);
  assert.equal(office.open(owner, doc.id, circle).status, 200);
  assert.equal(office.bewaar(owner, doc.id, { inhoud: { tekst: 'van de maker' } }, circle).status, 200);
  assert.equal(office.fase(owner, doc.id, { naar: 'beoordeling' }, circle).status, 200);
  assert.equal(office.opmerking(owner, doc.id, { tekst: 'eigen opmerking' }, circle).status, 200);
  assert.deepEqual(events, [], 'geen titel of status naar voormalige ontvangers');
  assert.equal(office.kring(owner, doc.id, 'uit').status, 200, 'intrekken blijft altijd mogelijk');
});
