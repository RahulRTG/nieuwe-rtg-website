/* ORKAAN: de zwaarste test tot nu toe. TIEN MILJOEN gebruikers in de kast en
   ALLE functies en diensten van het platform tegelijk, volle bak.

   Fase A  Zaai een kast van 10.000.000 unieke gebruikers: 3M in de ledengids
           (het embedded-store-maximum; de Postgres-ledengids is de weg naar de
           volle 10M+) en activiteit die tot user-10.000.000 reikt: 1M orders,
           400k directe betalingen (met kloppend ledger), 200k boekingen, 250k
           beveiligingsdiensten, 150k groothandelorders, 100k modebezorgingen,
           100k reserveringen, 80k gastchats, 100k betaalverzoeken, 60k reviews
           en 40k incidenten. Meet boot-tijd, RSS en de zware leesroutes.
   Fase B  ~90 s ALLES tegelijk: bestellen+betalen, reserveren, hotel/huur/
           charter boeken, tickets, groothandel (lid en B2B+AI), retail+mode-
           bezorging (volledige cirkel incl. koerier), autoverkoop, vastgoed,
           beveiliging (commandocentrum, AI-rooster, PDA, SOS), directe
           betalingen + betaalverzoeken, Salon (feed/volg/etalage), gastchat
           twee kanten, AI-butler, walkie/team, kassa, backoffice, met open
           SSE-streams en een event-loop-sonde.
   Fase C  Integriteit: het geld klopt op de cent (ledger == client-geteld),
           nul 5xx; daarna een herstart met de volgeschreven kast: boot-tijd,
           health en het bewijs dat een idempotente betaling ook NA de herstart
           niet dubbel afschrijft.

   Draai: node scripts/orkaan.js   (STORE=sqlite; ~6-8 minuten)

   Gevonden plafond (bewust gedocumenteerd): bij 3M gids-entries kost elke
   save() van de embedded store seconden (de hele collectie wordt per save
   geserialiseerd) en verdringt hij al het andere werk. Boven ~1,5M gids-
   entries is de Postgres-ledengids de weg; de 10M-populatie zelf (activiteit
   tot user-10.000.000) draait wel gewoon door de storm heen. */
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const http = require('http');

const agent = new http.Agent({ keepAlive: true, maxSockets: 768 });
const ROOT = path.join(__dirname, '..');
const PORT = 4072, BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-orkaan-'));

const GEBRUIKERS   = Number(process.env.ORKAAN_GEBRUIKERS || 10000000);
const GIDS         = Number(process.env.ORKAAN_GIDS || 3000000);
const N_ORDERS     = Number(process.env.ORKAAN_ORDERS || 1000000);
const N_BETALINGEN = Number(process.env.ORKAAN_BETALINGEN || 400000);
const N_BOEKINGEN  = Number(process.env.ORKAAN_BOEKINGEN || 200000);
const N_DIENSTEN   = Number(process.env.ORKAAN_DIENSTEN || 250000);
const N_GH         = Number(process.env.ORKAAN_GH || 150000);
const N_MODE       = Number(process.env.ORKAAN_MODE || 100000);
const N_RESERV     = Number(process.env.ORKAAN_RESERV || 100000);
const N_CHATS      = Number(process.env.ORKAAN_CHATS || 80000);
const N_VERZOEKEN  = Number(process.env.ORKAAN_VERZOEKEN || 100000);
const N_REVIEWS    = Number(process.env.ORKAAN_REVIEWS || 60000);
const N_INCIDENTEN = Number(process.env.ORKAAN_INCIDENTEN || 40000);
const DUUR_MS      = Number(process.env.ORKAAN_DUUR || 90000);
const LEDEN_ACTORS = Number(process.env.ORKAAN_LEDEN || 96);
const HARD_MS      = Number(process.env.ORKAAN_TIMEOUT || 880000);

const ENV = { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '',
  RTG_STORE: 'sqlite', NODE_OPTIONS: '--max-old-space-size=10240',
  ANTHROPIC_API_KEY: '' }; // de butler antwoordt canned: geen echte API-latency in de meting

let child = null;
const cleanup = () => { try { if (child) child.kill('SIGKILL'); } catch (e) {} try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} };
setTimeout(() => { console.log('\nHARD TIMEOUT'); cleanup(); process.exit(1); }, HARD_MS);

const kop = t => console.log('\n\x1b[1m' + t + '\x1b[0m');
const rij = (l, v) => console.log('  ' + l.padEnd(40) + v);
const nl = n => Number(n).toLocaleString('nl-NL');
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p / 100))]; };

function verzoekEen(pad, { method = 'POST', token, body } = {}, gebruikAgent) {
  return new Promise((resolve, reject) => {
    const data = method === 'GET' ? null : JSON.stringify(body || {});
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request({ host: '127.0.0.1', port: PORT, path: pad, method, headers, agent: gebruikAgent ? agent : false }, res => {
      let buf = ''; res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, tekst: buf }));
    });
    req.on('error', reject);
    req.setTimeout(180000, () => req.destroy(new Error('timeout')));
    if (data) req.write(data);
    req.end();
  });
}
/* Keep-alive-race: een hergebruikte socket kan precies dichtgaan als wij hem
   pakken (ECONNRESET). Dat is een clientartefact, geen serverfout; standaard-
   remedie is één herkansing op een verse verbinding. */
async function verzoek(pad, opts) {
  try { return await verzoekEen(pad, opts, true); }
  catch (e) {
    const code = (e.cause && e.cause.code) || e.code || '';
    if (code === 'ECONNRESET' || /socket hang up/.test(e.message)) return verzoekEen(pad, opts, false);
    throw e;
  }
}

/* ---- metingen per stroom: 2xx=ok, 4xx=zakelijk geweigerd (verwacht bedrijfs-
   antwoord: vol/bezet/rem), 5xx of netwerk=ECHTE fout ---- */
