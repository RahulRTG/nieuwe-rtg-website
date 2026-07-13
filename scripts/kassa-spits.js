/* Kassa-spitsuur: MILJOENEN RESTAURANTS met het hele kassasysteem tegelijk.

   Het beeld: een druk avonduur waarin miljoenen horecazaken in de datastore
   staan en het complete kassa/keuken/PDA-proces heet draait, terwijl alle
   andere apps ook bezig zijn.

   Fase A: zaai KASSA_RESTAURANTS restaurants (db.data.suppliers) plus een
           backlog van KASSA_ORDERS bestellingen. Meet boot, geheugen, de
           db.json-omvang, de backoffice-staat en, cruciaal, hoe duur EEN
           kassahandeling (leverancier opzoeken) wordt met miljoenen zaken in
           de kast: findSupplier() is een lineaire scan.
   Fase B: op de bemande vlaggenschip-keukens draait het volledige proces:
           - de gast bestelt aan tafel (een bon die ALLE keukenschermen raakt:
             warme kant, koude kant, snacks, dessert en de bar);
           - het personeel neemt hem op de PDA aan, zet de tafel, slaat losse
             kassaverkopen aan (POS);
           - de keukenschermen melden per sectie klaar, het barscherm de bar,
             het doorgeefluik zet 'm op geserveerd;
           - de AI-assistent helpt de zaak (vraagt en doet).
           Ondertussen: leden bellen/DM/snaps, RTF-gezinnen, RTG Zakelijk,
           activiteiten, autoverhuur, vastgoed, en de backoffice + techniek
           kijken mee. Met open SSE-streams en een gezondheids-sonde.

   Draai: node --max-old-space-size=4096 scripts/kassa-spits.js
   Knoppen: KASSA_RESTAURANTS, KASSA_ORDERS, KASSA_MEMBERS, KASSA_DUUR. */
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const http = require('http');

const agent = new http.Agent({ keepAlive: true, maxSockets: 512 });
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
const PORT = 4070, BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kassa-'));
const RESTAURANTS = Number(process.env.KASSA_RESTAURANTS || 2000000);
const ORDERS = Number(process.env.KASSA_ORDERS || 400000);
const MEMBERS = Number(process.env.KASSA_MEMBERS || 60);
const DUUR_MS = Number(process.env.KASSA_DUUR || 90000);
const ENV = { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '' };

let child = null;
const cleanup = () => { try { if (child) child.kill('SIGKILL'); } catch (e) {} try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} };
setTimeout(() => { console.log('\nHARD TIMEOUT'); cleanup(); process.exit(1); }, 580000);

const kop = t => console.log('\n\x1b[1m' + t + '\x1b[0m');
const rij = (l, v) => console.log('  ' + String(l).padEnd(38) + v);
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p / 100))]; };

const stromen = {};
function stroom(naam) { return stromen[naam] = stromen[naam] || { n: 0, ok: 0, err: 0, lat: [], fouten: [] }; }
async function api(naam, pad, body, token, method) {
  const st = stroom(naam); st.n++;
  const t0 = Date.now();
  try {
    const r = await verzoek(pad, { method: method || 'POST', token, body });
    st.lat.push(Date.now() - t0);
    let j = {}; try { j = JSON.parse(r.tekst); } catch (e2) {}
    if (r.status >= 200 && r.status < 300) { st.ok++; return j; }
    st.err++;
    if (st.fouten.length < 3) st.fouten.push(r.status + ' ' + pad + ' ' + String(j.error || '').slice(0, 70));
    return null;
  } catch (e) {
    st.lat.push(Date.now() - t0); st.err++;
    const oorzaak = (e.cause && (e.cause.code || e.cause.message)) || e.message;
    if (st.fouten.length < 3) st.fouten.push('NET ' + pad + ' ' + String(oorzaak).slice(0, 60));
    return null;
  }
}

