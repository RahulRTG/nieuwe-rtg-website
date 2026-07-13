/* Spitsuur-test: HET HELE ECOSYSTEEM TEGELIJK, bovenop een miljoen tickets.
   Fase A: zaai 1.000.000 orders/tickets in de datastore en meet boot, geheugen
           en de zware leesroutes.
   Fase B: ~70 s alles door elkaar: leden bestellen en betalen, kassa draait,
           leden bellen en videobellen (WebRTC-signalering), DM's, snaps,
           gastchat, RTF-gezinnen, RTG Zakelijk, backoffice en techniek,
           met open SSE-streams en een gezondheids-sonde (event-loop-haperingen).
   Draai: node spits.js */
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const http = require('http');
/* Eigen ruime keep-alive agent: de standaard fetch-pool raakt verstopt door de
   24 permanent open SSE-streams en dan meet je de wachtrij van de TESTCLIENT
   in plaats van de server. */
const agent = new http.Agent({ keepAlive: true, maxSockets: 512 });
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
    req.setTimeout(120000, () => req.destroy(new Error('timeout')));
    if (data) req.write(data);
    req.end();
  });
}
const ROOT = require('path').join(__dirname, '..');
const PORT = 4060, BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-spits-'));
const TICKETS = Number(process.env.SPITS_TICKETS || 1000000);
const ACTORS = Number(process.env.SPITS_ACTORS || 40);
const DUUR_MS = Number(process.env.SPITS_DUUR || 70000);
const ENV = { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '' };

let child = null;
const cleanup = () => { try { if (child) child.kill('SIGKILL'); } catch (e) {} try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} };
setTimeout(() => { console.log('\nHARD TIMEOUT'); cleanup(); process.exit(1); }, 560000);

const kop = t => console.log('\n\x1b[1m' + t + '\x1b[0m');
const rij = (l, v) => console.log('  ' + l.padEnd(36) + v);
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p / 100))]; };

/* ---- metingen per stroom ---- */
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
  child = spawn(process.execPath, ['--experimental-sqlite', path.join(ROOT, 'server', 'server.js')], { env: ENV, stdio: ['ignore', 'ignore', 'inherit'] });
  for (let i = 0; i < 1200; i++) { try { if ((await fetch(BASE + '/api/health')).ok) return Date.now() - t0; } catch (e) {} await new Promise(r => setTimeout(r, 100)); }
  throw new Error('server komt niet op');
}
function rssMB() {
  try { const m = fs.readFileSync('/proc/' + child.pid + '/status', 'utf8').match(/VmRSS:\s+(\d+) kB/); return m ? Math.round(m[1] / 1024) : null; } catch (e) { return null; }
}
const stopServer = () => new Promise(r => {
  const dit = child; // failsafe mag NOOIT een later geboote server raken
  const failsafe = setTimeout(() => { try { dit.kill('SIGKILL'); } catch (e) {} }, 8000);
  dit.once('exit', () => { clearTimeout(failsafe); r(); });
  dit.kill('SIGTERM');
});

