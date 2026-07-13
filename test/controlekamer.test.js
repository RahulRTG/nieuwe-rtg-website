/* De controlekamer: de eigenaar zet functies aan/uit PER DOELGROEP op de
   beveiligde technische pagina. Bewijs dat een functie uit kan voor de ene
   doelgroep (bijv. Business-leden) en tegelijk aan blijft voor de andere
   (RTG-leden), dat alles via de aanvraag/bevestigingsstroom loopt, en dat de
   ingebouwde AI-hulp een bruikbaar voorstel teruggeeft.
   Draai: node --experimental-sqlite --test test/controlekamer.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 4910 + Math.floor(Math.random() * 60);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ck-'));
let child, rtgToken, bizToken, techToken;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  child = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '' },
    stdio: ['ignore', 'ignore', 'inherit']
  });
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) break; } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }
  const rtg = await json(await api('/api/auth/register', { name: 'RTG Lid', email: 'rtg@x.nl', phone: '0612345700',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' }));
  rtgToken = rtg.token;
  const biz = await json(await api('/api/auth/register', { name: 'Zaak Lid', email: 'biz@x.nl', phone: '0612345701',
    password: 'geheim123', geboortedatum: '1985-01-01', tier: 'business', pasApp: 'business' }));
  bizToken = biz.token;
  techToken = (await json(await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' }))).token;
  assert.ok(techToken, 'de eigenaar komt op de technische pagina');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een functie uit voor Business-leden laat RTG-leden ongemoeid', async () => {
  // vooraf: beide leden kunnen de ledenfunctie gebruiken
  assert.equal((await api('/api/member/connections', {}, rtgToken)).status, 200);
  assert.equal((await api('/api/member/connections', {}, bizToken)).status, 200);

  // de eigenaar vraagt aan: leden-app UIT voor de doelgroep Business
  const vz = await json(await api('/api/techniek/functie', { id: 'member', doelgroep: 'business', aan: false }, techToken));
  assert.equal(vz.status, 'wacht', 'niets gaat direct om; het wordt een aanvraag');
  assert.ok(vz.verzoekId);
  assert.match(vz.label, /Business/);

  // zolang de aanvraag niet is bevestigd, verandert er niets
  assert.equal((await api('/api/member/connections', {}, bizToken)).status, 200);

  // de eigenaar bevestigt
  const besluit = await json(await api('/api/techniek/functie/besluit', { verzoekId: vz.verzoekId, akkoord: true }, techToken));
  assert.equal(besluit.status, 'akkoord');

  // nu is de leden-app dicht voor het Business-lid, maar open voor het RTG-lid
  const dichtBiz = await api('/api/member/connections', {}, bizToken);
  assert.equal(dichtBiz.status, 503, 'Business-lid geblokkeerd');
  assert.equal((await dichtBiz.json()).functie, 'member');
  assert.equal((await api('/api/member/connections', {}, rtgToken)).status, 200, 'RTG-lid werkt gewoon door');
});

test('het statusbord toont de doelgroepen en de per-doelgroep-stand', async () => {
  const st = await json(await (await fetch(BASE + '/api/techniek/status', { headers: { Authorization: 'Bearer ' + techToken } })));
  assert.ok(Array.isArray(st.doelgroepen) && st.doelgroepen.some(d => d.id === 'business'), 'doelgroepen zijn er');
  const member = st.functies.flatMap(g => g.functies).find(f => f.id === 'member');
  assert.ok(member, 'de leden-app staat in de catalogus');
  assert.equal(member.aan, true, 'globaal staat de leden-app nog aan');
  const biz = member.doelgroepen.find(d => d.id === 'business');
  const rtg = member.doelgroepen.find(d => d.id === 'rtg');
  assert.equal(biz.aan, false, 'uit voor Business');
  assert.equal(rtg.aan, true, 'aan voor RTG');
  assert.ok(st.doelgroepUit >= 1, 'de teller van per-doelgroep-beperkingen loopt mee');
});

test('de AI-hulp geeft een bruikbaar voorstel in gewone taal', async () => {
  const d = await json(await api('/api/techniek/functie/ai', { vraag: 'zet de sociale laag uit voor lifestyle' }, techToken));
  assert.ok(d.antwoord, 'er komt een antwoord terug');
  assert.ok(Array.isArray(d.voorstel) && d.voorstel.some(w => w.id === 'social' && w.doelgroep === 'lifestyle' && w.aan === false),
    'het voorstel zet de sociale laag uit voor Lifestyle');
});
