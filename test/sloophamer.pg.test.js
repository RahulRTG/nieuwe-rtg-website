/* De "sloophamer": de chaos-intentie van een aangeleverde test, maar dan tegen
   de ECHTE architectuur van dit platform (twee kind-processen op een gedeelde
   Postgres + Redis, echte HTTP-endpoints), niet tegen een verzonnen in-proces
   API. Drie beproevingen:

   1. Spitsuur-stormloop: honderden gelijktijdige acties (registraties, geo-
      updates onderweg, bestellingen + betalingen, leesverzoeken) verdeeld over
      A en B. De server mag onder die druk geen enkele 5xx-crash geven en moet
      daarna nog gezond zijn.
   2. Netwerk-sabotage: midden in een actieve realtime-datastroom bevriezen we
      Postgres (SIGSTOP), en herstellen daarna (SIGCONT). Liveness blijft groen,
      maar een mutatie mag zonder duurzame requestcommit geen succes teruggeven:
      hij faalt begrensd met 503, readiness sluit en opent pas na volledige
      resync. De geweigerde mutatie mag daarbij geen fantoomstaat achterlaten.
   3. Betaalrace: twee gelijktijdige betalingen op exact dezelfde bestelling
      geven precies een keer succes en een keer 409 (geen dubbele afschrijving).

   Draait alleen met DATABASE_URL EN REDIS_URL gezet (anders overgeslagen):
     DATABASE_URL=postgresql://postgres@127.0.0.1:5433/rtggrand \
     REDIS_URL=redis://127.0.0.1:6399 \
     node --test test/sloophamer.pg.test.js */
/* Draait PostgreSQL lokaal in Docker, geef dan ook de expliciete wegwerpcontainer
   mee: RTG_POSTGRES_CONTAINER=rtg-pg-proef. Alleen onder CI mag de toets zonder
   die variabele de ene draaiende postgres:16-alpine-servicecontainer herkennen.
   Bij nul of meerdere kandidaten faalt de storingproef gesloten; lokaal kiest de
   toets nooit zelf een Docker-container. */
