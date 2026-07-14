/* De zwaarste integratietest tot nu toe: TWEE server-instances (A en B) die één
   echte PostgreSQL-store én één Redis-bus delen, en samen een volledige,
   gelijktijdige reis over meerdere genres afhandelen. Bewijst in één keer:

   1. twee instances starten gezond op dezelfde gedeelde waarheid (PG) + bus (Redis);
   2. CONCURRENCY: tientallen leden die tegelijk over beide instances registreren
      landen allemaal in de Postgres-ledengids (member_dir), en het O(1)-ledental
      klopt;
   3. cross-instance DATA: een lid dat op A is aangemaakt, is op B vindbaar via de
      geindexeerde gids;
   4. cross-instance REALTIME A -> B: een betaalde bestelling op A bereikt via de
      Redis-bus de leverancier-SSE op B (routering op leverancierscode);
   5. cross-instance REALTIME B -> A: de leverancier zet op B de status door en het
      lid ziet dat live op A (routering op pas/tier);
   6. cross-instance STORE: het kantoor op B ziet de bestelling die op A is geplaatst
      (Postgres-write-behind + poll), en de totalen kloppen;
   7. betaal-IDEMPOTENTIE onder race: twee gelijktijdige betalingen op dezelfde
      bestelling geven precies een keer succes en een keer 409;
   8. de volledige reis: rit aanvragen + betalen, live onderweg met aankomst, en
      videobel-signalering (WebRTC-ring) tussen twee verbonden leden.

   Draait alleen met DATABASE_URL EN REDIS_URL gezet (anders overgeslagen):
     DATABASE_URL=postgresql://postgres@127.0.0.1:5433/rtggrand \
     REDIS_URL=redis://127.0.0.1:6399 \
     node --experimental-sqlite --test test/grand-integratie.pg.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const HEEFT_PG = !!(process.env.DATABASE_URL || process.env.PG_URL);
const HEEFT_REDIS = !!process.env.REDIS_URL;
const OVERSLAAN = (HEEFT_PG && HEEFT_REDIS)
  ? false
  : 'vereist DATABASE_URL EN REDIS_URL (twee instances + gedeelde bus)';

const sleep = ms => new Promise(r => setTimeout(r, ms));

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
function getJson(base, pad) {
  return fetch(base + pad).then(r => r.json());
}

// Poll tot de conditie waar is (of een timeout). Geeft de laatste waarde terug.
async function tot(fn, pred, { pogingen = 40, wacht = 150 } = {}) {
  let v;
  for (let i = 0; i < pogingen; i++) {
    v = await fn();
    if (pred(v)) return v;
    await sleep(wacht);
  }
  return v;
}

// Open een SSE-verbinding en verzamel de events in een array die live meegroeit.
async function openSSE(url) {
  const ctrl = new AbortController();
  const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'text/event-stream' } });
  if (!res.ok) { ctrl.abort(); throw new Error('SSE-open faalde: ' + res.status); }
  const events = [];
  (async () => {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, idx); buf = buf.slice(idx + 2);
          let ev = 'message', data = '';
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) ev = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (!data && ev === 'message') continue; // ping/commentaar
          let parsed = null; try { parsed = data ? JSON.parse(data) : null; } catch (e) {}
          events.push({ event: ev, data: parsed });
        }
      }
    } catch (e) { /* afgebroken bij close */ }
  })();
  return {
    events,
    close: () => { try { ctrl.abort(); } catch (e) {} },
    async wachtOp(pred, ms = 8000) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        const hit = events.find(pred);
        if (hit) return hit;
        await sleep(50);
      }
      throw new Error('SSE-event niet ontvangen binnen ' + ms + 'ms (ontvangen: ' +
        events.map(e => e.event + (e.data && e.data.scope ? '/' + e.data.scope : '')).join(', ') + ')');
    }
  };
}

// Registreer een lid en wacht tot zijn sessie oplost (de account-spiegel kan in
// Postgres-modus kort achterlopen op de registratie). Geeft { token, codename, key }.
let _seq = 0;
async function nieuwLid(base, tier = 'business') {
  const u = (Date.now() + (++_seq)).toString().slice(-8);
  const reg = await api(base, '/api/auth/register', {
    name: 'Lid ' + u, email: 'l' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-01-01', tier, pasApp: tier
  });
  assert.ok(reg.body.token, 'registratie geeft een token (status ' + reg.status + ')');
  const token = reg.body.token;
  const st = await tot(() => api(base, '/api/state', {}, token),
    r => r.body && r.body.state && r.body.state.user, { pogingen: 40, wacht: 150 });
  assert.ok(st.body && st.body.state && st.body.state.user, 'lid-sessie lost op');
  return { token, codename: st.body.state.user.codename, key: st.body.state.user.key || null };
}

