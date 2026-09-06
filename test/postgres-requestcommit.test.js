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
const { mergeHandeling, mergeApiSpoor } = require('../server/pg/verzoeksporen');
const { voegKostenSamen } = require('../server/pg/verzoekmeters');
const { voegRtgaiSamen } = require('../server/pg/verzoekrtgai');
const maakPgInlezer = require('../server/pg/inlezen');
const keten = require('../server/lib/keten');
const { maakJournaal } = require('../server/kern/command/journaal');
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

test('gelijktijdige kostenmeters tellen delta, tijd en opslaggemiddelde exact samen', () => {
  const basis = { meters: { '2026-09': { huis: {
    laatst: '2026-09-06T10:00:00.000Z', verzoek: 10, opslag: 2,
    peilingen: { opslag: 2 }, pas: 'business', pasGezien: '2026-09-06T10:00:00.000Z'
  } } }, tarieven: { bron: 'bestuur' } };
  const ons = structuredClone(basis), hun = structuredClone(basis);
  Object.assign(ons.meters['2026-09'].huis, {
    laatst: '2026-09-06T10:01:00.000Z', verzoek: 13, opslag: 3,
    peilingen: { opslag: 3 }, pas: 'business', pasGezien: '2026-09-06T10:01:00.000Z'
  });
  Object.assign(hun.meters['2026-09'].huis, {
    laatst: '2026-09-06T10:02:00.000Z', verzoek: 14, opslag: 4,
    peilingen: { opslag: 3 }, pas: 'premium', pasGezien: '2026-09-06T10:02:00.000Z'
  });
  const samen = voegKostenSamen(basis, ons, hun);
  assert.equal(samen.meters['2026-09'].huis.verzoek, 17);
  assert.equal(samen.meters['2026-09'].huis.laatst, '2026-09-06T10:02:00.000Z');
  assert.equal(samen.meters['2026-09'].huis.peilingen.opslag, 4);
  assert.equal(samen.meters['2026-09'].huis.opslag, 4.25,
    'twee nieuwe peilingen worden als gewogen gemiddelde samengebracht');
  assert.equal(samen.meters['2026-09'].huis.pas, 'premium');
  assert.deepEqual(samen.tarieven, { bron: 'bestuur' });
});

test('kostenmeters bewaren een verse meting bij gelijktijdige retentie en raden onbekende velden niet', () => {
  const basis = { meters: { '2024-01': { huis: { verzoek: 3 } } } };
  const ons = { meters: {} };
  const hun = { meters: { '2024-01': { huis: { verzoek: 4 } } } };
  assert.equal(voegKostenSamen(basis, ons, hun).meters['2024-01'].huis.verzoek, 4);
  assert.throws(() => voegKostenSamen(
    { meters: { '2026-09': { huis: { bewijs: 'basis' } } } },
    { meters: { '2026-09': { huis: { bewijs: 'ons' } } } },
    { meters: { '2026-09': { huis: { bewijs: 'hun' } } } }),
  e => e && e.code === 'PG_REQUEST_CONFLICT');
  assert.equal(voegKostenSamen(
    { meters: { '2026-09': { huis: { pas: 'rtg' } } } },
    { meters: { '2026-09': { huis: { pas: 'business' } } } },
    { meters: { '2026-09': { huis: { pas: 'rtg' } } } })
    .meters['2026-09'].huis.pas, 'business',
  'een legacy pas zonder meettijd gebruikt de gewone conflictvaste merge');
  assert.throws(() => voegKostenSamen(
    { meters: { '2026-09': { huis: { peilingen: { onbekend: 1 } } } } },
    { meters: { '2026-09': { huis: { peilingen: { onbekend: 2 } } } } },
    { meters: { '2026-09': { huis: { peilingen: { onbekend: 3 } } } } }),
  e => e && e.code === 'PG_REQUEST_CONFLICT',
  'alleen geregistreerde standmeters mogen peilingen als delta optellen');
});