async function bootServer() {
  const t0 = Date.now();
  child = spawn(process.execPath, ['--experimental-sqlite', '--max-old-space-size=4096', path.join(ROOT, 'server', 'server.js')],
    { env: ENV, stdio: ['ignore', 'ignore', 'inherit'] });
  for (let i = 0; i < 2400; i++) { try { if ((await fetch(BASE + '/api/health')).ok) return Date.now() - t0; } catch (e) {} await new Promise(r => setTimeout(r, 100)); }
  throw new Error('server komt niet op');
}
function rssMB() { try { const m = fs.readFileSync('/proc/' + child.pid + '/status', 'utf8').match(/VmRSS:\s+(\d+) kB/); return m ? Math.round(m[1] / 1024) : null; } catch (e) { return null; } }
const stopServer = () => new Promise(r => { const dit = child; const fs2 = setTimeout(() => { try { dit.kill('SIGKILL'); } catch (e) {} }, 12000); dit.once('exit', () => { clearTimeout(fs2); r(); }); dit.kill('SIGTERM'); });

// het menu van een vlaggenschip-keuken: raakt bewust ALLE keukenschermen
const MENU = [
  { id: 'm1', name: 'Gazpacho de sandia', cat: 'Voor', publiekePrijs: 16, price: 16, station: 'keuken', sectie: 'koud' },
  { id: 'm2', name: 'Arroz de bogavante', cat: 'Hoofd', publiekePrijs: 38, price: 38, station: 'keuken', sectie: 'warm' },
  { id: 'm3', name: 'Croquetas de jamon', cat: 'Snack', publiekePrijs: 12, price: 12, station: 'keuken', sectie: 'snack' },
  { id: 'm4', name: 'Tarta de queso', cat: 'Dessert', publiekePrijs: 11, price: 11, station: 'keuken', sectie: 'dessert' },
  { id: 'b1', name: 'Cava brut', cat: 'Bar', publiekePrijs: 14, price: 14, station: 'bar', sectie: 'warm' }
];
const BASKET = [{ id: 'm1', qty: 1 }, { id: 'm2', qty: 1 }, { id: 'm3', qty: 1 }, { id: 'm4', qty: 1 }, { id: 'b1', qty: 2 }];

