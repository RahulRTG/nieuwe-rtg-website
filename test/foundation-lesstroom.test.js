/* B25: de lessleutel verlaat de URL (RELEASEKANDIDAAT.md; deur
   foundation.onderwijs_les_tokens). Tegen een ECHTE server:
   - een ?token= wordt overal geweigerd, met een reden, voordat er iets wordt
     opgezocht -- ook met een geldige sleutel, zodat er geen terugweg is;
   - de kop Authorization: Bearer (en het lijf) werkt;
   - de live-stroom opent alleen met een stroomticket: eenmalig, kortlevend,
     gebonden aan les en rol, en het opent niets meer na intrekken of sluiten.
   De module zelf (verval met een nagemaakte klok) staat onderaan.

   Draai los: node --test test/foundation-lesstroom.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-lesstroom-'));
let srv, BASE;
test.before(async () => {
  srv = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' });
  BASE = srv.base;
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

const post = async (pad, body, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(BASE + (pad.startsWith('/api/') ? pad : '/api/foundation' + pad), { method: 'POST', headers, body: JSON.stringify(body || {}) });
  let data = null; try { data = await r.json(); } catch (e) {}
  return { status: r.status, data, cache: r.headers.get('cache-control') };
};
const lees = async (pad, token) => {
  const r = await fetch(BASE + '/api/foundation' + pad, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
  let data = null; try { data = await r.json(); } catch (e) {}
  return { status: r.status, data };
};
const ticket = async (lesId, token) => post('/les/stroomticket', { code: lesId }, token);
/* Open de stroom en lees het eerste stuk; geeft status en een sluiter terug. */
async function stroom(lesId, query) {
  const ac = new AbortController();
  const r = await fetch(BASE + '/api/foundation/les/' + lesId + '/stream?' + query, { signal: ac.signal });
  if (r.status === 200) await r.body.getReader().read();
  else await r.text().catch(() => '');
  return { status: r.status, type: r.headers.get('content-type'), sluit: () => ac.abort(), r };
}
async function klas(vak) {
  const d = (await post('/les/maak', { vak, naam: 'Juf' })).data;
  const sam = (await post('/les/join', { lescode: d.lescode, naam: 'Sam' })).data;
  return { d, sam };
}

test('een sleutel in het adres wordt overal geweigerd, ook als hij klopt', async () => {
  const { d, sam } = await klas('Adres');
  for (const pad of ['/les/' + d.lesId, '/bord/' + d.lesId, '/opgaven/' + d.lesId, '/schrift/' + d.lesId,
    '/schrift/' + d.lesId + '/' + sam.studentId]) {
    const tok = pad.startsWith('/schrift/' + d.lesId) && !pad.endsWith(sam.studentId) ? sam.token : d.token;
    const r = await lees(pad + '?token=' + encodeURIComponent(tok));
    assert.equal(r.status, 400, pad + ' weigert de sleutel in de query');
    assert.equal(r.data.reden, 'sleutel-in-adres', pad + ' zegt waarom');
    assert.match(r.data.hoe, /Authorization/, pad + ' zegt hoe het wel moet');
    /* Ook de combinatie: een geldige kop plus een ?token= gaat niet door. */
    assert.equal((await fetch(BASE + '/api/foundation' + pad + '?token=x',
      { headers: { Authorization: 'Bearer ' + tok } })).status, 400, pad + ' ook naast een geldige kop');
  }
  const p = await fetch(BASE + '/api/foundation/bord/wis?token=' + d.token, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: d.lesId }) });
  assert.equal(p.status, 400, 'ook een POST met de sleutel in de query');
  const s = await stroom(d.lesId, 'role=docent&token=' + d.token);
  assert.equal(s.status, 400, 'en de oude vorm van de live-stroom');
});

test('de kop en het lijf werken', async () => {
  const { d, sam } = await klas('Kop');
  assert.equal((await lees('/les/' + d.lesId, d.token)).status, 200);
  assert.equal((await lees('/opgaven/' + d.lesId, d.token)).status, 200);
  assert.equal((await lees('/schrift/' + d.lesId, sam.token)).status, 200);
  assert.equal((await lees('/schrift/' + d.lesId + '/' + sam.studentId, d.token)).status, 200);
  assert.equal((await post('/api/foundation/opgave', { code: d.lesId, tekst: 'Som 1' }, d.token)).status, 200, 'POST met de kop');
  assert.equal((await post('/agenda', { code: d.lesId, token: d.token, tekst: 'Toets' })).status, 200, 'POST met het lijf');
  assert.equal((await lees('/les/' + d.lesId)).status, 403, 'zonder sleutel niets');
});

