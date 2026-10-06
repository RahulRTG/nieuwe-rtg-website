/* De Arrival Pass van Invisible Arrival (livingos.invisible_arrival_pass),
   control voor control: entropie en eenmaal tonen, hash-only opslag, issuer/
   doel/scope, vervaltijd met vaste horizon, max_gebruik, intrekken en roteren,
   constant-time zoeken, en de atomaire claim van de voorbereiding. Toetsen 9 en
   10 draaien tegen een ECHTE server. De raceproef over twee instances staat in
   test/arrivalpas.pg.test.js.

   Draai los: node --test test/arrivalpas.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

const T0 = Date.parse('2026-09-27T12:00:00.000Z');
const RT = (n) => 'aanvraag' + String(n).padStart(4, '0') + 'abcdefghijklmnopqrstuvwx';

function wereld() {
  let klok = T0;
  const sleutels = [];
  const db = { data: {}, writable: true };
  const basis = require('../server/db/collectie-bewerken')({ store: 'json', db, save() {} });
  const bewerkCollectie = (sleutel, werk) => { sleutels.push(sleutel); return basis(sleutel, werk); };
  const kern = require('../server/kern/arrivalpas')({ db, bewerkCollectie, crypto, nu: () => new Date(klok).toISOString() });
  const reserveringen = new Map();
  const reserveringVan = id => reserveringen.get(id);
  function vraag(n, extra) {
    const reserveringId = 'R' + n;
    reserveringen.set(reserveringId, { id: reserveringId, supplierCode: 'ZAAK', status: 'aangevraagd' });
    return kern.aanvraag(Object.assign({ requestToken: RT(n), supplierCode: 'ZAAK', reserveringId,
      datum: '2026-09-28', tijd: '20:00' }, extra || {}));
  }
  return { db, kern, vraag, reserveringVan, reserveringen, sleutels, schuif: ms => { klok += ms; } };
}

test('1. entropie en eenmaal tonen: 128 bits van de server, en een herhaling roteert in plaats van te herhalen', () => {
  const w = wereld();
  const a = w.vraag(1);
  assert.equal(a.status, 200);
  assert.match(a.code, /^AR\.[0-9A-F]{32}$/, '32 hexcijfers = 128 bits uit randomBytes(16)');
  const opslag = JSON.stringify(w.db.data.arrivalToegang);
  assert.equal(opslag.includes(a.code.slice(3)), false, 'het geheim staat nergens in de collectie');
  assert.equal(opslag.includes(RT(1)), false, 'de aanvraagcode ook niet');
  assert.match(w.db.data.arrivalToegang[a.id].toegang.code_hash, /^[a-f0-9]{64}$/);
  assert.deepEqual(w.sleutels, ['arrivalToegang'], 'de uitgifte loopt door de collectietransactie');

  const b = w.vraag(1);
  assert.equal(b.status, 200);
  assert.equal(b.herhaald, true);
  assert.equal(b.id, a.id, 'geen tweede reservering');
  assert.notEqual(b.code, a.code, 'de eerste pass wordt nooit opnieuw getoond');
  assert.equal(w.kern.lees(a.code, w.reserveringVan).status, 401, 'de vorige werkt niet meer');
  assert.equal(w.kern.lees(b.code, w.reserveringVan).status, 200);

  // de herhaling is begrensd: na gebruik, na een kwartier en na drie keer is het dicht
  w.kern.puls(b.code, 'onderweg', w.reserveringVan);
  assert.equal(w.vraag(1).status, 409, 'een pass die al gebruikt is, wordt niet vervangen door een herhaalde aanvraag');
  const c = w.vraag(2);
  w.schuif(16 * 60000);
  assert.equal(w.vraag(2).status, 409, 'na een kwartier opent de aanvraagcode niets meer');
  assert.equal(w.kern.lees(c.code, w.reserveringVan).status, 200, 'en de pass zelf blijft gewoon werken');
  w.vraag(3); w.vraag(3); w.vraag(3); w.vraag(3);
  assert.equal(w.vraag(3).status, 409, 'hooguit drie keer herstellen');
  const z = wereld(); z.vraag(4);
  assert.equal(z.vraag(4, { supplierCode: 'ANDER' }).status, 409, 'een aanvraagcode hoort bij een zaak');
  assert.equal(z.vraag(4).status, 200, 'bij dezelfde zaak mag hij nog roteren');
});

test('2. issuer, doel en scope: de pass hoort bij EEN aankomst bij EEN zaak', () => {
  const w = wereld();
  const a = w.vraag(1);
  const t = w.db.data.arrivalToegang[a.id].toegang;
  assert.equal(t.issuer, 'rtg.gast.arrival');
  assert.equal(t.doel, 'arrival-pass');
  assert.deepEqual(t.scope, ['arrival.pass.lezen', 'arrival.puls']);
  assert.deepEqual(t.onderwerp, { soort: 'arrival', id: a.id, supplierCode: 'ZAAK', reserveringId: 'R1' });
  t.doel = 'iets-anders';
  assert.equal(w.kern.lees(a.code, w.reserveringVan).status, 401, 'een ander doel opent niets');
  t.doel = 'arrival-pass';
  /* Een scope die na uitgifte met de hand wordt aangepast, maakt de pass DICHT
     (A3: een beveiligingsveld verandert alleen via gebruik, intrekken of
     roteren). Ook een versmalling: wie de opslag kan wijzigen, mag de pass niet
     herschrijven tot iets dat er nooit is uitgegeven. */
  t.scope = ['arrival.pass.lezen'];
  assert.equal(w.kern.lees(a.code, w.reserveringVan).status, 401, 'een met de hand gewijzigde scope opende de pass');
  assert.equal(w.kern.puls(a.code, 'onderweg', w.reserveringVan).status, 401, 'en pulsen ook niet');
  t.scope = ['arrival.pass.lezen', 'arrival.puls'];
  assert.equal(w.kern.lees(a.code, w.reserveringVan).status, 200, 'het oorspronkelijke record opent weer');
  t.scope = ['arrival.pass.lezen', 'arrival.puls'];
  t.onderwerp.supplierCode = 'ANDER';
  assert.equal(w.kern.lees(a.code, w.reserveringVan).status, 401, 'een onderwerp van een andere zaak telt niet');
  t.onderwerp.supplierCode = 'ZAAK';
  w.reserveringen.get('R1').supplierCode = 'VERHUISD';
  assert.equal(w.kern.lees(a.code, w.reserveringVan).status, 410, 'een reservering die niet meer bij deze zaak hoort sluit de pass');
});