/* LET OP -- deze toets vraagt de database VOOR ZICHZELF. Verschillende
   PG-toetsen maken en droppen dezelfde tabellen (kv, tx_ledger, users), en
   `node --test` draait bestanden standaard PARALLEL: dan trekt de een de tabel
   onder de ander weg en zie je "spookfouten" die niets met de code te maken
   hebben. Draai ze daarom serieel via `npm run test:pg` (of geef elke toets een
   eigen database). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { startServer, stop } = require('./helper');

const HEEFT_PG = !!(process.env.DATABASE_URL || process.env.PG_URL);
const HEEFT_REDIS = !!process.env.REDIS_URL;
const OVERSLAAN = (HEEFT_PG && HEEFT_REDIS) ? false
  : 'vereist DATABASE_URL EN REDIS_URL (twee instances + gedeelde bus)';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const jitter = () => Math.random() * 120;

function api(base, pad, body, token, timeoutMs) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}),
    ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const health = base => fetch(base + '/api/health').then(r => r.json()).catch(() => null);
async function peil(base, pad) {
  const r = await fetch(base + pad, { signal: AbortSignal.timeout(3000) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function wachtGereed(base, naam) {
  const eind = Date.now() + 20000;
  let laatste = null;
  while (Date.now() < eind) {
    try {
      laatste = await peil(base, '/api/ready');
      if (laatste.status === 200 && laatste.body.ready === true) return laatste;
    } catch (e) { laatste = { fout: e.message }; }
    await sleep(100);
  }
  throw new Error(naam + ' werd niet opnieuw gereed: ' + JSON.stringify(laatste));
}

// een proces met SIGSTOP bevriezen / met SIGCONT hervatten (netwerk-partitie)
const IS_CI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const IS_GITHUB_CI = process.env.GITHUB_ACTIONS === 'true';
let bestuurdePostgresContainer = null;

function vindCiPostgresContainer() {
  if (!IS_GITHUB_CI) return null;
  const uitvoer = execFileSync('docker', [
    'ps',
    '--filter', 'ancestor=postgres:16-alpine',
    '--filter', 'status=running',
    '--format', '{{.ID}}'
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const kandidaten = uitvoer.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  return kandidaten.length === 1 ? kandidaten[0] : null;
}

function seinNaar(patroon, sig) {
  try {
    if (patroon === 'postgres') {
      const expliciet = String(process.env.RTG_POSTGRES_CONTAINER || '').trim();
      const container = expliciet
        || (sig === 'CONT' ? bestuurdePostgresContainer : null)
        || vindCiPostgresContainer();
      if (container) {
        execFileSync('docker', [sig === 'STOP' ? 'pause' : 'unpause', container], { stdio: 'ignore' });
        bestuurdePostgresContainer = sig === 'STOP' ? container : null;
        return true;
      }
      // Een CI-run zonder exact één herkenbare servicecontainer mag nooit
      // terugvallen op een brede processelectie op de host.
      if (IS_CI) return false;
    }
    execFileSync('pkill', ['-' + sig, '-x', patroon], { stdio: 'ignore' });
    return true;
  }
  catch (e) { return false; } // geen proces/container of geen recht om hem te besturen
}

let seq = 0;
async function nieuwLid(base) {
  const u = (Date.now() + (++seq)).toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const reg = await api(base, '/api/auth/register', { name: 'Chaos', email: 'c' + u + '@x.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
  if (!reg.body.token) return null;
  return reg.body.token;
}

test('SLOOPHAMER: stormloop, PostgreSQL-sabotage en betaalrace op gedeelde PG + Redis',
  { skip: OVERSLAAN }, async (t) => {

  const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sl-A-'));
  const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sl-B-'));
  // De productiegrens is 30 seconden. Voor een harde storingproef zetten we de
  // client- en servergrens bewust lager: de test bewijst zo een BEGRENSDE 503
  // in plaats van dertig seconden op een bevroren socket te wachten. Deze grens
  // verandert de requestcommit-semantiek niet en blijft ruim boven een normale
  // lokale query.
  const opslagGrenzen = { PG_QUERY_MS: '2000', PG_STATEMENT_MS: '2000', PG_CONNECT_MS: '2000' };
  const A = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dirA, ...opslagGrenzen } });
  const B = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dirB, ...opslagGrenzen } });

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

  await t.test('2. PostgreSQL-sabotage: mutatie faalt gesloten, readiness herstelt zonder fantoomstaat', async () => {
    const lid = pool[0];
    const voor = await api(lid.base, '/api/orders/mine', {}, lid.token);
    assert.equal(voor.status, 200, 'de uitgangsstand van de bestellingen is leesbaar');
    const aantalVoor = voor.body.total;
    assert.equal(typeof aantalVoor, 'number', 'de uitgangsstand draagt een exact totaal');
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

    let pgGestopt = false;
    let tijdensBestel, gezondTijdens, gereedTijdens, duurMs;
    try {
      // Redis blijft bewust draaien: de 503 en gesloten readiness hieronder
      // kunnen daardoor alleen de PostgreSQL-waarheidsgrens bewijzen.
      console.log('    STEKKER ERUIT: Postgres bevriezen...');
      pgGestopt = seinNaar('postgres', 'STOP');
      assert.equal(pgGestopt, true, 'de storingproef kon het PostgreSQL-proces niet bevriezen');
      await sleep(350);

      const begin = Date.now();
      tijdensBestel = await api(lid.base, '/api/order', {
        supplierCode: supCode, items: [{ id: 'ramen', qty: 19 }]
      }, lid.token, 7000);
      duurMs = Date.now() - begin;
      gezondTijdens = await peil(A.base, '/api/health');
      gereedTijdens = await peil(A.base, '/api/ready');
      console.log('    tijdens de storing: bestellen status', tijdensBestel.status + ',',
        'health', gezondTijdens.status + ',', 'ready', gereedTijdens.status + ',', duurMs + 'ms');

      assert.equal(tijdensBestel.status, 503,
        'een mutatie zonder duurzame PostgreSQL-confirmatie moet fail-closed antwoorden');
      assert.ok(duurMs < 7000, 'de 503 kwam niet binnen de afgesproken opslaggrens (' + duurMs + 'ms)');
      assert.equal(gezondTijdens.status, 200, 'liveness blijft bereikbaar tijdens PostgreSQL-uitval');
      assert.equal(gezondTijdens.body.ok, true, 'het proces leeft tijdens PostgreSQL-uitval');
      assert.equal(gereedTijdens.status, 503, 'readiness sluit na een mislukte requestcommit');
      assert.equal(gereedTijdens.body.ready, false, 'readiness noemt de instance niet inzetbaar');
      assert.equal(gereedTijdens.body.writeHealthy, false,
        'de gesloten readiness komt aantoonbaar van de PostgreSQL-schrijfgrens');
    } finally {
      console.log('    STEKKER ERIN: Postgres hervatten...');
      if (pgGestopt) seinNaar('postgres', 'CONT');
      loop = false;
      await stroom;
    }

    console.log('    datastroom:', verstuurd, 'geslaagd,', opgevangen, 'opgevangen tijdens de sabotage');
    await wachtGereed(A.base, 'A');
    await wachtGereed(B.base, 'B');
    // De lakmoesproef: liveness bleef op beide instanties bestaan, maar pas na
    // resync komt de mutatielaag weer open.
    assert.equal((await health(A.base)).ok, true, 'A leefde de hele storing door');
    assert.equal((await health(B.base)).ok, true, 'B leefde de hele storing door');
    const naMislukking = await api(lid.base, '/api/orders/mine', {}, lid.token);
    assert.equal(naMislukking.status, 200, 'de autoritatieve bestelstaat is na resync leesbaar');
    assert.equal(naMislukking.body.total, aantalVoor,
      'de met 503 geweigerde bestelling liet geen fantoomorder achter');
    const naHerstel = await nieuwLid(B.base);
    assert.ok(naHerstel, 'na herstel komt een nieuw lid er gewoon in (B)');
    const orderNa = await api(lid.base, '/api/order', { supplierCode: supCode, items: [{ id: 'ramen', qty: 2 }] }, lid.token);
    assert.equal(orderNa.status, 200, 'na herstel loopt een verse bestelling weer normaal');
    assert.ok(orderNa.body.order && orderNa.body.order.ref, 'de verse bestelling heeft een bevestigde referentie');
    const naVerse = await api(lid.base, '/api/orders/mine', {}, lid.token);
    assert.equal(naVerse.status, 200, 'de bestelstaat blijft leesbaar na de verse mutatie');
    assert.equal(naVerse.body.total, aantalVoor + 1,
      'alleen de verse bevestigde bestelling is duurzaam toegevoegd');
    assert.ok((naVerse.body.orders || []).some(o => o.ref === orderNa.body.order.ref),
      'de bevestigde bestelling staat precies in de autoritatieve bestelstaat');
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
