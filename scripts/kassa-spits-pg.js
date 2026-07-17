/* Kassa-spitsuur in POSTGRES-modus: MILJOENEN restaurants als geindexeerde rijen
   (buiten het geheugen), met het hele kassa/keuken/PDA/AI-proces eroverheen.

   Het verschil met de JSON-run: de bulk-zaken staan NIET in het geheugen maar als
   rijen in de Postgres-tabel suppliers_big (code = sleutel). Zo passen er miljoenen
   zonder gigabytes RAM en zonder de 512 MB-serialisatiegrens. findSupplier zoekt de
   actieve zaken in het geheugen (O(1)) en de rest op aanvraag in het grootboek.

   Fase A: zaai PG_RESTAURANTS zaken via COPY in suppliers_big; meet boot, geheugen
           (moet LAAG blijven), de backoffice-staat en het opzoeken van een bulk-zaak.
   Fase B: het volledige horecaproces heet op de bemande keukens + alle apps druk.
   Fase C: herstart de server en bewijs dat alles DUURZAAM in Postgres staat
           (aantal zaken en bestellingen overleven de herstart).

   Vereist een draaiende Postgres. Draai:
     DATABASE_URL=postgres://rtg:rtg@127.0.0.1:5432/rtg \
     node --max-old-space-size=4096 scripts/kassa-spits-pg.js
   Knoppen: PG_RESTAURANTS, PG_MEMBERS, PG_DUUR. */
const { spawn, execSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const http = require('http');
const { finished } = require('stream/promises');

const agent = new http.Agent({ keepAlive: true, maxSockets: 1024 });
function verzoek(pad, { method = 'POST', token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = method === 'GET' ? null : JSON.stringify(body || {});
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request({ host: '127.0.0.1', port: PORT, path: pad, method, headers, agent }, res => {
      let buf = ''; res.on('data', c => buf += c); res.on('end', () => resolve({ status: res.statusCode, tekst: buf }));
    });
    req.on('error', reject);
    req.setTimeout(120000, () => req.destroy(new Error('timeout')));
    if (data) req.write(data); req.end();
  });
}
const ROOT = path.join(__dirname, '..');
const PORT = 4075, BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kpg-'));
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://rtg:rtg@127.0.0.1:5432/rtg';
const RESTAURANTS = Number(process.env.PG_RESTAURANTS || 10000000);
const MEMBERS = Number(process.env.PG_MEMBERS || 60);
const KASSA_GASTEN = Number(process.env.KASSA_GASTEN || 60); // hoeveel gasten de keukens voeden (rest doet video+GPS)
const DUUR_MS = Number(process.env.PG_DUUR || 60000);
// ruimere opslag-/flush-vensters: onder een zware schrijfgolf coalesceren we
// meer per ronde (de datastore serialiseert per save de kast, dus minder vaak = beter)
const ENV = { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '', RTG_STORE: 'postgres', DATABASE_URL, RTG_SAVE_MS: process.env.RTG_SAVE_MS || '1000', PG_FLUSH_MS: process.env.PG_FLUSH_MS || '1000' };

let child = null;
const cleanup = () => { try { if (child) child.kill('SIGKILL'); } catch (e) {} try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} };
setTimeout(() => { console.log('\nHARD TIMEOUT'); cleanup(); process.exit(1); }, Number(process.env.PG_HARDSTOP || 900000));

