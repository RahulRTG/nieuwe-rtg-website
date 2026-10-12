/* KLOKGRENS, DERDE RONDE: "de medewerker zelf" op id, en de kanalen die de
   tweede tegenlezing van PR #584 vond.

   Eigenaarsbesluiten van 11 oktober 2026: klok-, inlog- en plekIn-tijden ziet
   alleen de manager en de medewerker zelf, en er lekt niets via aantallen,
   paginering, volgorde, realtime of andere routes. Alles gaat langs
   server/kern/leverancier/logboekzicht.js.

   Op een echte server, telkens met drie kijkers (manager, de medewerker zelf,
   een collega):
   1. twee collega's met DEZELFDE naam krijgen elkaars inlog- en klokregels
      niet: "zelf" is het staffId en nooit de naam;
   2. beschermde regels drukken geen zichtbare regel van het logboek (de grens
      van 80 was een zijkanaal);
   3. de vierde en vijfde inlogweg (/api/auth/login met werkplekken, en
      /api/supplier/mijn/login) schrijven een beschermde regel;
   4. het CDT-bord van een taxibedrijf: begin en eind van een dienst alleen voor
      de manager en de chauffeur zelf, en de aan- en afmeldregel op kaart is een
      klokregel met een echte naam;
   5. het klok-signaal van een klokCORRECTIE gaat alleen naar de managers en
      wie het betreft.

   Draai: node --test test/logboekzicht-eigen.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');
const zicht = require('../server/kern/leverancier/logboekzicht');

let H, child, TMP;
let tokM, kim1, kim2, odin;          // KIKUNOI
let baas, ch1, ch2;                  // MKKX (taxi)
const api = (pad, body, token) => fetch(H + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function nieuw(code, mgrTok, name) {
  const n = (await api('/api/supplier/staff/add', { name }, mgrTok)).body;
  assert.ok(n.staff && n.pin, 'nieuw teamlid ' + name + ': ' + JSON.stringify(n).slice(0, 200));
  const tok = (await api('/api/supplier/login', { code, staffId: n.staff.id, pin: n.pin })).body.token;
  assert.ok(tok, 'login ' + name);
  return { id: n.staff.id, name: n.staff.name, pin: n.pin, tok };
}
const state = async (tok) => {
  const r = await api('/api/supplier/state', {}, tok);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  return r.body.state;
};
const managerLog = async () => (await api('/api/supplier/activity', { aantal: 80 }, tokM)).body.activity;

test.before(async () => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-logeigen-'));
  ({ child, base: H } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_DEMO: '1' } }));
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager');
  tokM = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  kim1 = await nieuw('KIKUNOI', tokM, 'Kim');
  kim2 = await nieuw('KIKUNOI', tokM, 'Kim');
  odin = await nieuw('KIKUNOI', tokM, 'Odin');

  const rt = (await api('/api/supplier/roster', { code: 'MKKX' })).body;
  const mg = rt.staff.find(x => x.role === 'manager');
  const ch = rt.staff.find(x => x.role !== 'manager');
  baas = (await api('/api/supplier/login', { code: 'MKKX', staffId: mg.id, pin: '1234' })).body.token;
  ch1 = { id: ch.id, name: ch.name, tok: (await api('/api/supplier/login', { code: 'MKKX', staffId: ch.id, pin: '5678' })).body.token };
  ch2 = await nieuw('MKKX', baas, 'Tweede Chauffeur');
  assert.ok(tokM && baas && ch1.tok, 'inlogs');
});
test.after(() => {
  try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. twee collega\'s met dezelfde naam krijgen elkaars inlog- en klokregels niet (op staffId, nooit op naam)', async () => {
  for (const k of [kim1, kim2]) assert.equal((await api('/api/staff/clock', {}, k.tok)).status, 200);
  const log = await managerLog();
  const vanKim = (k) => new Set(log.filter(r => r.who === 'Kim' && String(r.staffId) === String(k.id)).map(r => r.at));
  for (const [ik, ander] of [[kim1, kim2], [kim2, kim1]]) {
    const eigen = vanKim(ik), vreemd = vanKim(ander);
    assert.ok(eigen.size >= 2 && vreemd.size >= 2, 'beide Kims hebben een inlog- en een klokregel');
    const mijn = (await state(ik.tok)).activity.filter(r => zicht.isKlokregel(r));
    assert.ok(mijn.length >= 2, 'Kim ziet haar eigen beschermde regels: ' + mijn.length);
    assert.deepEqual(mijn.filter(r => !eigen.has(r.at)).map(r => r.text + ' ' + r.at), [], 'een regel van de andere Kim kwam binnen');
    const tekst = JSON.stringify(await state(ik.tok));
    assert.deepEqual([...vreemd].filter(t => tekst.includes(t)), [], 'een tijdstip van de andere Kim staat in het antwoord');
  }
  const o = (await state(odin.tok)).activity;
  assert.ok(!o.some(r => r.who === 'Kim' && zicht.isKlokregel(r)), 'een collega krijgt geen enkele beschermde regel van een Kim');
});

test('1b. een oude beschermde regel zonder staffId gaat alleen naar de manager, ook bij een gelijke naam', () => {
  const oud = [{ who: 'Kim', text: 'Kim logde in', at: '2026-10-01T08:00:00.000Z' },
    { who: 'Kim', text: 'klokte in', at: '2026-10-01T08:01:00.000Z' },
    { who: 'Kim', text: 'Kim kwam binnen met het RTG-account', at: '2026-10-01T08:02:00.000Z' },
    { who: 'Kim', text: 'Kim wisselde naar deze werkplek', at: '2026-10-01T08:03:00.000Z' },
    { who: 'Kim', text: 'meldde zich aan op kaart NL-1', at: '2026-10-01T08:04:00.000Z' }];
  assert.deepEqual(zicht.logboekVoor(oud, { name: 'Kim', staffId: 7, manager: false }, 40).regels, []);
  assert.equal(zicht.logboekVoor(oud, { manager: true }, 40).regels.length, oud.length);
  // besluit A1: aan- en afmelden op een kant van de keukenlijn is ook een klokregel
  assert.equal(zicht.isKlokregel({ who: 'X', text: 'meldde zich aan op de kant warm', at: 'x' }), true);
});

test('2. beschermde regels drukken geen zichtbare regel van het logboek', async () => {
  const voor = (await state(odin.tok)).activity.map(r => r.text + '|' + r.at);
  assert.ok(voor.length >= 1, 'Odin ziet iets in het logboek');
  for (let i = 0; i < 84; i++) assert.equal((await api('/api/staff/clock', {}, kim1.tok)).status, 200);
  const na = (await state(odin.tok)).activity.map(r => r.text + '|' + r.at);
  assert.deepEqual(na, voor, '84 klokregels van Kim veranderden wat Odin ziet');
});

test('3. /api/auth/login en /api/supplier/mijn/login schrijven een beschermde inlogregel', async () => {
  const inlog = await api('/api/auth/login', { login: 'nora@rtg.example', password: 'werk' });
  assert.equal(inlog.status, 200, JSON.stringify(inlog.body).slice(0, 200));
  const plek = (inlog.body.werk || []).find(w => w.code === 'KIKUNOI' && w.token);
  assert.ok(plek, 'Nora heeft een open werkplek bij KIKUNOI');
  const mijn = await api('/api/supplier/mijn/login', { login: 'nora@rtg.example', password: 'werk', bedrijf: 'KIKUNOI' });
  assert.equal(mijn.status, 200);
  for (const [re, tok] of [[/ kwam binnen met het RTG-account$/, plek.token], [/ logde in \(RTG-account\)$/, mijn.body.token]]) {
    const m = (await managerLog()).find(r => re.test(r.text));
    assert.ok(m, 'de manager ziet de regel ' + re);
    assert.equal(m.soort, 'klok-inlog', 'de regel draagt de soort: ' + JSON.stringify(m));
    assert.ok(m.staffId != null, 'en het staffId van wie binnenkwam');
    assert.ok((await state(tok)).activity.some(r => re.test(r.text) && r.at === m.at), 'Nora ziet haar eigen regel');
    const o = await state(odin.tok);
    assert.ok(!o.activity.some(r => re.test(r.text)), 'Odin krijgt de regel niet');
    assert.ok(!JSON.stringify(o).includes(m.at), 'ook het tijdstip niet');
  }
});

test('4. het CDT-bord: begin en eind van een dienst alleen voor de manager en de chauffeur zelf', async () => {
  assert.equal((await api('/api/staff/mob/cdt/aanmelden', { chauffeurskaart: 'NL-11111111' }, ch1.tok)).status, 200);
  assert.equal((await api('/api/staff/mob/cdt/aanmelden', { chauffeurskaart: 'NL-22222222' }, ch2.tok)).status, 200);
  const bord = async (tok) => {
    const r = await api('/api/supplier/mob/cdt', {}, tok);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
    return r.body;
  };
  const m = await bord(baas);
  const d1 = m.lopend.find(d => d.chauffeurskaart === 'NL-11111111');
  const d2 = m.lopend.find(d => d.chauffeurskaart === 'NL-22222222');
  assert.ok(d1 && d2, 'de manager ziet beide diensten');
  for (const [ik, eigen, vreemd] of [[ch1, d1, d2], [ch2, d2, d1]]) {
    const b = await bord(ik.tok);
    assert.deepEqual(b.lopend.map(d => d.id), [eigen.id], 'een chauffeur ziet alleen zijn eigen dienst');
    assert.equal(b.lopend[0].start, eigen.start, 'met zijn eigen begin');
    const tekst = JSON.stringify(b);
    assert.ok(!tekst.includes(vreemd.start) && !tekst.includes(vreemd.chauffeurskaart), 'begin of kaart van een collega lekt');
    assert.ok(!(b.signalen || []).some(s => s.chauffeurskaart === vreemd.chauffeurskaart));
  }
  // M4: een chauffeur werkt niet op de kaart van een ander -- een manager wel
  assert.equal((await api('/api/staff/mob/cdt/soort', { chauffeurskaart: 'NL-11111111', soort: 'pauze' }, ch2.tok)).status, 404, 'soort op andermans kaart');
  assert.equal((await api('/api/staff/mob/cdt/afmelden', { chauffeurskaart: 'NL-11111111' }, ch2.tok)).status, 404, 'afmelden op andermans kaart');
  assert.equal((await api('/api/staff/mob/cdt/soort', { chauffeurskaart: 'NL-11111111', soort: 'pauze' }, ch1.tok)).status, 200, 'op de eigen kaart wel');
  assert.equal((await api('/api/staff/mob/cdt/soort', { chauffeurskaart: 'NL-11111111', soort: 'rijden' }, baas)).status, 200, 'de manager ook');
  // de aanmeldregel is een klokregel met een echte naam
  const r = (await api('/api/supplier/activity', { aantal: 80 }, baas)).body.activity.find(x => /^meldde zich aan op kaart NL-11111111/.test(x.text));
  assert.ok(r, 'de manager ziet de aanmelding');
  assert.equal(r.soort, 'klok-in');
  assert.equal(r.who, ch1.name, 'who is de naam van de chauffeur en niet undefined');
  assert.ok(!(await state(ch2.tok)).activity.some(x => x.at === r.at), 'een collega krijgt de aanmelding niet');
  assert.ok((await state(ch1.tok)).activity.some(x => x.at === r.at), 'de chauffeur zelf wel');
});

test('5. het klok-signaal van een klokcorrectie gaat alleen naar de managers en wie het betreft', async () => {
  const luister = async (tok, doe) => {
    const ac = new AbortController();
    const r = await fetch(H + '/api/supplier/stream?token=' + tok, { signal: ac.signal });
    const lezer = r.body.getReader(); let tekst = '';
    const lees = (async () => { try { for (;;) { const { value, done } = await lezer.read(); if (done) break; tekst += Buffer.from(value).toString(); } } catch (e) {} })();
    await new Promise(z => setTimeout(z, 300));
    await doe();
    await new Promise(z => setTimeout(z, 1200));
    ac.abort(); await lees;
    return tekst;
  };
  const corrigeer = () => {
    const uit = new Date(Date.now() - 3600000), inn = new Date(uit.getTime() - 3600000);
    return api('/api/staff/klok/correctie', { staffId: kim2.id, in: inn.toISOString(), uit: uit.toISOString() }, tokM)
      .then(r => assert.equal(r.status, 200, JSON.stringify(r.body)));
  };
  assert.doesNotMatch(await luister(odin.tok, corrigeer), /"scope":"klok"/, 'een collega krijgt het signaal van een correctie niet');
  assert.match(await luister(kim2.tok, corrigeer), /"scope":"klok"/, 'wie het betreft wel');
  assert.match(await luister(tokM, corrigeer), /"scope":"klok"/, 'de manager ook');
  // besturingsproef: in- en uitklokken blijft voor iedereen, want de aanwezigheid verandert zichtbaar
  assert.match(await luister(odin.tok, () => api('/api/staff/clock', {}, kim2.tok)), /"scope":"klok"/);
});
