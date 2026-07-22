/* Multi-instance: twee losse serverprocessen achter dezelfde gedeelde SQLite-
   opslag (store.db), zoals achter de poortwachter draaien. Elke top-level
   collectie is een rij met een oplopend versienummer; een korte achtergrondpoll
   (RTG_POLL_MS) haalt op wat een ANDER proces schreef. Deze test bewijst het
   contract waar failover en horizontaal schalen op rusten: een sessie en een
   betaling gemaakt op instance 1 worden consistent zichtbaar op instance 2, zonder
   dat er geld ontstaat of verdwijnt. Draai los:
   node --experimental-sqlite --test test/multi-instance-sqlite.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const api = (base, pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const saldo = (base, tok) => api(base, 'pay/overzicht', {}, tok).then(r => r.body.saldo);

async function login(base, tier) {
  const r = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier }) });
  const d = await r.json();
  const o = await api(base, 'pay/overzicht', {}, d.token);
  return { token: d.token, codenaam: o.body.codenaam };
}
// Pollt tot de verwachte waarde over de gedeelde opslag is doorgekomen (of faalt).
async function totdat(fn, verwacht, pogingen = 40) {
  for (let i = 0; i < pogingen; i++) { if (await fn() === verwacht) return true; await new Promise(r => setTimeout(r, 150)); }
  return (await fn()) === verwacht;
}

test('twee instanties delen een SQLite-opslag: een tik op instance 1 wordt consistent zichtbaar op instance 2', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-multi-'));
  const env = { RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '', SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_POLL_MS: '150' };
  let s1 = null, s2 = null;
  try {
    // --- instance 1: leden aanmaken, laden en een eerste tik, DAARNA pas instance 2 ---
    s1 = await startServer({ env });
    const A = await login(s1.base, 'rtg');
    const B = await login(s1.base, 'lifestyle');
    assert.ok(A.codenaam && B.codenaam && A.codenaam !== B.codenaam, 'twee leden met een eigen codenaam');
    await api(s1.base, 'pay/oplaad', { centen: 50000, idem: 'op-1' }, A.token);
    const t1 = await api(s1.base, 'pay/stuur', { aan: B.codenaam, centen: 5000, oms: 'eerste', idem: 'tik-1' }, A.token);
    assert.equal(t1.status, 200, 'de eerste tik op instance 1 lukt');

    // --- instance 2 start op DEZELFDE store.db: leest de bestaande staat bij boot ---
    s2 = await startServer({ env });
    // de token van instance 1 werkt op instance 2 (sessies staan in de gedeelde opslag)
    assert.equal(await saldo(s2.base, A.token), 45000, 'instance 2 kent A en zijn saldo na de eerste tik');
    assert.equal(await saldo(s2.base, B.token), 5000, 'instance 2 kent B en zijn saldo');

    // --- een NIEUWE tik op instance 1 moet via de poll op instance 2 landen ---
    const t2 = await api(s1.base, 'pay/stuur', { aan: B.codenaam, centen: 3000, oms: 'tweede', idem: 'tik-2' }, A.token);
    assert.equal(t2.status, 200, 'de tweede tik op instance 1 lukt');
    assert.ok(await totdat(() => saldo(s2.base, B.token), 8000), 'instance 2 ziet de tweede tik na de poll (B = 8000)');
    assert.equal(await saldo(s2.base, A.token), 42000, 'instance 2 ziet A afgeboekt (A = 42000)');

    // --- en andersom: een tik op instance 2 landt op instance 1 ---
    const t3 = await api(s2.base, 'pay/stuur', { aan: B.codenaam, centen: 2000, oms: 'derde', idem: 'tik-3' }, A.token);
    assert.equal(t3.status, 200, 'een tik op instance 2 lukt (dezelfde token, ander proces)');
    assert.ok(await totdat(() => saldo(s1.base, B.token), 10000), 'instance 1 ziet de tik van instance 2 (B = 10000)');

    // conservatie over beide instanties heen
    const a = await saldo(s1.base, A.token), b = await saldo(s1.base, B.token);
    assert.equal(a + b, 50000, 'geld-conservatie over twee instanties: ' + a + ' + ' + b);
  } finally {
    stop(s1 && s1.child);
    stop(s2 && s2.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
