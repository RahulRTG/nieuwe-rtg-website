/* De "sloophamer": de chaos-intentie van een aangeleverde test, maar dan tegen
   de ECHTE architectuur van dit platform (twee kind-processen op een gedeelde
   Postgres + Redis, echte HTTP-endpoints), niet tegen een verzonnen in-proces
   API. Drie beproevingen:

   1. Spitsuur-stormloop: honderden gelijktijdige acties (registraties, geo-
      updates onderweg, bestellingen + betalingen, leesverzoeken) verdeeld over
      A en B. De server mag onder die druk geen enkele 5xx-crash geven en moet
      daarna nog gezond zijn.
   2. Netwerk-sabotage: midden in een actieve realtime-datastroom bevriezen we
      eerst Redis en dan Postgres (SIGSTOP), en herstellen daarna (SIGCONT). Het
      platform draait op een write-behind cache met een in-proces-bus-fallback,
      dus de HTTP-laag moet gewoon blijven werken tijdens de storing en volledig
      herstellen erna.
   3. Betaalrace: twee gelijktijdige betalingen op exact dezelfde bestelling
      geven precies een keer succes en een keer 409 (geen dubbele afschrijving).

   Draait alleen met DATABASE_URL EN REDIS_URL gezet (anders overgeslagen):
     DATABASE_URL=postgresql://postgres@127.0.0.1:5433/rtggrand \
     REDIS_URL=redis://127.0.0.1:6399 \
     node --experimental-sqlite --test test/sloophamer.pg.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { startServer, stop } = require('./helper');

const HEEFT_PG = !!(process.env.DATABASE_URL || process.env.PG_URL);
const HEEFT_REDIS = !!process.env.REDIS_URL;
const OVERSLAAN = (HEEFT_PG && HEEFT_REDIS) ? false
  : 'vereist DATABASE_URL EN REDIS_URL (twee instances + gedeelde bus)';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const jitter = () => Math.random() * 120;

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const health = base => fetch(base + '/api/health').then(r => r.json()).catch(() => null);

// een proces met SIGSTOP bevriezen / met SIGCONT hervatten (netwerk-partitie)
function seinNaar(patroon, sig) {
  try { execSync('pkill -' + sig + ' -x ' + patroon, { stdio: 'ignore' }); return true; }
  catch (e) { return false; } // pkill geeft exit 1 als er niets matchte
}

let seq = 0;
async function nieuwLid(base) {
  const u = (Date.now() + (++seq)).toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const reg = await api(base, '/api/auth/register', { name: 'Chaos', email: 'c' + u + '@x.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
  if (!reg.body.token) return null;
  return reg.body.token;
}

test('SLOOPHAMER: stormloop, netwerk-sabotage en betaalrace op gedeelde PG + Redis',
  { skip: OVERSLAAN }, async (t) => {

  const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sl-A-'));
  const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sl-B-'));
  const A = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dirA } });
  const B = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dirB } });

  // leverancier (KIKUNOI) op A: menu klaarzetten zodat bestellingen slagen
  const supLogin = await api(A.base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
  const supCode = (await api(A.base, '/api/supplier/state', {}, supLogin.body.token)).body.state.supplier.code;
  await api(A.base, '/api/supplier/menu', { menu: [{ id: 'ramen', name: 'Ramen', price: 18, publiekePrijs: 18, cat: 'Warm', station: 'keuken', sectie: 'warm' }] }, supLogin.body.token);

  t.after(() => {
    // laat de infra draaien zoals we hem vonden
    seinNaar('postgres', 'CONT'); seinNaar('redis-server', 'CONT');
    stop(A.child); stop(B.child);
    try { fs.rmSync(dirA, { recursive: true, force: true }); } catch (e) {}
    try { fs.rmSync(dirB, { recursive: true, force: true }); } catch (e) {}
  });

  // een pool ingelogde leden die tijdens de storm hergebruikt wordt (registreren
  // kost scrypt-tijd; dat doen we niet 300x, wel realistisch vaak)
  const pool = [];
  for (let i = 0; i < 10; i++) { const tk = await nieuwLid(i % 2 ? B.base : A.base); if (tk) pool.push({ base: i % 2 ? B.base : A.base, token: tk }); }
  assert.ok(pool.length >= 8, 'basis-pool van leden opgezet');
  // een paar leden onderweg zetten zodat geo-updates iets te doen hebben
  for (const p of pool.slice(0, 6)) await api(p.base, '/api/live/start', { destCode: supCode }, p.token);

  await t.test('1. spitsuur: 300 gelijktijdige acties over A + B, geen enkele 5xx-crash', async () => {
    const N = 300;
    const codes = [];
    const taken = Array.from({ length: N }).map(async (_, i) => {
      await sleep(jitter());
      const base = i % 2 === 0 ? A.base : B.base;
      const p = pool[i % pool.length];
      try {
        let r;
        if (i % 5 === 0) r = { status: (await nieuwLid(base)) ? 200 : 500 };          // registreren (schrijfpad + gids)
        else if (i % 5 === 1) r = await api(p.base, '/api/live/update', { lat: 38.9 + Math.random() * 0.1, lng: 1.4 + Math.random() * 0.1 }, p.token); // geo onderweg
        else if (i % 5 === 2) { const o = await api(p.base, '/api/order', { supplierCode: supCode, items: [{ id: 'ramen', qty: 1 }] }, p.token);
          if (o.body.order) await api(p.base, '/api/order/pay', { ref: o.body.order.ref }, p.token); r = o; }            // bestellen + betalen
        else if (i % 5 === 3) r = await api(p.base, '/api/suppliers', {}, p.token);    // lezen
        else r = await api(p.base, '/api/state', {}, p.token);                          // lezen
        codes.push(r.status);
        return r.status;
      } catch (err) {
        codes.push('THROW:' + err.message);
        throw err; // transport-fout = de server viel echt om
      }
    });
    const res = await Promise.allSettled(taken);
    const transportFouten = res.filter(r => r.status === 'rejected').length;
    const serverCrashes = codes.filter(c => typeof c === 'number' && c >= 500).length;
    const ok2xx = codes.filter(c => typeof c === 'number' && c < 300).length;
    console.log('    stormloop:', ok2xx + '/' + N, 'gelukt,', serverCrashes, '5xx,', transportFouten, 'transport-fouten');
    assert.equal(transportFouten, 0, 'geen enkele verbinding brak (server bleef bereikbaar)');
    assert.equal(serverCrashes, 0, 'geen enkele 5xx-crash onder spits-druk');
    // en beide instances zijn daarna nog kerngezond
    assert.equal((await health(A.base)).ok, true, 'A gezond na de storm');
    assert.equal((await health(B.base)).ok, true, 'B gezond na de storm');
  });

  await t.test('2. netwerk-sabotage: Redis en Postgres bevriezen tijdens een datastroom, dan herstellen', async () => {
    const lid = pool[0];
    let verstuurd = 0, opgevangen = 0;
    // achtergrond-datastroom van geo-updates op A, dwars door de storing heen
    let loop = true;
    const stroom = (async () => {
      while (loop) {
        try { const r = await api(lid.base, '/api/live/update', { lat: 38.9 + Math.random() * 0.05, lng: 1.43 }, lid.token);
          if (r.status < 500) verstuurd++; else opgevangen++; }
        catch (e) { opgevangen++; }
        await sleep(15);
      }
    })();
    await sleep(150); // de stroom loopt

    // STEKKER ERUIT: bevries eerst de realtime-bus, dan de database
    console.log('    STEKKER ERUIT: Redis bevriezen...');
    seinNaar('redis-server', 'STOP');
    await sleep(250);
    console.log('    STEKKER ERUIT: Postgres bevriezen (write-behind moet dit opvangen)...');
    seinNaar('postgres', 'STOP');
    await sleep(350);

    // MIDDEN IN DE STORING: doet de HTTP-laag het nog? (memory is de werkkopie)
    const tijdensBestel = await api(lid.base, '/api/order', { supplierCode: supCode, items: [{ id: 'ramen', qty: 1 }] }, lid.token);
    const gezondTijdens = await health(A.base);
    console.log('    tijdens de storing: bestellen status', tijdensBestel.status + ',', 'health', gezondTijdens && gezondTijdens.ok);

    // STEKKER ERIN: herstel bus en database
    console.log('    STEKKER ERIN: Postgres en Redis hervatten...');
    seinNaar('postgres', 'CONT');
    seinNaar('redis-server', 'CONT');
    await sleep(600); // reconnect + write-behind loopt de achterstand in
    loop = false;
    await stroom;

    console.log('    datastroom:', verstuurd, 'geslaagd,', opgevangen, 'opgevangen tijdens de sabotage');
    // De lakmoesproef: het systeem doet het na herstel gewoon weer, op BEIDE instances
    assert.equal(tijdensBestel.status, 200, 'de HTTP-laag bleef tijdens de storing werken (in-memory write-behind)');
    assert.equal((await health(A.base)).ok, true, 'A leefde de hele storing door');
    assert.equal((await health(B.base)).ok, true, 'B leefde de hele storing door');
    const naHerstel = await nieuwLid(B.base);
    assert.ok(naHerstel, 'na herstel komt een nieuw lid er gewoon in (B)');
    const orderNa = await api(lid.base, '/api/order', { supplierCode: supCode, items: [{ id: 'ramen', qty: 2 }] }, lid.token);
    assert.equal(orderNa.status, 200, 'na herstel loopt een verse bestelling weer normaal');
  });

  await t.test('3. betaalrace: twee gelijktijdige betalingen op dezelfde bestelling -> 1x 200, 1x 409', async () => {
    // een lid op A, waar de leverancier (KIKUNOI) zijn menu heeft; op B kan de
    // menusync nog achterlopen en zou de bestelling zelf al mislukken
    const lid = pool.find(p => p.base === A.base) || pool[0];
    const plaats = await api(lid.base, '/api/order', { supplierCode: supCode, items: [{ id: 'ramen', qty: 3 }] }, lid.token);
    assert.ok(plaats.body.order, 'bestelling geplaatst (' + plaats.status + ': ' + JSON.stringify(plaats.body).slice(0, 100) + ')');
    const ref = plaats.body.order.ref;
    assert.equal(plaats.body.order.status, 'wacht-op-betaling', 'vooraf betalen: staat op wacht-op-betaling');
    const [a, b] = await Promise.all([
      api(lid.base, '/api/order/pay', { ref }, lid.token),
      api(lid.base, '/api/order/pay', { ref }, lid.token)
    ]);
    const statussen = [a.status, b.status].sort();
    console.log('    betaalrace:', statussen.join(' + '));
    assert.deepEqual(statussen, [200, 409], 'precies een betaling slaagt, de andere krijgt 409 (geen dubbele afschrijving)');
  });
});