test('het stroomticket: eenmalig, aan les en rol gebonden, met een eigen antwoord', async () => {
  const { d, sam } = await klas('Ticket');
  const t = await ticket(d.lesId, sam.token);
  assert.equal(t.status, 200);
  assert.match(t.data.ticket, /^LESST\.[0-9A-F]{32}$/, '128 bits uit kern/bearercode.js');
  assert.equal(t.data.rol, 'leerling');
  assert.equal(t.cache, 'no-store');
  const t2 = await ticket(d.lesId, sam.token);
  assert.notEqual(t2.data.ticket, t.data.ticket, 'een herhaling krijgt een vers ticket en nooit het vorige');

  const een = await stroom(d.lesId, 'ticket=' + encodeURIComponent(t.data.ticket));
  assert.equal(een.status, 200, 'het ticket opent de stroom');
  assert.match(een.type, /text\/event-stream/);
  een.sluit();
  assert.equal((await stroom(d.lesId, 'ticket=' + encodeURIComponent(t.data.ticket))).status, 403, 'maar een keer');

  /* Rol: een leerlingticket opent nooit de docentstroom. */
  assert.equal((await stroom(d.lesId, 'role=docent&ticket=' + encodeURIComponent(t2.data.ticket))).status, 403,
    'een leerling die zich voor docent uitgeeft');
  assert.equal((await stroom(d.lesId, 'ticket=' + encodeURIComponent(t2.data.ticket))).status, 403,
    'en ook die mislukte poging heeft het ticket opgebruikt');

  /* Les: een ticket van les A staat niet in les B. */
  const ander = await klas('Ander');
  const tA = await ticket(d.lesId, d.token);
  assert.equal(tA.data.rol, 'leraar');
  assert.equal((await stroom(ander.d.lesId, 'ticket=' + encodeURIComponent(tA.data.ticket))).status, 403,
    'een ticket van een andere les opent niets');
  assert.equal((await ticket(ander.d.lesId, d.token)).status, 403, 'een sleutel van een andere les krijgt geen ticket');
  assert.equal((await ticket(d.lesId)).status, 403, 'zonder sleutel geen ticket');
  assert.equal((await stroom(d.lesId, 'ticket=LESST.' + '0'.repeat(32))).status, 403, 'een verzonnen ticket');
  assert.equal((await stroom(d.lesId, '')).status, 403, 'geen ticket');
  assert.equal((await stroom('LSONBEKEND', 'ticket=' + encodeURIComponent(tA.data.ticket))).status, 404);
  const doc = await stroom(d.lesId, 'role=docent&ticket=' + encodeURIComponent((await ticket(d.lesId, d.token)).data.ticket));
  assert.equal(doc.status, 200, 'de begeleider komt binnen met zijn eigen ticket');
  doc.sluit();
});

test('intrekken en sluiten: een al uitgegeven ticket opent daarna niets', async () => {
  const { d, sam } = await klas('Intrek');
  const voor = await ticket(d.lesId, sam.token);
  assert.equal((await post('/les/leerling/intrekken', { code: d.lesId, studentId: sam.studentId }, d.token)).status, 200);
  assert.equal((await stroom(d.lesId, 'ticket=' + encodeURIComponent(voor.data.ticket))).status, 403,
    'het ticket van voor de intrekking opent niets');
  assert.equal((await ticket(d.lesId, sam.token)).status, 403, 'en er komt geen nieuw');
  const leraar = await ticket(d.lesId, d.token);
  assert.equal((await post('/les/sluit', { code: d.lesId }, d.token)).status, 200);
  assert.equal((await stroom(d.lesId, 'ticket=' + encodeURIComponent(leraar.data.ticket))).status, 403,
    'een gesloten les opent ook met een vers leraarsticket niets');
});

test('de module: een verlopen ticket opent niets, en het claimen gebeurt een keer', async () => {
  let klok = Date.parse('2026-10-04T08:00:00Z');
  const nu = () => new Date(klok).toISOString();
  const lessen = {};
  const db = { data: {} };
  const t = require('../server/foundation/onderwijs/toegang')({ db, crypto,
    bewerkCollectie: (naam, werk) => werk(lessen), productie: false, nu });
  const les = await t.nieuweLes({});
  const mee = await t.claim(les.lescode);
  const g = await t.stroomticket(les.lesId, mee.token);
  assert.equal(g.ok, true);
  assert.ok(!JSON.stringify(lessen).includes(g.ticket), 'op schijf alleen de hash');
  klok += 31000;
  assert.equal((await t.claimStroom(les.lesId, g.ticket)).status, 403, 'na dertig seconden verlopen');
  assert.equal(lessen[les.lesId].stroomtickets.length, 0, 'en weggehaald');
  const h = await t.stroomticket(les.lesId, mee.token);
  const [a, b] = await Promise.all([t.claimStroom(les.lesId, h.ticket), t.claimStroom(les.lesId, h.ticket)]);
  assert.equal([a, b].filter(x => x.ok).length, 1, 'twee gelijktijdige claims: precies een opent');
  assert.equal(a.studentId, mee.studentId);
  /* Uitgifte toetst de sleutel opnieuw BINNEN de transactie (de deur ervoor,
     lesVan, las een oudere stand): na intrekken geen ticket meer. */
  assert.ok((await t.intrekLeerling(les.lesId, les.token, mee.studentId)).ok);
  assert.equal((await t.stroomticket(les.lesId, mee.token)).status, 403, 'een ingetrokken leerling krijgt geen ticket');
  assert.equal((await t.stroomticket(les.lesId, 'LESLL.' + 'F'.repeat(32))).status, 403, 'een verzonnen sleutel ook niet');
});