test('3. issued_at en expires_at: aankomst plus twaalf uur, en een vaste horizon', () => {
  const w = wereld();
  const a = w.vraag(1);
  const t = w.db.data.arrivalToegang[a.id].toegang;
  assert.equal(t.issued_at, new Date(T0).toISOString());
  assert.equal(t.expires_at, new Date(new Date('2026-09-28T20:00:00').getTime() + 12 * 3600000).toISOString());
  assert.equal(w.kern.binnenHorizon('2026-11-25', '12:00'), true);
  assert.equal(w.kern.binnenHorizon('2026-11-27', '12:00'), false, 'meer dan zestig dagen vooruit krijgt geen pass');
  w.schuif(Date.parse(t.expires_at) - T0 + 1000);
  assert.equal(w.kern.lees(a.code, w.reserveringVan).status, 410, 'verlopen');
  assert.equal(w.kern.puls(a.code, 'onderweg', w.reserveringVan).status, 410);
  assert.equal(w.kern.roteer(a.code, w.reserveringVan).status, 410, 'een verlopen pass roteert niet naar een verse');
});

test('4. max_gebruik telt pulsen; lezen blijft werken tot het verval', () => {
  const w = wereld();
  const a = w.vraag(1);
  for (let i = 0; i < 60; i++) assert.equal(w.kern.puls(a.code, 'onderweg', w.reserveringVan).status, 200, 'puls ' + i);
  assert.equal(w.db.data.arrivalToegang[a.id].toegang.gebruik, 60);
  assert.equal(w.kern.puls(a.code, 'onderweg', w.reserveringVan).status, 429, 'de eenenzestigste puls komt er niet door');
  assert.equal(w.kern.lees(a.code, w.reserveringVan).status, 200, 'de pass tonen kan nog');
});

