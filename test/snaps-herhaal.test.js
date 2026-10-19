/* Een snap met een herhaalsleutel gaat een keer weg, ook bij twee gelijktijdige
   tikken en na een crash (19 oktober 2026). De voltooiproef van os:snaps zag
   dezelfde tik na een crash twee snaps bij de vriend leggen. Dezelfde sleutel
   met een andere tekst is een conflict.

   Draai los: node --test test/snaps-herhaal.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-snapherhaal-'));
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
let child, BASE;
const roep = async (pad, body, token) => {
  const r = await fetch(BASE + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) });
  let d = null; try { d = await r.json(); } catch (e) {}
  return { status: r.status, d };
};
const start = async () => { ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } })); };
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});
async function lid(n) {
  const t = Date.now() + '' + n + Math.floor(Math.random() * 1e3);
  const r = await roep('/api/auth/register', { name: 'Lid ' + t, email: 'sh' + t + '@v.test',
    phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1980-05-05', tier: 'rtg' });
  return r.d.token;
}

test('dezelfde snap met dezelfde sleutel komt een keer aan, ook tegelijk en na een crash; een andere tekst is 409', async () => {
  await start();
  const A = await lid(1), B = await lid(2);
  const ca = (await roep('/api/member/connections', {}, A)).d, cb = (await roep('/api/member/connections', {}, B)).d;
  const f = await roep('/api/member/find', { q: cb.codename }, A);
  await roep('/api/member/connect', { key: f.d.results.find((x) => x.codename === cb.codename).key }, A);
  assert.equal((await roep('/api/member/connect/respond', { key: ca.me, action: 'accept' }, B)).status, 200);
  const lijf = (tekst, idem) => ({ toKey: cb.me, foto: PIXEL, tekst, idem });
  const tel = async (tekst) => ((await roep('/api/member/snaps', {}, B)).d.snaps || []).filter((s) => s.tekst === tekst).length;
  const [x, y] = await Promise.all([roep('/api/member/snap/send', lijf('tegelijk', 'snap-tegelijk-0001'), A),
    roep('/api/member/snap/send', lijf('tegelijk', 'snap-tegelijk-0001'), A)]);
  assert.equal(x.status, 200); assert.equal(y.status, 200);
  assert.equal(await tel('tegelijk'), 1, 'twee gelijktijdige tikken met een sleutel horen een snap te geven');
  assert.equal((await roep('/api/member/snap/send', lijf('crash', 'snap-crash-0001'), A)).status, 200);
  child.kill('SIGKILL');
  await new Promise((r) => child.once('exit', r));
  await start();
  assert.equal((await roep('/api/member/snap/send', lijf('crash', 'snap-crash-0001'), A)).status, 200);
  assert.equal(await tel('crash'), 1, 'na een crash hoort dezelfde tik geen tweede snap te geven');
  assert.equal((await roep('/api/member/snap/send', lijf('anders', 'snap-crash-0001'), A)).status, 409);
  assert.equal(await tel('anders'), 0);
  assert.equal((await roep('/api/member/snap/send', lijf('zonder sleutel'), A)).status, 200, 'zonder sleutel blijft het oude gedrag');
});
