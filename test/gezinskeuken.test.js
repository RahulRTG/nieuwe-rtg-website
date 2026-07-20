/* Integratietests voor de Gezinskeuken (RTFoundation-gezin): het weekmenu (wat
   eten we, wie kookt), de "verras me"-ideeen, en de gedeelde boodschappenlijst
   waar iedereen op afvinkt. Gedeeld per gezin, dicht voor gasten (oppas/familie).

   Draai los: node --experimental-sqlite --test test/gezinskeuken.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-gezinskeuken-'));
let child;

function api(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
}
const json = r => r.json();
const overzicht = (code, token) => fetch(BASE + '/api/foundation/gezin/' + code + '/keuken?token=' + token).then(json);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

// een gezin met een ouder, een kind en een gast opzetten
async function gezin() {
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'De Kok', naam: 'Ouder', pin: '2468' }));
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Noor', rol: 'kind' }));
  const kt = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;
  const gast = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Oma', rol: 'gast' }));
  const gt = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: gast.profiel.id }))).token;
  return { code: g.code, token: g.token, kindId: kind.profiel.id, kt, gt };
}

test('weekmenu: zeven dagen vooruit, een gerecht plannen met kok, en weer wissen', async () => {
  const G = await gezin();
  // het overzicht toont zeven dagen; de eerste is vandaag
  const start = await overzicht(G.code, G.token);
  assert.equal(start.dagen.length, 7);
  assert.ok(start.dagen[0].vandaag);
  assert.equal(start.dagen[0].gerecht, '', 'nog niets gepland');
  // de koks zijn de gezinsleden, niet de gast (oma)
  assert.ok(start.koks.some(k => k.naam === 'Ouder') && start.koks.some(k => k.naam === 'Noor'));
  assert.ok(!start.koks.some(k => k.naam === 'Oma'), 'een gast staat niet in de kokenlijst');

  // de ouder plant een gerecht met het kind als kok
  const datum = start.dagen[1].datum;
  assert.equal((await api('/gezin/keuken/menu', { code: G.code, token: G.token, datum, gerecht: 'Pannenkoeken', kok: G.kindId })).status, 200);
  const na = await overzicht(G.code, G.token);
  const dag = na.dagen.find(d => d.datum === datum);
  assert.equal(dag.gerecht, 'Pannenkoeken');
  assert.equal(dag.kokNaam, 'Noor', 'de kok staat erbij met naam');

  // een dag zonder gerecht kan niet gepland worden
  assert.equal((await api('/gezin/keuken/menu', { code: G.code, token: G.token, datum, gerecht: '' })).status, 400);
  // een onbekende datum wordt geweigerd
  assert.equal((await api('/gezin/keuken/menu', { code: G.code, token: G.token, datum: 'morgen', gerecht: 'x' })).status, 400);

  // wissen maakt de dag weer leeg
  assert.equal((await api('/gezin/keuken/menu/wis', { code: G.code, token: G.token, datum })).status, 200);
  const leeg = await overzicht(G.code, G.token);
  assert.equal(leeg.dagen.find(d => d.datum === datum).gerecht, '');
});

test('verras me: geeft een maaltijd-idee dat nog niet op het menu staat', async () => {
  const G = await gezin();
  const r = await json(await api('/gezin/keuken/idee', { code: G.code, token: G.token }));
  assert.ok(r.idee && r.idee.length > 3, 'er komt een idee terug');
});

test('boodschappenlijst: samen aanvullen, dubbelen negeren, afvinken en opruimen', async () => {
  const G = await gezin();
  // de ouder zet twee dingen erbij, het kind een derde
  assert.equal((await api('/gezin/keuken/lijst', { code: G.code, token: G.token, wat: 'Melk' })).status, 200);
  assert.equal((await api('/gezin/keuken/lijst', { code: G.code, token: G.token, wat: 'Brood' })).status, 200);
  assert.equal((await api('/gezin/keuken/lijst', { code: G.code, token: G.kt, wat: 'Appels' })).status, 200);
  // een leeg boodschapje telt niet
  assert.equal((await api('/gezin/keuken/lijst', { code: G.code, token: G.token, wat: '  ' })).status, 400);
  // hetzelfde (niet-afgevinkte) boodschapje nog eens: geen dubbel
  await api('/gezin/keuken/lijst', { code: G.code, token: G.token, wat: 'melk' });
  let d = await overzicht(G.code, G.token);
  assert.equal(d.lijst.filter(x => x.wat === 'Melk').length, 1, 'geen dubbele melk');
  assert.equal(d.lijst.length, 3);

  // een item afvinken; het zakt naar onderen en toont de opruim-mogelijkheid
  const melk = d.lijst.find(x => x.wat === 'Melk');
  assert.equal((await api('/gezin/keuken/lijst/af', { code: G.code, token: G.kt, itemId: melk.id, af: true })).status, 200);
  d = await overzicht(G.code, G.token);
  assert.ok(d.lijst.find(x => x.id === melk.id).af, 'melk is afgevinkt');
  assert.equal(d.lijst[d.lijst.length - 1].id, melk.id, 'afgevinkt zakt naar onderen');

  // een afgevinkt item weer opnieuw toevoegen mag wel (het staat "af")
  assert.equal((await api('/gezin/keuken/lijst', { code: G.code, token: G.token, wat: 'Melk' })).status, 200);
  d = await overzicht(G.code, G.token);
  assert.equal(d.lijst.filter(x => x.wat === 'Melk').length, 2, 'een verse melk naast de afgevinkte');

  // een item verwijderen
  const brood = d.lijst.find(x => x.wat === 'Brood');
  assert.equal((await api('/gezin/keuken/lijst/verwijder', { code: G.code, token: G.token, itemId: brood.id })).status, 200);
  d = await overzicht(G.code, G.token);
  assert.ok(!d.lijst.some(x => x.wat === 'Brood'), 'brood is weg');

  // afgevinkte spullen opruimen: alleen die verdwijnen
  assert.equal((await api('/gezin/keuken/lijst/opruim', { code: G.code, token: G.token })).status, 200);
  d = await overzicht(G.code, G.token);
  assert.ok(!d.lijst.some(x => x.af), 'geen afgevinkte meer');
  assert.ok(d.lijst.some(x => x.wat === 'Appels'), 'niet-afgevinkte blijven');
});

test('de keuken is dicht voor gasten (oppas/familie) en voor een verkeerd token', async () => {
  const G = await gezin();
  // een gast mag niet plannen, niet op de lijst zetten, en niet meekijken
  assert.equal((await api('/gezin/keuken/lijst', { code: G.code, token: G.gt, wat: 'stiekem' })).status, 403);
  assert.equal((await api('/gezin/keuken/menu', { code: G.code, token: G.gt, datum: '2026-08-01', gerecht: 'x' })).status, 403);
  assert.equal((await fetch(BASE + '/api/foundation/gezin/' + G.code + '/keuken?token=' + G.gt)).status, 403);
  // een verzonnen token komt er ook niet in
  assert.equal((await fetch(BASE + '/api/foundation/gezin/' + G.code + '/keuken?token=nep')).status, 403);
});
