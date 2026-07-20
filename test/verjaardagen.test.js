/* Integratietests voor Verjaardagen & wensen (RTFoundation-gezin): het
   verjaardagenboek (aankomend gesorteerd), de wensenlijst met het verrassings-
   slot (reserveren, en de jarige ziet dat NIET), en het cadeaupotje. Dicht voor
   gasten. Draai los: node --experimental-sqlite --test test/verjaardagen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-verjaardagen-'));
let child;

function api(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
}
const json = r => r.json();
const overzicht = (code, token) => fetch(BASE + '/api/foundation/gezin/' + code + '/verjaardagen?token=' + token).then(json);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

async function gezin() {
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Feest', naam: 'Ouder', pin: '2468' }));
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Noor', rol: 'kind' }));
  const kt = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;
  const gast = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Oma', rol: 'gast' }));
  const gt = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: gast.profiel.id }))).token;
  return { code: g.code, token: g.token, kindId: kind.profiel.id, kt, gt };
}
// dag/maand van morgen, zodat 'dagenTot' klein en voorspelbaar is
function morgen() {
  const d = new Date(Date.now() + 86400000);
  return { dag: d.getDate(), maand: d.getMonth() + 1 };
}

test('het boek: mensen toevoegen, leeftijd berekenen, en op aankomend sorteren', async () => {
  const G = await gezin();
  const m = morgen();
  // iemand die morgen jarig is, en iemand op 1 januari
  assert.equal((await api('/gezin/verjaardag/persoon', { code: G.code, token: G.token, naam: 'Opa Piet', dag: m.dag, maand: m.maand, jaar: 1950 })).status, 200);
  assert.equal((await api('/gezin/verjaardag/persoon', { code: G.code, token: G.token, naam: 'Tante An', dag: 1, maand: 1 })).status, 200);
  // ongeldige datum wordt geweigerd
  assert.equal((await api('/gezin/verjaardag/persoon', { code: G.code, token: G.token, naam: 'Fout', dag: 40, maand: 2 })).status, 400);
  assert.equal((await api('/gezin/verjaardag/persoon', { code: G.code, token: G.token, naam: '', dag: 3, maand: 3 })).status, 400);

  const d = await overzicht(G.code, G.token);
  assert.equal(d.mensen.length, 2);
  // Opa Piet (morgen) staat vooraan; hij wordt de juiste leeftijd
  assert.equal(d.mensen[0].naam, 'Opa Piet');
  assert.equal(d.mensen[0].dagenTot, 1);
  // hij wordt de leeftijd horend bij het jaar van de eerstvolgende verjaardag
  assert.equal(d.mensen[0].wordt, Number(d.mensen[0].opDatum.slice(0, 4)) - 1950);
  // koppelbaar: gezinsleden die nog niet in het boek staan (geen gast)
  assert.ok(d.koppelbaar.some(k => k.naam === 'Ouder') && d.koppelbaar.some(k => k.naam === 'Noor'));
  assert.ok(!d.koppelbaar.some(k => k.naam === 'Oma'), 'de gast is niet koppelbaar');
});

test('wensen met verrassings-slot: reserveren voorkomt dubbel, de jarige ziet het niet', async () => {
  const G = await gezin();
  // koppel het kind aan een persoon in het boek, zodat wij "surprise-hiding" kunnen testen
  const p = await json(await api('/gezin/verjaardag/persoon', { code: G.code, token: G.token, naam: 'Noor', dag: 5, maand: 6, pid: G.kindId }));
  const pid = p.persoon.id;
  // het kind zet zelf een wens op zijn lijst
  assert.equal((await api('/gezin/verjaardag/wens', { code: G.code, token: G.kt, voorId: pid, tekst: 'Een step' })).status, 200);
  // de ouder reserveert de wens (ik regel dit)
  let d = await overzicht(G.code, G.token);
  const wens = d.mensen.find(x => x.id === pid).wensen[0];
  assert.equal((await api('/gezin/verjaardag/wens/claim', { code: G.code, token: G.token, wensId: wens.id, claim: true })).status, 200);
  // de ouder ziet dat het gereserveerd is (door haarzelf)
  d = await overzicht(G.code, G.token);
  const wOuder = d.mensen.find(x => x.id === pid).wensen[0];
  assert.ok(wOuder.doorMijGeclaimd && wOuder.geclaimd);
  // het kind (de jarige) ziet NIET dat het gereserveerd is -- verrassing bewaard
  const dk = await overzicht(G.code, G.kt);
  const wKind = dk.mensen.find(x => x.id === pid).wensen[0];
  assert.equal(wKind.geclaimd, false, 'de jarige ziet geen reservering');
  assert.ok(dk.mensen.find(x => x.id === pid).benIkDeJarige);
  // het kind kan zijn eigen wens niet reserveren
  assert.equal((await api('/gezin/verjaardag/wens/claim', { code: G.code, token: G.kt, wensId: wens.id, claim: true })).status, 403);
  // een tweede reserveerder botst
  const kind2 = await json(await api('/gezin/profiel/maak', { code: G.code, token: G.token, naam: 'Sam', rol: 'kind' }));
  const k2 = (await json(await api('/gezin/profiel/kies', { code: G.code, profielId: kind2.profiel.id }))).token;
  assert.equal((await api('/gezin/verjaardag/wens/claim', { code: G.code, token: k2, wensId: wens.id, claim: true })).status, 400);
  // de ouder geeft vrij, dan kan de ander wel
  await api('/gezin/verjaardag/wens/claim', { code: G.code, token: G.token, wensId: wens.id, claim: false });
  assert.equal((await api('/gezin/verjaardag/wens/claim', { code: G.code, token: k2, wensId: wens.id, claim: true })).status, 200);
});

test('het cadeaupotje: samen inleggen, totaal en mijn-inleg; de jarige ziet het niet', async () => {
  const G = await gezin();
  const p = await json(await api('/gezin/verjaardag/persoon', { code: G.code, token: G.token, naam: 'Noor', dag: 5, maand: 6, pid: G.kindId }));
  const pid = p.persoon.id;
  await api('/gezin/verjaardag/potje/doel', { code: G.code, token: G.token, persoonId: pid, doel: 100 });
  await api('/gezin/verjaardag/potje/bijdrage', { code: G.code, token: G.token, persoonId: pid, bedrag: 30 });
  // een leeg/negatief bedrag telt niet
  assert.equal((await api('/gezin/verjaardag/potje/bijdrage', { code: G.code, token: G.token, persoonId: pid, bedrag: 0 })).status, 400);
  const d = await overzicht(G.code, G.token);
  const pot = d.mensen.find(x => x.id === pid).pot;
  assert.equal(pot.totaal, 30);
  assert.equal(pot.doel, 100);
  assert.equal(pot.mijnInleg, 30);
  // de jarige (het kind) ziet geen potje
  const dk = await overzicht(G.code, G.kt);
  assert.equal(dk.mensen.find(x => x.id === pid).pot, null, 'de jarige ziet het cadeaupotje niet');
});

test('verjaardagen zijn dicht voor gasten en voor een verkeerd token', async () => {
  const G = await gezin();
  assert.equal((await api('/gezin/verjaardag/persoon', { code: G.code, token: G.gt, naam: 'x', dag: 1, maand: 1 })).status, 403);
  assert.equal((await fetch(BASE + '/api/foundation/gezin/' + G.code + '/verjaardagen?token=' + G.gt)).status, 403);
  assert.equal((await fetch(BASE + '/api/foundation/gezin/' + G.code + '/verjaardagen?token=nep')).status, 403);
});
