/* Negatieve wrappersimulatie: exacte leveranciersbron + gedeelde API-client,
   vertraagde gesimuleerde transportantwoorden en kleine DOM-doubles.
   Dit is geen browser-, echte server- of externe securitykwalificatie. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const bron = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const deel = bron('public/apps/leverancier/leverancier-06a.js');
const factory = deel.slice(deel.indexOf('  function maakReisApi('), deel.indexOf('  // Wissel van gebruiker:'));

function opstelling() {
  const verzoeken = [], opslag = new Map([['rtg_sup_token', 'sessie-A']]);
  const panelen = [0, 1].map(() => ({ inhoud: 'oud dossier', _reisGeneratie: 1,
    _reisOpdrachtGeneratie: 1, replaceChildren() { this.inhoud = ''; } }));
  const ctx = { window: { addEventListener() {}, removeEventListener() {} }, location: { protocol: 'https:' },
    localStorage: { getItem: k => opslag.get(k) || null, removeItem: k => opslag.delete(k) },
    fetch: (url, options) => new Promise(resolve => verzoeken.push({ url, options, resolve })) };
  vm.createContext(ctx);
  vm.runInContext(bron('public/shared/appshell.js'), ctx);
  ctx.API = ctx.window.RTGApp.maakAPI(); ctx.API.token = 'sessie-A';
  vm.runInContext(factory + '\nglobalThis.maak = maakReisApi;', ctx);
  const api = ctx.maak({ querySelector: s => s === '#zaakReisContracten' ? panelen[0] : panelen[1] });
  const antwoord = (i, status = 200, data = { ok: true, reizen: [{ ref: 'reis-A' }] }) =>
    verzoeken[i].resolve({ status, ok: status === 200, json: async () => data });
  return { ctx, opslag, panelen, verzoeken, api, antwoord };
}

test('wrappersimulatie: actuele sessie behoudt route, body en eigen antwoord zonder extra verzoek', async () => {
  const x = opstelling(), p = x.api('keten', { ref: 'reis-A' });
  assert.equal(x.verzoeken[0].url, '/api/supplier/reisbureau/keten');
  assert.equal(x.verzoeken[0].options.headers.Authorization, 'Bearer sessie-A');
  assert.equal(JSON.parse(x.verzoeken[0].options.body).ref, 'reis-A');
  x.antwoord(0); assert.equal((await p).reizen[0].ref, 'reis-A');
  assert.equal(x.verzoeken.length, 1); assert.equal(x.panelen[0].inhoud, 'oud dossier');
});

for (const wijziging of ['uitloggen', 'andere-gebruiker', 'ander-tabblad']) {
  test('wrappersimulatie: laat antwoord wordt geweigerd na ' + wijziging, async () => {
    const x = opstelling(), p = x.api('keten', {});
    const geweigerd = assert.rejects(p, e => e.status === 401);
    if (wijziging !== 'ander-tabblad') x.ctx.API.token = wijziging === 'uitloggen' ? null : 'sessie-B';
    if (wijziging !== 'uitloggen') x.opslag.set('rtg_sup_token', 'sessie-B');
    x.antwoord(0); await geweigerd;
    assert.ok(x.panelen.every(n => n.inhoud === '' && n._reisGeneratie === 2 && n._reisOpdrachtGeneratie === 2));
    await assert.rejects(x.api('opdracht/besluit', {}), e => e.status === 401);
    assert.equal(x.verzoeken.length, 1, 'geen automatische nieuwe handeling in andere sessie');
  });
}

test('wrappersimulatie: authfout in één paneel invalideert ook het oude antwoord van het andere', async () => {
  const x = opstelling(), oud = x.api('keten', {}), later = x.api('opdrachten', {});
  const oudGeweigerd = assert.rejects(oud, e => e.status === 401);
  const laterGeweigerd = assert.rejects(later, e => e.status === 403);
  x.antwoord(1, 403, { error: 'Personeelsrol ingetrokken.' }); await laterGeweigerd;
  assert.ok(x.panelen.every(n => n.inhoud === ''));
  x.antwoord(0); await oudGeweigerd;
  assert.ok(x.panelen.every(n => n.inhoud === ''));
  assert.equal(x.verzoeken.length, 2);
});

test('wrappersimulatie: onleesbare sessieopslag sluit vóór transport, geen 500 als nieuwe autoriteit', async () => {
  const x = opstelling(); x.ctx.localStorage.getItem = () => { throw new Error('storage denied'); };
  await assert.rejects(x.api('keten', {}), e => e.status === 401);
  assert.equal(x.verzoeken.length, 0); assert.ok(x.panelen.every(n => n.inhoud === ''));
  const y = opstelling(), p = y.api('keten', {}), af = assert.rejects(p, e => e.status === 503);
  y.antwoord(0, 503, { error: 'Opslag onbekend.' }); await af;
  assert.equal(y.verzoeken.length, 1, 'de grens herhaalt een mislukte opdracht nooit zelf');
});

test('lifecycle-simulatie: gebruikerswissel wist stationinhoud voordat een nieuwe gebruiker binnenkomt', () => {
  const x = opstelling(), elementen = new Map();
  for (const s of ['#station', '#stBody', '#app', '#gate', '#staffPick']) elementen.set(s, {
    inhoud: s === '#stBody' ? 'contracten en opdrachten A' : '',
    classList: { remove() {} }, style: {}, replaceChildren() { this.inhoud = ''; }
  });
  Object.assign(x.ctx, { $: s => elementen.get(s), source: null, stationMode: 'kantoor',
    pendingStation: null, state: { eigenaar: 'A' }, S: { naam: 'A' }, notifs: ['A'], pickCode: null });
  const samen = deel + bron('public/apps/leverancier/leverancier-07.js');
  const sluit = samen.slice(samen.indexOf('  function switchUser(){'), samen.indexOf('  function applyState('));
  vm.runInContext(sluit + '\nswitchUser();', x.ctx);
  assert.equal(elementen.get('#stBody').inhoud, ''); assert.equal(x.ctx.API.token, null);
  assert.equal(x.ctx.state, null); assert.equal(x.ctx.S, null); assert.equal(x.opslag.has('rtg_sup_token'), false);
});
