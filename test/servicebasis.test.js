/* Echte chatkern/route met begrensde opslag- en provideradapters. Geen bewijs
   van providerintegratie; wel dat basisservice geen betaald model aanroept. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakAi } = require('../server/kern/ai');

function wereld() {
  const staten = new Map(), modellen = [], kantoor = [], overdrachten = [];
  const accounts = {
    getMemberState: id => staten.get(id),
    saveMemberState: (id, state) => staten.set(id, state),
    phoneOf: () => null
  };
  const hulp = maakAi({ db: { data: {} }, save() {}, PERSONAS: {}, accounts,
    anthropic: { messages: { async create() { modellen.push(true); throw new Error('model hoort niet te worden gebruikt'); } } },
    broadcastSync() {}, sseToOffice: (...x) => kantoor.push(x) });
  hulp.zetServiceOverdracht((u, tekst) => overdrachten.push({ u, tekst }));
  return { hulp, accounts, staten, modellen, kantoor, overdrachten };
}

test('basisservice gebruikt geen betaald model en geen conciergemelding', async () => {
  const w = wereld();
  await w.hulp.memberSays({ id: 41, tier: 'guest' }, 'ik wil een mens', 'app', 'nl');
  assert.equal(w.overdrachten.length, 1);
  assert.equal(w.overdrachten[0].u.id, 41);
  assert.equal(w.staten.get(41).needsConcierge, false);
  assert.equal(w.staten.get(41).conversation.at(-1).from, 'service');
  assert.equal(w.modellen.length, 0);
  assert.equal(w.kantoor.length, 0);
});

for (const tier of ['lifestyle', 'business']) test(tier + ' behoudt de conciergelijn', async () => {
  const w = wereld();
  await w.hulp.memberSays({ id: 41, tier }, 'ik wil een mens', 'app', 'nl');
  assert.equal(w.staten.get(41).needsConcierge, true);
  assert.equal(w.staten.get(41).conversation.length, 1);
  assert.equal(w.modellen.length, 0);
  assert.equal(w.overdrachten.length, 0);
  assert.deepEqual(w.kantoor, [['sync', { scope: 'concierge' }]]);
});

test('chatroute gebruikt de effectieve basispas, niet de opgeslagen oude betaalde pas', async () => {
  const w = wereld(), routes = new Map();
  require('../server/routes/member/assistent')({
    app: { post: (pad, ...fns) => routes.set(pad, fns.at(-1)) }, auth() {},
    ...w.hulp, accounts: w.accounts, trChat: async x => x, talen: { taalVan: () => 'nl' }
  });
  const account = { id: 41, tier: 'business' };
  let antwoord;
  await routes.get('/api/chat/send')({ session: { account, tier: 'guest' },
    body: { text: 'ik wil een medewerker', tier: 'business', accountId: 999 } },
  { json: x => { antwoord = x; } });
  assert.equal(antwoord.mode, 'service');
  assert.equal(account.tier, 'business', 'geen stilzwijgende mutatie van het opgeslagen account');
  assert.equal(w.overdrachten[0].u.id, 41);
  assert.equal(w.overdrachten[0].u.tier, 'guest');
  assert.equal(w.modellen.length, 0);
  assert.equal(w.kantoor.length, 0);
});