test('twee instances voegen RTG-AI metingen als monotone delta samen', () => {
  const basis = { fase: 'meelezen', gestart: 1, waarnemingen: 10,
    domeinen: { auth: 6, office: 4 }, fouten: 1, rondes: 2,
    roerSinds: null, roerRondes: 0,
    journaal: [{ at: 10, soort: 'training', tekst: 'basis' }] };
  const ons = structuredClone(basis), hun = structuredClone(basis);
  ons.waarnemingen += 4; ons.domeinen.auth += 3; ons.domeinen.member = 1;
  ons.fouten += 1; ons.rondes += 1;
  ons.journaal.unshift({ at: 30, soort: 'training', tekst: 'ons' });
  hun.waarnemingen += 5; hun.domeinen.auth += 2; hun.domeinen.supplier = 3;
  hun.rondes += 2;
  hun.journaal.unshift({ at: 20, soort: 'training', tekst: 'hun' });

  const samen = voegRtgaiSamen(basis, ons, hun);
  assert.equal(samen.waarnemingen, 19);
  assert.equal(samen.domeinen.auth, 11);
  assert.equal(samen.domeinen.member, 1);
  assert.equal(samen.domeinen.supplier, 3);
  assert.equal(samen.fouten, 2);
  assert.equal(samen.rondes, 5);
  assert.deepEqual(samen.journaal.map(x => x.tekst), ['ons', 'hun', 'basis']);
  assert.equal(voegRtgaiSamen({ ...basis, gestart: 20 },
    { ...ons, gestart: 20 }, { ...hun, gestart: 10 }).gestart, 10,
  'de eerste echte waarneming blijft de start van een gedeelde meetperiode');
  assert.throws(() => voegRtgaiSamen(basis,
    { ...ons, fase: 'klaar-voor-roer' }, { ...hun, fase: 'aan-het-roer' }),
  e => e && e.code === 'PG_REQUEST_CONFLICT',
  'twee strijdige roerstanden worden nooit op basis van telemetrie geraden');
  const identiek = structuredClone(basis); identiek.waarnemingen = 12;
  assert.equal(voegRtgaiSamen(basis, identiek, structuredClone(identiek)).waarnemingen, 14,
    'gelijke onafhankelijke node-delta\'s gaan niet stil verloren');
  const terug = structuredClone(basis); terug.waarnemingen = 9;
  assert.throws(() => voegRtgaiSamen(basis, terug, structuredClone(terug)),
    e => e && e.code === 'PG_REQUEST_CONFLICT',
    'ook een identieke teller-terugzet faalt gesloten');
});

test('PostgreSQL-inlezen herbaseert RTG-AI delta zodat een volgende notify niet dubbeltelt', async () => {
  let remote = 3, ver = 1;
  let remoteJournaal = [{ at: 10, soort: 'training', tekst: 'basis' }];
  const vorm = (n, journaal = remoteJournaal) => ({ fase: 'meelezen', gestart: 1, waarnemingen: n,
    domeinen: { auth: n }, fouten: 0, rondes: 0, roerSinds: null,
    roerRondes: 0, journaal: structuredClone(journaal) });
  const basisJournaal = [{ at: 10, soort: 'training', tekst: 'basis' }];
  const laatsteJson = new Map([['rtgai', JSON.stringify(vorm(0, basisJournaal))]]);
  const toegepast = new Map([['rtgai', 0]]);
  const pool = { async query(sql) {
    if (/SELECT key, ver/.test(sql)) return { rows: [{ key: 'rtgai', ver }] };
    return { rows: [{ val: JSON.stringify(vorm(remote)), ver, weg: false }] };
  } };
  const inlezer = maakPgInlezer({ pool, merge3: voegVeilig, uitStore: x => x,
    toegepast, laatsteJson });
  const data = { rtgai: vorm(5, [
    { at: 20, soort: 'training', tekst: 'lokaal' }, ...basisJournaal
  ]) };
  remoteJournaal = [{ at: 30, soort: 'training', tekst: 'remote' }, ...basisJournaal];
  await inlezer.haalNieuwer(data);
  assert.equal(data.rtgai.waarnemingen, 8);
  assert.deepEqual(data.rtgai.journaal.map(x => x.tekst), ['lokaal', 'remote', 'basis'],
    'lokale kop blijft herbaseerbaar voor de actuele remote keten');
  assert.equal(JSON.parse(laatsteJson.get('rtgai')).waarnemingen, 3,
    'de actuele remote stand wordt de nieuwe basis');
  remote = 4; ver = 2;
  remoteJournaal = [
    { at: 40, soort: 'training', tekst: 'remote-twee' },
    { at: 30, soort: 'training', tekst: 'remote' }, ...basisJournaal
  ];
  await inlezer.haalNieuwer(data);
  assert.equal(data.rtgai.waarnemingen, 9,
    'alleen de ene nieuwe remote waarneming wordt bij de lokale vijf geteld');
  assert.deepEqual(data.rtgai.journaal.map(x => x.tekst),
    ['lokaal', 'remote-twee', 'remote', 'basis'],
  'ook een remote regel met een nieuwere klok blijft na de tweede notify mergeerbaar');
});

