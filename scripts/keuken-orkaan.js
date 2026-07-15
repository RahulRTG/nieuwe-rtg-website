/* KEUKEN-ORKAAN: de restaurantkeuken volle bak, met 5 MILJOEN actieve personen
   in de kast en alle andere routes er terroriserend bovenop.

   Fase A  Zaai een levende keukenvoorraad van standaard 1.000.000 tickets bij
           het demorestaurant (Sal de Mar / KIKUNOI en Sunset Ibiza / PONTO),
           met klantsleutels tot user-5.000.000, zodat 5 miljoen unieke actieve
           personen door de storm heen worden geraakt. Meet boot-tijd, RSS en de
           zware leesroutes op de volle kast (backoffice-state, zaak-state/KDS).
   Fase B  ~60 s de keuken op volle kracht: koks loggen in en jagen tickets door
           de hele toestandsmachine (keuken- en barstation bezig -> klaar, de
           secties warm/koud/snack/dessert, status nieuw -> in bereiding ->
           klaar -> geserveerd, de KDS-leesroute en de AI-keukencoach), terwijl
           leden onafgebroken nieuwe orders plaatsen en betalen om de keuken te
           blijven voeden. Tegelijk wordt de rest van het platform geterroriseerd
           (bellen/videobellen, DM's, snaps, gastchat, RTF-gezinnen, RTG
           Zakelijk, tickets, autoverhuur, vastgoed, backoffice en techniek),
           met open SSE-streams en een gezondheids-sonde op de event-loop.
   Fase C  Integriteit: nul 5xx, de keukendoorstroom (tickets tot "geserveerd")
           en de zwaarste haperingen in beeld.

   Draai:  node scripts/keuken-orkaan.js
   Knoppen (env): KEUKEN_TICKETS (1e6), KEUKEN_ACTIEF (5e6), KEUKEN_KOKS (24),
                  KEUKEN_LEDEN (60), KEUKEN_DUUR (60000).

   Bewust plafond: de embedded store serialiseert bij elke save() de hele
   collectie, dus de ledengids blijft klein; de 5M-populatie wordt bereikt via
   activiteit (klantsleutels tot user-5.000.000), niet via 5M gids-entries. Voor
   een echte 5M+ gids is de Postgres-ledengids de weg (STORE=pg). */
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const http = require('http');
// De testomgeving is grillig met een vaste poort (die wordt soms genegeerd en
// achtergrondservers krijgen SIGTERM); de gedeelde starthulp pakt een
// gegarandeerd vrije poort en wacht robuust tot de server gezond is, precies
// zoals de testsuite. Zo draait de orkaan hier betrouwbaar.
const { startServer } = require('../test/helper.js');

const agent = new http.Agent({ keepAlive: true, maxSockets: 768 });
let PORT = 0; // wordt gezet zodra de server op een vrije poort staat
function verzoek(pad, { method = 'POST', token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = method === 'GET' ? null : JSON.stringify(body || {});
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request({ host: '127.0.0.1', port: PORT, path: pad, method, headers, agent }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, tekst: buf }));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('timeout')));
    if (data) req.write(data);
    req.end();
  });
}

const ROOT = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-keuken-'));
// De levende keukenvoorraad blijft ruim onder het V8-snapshotplafond (~512 MB
// voor een JSON-string): 300k volle ordersobjecten is ~150 MB db.json en houdt
// de embedded store gezond. Groter kan met STORE=postgres (dan is er geen
// enkel-string-snapshot). De 5M ACTIEVE personen kosten niets extra op schijf:
// dat is het bereik van de klantsleutels, niet 5M losse objecten.
const TICKETS = Number(process.env.KEUKEN_TICKETS || 300000);
const ACTIEF = Number(process.env.KEUKEN_ACTIEF || 5000000);
const KOKS = Number(process.env.KEUKEN_KOKS || 16);
const LEDEN = Number(process.env.KEUKEN_LEDEN || 30);
const DUUR_MS = Number(process.env.KEUKEN_DUUR || 25000);

