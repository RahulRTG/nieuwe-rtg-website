'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const session = require('../public/shared/rahul-tab/session');
const approval = require('../public/shared/rahul-tab/approval');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function storage() {
  const data = new Map();
  return { getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
}
function window() { return { crypto: webcrypto, localStorage: storage(), sessionStorage: storage() }; }

test('Rahul-geschiedenis blijft bij dezelfde sessie en nooit bij het volgende account', async () => {
  const win = window(); win.localStorage.setItem('rtg_member_token', 'lid-a');
  const store = session.create(win), first = await store.read();
  assert.match(first.owner, /^[a-f0-9]{64}$/);
  assert.equal(await store.write(first.owner, [{ rol: 'user', tekst: 'Privé vraag van A' }]), true);
  assert.equal((await store.read()).history[0].tekst, 'Privé vraag van A');

  win.localStorage.setItem('rtg_member_token', 'lid-b');
  const second = await store.read();
  assert.notEqual(second.owner, first.owner);
  assert.deepEqual(second.history, []);
  assert.doesNotMatch(win.sessionStorage.getItem(session.key), /Privé vraag van A|lid-a|lid-b/);
  assert.equal(await store.write(first.owner, [{ rol: 'rahul', tekst: 'te laat antwoord' }]), false,
    'een antwoord uit de vorige sessie mocht niet na de accountwissel worden bewaard');
});

test('legacy ongebonden opslag en bevestigingscontext worden niet gemigreerd', async () => {
  const win = window(); win.localStorage.setItem('rtg_sup_token', 'zaak-a');
  win.sessionStorage.setItem(session.legacyKey, JSON.stringify([{ rol: 'user', tekst: 'oude vraag' }]));
  const current = await session.create(win).read();
  assert.deepEqual(current.history, []);
  assert.equal(win.sessionStorage.getItem(session.legacyKey), null);
});

// Dezelfde workspace-contextvergelijking als de UI, geen gunstige verifierstub.
function goedkeuring() {
  const controls = new Map(), meldingen = [], verzoeken = [], wachtenden = [];
  const page = { querySelector(sel) {
    if (!controls.has(sel)) controls.set(sel, { hidden: true, disabled: false, textContent: '', innerHTML: '', dataset: {},
      classList: { remove() {}, toggle() {} }, insertAdjacentHTML() {} });
    return controls.get(sel);
  } };
  let context = { app: 'Reizen', verwijzingen: [{ soort: 'aanvraag', id: 'A' }] }, owner = 'account-a';
  const win = { __rahulTabCommand: { page, context: () => context }, RTGRahulTabHelpers: {},
    confirm: () => true, fetch: (url, opties) => new Promise((resolve, reject) => {
      verzoeken.push({ url, opties, resolve: data => resolve({ ok: true, json: async () => data }), reject });
      wachtenden.splice(0).forEach(f => f());
    }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/shared/rahul-tab/workspace.js'), 'utf8'), { window: win });
  const controller = approval.create({ win, page, sync: async () => {}, owner: () => owner, add: (...args) => meldingen.push(args) });
  return { win, page, controller, verzoeken, meldingen,
    get context() { return context; }, wissel(c) { context = c; }, actor(v) { owner = v; },
    toon(c = context, id = 'g-1') { controller.show({ goedkeuringen: [{ id, samenvatting: 'Boek' }] }, 'token-a', true, owner, c); },
    async wacht() { if (!verzoeken.length) await new Promise(f => wachtenden.push(f)); return verzoeken.at(-1); }
  };
}

test('een Rahul-goedkeuring kan niet onder een ander account worden uitgevoerd', async () => {
  const s = goedkeuring(); s.toon();
  assert.equal(s.page.querySelector('[data-approve]').hidden, false, 'geldige oorspronkelijke actor/context ziet de actie');
  s.actor('account-b');
  assert.equal(await s.controller.confirm(), false);
  assert.equal(s.verzoeken.length, 0);
  assert.equal(s.page.querySelector('[data-approve]').hidden, true);
});

test('actueel voorstel behoudt exacte bevestigingsroute en serverresultaat', async () => {
  const s=goedkeuring(); s.toon();
  const klaar=s.controller.confirm(), req=await s.wacht();
  assert.equal(req.url, '/api/member/doe/bevestig');
  assert.deepEqual(JSON.parse(req.opties.body), {goedkeuringId:'g-1', akkoord:true});
  assert.equal(req.opties.headers.Authorization, 'Bearer token-a');
  req.resolve({ok:true});
  assert.equal(await klaar, true);
  assert.equal(s.page.querySelector('[data-decision-state]').textContent, 'SERVER BEVESTIGD');
  assert.equal(s.page.querySelector('[data-approve]').hidden, true);
});

test('voorstelcontext wordt gekopieerd; objectwissel weigert voordat een verzoek wordt verzonden', async () => {
  const s=goedkeuring(); s.toon();
  s.context.verwijzingen[0].id='B';
  assert.equal(await s.controller.confirm(), false);
  assert.equal(s.verzoeken.length, 0);
  assert.equal(s.page.querySelector('[data-approve]').hidden, true);
});

test('laat akkoordresultaat of fout van vorige context wordt niet als actuele bevestiging getoond', async () => {
  for (const mislukt of [false,true]) {
    const s=goedkeuring(); s.toon();
    const klaar=s.controller.confirm(), req=await s.wacht();
    s.wissel({ app:'Reizen', verwijzingen:[{soort:'aanvraag',id:'B'}] });
    if(mislukt)req.reject(Error('oude fout A')); else req.resolve({ok:true});
    assert.equal(await klaar,false);
    assert.equal(s.meldingen.length,0);
    assert.notEqual(s.page.querySelector('[data-decision-state]').textContent,'SERVER BEVESTIGD');
    assert.equal(s.page.querySelector('[data-approve]').hidden,true);
  }
});

test('nieuwe voorstelgeneratie wordt niet verwijderd of bevestigd door oud resultaat', async () => {
  const s=goedkeuring(); s.toon();
  const klaar=s.controller.confirm(), req=await s.wacht();
  s.controller.clear(); s.toon(s.context, 'g-2'); req.resolve({ok:true});
  assert.equal(await klaar,false);
  assert.equal(s.meldingen.length,0);
  assert.equal(s.page.querySelector('[data-approve]').hidden,false);
  const volgende=s.controller.confirm();
  // confirm wacht één sync-microtaak vóór het verzoek.
  await Promise.resolve(); await Promise.resolve();
  assert.equal(s.verzoeken.length,2);
  assert.equal(JSON.parse(s.verzoeken[1].opties.body).goedkeuringId,'g-2');
  s.verzoeken[1].resolve({ok:true}); assert.equal(await volgende,true);
});

test('ontbrekende context of verifier maakt geen uitvoerbaar voorstel', async () => {
  for(const ontbreekt of ['context','verifier']) {
    const s=goedkeuring();
    if(ontbreekt==='verifier')delete s.win.RTGLiveTwin;
    s.controller.show({goedkeuringen:[{id:'g-1'}]},'token-a',true,'account-a',ontbreekt==='context'?undefined:s.context);
    assert.equal(s.page.querySelector('[data-approve]').hidden,true);
    assert.equal(await s.controller.confirm(),false);
    assert.equal(s.verzoeken.length,0);
  }
});


test('contextwissel tijdens de bevestigingsvraag start geen uitvoering', async () => {
  const s=goedkeuring(); s.toon();
  s.win.confirm=()=>{s.context.verwijzingen[0].id='B';return true;};
  assert.equal(await s.controller.confirm(),false);
  assert.equal(s.verzoeken.length,0);
  assert.equal(s.page.querySelector('[data-approve]').hidden,true);
});

test('alleen expliciete server-ok true wordt als uitgevoerd beschreven', async () => {
  const s=goedkeuring(); s.toon();
  const klaar=s.controller.confirm(), req=await s.wacht(); req.resolve({ok:'true'});
  await klaar;
  assert.doesNotMatch(JSON.stringify(s.meldingen),/uitgevoerd/);
  assert.notEqual(s.page.querySelector('[data-decision-state]').textContent,'SERVER BEVESTIGD');
});
