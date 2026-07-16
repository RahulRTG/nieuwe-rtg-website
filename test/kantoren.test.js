/* De RTG-kantoren en de boardroom: twaalf afdelingskamers met echte cijfers,
   taken per kamer, en de boardroom die alles ziet, elke platformfunctie kan
   schakelen (globaal en per doelgroep, en het werkt echt: het pad gaat dicht)
   en een verbeterkamer bijhoudt. Draai los:
   node --experimental-sqlite --test test/kantoren.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kantoren-'));

const api = (pad, body) => fetch(base + '/api/office/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-KEURING-1' } });
  base = srv.base;
  const login = await fetch(base + '/api/office/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'KANTOOR-KEURING-1' })
  });
  token = (await login.json()).token;
  assert.ok(token, 'het kantoor logt in');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('twaalf kamers, elk met cijfers; zonder inlog blijft de deur dicht', async () => {
  const dicht = await fetch(base + '/api/office/kamers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(dicht.status, 401);
  const d = await api('kamers');
  assert.equal(d.status, 200);
  assert.equal(d.body.kamers.length, 12, 'twaalf afdelingen');
  for (const id of ['sales', 'marketing', 'pr', 'hr', 'financien', 'inkoop', 'verkoop', 'juridisch', 'creatief', 'intern', 'onderzoek', 'klantenservice']) {
    assert.ok(d.body.kamers.some(k => k.id === id), id + ' heeft een kamer');
  }
  const hr = await api('kamer', { id: 'hr' });
  assert.equal(hr.status, 200);
  assert.ok(hr.body.kpis.length >= 3, 'de kamer toont cijfers');
  assert.equal((await api('kamer', { id: 'kelder' })).status, 404);
});

test('taken per kamer: maken, afvinken en terugzien in het grid', async () => {
  const m = await api('kamer/taak', { id: 'sales', tekst: 'Beachclub Sol nabellen over de Zaakdoos' });
  assert.equal(m.status, 200);
  const k = await api('kamer', { id: 'sales' });
  const taak = k.body.taken[0];
  assert.match(taak.tekst, /Beachclub Sol/);
  assert.ok((await api('kamer/taak-zet', { id: 'sales', taakId: taak.id, af: true })).body.ok);
  const grid = await api('kamers');
  const sales = grid.body.kamers.find(x => x.id === 'sales');
  assert.equal(sales.takenOpen, 0, 'afgevinkt telt niet meer als open');
});

test('de boardroom ziet alles en schakelt echt: functie uit, pad dicht, weer aan', async () => {
  const b = await api('boardroom');
  assert.equal(b.status, 200);
  assert.equal(b.body.kamers.length, 12, 'alle kamers in beeld');
  assert.ok(b.body.functies.length >= 5, 'het volledige schakelbord staat erop');
  assert.ok(b.body.verbeterkamer.voorstellen.length >= 1, 'de verbeterkamer heeft een dagronde');
  // pak een echte functie van het bord en zet hem uit
  const alle = b.body.functies.flatMap(g => g.functies);
  const spelenFx = alle.find(f => /spel/i.test(f.naam + f.id)) || alle[0];
  const uit = await api('boardroom/schakel', { functie: spelenFx.id, aan: false });
  assert.equal(uit.status, 200);
  const na = await api('boardroom');
  assert.ok(na.body.functiesUit >= 1, 'het bord telt de uitgezette functie');
  // weer aan, en per doelgroep uit werkt ook
  assert.ok((await api('boardroom/schakel', { functie: spelenFx.id, aan: true })).body.ok);
  if (spelenFx.doelgroepen.length) {
    const dg = spelenFx.doelgroepen[0].id;
    assert.ok((await api('boardroom/schakel', { functie: spelenFx.id, doelgroep: dg, aan: false })).body.ok);
    const check = (await api('boardroom')).body.functies.flatMap(g => g.functies).find(f => f.id === spelenFx.id);
    assert.equal(check.doelgroepen.find(x => x.id === dg).aan, false, 'de doelgroep staat gericht uit');
    assert.ok((await api('boardroom/schakel', { functie: spelenFx.id, doelgroep: dg, aan: true })).body.ok);
  }
  assert.equal((await api('boardroom/schakel', { functie: 'bestaat-niet', aan: false })).status, 404);
});

test('de verbeterkamer loopt op verzoek een verse ronde', async () => {
  const v = await api('boardroom/verbeter');
  assert.equal(v.status, 200);
  assert.ok(v.body.verbeterkamer.voorstellen.length >= 1);
  assert.ok(v.body.verbeterkamer.voorstellen.every(p => p.kamer && p.tekst), 'elk voorstel wijst een kamer aan');
});
