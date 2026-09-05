'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const web = require('../server/web');
const state = require('../server/db/state');
const context = require('../server/db/verzoekcontext');
const maakGrens = require('../server/db/postgres-verzoeken');
const naCommitMail = require('../server/mail-na-commit');
const { voegVeilig } = require('../server/pg/verzoekmerge');
const { maakBus } = require('../server/bus');
const { maakSessies, tokenHash } = require('../server/kern/sessies');

const wacht = ms => new Promise(r => setTimeout(r, ms));
async function luister(app) {
  const srv = await new Promise((ja, nee) => {
    const s = app.listen(0, '127.0.0.1', () => ja(s)); s.on('error', nee);
  });
  return { basis: `http://127.0.0.1:${srv.address().port}`,
    stop: () => new Promise(r => srv.close(r)) };
}

test('requestbeeld is copy-on-write en bewaart objectidentiteit bij arraymutaties', () => {
  state.setRuweData({ bewijs: [{ id: 'a', n: 1 }, { id: 'b', n: 2 }], stil: { n: 4 } });
  const ctx = context.nieuw();
  context.voer(ctx, () => {
    const lijst = state.db.data.bewijs;
    const b = lijst.find(x => x.id === 'b');
    lijst.splice(0, 1); b.n = 9;
    context.noteerSave();
    assert.deepEqual(JSON.parse(context.wijzigingen(ctx)[0].waardeJson), [{ id: 'b', n: 9 }]);
    assert.deepEqual(state.getRuweData().bewijs, [{ id: 'a', n: 1 }, { id: 'b', n: 2 }],
      'ongecommitteerde toestand lekte naar gedeeld RAM');
  });
});