const kop = t => console.log('\n\x1b[1m' + t + '\x1b[0m');
const rij = (l, v) => console.log('  ' + String(l).padEnd(38) + v);
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p / 100))]; };
const stromen = {};
function stroom(naam) { return stromen[naam] = stromen[naam] || { n: 0, ok: 0, err: 0, lat: [], fouten: [] }; }
async function api(naam, pad, body, token, method) {
  const st = stroom(naam); st.n++; const t0 = Date.now();
  try {
    const r = await verzoek(pad, { method: method || 'POST', token, body });
    st.lat.push(Date.now() - t0);
    let j = {}; try { j = JSON.parse(r.tekst); } catch (e2) {}
    if (r.status >= 200 && r.status < 300) { st.ok++; return j; }
    st.err++; if (st.fouten.length < 3) st.fouten.push(r.status + ' ' + pad + ' ' + String(j.error || '').slice(0, 60)); return null;
  } catch (e) { st.lat.push(Date.now() - t0); st.err++; if (st.fouten.length < 3) st.fouten.push('NET ' + pad + ' ' + String((e.cause && e.cause.code) || e.message).slice(0, 50)); return null; }
}
async function bootServer() {
  const t0 = Date.now();
  child = spawn(process.execPath, ['--experimental-sqlite', '--max-old-space-size=4096', path.join(ROOT, 'server', 'server.js')], { env: ENV, stdio: ['ignore', 'ignore', 'inherit'] });
  for (let i = 0; i < 2400; i++) { try { if ((await fetch(BASE + '/api/health')).ok) return Date.now() - t0; } catch (e) {} await new Promise(r => setTimeout(r, 100)); }
  throw new Error('server komt niet op');
}
function rssMB() { try { const m = fs.readFileSync('/proc/' + child.pid + '/status', 'utf8').match(/VmRSS:\s+(\d+) kB/); return m ? Math.round(m[1] / 1024) : null; } catch (e) { return null; } }
const stopServer = () => new Promise(r => { const dit = child; const t = setTimeout(() => { try { dit.kill('SIGKILL'); } catch (e) {} }, 12000); dit.once('exit', () => { clearTimeout(t); r(); }); dit.kill('SIGTERM'); });
// Escape eerst de backslash, dan pas de quote (anders ontsnapt een \ de \"-escape).
const shArg = sql => sql.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
function psql(sql) { return execSync('psql "' + DATABASE_URL + '" -v ON_ERROR_STOP=1 -c "' + shArg(sql) + '"', { stdio: ['ignore', 'pipe', 'pipe'] }).toString(); }
function psqlVal(sql) { return execSync('psql "' + DATABASE_URL + '" -tA -c "' + shArg(sql) + '"', { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim(); }

const MENU = [
  { id: 'm1', name: 'Gazpacho de sandia', cat: 'Voor', publiekePrijs: 16, price: 16, station: 'keuken', sectie: 'koud' },
  { id: 'm2', name: 'Arroz de bogavante', cat: 'Hoofd', publiekePrijs: 38, price: 38, station: 'keuken', sectie: 'warm' },
  { id: 'm3', name: 'Croquetas de jamon', cat: 'Snack', publiekePrijs: 12, price: 12, station: 'keuken', sectie: 'snack' },
  { id: 'm4', name: 'Tarta de queso', cat: 'Dessert', publiekePrijs: 11, price: 11, station: 'keuken', sectie: 'dessert' },
  { id: 'b1', name: 'Cava brut', cat: 'Bar', publiekePrijs: 14, price: 14, station: 'bar', sectie: 'warm' }
];
const BASKET = [{ id: 'm1', qty: 1 }, { id: 'm2', qty: 1 }, { id: 'm3', qty: 1 }, { id: 'm4', qty: 1 }, { id: 'b1', qty: 2 }];
const KEUKENS = ['KIKUNOI', 'PONTO'];

(async () => {
  /* ================= FASE A: miljoenen zaken als rijen in Postgres ================= */
  kop('FASE A: ' + RESTAURANTS.toLocaleString('nl-NL') + ' restaurants als geindexeerde rijen in Postgres');
  // schone lei in de database
  psql('DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO rtg;');
  // eerst booten: de server maakt het schema (kv, accounts, suppliers_big) en zaait de demo
  let bootMs = await bootServer();
  rij('boot (leeg, schema + demo)', (bootMs / 1000).toFixed(1) + ' s');

  // de bulk-zaken via COPY in suppliers_big (gestreamd CSV, geen 512 MB-string)
  const t0 = Date.now();
  const STEDEN = ['Ibiza', 'Barcelona', 'Madrid', 'Valencia', 'Palma', 'Malaga'];
  const csv = path.join(TMP, 'zaken.csv');
  const ws = fs.createWriteStream(csv);
  for (let i = 0; i < RESTAURANTS; i++) {
    const c = 'KZ' + i.toString(36).toUpperCase();
    if (!ws.write(c + ',Cocina ' + i.toString(36).toUpperCase() + ',restaurant,' + STEDEN[i % 6] + '\n')) await new Promise(r => ws.once('drain', r));
  }
  ws.end(); await finished(ws);
  rij('CSV schrijven', ((Date.now() - t0) / 1000).toFixed(1) + ' s, ' + (fs.statSync(csv).size / 1e6).toFixed(0) + ' MB');
  const t1 = Date.now();
  psql("\\copy suppliers_big(code,name,type,city) FROM '" + csv + "' WITH (FORMAT csv)");
  rij('COPY naar Postgres', ((Date.now() - t1) / 1000).toFixed(1) + ' s');
  rij('tabel suppliers_big op schijf', psqlVal("SELECT pg_size_pretty(pg_total_relation_size('suppliers_big'));"));

  await new Promise(r => setTimeout(r, 11000)); // de teller in de server ververst elke 10 s
  rij('servergeheugen (RSS)', rssMB() + ' MB  << miljoenen zaken, NIET in het geheugen');

  const eig = await api('owner-login', '/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' });
  const ownerToken = eig && eig.token;
  await api('backoffice', '/api/office/state', {}, ownerToken); // warm de tellercache
  await new Promise(r => setTimeout(r, 1500));
  let t = Date.now(); const st = await api('backoffice', '/api/office/state', {}, ownerToken);
  rij('backoffice-state', (Date.now() - t) + ' ms');
  rij('zaken volgens de totalen', st && st.state ? st.state.totals.partners.toLocaleString('nl-NL') : '?');

  t = Date.now(); await api('roster', '/api/supplier/roster', { code: 'KIKUNOI' });
  rij('actieve zaak opzoeken (geheugen)', (Date.now() - t) + ' ms');
  // een bulk-zaak: 1e keer laadt hij on-demand uit het grootboek, 2e keer uit de cache
  const bulkCode = 'KZ' + (RESTAURANTS - 3).toString(36).toUpperCase();
  await api('roster-bulk', '/api/supplier/roster', { code: bulkCode }); // triggert de async load
  await new Promise(r => setTimeout(r, 150));
  t = Date.now(); const rb = await api('roster-bulk', '/api/supplier/roster', { code: bulkCode });
  rij('bulk-zaak opzoeken (grootboek)', (Date.now() - t) + ' ms  ' + (rb && rb.supplier ? '(' + rb.supplier.name + ')' : '(nog niet gecached)'));

  /* ================= FASE B: het hele kassaproces heet ================= */
  kop('FASE B: kassa/keuken/PDA/AI heet + apps druk, ' + (DUUR_MS / 1000) + ' s');
  let einde = Infinity; const bezig = () => Date.now() < einde;
  const slaap = ms => new Promise(r => setTimeout(r, ms + Math.random() * ms));
  const sse = { events: {}, open: 0 };

  // parallel in blokken registreren + verbinden + "onderweg" zetten (snel opstarten)
  const inBlokken = async (n, fn, blok = 50) => { for (let i = 0; i < n; i += blok) { const p = []; for (let j = i; j < Math.min(n, i + blok); j++) p.push(fn(j)); await Promise.all(p); } };
  const actors = new Array(MEMBERS).fill(null);
  await inBlokken(MEMBERS, async i => {
    const reg = await api('registratie', '/api/auth/register', { name: 'Gast ' + i, email: 'kpg' + i + '@rtg.nl', phone: '06' + (40000000 + i), password: 'Spits1234!', geboortedatum: '1985-05-05', tier: 'business', pasApp: 'business' });
    if (!reg || !reg.token) return;
    const a = { i, token: reg.token };
    const c = await api('connecties', '/api/member/connections', {}, a.token); a.key = c && c.me;
    a.lat = 38.90 + Math.random() * 0.06; a.lng = 1.40 + Math.random() * 0.06;
    await api('live-start', '/api/live/start', { mode: 'driving', lat: a.lat, lng: a.lng }, a.token);
    actors[i] = a;
  });
  for (let i = actors.length - 1; i >= 0; i--) if (!actors[i]) actors.splice(i, 1);
  rij('gasten (leden) geregistreerd + onderweg', actors.length);

  const keukens = {};
  for (const code of KEUKENS) {
    const ro = await api('roster', '/api/supplier/roster', { code }); if (!ro || !ro.staff) continue;
    const man = ro.staff.find(s => s.role === 'manager'); const med = ro.staff.find(s => s.role !== 'manager') || man;
    const pda = (await api('kassa-login', '/api/supplier/login', { code, staffId: man.id, pin: '1234' })).token;
    const keuken = (await api('kassa-login', '/api/supplier/login', { code, staffId: med.id, pin: '5678' })).token;
    const bar = (await api('kassa-login', '/api/supplier/login', { code, staffId: man.id, pin: '1234' })).token;
    if (pda) await api('menu-zet', '/api/supplier/menu', { menu: MENU }, pda);
    keukens[code] = { pda, keuken, bar, queue: [] };
  }
  rij('bemande keukens (alle schermen)', Object.keys(keukens).length);

  const sseAborts = [];
  function luister(token) {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: '/api/stream?token=' + token, method: 'GET' }, res => {
      sse.open++; let buf = '';
      res.on('data', c => { buf += c; let ix; while ((ix = buf.indexOf('\n')) >= 0) { const g = buf.slice(0, ix); buf = buf.slice(ix + 1); const m = g.match(/^event: (.+)$/); if (m) sse.events[m[1]] = (sse.events[m[1]] || 0) + 1; } });
      res.on('error', () => {});
    });
    req.on('error', () => {}); req.end(); sseAborts.push({ abort: () => req.destroy() });
  }
  actors.forEach(a => luister(a.token));

  const taken = [];
  // gasten bestellen (een bon die alle keukenschermen raakt) + betalen.
  // Een deel van de gasten voedt de keukens (bonnen groeien de orders-collectie,
  // die per save geserialiseerd wordt, dus begrensd houden); ALLE gasten doen wel
  // mee aan de videogesprekken en GPS hieronder.
  for (const a of actors.slice(0, Math.min(actors.length, KASSA_GASTEN))) taken.push((async () => {
    while (bezig()) {
      const code = KEUKENS[a.i % KEUKENS.length];
      const o = await api('gast-bestelt', '/api/order', { supplierCode: code, items: BASKET, table: 'Tafel ' + (1 + a.i % 40) }, a.token);
      if (o && o.order) { await api('gast-betaalt', '/api/order/pay', { ref: o.order.ref }, a.token); if (keukens[code]) keukens[code].queue.push(o.order.ref); }
      await api('mijn-bestellingen', '/api/orders/mine', {}, a.token);
      if (a.i % 4 === 0) await api('gastchat', '/api/partner/chat/send', { supplierCode: code, text: 'Kan de arroz zonder schaaldier?' }, a.token);
      await slaap(140);
    }
  })());
  // de keuken: alle schermen per bon
  for (const code of Object.keys(keukens)) {
    const k = keukens[code];
    for (let w = 0; w < 4; w++) taken.push((async () => {
      while (bezig()) {
        const ref = k.queue.shift(); if (!ref) { await slaap(90); continue; }
        await api('pda-tafel', '/api/supplier/order/table', { ref, table: 'Tafel ' + (1 + Math.floor(Math.random() * 40)) }, k.pda);
        for (const sectie of ['warm', 'koud', 'snack', 'dessert']) await api('keukenscherm', '/api/supplier/order/sectie', { ref, sectie, phase: 'klaar' }, k.keuken);
        await api('barscherm', '/api/supplier/order/station', { ref, station: 'bar', phase: 'klaar' }, k.bar);
        await api('doorgeef', '/api/supplier/order/status', { ref, status: 'geserveerd' }, k.pda);
      }
    })());
    taken.push((async () => { while (bezig()) { await api('kassa-verkoop', '/api/supplier/pos/sale', { total: 47, method: 'contant', desc: 'Terras', items: [{ name: 'Cava', qty: 2, price: 14 }] }, k.pda); await slaap(200); } })());
    const vragen = ['hoeveel bestellingen staan er open?', 'wat is de omzet vandaag?', 'meld klus: vaatwasser lekt', 'welke tafels wachten nog?'];
    let vi = 0;
    taken.push((async () => { while (bezig()) { await api('ai-assistent', '/api/supplier/ai', { q: vragen[vi++ % vragen.length] }, k.pda); await slaap(500); } })());
    taken.push((async () => { while (bezig()) { await api('zaak-backoffice', '/api/supplier/backoffice', {}, k.pda); await slaap(1500); } })());
  }
  // alle andere apps druk (compact)
  const paren = []; for (let i = 0; i + 1 < actors.length; i += 2) paren.push([actors[i], actors[i + 1]]);
  await inBlokken(paren.length, async pi => { const [a, b] = paren[pi]; await api('vriend', '/api/member/connect', { key: b.key }, a.token); await api('vriend', '/api/member/connect/respond', { key: a.key, action: 'accept' }, b.token); });

  /* MILJOENEN VIDEOGESPREKKEN: elk paar draait onophoudelijk de volledige
     WebRTC-signaleringscyclus (ring, accept, offer, answer, 3x ICE, hangup).
     Geen pauze: zo hard als de server aankan. Elk signaal wordt live via SSE
     naar de tegenpartij gestuurd. */
  for (const [a, b] of paren) taken.push((async () => {
    while (bezig()) {
      await api('videobellen', '/api/member/call', { toKey: b.key, kind: 'ring', video: true }, a.token);
      await api('videobellen', '/api/member/call', { toKey: a.key, kind: 'accept', video: true }, b.token);
      await api('videobellen', '/api/member/call', { toKey: b.key, kind: 'offer', video: true, payload: { sdp: 'v=0 demo-offer' } }, a.token);
      await api('videobellen', '/api/member/call', { toKey: a.key, kind: 'answer', video: true, payload: { sdp: 'v=0 demo-answer' } }, b.token);
      for (let k = 0; k < 3; k++) await api('videobellen', '/api/member/call', { toKey: b.key, kind: 'ice', payload: { candidate: 'cand:' + k } }, a.token);
      await api('videobellen', '/api/member/call', { toKey: b.key, kind: 'hangup' }, a.token);
    }
  })());

  /* MILJOENEN GPS-UPDATES: elk lid stuurt onophoudelijk zijn live locatie door
     (de zaak en de backoffice zien hem live bewegen op de kaart). */
  for (const a of actors) taken.push((async () => {
    while (bezig()) {
      a.lat += (Math.random() - 0.5) * 0.001; a.lng += (Math.random() - 0.5) * 0.001;
      await api('gps', '/api/live/update', { lat: a.lat, lng: a.lng }, a.token);
    }
  })());

  // wat lichte sociale ruis eromheen (DM), zodat "alles" tegelijk draait
  for (const [a, b] of paren.slice(0, 20)) taken.push((async () => { while (bezig()) { await api('dm', '/api/member/dm/send', { toKey: b.key, text: 'Kom je ook?' }, a.token); await slaap(400); } })());
  for (const a of actors.slice(0, 8)) await api('zakelijk-profiel', '/api/zakelijk/profiel/zet', { naam: 'Gast ' + a.i, kop: 'Ondernemer', sector: 'Horeca', vaardigheden: ['Gastvrijheid'] }, a.token);
  for (const a of actors.slice(0, 8)) taken.push((async () => { while (bezig()) { await api('zakelijk', '/api/zakelijk/feed', {}, a.token); await slaap(600); } })());
  taken.push((async () => { const tech = await api('techniek', '/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' }); while (bezig()) { await api('backoffice', '/api/office/state', {}, ownerToken); if (tech) await api('techniek', '/api/techniek/status', null, tech.token, 'GET'); await slaap(2500); } })());
  let maxGat = 0; const sonde = [];
  taken.push((async () => { let v = Date.now(); while (bezig()) { const s0 = Date.now(); try { await verzoek('/api/health', { method: 'GET' }); } catch (e) {} const n2 = Date.now(); sonde.push(n2 - s0); maxGat = Math.max(maxGat, n2 - v); v = n2; await new Promise(r => setTimeout(r, 50)); } })());

  einde = Date.now() + DUUR_MS;
  rij('spitsuur gestart', 'alle stromen tegelijk, ' + (DUUR_MS / 1000) + ' s');
  await Promise.all(taken);
  sseAborts.forEach(a => a.abort());
  const naFaseB = await api('backoffice', '/api/office/state', {}, ownerToken);
  const ordersNa = naFaseB && naFaseB.state ? naFaseB.state.totals.orders : 0;

  /* ================= FASE C: herstart, alles moet duurzaam in Postgres staan ================= */
  kop('FASE C: herstart en controleer de duurzaamheid (Postgres)');
  const rssVoor = rssMB();
  await stopServer();
  const bootMs2 = await bootServer();
  rij('herstart-tijd', (bootMs2 / 1000).toFixed(1) + ' s');
  await new Promise(r => setTimeout(r, 11000)); // tellerverversing
  const eig2 = await api('owner-login', '/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' });
  await api('backoffice', '/api/office/state', {}, eig2 && eig2.token); // warm de tellercache
  await new Promise(r => setTimeout(r, 1500));
  const st2 = await api('backoffice', '/api/office/state', {}, eig2 && eig2.token);
  const partnersNa = st2 && st2.state ? st2.state.totals.partners : 0;
  const ordersNaHerstart = st2 && st2.state ? st2.state.totals.orders : 0;
  rij('zaken na herstart', partnersNa.toLocaleString('nl-NL') + (partnersNa >= RESTAURANTS ? '  ✓ bewaard' : '  << verwacht >= ' + RESTAURANTS.toLocaleString('nl-NL')));
  rij('bestellingen voor/na herstart', ordersNa + ' / ' + ordersNaHerstart + (ordersNaHerstart >= ordersNa ? '  ✓ bewaard' : ''));

  /* ================= RAPPORT ================= */
  kop('RAPPORT per stroom (' + (DUUR_MS / 1000) + ' s bovenop ' + RESTAURANTS.toLocaleString('nl-NL') + ' restaurants)');
  for (const n of Object.keys(stromen).sort()) {
    const s = stromen[n];
    console.log('  ' + n.padEnd(18) + String(s.n).padStart(7) + 'x  ok=' + String(s.ok).padStart(7) + '  err=' + String(s.err).padStart(4) + '  p50=' + String(pct(s.lat, 50)).padStart(5) + 'ms  p95=' + String(pct(s.lat, 95)).padStart(5) + 'ms' + (s.fouten.length ? '   << ' + s.fouten[0] : ''));
  }
  const gb = stromen['gast-bestelt'] || { ok: 0 }, dg = stromen['doorgeef'] || { ok: 0 }, ks = stromen['keukenscherm'] || { ok: 0 };
  kop('De golf: video, GPS en kassa');
  const vb = stromen['videobellen'] || { ok: 0, n: 0 }, gps = stromen['gps'] || { ok: 0, n: 0 };
  rij('videobel-signalen (WebRTC)', vb.ok.toLocaleString('nl-NL') + '  (ring/accept/offer/answer/ICE/hangup)');
  rij('GPS-locatie-updates', gps.ok.toLocaleString('nl-NL'));
  rij('bonnen besteld / geserveerd', gb.ok + ' / ' + dg.ok);
  rij('keukensectie-meldingen', ks.ok);
  rij('gezondheids-sonde p50/p99', pct(sonde, 50) + ' / ' + pct(sonde, 99) + ' ms');
  rij('grootste hapering (max gat)', maxGat + ' ms');
  rij('servergeheugen (RSS) piek', rssVoor + ' MB');

  cleanup();
  console.log('\nKlaar.');
  process.exit(0);
})().catch(e => { console.error(e); cleanup(); process.exit(1); });
