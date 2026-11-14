/* De echte route + domeineigenaar, met de echte getekende herstelpolicy.
   Alleen de modelprovider en het accounts-opslagadapter zijn synthetisch;
   dit is geen bewijs van een live provider of van alle WerkOS-ingangen. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture } = require('./abonnementsdiensten-fixture.cjs');
const noop = () => {};
function router() {
  const routes = new Map();
  return { app: { post: (pad, ...fns) => routes.set(pad, fns.at(-1)) },
    async post(pad, req) {
      let klaar;
      const antwoord = new Promise(resolve => { klaar = resolve; });
      const res = { code: 200, status(c) { this.code = c; return this; },
        json(b) { this.body = b; klaar(this); return this; } };
      await routes.get(pad)(req, res);
      return antwoord;
    } };
}
async function ai() {
  const f = await fixture('rtg'), r = router(), staten = new Map(), modellen = [], overdrachten = [];
  const accounts = { getMemberState: id => staten.get(id), saveMemberState: (id, v) => staten.set(id, v), phoneOf: () => null };
  const anthropic = { messages: { async create(input) {
    modellen.push(input); return { content: [{ type: 'text', text: 'Een synthetisch modelantwoord.' }] };
  } } };
  const hulp = require('../server/kern/ai').maakAi({ db: f.db, save: noop,
    PERSONAS: { rtg: { codename: 'Testvos', since: '2026' } }, accounts,
    anthropic, broadcastSync: noop, sseToOffice: noop });
  hulp.zetServiceOverdracht((user, text) => overdrachten.push({ user, text }));
  const automatisch = require('../server/kern/aanmeldingen/abonnementen')({ db: f.db, accounts, nu: () => f.stand.at });
  require('../server/routes/member/assistent')({ ...r, auth: noop, ...hulp, accounts, anthropic,
    trChat: async x => x, talen: { taalVan: () => 'nl' }, aanmeldingen: { automatisch } });
  const account = { id: 1, tier: 'rtg' }, session = { account, tier: 'rtg', key: 'user-1' };
  return { ...f, staten, modellen, overdrachten, account,
    post: (pad, body = {}, sess = session) => r.post(pad, { body, session: sess }) };
}
test('persoonlijke AI: echte modelaanroep stopt pas na hersteltermijn en hervat na echte betaalwaarheid', async () => {
  const w = await ai(), body = { messages: [{ role: 'user', content: 'Help mij een reis kiezen.' }] };
  assert.equal((await w.post('/api/ai', body)).body.source, 'ai');
  assert.equal(w.modellen.length, 1);
  w.beperk();
  const geweigerd = await w.post('/api/ai', { ...body, accountId: 999, nieuweBetaaldeDienst: false });
  assert.equal(geweigerd.code, 402); assert.match(geweigerd.body.error, /nazorg/);
  assert.equal(w.modellen.length, 1, 'geen provider-I/O na de beperking');
  w.betaal();
  assert.equal((await w.post('/api/ai', body)).body.source, 'ai');
  assert.equal(w.modellen.length, 2);
});
test('RTG-chat: geschiedenis, eigen account en menselijke nazorg blijven; geen nieuw betaald model', async () => {
  const w = await ai();
  assert.equal((await w.post('/api/chat/send', { text: 'Wat kan ik hier doen?' })).body.mode, 'rahul');
  assert.equal(w.modellen.length, 1);
  w.beperk();
  const r = await w.post('/api/chat/send', { text: 'Ik wil een medewerker voor mijn betaling', accountId: 999, betaaldeAi: true });
  assert.equal(r.body.mode, 'service');
  assert.equal(r.body.messages.at(-1).from, 'service');
  assert.equal(w.modellen.length, 1);
  assert.equal(w.account.tier, 'rtg', 'de nominale pas wordt niet gewijzigd');
  assert.equal(w.overdrachten.length, 1); assert.equal(w.overdrachten[0].user.id, 1);
  assert.equal(w.overdrachten[0].user.tier, 'rtg', 'geen gefingeerde gastidentiteit');
  const history = await w.post('/api/chat/history');
  assert.equal(history.body.mode, 'service', 'de lijn blijft eerlijk gelabeld bij heropenen');
  assert.equal(history.body.messages.length, 4);
  assert.equal(history.body.messages[1].from, 'rahul', 'bestaande modelbeurt blijft leesbaar');
  w.betaal();
  assert.equal((await w.post('/api/chat/send', { text: 'Dank, nu verder.' })).body.mode, 'rahul');
  assert.equal(w.modellen.length, 2);
});
test('AI-grens volgt de eigen account; andere en legacy accounts niet gestraft, gast krijgt geen modelrecht', async () => {
  const w = await ai(); w.beperk();
  const r = await w.post('/api/ai', { messages: [{ role: 'user', content: 'Mijn eigen vraag' }], accountId: 1 },
    { account: { id: 99, tier: 'rtg' }, key: 'user-99', tier: 'rtg' });
  assert.equal(r.body.source, 'ai');
  assert.equal((await w.post('/api/ai', {}, { tier: 'guest' })).code, 403);
  assert.equal((await w.post('/api/chat/send', { text: 'Hallo' }, { tier: 'guest' })).code, 403);
  assert.equal(w.modellen.length, 1);
});
async function werk() {
  const f = await fixture(), r = router(), saves = [], supplier = { code: 'ZAAK', name: 'Testzaak' };
  const accounts = { listStaff: () => [{ id: 7, name: 'Manager', role: 'manager' }, { id: 8, name: 'Collega', role: 'staff' }], publicStaff: x => x };
  const agent = require('../server/kern/agent').maakAgent({ db: f.db, accounts,
    weekdagFactor: () => [1.2, 'druk'], SHIFT_NAMES: ['ochtend', 'avond', 'vrij'],
    afwezigOp: () => ({ afwezig: false }), save: () => saves.push(true), logActivity: noop, findSupplier: () => null });
  require('../server/routes/supplier/agent')({ ...r, ...agent, supplierAuth: noop, managerOnly: () => true,
    zaakAbonnement: f.zaakAbonnement });
  return { ...f, saves, supplier, post: (pad, body = {}, zaak = supplier) => r.post('/api/supplier/' + pad,
    { body, supplier: zaak, actor: { name: 'Eigenaar' } }) };
}
test('WerkOS-rooster: alleen nieuw voorstel beperkt; bestaand lezen, vaststellen en afwijzen blijven', async () => {
  const w = await werk();
  const eerste = await w.post('rooster/voorstel'); assert.equal(eerste.body.rooster.days.length, 7);
  const voor = JSON.stringify(w.supplier), n = w.saves.length;
  w.beperk();
  assert.equal((await w.post('rooster/voorstel', { code: 'ANDER', nieuweBetaaldeDienst: false })).code, 402);
  assert.equal(JSON.stringify(w.supplier), voor); assert.equal(w.saves.length, n);
  assert.equal((await w.post('agent')).body.agent.rooster.status, 'voorstel');
  const vast = await w.post('rooster/beslis', { actie: 'akkoord' });
  assert.equal(vast.body.rooster.status, 'vast');
  for (const dag of vast.body.rooster.days) for (const lid of dag.staff)
    assert.equal(w.supplier.roosterVast[dag.date][lid.id], lid.shift, 'bestaand werk bereikt het echte rooster');
  assert.equal((await w.post('rooster/beslis', { actie: 'afwijzen' })).body.ok, true);
  assert.equal(w.supplier.agent.rooster, null);
  w.betaal(); assert.equal((await w.post('rooster/voorstel')).body.rooster.status, 'voorstel');
});
test('WerkOS-rooster: contracteinde weigert nieuw voorstel; geen binding betekent geen legacy rechtenintrekking', async () => {
  const w = await werk(); w.betaal();
  w.contract.status = 'OPZEGGEND'; w.contract.eindigtOp = w.stand.at;
  assert.equal((await w.post('rooster/voorstel')).code, 402);
  assert.equal(w.saves.length, 0); assert.equal(w.supplier.agent, undefined);
  assert.equal((await w.post('rooster/voorstel', {}, { code: 'LEGACY', name: 'Bestaande zaak' })).body.ok, true);
});
