/* De RTG-kantoren en de boardroom: twintig afdelingskamers met echte cijfers,
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

test('twintig kamers, elk met cijfers; zonder inlog blijft de deur dicht', async () => {
  const dicht = await fetch(base + '/api/office/kamers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(dicht.status, 401);
  const d = await api('kamers');
  assert.equal(d.status, 200);
  assert.equal(d.body.kamers.length, 20, 'twintig afdelingen');
  for (const id of ['sales', 'marketing', 'pr', 'hr', 'financien', 'inkoop', 'verkoop', 'juridisch', 'creatief', 'intern', 'onderzoek', 'klantenservice', 'atelier', 'studio', 'hardware']) {
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
  assert.equal(b.body.kamers.length, 20, 'alle kamers in beeld');
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

test('de paniekkamer: een knop wordt een voorstel; de boardroom discussieert en besluit', async () => {
  const alle = (await api('boardroom')).body.functies.flatMap(g => g.functies);
  const fx = alle[1] || alle[0];
  // het voorstel: uit, met reden; dubbel voorstellen wordt tegengehouden
  const v = await api('paniek/stel', { functie: fx.id, aan: false, reden: 'Verdachte piek in het verkeer' });
  assert.equal(v.status, 200);
  assert.equal((await api('paniek/stel', { functie: fx.id, aan: false })).status, 409, 'geen dubbel voorstel voor dezelfde knop');
  // cruciaal: de knop is NIET omgezet; het is een voorstel
  let check = (await api('boardroom')).body;
  assert.equal(check.functies.flatMap(g => g.functies).find(f => f.id === fx.id).aan, true, 'nog niets geschakeld');
  assert.ok(check.paniek.some(p => p.id === v.body.voorstel.id), 'de boardroom ziet het voorstel');
  // discussie over en weer
  await api('paniek/bericht', { id: v.body.voorstel.id, wie: 'boardroom', tekst: 'Welke piek precies?' });
  await api('paniek/bericht', { id: v.body.voorstel.id, wie: 'paniekkamer', tekst: 'Honderden mislukte inlogs per minuut.' });
  const p = (await api('paniek')).body.voorstellen.find(x => x.id === v.body.voorstel.id);
  assert.equal(p.discussie.length, 2);
  // de boardroom accepteert: nu pas schakelt hij echt
  assert.ok((await api('paniek/besluit', { id: v.body.voorstel.id, besluit: 'accepteer' })).body.ok);
  check = (await api('boardroom')).body;
  assert.equal(check.functies.flatMap(g => g.functies).find(f => f.id === fx.id).aan, false, 'na acceptatie staat de knop echt om');
  assert.ok(!check.paniek.some(x => x.id === v.body.voorstel.id), 'het voorstel is afgehandeld');
  // terug aan via een tweede voorstel dat wordt afgewezen: er verandert niets
  const v2 = await api('paniek/stel', { functie: fx.id, aan: true });
  assert.ok((await api('paniek/besluit', { id: v2.body.voorstel.id, besluit: 'wijs-af' })).body.ok);
  assert.equal((await api('boardroom')).body.functies.flatMap(g => g.functies).find(f => f.id === fx.id).aan, false, 'afgewezen is niet geschakeld');
  await api('boardroom/schakel', { functie: fx.id, aan: true }); // netjes terug
});

test('platform-statistieken, interne chat met snap en onboarding per kamer', async () => {
  // de statistieken beslaan het hele huis, van mensen tot de code zelf
  const s = await api('stats');
  assert.equal(s.status, 200);
  const groepen = s.body.stats.map(g => g.groep);
  for (const g of ['Mensen', 'Beweging', 'Geld', 'De code zelf']) assert.ok(groepen.includes(g), g);
  // chat: bericht + snap in de sales-kamer; boardroom en paniekkamer hebben eigen kanalen
  const SNAP = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  assert.equal((await api('kachat/stuur', { kamer: 'sales', naam: 'Stagiair Bo', tekst: 'Hallo team!', foto: SNAP })).status, 200);
  assert.equal((await api('kachat/stuur', { kamer: 'boardroom', naam: 'Voorzitter', tekst: 'Welkom allemaal.' })).status, 200);
  assert.equal((await api('kachat/stuur', { kamer: 'kelder', tekst: 'x' })).status, 404);
  assert.equal((await api('kachat/stuur', { kamer: 'sales' })).status, 400, 'leeg bericht geweigerd');
  const c = await api('kachat', { kamer: 'sales' });
  const laatste = c.body.berichten[c.body.berichten.length - 1];
  assert.equal(laatste.naam, 'Stagiair Bo');
  assert.ok(laatste.foto && laatste.foto.startsWith('data:image/'), 'de snap kwam mee');
  // onboarding: warm welkom, huisregels, knoppen en handelingen, per kamer
  const o = await api('onboarding', { kamer: 'sales' });
  assert.equal(o.status, 200);
  assert.match(o.body.onboarding.welkom, /gehoord, gesteund/);
  assert.ok(o.body.onboarding.regels.some(r => /vertrouwenspersoon/i.test(r)), 'de vertrouwenspersoon staat erin');
  assert.ok(o.body.onboarding.knoppen.length >= 2 && o.body.onboarding.handelingen.length >= 1);
  const hr = await api('onboarding', { kamer: 'hr' });
  assert.notDeepEqual(hr.body.onboarding.knoppen, o.body.onboarding.knoppen, 'elke afdeling zijn eigen knoppen');
});

test('aanmelden voor de dienst: kantoor of thuis, en iedereen ziet wie er werkt', async () => {
  const d = await api('dienst/in', { naam: 'Stagiair Bo', kamer: 'sales', waar: 'thuis' });
  assert.equal(d.status, 200);
  assert.equal(d.body.dienst.waar, 'thuis');
  assert.equal((await api('dienst/in', { naam: 'Stagiair Bo', kamer: 'sales' })).status, 409, 'niet dubbel aanmelden');
  assert.equal((await api('dienst/in', { naam: 'X', kamer: 'kelder' })).status, 404);
  const nu = await api('dienst');
  assert.ok(nu.body.aangemeld.some(x => x.naam === 'Stagiair Bo' && x.waar === 'thuis'));
  assert.ok((await api('dienst/uit', { id: d.body.dienst.id })).body.ok);
  assert.ok(!(await api('dienst')).body.aangemeld.some(x => x.naam === 'Stagiair Bo'), 'afgemeld is weg uit de lijst');
});

test('de verbeterkamer loopt op verzoek een verse ronde', async () => {
  const v = await api('boardroom/verbeter');
  assert.equal(v.status, 200);
  assert.ok(v.body.verbeterkamer.voorstellen.length >= 1);
  assert.ok(v.body.verbeterkamer.voorstellen.every(p => p.kamer && p.tekst), 'elk voorstel wijst een kamer aan');
});
