/* DRIE MATEN UIT DE BESLUITEN VAN 29 SEPTEMBER 2026 -- server/kern/bedrijfsmaat/
   stand-groei.js: zaken per genre (C17), contract verlengd (C18) en
   transactievolume (C19).

   Zes beweringen, en alle zes kunnen ze zakken:
   1. een zaak telt alleen als zij toegelaten is EN in de maand iets deed;
   2. een genre onder vijf zaken toont geen aantal, en een enkele kleine groep trekt
      de kleinste zichtbare mee dicht;
   3. verlengd is een overgang naar VERLENGD in de maand, tegen verlengd plus
      geeindigd -- en onder tien contracten geen getal;
   4. het transactievolume is zonder btw, telt alleen betaalwijze rtg van zaken in
      de maand, en toont niets onder vijf zaken;
   5. een ontbrekende bron geeft een reden en nooit een nul;
   6. alle drie staan op een echte server in de stand.

   Draai: node --test test/bedrijfsmaatgroei.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');
const GROEI = require('../server/kern/bedrijfsmaat/stand-groei');

const M = '2026-09';
const maat = (id, def, uit, dekt) => Object.assign({ id, definitie: def, dektNiet: dekt }, uit);
const ontleed = (d) => { const i = d.indexOf(':'); return { soort: d.slice(0, i), id: d.slice(i + 1) }; };
const kosten = (codes) => () => ({ ontleed, alleDragers: () => codes.map(c => ({ drager: 'zaak:' + c, centen: 1 })).concat([{ drager: 'lid:x', centen: 1 }]) });
const reken = (lees, k) => Object.fromEntries(GROEI({ m: M, maat, kosten: k || kosten([]), lees }).map(x => [x.id, x]));
const zaak = (code, type, extra) => Object.assign({ code, type }, extra || {});

test('1 en 2. toegelaten en actief, per genre, langs de groepspoort', () => {
  const zaken = [];
  for (let i = 0; i < 6; i++) zaken.push(zaak('H' + i, 'horeca'));
  for (let i = 0; i < 5; i++) zaken.push(zaak('T' + i, 'taxi'));
  zaken.push(zaak('K0', 'kapper'));
  zaken.push(zaak('G0', 'horeca', { partnerStatus: 'geschorst' }));
  zaken.push(zaak('STIL', 'horeca'));
  const actief = zaken.filter(z => z.code !== 'STIL').map(z => z.code);
  const g = reken({ zaken: () => zaken }, kosten(actief))['groei.zaken-per-genre'];
  assert.equal(g.stand, 'PER_GENRE');
  const per = Object.fromEntries(g.perGenre.map(r => [r.genre, r]));
  assert.equal(per.kapper.aantal, null, 'een kapper alleen toont geen aantal');
  assert.equal(per.taxi.aantal, null, 'secundaire onderdrukking: de kleinste zichtbare gaat mee dicht');
  assert.equal(per.horeca.aantal, 6, 'de geschorste en de stille tellen niet');
});

test('3. verlengd tegen verlengd plus geeindigd, in de maand, en onder tien geen getal', () => {
  const c = (naar, at) => ({ verloop: [{ naar: 'ACTIEF', at: '2025-09-01T00:00:00Z' }, { naar, at }] });
  const contracten = [];
  for (let i = 0; i < 8; i++) contracten.push(c('VERLENGD', '2026-09-10T00:00:00Z'));
  for (let i = 0; i < 2; i++) contracten.push(c('GEEINDIGD', '2026-09-20T00:00:00Z'));
  contracten.push(c('VERLENGD', '2026-08-10T00:00:00Z'));
  const v = reken({ contracten: () => contracten })['retentie.contract-verlengd'];
  assert.equal(v.stand, 'TOONBAAR');
  assert.equal(v.waarde, 0.8);
  assert.equal(v.n, 10);
  const klein = reken({ contracten: () => contracten.slice(0, 9) })['retentie.contract-verlengd'];
  assert.equal(klein.stand, 'TE_KLEINE_GROEP');
  assert.equal(klein.waarde, undefined);
});

test('4. transactievolume zonder btw, alleen rtg van zaken in de maand, onder vijf zaken dicht', () => {
  const f = (code, sub, btw, extra) => Object.assign({ methode: 'rtg', verkoper: { code }, subtotaal: sub, btwBedrag: btw, at: '2026-09-05T10:00:00Z' }, extra || {});
  const facturen = ['A', 'B', 'C', 'D', 'E'].map(c => f(c, 10.5, 2.2));
  facturen.push(f('A', 100, 21, { methode: 'pin' }));
  facturen.push(f('A', 100, 21, { at: '2026-08-31T23:00:00Z' }));
  facturen.push(f(null, 100, 21));
  const t = reken({ facturen: () => facturen })['geld.transactievolume'];
  assert.equal(t.stand, 'TOONBAAR');
  assert.equal(t.waarde, 5250, 'vijf keer 10,50 euro zonder btw, in centen');
  assert.equal(t.btwCenten, 1100);
  assert.equal(t.graad, 'gemeten');
  const vier = reken({ facturen: () => facturen.slice(0, 4) })['geld.transactievolume'];
  assert.equal(vier.stand, 'TE_KLEINE_GROEP');
});

test('5. een ontbrekende bron geeft een reden, nooit een nul', () => {
  const uit = reken({}, () => null);
  for (const id of ['groei.zaken-per-genre', 'retentie.contract-verlengd', 'geld.transactievolume']) {
    assert.equal(uit[id].stand, 'NIET_UIT_TE_REKENEN', id);
    assert.equal(uit[id].waarde, null, id);
    assert.ok(uit[id].waarom.length > 10, id);
  }
  assert.match(reken({ zaken: () => [] }, () => null)['groei.zaken-per-genre'].waarom, /kostenmeter/);
});

let srv;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bmgroei-'));
test.after(() => { if (srv) stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ } });

test('6. alle drie staan op een echte server in de stand, aangesloten op hun bron', async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const post = (pad, body, token) => fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) }).then(r => r.json());
  const eig = (await post('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).token;
  const b = await post('/api/office/bedrijfsmaat', {}, eig);
  for (const id of ['groei.zaken-per-genre', 'retentie.contract-verlengd', 'geld.transactievolume']) {
    const m = (b.maten || []).find(x => x.id === id);
    assert.ok(m, id + ' staat in de stand');
    assert.doesNotMatch(String(m.waarom || ''), /niet beschikbaar/, id + ' is aangesloten op zijn bron');
  }
});