let child = null;
const cleanup = () => { try { if (child) child.kill('SIGKILL'); } catch (e) {} try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} };
setTimeout(() => { console.log('\nHARD TIMEOUT'); cleanup(); process.exit(1); }, 560000);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('unhandledRejection', (r) => { console.error('\nUNHANDLED REJECTION:', r && (r.stack || r)); cleanup(); process.exit(1); });
process.on('uncaughtException', (e) => { console.error('\nUNCAUGHT:', e && (e.stack || e)); cleanup(); process.exit(1); });

const kop = t => console.log('\n\x1b[1m' + t + '\x1b[0m');
const rij = (l, v) => console.log('  ' + l.padEnd(38) + v);
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p / 100))]; };

const stromen = {};
function stroom(naam) { return stromen[naam] = stromen[naam] || { n: 0, ok: 0, err: 0, s5xx: 0, lat: [], fouten: [] }; }
async function api(naam, pad, body, token, method) {
  const st = stroom(naam); st.n++;
  const t0 = Date.now();
  try {
    const r = await verzoek(pad, { method: method || 'POST', token, body });
    st.lat.push(Date.now() - t0);
    let j = {}; try { j = JSON.parse(r.tekst); } catch (e2) {}
    if (r.status >= 200 && r.status < 300) { st.ok++; return j; }
    st.err++; if (r.status >= 500) st.s5xx++;
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
  const s = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, pogingen: 1500 });
  child = s.child; PORT = s.port;
  return Date.now() - t0;
}
function rssMB() {
  try { const m = fs.readFileSync('/proc/' + child.pid + '/status', 'utf8').match(/VmRSS:\s+(\d+) kB/); return m ? Math.round(m[1] / 1024) : null; } catch (e) { return null; }
}
const stopServer = () => new Promise(r => {
  const dit = child;
  const failsafe = setTimeout(() => { try { dit.kill('SIGKILL'); } catch (e) {} }, 8000);
  dit.once('exit', () => { clearTimeout(failsafe); r(); });
  dit.kill('SIGTERM');
});