// Leverancier-demo-login (KIKUNOI) op een instance. Geeft { token, code }.
async function leverancierLogin(base) {
  const r = await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
  assert.ok(r.body.token, 'leverancier-login geeft een token (status ' + r.status + ')');
  const st = await api(base, '/api/supplier/state', {}, r.body.token);
  return { token: r.body.token, code: st.body.state.supplier.code };
}

test('GRAND: twee instances op gedeelde Postgres + Redis, volledige gelijktijdige reis',
  { skip: OVERSLAAN }, async (t) => {

  // Elke instance een eigen lokale datamap (de gedeelde waarheid staat in Postgres);
  // DATABASE_URL en REDIS_URL erven van het proces, zodat A en B echt delen.
  const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-A-'));
  const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-B-'));
  const A = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dirA, RTG_SERVER: '1' } });
  const B = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dirB, RTG_SERVER: '2' } });
  const streams = [];

  try {
    await t.test('1. beide instances zijn gezond en delen Redis + Postgres', async () => {
      const ra = await getJson(A.base, '/api/ready');
      const rb = await getJson(B.base, '/api/ready');
      assert.equal(ra.ready, true, 'A is ready');
      assert.equal(rb.ready, true, 'B is ready');
      assert.equal(ra.redis, 'geconfigureerd', 'A gebruikt Redis');
      assert.equal(rb.redis, 'geconfigureerd', 'B gebruikt Redis');
    });

    // Kantoor-baseline (via A).
    const office = (await api(A.base, '/api/office/login', { code: 'RTG-OFFICE' })).body;
    assert.ok(office.token, 'kantoor-login geeft een token');
    const totVoor = (await api(A.base, '/api/office/state', {}, office.token)).body.state.totals;

    let leden = [];
    await t.test('2. concurrency: 24 leden tegelijk over A en B -> allen in de PG-gids', async () => {
      const taken = [];
      for (let i = 0; i < 24; i++) taken.push(nieuwLid(i % 2 === 0 ? A.base : B.base));
      leden = await Promise.all(taken);
      assert.equal(leden.length, 24, 'alle 24 registraties slaagden');
      assert.equal(new Set(leden.map(l => l.codename)).size, 24, 'elk lid heeft een unieke codenaam');

      // Het O(1)-ledental (Postgres-telling) is met ~24 gestegen. Poll: de gids
      // wordt kort na de upsert bijgewerkt en de telling gecachet.
      const na = await tot(
        async () => (await api(A.base, '/api/office/state', {}, office.token)).body.state.totals.leden,
        n => n >= totVoor.leden + 24, { pogingen: 60, wacht: 200 });
      assert.ok(na >= totVoor.leden + 24, 'ledental steeg met >= 24 (' + totVoor.leden + ' -> ' + na + ')');
    });

    await t.test('3. cross-instance data: een lid van A is op B vindbaar via de PG-gids', async () => {
      const opA = leden.find((l, i) => i % 2 === 0); // op A geregistreerd
      const zoekerOpB = leden.find((l, i) => i % 2 === 1); // op B geregistreerd
      const gevonden = await tot(
        async () => (await api(B.base, '/api/member/find', { q: opA.codename }, zoekerOpB.token)).body.results || [],
        rs => rs.some(r => r.codename === opA.codename), { pogingen: 40, wacht: 200 });
      assert.ok(gevonden.some(r => r.codename === opA.codename),
        'B vindt het op A aangemaakte lid "' + opA.codename + '" via de geindexeerde gids');
    });

    // Zelfde leverancier (KIKUNOI) op BEIDE instances: het menu zetten we op A
    // (waar de koper bestelt, zodat A het gerecht meteen kent), en de SSE openen
    // we op B. De bestelling straks op A -> de melding moet via Redis op B komen.
    const supA = await leverancierLogin(A.base);
    const supB = await leverancierLogin(B.base);
    await api(A.base, '/api/supplier/menu', { menu: [
      { id: 'ramen', name: 'Tonkotsu Ramen', price: 22, cat: 'Warm', station: 'keuken', sectie: 'warm' }
    ] }, supA.token);
    const supStream = await openSSE(B.base + '/api/supplier/stream?token=' + encodeURIComponent(supB.token));
    streams.push(supStream);

    const koper = leden[0]; // op A geregistreerd
    const koperStream = await openSSE(A.base + '/api/stream?token=' + encodeURIComponent(koper.token));
    streams.push(koperStream);

    let orderRef = null;
    await t.test('4. cross-instance realtime A -> B: betaalde bestelling op A bereikt leverancier-SSE op B', async () => {
      const plaats = await api(A.base, '/api/order', { supplierCode: supA.code, items: [{ id: 'ramen', qty: 2 }] }, koper.token);
      assert.equal(plaats.status, 200, 'bestelling geplaatst op A (' + JSON.stringify(plaats.body).slice(0, 120) + ')');
      orderRef = plaats.body.order.ref;
      assert.equal(plaats.body.order.total, 44, 'totaal = 2 x 22');

      const betaal = await api(A.base, '/api/order/pay', { ref: orderRef }, koper.token);
      assert.equal(betaal.status, 200, 'betaald op A');
      assert.equal(betaal.body.order.paid, true);

      // De leverancier draait op B; de betaalmelding moet via de Redis-bus over.
      const ev = await supStream.wachtOp(e =>
        (e.event === 'notify' && /betaald/i.test(JSON.stringify(e.data || {}))) ||
        (e.event === 'sync' && e.data && e.data.scope === 'orders'), 9000);
      assert.ok(ev, 'leverancier op B ontving de bestelling van A via Redis: ' + ev.event);
    });

    await t.test('5. cross-instance realtime B -> A: statuswijziging op B is live op A', async () => {
      // B moet de op A geplaatste bestelling eerst uit Postgres hebben gesynct
      await tot(async () => (await api(B.base, '/api/supplier/state', {}, supB.token)).body.state.orders || [],
        os => os.some(o => o.ref === orderRef), { pogingen: 50, wacht: 200 });
      const zet = await api(B.base, '/api/supplier/order/status', { ref: orderRef, status: 'in bereiding' }, supB.token);
      assert.equal(zet.status, 200, 'leverancier op B zette status door (' + JSON.stringify(zet.body).slice(0, 100) + ')');
      const ev = await koperStream.wachtOp(e =>
        (e.event === 'sync' && e.data && e.data.scope === 'orders') ||
        (e.event === 'notify' && /bereiding/i.test(JSON.stringify(e.data || {}))), 9000);
      assert.ok(ev, 'het lid op A kreeg de statuswijziging van B live: ' + ev.event);
    });

    await t.test('6. cross-instance store: kantoor op B ziet de op A geplaatste bestelling', async () => {
      const gezien = await tot(
        async () => (await api(B.base, '/api/office/state', {}, (await api(B.base, '/api/office/login', { code: 'RTG-OFFICE' })).body.token)).body.state.orders || [],
        os => os.some(o => o.ref === orderRef), { pogingen: 50, wacht: 200 });
      assert.ok(gezien.some(o => o.ref === orderRef),
        'de bestelling van A is via de gedeelde Postgres-store op B zichtbaar');
    });

    await t.test('7. betaal-idempotentie onder race: dubbel betalen geeft 1x succes, 1x 409', async () => {
      // nieuwe vooraf-bestelling (status wacht-op-betaling), dan twee betalingen tegelijk
      const plaats = await api(A.base, '/api/order', { supplierCode: supB.code, items: [{ id: 'ramen', qty: 1 }] }, koper.token);
      const ref = plaats.body.order.ref;
      assert.equal(plaats.body.order.status, 'wacht-op-betaling', 'vooraf betalen: wacht-op-betaling');
      const [p1, p2] = await Promise.all([
        api(A.base, '/api/order/pay', { ref }, koper.token),
        api(A.base, '/api/order/pay', { ref }, koper.token)
      ]);
      const statussen = [p1.status, p2.status].sort();
      assert.deepEqual(statussen, [200, 409], 'precies een betaling slaagt, de andere krijgt 409 (dubbel)');
    });

    await t.test('8. reis: rit aanvragen + betalen bij een vervoerspartner', async () => {
      // een vervoerspartner met rides-cap dynamisch vinden uit de kantoor-suppliers
      const offB = (await api(A.base, '/api/office/state', {}, office.token)).body.state;
      const vervoer = (offB.suppliers || []).find(s => (s.caps || []).includes('rides'));
      assert.ok(vervoer, 'er is een vervoerspartner met rides-capability geseed');
      const rit = await api(A.base, '/api/ride/request', { supplierCode: vervoer.code, passengers: 2 }, koper.token);
      assert.equal(rit.status, 200, 'ritaanvraag geaccepteerd (' + vervoer.type + ')');
      const r = rit.body.ride;
      if (r.status === 'wacht-op-betaling') {
        const betaal = await api(A.base, '/api/ride/pay', { ref: r.ref }, koper.token);
        assert.equal(betaal.status, 200, 'rit betaald');
        assert.equal(betaal.body.ride.paid, true);
      } else {
        assert.equal(r.status, 'aangevraagd', 'gratis/achteraf-rit staat meteen aangevraagd');
      }
    });

    await t.test('9. reis: live onderweg met automatische aankomst', async () => {
      const start = await api(A.base, '/api/live/start', { destCode: supB.code }, koper.token);
      assert.equal(start.status, 200, 'onderweg gestart naar de bestemming');
      assert.equal(start.body.live.active, true);
      // precies op de bestemming: binnen ~150 m -> automatische aankomst
      const dest = (start.body.live.dest || start.body.live.partners.find(p => p.code === supB.code));
      assert.ok(dest && dest.loc, 'de bestemming heeft een locatie');
      const upd = await api(A.base, '/api/live/update', { lat: dest.loc.lat, lng: dest.loc.lng }, koper.token);
      assert.equal(upd.status, 200);
      assert.equal(upd.body.live.arrived, true, 'het lid is automatisch gearriveerd');
    });

    await t.test('10. videobel-signalering: twee verbonden leden, een ring komt live aan', async () => {
      // twee leden die allebei op A thuishoren, zodat de connectie consistent is
      const X = leden[0]; // koper, op A
      const Y = leden[2]; // ook op A (index even)
      // X vindt Y op codenaam -> Y's gids-sleutel
      const zoek = await tot(
        async () => (await api(A.base, '/api/member/find', { q: Y.codename }, X.token)).body.results || [],
        rs => rs.some(r => r.codename === Y.codename), { pogingen: 30, wacht: 200 });
      const Ytreffer = zoek.find(r => r.codename === Y.codename);
      assert.ok(Ytreffer, 'X vindt Y op codenaam');
      // X vraagt de connectie aan; Y accepteert
      const c1 = await api(A.base, '/api/member/connect', { key: Ytreffer.key }, X.token);
      assert.equal(c1.status, 200, 'connectieverzoek verstuurd (' + c1.status + ': ' + JSON.stringify(c1.body) + ')');
      // Y vindt X terug (voor X's sleutel) en accepteert
      const zoekX = await tot(
        async () => (await api(A.base, '/api/member/find', { q: X.codename }, Y.token)).body.results || [],
        rs => rs.some(r => r.codename === X.codename), { pogingen: 30, wacht: 200 });
      const Xtreffer = zoekX.find(r => r.codename === X.codename);
      const resp = await api(A.base, '/api/member/connect/respond', { key: Xtreffer.key, action: 'accept' }, Y.token);
      assert.equal(resp.status, 200, 'Y accepteert de connectie');

      // Y opent zijn live-kanaal; X belt (WebRTC-ring). De server is enkel signalering.
      const yStream = await openSSE(A.base + '/api/stream?token=' + encodeURIComponent(Y.token));
      streams.push(yStream);
      await sleep(150);
      const bel = await api(A.base, '/api/member/call', { toKey: Ytreffer.key, kind: 'ring', video: true }, X.token);
      assert.equal(bel.status, 200, 'X stuurt een videobel-ring');
      const ev = await yStream.wachtOp(e => e.event === 'call' && e.data && e.data.kind === 'ring', 8000);
      assert.equal(ev.data.video, true, 'Y ontvangt de inkomende videobel-ring van X');
    });

  } finally {
    for (const s of streams) s.close();
    await sleep(100);
    stop(A.child); stop(B.child);
    try { fs.rmSync(dirA, { recursive: true, force: true }); } catch (e) {}
    try { fs.rmSync(dirB, { recursive: true, force: true }); } catch (e) {}
  }
});
