/* HET BESLISGEHEUGEN -- server/kern/beslisgeheugen.js (besluit C13).

   1. een besluit legt een mens op naam vast, met een tot acht verwachtingen op
      maten die bestaan, en een termijn van 30 tot 366 dagen;
   2. de gronden dragen wat ze TOEN waren, ook als de maat later verandert;
   3. voor de termijn is er geen uitkomst; erna per maat of de richting klopte,
      en nooit een cijfer voor het hele besluit;
   4. een maat die toen of nu geen getal had, krijgt geen oordeel maar een reden;
   5. intrekken met een reden, en het besluit blijft staan;
   6. de machine stelt niets voor: het geheugen heeft alleen lezen, vastleggen en
      intrekken;
   7. de routes tegen een echte server: lezen in de boardroom, vastleggen op naam.

   Draai: node --test test/beslisgeheugen.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

/* Een nagemaakte sensor: per maand een stand met twee maten. */
function wereld() {
  let klok = '2026-10-01T09:00:00Z';
  const maanden = {
    '2026-10': [{ id: 'omzet.leden-ontvangen', stand: 'TOONBAAR', waarde: 100000, graad: 'gemeten', eenheid: 'eurocent' },
      /* een getal onder een dichte stand is geen getal: de oordeelsregel kijkt naar de stand, niet alleen naar de waarde */
      { id: 'churn.pas-naar-gast', stand: 'TE_KLEINE_GROEP', waarde: 0, graad: 'gemeten' }],
    '2026-11': [{ id: 'omzet.leden-ontvangen', stand: 'TOONBAAR', waarde: 90000, graad: 'gemeten', eenheid: 'eurocent' },
      { id: 'churn.pas-naar-gast', stand: 'TOONBAAR', waarde: 0.02, graad: 'gemeten' }]
  };
  const bedrijfsmaat = { stand: ({ maand } = {}) => { const m = maand || klok.slice(0, 7); return { maand: m, maten: maanden[m] || [] }; } };
  const g = require('../server/kern/beslisgeheugen')({ db: { data: {} }, save: () => {}, nu: () => klok, bedrijfsmaat });
  return { g, maanden, zet: (t) => { klok = t; } };
}
const besluit = { besluit: 'De prijs van de RTG Pass blijft gelijk tot 2027.', termijnDagen: 45, wie: 'eigenaar',
  verwachting: [{ maat: 'omzet.leden-ontvangen', richting: 'omhoog' }, { maat: 'churn.pas-naar-gast', richting: 'omlaag' }] };

test('1. een besluit legt een mens op naam vast, met verwachtingen op bestaande maten', () => {
  const { g } = wereld();
  const leg = (o) => g.beslisgeheugenLeg(Object.assign({}, besluit, o));
  assert.equal(leg({ wie: null }).status, 403);
  assert.equal(leg({ besluit: 'kort' }).status, 400);
  assert.equal(leg({ termijnDagen: 7 }).status, 400);
  assert.equal(leg({ verwachting: [] }).status, 400);
  assert.equal(leg({ verwachting: [{ maat: 'bestaat.niet', richting: 'omhoog' }] }).status, 400);
  assert.equal(leg({ verwachting: [{ maat: 'omzet.leden-ontvangen', richting: 'beter' }] }).status, 400);
  const r = leg({});
  assert.equal(r.ok, true);
  const nog = leg({});
  assert.equal(nog.ongewijzigd, true, 'een dubbelklik legt het besluit niet twee keer vast');
  assert.equal(nog.besluit.id, r.besluit.id);
  assert.equal(g.beslisgeheugen().length, 1);
  assert.equal(r.besluit.wie, 'eigenaar');
  assert.equal(r.besluit.toetsOp.slice(0, 10), '2026-11-15');
});

