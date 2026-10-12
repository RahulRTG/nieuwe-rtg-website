/* PERSONEELSZICHT, DE ROUTES DIE ER LANGS LIEPEN (derde tegenlezing PR #584).

   Dezelfde regel als test/personeelzicht.test.js -- een manager wat zijn
   functie vraagt, de medewerker zelf het zijne (op staffId), een collega alleen
   aanwezigheid -- nu voor de wegen die de eerste ronde niet raakte. Per punt de
   drie kijkers: de manager, wie het betreft, en Abel (een collega).

   H1 een sollicitatie van een RTG-lid (/api/member/apply) bereikt alleen de
      managers: de INGANG van de bel dwingt dat af (beperkt: werving).
   H2 sollicitatiegesprekken in de gedeelde zaakinbox: alleen de manager.
   H3 het beveiligingsrooster geeft een collega geen verlofsoort.
   H4 loonruns, bevindingen, contracten en aangiftes: alleen de manager.
   M1 verzuimplanning: van een collega alleen vandaag.
   M5 een oude beperkte melding zonder ontvanger gaat alleen naar de manager.
   L1 de gelezen-vlag van een beperkte melding is per lezer.
   L2 een verlofAANVRAAG (nieuw) toont een collega niets, en de meldingen
      hebben een eigen grens per bak.
   L3 de sync-signalen van verlof en werving gaan niet naar het hele team.
   L5 talentMatches en de open aantallen op het zaakbord: alleen de manager.
   En het scherm: een collega die "afwezig" is zonder datum staat er vandaag.

   Draai: node --test test/personeelzicht-routes.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path'); const vm = require('vm');
const { startServer } = require('./helper');
const pz = require('../server/kern/leverancier/personeelzicht');

let H, V, kinderen = [], tmps = [];
let tokM, zora, abel, mira, lid;            // KIKUNOI
let tokVM, g0, g1;                          // AEGIS
const api = (base, pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const h = (pad, body, tok) => api(H, pad, body, tok);
async function nieuw(name) {
  const n = (await h('/api/supplier/staff/add', { name }, tokM)).body;
  const tok = (await h('/api/supplier/login', { code: 'KIKUNOI', staffId: n.staff.id, pin: n.pin })).body.token;
  assert.ok(tok, 'login ' + name);
  return { id: n.staff.id, name: n.staff.name, tok };
}
const state = async (tok) => (await h('/api/supplier/state', {}, tok)).body.state;
async function luister(tok, doe) {
  const ac = new AbortController();
  const r = await fetch(H + '/api/supplier/stream?token=' + tok, { signal: ac.signal });
  const lezer = r.body.getReader(); let tekst = '';
  const lees = (async () => { try { for (;;) { const { value, done } = await lezer.read(); if (done) break; tekst += Buffer.from(value).toString(); } } catch (e) {} })();
  await new Promise(z => setTimeout(z, 300));
  await doe();
  await new Promise(z => setTimeout(z, 1200));
  ac.abort(); await lees;
  return tekst;
}
const vandaag = () => new Date().toISOString().slice(0, 10);

test.before(async () => {
  const start = async (env) => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pzroutes-')); tmps.push(TMP);
    const s = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', ...env } });
    kinderen.push(s.child); return s.base;
  };
  [H, V] = await Promise.all([start({ RTG_DEMO: '1' }), start({ DEMO_SUPPLIER: 'AEGIS' })]);
  const roster = (await h('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager');
  tokM = (await h('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  zora = await nieuw('Zora'); abel = await nieuw('Abel'); mira = await nieuw('Mira');
  const reg = await h('/api/auth/register', { name: 'Sanne Geheim', email: 'sanne.geheim@x.nl', phone: '0612340001',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
  lid = reg.body.token;
  assert.ok(lid, 'het lid is geregistreerd: ' + JSON.stringify(reg.body).slice(0, 200));

  const login = await api(V, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
  tokVM = login.body.token;
  const guards = (login.body.state.staff || []).filter(x => x.role === 'staff');
  g0 = { id: guards[0].id, tok: (await api(V, '/api/supplier/login', { code: 'AEGIS', staffId: guards[0].id, pin: '5678' })).body.token };
  g1 = { id: guards[1].id, tok: (await api(V, '/api/supplier/login', { code: 'AEGIS', staffId: guards[1].id, pin: '5678' })).body.token };
});
test.after(() => {
  for (const c of kinderen) try { c.kill('SIGKILL'); } catch (e) {}
  for (const t of tmps) try { fs.rmSync(t, { recursive: true, force: true }); } catch (e) {}
});

test('H1+H2. een sollicitatie van een RTG-lid en het gesprek erover: alleen de manager', async () => {
  assert.equal((await h('/api/cv/save', { name: 'Sanne Geheim', contact: 's@x.nl', skills: 'koken', experience: 'horeca' }, lid)).status, 200);
  let r;
  const sa = await luister(abel.tok, async () => { r = await h('/api/member/apply', { supplierCode: 'KIKUNOI', func: 'Kok' }, lid); });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.doesNotMatch(sa, /Sanne Geheim/, 'de naam gaat niet over de stroom van een collega');
  assert.doesNotMatch(sa, /"scope":"team"/, 'en ook het sync-signaal niet (L3)');
  const m = await state(tokM);
  const soll = m.applications.find(a => a.name === 'Sanne Geheim');
  assert.ok(soll && m.notifications.some(n => n.title === 'Sollicitatie via RTG'), 'de manager ziet sollicitatie en melding');
  for (const pad of ['/api/supplier/state', '/api/supplier/notifications']) {
    const a = await h(pad, {}, abel.tok);
    assert.ok(!JSON.stringify(a.body).includes('Sanne Geheim'), pad + ' geeft een collega de naam van de sollicitant');
  }

  // H2: het gesprek
  assert.ok((await h('/api/supplier/apply/decide', { id: soll.id, action: 'uitnodigen' }, tokM)).body.chat, 'gesprek geopend');
  const sb = await luister(abel.tok, () => h('/api/member/apply/chat/send', { id: soll.id, text: 'Geheime vraag over het rooster', lang: 'nl' }, lid));
  assert.doesNotMatch(sb, /Geheime vraag/, 'het bericht van de sollicitant gaat niet over de stroom van een collega');
  assert.equal((await h('/api/supplier/apply/chat', { id: soll.id }, abel.tok)).status, 403, 'apply/chat is van de manager');
  assert.equal((await h('/api/supplier/apply/chat', { id: soll.id }, tokM)).status, 200);
  const im = (await h('/api/supplier/comm/inbox', {}, tokM)).body.gesprekken.find(g => g.bron === 'Werk');
  assert.ok(im, 'de manager ziet het gesprek in de inbox');
  const ia = await h('/api/supplier/comm/inbox', {}, abel.tok);
  assert.ok(!ia.body.gesprekken.some(g => g.bron === 'Werk') && !JSON.stringify(ia.body).includes('Sanne Geheim'), 'een collega niet');
  assert.equal((await h('/api/supplier/comm/gesprek', { id: im.id }, abel.tok)).status, 400, 'en kan het niet openen');
  assert.equal((await h('/api/supplier/comm/stuur', { id: im.id, tekst: 'hoi' }, abel.tok)).status, 400, 'of erin schrijven');
  const zk = await h('/api/supplier/comm/zoek', { vraag: 'Geheime vraag' }, abel.tok);
  assert.deepEqual(zk.body.treffers, [], 'of erin zoeken');
  assert.ok((await h('/api/supplier/comm/zoek', { vraag: 'Geheime vraag' }, tokM)).body.treffers.length >= 1);
});

test('H3. het beveiligingsrooster geeft een collega geen verlofsoort', async () => {
  const dag = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  const vr = await api(V, '/api/staff/leave/request', { soort: 'verlof', van: dag, tot: dag }, g0.tok);
  assert.equal(vr.status, 200, JSON.stringify(vr.body));
  assert.equal((await api(V, '/api/supplier/leave/decide', { id: vr.body.entry.id, action: 'goedkeuren' }, tokVM)).status, 200);
  assert.equal((await api(V, '/api/supplier/beveiliging/planauto', { datum: dag }, tokVM)).status, 200);
  assert.equal((await api(V, '/api/supplier/beveiliging/dienst', { datum: dag, guardId: g0.id, shiftId: 'dag',
    postId: (await api(V, '/api/supplier/beveiliging/command', {}, tokVM)).body.postenLijst[0].id }, tokVM)).status !== 500, true);
  const vind = async (tok) => {
    const r = await api(V, '/api/supplier/beveiliging/rooster', { van: dag, dagen: 1 }, tok);
    const uit = [];
    for (const p of r.body.dagen[0].posten) for (const sh of p.shifts) for (const x of sh.bezet) if (String(x.guardId) === String(g0.id) && x.afwezig) uit.push(x);
    return { uit, tekst: JSON.stringify(r.body) };
  };
  const m = await vind(tokVM);
  assert.ok(m.uit.length && typeof m.uit[0].afwezig === 'string', 'de manager ziet de soort: ' + JSON.stringify(m.uit[0]));
  assert.equal((await vind(g0.tok)).uit[0].afwezig, m.uit[0].afwezig, 'de bewaker zelf ook');
  const c = await vind(g1.tok);
  assert.ok(c.uit.length && c.uit.every(x => x.afwezig === true), 'een collega ziet alleen DAT');
  assert.ok(!c.tekst.includes(m.uit[0].afwezig), 'en de soort nergens');
});

test('H4. loonruns, bevindingen, contracten en aangiftes alleen voor de manager; de eigen stroken wel', async () => {
  for (const [pad, body] of [['/api/supplier/payroll/runs', {}], ['/api/supplier/payroll/bevindingen', { runId: 'x' }],
    ['/api/supplier/payroll/contracten', { staffId: zora.id }], ['/api/supplier/payroll/aangiftes', {}]]) {
    assert.equal((await h(pad, body, abel.tok)).status, 403, pad + ' voor een medewerker');
    assert.notEqual((await h(pad, body, tokM)).status, 403, pad + ' voor de manager');
  }
  assert.equal((await h('/api/supplier/payroll/stroken', {}, abel.tok)).status, 200, 'de eigen stroken blijven');
});

test('M1+L2. verzuim: een collega ziet alleen vandaag, en geen aanvraag die nog niet besloten is', async () => {
  assert.equal((await h('/api/staff/leave/request', { soort: 'ziek' }, zora.tok)).status, 200);
  const ver = await h('/api/supplier/verzuim/planning', { van: '2020-01-01', tot: '2030-12-31' }, abel.tok);
  assert.deepEqual(ver.body.afwezig.find(x => String(x.staffId) === String(zora.id)), { afwezig: true, staffId: zora.id, naam: 'Zora' });
  // een goedgekeurde vakantie van Mira in mei 2027: de manager ziet hem, een collega niet
  const vr = await h('/api/staff/leave/request', { soort: 'verlof', van: '2027-05-03', tot: '2027-05-04' }, mira.tok);
  assert.equal((await h('/api/supplier/leave/decide', { id: vr.body.entry.id, action: 'goedkeuren' }, tokM)).status, 200);
  const mei = (tok) => h('/api/supplier/verzuim/planning', { van: '2027-05-01', tot: '2027-05-31' }, tok);
  assert.ok((await mei(tokM)).body.afwezig.some(x => String(x.staffId) === String(mira.id)), 'de manager ziet de vakantie');
  assert.ok(!(await mei(abel.tok)).body.afwezig.some(x => String(x.staffId) === String(mira.id)), 'buiten vandaag niets over een collega');
  assert.ok((await h('/api/supplier/verzuim/planning', { van: '2020-01-01', tot: '2030-12-31' }, zora.tok)).body
    .afwezig.find(x => String(x.staffId) === String(zora.id)).regels, 'Zora ziet haar eigen periode');
  // een aanvraag die vandaag begint maar nog 'nieuw' is
  assert.equal((await h('/api/staff/leave/request', { soort: 'verlof', van: vandaag(), tot: vandaag() }, mira.tok)).status, 200);
  assert.ok(!(await state(abel.tok)).verlof.some(v => String(v.staffId) === String(mira.id)), 'een aanvraag is nog geen afwezigheid');
  assert.ok((await state(tokM)).verlof.some(v => String(v.staffId) === String(mira.id) && v.status === 'nieuw'));
});

test('L1+M5+L2. meldingen: per lezer gelezen, oude titels herkend, een eigen grens per bak', async () => {
  // L1: Zora leest haar eigen ziekmelding; voor de manager blijft hij nieuw
  assert.equal((await h('/api/staff/leave/request', { soort: 'ziek' }, zora.tok)).status, 200);
  assert.equal((await h('/api/supplier/notifications/read', {}, zora.tok)).status, 200);
  assert.equal((await h('/api/supplier/notifications/read', {}, abel.tok)).status, 200);
  const zm = (await h('/api/supplier/notifications', {}, zora.tok)).body.notifications.filter(n => n.title === 'Ziekmelding');
  assert.ok(zm.length && zm.every(n => n.read === true), 'Zora ziet haar eigen melding als gelezen');
  const mm = (await h('/api/supplier/notifications', {}, tokM)).body.notifications.filter(n => n.title === 'Ziekmelding');
  assert.ok(mm.some(n => n.read === false), 'voor de manager is hij nog nieuw');

  // M5: een melding van voor het veld, herkend aan de titel
  const oud = [{ id: 'a', title: 'Ziekmelding', body: 'X heeft zich ziek gemeld.' }, { id: 'b', title: 'Sollicitatie via RTG', body: 'Y solliciteert' },
    { id: 'c', title: 'Nieuwe bestelling', body: 'tafel 4' }];
  assert.deepEqual(pz.meldingenVoor(oud, { manager: false, staffId: 3 }).map(n => n.id), ['c']);
  assert.deepEqual(pz.meldingenVoor(oud, { manager: true }).map(n => n.id), ['a', 'b', 'c']);
  assert.throws(() => pz.meldingenVoor([{ id: 'd', title: 't', beperkt: 'iets' }], { manager: true }), /Onbekende meldingbeperking/);

  // L2: veertig beperkte meldingen drukken geen zichtbare melding van een collega weg
  const pim = await nieuw('Pim');
  assert.equal((await h('/api/supplier/staff/reset-pin', { staffId: pim.id }, tokM)).status, 200, 'een gewone melding voor iedereen');
  const voor = (await h('/api/supplier/notifications', {}, abel.tok)).body.notifications.map(n => n.id);
  assert.ok(voor.length >= 1, 'Abel ziet een gewone melding');
  for (let i = 0; i < 41; i++) assert.equal((await h('/api/staff/leave/request', { soort: 'ziek' }, zora.tok)).status, 200);
  const na = (await h('/api/supplier/notifications', {}, abel.tok)).body.notifications.map(n => n.id);
  assert.deepEqual(na, voor, 'een collega houdt zijn meldingen');
});

test('L3. de sync-signalen van verlof gaan naar de manager en wie het betreft', async () => {
  const doe = () => h('/api/staff/leave/request', { soort: 'verlof', van: '2027-03-01', tot: '2027-03-02' }, mira.tok);
  assert.doesNotMatch(await luister(abel.tok, doe), /"scope":"verlof"/, 'een collega krijgt het signaal niet');
  assert.match(await luister(tokM, doe), /"scope":"verlof"/, 'de manager wel');
  assert.match(await luister(mira.tok, doe), /"scope":"verlof"/, 'wie het aanvroeg ook');
});

test('L5. talentMatches en de open aantallen op het zaakbord: alleen de manager', async () => {
  assert.deepEqual((await state(abel.tok)).talentMatches, []);
  const a = (await h('/api/supplier/zaak/board', {}, abel.tok)).body.hr;
  assert.equal(a.openVerlof, null); assert.equal(a.openSollicitaties, null);
  const m = (await h('/api/supplier/zaak/board', {}, tokM)).body.hr;
  assert.ok(m.openVerlof >= 1, 'de manager telt de open aanvragen (status nieuw): ' + m.openVerlof);
  assert.ok(m.openSollicitaties >= 1, 'en de open sollicitaties (nieuw of uitgenodigd): ' + m.openSollicitaties);
});

test('bron: geen enkele schrijver geeft notifySupplier een tekst in plaats van een melding', () => {
  const fout = [];
  const loop = (map) => {
    for (const n of fs.readdirSync(map)) {
      const f = path.join(map, n);
      if (fs.statSync(f).isDirectory()) loop(f);
      else if (n.endsWith('.js') && /notifySupplier(?:\.naOpslag)?\([^,()]+,\s*['"`]/.test(fs.readFileSync(f, 'utf8'))) fout.push(f);
    }
  };
  loop(path.join(__dirname, '..', 'server'));
  assert.deepEqual(fout, [], 'een tekst wordt letter voor letter een melding');
});

test('scherm: een collega die vandaag "afwezig" is zonder datum, staat er vandaag', () => {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public/apps/personeel-voorzijde-weergave.js'), 'utf8'), ctx);
  const verlofOp = ctx.window.RTGTeamRoomBeeld.helpers.verlofOp;
  const stand = { state: { verlof: [{ staffId: 9, name: 'Zora', soort: 'afwezig' }] } };
  assert.ok(verlofOp(stand, { id: 9, name: 'Zora' }, { date: vandaag() }), 'vandaag afwezig');
  assert.ok(!verlofOp(stand, { id: 9, name: 'Zora' }, { date: '2099-01-01' }), 'niet op een andere dag');
});