test('5. server-side intrekken en roteren, en een reservering die niet doorgaat sluit de pass', () => {
  const w = wereld();
  const a = w.vraag(1);
  const r = w.kern.roteer(a.code, w.reserveringVan);
  assert.equal(r.status, 200);
  assert.notEqual(r.code, a.code);
  assert.equal(w.kern.lees(a.code, w.reserveringVan).status, 401, 'de oude pass is weg');
  const rij = w.db.data.arrivalToegang[a.id];
  assert.ok(rij.historie[0].ingetrokken_at, 'de vorige staat ingetrokken in de historie');
  assert.equal(rij.toegang.rotatie, 2);
  assert.equal(w.kern.intrek(r.code).status, 200);
  assert.equal(w.kern.lees(r.code, w.reserveringVan).status, 410, 'ingetrokken');
  assert.equal(w.kern.roteer(r.code, w.reserveringVan).status, 410, 'een ingetrokken pass roteert niet terug');

  for (const status of ['geweigerd', 'geannuleerd', 'no-show', 'afgerond']) {
    const x = wereld();
    const b = x.vraag(7);
    x.reserveringen.get('R7').status = status;
    const lees = x.kern.lees(b.code, x.reserveringVan);
    assert.equal(lees.status, 410, status);
    assert.equal(lees.dicht, true);
    assert.equal(x.kern.puls(b.code, 'onderweg', x.reserveringVan).status, 410, status);
    assert.ok(x.db.data.arrivalToegang[b.id].toegang.ingetrokken_at, 'de puls legt het vast als ingetrokken: ' + status);
  }
  const y = wereld();
  const c = y.vraag(8);
  y.reserveringen.delete('R8');
  assert.equal(y.kern.lees(c.code, y.reserveringVan).status, 410, 'een verdwenen reservering sluit ook');
});

