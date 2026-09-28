/* HET BOEK VAN RTG -- server/kern/rtgboek.js en server/kern/bedrijfsmaat/stand-rtgboek.js
   (besluiten C8 tot en met C11).

   DEEL A, DE KERN:
   1. een bedrag heeft een bron, een mens op naam en een post uit de gesloten lijst;
      'vriend' heeft geen marketingpost;
   2. een deel is pas compleet als elke post er is (ook met nul), en dezelfde invoer
      nog eens laat de vorige stand staan;
   3. het ledentegoed telt alleen positieve lid-rekeningen.
   DEEL B, DE VIER MATEN:
   4. de operationele marge rekent pas als het boek en de nota's compleet zijn;
   5. liquiditeit trekt het ledentegoed NIET af (C10);
   6. runway bruto en netto naast elkaar, en geen netto verbruik is geen getal (C9);
   7. CAC per kanaal, onder de groepsgrens geen getal (C11).
   DEEL C, DE ROUTES tegen een echte server:
   8. lezen en vullen op naam; de gedeelde kantoorcode vult niets, en zonder inlog 401.

   Draai: node --test test/rtgboek.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const nieuwBoek = () => require('../server/kern/rtgboek')({ db: { data: {} }, save: () => {}, nu: () => '2026-09-15T10:00:00Z',
  kanalen: ['vriend', 'werkgever', 'campagne', 'zoeken', 'sociaal', 'anders'] });
const vulDeel = (k, maand, deel, bedragen) => { for (const [post, centen] of Object.entries(bedragen))
  assert.equal(k.rtgBoekZet({ maand, deel, post, centen, bron: 'opgave ' + post, wie: 'financien' }).ok, true); };

test('1. een bedrag heeft een bron, een naam en een post uit de lijst', () => {
  const k = nieuwBoek();
  const zet = (o) => k.rtgBoekZet(Object.assign({ maand: '2026-09', deel: 'vast', post: 'huisvesting', centen: 100, bron: 'huurfactuur', wie: 'financien' }, o));
  assert.equal(zet({ bron: '' }).status, 400);
  assert.equal(zet({ wie: null }).status, 403, 'niet op de gedeelde code');
  assert.equal(zet({ post: 'jan' }).status, 400, 'geen post per medewerker');
  assert.equal(zet({ centen: -1 }).status, 400);
  assert.equal(zet({ deel: 'marketing', post: 'vriend' }).status, 400, 'een vriend kost geen advertentie');
  assert.equal(zet({}).ok, true);
});

test('2. compleet pas met elke post, en dezelfde invoer wist de vorige stand niet', () => {
  const k = nieuwBoek();
  vulDeel(k, '2026-09', 'vast', { personeel: 500000, huisvesting: 200000, diensten: 50000 });
  let b = k.rtgBoek('2026-09');
  assert.equal(b.vast.totaalCenten, null, 'een half boek heeft geen totaal');
  assert.deepEqual(b.vast.ontbreekt, ['overig']);
  vulDeel(k, '2026-09', 'vast', { overig: 0 });
  b = k.rtgBoek('2026-09');
  assert.equal(b.vast.totaalCenten, 750000);
  k.rtgBoekZet({ maand: '2026-09', deel: 'vast', post: 'overig', centen: 1000, bron: 'correctie', wie: 'financien' });
  const w = k.rtgBoekZet({ maand: '2026-09', deel: 'vast', post: 'overig', centen: 1000, bron: 'correctie', wie: 'financien' });
  assert.equal(w.ongewijzigd, true);
  assert.equal(k.rtgBoek('2026-09').vast.posten.find(p => p.post === 'overig').vorige.centen, 0, 'de echte vorige stand blijft');
  assert.equal(k.rtgBoek('2026-08').graad, 'onbekend');
});

test('3. het ledentegoed telt alleen positieve lid-rekeningen', () => {
  const saldi = () => ({ 'lid:Amberen': 1500, 'lid:Beuk': 0, 'lid:Ceder': -20, 'partner:X': 9000, 'extern:bank': -10480 });
  const kijk = require('../server/kern/pay/kijken')({ saldi, grootboek: () => [], keyVanCodenaam: () => null, sseToCustomer: () => {}, schaduw: { aan: false } });
  assert.deepEqual(kijk.ledentegoed(), { centen: 1500, rekeningen: 1 });
});

/* ---------------- DEEL B: de vier maten ---------------- */
function wereld({ boekVol = true, notas = true, ontvangen = 1000000, bank = 3000000, kanaalAantal = 12, lt = 40000 } = {}) {
  const k = nieuwBoek();
  for (const m of ['2026-06', '2026-07', '2026-08']) if (boekVol) {
    vulDeel(k, m, 'vast', { personeel: 400000, huisvesting: 100000, diensten: 50000, overig: 0 });
    vulDeel(k, m, 'marketing', { werkgever: 0, campagne: 120000, zoeken: 0, sociaal: 30000, anders: 0 });
    vulDeel(k, m, 'kort', { crediteuren: 200000, belasting: 150000, loon: 0, overig: 0 });
  }
  const maat = (id, def, uitkomst, dektNiet) => Object.assign({ id, dektNiet }, uitkomst);
  return require('../server/kern/bedrijfsmaat/stand-rtgboek')({
    m: '2026-08', peilmoment: '2026-09-15T10:00:00Z', maat, boek: k.rtgBoek,
    bank: () => ({ vrij: { centen: bank } }),
    cijfers: () => ({ ontvangen, bruto: { margeCenten: ontvangen - 80000, kostenCenten: 80000, waarom: null } }),
    notas: () => (notas ? [{ soort: 'stroom', centen: 10000 }, { soort: 'hosting', centen: 30000 }] : []),
    kanalen: () => ({ kanalen: [{ naam: 'campagne', stand: kanaalAantal >= 10 ? 'TOONBAAR' : 'TE_KLEINE_GROEP', aantal: kanaalAantal >= 10 ? kanaalAantal : null },
      { naam: 'sociaal', stand: 'TE_KLEINE_GROEP', aantal: null }] }),
    ledentegoed: () => ({ centen: lt, rekeningen: 3 }) });
}
const van = (maten, id) => maten.find(x => x.id === id);

