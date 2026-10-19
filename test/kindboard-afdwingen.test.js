/* WAT EEN OUDER OP HET BORD VAN ZIJN KIND UITZET, IS OOK ECHT DICHT.

   Gevonden bij de domeinkaart van FoundationOS (Vrienden, 19 oktober 2026): de
   ouder beheert het bord van een beschermd kind (/api/rtf/social/kind/boardroom/
   zet, met de RTF-handle van het kind als sleutel), maar de handhaving van het
   bord zit in de ledenpoort (opzet/diensten2.js, padFunctie) en de vriendenlaag
   van de RTFoundation loopt op /api/rtf/social/*, op de gezinssessie. Deze
   toets meet of "Directe berichten" uit voor een kind ook betekent dat het kind
   geen bericht meer stuurt of leest, en dat het weer kan als de ouder hem
   aanzet. Draai los: node --test test/kindboard-afdwingen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-kindbord-'));
const post = (pad, body, tok) => fetch(BASE + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}), body: JSON.stringify(body || {}) })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const soc = (pad, body) => post('/api/rtf/social' + pad, body);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
});
test.after(() => { if (child) try { child.kill('SIGKILL'); } catch (e) {} try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('"Directe berichten" uit op het bord van een kind: geen bericht sturen of lezen; aan: weer wel', async () => {
  const t = Date.now().toString(36);
  const g = (await post('/api/foundation/gezin/maak', { gezinsnaam: 'Bord ' + t, naam: 'Ouder ' + t, pin: '1234' })).body;
  const kind = (await post('/api/foundation/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Tiener', rol: 'gezinslid', groep: 'tiener' })).body;
  const kidToken = (await post('/api/foundation/gezin/profiel/kies', { gezinscode: g.gezinscode, profielId: kind.profiel.id })).body.token;
  const K = { code: g.code, token: kidToken };
  const kidHandle = (await soc('/connections', K)).body.me;
  const reg = (await post('/api/auth/register', { name: 'Tante ' + t, email: 'tante' + t + '@voorbeeld.test', phone: '0611122233', password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg' })).body;
  const st = (await post('/api/state', {}, reg.token)).body;
  assert.equal((await soc('/oudervoeg', { code: g.code, token: g.token, kindHandle: kidHandle, codenaam: st.state.user.codename })).status, 200);
  await post('/api/member/connect/respond', { key: kidHandle, action: 'accept' }, reg.token);
  const tante = (await soc('/connections', K)).body.connections[0].key;
  assert.equal((await soc('/dm/send', Object.assign({ toKey: tante, text: 'hoi voor' }, K))).status, 200, 'voor het uitzetten kan het kind chatten');

  const uit = await soc('/kind/boardroom/zet', { code: g.code, token: g.token, kindHandle: kidHandle, id: 'dm', aan: false });
  assert.equal(uit.status, 200, 'de ouder zet Directe berichten uit');
  const stuur = await soc('/dm/send', Object.assign({ toKey: tante, text: 'hoi na' }, K));
  const lees = await soc('/dm', Object.assign({ withKey: tante, metKey: tante, key: tante }, K));
  assert.equal(stuur.status, 403, 'met Directe berichten uit stuurt het kind toch een bericht (' + stuur.status + ')');
  assert.equal(lees.status, 403, 'met Directe berichten uit leest het kind toch berichten (' + lees.status + ')');

  await soc('/kind/boardroom/zet', { code: g.code, token: g.token, kindHandle: kidHandle, id: 'dm', aan: true });
  assert.equal((await soc('/dm/send', Object.assign({ toKey: tante, text: 'hoi weer' }, K))).status, 200, 'na weer aanzetten kan het kind chatten');
});