test('gelijktijdige auditregels worden op de actuele ketenkop herketend, nooit overschreven', () => {
  const basis = [];
  keten.noteerIn(basis, { at: 'basis', pad: '/api/basis' }, 50000);
  const ons = basis.map(x => ({ ...x }));
  const hun = basis.map(x => ({ ...x }));
  keten.noteerIn(ons, { at: 'ons', pad: '/api/ons' }, 50000);
  keten.noteerIn(hun, { at: 'hun', pad: '/api/hun' }, 50000);
  const samen = mergeHandeling(basis, ons, hun);
  assert.deepEqual(samen.map(x => x.pad), ['/api/ons', '/api/hun', '/api/basis']);
  assert.equal(keten.verifieer(samen).ok, true);
  const vervalst = ons.map(x => ({ ...x }));
  vervalst[1].pad = '/api/herschreven';
  assert.throws(() => mergeHandeling(basis, vervalst, hun),
    e => e && e.code === 'PG_REQUEST_CONFLICT');
  const kapot = ons.map(x => ({ ...x })); kapot[0].hash = 'vals';
  assert.throws(() => mergeHandeling(basis, kapot, hun),
    e => e && e.code === 'PG_REQUEST_CONFLICT', 'een kapotte lokale keten wordt niet stil hersteld');
  const hashloos = ons.map(x => ({ ...x })); delete hashloos[0].hash;
  assert.throws(() => mergeHandeling(basis, hashloos, basis),
    e => e && e.code === 'PG_REQUEST_CONFLICT', 'een nieuwe hashloze regel geldt niet als legacybewijs');
  const dubbelNr = [keten.schakel({ at: 'dubbel', pad: '/api/dubbel' }, basis[0].hash, basis[0].nr),
    ...basis];
  assert.throws(() => mergeHandeling(basis, dubbelNr, basis),
    e => e && e.code === 'PG_REQUEST_CONFLICT', 'een toevoeging hergebruikt geen ankervolgnummer');
  const vervangen = [];
  keten.noteerIn(vervangen, { at: 'ander', pad: '/api/vervanger' }, 50000);
  assert.throws(() => mergeHandeling(basis, vervangen, basis),
    e => e && e.code === 'PG_REQUEST_CONFLICT', 'een geldige maar andere keten vervangt het bewijs niet');
  const gesnoeid = samen.slice(0, 2);
  assert.deepEqual(mergeHandeling(samen, gesnoeid, samen), gesnoeid,
    'retentie van de oudste staart landt wanneer PostgreSQL niet veranderde');
});

test('gelijktijdige API-journaalregels behouden teller, volgorde en zegelketen', () => {
  const maak = () => {
    const db = { data: { apiSpoor: {} } };
    const j = maakJournaal({ db, save() {}, crypto, vak: () => db.data.apiSpoor });
    return { db, j };
  };
  const bron = maak(); bron.j.noteer({ actor: 'a', actie: 'basis' });
  const basis = JSON.parse(JSON.stringify(bron.db.data.apiSpoor));
  const een = maak(); een.db.data.apiSpoor = JSON.parse(JSON.stringify(basis));
  een.j.noteer({ actor: 'b', actie: 'ons' });
  const twee = maak(); twee.db.data.apiSpoor = JSON.parse(JSON.stringify(basis));
  twee.j.noteer({ actor: 'c', actie: 'hun' });
  const samen = mergeApiSpoor(basis, een.db.data.apiSpoor, twee.db.data.apiSpoor);
  assert.deepEqual(samen.commandJournaal.map(x => x.actie), ['basis', 'hun', 'ons']);
  assert.equal(samen.commandJournaalTotaal, 3);
  for (let i = 1; i < samen.commandJournaal.length; i++)
    assert.equal(samen.commandJournaal[i].vorig, samen.commandJournaal[i - 1].zegel);

  const wis = maak(); wis.db.data.apiSpoor = JSON.parse(JSON.stringify(samen));
  wis.j.wisActor('b', 'AVG-proef');
  const herschreven = mergeApiSpoor(samen, wis.db.data.apiSpoor, samen);
  assert.equal(herschreven.commandJournaal.some(x => x.actor === 'b'), false,
    'een AVG-wissing verdwijnt niet wanneer de database niet veranderde');
  assert.equal(wis.j.controleer().heel, true);
  const vol = maak(); vol.j.noteer({ actor: 'oudste', actie: 'basis-0' });
  for (let i = 1; i < 5000; i++) vol.j.noteer({ actor: 'ander', actie: 'basis-' + i });
  const volBasis = JSON.parse(JSON.stringify(vol.db.data.apiSpoor));
  vol.j.wisActor('oudste', 'AVG-vensterproef');
  assert.doesNotThrow(() => mergeApiSpoor(volBasis, vol.db.data.apiSpoor, volBasis),
    'de bewezen wissing van de afgekaptte oudste regel blijft geldig');
  const vervanger = maak(); vervanger.j.noteer({ actor: 'x', actie: 'vervanger' });
  assert.throws(() => mergeApiSpoor(basis, vervanger.db.data.apiSpoor, basis),
    e => e && e.code === 'PG_REQUEST_CONFLICT', 'een aparte geldige keten vervangt het spoor niet');
  const kapot = JSON.parse(JSON.stringify(een.db.data.apiSpoor));
  kapot.commandJournaal[1].zegel = 'vals';
  assert.throws(() => mergeApiSpoor(basis, kapot, twee.db.data.apiSpoor),
    e => e && e.code === 'PG_REQUEST_CONFLICT', 'een kapot lokaal zegel wordt niet stil hersteld');
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
