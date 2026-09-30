/* DE CAMPAGNES VAN RTG -- server/kern/rtgcampagne.js, de campagnepost in
   server/kern/rtgboek.js en de maat in server/kern/bedrijfsmaat/stand-rtgboek.js
   (besluit C12).

   1. een campagne is een code onder precies een kanaal: vriend heeft er geen, een
      code wordt niet hergebruikt, en dezelfde aanvraag nog eens verandert niets;
   2. een geregistreerde code telt onder HAAR kanaal, een onbekende blijft
      'campagne' -- en er komt geen lid in de telling;
   3. de uitgave per campagne is een deel van de kanaalpost: meer dan het kanaal
      is een tegenspraak, en een campagne die niet liep kan niets kosten;
   4. de maat: per campagne uitgave gedeeld door nieuwe leden met haar code,
      onder de groepsgrens geen getal, en bij tegenspraak geen getal;
   5. de routes tegen een echte server: lezen met de gedeelde code, schrijven
      alleen op naam, en de uitgave landt in het boek.

   Draai: node --test test/rtgcampagne.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const KANALEN = ['vriend', 'werkgever', 'campagne', 'zoeken', 'sociaal', 'anders'];
function wereld(nu = '2026-10-15T10:00:00Z') {
  const db = { data: {} };
  const reg = require('../server/kern/rtgcampagne')({ db, save: () => {}, nu: () => nu, kanalen: () => KANALEN });
  const tel = require('../server/kern/aanmeldkanaal')({ db, save: () => {}, nu: () => nu,
    campagneKanaal: (c) => { const x = reg.rtgCampagneVan(c); return x ? x.kanaal : null; } });
  const boek = require('../server/kern/rtgboek')({ db, save: () => {}, nu: () => nu, kanalen: KANALEN, campagnes: reg.rtgCampagnesInMaand });
  return { db, reg, tel, boek };
}
const herfst = { code: 'herfst-26', naam: 'Herfst 2026', kanaal: 'sociaal', van: '2026-10-01', tot: '2026-11-30', wie: 'financien' };

test('1. een campagne is een code onder precies een kanaal', () => {
  const { reg } = wereld();
  assert.equal(reg.rtgCampagneMaak(Object.assign({}, herfst, { kanaal: 'vriend' })).status, 400, 'een vriend is geen campagne');
  assert.equal(reg.rtgCampagneMaak(Object.assign({}, herfst, { kanaal: 'tv' })).status, 400);
  assert.equal(reg.rtgCampagneMaak(Object.assign({}, herfst, { tot: '2026-09-01' })).status, 400, 'einde voor begin');
  assert.equal(reg.rtgCampagneMaak(Object.assign({}, herfst, { wie: null })).status, 403, 'niet op de gedeelde code');
  assert.equal(reg.rtgCampagneMaak(herfst).ok, true);
  assert.equal(reg.rtgCampagneMaak(herfst).ongewijzigd, true, 'dezelfde aanvraag verandert niets');
  assert.equal(reg.rtgCampagneMaak(Object.assign({}, herfst, { kanaal: 'zoeken' })).status, 409, 'een code wordt niet hergebruikt');
  assert.equal(reg.rtgCampagnes().length, 1);
});

test('2. een geregistreerde code telt onder haar kanaal, een onbekende onder campagne', () => {
  const { reg, tel, db } = wereld();
  reg.rtgCampagneMaak(herfst);
  assert.equal(tel.aanmeldkanaalTel({ campagne: 'herfst-26' }).geteld, true);
  assert.equal(tel.aanmeldkanaalTel({ campagne: 'onbekend-1' }).geteld, true);
  const m = db.data.aanmeldkanaalTelling['2026-10'];
  assert.equal(m.kanalen.sociaal, 1, 'onder het kanaal van de campagne');
  assert.equal(m.kanalen.campagne, 1, 'een onbekende code zoals voordien');
  assert.deepEqual(Object.keys(m.campagnes).sort(), ['herfst-26', 'onbekend-1']);
  assert.doesNotMatch(JSON.stringify(m), /key|codenaam|lid:/, 'geen lid in de telling');
});

test('3. de uitgave per campagne is een deel van de kanaalpost', () => {
  const { reg, boek } = wereld();
  reg.rtgCampagneMaak(herfst);
  const zet = (o) => boek.rtgBoekCampagne(Object.assign({ maand: '2026-10', code: 'herfst-26', centen: 50000, bron: 'factuur 12', wie: 'financien' }, o));
  assert.equal(zet({ maand: '2026-08' }).status, 400, 'in augustus liep hij niet');
  assert.equal(zet({ code: 'niemand' }).status, 400);
  assert.equal(zet({ wie: null }).status, 403);
  assert.equal(zet({}).ok, true);
  assert.equal(zet({}).ongewijzigd, true);
  let b = boek.rtgBoek('2026-10').campagnes;
  assert.equal(b.tegenspraak[0].kanaal, 'sociaal', 'het kanaal zelf is nog leeg');
  boek.rtgBoekZet({ maand: '2026-10', deel: 'marketing', post: 'sociaal', centen: 40000, bron: 'totaal sociaal', wie: 'financien' });
  b = boek.rtgBoek('2026-10').campagnes;
  assert.match(b.tegenspraak[0].reden, /meer dan het hele kanaal/);
  boek.rtgBoekZet({ maand: '2026-10', deel: 'marketing', post: 'sociaal', centen: 80000, bron: 'totaal sociaal', wie: 'financien' });
  assert.deepEqual(boek.rtgBoek('2026-10').campagnes.tegenspraak, []);
});

test('4. de maat per campagne, langs de groepspoort en nooit bij tegenspraak', () => {
  const { reg, boek } = wereld();
  reg.rtgCampagneMaak(herfst);
  boek.rtgBoekZet({ maand: '2026-10', deel: 'marketing', post: 'sociaal', centen: 80000, bron: 'totaal', wie: 'f' });
  boek.rtgBoekCampagne({ maand: '2026-10', code: 'herfst-26', centen: 50000, bron: 'factuur', wie: 'f' });
  const maten = (aantal) => require('../server/kern/bedrijfsmaat/stand-rtgboek')({
    m: '2026-10', peilmoment: '2026-10-15T10:00:00Z', maat: (id, def, u, d) => Object.assign({ id, dektNiet: d }, u), boek: boek.rtgBoek,
    bank: () => null, cijfers: () => ({ ontvangen: 0, bruto: { margeCenten: null, kostenCenten: null, waarom: 'x' } }), notas: () => [],
    kanalen: () => ({ kanalen: [], campagnes: [{ naam: 'herfst-26', stand: aantal >= 10 ? 'TOONBAAR' : 'TE_KLEINE_GROEP', aantal: aantal >= 10 ? aantal : null }] }),
    ledentegoed: () => null });
  const vanCampagne = (a) => maten(a).find(x => x.id === 'campagnes.rtg-marketing');
  const p = vanCampagne(20);
  assert.equal(p.graad, 'vermoed');
  assert.equal(p.perCampagne[0].waarde, 2500);
  assert.equal(vanCampagne(9).perCampagne[0].stand, 'TE_KLEINE_GROEP');
  assert.equal(vanCampagne(9).perCampagne[0].waarde, null);
  boek.rtgBoekZet({ maand: '2026-10', deel: 'marketing', post: 'sociaal', centen: 100, bron: 'totaal', wie: 'f' });
  assert.equal(vanCampagne(20).perCampagne[0].waarde, null, 'bij tegenspraak geen getal');
});

/* ---------------- de routes ---------------- */
let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtgcampagne-'));
async function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
test.after(() => { if (srv) stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ } });

test('5. de routes: lezen met de gedeelde code, schrijven op naam', async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  assert.equal((await api('/api/office/rtgcampagne', {})).status, 401);
  const gedeeld = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  const mens = await kantoorAlsPersoon(base, 'RTG-OFFICE');
  assert.ok(gedeeld && mens);
  const dag = new Date().toISOString().slice(0, 10), maand = dag.slice(0, 7);
  const c = { code: 'proef-c12', naam: 'Proefcampagne', kanaal: 'zoeken', van: dag, tot: dag };
  assert.equal((await api('/api/office/rtgcampagne/maak', c, gedeeld)).status, 403);
  const r = await api('/api/office/rtgcampagne/maak', c, mens);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.campagne.gemaaktDoor, 'op naam, gezet door de server');
  const l = await api('/api/office/rtgcampagne', {}, gedeeld);
  assert.equal(l.status, 200);
  assert.equal(l.body.campagnes[0].code, 'proef-c12');
  assert.equal(l.body.kanalen.includes('vriend'), false);
  const zet = { maand, code: 'proef-c12', centen: 12345, bron: 'factuur zoekmachine' };
  assert.equal((await api('/api/office/rtgboek/campagne', zet, gedeeld)).status, 403);
  const z = await api('/api/office/rtgboek/campagne', zet, mens);
  assert.equal(z.status, 200, JSON.stringify(z.body));
  const b = await api('/api/office/rtgboek', { maand }, gedeeld);
  assert.equal(b.body.boek.campagnes.rijen.find(x => x.code === 'proef-c12').centen, 12345);
});
