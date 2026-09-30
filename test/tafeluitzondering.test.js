/* Tussen ja en nee bij een tafelaanvraag (kern/ervaring/tafeluitzondering.js,
   CONCIERGE.md par. 2.7-2.9): een tegenvoorstel met een termijn, en doorzetten
   naar wie mag beslissen.

   De eerste toets draait tegen een echte server met een echte zaak uit de
   zaadgegevens; de tweede zet de klok, want een termijn van vijf minuten
   afwachten is een toets die iemand overslaat.

   Draai los: node --test test/tafeluitzondering.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tafeluitz-'));
const roep = async (pad, body, token) => {
  const r = await fetch(BASE + '/api' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) });
  let d = null; try { d = await r.json(); } catch (e) {}
  return { status: r.status, d };
};
test.before(async () => { ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } })); });
test.after(() => { if (child) try { child.kill('SIGKILL'); } catch (e) {} try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

test('een zaak biedt een andere tijd aan, zet een aanvraag door, en alleen een manager beslist daarna', async () => {
  const t = Date.now() + '';
  const lid = (await roep('/auth/register', { name: 'T ' + t, email: 't' + t + '@v.test', phone: '06' + t.slice(-8),
    password: 'geheim123', geboortedatum: '1980-05-05', tier: 'rtg' })).d.token;
  const ro = (await roep('/supplier/roster', { code: 'KIKUNOI' })).d.staff || [];
  const man = ro.find(x => x.role === 'manager');
  const mw = ro.find(x => x.role !== 'manager');
  assert.ok(man && mw, 'de zaadgegevens hebben een manager en een medewerker');
  const manTok = (await roep('/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).d.token;
  const mwTok = (await roep('/supplier/login', { code: 'KIKUNOI', staffId: mw.id, pin: '5678' })).d.token;
  assert.ok(manTok && mwTok);

  // 1. tegenvoorstel: 20:00 lukt niet, 21:15 wel, twaalf minuten vastgehouden
  const a = await roep('/reserveer', { supplierCode: 'KIKUNOI', datum: morgen(), tijd: '20:00', personen: 2 }, lid);
  assert.equal(a.status, 200, JSON.stringify(a.d));
  const rid = a.d.reservering.id;
  assert.equal((await roep('/supplier/reservering/tegenvoorstel', { id: rid, tijd: '20:00' }, mwTok)).status, 400, 'dezelfde tijd is geen tegenvoorstel');
  const tv = await roep('/supplier/reservering/tegenvoorstel', { id: rid, tijd: '21:15', geldigMin: 12 }, mwTok);
  assert.equal(tv.status, 200, JSON.stringify(tv.d));
  assert.equal(tv.d.reservering.status, 'tegenvoorstel');
  assert.equal(tv.d.reservering.gevraagdeTijd, '20:00');
  // dubbeltik: een tweede tegenvoorstel stuit op de stand, en de reservering beweegt niet
  const tv2 = await roep('/supplier/reservering/tegenvoorstel', { id: rid, tijd: '21:45', geldigMin: 12 }, mwTok);
  assert.equal(tv2.status, 409);
  const mijn = (await roep('/reserveringen/mijn', {}, lid)).d.reserveringen.find(x => x.id === rid);
  assert.equal(mijn.tijd, '21:15');
  assert.equal(mijn.tegenvoorstel.door, 'medewerker', 'wie het deed staat bij de zaak, niet als label naar de gast');
  const ja = await roep('/reservering/tegenvoorstel', { id: rid, akkoord: true }, lid);
  assert.equal(ja.d.reservering.status, 'bevestigd');
  // binnen het venster geeft de poort het eerste antwoord terug, daarna weigert de handler
  const nog = await roep('/reservering/tegenvoorstel', { id: rid, akkoord: true }, lid);
  assert.ok((nog.status === 200 && nog.d.herhaald === true) || nog.status === 409, 'er ligt geen tweede tegenvoorstel: ' + nog.status);

  // 2. doorzetten: vanaf dan beslist alleen een manager
  const b = await roep('/reserveer', { supplierCode: 'KIKUNOI', datum: morgen(), tijd: '19:00', personen: 2 }, lid);
  const rid2 = b.d.reservering.id;
  assert.equal((await roep('/supplier/reservering/doorzetten', { id: rid2 }, mwTok)).status, 400, 'doorzetten vraagt een reden');
  const dz1 = await roep('/supplier/reservering/doorzetten', { id: rid2, reden: 'jubileum, graag een uitzondering' }, mwTok);
  assert.equal(dz1.status, 200);
  // dubbeltik: nog eens doorzetten verandert niets -- hetzelfde moment, dezelfde reden
  const dz2 = await roep('/supplier/reservering/doorzetten', { id: rid2, reden: 'nog een keer' }, mwTok);
  assert.deepEqual(dz2.d.reservering.doorgezet, dz1.d.reservering.doorgezet);
  assert.equal((await roep('/supplier/reservering/beslis', { id: rid2, action: 'bevestig' }, mwTok)).status, 403);
  assert.equal((await roep('/supplier/reservering/tegenvoorstel', { id: rid2, tijd: '22:00' }, mwTok)).status, 403);
  assert.equal((await roep('/supplier/reservering/beslis', { id: rid2, action: 'weiger' }, manTok)).status, 200, 'een nee blijft een nee');
  const na = (await roep('/reserveringen/mijn', {}, lid)).d.reserveringen.find(x => x.id === rid2);
  assert.equal(na.status, 'geweigerd');
  assert.equal(na.doorgezet.reden, 'jubileum, graag een uitzondering');
  assert.equal((await roep('/reservering/tegenvoorstel', { id: rid2, akkoord: true }, null)).status, 401);
});

test('een verlopen tegenvoorstel wordt niet aangenomen en telt niet meer mee in de capaciteit (CON-09)', () => {
  const echt = Date.now;
  let t = Date.parse('2026-10-01T18:00:00Z');
  Date.now = () => t;
  try {
    const db = { data: { reserveringen: [] } };
    const zaak = { code: 'Z', name: 'Zaak', tables: [{ seats: 2 }] };
    const stil = () => {};
    const u = require('../server/kern/ervaring/tafeluitzondering')({ reserveringen: () => db.data.reserveringen, save: stil, notify: stil, notifySupplier: stil,
      sseToCustomer: stil, sseToSupplier: stil, nu: () => new Date(Date.now()).toISOString() });
    const cap = require('../server/kern/reservering/capaciteit');
    db.data.reserveringen.push({ id: 'r1', supplierCode: 'Z', customerKey: 'k', datum: '2026-10-02', tijd: '20:00', personen: 2, status: 'aangevraagd' });
    assert.equal(u.tegenvoorstel(zaak, { manager: false }, 'r1', { tijd: '21:00', geldigMin: 5 }).ok, true);
    assert.equal(cap.past(zaak, db.data.reserveringen, '2026-10-02', '21:00', 2), false, 'vastgehouden: 21:00 is vol');
    assert.equal(cap.past(zaak, db.data.reserveringen, '2026-10-02', '20:00', 2), true, 'en de gevraagde tijd is weer vrij');
    t += 6 * 60000;
    assert.equal(cap.past(zaak, db.data.reserveringen, '2026-10-02', '21:00', 2), true, 'verlopen: de plek is weer vrij, zonder opruimtaak');
    const r = u.tegenvoorstelAntwoord('k', 'r1', true);
    assert.equal(r.status, 409);
    assert.equal(db.data.reserveringen[0].status, 'tegenvoorstel', 'de gast drukt ja, maar er is niets meer om ja op te zeggen');
  } finally { Date.now = echt; }
});
