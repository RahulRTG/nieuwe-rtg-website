/* De Berichten-app (routes/member/berichten.js): alle gesprekken van het
   platform op een plek -- Rahul, de Berichtenbox van MijnOverheid en de
   Pulse-reacties (de vrienden-DM's en werk-chats liften op dezelfde lijst mee).
   Draai los: node --experimental-sqlite --test test/berichten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-berichten-'));
const raw = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
});
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let teller = 0;
async function lid() {
  const t = Date.now() + '' + (teller++);
  const r = await json(await raw('/auth/register', { name: 'Lid ' + t, email: 'm' + t + '@v.test', phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-02-02', tier: 'rtg' }));
  return r.token;
}

test('alle bronnen komen op een plek samen: Rahul, de Berichtenbox en Pulse-reacties', async () => {
  const a = await lid(), b = await lid();
  // 1. praat met Rahul in de leden-app
  await raw('/chat/send', { text: 'Hoi Rahul, wat staat er vandaag op de planning?' }, a);
  // 2. doe een aangifte -> de Belastingdienst zet een bericht in de Berichtenbox
  await raw('/overheid/aangifte', { inkomen: 40000, ingehouden: 15000 }, a);
  // 3. plaats een Pulse-bericht en laat B erop reageren
  const p = await json(await raw('/member/pulse/post', { tekst: 'Wie is er dit weekend op het eiland?' }, a));
  await raw('/member/pulse/reactie', { id: p.post.id, tekst: 'Ik ben er, tot zondag!' }, b);

  const d = await json(await raw('/member/berichten', {}, a));
  assert.ok(d.ok && Array.isArray(d.kanalen));
  const soorten = d.kanalen.map(k => k.soort);
  assert.ok(soorten.includes('rahul'), 'het Rahul-gesprek staat erin');
  assert.ok(soorten.includes('overheid'), 'de Berichtenbox van MijnOverheid staat erin');
  assert.ok(soorten.includes('pulse'), 'de Pulse-reacties staan erin');
  // de Berichtenbox telt ongelezen mee in het totaal
  assert.ok(d.ongelezen >= 1, 'ongelezen overheidsberichten tellen mee');
  // elk kanaal draagt een deep link naar de bron-app
  for (const k of d.kanalen) assert.ok(k.link && k.link.startsWith('/apps/'), 'kanaal ' + k.soort + ' linkt naar de bron-app');
  // de lijst is op tijd gesorteerd (nieuwste eerst)
  const tijden = d.kanalen.map(k => k.at || '');
  assert.deepEqual([...tijden].sort().reverse(), tijden, 'nieuwste gesprek bovenaan');
});

test('zonder inloggen geen berichten (401)', async () => {
  assert.equal((await raw('/member/berichten', {}, null)).status, 401);
});