(async () => {
  /* ================= FASE A: een miljoen tickets in de kast ================= */
  kop('FASE A: ' + TICKETS.toLocaleString('nl-NL') + ' tickets in de datastore');
  await bootServer();
  await new Promise(r => setTimeout(r, 800)); // seed laten wegschrijven
  await stopServer();
  const DB = path.join(TMP, 'db.json');
  const data = JSON.parse(fs.readFileSync(DB, 'utf8'));

  const t0 = Date.now();
  const SUPS = ['KIKUNOI', 'PONTO', 'HOSHI', 'SAKURA', 'MKKX', 'JETAG'];
  const NAMEN = { KIKUNOI: 'Sal de Mar', PONTO: 'Sunset Ibiza', HOSHI: 'Aguamarina Ibiza', SAKURA: 'Villa Bahia Ibiza', MKKX: 'Ibiza Executive Cars', JETAG: 'Aria Private Aviation' };
  const orders = data.orders = data.orders || [];
  const NU = Date.now();
  for (let i = 0; i < TICKETS; i++) {
    const sc = SUPS[i % 6];
    orders.push({
      ref: 'RTG-O-H' + i.toString(36).toUpperCase(),
      pickup: 'T' + (i % 46656).toString(36).toUpperCase(),
      supplierCode: sc, supplierName: NAMEN[sc], type: 'restaurant',
      customerTier: 'rtg', customerKey: 'user-' + (100 + i % 800000), customerCodename: 'Zilveren Valk ' + (i % 800000),
      items: [{ id: 1, name: 'Gazpacho de sandia', qty: 1, price: 16 }], total: 16,
      betaalMoment: 'vooraf', status: i % 37 === 0 ? 'klaar' : 'geserveerd', paid: true,
      at: new Date(NU - (i % 7776000) * 1000).toISOString()
    });
  }
  fs.writeFileSync(DB, JSON.stringify(data));
  rij('zaaien + wegschrijven', ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  rij('db.json op schijf', (fs.statSync(DB).size / 1e6).toFixed(0) + ' MB');

  const bootMs = await bootServer();
  rij('boot-tijd met volle kast', (bootMs / 1000).toFixed(1) + ' s');
  rij('servergeheugen (RSS) na boot', rssMB() + ' MB');

  /* zware leesroutes op de volle kast */
  const eig = await api('owner-login', '/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' });
  const ownerToken = eig && eig.token;
  let t = Date.now(); await api('office-state', '/api/office/state', {}, ownerToken);
  rij('backoffice-state (1M orders)', (Date.now() - t) + ' ms');
  const roster = await api('roster', '/api/supplier/roster', { code: 'KIKUNOI' });
  const mgr = roster && roster.staff.find(s => s.role === 'manager');
  t = Date.now();
  const supLogin = await verzoek('/api/supplier/login', { body: { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' } });
  rij('kassa-login + zaak-state (166k)', (Date.now() - t) + ' ms, antwoord ' + (supLogin.tekst.length / 1e6).toFixed(1) + ' MB');

  /* ================= FASE B: spitsuur, alles tegelijk ================= */
  kop('FASE B: spitsuur, ' + (DUUR_MS / 1000) + ' s alles tegelijk');
  let einde = Infinity; // wordt gezet zodra de setup klaar is; loops wachten op de klok
  const bezig = () => Date.now() < einde;
  const slaap = ms => new Promise(r => setTimeout(r, ms + Math.random() * ms));
  const sse = { events: {}, open: 0 };

  /* actoren registreren (echte accounts, business-pas) */
  const actors = [];
  for (let i = 0; i < ACTORS; i++) {
    const reg = await api('registratie', '/api/auth/register', {
      name: 'Spits Lid ' + i, email: 'spits' + i + '@rtg.nl', phone: '06' + (20000000 + i),
      password: 'Spits1234!', geboortedatum: '1985-05-05', tier: 'business', pasApp: 'business'
    });
    if (reg && reg.token) actors.push({ i, token: reg.token });
  }
  for (const a of actors) {
    const c = await api('connecties', '/api/member/connections', {}, a.token);
    a.key = c && c.me; a.codename = c && c.codename;
  }
  rij('actoren geregistreerd', actors.length + ' leden');

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

  /* 1) leden: bestellen, betalen, gastchat, eigen overzicht */
  const refQueue = [];
  for (const a of actors.slice(0, 12)) taken.push((async () => {
    while (bezig()) {
      const sup = ['KIKUNOI', 'PONTO'][a.i % 2];
      const items = sup === 'KIKUNOI' ? [{ id: 'm1', qty: 1 }, { id: 'm3', qty: 2 }] : [{ id: 'b3', qty: 1 }, { id: 'b4', qty: 2 }];
      const o = await api('bestellen', '/api/order', { supplierCode: sup, items }, a.token);
      if (o && o.order) {
        await api('betalen', '/api/order/pay', { ref: o.order.ref }, a.token);
        refQueue.push({ sup, ref: o.order.ref });
      }
      await api('mijn-tickets', '/api/orders/mine', {}, a.token);
      if (a.i % 3 === 0) await api('gastchat', '/api/partner/chat/send', { supplierCode: sup, text: 'Is er plek op het terras?' }, a.token);
      await slaap(120);
    }
  })());

  /* 2) bellen en videobellen: volledige signaleringscyclus tussen verbonden paren */
  const paren = [];
  for (let i = 12; i + 1 < actors.length; i += 2) paren.push([actors[i], actors[i + 1]]);
  for (const [a, b] of paren) {
    await api('vriend-verzoek', '/api/member/connect', { key: b.key }, a.token);
    await api('vriend-accept', '/api/member/connect/respond', { key: a.key, action: 'accept' }, b.token);
  }
  const FOTO = 'data:image/jpeg;base64,' + crypto.randomBytes(9000).toString('base64'); // ~12 kB snap
  for (const [a, b] of paren) taken.push((async () => {
    while (bezig()) {
      await api('dm', '/api/member/dm/send', { toKey: b.key, text: 'Zie je de zonsondergang?' }, a.token);
      // FaceTime-achtig videogesprek: ring -> accept -> offer/answer -> ICE -> hangup
      await api('bellen', '/api/member/call', { toKey: b.key, kind: 'ring', video: true }, a.token);
      await api('bellen', '/api/member/call', { toKey: a.key, kind: 'accept', video: true }, b.token);
      await api('bellen', '/api/member/call', { toKey: b.key, kind: 'offer', video: true, payload: { sdp: 'v=0 demo-offer' } }, a.token);
      await api('bellen', '/api/member/call', { toKey: a.key, kind: 'answer', video: true, payload: { sdp: 'v=0 demo-answer' } }, b.token);
      for (let k = 0; k < 3; k++) await api('bellen', '/api/member/call', { toKey: b.key, kind: 'ice', payload: { candidate: 'candidate:' + k } }, a.token);
      await api('bellen', '/api/member/call', { toKey: b.key, kind: 'hangup' }, a.token);
      await api('snap', '/api/member/snap/send', { toKey: b.key, foto: FOTO, tekst: 'proef' }, a.token);
      const snaps = await api('snap', '/api/member/snaps', {}, b.token);
      if (snaps && snaps.snaps && snaps.snaps[0]) await api('snap', '/api/member/snap/view', { id: snaps.snaps[0].id }, b.token);
      await slaap(200);
    }
  })());

  /* 3) horeca-kassa: personeel logt in, verwerkt orders, slaat kassaverkopen aan */
  const kassas = {};
  for (const supCode of ['KIKUNOI', 'PONTO']) {
    const ro = await api('roster', '/api/supplier/roster', { code: supCode });
    const man = ro && ro.staff.find(s => s.role === 'manager');
    if (man) kassas[supCode] = await api('kassa-login', '/api/supplier/login', { code: supCode, staffId: man.id, pin: '1234' });
  }
  for (const supCode of ['KIKUNOI', 'PONTO']) taken.push((async () => {
    const li = kassas[supCode];
    if (!li) return;
    while (bezig()) {
      const klus = refQueue.find(x => x.sup === supCode);
      if (klus) {
        refQueue.splice(refQueue.indexOf(klus), 1);
        for (const st of ['in bereiding', 'klaar', 'geserveerd'])
          await api('keuken-status', '/api/supplier/order/status', { ref: klus.ref, status: st }, li.token);
      }
      await api('kassa-verkoop', '/api/supplier/pos/sale', { total: 42, method: 'pin', desc: 'tafel 8', items: [{ name: 'Cava', qty: 2, price: 21 }] }, li.token);
      await slaap(180);
    }
  })());

  /* 4) RTF-gezinnen: aanmaken en berichten sturen */
  const gezinnen = [];
  for (let g = 0; g < 3; g++) gezinnen.push(await api('rtf-gezin', '/api/foundation/gezin/maak', { gezinsnaam: 'Spitsgezin ' + g, naam: 'Ouder ' + g, pin: '1234' }));
  for (const gez of gezinnen) taken.push((async () => {
    if (!gez) return;
    while (bezig()) {
      await api('rtf-bericht', '/api/foundation/gezin/bericht', { code: gez.code, token: gez.token, tekst: 'Vergeet je gymtas niet!' });
      await slaap(400);
    }
  })());

  /* 5) RTG Zakelijk: profielen, posts, gids */
  for (const a of actors.slice(0, 6)) await api('zakelijk-profiel', '/api/zakelijk/profiel/zet', { naam: 'Lid ' + a.i, kop: 'Ondernemer', sector: 'Horeca', vaardigheden: ['Gastvrijheid'] }, a.token);
  for (const a of actors.slice(0, 6)) taken.push((async () => {
    while (bezig()) {
      await api('zakelijk', '/api/zakelijk/post', { tekst: 'Mooie avond gedraaid met het team.' }, a.token);
      await api('zakelijk', '/api/zakelijk/feed', {}, a.token);
      await api('zakelijk', '/api/zakelijk/gids', { q: '' }, a.token);
      await slaap(500);
    }
  })());

  /* 6) backoffice + techniek houden toezicht */
  taken.push((async () => {
    const tech = await api('techniek', '/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' });
    while (bezig()) {
      await api('backoffice', '/api/office/state', {}, ownerToken);
      if (tech) await api('techniek', '/api/techniek/status', null, tech.token, 'GET');
      await slaap(2000);
    }
  })());

  /* 7) gezondheids-sonde: haperingen van de event-loop zichtbaar maken */
  let maxGat = 0; const sonde = [];
  taken.push((async () => {
    let vorige = Date.now();
    while (bezig()) {
      const t0 = Date.now();
      try { await verzoek('/api/health', { method: 'GET' }); } catch (e) {}
      const nu2 = Date.now();
      sonde.push(nu2 - t0); maxGat = Math.max(maxGat, nu2 - vorige); vorige = nu2;
      await new Promise(r => setTimeout(r, 50));
    }
  })());

  /* ---- SETUP voor de nieuwe genres ---- */
  // activiteiten (Es Vedra): dienst klaar; transferdienst aan
  const rosterA = await api('roster', '/api/supplier/roster', { code: 'ESVEDRA' });
  const manA = rosterA && rosterA.staff.find(x => x.role === 'manager');
  const gidsA = rosterA && rosterA.staff.find(x => x.role !== 'manager');
  const manATok = manA && (await api('login', '/api/supplier/login', { code: 'ESVEDRA', staffId: manA.id, pin: '1234' })).token;
  const gidsATok = gidsA && (await api('login', '/api/supplier/login', { code: 'ESVEDRA', staffId: gidsA.id, pin: '5678' })).token;
  if (manATok) await api('transfer', '/api/supplier/transfer', { aan: true, prijs: 0 }, manATok);
  // autoverhuur (Isla Rent): balie
  const rosterV = await api('roster', '/api/supplier/roster', { code: 'ISLAREN' });
  const balieV = rosterV && rosterV.staff.find(x => x.role !== 'manager');
  const balieVTok = balieV && (await api('login', '/api/supplier/login', { code: 'ISLAREN', staffId: balieV.id, pin: '5678' })).token;
  // vastgoed (Ibiza Living): makelaar biedt de villa gericht aan alle spits-leden
  const rosterM = await api('roster', '/api/supplier/roster', { code: 'IBIZALIV' });
  const manM = rosterM && rosterM.staff.find(x => x.role === 'manager');
  const manMTok = manM && (await api('login', '/api/supplier/login', { code: 'IBIZALIV', staffId: manM.id, pin: '1234' })).token;
  if (manMTok) await api('vg-aanbod', '/api/supplier/aanbieding', { pandId: 'p1', publiek: true }, manMTok);

  const VANDAAG = new Date().toISOString().slice(0, 10);
  const DFUT = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const FOTO2 = 'data:image/jpeg;base64,' + crypto.randomBytes(300).toString('base64');

  /* 8) activiteiten: tickets kopen + betalen + transfer aanvragen */
  for (const a of actors.slice(12, 22)) taken.push((async () => {
    while (bezig()) {
      const t = await api('ticket-koop', '/api/ticket/koop', { supplierCode: 'ESVEDRA', activiteitId: 'a1', datum: VANDAAG, tijd: '17:30', personen: 1 }, a.token);
      if (t && t.ticket) {
        await api('ticket-betaal', '/api/booking/pay', { ref: t.ticket.ref }, a.token);
        await api('transfer-aanvraag', '/api/transfer/aanvraag', { ticketRef: t.ticket.ref, van: 'Hotel' }, a.token);
      }
      await api('mijn-tickets2', '/api/tickets/mijn', {}, a.token);
      await slaap(300);
    }
  })());
  /* de gids checkt tickets in en neemt transfers aan */
  if (gidsATok) taken.push((async () => {
    while (bezig()) {
      const pr = await api('programma', '/api/supplier/programma', {}, gidsATok);
      const slot = pr && (pr.slots || []).find(x => x.gasten && x.gasten.some(g => !g.binnen));
      if (slot) { const g = slot.gasten.find(x => !x.binnen); if (g) await api('checkin', '/api/supplier/ticket/checkin', { code: g.code }, gidsATok); }
      await slaap(400);
    }
  })());

  /* 9) autoverhuur: auto boeken + betalen + foto vastleggen */
  for (const a of actors.slice(22, 30)) taken.push((async () => {
    while (bezig()) {
      const car = ['c1', 'c2', 'c3'][a.i % 3];
      const h = await api('huur-boek', '/api/huur/boek', { supplierCode: 'ISLAREN', autoId: car, van: DFUT, tot: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) }, a.token);
      if (h && h.huur) {
        await api('huur-betaal', '/api/booking/pay', { ref: h.huur.ref }, a.token);
        await api('huur-foto', '/api/huur/foto', { ref: h.huur.ref, fase: 'voor', foto: FOTO2 }, a.token);
      }
      await api('huur-mijn', '/api/huur/mijn', {}, a.token);
      await slaap(500);
    }
  })());

  /* 10) vastgoed: aanbod bekijken, interesse + bod, keyless-poging */
  for (const a of actors.slice(0, 20)) taken.push((async () => {
    let deed = false;
    while (bezig()) {
      const d = await api('vg-aanbod2', '/api/vastgoed/aanbod', {}, a.token);
      if (d && d.panden && d.panden.length && !deed) {
        await api('vg-interesse', '/api/vastgoed/interesse', { supplierCode: 'IBIZALIV', pandId: d.panden[0].id, wens: 'weekend' }, a.token);
        await api('vg-bod', '/api/vastgoed/bod', { supplierCode: 'IBIZALIV', pandId: d.panden[0].id, bedrag: 3000000 + a.i * 1000 }, a.token);
        deed = true;
      }
      await slaap(700);
    }
  })());
  /* de makelaar behandelt biedingen en bezichtigingen live */
  if (manMTok) taken.push((async () => {
    while (bezig()) {
      const ov = await api('vg-overzicht', '/api/supplier/vastgoed/overzicht', {}, manMTok);
      const bod = ov && (ov.biedingen || []).find(x => x.status === 'open');
      if (bod) await api('vg-bod-beslis', '/api/supplier/bod/beslis', { ref: bod.ref, actie: 'tegenbod', tegenbod: 3400000 }, manMTok);
      const bez = ov && (ov.bezichtigingen || []).find(x => x.status === 'aangevraagd');
      if (bez) await api('vg-bez-beslis', '/api/supplier/bezichtiging/beslis', { ref: bez.ref, actie: 'bevestigen', moment: new Date(Date.now() - 60000).toISOString().slice(0, 16) }, manMTok);
      await slaap(500);
    }
  })());

  /* 11) contracten: de makelaar stuurt contracten, leden tekenen */
  if (manMTok) taken.push((async () => {
    let i = 0;
    while (bezig()) {
      const a = actors[i % actors.length]; i++;
      if (a.codename) await api('contract-maak', '/api/supplier/contract/maak', { soort: 'algemeen', titel: 'Afspraak ' + i, codenaam: a.codename, tekst: 'Dit is een afspraak tussen de partijen conform de RTG-voorwaarden en gebruiken.' }, manMTok);
      await slaap(600);
    }
  })());
  for (const a of actors.slice(0, 20)) taken.push((async () => {
    while (bezig()) {
      const c = await api('contract-mijn', '/api/contracten/mijn', {}, a.token);
      const open = c && (c.contracten || []).find(x => x.status === 'wacht' && !x.getekendDoorMij);
      if (open) await api('contract-teken', '/api/contract/teken', { ref: open.ref, naam: 'Spits Lid', akkoord: true }, a.token);
      await slaap(500);
    }
  })());

    einde = Date.now() + DUUR_MS; // setup klaar: NU begint het spitsuur echt
  rij('spitsuur gestart', 'alle stromen tegelijk, ' + (DUUR_MS / 1000) + ' s');
  await Promise.all(taken);
  sseAborts.forEach(a => a.abort());

  /* ================= RAPPORT ================= */
  kop('RAPPORT per stroom (' + (DUUR_MS / 1000) + ' s spitsuur bovenop ' + TICKETS.toLocaleString('nl-NL') + ' tickets)');
  const namen = Object.keys(stromen).sort();
  for (const n of namen) {
    const s = stromen[n];
    console.log('  ' + n.padEnd(16) + String(s.n).padStart(6) + 'x  ok=' + String(s.ok).padStart(6) + '  err=' + String(s.err).padStart(3) +
      '  p50=' + String(pct(s.lat, 50)).padStart(5) + 'ms  p95=' + String(pct(s.lat, 95)).padStart(5) + 'ms' +
      (s.fouten.length ? '   << ' + s.fouten[0] : ''));
  }
  kop('Live-laag (SSE) en gezondheid');
  rij('open SSE-streams', String(sse.open));
  rij('SSE-events ontvangen', Object.entries(sse.events).map(([k, v]) => k + ':' + v).join('  ') || 'geen');
  rij('gezondheids-sonde p50/p99', pct(sonde, 50) + ' / ' + pct(sonde, 99) + ' ms');
  rij('grootste hapering (max gat)', maxGat + ' ms');
  rij('servergeheugen (RSS) na afloop', rssMB() + ' MB');
  const totaalReq = namen.reduce((t2, n) => t2 + stromen[n].n, 0);
  const totaalErr = namen.reduce((t2, n) => t2 + stromen[n].err, 0);
  rij('totaal verzoeken / fouten', totaalReq + ' / ' + totaalErr);

  cleanup();
  console.log('\nKlaar.');
  process.exit(0);
})().catch(e => { console.error(e); cleanup(); process.exit(1); });