(async () => {
  /* ================= FASE A: miljoenen restaurants in de kast ================= */
  kop('FASE A: ' + RESTAURANTS.toLocaleString('nl-NL') + ' restaurants + ' + ORDERS.toLocaleString('nl-NL') + ' bestellingen in de datastore');
  await bootServer();
  await new Promise(r => setTimeout(r, 800));
  await stopServer();
  const DB = path.join(TMP, 'db.json');
  const data = JSON.parse(fs.readFileSync(DB, 'utf8'));

  const t0 = Date.now();
  const STEDEN = ['Ibiza', 'Barcelona', 'Madrid', 'Valencia', 'Palma', 'Malaga'];
  const sups = data.suppliers = data.suppliers || [];
  const codes = new Array(RESTAURANTS);
  for (let i = 0; i < RESTAURANTS; i++) {
    const code = 'KZ' + i.toString(36).toUpperCase();
    codes[i] = code;
    sups.push({ code, name: 'Cocina ' + i.toString(36).toUpperCase(), type: 'restaurant', city: STEDEN[i % 6], loc: null, rate: 0.12, menu: [] });
  }
  const orders = data.orders = data.orders || [];
  const NU = Date.now();
  for (let i = 0; i < ORDERS; i++) {
    const sc = codes[i % RESTAURANTS];
    orders.push({
      ref: 'RTG-O-K' + i.toString(36).toUpperCase(),
      pickup: 'T' + (i % 46656).toString(36).toUpperCase(),
      supplierCode: sc, supplierName: 'Cocina', type: 'restaurant',
      customerTier: 'rtg', customerKey: 'user-' + (100 + i % 500000), customerCodename: 'Gast ' + (i % 500000),
      items: [{ id: 'm2', name: 'Arroz de bogavante', qty: 1, price: 38 }], total: 38,
      betaalMoment: 'vooraf', status: i % 41 === 0 ? 'klaar' : 'geserveerd', paid: true,
      at: new Date(NU - (i % 7776000) * 1000).toISOString()
    });
  }
  fs.writeFileSync(DB, JSON.stringify(data));
  rij('zaaien + wegschrijven', ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  rij('db.json op schijf', (fs.statSync(DB).size / 1e6).toFixed(0) + ' MB');

  const bootMs = await bootServer();
  rij('boot-tijd met volle kast', (bootMs / 1000).toFixed(1) + ' s');
  rij('servergeheugen (RSS) na boot', rssMB() + ' MB');

  // zware leesroutes + de prijs van EEN kassahandeling met miljoenen zaken
  const eig = await api('owner-login', '/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' });
  const ownerToken = eig && eig.token;
  let t = Date.now(); await api('backoffice', '/api/office/state', {}, ownerToken);
  rij('backoffice-state (alle zaken)', (Date.now() - t) + ' ms');
  t = Date.now(); await api('roster', '/api/supplier/roster', { code: 'KIKUNOI' });
  rij('leverancier opzoeken (lineair)', (Date.now() - t) + ' ms  << findSupplier over ' + (sups.length).toLocaleString('nl-NL') + ' zaken');

  /* ================= FASE B: het hele kassaproces heet, alles druk ================= */
  kop('FASE B: kassa/keuken/PDA/AI heet + alle apps druk, ' + (DUUR_MS / 1000) + ' s');
  let einde = Infinity;
  const bezig = () => Date.now() < einde;
  const slaap = ms => new Promise(r => setTimeout(r, ms + Math.random() * ms));
  const sse = { events: {}, open: 0 };

  // leden (gasten aan tafel)
  const actors = [];
  for (let i = 0; i < MEMBERS; i++) {
    const reg = await api('registratie', '/api/auth/register', {
      name: 'Gast ' + i, email: 'kassa' + i + '@rtg.nl', phone: '06' + (30000000 + i),
      password: 'Spits1234!', geboortedatum: '1985-05-05', tier: 'business', pasApp: 'business'
    });
    if (reg && reg.token) actors.push({ i, token: reg.token });
  }
  for (const a of actors) { const c = await api('connecties', '/api/member/connections', {}, a.token); a.key = c && c.me; a.codename = c && c.codename; }
  rij('gasten (leden) geregistreerd', actors.length);

  // de bemande vlaggenschip-keukens: elk met PDA-, keuken- en barscherm (eigen sessies)
  const KEUKENS = ['KIKUNOI', 'PONTO'];
  const keukens = {};
  for (const code of KEUKENS) {
    const ro = await api('roster', '/api/supplier/roster', { code });
    if (!ro || !ro.staff) continue;
    const man = ro.staff.find(s => s.role === 'manager');
    const med = ro.staff.find(s => s.role !== 'manager') || man;
    const pda = (await api('kassa-login', '/api/supplier/login', { code, staffId: man.id, pin: '1234' })).token;      // PDA + doorgeef + AI + backoffice
    const keuken = (await api('kassa-login', '/api/supplier/login', { code, staffId: med.id, pin: '5678' })).token;   // keukenscherm
    const bar = (await api('kassa-login', '/api/supplier/login', { code, staffId: man.id, pin: '1234' })).token;      // barscherm
    if (pda) await api('menu-zet', '/api/supplier/menu', { menu: MENU }, pda);
    keukens[code] = { pda, keuken, bar, queue: [] };
  }
  rij('bemande keukens (alle schermen)', Object.keys(keukens).length + ' zaken, elk PDA/keuken/bar');

  // open SSE-streams (live verbonden apps)
  const sseAborts = [];
  function luister(token) {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: '/api/stream?token=' + token, method: 'GET' }, res => {
      sse.open++; let buf = '';
      res.on('data', c => { buf += c; let ix; while ((ix = buf.indexOf('\n')) >= 0) { const regel = buf.slice(0, ix); buf = buf.slice(ix + 1); const m = regel.match(/^event: (.+)$/); if (m) sse.events[m[1]] = (sse.events[m[1]] || 0) + 1; } });
      res.on('error', () => {});
    });
    req.on('error', () => {}); req.end();
    sseAborts.push({ abort: () => req.destroy() });
  }
  actors.forEach(a => luister(a.token));

  const taken = [];

  /* 1) GASTEN bestellen aan tafel: een bon die alle keukenschermen raakt, en betalen */
  for (const a of actors) taken.push((async () => {
    while (bezig()) {
      const code = KEUKENS[a.i % KEUKENS.length];
      const o = await api('gast-bestelt', '/api/order', { supplierCode: code, items: BASKET, table: 'Tafel ' + (1 + a.i % 40) }, a.token);
      if (o && o.order) {
        await api('gast-betaalt', '/api/order/pay', { ref: o.order.ref }, a.token);
        if (keukens[code]) keukens[code].queue.push(o.order.ref);
      }
      await api('mijn-bestellingen', '/api/orders/mine', {}, a.token);
      if (a.i % 4 === 0) await api('gastchat', '/api/partner/chat/send', { supplierCode: code, text: 'Kan de arroz zonder schaaldier?' }, a.token);
      await slaap(140);
    }
  })());

  /* 2) DE KEUKEN: per bon lopen ALLE schermen mee (PDA -> keuken-secties -> bar -> doorgeef) */
  const WERKERS_PER_KEUKEN = 4; // vier gelijktijdige bonnen per keuken in de weer
  for (const code of Object.keys(keukens)) {
    const k = keukens[code];
    for (let w = 0; w < WERKERS_PER_KEUKEN; w++) taken.push((async () => {
      while (bezig()) {
        const ref = k.queue.shift();
        if (!ref) { await slaap(90); continue; }
        // PDA: tafel bevestigen (personeel neemt de bon aan)
        await api('pda-tafel', '/api/supplier/order/table', { ref, table: 'Tafel ' + (1 + Math.floor(Math.random() * 40)) }, k.pda);
        // KEUKENSCHERMEN: elke sectie meldt klaar
        for (const sectie of ['warm', 'koud', 'snack', 'dessert'])
          await api('keukenscherm', '/api/supplier/order/sectie', { ref, sectie, phase: 'klaar' }, k.keuken);
        // BARSCHERM: de bar meldt klaar
        await api('barscherm', '/api/supplier/order/station', { ref, station: 'bar', phase: 'klaar' }, k.bar);
        // DOORGEEF/BEDIENING: geserveerd
        await api('doorgeef', '/api/supplier/order/status', { ref, status: 'geserveerd' }, k.pda);
      }
    })());
    /* 2b) KASSA (POS): personeel slaat losse verkopen aan */
    taken.push((async () => {
      while (bezig()) {
        await api('kassa-verkoop', '/api/supplier/pos/sale', { total: 47, method: 'pin', desc: 'Terras', items: [{ name: 'Cava', qty: 2, price: 14 }, { name: 'Tapas', qty: 1, price: 19 }] }, k.pda);
        await slaap(200);
      }
    })());
    /* 2c) AI-ASSISTENT helpt de zaak (vraagt en doet) */
    taken.push((async () => {
      const vragen = ['hoeveel bestellingen staan er open?', 'wat is de omzet vandaag?', 'meld klus: vaatwasser lekt', 'welke tafels wachten nog?'];
      let i = 0;
      while (bezig()) { await api('ai-assistent', '/api/supplier/ai', { q: vragen[i++ % vragen.length] }, k.pda); await slaap(500); }
    })());
    /* 2d) MANAGER kijkt op de eigen backoffice */
    taken.push((async () => {
      while (bezig()) { await api('zaak-backoffice', '/api/supplier/backoffice', {}, k.pda); await slaap(1500); }
    })());
  }

  /* 3) ALLE ANDERE APPS DRUK ------------------------------------------------ */
  // 3a) bellen/videobellen + DM + snaps tussen verbonden paren
  const paren = [];
  for (let i = 0; i + 1 < actors.length; i += 2) paren.push([actors[i], actors[i + 1]]);
  for (const [a, b] of paren) { await api('vriend', '/api/member/connect', { key: b.key }, a.token); await api('vriend', '/api/member/connect/respond', { key: a.key, action: 'accept' }, b.token); }
  const FOTO = 'data:image/jpeg;base64,' + crypto.randomBytes(8000).toString('base64');
  for (const [a, b] of paren.slice(0, 12)) taken.push((async () => {
    while (bezig()) {
      await api('dm', '/api/member/dm/send', { toKey: b.key, text: 'Kom je ook naar het strand?' }, a.token);
      await api('bellen', '/api/member/call', { toKey: b.key, kind: 'ring', video: true }, a.token);
      await api('bellen', '/api/member/call', { toKey: a.key, kind: 'accept', video: true }, b.token);
      await api('bellen', '/api/member/call', { toKey: b.key, kind: 'offer', video: true, payload: { sdp: 'v=0 demo' } }, a.token);
      await api('bellen', '/api/member/call', { toKey: b.key, kind: 'hangup' }, a.token);
      await api('snap', '/api/member/snap/send', { toKey: b.key, foto: FOTO, tekst: 'proost' }, a.token);
      await slaap(250);
    }
  })());
  // 3b) RTF-gezinnen
  const gezinnen = [];
  for (let g = 0; g < 3; g++) gezinnen.push(await api('rtf-gezin', '/api/foundation/gezin/maak', { gezinsnaam: 'Kassagezin ' + g, naam: 'Ouder ' + g, pin: '1234' }));
  for (const gez of gezinnen) taken.push((async () => { if (!gez) return; while (bezig()) { await api('rtf-bericht', '/api/foundation/gezin/bericht', { code: gez.code, token: gez.token, tekst: 'Tot vanavond!' }); await slaap(500); } })());
  // 3c) RTG Zakelijk
  for (const a of actors.slice(0, 8)) await api('zakelijk-profiel', '/api/zakelijk/profiel/zet', { naam: 'Gast ' + a.i, kop: 'Ondernemer', sector: 'Horeca', vaardigheden: ['Gastvrijheid'] }, a.token);
  for (const a of actors.slice(0, 8)) taken.push((async () => { while (bezig()) { await api('zakelijk', '/api/zakelijk/feed', {}, a.token); await api('zakelijk', '/api/zakelijk/gids', { q: '' }, a.token); await slaap(600); } })());
  // 3d) activiteiten + autoverhuur (lichte belasting op de andere genres)
  const rosterA = await api('roster', '/api/supplier/roster', { code: 'ESVEDRA' });
  const manA = rosterA && rosterA.staff.find(x => x.role === 'manager');
  const manATok = manA && (await api('kassa-login', '/api/supplier/login', { code: 'ESVEDRA', staffId: manA.id, pin: '1234' })).token;
  if (manATok) await api('transfer', '/api/supplier/transfer', { aan: true, prijs: 0 }, manATok);
  const VANDAAG = new Date().toISOString().slice(0, 10);
  const DFUT = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  for (const a of actors.slice(0, 12)) taken.push((async () => {
    while (bezig()) {
      const tk = await api('ticket-koop', '/api/ticket/koop', { supplierCode: 'ESVEDRA', activiteitId: 'a1', datum: VANDAAG, tijd: '17:30', personen: 1 }, a.token);
      if (tk && tk.ticket) await api('ticket-betaal', '/api/booking/pay', { ref: tk.ticket.ref }, a.token);
      await api('huur-boek', '/api/huur/boek', { supplierCode: 'ISLAREN', autoId: ['c1', 'c2', 'c3'][a.i % 3], van: DFUT, tot: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) }, a.token);
      await slaap(600);
    }
  })());
  // 3e) vastgoed bekijken
  for (const a of actors.slice(0, 12)) taken.push((async () => { while (bezig()) { await api('vastgoed', '/api/vastgoed/aanbod', {}, a.token); await slaap(800); } })());
  // 3f) backoffice + techniek houden toezicht
  taken.push((async () => {
    const tech = await api('techniek', '/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' });
    while (bezig()) { await api('backoffice', '/api/office/state', {}, ownerToken); if (tech) await api('techniek', '/api/techniek/status', null, tech.token, 'GET'); await slaap(2500); }
  })());

  /* 4) gezondheids-sonde */
  let maxGat = 0; const sonde = [];
  taken.push((async () => {
    let vorige = Date.now();
    while (bezig()) { const s0 = Date.now(); try { await verzoek('/api/health', { method: 'GET' }); } catch (e) {} const nu2 = Date.now(); sonde.push(nu2 - s0); maxGat = Math.max(maxGat, nu2 - vorige); vorige = nu2; await new Promise(r => setTimeout(r, 50)); }
  })());

  einde = Date.now() + DUUR_MS;
  rij('spitsuur gestart', 'alle stromen tegelijk, ' + (DUUR_MS / 1000) + ' s');
  await Promise.all(taken);
  sseAborts.forEach(a => a.abort());

  /* ================= RAPPORT ================= */
  kop('RAPPORT per stroom (' + (DUUR_MS / 1000) + ' s bovenop ' + RESTAURANTS.toLocaleString('nl-NL') + ' restaurants)');
  const namen = Object.keys(stromen).sort();
  for (const n of namen) {
    const s = stromen[n];
    console.log('  ' + n.padEnd(18) + String(s.n).padStart(7) + 'x  ok=' + String(s.ok).padStart(7) + '  err=' + String(s.err).padStart(4) +
      '  p50=' + String(pct(s.lat, 50)).padStart(5) + 'ms  p95=' + String(pct(s.lat, 95)).padStart(5) + 'ms' +
      (s.fouten.length ? '   << ' + s.fouten[0] : ''));
  }
  kop('Kassa/keuken-doorstroom');
  const gb = stromen['gast-bestelt'] || { ok: 0 }, dg = stromen['doorgeef'] || { ok: 0 }, ks = stromen['keukenscherm'] || { ok: 0 }, bs = stromen['barscherm'] || { ok: 0 }, pv = stromen['kassa-verkoop'] || { ok: 0 }, ai = stromen['ai-assistent'] || { ok: 0 };
  rij('bonnen besteld / geserveerd', gb.ok + ' / ' + dg.ok);
  rij('keukensectie-meldingen', ks.ok + '  (warm/koud/snack/dessert)');
  rij('bar-meldingen', bs.ok);
  rij('losse kassaverkopen (POS)', pv.ok);
  rij('AI-assistent hulpvragen', ai.ok);

  kop('Live-laag (SSE) en gezondheid');
  rij('open SSE-streams', String(sse.open));
  rij('SSE-events ontvangen', Object.entries(sse.events).map(([k, v]) => k + ':' + v).join('  ') || 'geen');
  rij('gezondheids-sonde p50/p99', pct(sonde, 50) + ' / ' + pct(sonde, 99) + ' ms');
  rij('grootste hapering (max gat)', maxGat + ' ms');
  rij('servergeheugen (RSS) na afloop', rssMB() + ' MB');
  const totaalReq = namen.reduce((a, n) => a + stromen[n].n, 0);
  const totaalErr = namen.reduce((a, n) => a + stromen[n].err, 0);
  rij('totaal verzoeken / fouten', totaalReq + ' / ' + totaalErr);

  cleanup();
  console.log('\nKlaar.');
  process.exit(0);
})().catch(e => { console.error(e); cleanup(); process.exit(1); });