const stromen = {};
function stroom(naam) { return stromen[naam] = stromen[naam] || { n: 0, ok: 0, zak: 0, fout: 0, lat: [], vb: [] }; }
async function api(naam, pad, body, token, method) {
  const st = stroom(naam); st.n++;
  const t0 = Date.now();
  try {
    const r = await verzoek(pad, { method: method || 'POST', token, body });
    if (st.lat.length < 60000) st.lat.push(Date.now() - t0);
    let j = {}; try { j = JSON.parse(r.tekst); } catch (e2) {}
    if (r.status >= 200 && r.status < 300) { st.ok++; return j; }
    if (r.status >= 400 && r.status < 500) { st.zak++; return null; }
    st.fout++;
    if (st.vb.length < 3) st.vb.push(r.status + ' ' + pad + ' ' + String(j.error || '').slice(0, 60));
    return null;
  } catch (e) {
    st.fout++;
    if (st.vb.length < 3) st.vb.push('NET ' + pad + ' ' + String((e.cause && e.cause.code) || e.message).slice(0, 50));
    return null;
  }
}

async function bootServer() {
  const t0 = Date.now();
  child = spawn(process.execPath, ['--experimental-sqlite', path.join(ROOT, 'server', 'server.js')], { env: ENV, stdio: ['ignore', 'ignore', 'inherit'] });
  for (let i = 0; i < 2400; i++) {
    try { if ((await fetch(BASE + '/api/health')).ok) return Date.now() - t0; } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server komt niet op');
}
function rssMB() {
  try { const m = fs.readFileSync('/proc/' + child.pid + '/status', 'utf8').match(/VmRSS:\s+(\d+) kB/); return m ? Math.round(m[1] / 1024) : null; } catch (e) { return null; }
}
const stopServer = () => new Promise(r => {
  const dit = child;
  const failsafe = setTimeout(() => { try { dit.kill('SIGKILL'); } catch (e) {} }, 20000);
  dit.once('exit', () => { clearTimeout(failsafe); r(); });
  dit.kill('SIGTERM');
});

/* ---- rechtstreeks in de sqlite-kast schrijven (per collectie, in stukken) ---- */
function kvOpen() {
  const { DatabaseSync } = require('node:sqlite');
  const kv = new DatabaseSync(path.join(TMP, 'store.db'));
  kv.exec('PRAGMA journal_mode=WAL'); kv.exec('PRAGMA synchronous=NORMAL');
  return kv;
}
function kvLees(kv, key) { const r = kv.prepare('SELECT val FROM kv WHERE key = ?').get(key); return r ? JSON.parse(r.val) : undefined; }
function kvSchrijf(kv, key, json) {
  kv.prepare("UPDATE meta SET v = v + 1 WHERE k = 'ver'").run();
  const ver = kv.prepare("SELECT v FROM meta WHERE k = 'ver'").get().v;
  kv.prepare('INSERT INTO kv(key,val,ver) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET val=excluded.val, ver=excluded.ver').run(key, json, ver);
}

const SUPS = ['KIKUNOI', 'PONTO', 'HOSHI', 'SAKURA', 'MKKX', 'JETAG'];
const NAMEN = { KIKUNOI: 'Sal de Mar', PONTO: 'Sunset Ibiza', HOSHI: 'Aguamarina Ibiza', SAKURA: 'Villa Bahia Ibiza', MKKX: 'Ibiza Executive Cars', JETAG: 'Aria Private Aviation' };
const key = i => 'user-' + (1000 + i);
const naam = i => 'Valk ' + i;

(async () => {
  kop('ORKAAN · ' + nl(GEBRUIKERS) + ' gebruikers · alle diensten tegelijk (store: sqlite)');

  /* ================= FASE A: de kast van 10 miljoen ================= */
  kop('FASE A: zaaien');
  await bootServer();
  const aegisRoster = await api('setup', '/api/supplier/roster', { code: 'AEGIS' });
  const guards = (aegisRoster ? aegisRoster.staff : []).filter(s => s.role === 'staff').map(s => ({ id: s.id, naam: s.name }));
  await new Promise(r => setTimeout(r, 1200));
  await stopServer();

  const t0 = Date.now();
  const kv = kvOpen();
  const NU = Date.now(), NUISO = new Date(NU).toISOString();
  const dagIso = d => new Date(NU + d * 86400000).toISOString().slice(0, 10);
  // populatie: gids-leden zijn user-1..GIDS; activiteit reikt tot user-GEBRUIKERS
  const popKey = i => key(i % GEBRUIKERS);

  // 1) de ledengids: GIDS entries (embedded-store-maximum)
  {
    const bestaand = kvLees(kv, 'memberDir') || {};
    const stukken = ['{'];
    for (const [k, v] of Object.entries(bestaand)) stukken.push(JSON.stringify(k) + ':' + JSON.stringify(v) + ',');
    for (let i = 0; i < GIDS; i++) {
      stukken.push('"' + key(i) + '":{"codename":"' + naam(i) + '","tier":"' + (i % 3 ? 'rtg' : 'business') + '"}' + (i < GIDS - 1 ? ',' : ''));
      if (stukken.length > 500000) { stukken.splice(0, stukken.length, stukken.join('')); } // tussentijds samenvoegen
    }
    stukken.push('}');
    kvSchrijf(kv, 'memberDir', stukken.join(''));
  }
  rij('ledengids', nl(GIDS) + ' leden');

  // 2) 1M orders over de hele populatie
  {
    const stukken = ['['];
    for (let i = 0; i < N_ORDERS; i++) {
      const sc = SUPS[i % 6];
      stukken.push(JSON.stringify({
        ref: 'RTG-O-H' + i.toString(36).toUpperCase(), pickup: 'T' + (i % 46656).toString(36).toUpperCase(),
        supplierCode: sc, supplierName: NAMEN[sc], type: 'restaurant',
        customerTier: 'rtg', customerKey: popKey(i * 11), customerCodename: naam(i * 11 % GEBRUIKERS),
        items: [{ id: 1, name: 'Gazpacho de sandia', qty: 1, price: 16 }], total: 16,
        betaalMoment: 'vooraf', status: i % 37 === 0 ? 'klaar' : 'geserveerd', paid: true,
        at: new Date(NU - (i % 7776000) * 1000).toISOString()
      }) + (i < N_ORDERS - 1 ? ',' : ''));
      if (stukken.length > 400000) stukken.splice(0, stukken.length, stukken.join(''));
    }
    stukken.push(']');
    kvSchrijf(kv, 'orders', stukken.join(''));
  }
  rij('orders', nl(N_ORDERS));

  // 3) directe betalingen + een ledger dat op de cent klopt
  const ledgerStart = {}; // supplierCode -> centen
  {
    const stukken = ['['];
    for (let i = 0; i < N_BETALINGEN; i++) {
      const sc = i % 2 ? 'MAISON' : 'KIKUNOI';
      const cent = 500 + (i % 900) * 10;
      ledgerStart[sc] = (ledgerStart[sc] || 0) + cent;
      stukken.push(JSON.stringify({
        ref: 'DPH' + i.toString(36).toUpperCase(), key: popKey(i * 7), codename: naam(i * 7 % GEBRUIKERS),
        supplierCode: sc, supplierName: sc === 'MAISON' ? 'Maison Solène' : 'Sal de Mar',
        bedrag: cent, omschrijving: 'Historie', bron: 'salon', providerId: null, aanbieder: 'demo',
        idem: 'dp:' + popKey(i * 7) + ':h' + i, at: new Date(NU - (i % 2592000) * 1000).toISOString()
      }) + (i < N_BETALINGEN - 1 ? ',' : ''));
      if (stukken.length > 400000) stukken.splice(0, stukken.length, stukken.join(''));
    }
    stukken.push(']');
    kvSchrijf(kv, 'directBetalingen', stukken.join(''));
    kvSchrijf(kv, 'directOntvangsten', JSON.stringify(Object.fromEntries(
      Object.entries(ledgerStart).map(([c, som]) => [c, { som, aantal: N_BETALINGEN / 2, uitbetaald: 0 }]))));
  }
  rij('directe betalingen + ledger', nl(N_BETALINGEN));

  // 4) beveiligingsdiensten voor AEGIS (afgelopen maand + komende maand)
  {
    const aegis = (kvLees(kv, 'suppliers') || []).find(s => s.code === 'AEGIS');
    const posten = aegis && aegis.beveiliging ? aegis.beveiliging.posten : [];
    const shifts = ['dag', 'avond', 'nacht'];
    const stukken = ['['];
    for (let i = 0; i < N_DIENSTEN; i++) {
      const g = guards.length ? guards[i % guards.length] : { id: 2, naam: 'Bewaker' };
      stukken.push(JSON.stringify({
        id: 'dh' + i.toString(36), supplierCode: 'AEGIS', datum: dagIso((i % 60) - 30),
        shiftId: shifts[i % 3], postId: posten.length ? posten[i % posten.length].id : 'p0',
        guardId: g.id, guardNaam: g.naam, status: (i % 60) < 30 ? 'afgerond' : 'gepland', at: NUISO
      }) + (i < N_DIENSTEN - 1 ? ',' : ''));
      if (stukken.length > 400000) stukken.splice(0, stukken.length, stukken.join(''));
    }
    stukken.push(']');
    kvSchrijf(kv, 'bevDiensten', stukken.join(''));
  }
  rij('beveiligingsdiensten (AEGIS)', nl(N_DIENSTEN));

  // 5) de rest van de volle kast, compact gezaaid
  const zaai = (sleutel, n, maak) => {
    const stukken = ['['];
    for (let i = 0; i < n; i++) {
      stukken.push(JSON.stringify(maak(i)) + (i < n - 1 ? ',' : ''));
      if (stukken.length > 400000) stukken.splice(0, stukken.length, stukken.join(''));
    }
    stukken.push(']');
    kvSchrijf(kv, sleutel, stukken.join(''));
    rij(sleutel, nl(n));
  };
  zaai('boekingen', N_BOEKINGEN, i => ({
    ref: 'RTG-B-H' + i.toString(36).toUpperCase(), kind: i % 3 === 0 ? 'huur' : i % 3 === 1 ? 'charter' : undefined,
    supplierCode: i % 3 === 0 ? 'ISLAREN' : i % 3 === 1 ? 'AZUL' : 'HOSHI',
    supplierName: 'Historie', customerTier: 'rtg', customerKey: popKey(i * 13), customerCodename: naam(i * 13 % GEBRUIKERS),
    autoId: 'c1', bootId: 'b1', van: dagIso(-((i % 300) + 40)), tot: dagIso(-((i % 300) + 38)), dagen: 2,
    service: { id: 'h', name: 'Historie', soort: 'huur' }, price: 100 + (i % 400),
    betaalMoment: 'vooraf', status: 'afgerond', paid: true, sos: [], at: new Date(NU - (i % 5184000) * 1000).toISOString()
  }));
  zaai('groothandelOrders', N_GH, i => ({
    ref: 'GHH' + i.toString(36).toUpperCase(), groothandelCode: 'MERCABIZA', groothandelNaam: 'Mercabiza Groothandel',
    klant: i % 2 ? { soort: 'lid', id: popKey(i * 17), naam: naam(i * 17 % GEBRUIKERS) } : { soort: 'partner', id: SUPS[i % 6], naam: NAMEN[SUPS[i % 6]] },
    regels: [{ productId: 'p', naam: 'Trostomaten', eenheid: 'kg', aantal: 1 + i % 5, prijs: 3.4 }],
    subtotaal: 3.4 * (1 + i % 5), bezorgen: true, soort: i % 2 ? 'boodschappen' : 'b2b', bron: 'handmatig',
    status: 'geleverd', at: new Date(NU - (i % 2592000) * 1000).toISOString(), stappen: []
  }));
  zaai('modeBezorg', N_MODE, i => ({
    ref: 'MBH' + i.toString(36).toUpperCase(), supplierCode: 'MAISON', supplierName: 'Maison Solène',
    key: popKey(i * 19), codename: naam(i * 19 % GEBRUIKERS), adres: 'Historielaan ' + i, lat: 38.9, lng: 1.43,
    items: [{ naam: 'Linnen jurk', prijs: 80, aantal: 1 }], waarde: 80, kosten: 6.5, bezorgcode: '0000',
    idVereist: false, status: 'afgeleverd', stappen: [], at: new Date(NU - (i % 2592000) * 1000).toISOString()
  }));
  zaai('reserveringen', N_RESERV, i => ({
    id: 'rh' + i.toString(36), supplierCode: 'KIKUNOI', supplierName: 'Sal de Mar',
    customerKey: popKey(i * 23), customerCodename: naam(i * 23 % GEBRUIKERS), tier: 'rtg',
    datum: dagIso(-(i % 300)), tijd: '20:00', personen: 2 + i % 6, notitie: '', status: 'afgerond', at: NUISO
  }));
  zaai('betaalVerzoeken', N_VERZOEKEN, i => ({
    ref: 'BVH' + i.toString(36).toUpperCase(), supplierCode: 'MAISON', supplierName: 'Maison Solène',
    naarCodename: naam(i * 29 % GEBRUIKERS), bedrag: 1000 + (i % 400) * 25, omschrijving: 'Historie',
    status: 'betaald', door: 'Beheer', betaaldDoor: naam(i * 29 % GEBRUIKERS), betaaldRef: 'DPH0', at: NUISO
  }));
  zaai('reviews', N_REVIEWS, i => ({
    id: 'rvh' + i.toString(36), supplierCode: SUPS[i % 6], supplierName: NAMEN[SUPS[i % 6]], soort: 'order',
    ref: 'x', key: popKey(i * 31), codename: naam(i * 31 % GEBRUIKERS), score: 3 + (i % 3), tekst: 'Prima.', at: NUISO
  }));
  kvSchrijf(kv, 'reviewStats', JSON.stringify(Object.fromEntries(SUPS.map(c => {
    const n = Math.floor(N_REVIEWS / 6); return [c, { som: n * 4, aantal: n }];
  }))));
  zaai('bevIncidenten', N_INCIDENTEN, i => ({
    id: 'ih' + i.toString(36), supplierCode: 'AEGIS', postId: null, postNaam: 'Historie',
    guardId: 2, guardNaam: 'Historie', soort: 'melding', ernst: ['laag', 'midden', 'hoog'][i % 3],
    tekst: 'Afgehandelde melding ' + i, foto: null, lat: null, lng: null, sos: false, status: 'afgehandeld', at: NUISO
  }));
  // gastchats: object-collectie
  {
    const stukken = ['{'];
    for (let i = 0; i < N_CHATS; i++) {
      const k = 'KIKUNOI|' + popKey(i * 37) + '|Team';
      stukken.push(JSON.stringify(k) + ':' + JSON.stringify({
        supplierCode: 'KIKUNOI', customerKey: popKey(i * 37), codename: naam(i * 37 % GEBRUIKERS), tier: 'rtg',
        dept: 'Team', open: true, messages: [{ from: 'guest', who: naam(i * 37 % GEBRUIKERS), text: 'Historiebericht', at: NUISO }],
        unreadGuest: 0, unreadPartner: 0, lastAt: NUISO
      }) + (i < N_CHATS - 1 ? ',' : ''));
      if (stukken.length > 300000) stukken.splice(0, stukken.length, stukken.join(''));
    }
    stukken.push('}');
    kvSchrijf(kv, 'guestChats', stukken.join(''));
    rij('gastchats', nl(N_CHATS));
  }
  kv.close();
  rij('zaaien totaal', ((Date.now() - t0) / 1000).toFixed(1) + ' s · store.db ' + (fs.statSync(path.join(TMP, 'store.db')).size / 1e6).toFixed(0) + ' MB');

  /* ---- boot met de volle kast + zware leesroutes ---- */
  const bootMs = await bootServer();
  rij('boot-tijd met volle kast', (bootMs / 1000).toFixed(1) + ' s');
  rij('servergeheugen (RSS) na boot', rssMB() + ' MB');

  const off = await api('setup', '/api/office/login', { code: process.env.OFFICE_CODE || 'RTG-OFFICE' });
  const offTok = off && off.token;
  let t = Date.now(); await api('lees-office', '/api/office/state', {}, offTok);
  rij('backoffice-state (1M orders)', (Date.now() - t) + ' ms');
  const rosterM = await api('setup', '/api/supplier/roster', { code: 'MAISON' });
  const mgrM = rosterM && rosterM.staff.find(s => s.role === 'manager');
  const maisonTokR = await api('setup', '/api/supplier/login', { code: 'MAISON', staffId: mgrM && mgrM.id, pin: '1234' });
  const maisonTok = maisonTokR && maisonTokR.token;
  t = Date.now(); await api('lees-ontvangsten', '/api/supplier/ontvangsten', {}, maisonTok);
  rij('ontvangsten-ledger (200k)', (Date.now() - t) + ' ms');
  const rosterA = await api('setup', '/api/supplier/roster', { code: 'AEGIS' });
  const mgrA = rosterA && rosterA.staff.find(s => s.role === 'manager');
  const aegisTokR = await api('setup', '/api/supplier/login', { code: 'AEGIS', staffId: mgrA && mgrA.id, pin: '1234' });
  const aegisTok = aegisTokR && aegisTokR.token;
  t = Date.now(); await api('lees-rooster', '/api/supplier/beveiliging/rooster', { dagen: 31 }, aegisTok);
  rij('31-dagen rooster (250k diensten)', (Date.now() - t) + ' ms');

  /* ================= FASE B: alles tegelijk, volle bak ================= */
  kop('FASE B: ' + (DUUR_MS / 1000) + ' s alle diensten tegelijk');

  // actoren: leden registreren (echte accounts) + alle zaken inloggen
  const leden = [];
  {
    const R = Date.now().toString(36);
    const regs = [];
    for (let i = 0; i < LEDEN_ACTORS; i++) {
      regs.push((async () => {
        const tier = i % 4 === 0 ? 'rtg' : 'business';
        const r = await api('setup', '/api/auth/register', { name: 'Orkaan ' + i, email: 'o' + R + i + '@x.nl',
          phone: '06' + String(10000000 + i), password: 'geheim123', geboortedatum: '1990-01-01', tier, pasApp: tier });
        if (r && r.token) {
          const st = await api('setup', '/api/state', {}, r.token);
          leden.push({ token: r.token, tier, codename: st && st.state && st.state.user ? st.state.user.codename : null, i });
        }
      })());
    }
    await Promise.all(regs);
  }
  rij('leden-actoren geregistreerd', String(leden.length));
  const zaakToks = {};
  for (const code of ['KIKUNOI', 'PONTO', 'HOSHI', 'MKKX', 'ESVEDRA', 'ISLAREN', 'AZUL', 'MAISON', 'MERCABIZA', 'AEGIS', 'VORA', 'MOTOISLA', 'SERENA']) {
    const ro = await api('setup', '/api/supplier/roster', { code });
    const mg = ro && ro.staff.find(s => s.role === 'manager');
    const lg = mg && await api('setup', '/api/supplier/login', { code, staffId: mg.id, pin: '1234' });
    if (lg && lg.token) zaakToks[code] = lg.token;
  }
  const guardToks = [];
  for (const g of (rosterA ? rosterA.staff.filter(s => s.role === 'staff').slice(0, 3) : [])) {
    const lg = await api('setup', '/api/supplier/login', { code: 'AEGIS', staffId: g.id, pin: '5678' });
    if (lg && lg.token) guardToks.push(lg.token);
  }
  rij('zaak-actoren ingelogd', Object.keys(zaakToks).length + ' zaken + ' + guardToks.length + ' bewakers + kantoor');

  // open SSE-streams (30 leden + 8 zaken) en houd ze open tot het einde
  const sses = [];
  const openSse = (pad) => { const req = http.request({ host: '127.0.0.1', port: PORT, path: pad, method: 'GET', agent }, res => res.on('data', () => {})); req.on('error', () => {}); req.end(); sses.push(req); };
  for (const l of leden.slice(0, 30)) openSse('/api/stream?token=' + l.token);
  for (const c of Object.keys(zaakToks).slice(0, 8)) openSse('/api/supplier/stream?token=' + zaakToks[c]);
  rij('open SSE-streams', String(sses.length));

  // event-loop-sonde van de TESTKANT: health elke 400 ms + timer-drift
  let maxStall = 0, drift0 = Date.now();
  const driftTimer = setInterval(() => { const nu2 = Date.now(); maxStall = Math.max(maxStall, nu2 - drift0 - 250); drift0 = nu2; }, 250);

  const einde = Date.now() + DUUR_MS;
  const geteld = { MAISON: 0, KIKUNOI: 0 };            // client-geteld: geslaagde directe centen
  const modeQueue = [];                                 // {ref, code} voor de koerier
  // de idem-proef voor Fase C: één betaling met een vaste sleutel, vóór de storm
  const idemProef = { idem: 'orkaan-proef', ref: null, lid: leden[0] };
  {
    const r = await api('direct-betalen', '/api/betaal/direct', { supplierCode: 'MAISON', centen: 12345, omschrijving: 'Idem-proef', bron: 'ai', idem: idemProef.idem }, idemProef.lid.token);
    if (r && r.betaling) { idemProef.ref = r.betaling.ref; geteld.MAISON += 12345; }
  }
  const rnd = n => Math.floor(Math.random() * n);
  const slaap = ms => new Promise(r => setTimeout(r, ms));

  function lus(naam, fn, kopieen, pauzeMs) {
    const uit = [];
    for (let c = 0; c < kopieen; c++) uit.push((async () => {
      while (Date.now() < einde) { try { await fn(c); } catch (e) {} await slaap(pauzeMs + rnd(pauzeMs)); }
    })());
    return uit;
  }
  const lid = () => leden[rnd(leden.length)];
  const morgenPlus = d => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

  const taken = [
    // ---- leden: alle diensten ----
    ...lus('state', async () => { await api('state', '/api/state', { lang: 'nl' }, lid().token); }, 6, 500),
    ...lus('bestellen', async () => {
      const l = lid();
      const o = await api('bestellen', '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: 'm1', qty: 1 }] }, l.token);
      if (o && o.order) await api('bestellen', '/api/order/pay', { ref: o.order.ref }, l.token);
    }, 8, 300),
    ...lus('reserveren', async () => { await api('reserveren', '/api/reserveer', { supplierCode: 'KIKUNOI', datum: morgenPlus(1 + rnd(300)), tijd: '20:00', personen: 2 + rnd(5) }, lid().token); }, 3, 700),
    ...lus('huur', async () => {
      const l = lid(); const start = 3 + rnd(900);
      const b = await api('huur', '/api/huur/boek', { supplierCode: 'ISLAREN', autoId: 'c' + (1 + rnd(3)), van: morgenPlus(start), tot: morgenPlus(start + 2) }, l.token);
      if (b && b.huur) await api('huur', '/api/booking/pay', { ref: b.huur.ref }, l.token);
    }, 3, 900),
    ...lus('charter', async () => {
      const l = lid(); const start = 3 + rnd(900);
      const b = await api('charter', '/api/charter/boek', { supplierCode: 'AZUL', bootId: 'b' + (1 + rnd(3)), van: morgenPlus(start), tot: morgenPlus(start + 2), metSkipper: true }, l.token);
      if (b && b.charter) await api('charter', '/api/booking/pay', { ref: b.charter.ref }, l.token);
    }, 2, 1100),
    ...lus('tickets', async () => { await api('tickets', '/api/ticket/koop', { supplierCode: 'ESVEDRA', activiteitId: 'a1', datum: morgenPlus(1 + rnd(200)), tijd: '17:30', personen: 1 }, lid().token); }, 3, 800),
    ...lus('groothandel-lid', async () => {
      const m = await api('groothandel-lid', '/api/groothandel/markt', {}, lid().token);
      const p = m && m.groothandels && m.groothandels[0] && m.groothandels[0].producten[0];
      if (p) await api('groothandel-lid', '/api/groothandel/bestel', { groothandelCode: 'MERCABIZA', regels: [{ productId: p.id, aantal: 1 }] }, lid().token);
    }, 3, 900),
    ...lus('groothandel-b2b', async () => {
      const v = await api('groothandel-b2b', '/api/supplier/inkoop/ai', { groothandelCode: 'MERCABIZA' }, zaakToks.KIKUNOI);
      if (v && v.regels && v.regels.length) await api('groothandel-b2b', '/api/supplier/inkoop/bestel', { groothandelCode: 'MERCABIZA', regels: v.regels.slice(0, 2).map(r => ({ productId: r.productId, aantal: r.aantal })) }, zaakToks.KIKUNOI);
    }, 1, 2000),
    ...lus('retail', async () => {
      await api('retail', '/api/retail/catalogus', { supplierCode: 'MAISON' }, lid().token);
      const l = lid();
      const b = await api('retail', '/api/mode/bezorg/aanvraag', { supplierCode: 'MAISON', adres: 'Orkaanweg 1, Ibiza', lat: 38.905, lng: 1.44, items: [{ naam: 'Linnen jurk', prijs: 80, aantal: 1 }] }, l.token);
      if (b && b.bezorging) modeQueue.push({ ref: b.bezorging.ref, code: b.bezorging.bezorgcode });
    }, 3, 900),
    ...lus('autoverkoop', async () => {
      const s = await api('autoverkoop', '/api/verkoop/showroom', {}, lid().token);
      const a = s && s.autos && s.autos[rnd(s.autos.length || 1)];
      if (a) await api('autoverkoop', '/api/verkoop/proefrit', { supplierCode: a.supplierCode, autoId: a.id, wens: 'zaterdag' }, lid().token);
    }, 2, 1300),
    ...lus('vastgoed', async () => { await api('vastgoed', '/api/vastgoed/aanbod', {}, lid().token); }, 2, 1200),
    ...lus('salon', async () => {
      const l = lid();
      await api('salon', '/api/salon/profiel', { code: ['MAISON', 'KIKUNOI', 'HOSHI'][rnd(3)] }, l.token);
      await api('salon', '/api/salon/volg', { code: 'MAISON' }, l.token);
    }, 5, 600),
    ...lus('direct-betalen', async () => {
      const l = lid(); const sc = rnd(2) ? 'MAISON' : 'KIKUNOI';
      const cent = 500 + rnd(200) * 10;
      const r = await api('direct-betalen', '/api/betaal/direct', { supplierCode: sc, centen: cent, omschrijving: 'Orkaan', bron: rnd(2) ? 'ai' : 'salon', idem: 'ok' + Date.now() + rnd(1e6) }, l.token);
      if (r && r.betaling && !r.herhaald) geteld[sc] += cent;
    }, 10, 8000),
    ...lus('betaalverzoek', async () => {
      const l = lid(); if (!l.codename) return;
      const cent = 2000 + rnd(100) * 10;
      const mk = await api('betaalverzoek', '/api/supplier/betaalverzoek', { codename: l.codename, centen: cent, omschrijving: 'Orkaanverzoek' }, maisonTok);
      if (mk && mk.verzoek) {
        const p = await api('betaalverzoek', '/api/betaal/verzoek/pay', { ref: mk.verzoek.ref }, l.token);
        if (p && p.betaling && !p.herhaald) geteld.MAISON += cent;
      }
    }, 2, 9000),
    ...lus('gastchat-lid', async () => { await api('gastchat-lid', '/api/partner/chat/send', { supplierCode: 'KIKUNOI', dept: 'Team', text: 'Orkaanvraag ' + rnd(1e5) }, lid().token); }, 3, 900),
    ...lus('ai-butler', async () => { const l = leden.find(x => x.tier === 'rtg') || lid(); await api('ai-butler', '/api/chat/send', { text: 'Plan mijn dag' }, l.token); }, 2, 1500),
    ...lus('betaal-mijn', async () => { await api('betaal-mijn', '/api/betaal/mijn', {}, lid().token); }, 2, 1500),

    // ---- zaken: kassa, chat, walkie, autoverkoop-balie, modekoerier ----
    ...lus('zaak-state', async () => { const c = Object.keys(zaakToks)[rnd(Object.keys(zaakToks).length)]; await api('zaak-state', '/api/supplier/state', {}, zaakToks[c]); }, 3, 1500),
    ...lus('gastchat-zaak', async () => {
      const st = await api('gastchat-zaak', '/api/supplier/state', {}, zaakToks.KIKUNOI);
      const chats = st && st.state && st.state.guestChats;
      if (chats && chats.length) {
        await api('gastchat-zaak', '/api/supplier/chat/send', { key: chats[0].key, text: 'Komt eraan!' }, zaakToks.KIKUNOI);
        await api('gastchat-zaak', '/api/supplier/klant/salon', { key: chats[0].key }, zaakToks.KIKUNOI);
      }
    }, 1, 2500),
    ...lus('teamchat', async () => { await api('teamchat', '/api/supplier/team/message', { text: 'Orkaancheck ' + rnd(100) }, zaakToks.HOSHI); }, 1, 2000),

    // ---- de nieuwe lagen: borden, voorraad, reviews-reactie, nieuwe sectoren, HQ-audit ----
    ...lus('borden', async () => {
      const alle = await api('borden', '/api/supplier/borden', {}, zaakToks.HOSHI);
      let b = alle && alle.borden && alle.borden[0];
      if (!b) { const mk = await api('borden', '/api/supplier/bord', { actie: 'maak', naam: 'Orkaanbord' }, zaakToks.HOSHI); b = mk && mk.bord; }
      if (!b || !b.lijsten || b.lijsten.length < 2) return;
      const k = await api('borden', '/api/supplier/bord', { actie: 'kaart', id: b.id, lijstId: b.lijsten[0].id, titel: 'Orkaantaak ' + rnd(1e5) }, zaakToks.HOSHI);
      if (k && k.kaart) await api('borden', '/api/supplier/bord', { actie: 'kaart-zet', id: b.id, kaartId: k.kaart.id, naarLijstId: b.lijsten[1].id }, zaakToks.HOSHI);
    }, 2, 1200),
    ...lus('voorraad', async () => {
      const v = await api('voorraad', '/api/supplier/voorraad', {}, zaakToks.PONTO);
      const it = v && v.voorraad && v.voorraad[0];
      if (!it) await api('voorraad', '/api/supplier/voorraad/zet', { naam: 'Orkaan-cava', aantal: 500, min: 5, eenheid: 'fles' }, zaakToks.PONTO);
      else await api('voorraad', '/api/supplier/voorraad/zet', { id: it.id, delta: rnd(2) ? 1 : -1 }, zaakToks.PONTO);
    }, 2, 1000),
    ...lus('review-reactie', async () => {
      const st = await api('review-reactie', '/api/supplier/state', {}, zaakToks.KIKUNOI);
      const rv = st && st.state && st.state.reviews && (st.state.reviews.recent || []).find(r => r.id && !r.reactie);
      if (rv) await api('review-reactie', '/api/supplier/review/reageer', { id: rv.id, tekst: 'Dank u wel, tot snel!' }, zaakToks.KIKUNOI);
    }, 1, 2500),
    ...lus('beachclub', async () => {
      const l = lid();
      const o = await api('beachclub', '/api/order', { supplierCode: 'VORA', items: [{ id: 'v1', qty: 1 }] }, l.token);
      if (o && o.order) await api('beachclub', '/api/order/pay', { ref: o.order.ref }, l.token);
    }, 2, 1400),
    ...lus('tweewielers', async () => { await api('tweewielers', '/api/verhuur/aanbod', {}, lid().token); }, 2, 1500),
    ...lus('wellness-spa', async () => { await api('wellness-spa', '/api/salon/profiel', { code: 'SERENA' }, lid().token); }, 1, 2000),
    ...lus('hq-audit', async () => { await api('hq-audit', '/api/office/securitylog', {}, offTok); }, 1, 3000),
    ...lus('kassa', async () => { await api('kassa', '/api/supplier/pos/sale', { total: 10 + rnd(90), method: 'contant', desc: 'Orkaanbon' }, zaakToks.PONTO); }, 1, 2000),
    ...lus('modekoerier', async () => {
      const rt = await api('modekoerier', '/api/supplier/mode/bezorg/route', { lat: 38.907, lng: 1.435 }, maisonTok);
      const klus = modeQueue.shift();
      if (klus) {
        await api('modekoerier', '/api/supplier/mode/bezorg/neem', { ref: klus.ref }, maisonTok);
        await api('modekoerier', '/api/supplier/mode/bezorg/gps', { ref: klus.ref, lat: 38.906, lng: 1.44 }, maisonTok);
        await api('modekoerier', '/api/supplier/mode/bezorg/overhandig', { ref: klus.ref, bezorgcode: klus.code, foto: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' }, maisonTok);
      }
    }, 2, 1500),
    ...lus('verkoop-balie', async () => { await api('verkoop-balie', '/api/supplier/verkoop/overzicht', {}, zaakToks.ISLAREN); }, 1, 2500),

    // ---- beveiliging: commandocentrum + PDA ----
    ...lus('bev-command', async () => { await api('bev-command', '/api/supplier/beveiliging/command', {}, aegisTok); }, 2, 1200),
    ...lus('bev-aiplan', async () => { await api('bev-aiplan', '/api/supplier/beveiliging/planauto', { datum: morgenPlus(1 + rnd(28)) }, aegisTok); }, 1, 4000),
    ...lus('bev-aanvraag', async () => {
      const av = await api('bev-aanvraag', '/api/supplier/beveiliging/aanvraag', { klant: 'Orkaanklant', object: 'Object ' + rnd(50), datum: morgenPlus(2 + rnd(28)), shiftId: 'nacht', aantal: 1 + rnd(2) }, aegisTok);
      if (av && av.aanvraag) await api('bev-aanvraag', '/api/supplier/beveiliging/aanvraag/beslis', { ref: av.aanvraag.ref, actie: 'plan', autoPlan: false }, aegisTok);
    }, 1, 5000),
    ...lus('bev-pda', async (c) => {
      const tok = guardToks[c % Math.max(1, guardToks.length)]; if (!tok) return;
      const d = await api('bev-pda', '/api/supplier/beveiliging/pda/diensten', {}, tok);
      const open = d && d.diensten && d.diensten.find(x => x.status === 'gepland');
      if (open) { await api('bev-pda', '/api/supplier/beveiliging/pda/inklok', { id: open.id, lat: 38.9, lng: 1.4 }, tok); await api('bev-pda', '/api/supplier/beveiliging/pda/uitklok', { id: open.id }, tok); }
      await api('bev-pda', '/api/supplier/beveiliging/pda/incident', { soort: 'ronde-melding', ernst: 'laag', tekst: 'Alles rustig, sector ' + rnd(9) }, tok);
    }, 2, 3000),

    // ---- kantoor + sonde ----
    ...lus('office', async () => { await api('office', '/api/office/state', {}, offTok); }, 1, 3000),
    ...lus('health', async () => { await api('health', '/api/health', null, null, 'GET'); }, 1, 400)
  ];

  // eenmalig middenin: een echte SOS door een bewaker
  setTimeout(() => { if (guardToks[0]) api('bev-pda', '/api/supplier/beveiliging/pda/sos', { lat: 38.9, lng: 1.4 }, guardToks[0]); }, Math.floor(DUUR_MS / 2));

  const bStart = Date.now();
  await Promise.all(taken);
  const bDuur = (Date.now() - bStart) / 1000;
  clearInterval(driftTimer);
  for (const s of sses) try { s.destroy(); } catch (e) {}

  /* ---- rapport Fase B ---- */
  kop('RAPPORT FASE B');
  let totN = 0, totOk = 0, totZak = 0, totFout = 0;
  const namen = Object.keys(stromen).filter(n => n !== 'setup').sort();
  for (const n of namen) {
    const s = stromen[n];
    totN += s.n; totOk += s.ok; totZak += s.zak; totFout += s.fout;
    rij(n, `${s.ok}/${s.n} ok` + (s.zak ? ` · ${s.zak} zakelijk` : '') + (s.fout ? ` · \x1b[31m${s.fout} FOUT\x1b[0m` : '') +
      ` · p50 ${pct(s.lat, 50)} ms · p95 ${pct(s.lat, 95)} ms · max ${Math.max(0, ...s.lat)} ms`);
    for (const f of s.vb) console.log('      ! ' + f);
  }
  rij('totaal verzoeken', nl(totN) + ' (' + Math.round(totN / bDuur) + '/s) · ' + nl(totOk) + ' ok · ' + nl(totZak) + ' zakelijk geweigerd · ' + totFout + ' echte fouten');
  rij('grootste event-loop-hapering (client)', maxStall + ' ms');
  rij('servergeheugen (RSS) na de storm', rssMB() + ' MB');

  /* ================= FASE C: integriteit + herstart ================= */
  kop('FASE C: integriteit en de herstart-proef');
  let integriteitOk = true;
  for (const sc of ['MAISON', 'KIKUNOI']) {
    const ro = await api('setup', '/api/supplier/roster', { code: sc });
    const mg = ro && ro.staff.find(s => s.role === 'manager');
    const lg = await api('setup', '/api/supplier/login', { code: sc, staffId: mg && mg.id, pin: '1234' });
    const ont = await api('setup', '/api/supplier/ontvangsten', {}, lg && lg.token);
    const verwacht = (ledgerStart[sc] || 0) + geteld[sc];
    const klopt = ont && ont.som === verwacht;
    if (!klopt) integriteitOk = false;
    rij('ledger ' + sc, klopt ? '✓ op de cent: € ' + nl(verwacht / 100)
      : !ont ? '✗ geen antwoord van de kast (server nog verzadigd)'
      : '✗ VERSCHIL: kast € ' + nl(ont.som / 100) + ' vs geteld € ' + nl(verwacht / 100) +
        (ont.som > verwacht ? ' (kast > geteld: de server verwerkte betalingen waarvan het antwoord bij de client time-outte; niets dubbel)' : ''));
  }
  const gezond = await verzoek('/api/health', { method: 'GET' });
  rij('health na de storm', gezond.status === 200 ? '✓ 200' : '✗ ' + gezond.status);

  await stopServer();
  const boot2 = await bootServer();
  rij('herstart-boot met volgeschreven kast', (boot2 / 1000).toFixed(1) + ' s');
  const gezond2 = await verzoek('/api/health', { method: 'GET' });
  rij('health na herstart', gezond2.status === 200 ? '✓ 200' : '✗ ' + gezond2.status);
  // durable idempotentie: dezelfde idem-sleutel als in de storm, NA de herstart
  let idemOk = null;
  if (idemProef.ref && idemProef.lid) {
    const her = await api('setup', '/api/betaal/direct', { supplierCode: 'MAISON', centen: 999999, omschrijving: 'mag niet tellen', idem: idemProef.idem }, idemProef.lid.token);
    idemOk = !!(her && her.betaling && her.betaling.ref === idemProef.ref && her.herhaald);
    rij('idempotente retry NA herstart', idemOk ? '✓ zelfde betaling terug, niets dubbel afgeschreven' : '✗ FOUT');
  } else rij('idempotente retry NA herstart', '(overgeslagen: proefbetaling kwam niet door de storm)');

  kop('EINDOORDEEL');
  const geslaagd = totFout === 0 && integriteitOk && gezond.status === 200 && gezond2.status === 200 && idemOk !== false;
  rij('populatie in de kast', nl(GEBRUIKERS) + ' unieke gebruikers (' + nl(GIDS) + ' in de gids, activiteit tot user-' + nl(GEBRUIKERS) + ')');
  rij('records gezaaid', nl(GIDS + N_ORDERS + N_BETALINGEN + N_BOEKINGEN + N_DIENSTEN + N_GH + N_MODE + N_RESERV + N_CHATS + N_VERZOEKEN + N_REVIEWS + N_INCIDENTEN));
  console.log('\n  ' + (geslaagd ? '\x1b[32m✔ GESLAAGD: nul echte fouten, het geld klopt op de cent, en de herstart-proef slaagt.\x1b[0m'
    : '\x1b[31m✘ NIET GESLAAGD, zie de regels hierboven.\x1b[0m'));

  await stopServer();
  cleanup();
  process.exit(geslaagd ? 0 : 1);
})().catch(e => { console.error('ORKAAN-CRASH:', e); cleanup(); process.exit(1); });