test('2. de gronden dragen wat ze toen waren', () => {
  const { g, maanden } = wereld();
  const id = g.beslisgeheugenLeg(besluit).besluit.id;
  maanden['2026-10'][0].waarde = 5;
  const b = g.beslisgeheugen().find(x => x.id === id);
  assert.equal(b.gronden.find(x => x.id === 'omzet.leden-ontvangen').waarde, 100000);
  assert.equal(b.gronden.find(x => x.id === 'omzet.leden-ontvangen').graad, 'gemeten');
});

test('3 en 4. na de termijn per maat of de richting klopte, zonder totaal, en geen oordeel zonder getal', () => {
  const { g, zet } = wereld();
  g.beslisgeheugenLeg(besluit);
  assert.equal(g.beslisgeheugen()[0].uitkomst.stand, 'NOG_NIET');
  zet('2026-11-20T09:00:00Z');
  const u = g.beslisgeheugen()[0].uitkomst;
  assert.equal(u.stand, 'GETOETST');
  const omzet = u.perMaat.find(x => x.maat === 'omzet.leden-ontvangen');
  assert.equal(omzet.gemeten, 'omlaag');
  assert.equal(omzet.klopt, false);
  const churn = u.perMaat.find(x => x.maat === 'churn.pas-naar-gast');
  assert.equal(churn.klopt, null, 'toen onder de groepsgrens: geen oordeel');
  assert.match(churn.waarom, /TE_KLEINE_GROEP/);
  assert.equal(Object.keys(u).some(k => /score|totaal|cijfer/i.test(k)), false, 'geen cijfer voor het hele besluit');
});

test('5. intrekken met een reden, en het besluit blijft staan', () => {
  const { g } = wereld();
  const id = g.beslisgeheugenLeg(besluit).besluit.id;
  assert.equal(g.beslisgeheugenTrekIn({ id, reden: '', wie: 'eigenaar' }).status, 400);
  assert.equal(g.beslisgeheugenTrekIn({ id, reden: 'markt veranderd', wie: null }).status, 403);
  assert.equal(g.beslisgeheugenTrekIn({ id, reden: 'markt veranderd', wie: 'eigenaar' }).ok, true);
  assert.equal(g.beslisgeheugenTrekIn({ id, reden: 'nog eens', wie: 'eigenaar' }).ongewijzigd, true);
  const b = g.beslisgeheugen().find(x => x.id === id);
  assert.equal(b.ingetrokken.reden, 'markt veranderd');
  assert.equal(b.besluit, besluit.besluit);
});

test('6. de machine stelt niets voor', () => {
  const { g } = wereld();
  assert.deepEqual(Object.keys(g).sort(), ['BESLIS_RICHTINGEN', 'beslisgeheugen', 'beslisgeheugenLeg', 'beslisgeheugenTrekIn']);
});

/* ---------------- de routes ---------------- */
let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-beslisgeheugen-'));
async function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
test.after(() => { if (srv) stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ } });

test('7. de routes: lezen in de boardroom, vastleggen en intrekken op naam', async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  assert.equal((await api('/api/office/beslisgeheugen', {})).status, 401);
  const gedeeld = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  const mens = await kantoorAlsPersoon(base, 'RTG-OFFICE');
  const b = { besluit: 'Proefbesluit over de runway van RTG.', termijnDagen: 60,
    verwachting: [{ maat: 'runway.rtg', richting: 'omhoog' }] };
  const g403 = await api('/api/office/beslisgeheugen/leg', b, gedeeld);
  assert.equal(g403.status, 403, JSON.stringify(g403.body));
  const r = await api('/api/office/beslisgeheugen/leg', b, mens);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.besluit.wie, 'op naam, gezet door de server');
  const l = await api('/api/office/beslisgeheugen', {}, mens);
  assert.equal(l.status, 200);
  assert.equal(l.body.besluiten[0].uitkomst.stand, 'NOG_NIET');
  const i = await api('/api/office/beslisgeheugen/intrek', { id: r.body.besluit.id, reden: 'alleen een proef' }, mens);
  assert.equal(i.status, 200, JSON.stringify(i.body));
  assert.equal(i.body.besluit.ingetrokken.reden, 'alleen een proef');
});