test('6. constant-time zoeken: elke hash, geen vroege uitgang, en een oude vorm opent niets', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'arrivalpas.js'), 'utf8');
  for (const [van, tot] of [['function zoek(', 'function nieuwePas('], ['function kent(', 'function lees(']]) {
    const lus = bron.slice(bron.indexOf(van), bron.indexOf(tot));
    assert.match(lus, /for \(const r of Object\.values\(/, van);
    assert.match(lus, /bearer\.zelfdeHash\(/, van);
    const binnen = lus.slice(lus.indexOf('for ('), lus.lastIndexOf('return'));
    assert.doesNotMatch(binnen, /\b(break|return)\b/, van + ': geen vroege uitgang');
  }
  const w = wereld();
  for (let i = 10; i < 60; i++) w.vraag(i);
  const doel = w.vraag(99);
  assert.equal(w.kern.lees(doel.code, w.reserveringVan).rij.id, doel.id);
  // de oude pass (door de browser gekozen <id>.<geheim>, als hash op de projectie) is geen credential meer
  assert.equal(w.kern.lees('oudelocatorabcdefghijkl.oudgeheimabcdefghijklmn', w.reserveringVan).status, 401);
  assert.equal(w.kern.lees(doel.code.toLowerCase(), w.reserveringVan).status, 200, 'hoofdletters maken niet uit');
});

test('7. de voorbereiding wordt EENMAAL geclaimd, in dezelfde transactie als het gebruik', () => {
  const w = wereld();
  const a = w.vraag(1);
  assert.equal(w.kern.puls(a.code, 'onderweg', w.reserveringVan).prep, false);
  assert.equal(w.kern.puls(a.code, 'in-de-buurt', w.reserveringVan).prep, true, 'de eerste nabije puls claimt');
  assert.equal(w.kern.puls(a.code, 'gearriveerd', w.reserveringVan).prep, false, 'de tweede niet meer');
  assert.ok(w.sleutels.every(s => s === 'arrivalToegang'));
  assert.throws(() => require('../server/kern/arrivalpas')({ db: { data: {} }, crypto }), /collectietransactie/);
});

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-arrival-')); }
async function api(base, pad, body, token, extra) {
  const h = Object.assign({ 'Content-Type': 'application/json' }, extra || {}); if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  const tekst = await r.text();
  let json = null; try { json = JSON.parse(tekst); } catch (e) {}
  return { status: r.status, body: json, tekst, koppen: r.headers };
}
async function zaak(base, code) {
  const roster = (await api(base, '/api/supplier/roster', { code })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  return (await api(base, '/api/supplier/login', { code, staffId: mgr.id, pin: '1234' })).body.token;
}
const morgen = () => { const d = new Date(Date.now() + 86400000); return d.toISOString().slice(0, 10); };

test('8. echte server: de pass staat eenmaal in het antwoord, een herhaling roteert, en roteren en intrekken werken', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const lijf = { requestToken: RT(1), supplierCode: 'KIKUNOI', datum: morgen(), tijd: '20:00', personen: 2, naam: 'Gast' };
    const eerste = await api(base, '/api/arrival/request', lijf);
    assert.equal(eerste.status, 200, eerste.tekst.slice(0, 200));
    assert.match(eerste.body.pass.accessToken, /^AR\.[0-9A-F]{32}$/);
    assert.equal(eerste.koppen.get('cache-control'), 'no-store');
    const tweede = await api(base, '/api/arrival/request', lijf);
    assert.equal(tweede.status, 200);
    assert.equal(tweede.body.pass.id, eerste.body.pass.id, 'een herhaling maakt geen tweede aankomst');
    assert.equal(tweede.tekst.includes(eerste.body.pass.accessToken), false, 'en toont de eerste pass nooit opnieuw');
    assert.equal((await api(base, '/api/arrival/pass', { pass: eerste.body.pass.accessToken })).status, 401);
    const pas = tweede.body.pass.accessToken;
    const lees = await api(base, '/api/arrival/pass', { pass: pas });
    assert.equal(lees.status, 200);
    assert.equal(lees.tekst.includes(pas), false, 'lezen herhaalt de pass niet');
    assert.equal(lees.body.toegang.doel, 'arrival-pass');
    assert.equal(lees.body.toegang.max_gebruik, 60);

    const sup = await zaak(base, 'KIKUNOI');
    const lijst = await api(base, '/api/supplier/horeca/arrivals', {}, sup);
    assert.ok(lijst.body.arrivals.some(a => a.id === eerste.body.pass.id));
    assert.equal(/AR\.[0-9A-F]{32}|passHash|code_hash/.test(lijst.tekst), false, 'de zaak ziet geen pass en geen hash');

    const rot = await api(base, '/api/arrival/pass/roteer', { pass: pas });
    assert.equal(rot.status, 200);
    assert.match(rot.body.accessToken, /^AR\.[0-9A-F]{32}$/);
    assert.equal((await api(base, '/api/arrival/pulse', { pass: pas, pulse: 'onderweg' })).status, 401, 'de geroteerde werkt niet meer');
    assert.equal((await api(base, '/api/arrival/pulse', { pass: rot.body.accessToken, pulse: 'onderweg' })).status, 200);
    assert.equal((await api(base, '/api/arrival/pass/intrek', { pass: rot.body.accessToken })).status, 200);
    assert.equal((await api(base, '/api/arrival/pass', { pass: rot.body.accessToken })).status, 410, 'ingetrokken');
    assert.equal((await api(base, '/api/arrival/request', lijf)).status, 409, 'een gebruikte aanvraag roteert niet meer');
    assert.equal((await api(base, '/api/arrival/request', Object.assign({}, lijf, { requestToken: 'kort' }))).status, 400);
    /* geen generieke antwoordcache mag de pass herhalen, ook niet met een Idempotency-Key */
    const sleutel = { 'Idempotency-Key': 'arrival-e2e-' + Date.now() };
    const lijf5 = Object.assign({}, lijf, { requestToken: RT(5) });
    const k1 = await api(base, '/api/arrival/request', lijf5, null, sleutel);
    const k2 = await api(base, '/api/arrival/request', lijf5, null, sleutel);
    assert.equal(k1.status, 200); assert.equal(k2.status, 200);
    assert.equal(k2.tekst.includes(k1.body.pass.accessToken), false, 'de retrycache toont de pass geen tweede keer');
    const r1 = await api(base, '/api/arrival/pass/roteer', { pass: k2.body.pass.accessToken }, null, sleutel);
    const r2 = await api(base, '/api/arrival/pass/roteer', { pass: k2.body.pass.accessToken }, null, sleutel);
    assert.equal(r1.status, 200);
    assert.equal(r2.tekst.includes(r1.body.accessToken), false, 'een herhaalde rotatie heronthult niets');
    const ver = new Date(Date.now() + 70 * 86400000).toISOString().slice(0, 10);
    assert.equal((await api(base, '/api/arrival/request', Object.assign({}, lijf, { requestToken: RT(2), datum: ver }))).status, 400,
      'buiten de horizon komt er geen pass');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('9. echte server: weigert de zaak de reservering, dan is de pass dicht', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const v = await api(base, '/api/arrival/request', { requestToken: RT(3), supplierCode: 'KIKUNOI', datum: morgen(), tijd: '19:00', personen: 2 });
    assert.equal(v.status, 200, v.tekst.slice(0, 200));
    const pas = v.body.pass.accessToken;
    const sup = await zaak(base, 'KIKUNOI');
    const nee = await api(base, '/api/supplier/reservering/beslis', { id: v.body.pass.reserveringId, action: 'weiger' }, sup);
    assert.equal(nee.status, 200, nee.tekst.slice(0, 200));
    assert.equal((await api(base, '/api/arrival/pass', { pass: pas })).status, 410);
    assert.equal((await api(base, '/api/arrival/pulse', { pass: pas, pulse: 'in-de-buurt' })).status, 410);
    assert.equal((await api(base, '/api/arrival/pass/roteer', { pass: pas })).status, 410, 'en roteren helpt niet');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
