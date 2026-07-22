/* Het werkvenster: de werkgever bepaalt wanneer personeel op de werkpagina en
   de PDA mag. Getoetst op beide lagen: de kernlogica (vensters, middernacht,
   manager/vrijstelling, Rahuls advies) met een vaste klok, en de echte
   ingangen (personeelslogin met PIN en het starten via het ene RTG-account)
   die buiten het venster geen sessie meer geven. Rahul adviseert alleen.
   Draai los: node --experimental-sqlite --test test/werkvenster.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

/* ---------- de kernlogica, met een vaste klok ---------- */
function verseKern(klok) {
  const db = { data: { agendas: {}, live: {} } };
  const { maakWerkvenster } = require('../server/kern/werkvenster');
  const kern = maakWerkvenster({ db, save: () => {}, klokVan: klok || (() => ({ vandaagUren: 0, weekUren: 0 })), zorgVan: () => null });
  return { db, kern };
}
const wo12 = new Date('2026-07-22T12:00:00'); // woensdag 12:00 (lokale tijd)
const wo18 = new Date('2026-07-22T18:30:00');
const wo23 = new Date('2026-07-22T23:00:00');
const do03 = new Date('2026-07-23T03:00:00');

test('1. kern: venster per dag, middernacht, manager en vrijstelling', () => {
  const { kern } = verseKern();
  const s = { settings: {} };
  kern.zetWerkvenster(s, { aan: true, dagen: { 3: { van: '08:00', tot: '17:00' } } }); // woensdag
  const staf = { staffId: 7, manager: false };
  assert.equal(kern.magWerken(s, staf, wo12).ok, true, 'binnen het venster mag het');
  const buiten = kern.magWerken(s, staf, wo18);
  assert.equal(buiten.ok, false, 'buiten het venster niet');
  assert.match(buiten.error, /08:00 tot 17:00/, 'de weigering noemt het venster');
  assert.equal(kern.magWerken(s, { staffId: 1, manager: true }, wo18).ok, true, 'de manager valt er nooit onder');
  kern.zetWerkvenster(s, { vrijgesteld: [7] });
  assert.equal(kern.magWerken(s, staf, wo18).ok, true, 'vrijgesteld personeel mag altijd');
  kern.zetWerkvenster(s, { vrijgesteld: [] });
  // over middernacht heen (18:00-02:00): laat op de avond wel, om 03:00 niet
  kern.zetWerkvenster(s, { dagen: { 3: { van: '18:00', tot: '02:00' } } });
  assert.equal(kern.magWerken(s, staf, wo23).ok, true, 'avondvenster over middernacht: 23:00 mag');
  assert.equal(kern.magWerken(s, staf, wo12).ok, false, 'overdag valt buiten het avondvenster');
  // donderdag 03:00 valt onder het donderdag-slot (geen slot = open)
  assert.equal(kern.magWerken(s, staf, do03).ok, true, 'een dag zonder slot is open');
  // de dag dicht en de hoofdschakelaar uit
  kern.zetWerkvenster(s, { dagen: { 3: { dicht: true } } });
  assert.equal(kern.magWerken(s, staf, wo12).ok, false, 'een dichte dag is dicht');
  kern.zetWerkvenster(s, { aan: false });
  assert.equal(kern.magWerken(s, staf, wo12).ok, true, 'hoofdschakelaar uit = geen venster');
});

test('2. kern: Rahul adviseert bij veel uren en een lege agenda, en zwijgt anders', () => {
  const { db, kern } = verseKern(() => ({ vandaagUren: 11.5, weekUren: 52 }));
  const dag = wo12.toISOString().slice(0, 10);
  db.data.agendas['lid:testlid'] = [{ datum: dag, gedaan: true, titel: 'was al klaar' }];
  const advies = kern.werkAdvies({ code: 'X', staffId: 7, lidKey: 'testlid', d: wo12 });
  assert.ok(advies && /advies/.test(advies.tekst), 'veel uren + lege agenda = een advies (geen blokkade)');
  assert.match(advies.tekst, /11\.5 uur/, 'het advies noemt de geklokte uren');
  // niets aan de hand: geen gepush
  const { kern: rustig } = verseKern(() => ({ vandaagUren: 3, weekUren: 20 }));
  assert.equal(rustig.werkAdvies({ code: 'X', staffId: 7, lidKey: 'testlid', d: wo12 }), null, 'zonder reden zwijgt Rahul');
});

/* ---------- de echte ingangen ---------- */
async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json() };
}
async function rooster(base, code) { return (await api(base, '/api/supplier/roster', { code })).body.staff; }

test('3. ingangen: buiten het venster geen personeelssessie; de manager en het ene account volgen dezelfde regel', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wv-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const staf = await rooster(base, 'KIKUNOI');
    const mgr = staf.find(x => x.role === 'manager');
    const lidStaf = staf.find(x => x.role !== 'manager');
    const mtok = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;

    // het ene RTG-account: eerst koppelen (bewijs met de eigen PIN), voor straks
    const u = Date.now().toString(36);
    const lid = (await api(base, '/api/auth/register', { name: 'Venster Lid', email: u + '@x.nl', phone: '0611111111', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
    const kop = await api(base, '/api/account/koppel', { soort: 'personeel', code: 'KIKUNOI', staffId: lidStaf.id, pin: '5678' }, lid);
    assert.equal(kop.status, 200, 'de personeelsrol hangt aan het ene account');

    // de werkgever sluit vandaag de werkomgeving
    const vandaag = new Date().getDay();
    const zet = await api(base, '/api/supplier/werkvenster', { dagen: { [vandaag]: { dicht: true } }, aan: true }, mtok);
    assert.equal(zet.status, 200);
    assert.equal(zet.body.werkvenster.aan, true);

    // personeelslogin met PIN: dicht
    const dicht = await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: lidStaf.id, pin: '5678' });
    assert.equal(dicht.status, 403, 'buiten het venster geen sessie');
    assert.match(dicht.body.error, /gesloten/, 'de weigering legt het uit');
    // en het ene account is geen achterdeur: zelfde regel, zelfde weigering
    const acc = await api(base, '/api/account/start', { rol: 'personeel', code: 'KIKUNOI', staffId: lidStaf.id }, lid);
    assert.equal(acc.status, 403, 'ook via het ene RTG-account geen sessie buiten het venster');
    // de manager mag er wel in (die beheert de zaak)
    const mgr2 = await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' });
    assert.equal(mgr2.status, 200, 'de manager valt niet onder het venster');

    // de manager zet de hoofdschakelaar weer uit
    const w = await api(base, '/api/supplier/werkvenster', { aan: false }, mtok);
    assert.equal(w.status, 200);
    // venster weer open: personeel kan er weer in, en Rahuls advies-endpoint praat mee
    const open = await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: lidStaf.id, pin: '5678' });
    assert.equal(open.status, 200, 'venster uit = personeel weer welkom');
    const adv = await api(base, '/api/supplier/werkadvies', {}, open.body.token);
    assert.equal(adv.status, 200);
    assert.ok('advies' in adv.body, 'het advies-veld bestaat (null of een zin, nooit een blokkade)');
    // en de niet-manager mag het venster niet zetten
    const nee = await api(base, '/api/supplier/werkvenster', { aan: true }, open.body.token);
    assert.equal(nee.status, 403, 'alleen de manager stelt het werkvenster in');
  } finally {
    await stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
