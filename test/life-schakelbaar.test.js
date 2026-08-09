/* STAAN DE RTG LIFE-DEUREN ECHT IN DE SCHAKELKAST?

   test/schakelkast-dekking.test.js telt of elke route in de CATALOGUS staat. Dat
   is een boekhoudkundige controle: hij bewijst dat er een regel is, niet dat de
   knop iets doet. Deze toets doet het andersom en drukt hem echt om.

   Waarom dit apart staat: de hele RTG Life-stapel is gebouwd zonder ooit in de
   catalogus te zijn gezet -- eenenveertig deuren die vanuit de boardroom
   onzichtbaar waren, en dus niet uit te zetten. Dat is er niet uitgekomen door
   nadenken maar doordat de teller in NORM.json omhoog liep. De toets hieronder
   staat er zodat de volgende laag het niet nog eens kan.

   En twee deuren horen er met REDEN buiten: /api/toestemming (een knop die je
   intrekscherm dichtzet hoort niet te bestaan) en /api/toestel/meting (die komt
   op een toestelsleutel binnen, niet op een ledensessie).
   Draai los: node --experimental-sqlite --test test/life-schakelbaar.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { BUITEN } = require('../scripts/schakelbaar');

let srv, base, lid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lifeschakel-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Per functie: het id uit de catalogus, en een deur die eronder hoort te vallen. */
const STAPEL = [
  ['life', 'life'], ['life', 'dag'], ['doelen', 'doelen'], ['dagmetingen', 'metingen'],
  ['dagmetingen', 'toestellen'], ['gemoed', 'gemoed'], ['gewoonten', 'gewoonten'],
  ['gedachten', 'gedachten'], ['medicijnen', 'medicatie'], ['training', 'training'],
  ['noodkaart', 'noodkaart'], ['voeding', 'voeding'], ['tijdlijn', 'tijdlijn'], ['verzorging', 'verzorging']
];

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = await fetch(base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Schakel Lid', email: 'schakel@x.nl', phone: '0612345899',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
  }).then(r => r.json()).then(d => d.token);
  assert.ok(lid);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('alles staat standaard aan: de knoppen bestaan, maar niemand is buitengesloten', async () => {
  for (const [, deur] of STAPEL) {
    assert.equal((await api(deur, {}, lid)).status, 200, '/api/' + deur + ' staat open');
  }
});

test('elke functie uit de stapel staat op het bord van het lid', async () => {
  const bord = (await api('member/boardroom', {}, lid)).body.bord;
  const ids = new Set(JSON.stringify(bord).match(/"id":"[^"]+"/g).map(s => s.slice(6, -1)));
  for (const [fid] of STAPEL) {
    assert.ok(ids.has(fid), 'de functie ' + fid + ' staat op het bord en is dus te vinden');
  }
});

test('de knop doet ook echt iets: uitzetten sluit de deur, aanzetten opent hem weer', async () => {
  /* Dit is het verschil met de dekkingstoets: die telt regels in een catalogus,
     deze drukt de knop om. Een functie die op het bord staat maar de deur niet
     dichtdoet, is een knop zonder draad. */
  for (const [fid, deur] of STAPEL) {
    const uit = await api('member/boardroom/zet', { id: fid, aan: false }, lid);
    assert.ok(uit.status < 400, 'de functie ' + fid + ' is uit te zetten');

    const dicht = await api(deur, {}, lid);
    assert.equal(dicht.status, 403, '/api/' + deur + ' gaat dicht als ' + fid + ' uit staat');
    assert.equal(dicht.body.functieUit, fid, 'en het antwoord zegt WELKE functie dicht staat');

    await api('member/boardroom/zet', { id: fid, aan: true }, lid);
    assert.equal((await api(deur, {}, lid)).status, 200, '/api/' + deur + ' gaat weer open');
  }
});

test('het toestemmingsscherm valt er met reden buiten, en blijft dus altijd open', async () => {
  /* Een knop waarmee je je eigen intrekscherm dichtzet, hoort niet te bestaan:
     de toestemmingen lopen door en de weg om ze te stoppen is weg. */
  assert.ok(BUITEN.has('/api/toestemming'), 'hij staat bewust buiten de kast');
  assert.match(BUITEN.get('/api/toestemming'), /recht/i, 'met de reden erbij');

  // en er is ook geen functie die hem stiekem toch afsluit
  const bord = (await api('member/boardroom', {}, lid)).body.bord;
  assert.ok(!/\/api\/toestemming/.test(JSON.stringify(bord)),
    'geen enkele knop op het bord claimt dit pad');

  await api('member/boardroom/zet', { id: 'life', aan: false }, lid);
  assert.equal((await api('toestemming', {}, lid)).status, 200,
    'ook met RTG Life uit blijft het intrekscherm open');
  await api('member/boardroom/zet', { id: 'life', aan: true }, lid);
});

test('de toesteldeur staat er buiten omdat hij geen ledensessie draagt', async () => {
  assert.ok(BUITEN.has('/api/toestel/meting'));
  assert.match(BUITEN.get('/api/toestel/meting'), /toestelsleutel/i);

  /* En dat is geen gat: het lid schakelt hem door de sleutel in te trekken. Dat
     wordt hier ook echt nagespeeld, anders is die zin alleen een belofte. */
  const koppel = (await api('toestellen/koppel', { naam: 'Horloge' }, lid)).body;
  const meting = () => fetch(base + '/api/toestel/meting', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rtg-toestel': koppel.sleutel },
    body: JSON.stringify({ onderwerp: 'beweging', waarde: 30 })
  }).then(r => r.status);
  assert.equal(await meting(), 200, 'met een geldige sleutel schrijft het toestel');

  const id = (await api('toestellen', {}, lid)).body.toestellen[0].id;
  await api('toestellen/intrek', { id }, lid);
  assert.equal(await meting(), 401, 'na intrekken komt hij er niet meer in');
});
