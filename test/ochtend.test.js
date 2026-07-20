/* Integratietests voor het Ochtendritme (RTFoundation-gezin): een persoonlijk
   ochtendlijstje dat elke dag reset, de rustige reeks bij een afgeronde ochtend,
   het ouder-beheer van een kindritme, en het gezinsbord. Dicht voor gasten.

   Draai los: node --experimental-sqlite --test test/ochtend.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-ochtend-'));
let child;

function api(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
}
const json = r => r.json();
const overzicht = (code, token) => fetch(BASE + '/api/foundation/gezin/' + code + '/ochtend?token=' + token).then(json);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

async function gezin() {
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Vroeg Op', naam: 'Ouder', pin: '2468' }));
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Noor', rol: 'kind' }));
  const kt = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;
  const gast = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Oma', rol: 'gast' }));
  const gt = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: gast.profiel.id }))).token;
  return { code: g.code, token: g.token, kindId: kind.profiel.id, kt, gt };
}

test('mijn ritme: stappen erbij, afvinken, en alles-af geeft een reeks van 1', async () => {
  const G = await gezin();
  // begin leeg, met voorbeelden om uit te kiezen
  const start = await overzicht(G.code, G.token);
  assert.equal(start.mijn.stappen.length, 0);
  assert.ok(start.voorbeelden.length > 3, 'er zijn voorbeeldstappen');
  assert.equal(start.mijn.reeks, 0);

  // twee stappen toevoegen; een dubbele wordt genegeerd
  assert.equal((await api('/gezin/ochtend/stap', { code: G.code, token: G.token, tekst: 'Tanden poetsen' })).status, 200);
  assert.equal((await api('/gezin/ochtend/stap', { code: G.code, token: G.token, tekst: 'Ontbijten' })).status, 200);
  await api('/gezin/ochtend/stap', { code: G.code, token: G.token, tekst: 'tanden poetsen' }); // dubbel
  // een lege stap kan niet
  assert.equal((await api('/gezin/ochtend/stap', { code: G.code, token: G.token, tekst: '  ' })).status, 400);
  let d = await overzicht(G.code, G.token);
  assert.equal(d.mijn.stappen.length, 2, 'geen dubbele stap');

  // de eerste stap afvinken: nog niet klaar, dus geen reeks
  const s1 = d.mijn.stappen[0].id, s2 = d.mijn.stappen[1].id;
  let r = await json(await api('/gezin/ochtend/vink', { code: G.code, token: G.token, stapId: s1, aan: true }));
  assert.equal(r.klaar, false);
  assert.equal(r.reeks, 0);
  // de tweede ook: nu alles af -> reeks 1 en netKlaar
  r = await json(await api('/gezin/ochtend/vink', { code: G.code, token: G.token, stapId: s2, aan: true }));
  assert.equal(r.klaar, true);
  assert.equal(r.netKlaar, true);
  assert.equal(r.reeks, 1);
  // nog een keer vinken op dezelfde dag telt de reeks niet dubbel
  r = await json(await api('/gezin/ochtend/vink', { code: G.code, token: G.token, stapId: s2, aan: false }));
  r = await json(await api('/gezin/ochtend/vink', { code: G.code, token: G.token, stapId: s2, aan: true }));
  assert.equal(r.netKlaar, false, 'geen dubbele telling op dezelfde dag');
  assert.equal(r.reeks, 1);

  d = await overzicht(G.code, G.token);
  assert.equal(d.mijn.klaar, true);
  assert.equal(d.mijn.reeks, 1);
  assert.equal(d.mijn.record, 1);
});

test('ouder zet het ritme van het kind klaar; het kind vinkt zelf af', async () => {
  const G = await gezin();
  // de ouder voegt een stap toe voor het kind
  assert.equal((await api('/gezin/ochtend/stap', { code: G.code, token: G.token, voor: G.kindId, tekst: 'Tas inpakken' })).status, 200);
  // het kind ziet zijn stap in zijn eigen overzicht
  const dk = await overzicht(G.code, G.kt);
  assert.ok(dk.mijn.stappen.some(x => x.tekst === 'Tas inpakken'));
  // het kind kan niet het ritme van de ouder aanpassen
  assert.equal((await api('/gezin/ochtend/stap', { code: G.code, token: G.kt, voor: 'onbekend', tekst: 'x' })).status, 200); // onbekende voor -> valt terug op zichzelf
  const ouderId = (await overzicht(G.code, G.token)).mijnId;
  assert.equal((await api('/gezin/ochtend/stap', { code: G.code, token: G.kt, voor: ouderId, tekst: 'stiekem' })).status, 403);
  // de ouder ziet het kind in de kinderen-lijst
  const dp = await overzicht(G.code, G.token);
  assert.ok(dp.magKinderen);
  assert.ok(dp.kinderen.some(k => k.pid === G.kindId && k.stappen.some(x => x.tekst === 'Tas inpakken')));
});

test('het gezinsbord toont wie klaar is en de reeks; de gast doet niet mee', async () => {
  const G = await gezin();
  // ouder krijgt een stap en vinkt die af (alles af -> klaar)
  await api('/gezin/ochtend/stap', { code: G.code, token: G.token, tekst: 'Koffie' });
  const d0 = await overzicht(G.code, G.token);
  await api('/gezin/ochtend/vink', { code: G.code, token: G.token, stapId: d0.mijn.stappen[0].id, aan: true });
  const d = await overzicht(G.code, G.token);
  const ouderRij = d.bord.find(b => b.pid === d.mijnId);
  assert.ok(ouderRij.klaar, 'de ouder staat als klaar op het bord');
  assert.equal(ouderRij.reeks, 1);
  // de gast (oma) staat niet op het bord
  assert.ok(!d.bord.some(b => b.naam === 'Oma'), 'een gast staat niet op het ochtendbord');
});

test('het ochtendritme is dicht voor een gast en voor een verkeerd token', async () => {
  const G = await gezin();
  assert.equal((await api('/gezin/ochtend/stap', { code: G.code, token: G.gt, tekst: 'stiekem' })).status, 403);
  assert.equal((await api('/gezin/ochtend/vink', { code: G.code, token: G.gt, stapId: 'x', aan: true })).status, 403);
  assert.equal((await fetch(BASE + '/api/foundation/gezin/' + G.code + '/ochtend?token=' + G.gt)).status, 403);
  assert.equal((await fetch(BASE + '/api/foundation/gezin/' + G.code + '/ochtend?token=nep')).status, 403);
});