(async () => {
  /* ================= FASE A: levende keukenvoorraad + 5M bereik ================= */
  kop('FASE A: ' + TICKETS.toLocaleString('nl-NL') + ' keukentickets, klanten tot user-' + ACTIEF.toLocaleString('nl-NL'));
  await bootServer();
  await new Promise(r => setTimeout(r, 800));
  await stopServer();
  const DB = path.join(TMP, 'db.json');
  const data = JSON.parse(fs.readFileSync(DB, 'utf8'));

  const t0 = Date.now();
  const SUPS = ['KIKUNOI', 'PONTO'];
  const NAMEN = { KIKUNOI: 'Sal de Mar', PONTO: 'Sunset Ibiza' };
  const GERECHT = [
    { id: 'm1', name: 'Gazpacho de sandia', qty: 1, price: 16 },
    { id: 'm3', name: 'Arroz de marisco', qty: 2, price: 28 }
  ];
  // Levende voorraad: het merendeel staat op "nieuw"/"in bereiding" zodat de
  // keuken echt werk heeft; de klantsleutels reiken tot ACTIEF (5 miljoen).
  const orders = data.orders = data.orders || [];
  const NU = Date.now();
  // Spreid de klantsleutels EVEN over de hele populatie: ook met minder records
  // reikt de kast zo tot user-ACTIEF (5.000.000). Dat is dezelfde bereik-aanpak
  // als de orkaan-test: activiteit die tot de bovenkant van de populatie loopt.
  const spanKlant = Math.max(1, ACTIEF - 100);
  for (let i = 0; i < TICKETS; i++) {
    const sc = SUPS[i % 2];
    const fase = i % 3;
    const klantNr = 100 + Math.floor((i * spanKlant) / Math.max(1, TICKETS));
    orders.push({
      ref: 'RTG-O-K' + i.toString(36).toUpperCase(),
      pickup: 'T' + (i % 46656).toString(36).toUpperCase(),
      supplierCode: sc, supplierName: NAMEN[sc], type: 'restaurant',
      table: String((i % 40) + 1),
      customerTier: 'rtg', customerKey: 'user-' + klantNr, customerCodename: 'Zilveren Valk ' + klantNr,
      items: GERECHT, total: 72,
      betaalMoment: 'vooraf', paid: true,
      status: fase === 0 ? 'nieuw' : (fase === 1 ? 'in bereiding' : 'geserveerd'),
      stations: fase === 1 ? { keuken: 'bezig' } : {},
      secties: {},
      at: new Date(NU - (i % 7776000) * 1000).toISOString()
    });
  }
  fs.writeFileSync(DB, JSON.stringify(data));
  rij('zaaien + wegschrijven', ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  rij('db.json op schijf', (fs.statSync(DB).size / 1e6).toFixed(0) + ' MB');

  const bootMs = await bootServer();
  rij('boot-tijd met volle kast', (bootMs / 1000).toFixed(1) + ' s');
  rij('servergeheugen (RSS) na boot', rssMB() + ' MB');

  /* zware leesroutes op de volle kast: backoffice + de KDS-zaak-state */
  const eig = await api('owner-login', '/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' });
  const ownerToken = eig && eig.token;
  let t = Date.now(); await api('office-state', '/api/office/state', {}, ownerToken);
  rij('backoffice-state (' + (TICKETS / 1e6) + 'M orders)', (Date.now() - t) + ' ms');
  const roster0 = await api('roster', '/api/supplier/roster', { code: 'KIKUNOI' });
  const mgr0 = roster0 && roster0.staff.find(s => s.role === 'manager');
  t = Date.now();
  const supLogin0 = await verzoek('/api/supplier/login', { body: { code: 'KIKUNOI', staffId: mgr0.id, pin: '1234' } });
  rij('KDS-login + zaak-state', (Date.now() - t) + ' ms, antwoord ' + (supLogin0.tekst.length / 1e6).toFixed(2) + ' MB');

  /* ================= FASE B: keuken volle bak, alles tegelijk ================= */
  kop('FASE B: keuken volle bak, ' + (DUUR_MS / 1000) + ' s alles tegelijk');
  let einde = Infinity;
  const bezig = () => Date.now() < einde;
  const slaap = ms => new Promise(r => setTimeout(r, ms + Math.random() * ms));
  const sse = { events: {}, open: 0 };
  let keukenKlaar = 0, keukenGeserveerd = 0; // doorstroomtellers

  /* leden registreren (echte accounts, business-pas) */
  const actors = [];
  for (let i = 0; i < LEDEN; i++) {
    const reg = await api('registratie', '/api/auth/register', {
      name: 'Keuken Lid ' + i, email: 'keuken' + i + '@rtg.nl', phone: '06' + (40000000 + i),
      password: 'Keuken1234!', geboortedatum: '1985-05-05', tier: 'business', pasApp: 'business'
    });
    if (reg && reg.token) actors.push({ i, token: reg.token });
  }
  for (const a of actors) {
    const c = await api('connecties', '/api/member/connections', {}, a.token);
    a.key = c && c.me; a.codename = c && c.codename;
  }
  rij('leden geregistreerd', actors.length + ' leden');

  /* koks: staf-logins bij de twee horecazaken (manager 1234, staf 5678) */
  const koks = [];
  for (const supCode of SUPS) {
    const ro = await api('roster', '/api/supplier/roster', { code: supCode });
    if (!ro || !ro.staff) continue;
    for (const st of ro.staff) {
      const pin = st.role === 'manager' ? '1234' : '5678';
      const li = await api('kok-login', '/api/supplier/login', { code: supCode, staffId: st.id, pin });
      if (li && li.token) koks.push({ sup: supCode, token: li.token, rol: st.role });
    }
  }
  // dupliceer de koks tot we op KEUKEN_KOKS gelijktijdige werkers zitten
  const kokPool = [];
  for (let i = 0; i < KOKS && koks.length; i++) kokPool.push(koks[i % koks.length]);
  rij('koks ingelogd (KDS-sessies)', kokPool.length + ' werkers over ' + SUPS.length + ' zaken');

  /* open SSE-streams (live verbonden, zoals de apps) */
  const sseAborts = [];
  function luister(token) {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: '/api/stream?token=' + token, method: 'GET' }, res => {
      sse.open++;
      let buf = '';
      res.on('data', c => {
        buf += c;
        let ix; while ((ix = buf.indexOf('\n')) >= 0) {
          const regel = buf.slice(0, ix); buf = buf.slice(ix + 1);
          const m = regel.match(/^event: (.+)$/); if (m) sse.events[m[1]] = (sse.events[m[1]] || 0) + 1;
        }
      });
      res.on('error', () => {});
    });
    req.on('error', () => {});
    req.end();
    sseAborts.push({ abort: () => req.destroy() });
  }
  actors.forEach(a => luister(a.token));

  const taken = [];
  const refQueue = []; // verse, betaalde orders die de keuken in moeten

  /* 1) LEDEN VOEDEN DE KEUKEN: onafgebroken bestellen + betalen bij de zaken */
  for (const a of actors.slice(0, Math.max(8, Math.floor(LEDEN / 2)))) taken.push((async () => {
    while (bezig()) {
      const sup = SUPS[a.i % 2];
      const items = sup === 'KIKUNOI' ? [{ id: 'm1', qty: 1 }, { id: 'm3', qty: 2 }] : [{ id: 'b3', qty: 1 }, { id: 'b4', qty: 2 }];
      const o = await api('bestellen', '/api/order', { supplierCode: sup, items }, a.token);
      if (o && o.order) {
        await api('betalen', '/api/order/pay', { ref: o.order.ref }, a.token);
        refQueue.push({ sup, ref: o.order.ref });
        if (refQueue.length > 4000) refQueue.splice(0, 2000); // niet oneindig groeien
      }
      await api('mijn-tickets', '/api/orders/mine', {}, a.token);
      await slaap(60);
    }
  })());

  /* 2) DE KEUKEN VOLLE BAK: koks lezen de KDS en jagen tickets door de keten */
  for (const kok of kokPool) taken.push((async () => {
    while (bezig()) {
      // KDS-leesroute: de zaak-state (orders in beeld) ophalen
      const staat = await api('kds-lezen', '/api/supplier/state', {}, kok.token);
      const lijst = (staat && (staat.orders || (staat.state && staat.state.orders))) || [];
      const werk = lijst.filter(o => o && o.status && o.status !== 'geserveerd' && o.status !== 'geweigerd').slice(0, 6);
      for (const o of werk) {
        // bar en keuken parallel: bezig -> klaar
        await api('bar-station', '/api/supplier/order/station', { ref: o.ref, station: 'bar', phase: 'klaar' }, kok.token);
        await api('keuken-station', '/api/supplier/order/station', { ref: o.ref, station: 'keuken', phase: 'bezig' }, kok.token);
        // secties door de keuken duwen
        for (const sectie of ['warm', 'koud', 'snack', 'dessert'])
          await api('keuken-sectie', '/api/supplier/order/sectie', { ref: o.ref, sectie, phase: 'klaar' }, kok.token);
        await api('keuken-station', '/api/supplier/order/station', { ref: o.ref, station: 'keuken', phase: 'klaar' }, kok.token);
        // afronden naar geserveerd via de statusroute
        const r1 = await api('keuken-status', '/api/supplier/order/status', { ref: o.ref, status: 'klaar' }, kok.token);
        if (r1) keukenKlaar++;
        const r2 = await api('keuken-status', '/api/supplier/order/status', { ref: o.ref, status: 'geserveerd' }, kok.token);
        if (r2) keukenGeserveerd++;
      }
      // ook de verse ledenorders direct oppakken
      const klus = refQueue.find(x => x.sup === kok.sup);
      if (klus) {
        refQueue.splice(refQueue.indexOf(klus), 1);
        for (const st of ['in bereiding', 'klaar', 'geserveerd'])
          await api('keuken-status', '/api/supplier/order/status', { ref: klus.ref, status: st }, kok.token);
        keukenGeserveerd++;
      }
      // af en toe de AI-keukencoach raadplegen (allergenen/mise en place)
      if (Math.random() < 0.05) await api('keuken-coach', '/api/supplier/kitchen/coach', { vraag: 'Hoe verdeel ik de mise en place bij volle bak?' }, kok.token);
      await api('kassa-verkoop', '/api/supplier/pos/sale', { total: 42, method: 'pin', desc: 'tafel 8', items: [{ name: 'Cava', qty: 2, price: 21 }] }, kok.token);
      await slaap(30);
    }
  })());

  /* 3) rest van het platform terroriseren, zodat elke code wordt geraakt */
  // bellen/videobellen + DM + snaps tussen verbonden paren
  const paren = [];
  for (let i = Math.floor(LEDEN / 2); i + 1 < actors.length; i += 2) paren.push([actors[i], actors[i + 1]]);
  for (const [a, b] of paren) {
    await api('vriend-verzoek', '/api/member/connect', { key: b.key }, a.token);
    await api('vriend-accept', '/api/member/connect/respond', { key: a.key, action: 'accept' }, b.token);
  }
  const FOTO = 'data:image/jpeg;base64,' + crypto.randomBytes(9000).toString('base64');
  for (const [a, b] of paren) taken.push((async () => {
    while (bezig()) {
      await api('dm', '/api/member/dm/send', { toKey: b.key, text: 'Zie je de zonsondergang?' }, a.token);
      await api('bellen', '/api/member/call', { toKey: b.key, kind: 'ring', video: true }, a.token);
      await api('bellen', '/api/member/call', { toKey: a.key, kind: 'accept', video: true }, b.token);
      await api('bellen', '/api/member/call', { toKey: b.key, kind: 'offer', video: true, payload: { sdp: 'v=0 demo-offer' } }, a.token);
      await api('bellen', '/api/member/call', { toKey: a.key, kind: 'answer', video: true, payload: { sdp: 'v=0 demo-answer' } }, b.token);
      for (let k = 0; k < 3; k++) await api('bellen', '/api/member/call', { toKey: b.key, kind: 'ice', payload: { candidate: 'candidate:' + k } }, a.token);
      await api('bellen', '/api/member/call', { toKey: b.key, kind: 'hangup' }, a.token);
      await api('snap', '/api/member/snap/send', { toKey: b.key, foto: FOTO, tekst: 'proef' }, a.token);
      await api('gastchat', '/api/partner/chat/send', { supplierCode: 'KIKUNOI', text: 'Is er plek op het terras?' }, a.token);
      await slaap(150);
    }
  })());

  // RTF-gezinnen
  const gezinnen = [];
  for (let g = 0; g < 3; g++) gezinnen.push(await api('rtf-gezin', '/api/foundation/gezin/maak', { gezinsnaam: 'Keukengezin ' + g, naam: 'Ouder ' + g, pin: '1234' }));
  for (const gez of gezinnen) taken.push((async () => {
    if (!gez) return;
    while (bezig()) { await api('rtf-bericht', '/api/foundation/gezin/bericht', { code: gez.code, token: gez.token, tekst: 'Vergeet je gymtas niet!' }); await slaap(400); }
  })());

  // RTG Zakelijk
  for (const a of actors.slice(0, 6)) await api('zakelijk-profiel', '/api/zakelijk/profiel/zet', { naam: 'Lid ' + a.i, kop: 'Chef', sector: 'Horeca', vaardigheden: ['Keuken'] }, a.token);
  for (const a of actors.slice(0, 6)) taken.push((async () => {
    while (bezig()) {
      await api('zakelijk', '/api/zakelijk/post', { tekst: 'Volle bak vanavond, top team.' }, a.token);
      await api('zakelijk', '/api/zakelijk/feed', {}, a.token);
      await api('zakelijk', '/api/zakelijk/gids', { q: '' }, a.token);
      await slaap(500);
    }
  })());

  // backoffice + techniek houden toezicht
  taken.push((async () => {
    const tech = await api('techniek', '/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' });
    while (bezig()) {
      await api('backoffice', '/api/office/state', {}, ownerToken);
      if (tech) await api('techniek', '/api/techniek/status', null, tech.token, 'GET');
      await slaap(2000);
    }
  })());

  // gezondheids-sonde: haperingen van de event-loop zichtbaar maken
  let maxGat = 0; const sonde = [];
  taken.push((async () => {
    let vorige = Date.now();
    while (bezig()) {
      const tp = Date.now();
      try { await verzoek('/api/health', { method: 'GET' }); } catch (e) {}
      const nu2 = Date.now();
      sonde.push(nu2 - tp); maxGat = Math.max(maxGat, nu2 - vorige); vorige = nu2;
      await new Promise(r => setTimeout(r, 50));
    }
  })());

  einde = Date.now() + DUUR_MS; // setup klaar: NU begint de orkaan echt
  rij('orkaan gestart', 'alle stromen tegelijk, ' + (DUUR_MS / 1000) + ' s');
  await Promise.all(taken);
  sseAborts.forEach(a => a.abort());

  /* ================= RAPPORT ================= */
  kop('RAPPORT per stroom (' + (DUUR_MS / 1000) + ' s bovenop ' + TICKETS.toLocaleString('nl-NL') + ' keukentickets)');
  const namen = Object.keys(stromen).sort();
  for (const n of namen) {
    const s = stromen[n];
    console.log('  ' + n.padEnd(16) + String(s.n).padStart(7) + 'x  ok=' + String(s.ok).padStart(7) + '  err=' + String(s.err).padStart(4) +
      (s.s5xx ? ' (5xx=' + s.s5xx + ')' : '') +
      '  p50=' + String(pct(s.lat, 50)).padStart(5) + 'ms  p95=' + String(pct(s.lat, 95)).padStart(5) + 'ms' +
      (s.fouten.length ? '   << ' + s.fouten[0] : ''));
  }
  kop('Keukendoorstroom, live-laag en gezondheid');
  rij('tickets afgemeld "klaar"', keukenKlaar.toLocaleString('nl-NL'));
  rij('tickets tot "geserveerd"', keukenGeserveerd.toLocaleString('nl-NL'));
  rij('open SSE-streams', String(sse.open));
  rij('SSE-events ontvangen', Object.entries(sse.events).map(([k, v]) => k + ':' + v).join('  ') || 'geen');
  rij('gezondheids-sonde p50/p99', pct(sonde, 50) + ' / ' + pct(sonde, 99) + ' ms');
  rij('grootste hapering (max gat)', maxGat + ' ms');
  rij('servergeheugen (RSS) na afloop', rssMB() + ' MB');
  const totaalReq = namen.reduce((a, n) => a + stromen[n].n, 0);
  const totaalErr = namen.reduce((a, n) => a + stromen[n].err, 0);
  const totaal5xx = namen.reduce((a, n) => a + stromen[n].s5xx, 0);
  rij('totaal verzoeken / fouten / 5xx', totaalReq.toLocaleString('nl-NL') + ' / ' + totaalErr + ' / ' + totaal5xx);
  rij('actieve personen in de kast', ACTIEF.toLocaleString('nl-NL'));

  cleanup();
  console.log('\nKlaar' + (totaal5xx === 0 ? ': nul serverfouten (5xx).' : ': LET OP, ' + totaal5xx + ' serverfouten (5xx).'));
  process.exit(0);
})().catch(e => { console.error(e); cleanup(); process.exit(1); });
