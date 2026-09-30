/* DRIE MATEN UIT DE BESLUITEN VAN 30 SEPTEMBER 2026 -- server/kern/bedrijfsmaat/
   stand-toelating.js: toelating van zaken (C20), contract geeindigd (C21) en de
   btw van RTG zelf (C22).

   Zes beweringen, en alle zes kunnen ze zakken:
   1. de toelating telt alleen aanmeldingen met een bedrijf, per stand, en een
      klaargezette zaak is geen geaccepteerde;
   2. de doorlooptijd is een mediaan over de besluiten van DE MAAND, en onder vijf
      besluiten geen getal;
   3. contract geeindigd: de noemer is wat aan het begin van de maand liep, en een
      contract dat in de maand begon en eindigde telt niet;
   4. de btw van RTG gaat over het KWARTAAL, op vervallen termijnen, tegen het
      standaardtarief, en draagt klasse advies -- indienen is voorbehouden;
   5. een ontbrekende bron geeft een reden en nooit een nul;
   6. alle drie staan op een echte server in de stand;
   7. de drie kantoormaten blijven open, met besluit C23 als reden (C23).

   Draai: node --test test/bedrijfsmaattoelating.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');
const TOELATING = require('../server/kern/bedrijfsmaat/stand-toelating');

const M = '2026-09';
const maat = (id, def, uit, dekt) => Object.assign({ id, definitie: def, dektNiet: dekt }, uit);
const reken = (lees, m) => Object.fromEntries(TOELATING({ m: m || M, maat, lees }).map(x => [x.id, x]));
const aanvraag = (status, extra) => Object.assign({ bedrijf: { naam: 'x', type: 'horeca' }, status, at: '2026-09-01T00:00:00Z' }, extra || {});
const besluit = (dagen, maand) => ({ besluit: 'geaccepteerd', at: new Date(Date.parse((maand || M) + '-01T00:00:00Z') + dagen * 86400000).toISOString() });

test('1. per stand, alleen met een bedrijf, en klaargezet is een eigen stand', () => {
  const a = [];
  for (let i = 0; i < 8; i++) a.push(aanvraag('in behandeling'));
  for (let i = 0; i < 6; i++) a.push(aanvraag('geaccepteerd', { gezaakt: { code: 'Z' + i } }));
  a.push(aanvraag('geaccepteerd'));
  a.push({ status: 'in behandeling', at: '2026-09-02T00:00:00Z' });
  const t = reken({ aanmeldingen: () => a })['leveranciers.partners-toelating'];
  assert.equal(t.stand, 'PER_STAND');
  const per = Object.fromEntries(t.perStand.map(r => [r.naam, r]));
  assert.equal(per['in behandeling'].aantal, 8, 'een aanmelding zonder bedrijf is een lid en telt niet');
  assert.equal(per.klaargezet.aantal, null, 'secundaire onderdrukking: de kleinste zichtbare gaat mee dicht');
  assert.equal(per.klaargezet.stand, 'TE_KLEINE_GROEP');
  assert.equal(per.afgewezen.aantal, 0, 'nul is geen kleine groep');
  assert.equal(per.geaccepteerd.aantal, null, 'een enkele geaccepteerde toont geen aantal');
});

test('2. de doorlooptijd is de mediaan over de besluiten van de maand, onder vijf dicht', () => {
  const a = [2, 4, 6, 8, 10].map(d => aanvraag('geaccepteerd', { besluit: besluit(d) }));
  a.push(aanvraag('geaccepteerd', { at: '2026-08-01T00:00:00Z', besluit: besluit(100, '2026-08') }));
  const d = reken({ aanmeldingen: () => a })['leveranciers.partners-toelating'].doorlooptijd;
  assert.equal(d.stand, 'TOONBAAR');
  assert.equal(d.waarde, 6);
  assert.equal(d.n, 5);
  const vier = reken({ aanmeldingen: () => a.slice(1) })['leveranciers.partners-toelating'].doorlooptijd;
  assert.equal(vier.stand, 'TE_KLEINE_GROEP');
  assert.equal(vier.waarde, undefined);
});

test('3. geeindigd tegen wat aan het begin van de maand liep', () => {
  const c = (...v) => ({ verloop: v.map(([naar, at]) => ({ naar, at })) });
  const k = [];
  for (let i = 0; i < 8; i++) k.push(c(['ACTIEF', '2026-01-01T00:00:00Z']));
  for (let i = 0; i < 2; i++) k.push(c(['ACTIEF', '2026-01-01T00:00:00Z'], ['OPZEGGEND', '2026-08-10T00:00:00Z'], ['GEEINDIGD', '2026-09-15T00:00:00Z']));
  k.push(c(['ACTIEF', '2026-09-02T00:00:00Z'], ['GEEINDIGD', '2026-09-20T00:00:00Z']));
  k.push(c(['ACTIEF', '2026-01-01T00:00:00Z'], ['GEEINDIGD', '2026-08-20T00:00:00Z']));
  const g = reken({ contracten: () => k })['churn.contract-geeindigd'];
  assert.equal(g.stand, 'TOONBAAR');
  assert.equal(g.n, 10, 'het in september begonnen en het al geeindigde contract liepen niet aan het begin');
  assert.equal(g.waarde, 0.2);
  assert.equal(reken({ contracten: () => k.slice(1) })['churn.contract-geeindigd'].stand, 'TE_KLEINE_GROEP');
});

test('4. btw van RTG: kwartaal, vervallen termijnen, standaardtarief, klasse advies', () => {
  const s = [{ termijnen: [{ vervalt: '2026-07-01', centen: 10000 }, { vervalt: '2026-09-01', centen: 5000, status: 'open' },
    { vervalt: '2026-10-01', centen: 99999 }, { vervalt: '2026-06-30', centen: 99999 }] }];
  const b = reken({ betaalschemas: () => s })['fiscaal.btw-rtg'];
  assert.equal(b.stand, 'VOORBEREIDING');
  assert.equal(b.kwartaal, '2026-K3');
  assert.equal(b.grondslagCenten, 15000, 'vervallen, ook als nog niet betaald (factuurstelsel)');
  assert.equal(b.tarief, 21);
  assert.equal(b.waarde, 3150);
  assert.equal(b.zekerheid.klasse, 'advies');
  assert.equal(b.indienen.klasse, 'voorbehouden');
  assert.equal(b.graad, 'vermoed');
});

test('5. een ontbrekende bron geeft een reden, nooit een nul', () => {
  const uit = reken({});
  for (const id of ['leveranciers.partners-toelating', 'churn.contract-geeindigd', 'fiscaal.btw-rtg']) {
    assert.equal(uit[id].stand, 'NIET_UIT_TE_REKENEN', id);
    assert.equal(uit[id].waarde, null, id);
    assert.ok(uit[id].waarom.length > 10, id);
  }
});

let srv;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bmtoel-'));
test.after(() => { if (srv) stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ } });

test('6. alle drie staan op een echte server in de stand, aangesloten op hun bron', async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const post = (pad, body, token) => fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) }).then(r => r.json());
  const eig = (await post('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).token;
  const b = await post('/api/office/bedrijfsmaat', {}, eig);
  for (const id of ['leveranciers.partners-toelating', 'churn.contract-geeindigd', 'fiscaal.btw-rtg']) {
    const m = (b.maten || []).find(x => x.id === id);
    assert.ok(m, id + ' staat in de stand');
    assert.doesNotMatch(String(m.waarom || ''), /niet beschikbaar/, id + ' is aangesloten op zijn bron');
  }
});

test('7. het eigen kantoor blijft ongeteld: open, zonder projectie, met C23 als reden', () => {
  const { MATEN } = require('../server/kern/bedrijfsmaat');
  for (const id of ['personeel.rtg-op-naam', 'personeel.rtg-werkdruk', 'capaciteit.service']) {
    const m = MATEN.find(x => x.id === id);
    assert.ok(m, id);
    assert.equal(m.projectie, null, id + ' heeft geen projectie: een getal over een klein kantoor is een getal over een mens');
    assert.match(m.waarom.definitie, /Besluit C23/, id + ' draagt zijn reden');
  }
});
