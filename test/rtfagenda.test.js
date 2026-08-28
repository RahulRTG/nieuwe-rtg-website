/* De RTF-gezinsagenda op RTG-niveau: herhalingen met DEZELFDE keerN-regel
   als de ledenagenda (de 31e klemt en keert terug), verzetten zonder
   verdubbelen, en het bereik met naam en kleur per gezinslid.
   Draai los: node --test test/rtfagenda.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, sess, kindId;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfagenda-'));

function post(p, b) {
  return fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(b || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const g = await post('/api/foundation/gezin/maak', { gezinsnaam: 'Agendagezin', naam: 'Mam', pin: '1234' });
  const kind = await post('/api/foundation/gezin/profiel/maak', { code: g.body.code, token: g.body.token,
    naam: 'Noor', rol: 'kind', groep: 'kind', kleur: '#3A7BD5' });
  kindId = kind.body.profiel.id;
  sess = { code: g.body.code, token: g.body.token };
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een maandpunt op de 31e klemt in september en keert in oktober terug', async () => {
  const r = await post('/api/foundation/gezin/agenda', Object.assign({}, sess, {
    titel: 'Zakgeld overmaken', datum: '2026-08-31', herhaal: 'maand', herhaalTot: '2026-10-31' }));
  assert.equal(r.status, 200);
  const b = await post('/api/foundation/gezin/agenda/bereik', Object.assign({}, sess, {
    van: '2026-08-01', tot: '2026-11-30' }));
  const datums = b.body.items.filter(i => i.titel === 'Zakgeld overmaken').map(i => i.datum);
  assert.deepEqual(datums, ['2026-08-31', '2026-09-30', '2026-10-31'],
    'dezelfde klemregel als de ledenagenda: 30 september, en in oktober gewoon weer de 31e');
  assert.equal(b.body.magBewerken, true);
});

test('2. verzetten is verzetten, en het gezinslid kleurt mee in het bereik', async () => {
  const r = await post('/api/foundation/gezin/agenda', Object.assign({}, sess, {
    titel: 'Zwemles', datum: '2026-09-05', tijd: '16:00', wie: kindId }));
  assert.equal(r.status, 200);
  await post('/api/foundation/gezin/agenda/wijzig', Object.assign({}, sess, {
    itemId: r.body.item.id, datum: '2026-09-06', tijd: '10:00' }));
  const b = await post('/api/foundation/gezin/agenda/bereik', Object.assign({}, sess, {
    van: '2026-09-01', tot: '2026-09-30' }));
  const les = b.body.items.filter(i => i.titel === 'Zwemles');
  assert.equal(les.length, 1, 'verzetten is verzetten, niet verdubbelen');
  assert.equal(les[0].datum, '2026-09-06');
  assert.equal(les[0].tijd, '10:00');
  assert.equal(les[0].wieNaam, 'Noor');
  assert.equal(les[0].wieKleur, '#3A7BD5', 'de kleur van het gezinslid reist mee voor het raster');
  assert.ok(b.body.profielen.find(p => p.naam === 'Noor'), 'de profielenlijst voedt de wie-kiezer');
});

test('3. een verjaardag is gewoon een jaarpunt: volgend jaar staat hij er vanzelf', async () => {
  const r = await post('/api/foundation/gezin/agenda', Object.assign({}, sess, {
    titel: 'Noor jarig', datum: '2026-03-15', herhaal: 'jaar' }));
  assert.equal(r.status, 200);
  const b = await post('/api/foundation/gezin/agenda/bereik', Object.assign({}, sess, {
    van: '2027-03-01', tot: '2027-03-31' }));
  assert.ok(b.body.items.find(i => i.titel === 'Noor jarig' && i.datum === '2027-03-15'),
    'de verjaardag rolt jaar na jaar mee, zonder dat iemand hem opnieuw hoeft te zetten');
});