test('4. de operationele marge rekent pas als boek en nota\'s compleet zijn', () => {
  const op = van(wereld(), 'marge.operationeel-rtg');
  assert.equal(op.stand, 'TOONBAAR');
  assert.equal(op.waarde, 1000000 - (80000 + 10000 + 30000) - 550000);
  assert.equal(op.graad, 'vermoed');
  assert.equal(van(wereld({ notas: false }), 'marge.operationeel-rtg').stand, 'NIET_UIT_TE_REKENEN');
  assert.equal(van(wereld({ boekVol: false }), 'marge.operationeel-rtg').waarde, null, 'een leeg boek is geen nul');
});

test('5. liquiditeit trekt het ledentegoed niet af (C10)', () => {
  const l = van(wereld(), 'liquiditeit.rtg');
  assert.equal(l.waarde, 3000000 - 350000);
  assert.deepEqual(l.ledentegoed, { centen: 40000, peilmoment: '2026-09-15T10:00:00Z', afgetrokken: false });
});

test('6. runway bruto en netto naast elkaar, en geen netto verbruik is geen getal (C9)', () => {
  const r = van(wereld(), 'runway.rtg');
  const bruto = 550000 + 150000 + 120000;
  assert.equal(r.bruto.verbruikCenten, bruto);
  assert.equal(r.bruto.waarde, Math.round((3000000 / bruto) * 10) / 10);
  assert.equal(r.netto.waarde, null, 'de omzet dekt de uitgaven');
  assert.match(r.netto.waarom, /Geen netto verbruik/);
  const krap = van(wereld({ ontvangen: 500000 }), 'runway.rtg');
  assert.equal(krap.netto.waarde, Math.round((3000000 / (bruto - 500000)) * 10) / 10);
  assert.deepEqual(krap.maanden, ['2026-06', '2026-07', '2026-08']);
  assert.equal(van(wereld({ boekVol: false }), 'runway.rtg').stand, 'NIET_UIT_TE_REKENEN');
});

test('7. CAC per kanaal, onder de groepsgrens geen getal (C11)', () => {
  const pk = van(wereld(), 'cac.per-kanaal').perKanaal;
  assert.equal(pk.find(x => x.kanaal === 'campagne').waarde, 10000);
  assert.equal(pk.find(x => x.kanaal === 'sociaal').stand, 'TE_KLEINE_GROEP');
  assert.equal(pk.find(x => x.kanaal === 'vriend'), undefined);
  assert.equal(van(wereld({ kanaalAantal: 9 }), 'cac.per-kanaal').perKanaal.find(x => x.kanaal === 'campagne').waarde, null);
});

/* ---------------- DEEL C: de routes ---------------- */
let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtgboek-'));
async function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
test.after(() => { if (srv) stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ } });

test('8. lezen en vullen op naam; de gedeelde code vult niets', async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  assert.equal((await api('/api/office/rtgboek', {})).status, 401);
  const gedeeld = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  const mens = await kantoorAlsPersoon(base, 'RTG-OFFICE');
  assert.ok(gedeeld && mens);
  const zet = { maand: '2026-09', deel: 'kort', post: 'belasting', centen: 12345, bron: 'aanslag btw Q3' };
  assert.equal((await api('/api/office/rtgboek/zet', zet, gedeeld)).status, 403);
  const r = await api('/api/office/rtgboek/zet', zet, mens);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const l = await api('/api/office/rtgboek', { maand: '2026-09' }, gedeeld);
  assert.equal(l.status, 200);
  assert.equal(l.body.boek.kort.posten.find(p => p.post === 'belasting').centen, 12345);
  assert.ok(l.body.boek.kort.posten.find(p => p.post === 'belasting').gezetDoor, 'op naam');
  assert.deepEqual(l.body.delen.vast, ['personeel', 'huisvesting', 'diensten', 'overig']);
});
