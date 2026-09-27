/* De entreecode van een activiteitenticket (travelos.activity_ticket_entry),
   control voor control: 128 bits en kaal eenmaal, hash-only, issuer/doel/scope,
   verval aan het eind van de ticketdag, max_gebruik 1, intrekken door roteren,
   constant-time zoeken, de claim in de collectietransactie, en oude codes die
   niets meer openen. De laatste toets draait tegen een ECHTE server. De race
   over twee instances staat in test/ticketcodes.pg.test.js.
   Draai los: node --test test/tickettoegang.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

const T0 = Date.parse('2026-09-27T12:00:00.000Z');
const DAG = '2026-09-27';

function wereld() {
  let klok = T0;
  const db = { data: { boekingen: [], posSales: {} }, writable: true };
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'json', db, save() {} });
  const kern = require('../server/kern/tickettoegang')({ db, save() {}, bewerkCollectie, crypto,
    oudeRijen: () => db.data,
    nu: () => new Date(klok).toISOString() });
  const ticket = (ref, extra) => {
    const b = Object.assign({ ref, kind: 'ticket', supplierCode: 'ZAAK', customerKey: 'lid:' + ref,
      customerTier: 'rtg', datum: DAG, tijd: '14:00', paid: true, status: 'bevestigd', personen: 2 }, extra);
    db.data.boekingen.push(b); return b;
  };
  const boekingVan = ref => db.data.boekingen.find(b => b.ref === ref);
  const claim = (code, zaak = 'ZAAK') => kern.claim({ code, supplierCode: zaak, actor: { name: 'Deur' }, boekingVan });
  return { db, kern, ticket, claim, schuif: ms => { klok += ms; } };
}

test('1. 128 bits, kaal eenmaal, op schijf alleen de hash, en tonen roteert', () => {
  const w = wereld();
  const b = w.ticket('T1');
  const r = w.kern.uitgeven({ boeking: b, key: 'lid:T1' });
  assert.equal(r.status, 200);
  assert.match(r.code, /^TK\.[0-9A-F]{32}$/);
  const opslag = JSON.stringify(w.db.data.ticketToegang);
  assert.equal(opslag.includes(r.code.slice(3)), false, 'het geheim staat nergens in de collectie');
  assert.equal(JSON.stringify(b).includes(r.code.slice(3)), false, 'en niet op de boeking');
  assert.equal(JSON.stringify(r.toegang).includes(w.db.data.ticketToegang.T1.toegang.code_hash), false);
  const r2 = w.kern.uitgeven({ boeking: b, key: 'lid:T1' });
  assert.notEqual(r2.code, r.code);
  assert.equal(w.claim(r.code).status, 409, 'de vorige code is ingetrokken');
  assert.equal(w.claim(r2.code).status, 200);
});

test('2. issuer, doel, scope en verval aan het eind van de ticketdag', () => {
  const w = wereld();
  const r = w.kern.uitgeven({ boeking: w.ticket('T2'), key: 'lid:T2' });
  assert.equal(r.toegang.issuer, 'rtg.lid.ticket');
  assert.equal(r.toegang.doel, 'activiteit-entree');
  assert.deepEqual(r.toegang.scope, ['zaak.ticket.checkin']);
  assert.equal(r.toegang.issued_at, new Date(T0).toISOString());
  assert.equal(r.toegang.expires_at, DAG + 'T23:59:59.999Z');
  assert.equal(r.toegang.max_gebruik, 1);
  assert.equal(w.claim(r.code, 'ANDER').status, 404, 'de scope is de zaak');
  w.schuif(12 * 3600000);
  assert.equal(w.claim(r.code).status, 409, 'na de ticketdag verlopen');
  assert.match(w.claim(r.code).error, /verlopen/);
});

test('3. max_gebruik 1: de tweede scan laat niemand binnen', () => {
  const w = wereld();
  const b = w.ticket('T3');
  const { code } = w.kern.uitgeven({ boeking: b, key: 'lid:T3' });
  const een = w.claim(code);
  assert.equal(een.status, 200);
  assert.equal(w.db.data.ticketToegang.T3.toegang.gebruik, 1);
  const twee = w.claim(code);
  assert.equal(twee.status, 409);
  assert.match(twee.error, /Al binnen/);
  assert.equal(w.kern.uitgeven({ boeking: b, key: 'lid:T3' }).status, 409, 'een gebruikt ticket krijgt geen nieuwe code');
});

test('4. alleen de houder, alleen een betaald ticket van vandaag of later', () => {
  const w = wereld();
  assert.equal(w.kern.uitgeven({ boeking: w.ticket('T4'), key: 'lid:iemand' }).status, 404);
  assert.equal(w.kern.uitgeven({ boeking: w.ticket('T5', { paid: false }), key: 'lid:T5' }).status, 409);
  assert.equal(w.kern.uitgeven({ boeking: w.ticket('T6', { status: 'geweigerd' }), key: 'lid:T6' }).status, 409);
  assert.equal(w.kern.uitgeven({ boeking: w.ticket('T7', { datum: '2026-09-26' }), key: 'lid:T7' }).status, 409);
  // een ledenticket vernieuwt de zaak niet; een deurticket wel
  assert.equal(w.kern.uitgeven({ boeking: w.ticket('T8'), supplierCode: 'ZAAK' }).status, 404);
  const deur = w.ticket('D1', { customerKey: null, customerTier: null, deur: true });
  assert.equal(w.kern.uitgeven({ boeking: deur, supplierCode: 'ANDER' }).status, 404);
  const r = w.kern.uitgeven({ boeking: deur, supplierCode: 'ZAAK', actor: 'balie' });
  assert.equal(r.toegang.issuer, 'rtg.zaak.deurverkoop');
  // wordt het ticket na uitgifte geannuleerd, dan opent de code niets
  const b9 = w.ticket('T9');
  const c9 = w.kern.uitgeven({ boeking: b9, key: 'lid:T9' }).code;
  b9.status = 'geweigerd'; b9.refunded = true;
  assert.equal(w.claim(c9).status, 409);
});

test('5. constant-time: elke hash wordt vergeleken, ook na een treffer', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'tickettoegang.js'), 'utf8');
  const lus = bron.slice(bron.indexOf('for (const x of Object.values(bron))'), bron.indexOf('if (!r && oud'));
  assert.ok(lus.length > 40);
  assert.match(lus, /bearer\.zelfdeHash\(/);
  assert.doesNotMatch(lus, /\b(return|break)\b/);
  assert.doesNotMatch(lus, /===\s*gezocht|gezocht\s*===/);
});

test('6. oude codes worden van boeking en kassabon gehaald en openen niets', () => {
  const w = wereld();
  const oud = w.ticket('L1', { code: 'K7M2PX' });
  w.db.data.posSales.ZAAK = [{ bon: 'A1B2C3', desc: 'Deurverkoop Nacht' }, { bon: 'X', desc: 'Lunch' }];
  assert.ok(w.kern.ruimLegacy() >= 2);
  assert.equal('code' in oud, false);
  assert.equal(oud.codeLegacy, true);
  assert.equal(w.db.data.posSales.ZAAK[0].bon, null);
  assert.equal(w.db.data.posSales.ZAAK[1].bon, 'X', 'een gewoon bonnummer blijft staan');
  assert.equal(w.claim('K7M2PX').status, 404);
  assert.equal(w.kern.uitgeven({ boeking: oud, key: 'lid:L1' }).status, 200, 'het ticket houdt zijn waarde');
});

test('7. echte server: koop zonder code, tonen roteert, de deur laat een keer binnen', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tkt-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const api = async (pad, body, token) => {
    const r = await fetch(base + pad, { method: 'POST', body: JSON.stringify(body || {}),
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}) });
    const tekst = await r.text();
    let json = {}; try { json = JSON.parse(tekst); } catch (e) { json = {}; }
    return { status: r.status, body: json, tekst, koppen: r.headers };
  };
  try {
    const reg = n => api('/api/auth/register', { name: 'Tk ' + n, email: 'tk' + n + '@x.nl', phone: '061234' + n,
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    const lid = (await reg('5501')).body.token, ander = (await reg('5502')).body.token;
    const roster = (await api('/api/supplier/roster', { code: 'ESVEDRA' })).body.staff;
    const deur = (await api('/api/supplier/login', { code: 'ESVEDRA', staffId: roster.find(x => x.role !== 'manager').id, pin: '5678' })).body.token;
    const vandaag = new Date().toISOString().slice(0, 10);
    const k = await api('/api/ticket/koop', { supplierCode: 'ESVEDRA', activiteitId: 'a2', datum: vandaag, tijd: '14:00', personen: 1 }, lid);
    assert.equal(k.status, 200, k.tekst);
    assert.doesNotMatch(k.tekst, /TK\./, 'de koop draagt geen code');
    assert.equal((await api('/api/booking/pay', { ref: k.body.ticket.ref }, lid)).status, 200);
    assert.equal((await api('/api/ticket/toon', { ref: k.body.ticket.ref }, ander)).status, 404);
    const een = await api('/api/ticket/toon', { ref: k.body.ticket.ref }, lid);
    assert.match(een.body.code, /^TK\.[0-9A-F]{32}$/);
    assert.equal(een.koppen.get('cache-control'), 'no-store');
    const twee = await api('/api/ticket/toon', { ref: k.body.ticket.ref }, lid);
    for (const [pad, tok] of [['/api/tickets/mijn', lid], ['/api/supplier/programma', deur]])
      assert.equal((await api(pad, {}, tok)).tekst.includes(twee.body.code.slice(3)), false, pad + ' herhaalt de code niet');
    assert.equal((await api('/api/supplier/ticket/checkin', { code: een.body.code }, deur)).status, 409);
    const binnen = await api('/api/supplier/ticket/checkin', { code: twee.body.code.toLowerCase() }, deur);
    assert.equal(binnen.status, 200, binnen.tekst);
    assert.equal((await api('/api/supplier/ticket/checkin', { code: twee.body.code }, deur)).status, 409);
    const mijn = (await api('/api/tickets/mijn', {}, lid)).body.tickets.find(t => t.ref === k.body.ticket.ref);
    assert.equal(mijn.gebruikt, true, 'de boeking draagt de projectie van de check-in');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('8. echte server: de zaak toont een deurticket opnieuw, en dat roteert', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tkt-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const api = async (pad, body, token) => {
    const r = await fetch(base + pad, { method: 'POST', body: JSON.stringify(body || {}),
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}) });
    const tekst = await r.text();
    let json = {}; try { json = JSON.parse(tekst); } catch (e) { json = {}; }
    return { status: r.status, body: json, tekst, koppen: r.headers };
  };
  try {
    const roster = (await api('/api/supplier/roster', { code: 'ESVEDRA' })).body.staff;
    const deur = (await api('/api/supplier/login', { code: 'ESVEDRA', staffId: roster.find(x => x.role !== 'manager').id, pin: '5678' })).body.token;
    const verkocht = await api('/api/supplier/ticket/deurverkoop', { activiteitId: 'a2', tijd: '14:00', personen: 1, method: 'contant' }, deur);
    assert.equal(verkocht.status, 200, verkocht.tekst);
    const { ref, code: eerste } = verkocht.body.ticket;
    assert.match(eerste, /^TK\.[0-9A-F]{32}$/, 'de deurverkoop geeft de code een keer');
    const opnieuw = await api('/api/supplier/ticket/toon', { ref }, deur);
    assert.equal(opnieuw.status, 200, opnieuw.tekst);
    assert.match(opnieuw.body.code, /^TK\.[0-9A-F]{32}$/);
    assert.notEqual(opnieuw.body.code, eerste, 'opnieuw tonen is roteren');
    assert.equal(opnieuw.koppen.get('cache-control'), 'no-store');
    assert.equal((await api('/api/supplier/ticket/checkin', { code: eerste }, deur)).status, 409,
      'de eerste code is ingetrokken');
    assert.equal((await api('/api/supplier/ticket/checkin', { code: opnieuw.body.code }, deur)).status, 200);
    assert.equal((await api('/api/supplier/ticket/toon', { ref: 'Dbestaatniet' }, deur)).status >= 400, true);
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