test('writeHead en flushHeaders blijven dicht tot COMMIT en publiceren pas daarna', async () => {
  state.setRuweData({ bewijs: [] });
  let laatLos, gebeurtenissen = 0;
  const bus = maakBus(); bus.subscribe('proef', () => { gebeurtenissen++; });
  const slot = fn => fn();
  const motor = {
    async commitVerzoek(data, wijzigingen) {
      await new Promise(r => { laatLos = r; });
      for (const w of wijzigingen) data[w.sleutel] = JSON.parse(w.waardeJson);
      return { geschreven: wijzigingen.length };
    },
    pool: { query: async () => ({ rows: [{ ok: 1 }] }) },
    laadAlles: async () => state.getRuweData(), openstaandeWijzigingen: () => []
  };
  const grens = maakGrens({ store: 'postgres', db: state.db, state, motor: () => motor,
    slot, basisKlaar: () => true });
  grens.gestart();
  const app = web(); app.use(grens.middleware()); app.use(web.json());
  app.post('/api/proef', (_req, res) => {
    state.db.data.bewijs.push({ id: 'een' }); context.noteerSave();
    bus.publish('proef', { event: 'opgeslagen', envelop: { classificatie: 'intern' } });
    res.writeHead(201, { 'Content-Type': 'application/json' }); res.flushHeaders();
    res.end(JSON.stringify({ ok: true }));
  });
  const s = await luister(app);
  try {
    let klaar = false, kopOntvangen = false;
    const antwoord = fetch(s.basis + '/api/proef', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then(async r => { kopOntvangen = true; return { status: r.status, body: await r.json() }; })
      .finally(() => { klaar = true; });
    for (let i = 0; i < 30 && !laatLos; i++) await wacht(5);
    assert.equal(typeof laatLos, 'function');
    assert.equal(klaar, false, 'het antwoord vertrok vóór de commit');
    assert.equal(kopOntvangen, false, 'writeHead/flushHeaders lekten vóór de commit');
    assert.equal(gebeurtenissen, 0, 'bus-event lekte vóór de commit');
    assert.deepEqual(state.getRuweData().bewijs, []);
    laatLos();
    assert.deepEqual(await antwoord, { status: 201, body: { ok: true } });
    assert.deepEqual(state.getRuweData().bewijs, [{ id: 'een' }]);
    assert.equal(gebeurtenissen, 1);
  } finally { grens.stop(); await s.stop(); }
});

test('een muterende 302 commit duurzaam; een redirect vertrekt pas daarna', async () => {
  state.setRuweData({ bewijs: [] });
  let commits = 0, effect = 0;
  const motor = {
    async commitVerzoek(data, wijzigingen) {
      commits++;
      for (const w of wijzigingen) data[w.sleutel] = JSON.parse(w.waardeJson);
      return { geschreven: wijzigingen.length };
    },
    pool: { query: async () => ({ rows: [] }) }, laadAlles: async () => state.getRuweData(),
    openstaandeWijzigingen: () => []
  };
  const grens = maakGrens({ store: 'postgres', db: state.db, state, motor: () => motor,
    slot: fn => fn(), basisKlaar: () => true });
  grens.gestart();
  const app = web(); app.use(grens.middleware());
  app.get('/api/sso/terug', (_req, res) => {
    state.db.data.bewijs.push({ id: 'sso' }); context.noteerSave();
    context.haakNaCommit(() => { effect++; });
    res.statusCode = 302; res.setHeader('Location', '/klaar'); res.end();
  });
  const s = await luister(app);
  try {
    const r = await fetch(s.basis + '/api/sso/terug', { redirect: 'manual' });
    assert.equal(r.status, 302); assert.equal(r.headers.get('location'), '/klaar');
    assert.equal(commits, 1); assert.equal(effect, 1);
    assert.deepEqual(state.getRuweData().bewijs, [{ id: 'sso' }]);
  } finally { grens.stop(); await s.stop(); }
});

test('directe mutatie zonder save faalt hard en blijft uit gedeeld RAM', async () => {
  state.setRuweData({ bewijs: [] });
  let commits = 0;
  const motor = {
    commitVerzoek: async () => { commits++; },
    pool: { query: async () => ({ rows: [] }) }, laadAlles: async () => ({}),
    openstaandeWijzigingen: () => []
  };
  const grens = maakGrens({ store: 'postgres', db: state.db, state, motor: () => motor,
    slot: fn => fn(), basisKlaar: () => true });
  grens.gestart();
  const app = web(); app.use(grens.middleware());
  app.post('/api/proef', (_req, res) => { state.db.data.bewijs.push({ id: 'stil' }); res.json({ ok: true }); });
  const s = await luister(app);
  try {
    const r = await fetch(s.basis + '/api/proef', { method: 'POST' });
    assert.equal(r.status, 500);
    assert.match((await r.json()).error, /opslagbevestiging/);
    assert.equal(commits, 0);
    assert.deepEqual(state.getRuweData().bewijs, []);
  } finally { grens.stop(); await s.stop(); }
});

test('4xx rolt mutaties terug en voert geen na-commit-effect uit', async () => {
  state.setRuweData({ bewijs: [] });
  let effect = 0, commits = 0;
  const motor = { pool: { query: async () => ({ rows: [] }) }, laadAlles: async () => ({}),
    openstaandeWijzigingen: () => [], commitVerzoek: async () => { commits++; return { geschreven: 1 }; } };
  const grens = maakGrens({ store: 'postgres', db: state.db, state, motor: () => motor,
    slot: fn => fn(), basisKlaar: () => true });
  grens.gestart();
  const app = web(); app.use(grens.middleware());
  app.post('/api/proef', (_req, res) => {
    state.db.data.bewijs.push({ id: 'niet' }); context.noteerSave();
    context.haakNaCommit(() => { effect++; }); res.status(409).json({ error: 'nee' });
  });
  const s = await luister(app);
  try {
    const r = await fetch(s.basis + '/api/proef', { method: 'POST' });
    assert.equal(r.status, 409); assert.equal(effect, 0); assert.equal(commits, 0);
    assert.deepEqual(state.getRuweData().bewijs, []);
  } finally { grens.stop(); await s.stop(); }
});

test('same-path conflict faalt gesloten; onafhankelijke velden blijven samenvoegbaar', () => {
  assert.deepEqual(voegVeilig({ rol: 'lid', taal: 'nl' }, { rol: 'lid', taal: 'en' },
    { rol: 'beheer', taal: 'nl' }, 'rechten'), { rol: 'beheer', taal: 'en' });
  assert.throws(() => voegVeilig({ rol: 'lid' }, { rol: 'beheer' }, { rol: 'ingetrokken' }, 'rechten'),
    e => e && e.code === 'PG_REQUEST_CONFLICT');
});

test('commitfout geeft 503 en laat geen dirty RAM of succes-naCommit achter', async () => {
  state.setRuweData({ bewijs: [] });
  let succesGeheugen = false, mailsVerzonden = 0;
  const stuurMail = naCommitMail(() => { mailsVerzonden++; });
  const fout = new Error('verbinding viel vóór COMMIT weg');
  const motor = {
    commitVerzoek: async () => { throw fout; },
    pool: { query: async () => { throw fout; } },
    laadAlles: async () => { throw fout; }, openstaandeWijzigingen: () => []
  };
  const grens = maakGrens({ store: 'postgres', db: state.db, state, motor: () => motor,
    slot: fn => fn(), basisKlaar: () => true });
  grens.gestart();
  const app = web(); app.use(grens.middleware()); app.use(web.json());
  app.post('/api/proef', (_req, res) => {
    state.db.data.bewijs.push({ id: 'nooit' }); context.noteerSave();
    context.haakNaCommit(() => { succesGeheugen = true; });
    stuurMail('lid@example.test', 'bevestiging', 'inhoud'); res.json({ ok: true });
  });
  const s = await luister(app);
  try {
    const r = await fetch(s.basis + '/api/proef', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(r.status, 503);
    assert.match((await r.json()).error, /niet duurzaam bevestigen/);
    assert.deepEqual(state.getRuweData().bewijs, []);
    assert.equal(succesGeheugen, false, 'een idemcache werd vóór de mislukte commit gevuld');
    assert.equal(mailsVerzonden, 0, 'mail/provider-effect ontsnapte vóór de mislukte commit');
    assert.equal(grens.stand().writeHealthy, false);
  } finally { grens.stop(); await s.stop(); }
});

test('mislukte commit publiceert geen bruikbare lokale of remote sessiegrant', async () => {
  state.setRuweData({ sessions: {} });
  const bus = maakBus(); let gebeurtenissen = 0;
  bus.subscribe('rtg:sessies:v1', () => { gebeurtenissen++; });
  const sessies = maakSessies({ db: state.db, save: context.noteerSave, crypto,
    sessieIngetrokken: () => false });
  sessies.koppelBus(bus);
  const fout = new Error('COMMIT geweigerd');
  const motor = { commitVerzoek: async () => { throw fout; },
    pool: { query: async () => { throw fout; } }, laadAlles: async () => { throw fout; },
    openstaandeWijzigingen: () => [] };
  const grens = maakGrens({ store: 'postgres', db: state.db, state, motor: () => motor,
    slot: fn => fn(), basisKlaar: () => true });
  grens.gestart();
  const app = web(); app.use(grens.middleware());
  app.post('/api/inloggen', (_req, res) => {
    sessies.rememberSession('grant-die-niet-mag-bestaan', { tier: 'rtg', key: 'lid' });
    res.json({ ok: true });
  });
  const s = await luister(app);
  try {
    const r = await fetch(s.basis + '/api/inloggen', { method: 'POST' });
    assert.equal(r.status, 503);
    const h = tokenHash('grant-die-niet-mag-bestaan');
    assert.equal(sessies.sessions.has(h), false, 'lokale sessiegrant lekte vóór COMMIT');
    assert.equal(Object.hasOwn(state.getRuweData().sessions, h), false);
    assert.equal(gebeurtenissen, 0, 'remote sessiegrant lekte via de bus');
  } finally { grens.stop(); await s.stop(); }
});

test('een afgewezen async best-effort-hook verdwijnt niet stil', async () => {
  state.setRuweData({ bewijs: [] });
  const motor = { commitVerzoek: async () => ({ geschreven: 0 }),
    pool: { query: async () => ({ rows: [] }) }, laadAlles: async () => ({}),
    openstaandeWijzigingen: () => [] };
  const grens = maakGrens({ store: 'postgres', db: state.db, state, motor: () => motor,
    slot: fn => fn(), basisKlaar: () => true });
  grens.gestart();
  const app = web(); app.use(grens.middleware());
  app.get('/api/projectie', (_req, res) => {
    context.haakNaCommit(() => Promise.reject(new Error('projectiebus buiten bereik')));
    res.json({ ok: true });
  });
  const s = await luister(app), oud = console.error, regels = [];
  console.error = (...a) => regels.push(a.join(' '));
  try {
    assert.equal((await fetch(s.basis + '/api/projectie')).status, 200);
    await new Promise(r => setImmediate(r));
    assert.ok(regels.some(x => /best-effort.*projectiebus buiten bereik/.test(x)));
  } finally { console.error = oud; grens.stop(); await s.stop(); }
});

test('mail/provider-effect blijft dicht bij opslagfout en opent pas na achtergrondherstel', async () => {
  state.setRuweData({ bewijs: [] });
  let providerEffecten = 0, stuk = true;
  let duurzaam = { bewijs: [] };
  const motor = {
    async commitVerzoek(data, wijzigingen) {
      if (stuk) throw new Error('PG buiten bereik');
      for (const w of wijzigingen) {
        if (w.waardeBestaat) duurzaam[w.sleutel] = JSON.parse(w.waardeJson);
        else delete duurzaam[w.sleutel];
      }
      state.setRuweData(JSON.parse(JSON.stringify(duurzaam)));
      return { geschreven: wijzigingen.length };
    },
    pool: { query: async () => { if (stuk) throw new Error('PG buiten bereik'); return { rows: [] }; } },
    laadAlles: async () => JSON.parse(JSON.stringify(duurzaam)),
    openstaandeWijzigingen(data) {
      return [{ sleutel: 'bewijs', basisBestaat: true, basisJson: JSON.stringify(duurzaam.bewijs),
        waardeBestaat: true, waardeJson: JSON.stringify(data.bewijs) }];
    }
  };
  const grens = maakGrens({ store: 'postgres', db: state.db, state, motor: () => motor,
    slot: fn => fn(), basisKlaar: () => true });
  const stuurMail = naCommitMail(() => { providerEffecten++; });
  grens.gestart();
  state.getRuweData().bewijs.push({ id: 'achtergrond' });
  grens.achtergrondSave(); stuurMail('lid@example.test', 'bericht', 'inhoud');
  await assert.rejects(grens.herstelNu(), /PG buiten bereik/);
  assert.equal(providerEffecten, 0, 'effect ontsnapte ondanks mislukte duurzaamheid');
  stuk = false;
  await grens.herstelNu();
  assert.equal(providerEffecten, 1, 'effect kwam niet exact eenmaal na duurzame resync');
  assert.deepEqual(state.getRuweData().bewijs, [{ id: 'achtergrond' }]);
  grens.stop();
});

test('een save tijdens de pre-ready start vergiftigt de PostgreSQL-schrijver niet', () => {
  let basisKlaar = false;
  const motor = { openstaandeWijzigingen: () => [] };
  const grens = maakGrens({ store: 'postgres', db: state.db, state,
    motor: () => motor, slot: fn => fn(), basisKlaar: () => basisKlaar });
  assert.equal(grens.achtergrondSave(), false,
    'vóór basis + credentialmigraties bestaat nog geen achtergrondcommit');
  assert.equal(grens.stand().writeHealthy, false);
  basisKlaar = true;
  grens.gestart();
  assert.equal(grens.stand().writeHealthy, true,
    'de pre-ready save mag de zojuist gestarte schrijver niet meteen sluiten');
  grens.stop();
});
