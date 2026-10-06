/* RTC VIA HET RELAIS -- bewezen tegen een ECHTE coturn, en dicht waar dat niet lukt.

   Wat deze toets vasthoudt (docs/turn-server.md, kern/rtc/*):
   1. De relayproef van de server slaagt alleen als coturn ECHT bytes relayt
      (UDP, TCP en TLS), en zakt op een fout geheim, een TLS-identiteit die niet
      klopt, een dode server en een DNS-fout.
   2. De relaystand wordt AFGELEID: geen opgeslagen BESCHIKBAAR, geen setter.
      Elk misvormd, verlopen of aan een andere config/release gebonden bewijs
      telt niet, en de kill switch wint van alles.
   3. /api/ice geeft een TURN-credential alleen aan een geauthenticeerde actor,
      kortlevend, met een ondoorzichtig label, en met een plafond.
   4. (test/rtc-relay.e2e.js) Een echte Chromium belt via het relais.
   5. Publieke productie zonder bewezen relais: geen TURN in /api/ice, de
      Connection-policy weigert voice/video, de RTC-poort weigert een belsignaal
      maar laat ophangen door.

   coturn is een systeempakket; zie test/lib/coturn.js voor wat er gebeurt als
   het ontbreekt (in CI zakken, lokaal overslaan met de reden). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { startServer, vrijePoortReeks } = require('./helper');

const relaystand = require('../server/kern/rtc/relaystand');
const relayproef = require('../server/kern/rtc/relayproef');
const turn = require('../server/config/turn');
const ijs = require('../server/kern/rtc/ijs');
const { maakRtcPoort, SIGNAALROUTES, VEILIGHEIDSKANALEN } = require('../server/kern/rtc/poort');
const { maakConfig } = require('../scripts/turn/maak-config');

const { HEEFT_COTURN, opts, maakCert, startCoturn: start } = require('./lib/coturn');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtc-'));
const GEHEIM = crypto.randomBytes(32).toString('hex');
let coturn = null, P = null, CA = null;
const startCoturn = (geheim) => start(TMP, geheim);

test.before(async () => {
  if (!HEEFT_COTURN) return;
  CA = maakCert(TMP);
  coturn = await startCoturn(GEHEIM);
  P = coturn.poort;
});
test.after(() => {
  if (coturn) coturn.kind.kill('SIGKILL');
  relaystand.stop();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const urls = () => ({
  udp: 'turn:127.0.0.1:' + P + '?transport=udp',
  tcp: 'turn:127.0.0.1:' + P + '?transport=tcp',
  tls: 'turns:127.0.0.1:' + coturn.tls + '?transport=tcp'
});

/* ---------- 1. de echte relayproef ---------- */

test('relayproef: UDP, TCP en TLS relayen elk 64 KiB in beide richtingen', opts, async () => {
  for (const [soort, url] of Object.entries(urls())) {
    const env = { TURN_URL: url, TURN_SECRET: GEHEIM };
    const u = await relaystand.proef(env, { ca: CA });
    assert.equal(u.ok, true, soort + ': ' + u.reden);
    assert.equal(u.urls[0].transport, soort);
    assert.ok(u.urls[0].bytesAB >= relayproef.MIN_BYTES && u.urls[0].bytesBA >= relayproef.MIN_BYTES, soort);
    assert.equal(relaystand.stand(env).geverifieerd, true, soort);
  }
});

test('relayproef zakt: fout geheim, TLS-identiteit, dode server, DNS', opts, async () => {
  const fout = await relaystand.proef({ TURN_URL: urls().udp, TURN_SECRET: crypto.randomBytes(32).toString('hex') });
  assert.equal(fout.ok, false); assert.equal(fout.reden, 'TURN_AUTH_GEWEIGERD');
  const tls = await relaystand.proef({ TURN_URL: urls().tls, TURN_SECRET: GEHEIM });   // geen CA: niet vertrouwd
  assert.equal(tls.reden, 'TURN_TLS_IDENTITEIT_ONGELDIG');
  const [dood] = await vrijePoortReeks(1);
  const weg = await relaystand.proef({ TURN_URL: 'turn:127.0.0.1:' + dood + '?transport=tcp', TURN_SECRET: GEHEIM });
  assert.equal(weg.reden, 'TURN_NETWERK_FOUT');
  const dns = await relaystand.proef({ TURN_URL: 'turn:bestaat-niet.invalid:3478?transport=tcp', TURN_SECRET: GEHEIM });
  assert.equal(dns.reden, 'TURN_DNS_FOUT');
  assert.equal(relaystand.stand({ TURN_URL: 'turn:bestaat-niet.invalid:3478?transport=tcp', TURN_SECRET: GEHEIM }).geverifieerd, false);
});

test('de productieconfig van maak-config.js is geen open springplank: private peers krijgen 403', opts, async () => {
  const [poort] = await vrijePoortReeks(1), relay = await vrijePoortReeks(20);
  const tekst = maakConfig({ realm: 'turn.rtg-proef.nl', 'extern-ip': '8.8.8.8/127.0.0.1', geheim: GEHEIM,
    cert: path.join(TMP, 'cert.pem'), sleutel: path.join(TMP, 'key.pem'),
    'min-poort': String(relay[0]), 'max-poort': String(relay[0] + 100) })
    .replace(/^listening-port=.*$/m, 'listening-port=' + poort).replace(/^tls-listening-port=.*$/m, 'tls-listening-port=' + (poort + 1))
    + 'userdb=' + path.join(TMP, 'turndb-prod') + '\n';
  assert.match(tekst, /^use-auth-secret$/m);
  assert.match(tekst, /^denied-peer-ip=10\.0\.0\.0-10\.255\.255\.255$/m);
  assert.match(tekst, /^denied-peer-ip=169\.254\.0\.0-169\.254\.255\.255$/m);
  assert.doesNotMatch(tekst, /allow-loopback-peers|^user=|lt-cred-mech/m);
  const conf = path.join(TMP, 'prod.conf'); fs.writeFileSync(conf, tekst, { mode: 0o600 });
  const kind = spawn('turnserver', ['-c', conf], { stdio: 'ignore' });
  try {
    const turnclient = require('../server/kern/rtc/turnclient');
    let alloc = null, kanaal = null;
    for (let i = 0; i < 40 && !alloc; i++) {
      try {
        kanaal = await turnclient.verbind({ transport: 'udp', host: '127.0.0.1', poort, timeoutMs: 500 });
        const c = turn.tijdelijk(GEHEIM, { actor: 'proef' });
        alloc = await turnclient.alloceer(kanaal, { gebruiker: c.username, wachtwoord: c.credential, timeoutMs: 500, transport: 'udp' });
      } catch (e) { if (kanaal) kanaal.sluit(); kanaal = null; await new Promise(r => setTimeout(r, 100)); }
    }
    assert.ok(alloc, 'allocatie met een geldig credential');
    for (const ip of ['10.1.2.3', '192.168.1.1', '169.254.169.254', '172.16.0.1', '100.64.0.1']) {
      await assert.rejects(alloc.permissie(ip), e => e.code === 'TURN_PEER_GEWEIGERD', ip);
    }
    kanaal.sluit();
    // zonder credential: geen allocatie (geen open relais)
    const k2 = await turnclient.verbind({ transport: 'udp', host: '127.0.0.1', poort, timeoutMs: 800 });
    await assert.rejects(turnclient.alloceer(k2, { gebruiker: 'x', wachtwoord: 'y', timeoutMs: 800, transport: 'udp' }),
      e => e.code === 'TURN_AUTH_GEWEIGERD');
    k2.sluit();
  } finally { kind.kill('SIGKILL'); }
});

test('een OPEN relais (coturn zonder authenticatie) laat de proef zakken, nooit slagen', opts, async () => {
  const [poort] = await vrijePoortReeks(1), relay = await vrijePoortReeks(20);
  const conf = path.join(TMP, 'open.conf');
  fs.writeFileSync(conf, ['listening-ip=127.0.0.1', 'relay-ip=127.0.0.1', 'listening-port=' + poort,
    'min-port=' + relay[0], 'max-port=' + relay[relay.length - 1], 'no-auth', 'allow-loopback-peers', 'no-cli',
    'no-tls', 'no-dtls', 'userdb=' + path.join(TMP, 'turndb-open'), ''].join('\n'));
  const kind = spawn('turnserver', ['-c', conf], { stdio: 'ignore' });
  try {
    const env = { TURN_URL: 'turn:127.0.0.1:' + poort + '?transport=udp', TURN_SECRET: GEHEIM };
    let u = null;
    for (let i = 0; i < 30; i++) {
      u = await relaystand.proef(env, { timeoutMs: 800 });
      if (u.reden !== 'TURN_GEEN_ANTWOORD' && u.reden !== 'TURN_NETWERK_FOUT') break;
      await new Promise(r => setTimeout(r, 100));
    }
    assert.equal(u.ok, false);
    assert.equal(u.urls[0].reden, 'TURN_ZONDER_AUTH');
    assert.equal(relaystand.stand(env).geverifieerd, false);
  } finally { kind.kill('SIGKILL'); }
});

test('maak-config weigert een zwak geheim, een privé realm/IP en een open poortbereik', () => {
  const basis = { realm: 'turn.rtg-proef.nl', 'extern-ip': '8.8.8.8', geheim: GEHEIM, cert: '/c.pem', sleutel: '/k.pem' };
  assert.doesNotThrow(() => maakConfig(basis));
  assert.throws(() => maakConfig({ ...basis, geheim: 'a'.repeat(40) }));
  assert.throws(() => maakConfig({ ...basis, geheim: 'change-me-0123456789012345678901234567' }));
  assert.throws(() => maakConfig({ ...basis, 'extern-ip': '10.0.0.4' }));
  assert.throws(() => maakConfig({ ...basis, realm: 'turn.example.com' }));
  assert.throws(() => maakConfig({ ...basis, 'min-poort': '1024', 'max-poort': '65535' }));
});

/* ---------- 2. de stand wordt afgeleid, VERIFIED is geen knop ---------- */

const PUBLIEK = { NODE_ENV: 'production', TURN_URL: 'turns:turn.rtg-proef.nl:5349?transport=tcp', TURN_SECRET: GEHEIM };

test('publieke productie: zonder bewijs, met misvormd, vreemd of verlopen bewijs is RTC dicht', () => {
  const b = relaystand.binding(PUBLIEK), nu = Date.now();
  const goed = { ok: true, config: b.config, release: b.release, gemetenOp: nu - 1000, geldigTot: nu + 60000 };
  assert.equal(relaystand.beoordeel({ env: PUBLIEK, bewijs: goed, nu }).beschikbaar, true, 'besturingsproef: geldig bewijs opent');
  const gevallen = {
    TURN_NOG_NIET_BEWEZEN: null,
    TURN_BEWIJS_MISVORMD: { ok: true },
    TURN_PROEF_GEZAKT: { ...goed, ok: false, reden: undefined },
    TURN_BEWIJS_ANDERE_CONFIG: { ...goed, config: 'a'.repeat(64) },
    TURN_BEWIJS_ANDERE_RELEASE: { ...goed, release: 'b'.repeat(64) },
    TURN_BEWIJS_VERLOPEN: { ...goed, gemetenOp: nu - 20 * 60000, geldigTot: nu - 1 }
  };
  for (const [reden, bewijs] of Object.entries(gevallen)) {
    const st = relaystand.beoordeel({ env: PUBLIEK, bewijs, nu });
    assert.equal(st.beschikbaar, false, reden); assert.equal(st.reden, reden);
  }
  // 'ok' als tekst, een geldigheid langer dan de proef geeft, of tijd uit de toekomst
  for (const bewijs of [{ ...goed, ok: 'true' }, { ...goed, geldigTot: nu + 24 * 3600000 }, { ...goed, gemetenOp: nu + 5000 }])
    assert.equal(relaystand.beoordeel({ env: PUBLIEK, bewijs, nu }).beschikbaar, false, JSON.stringify(bewijs));
  // een ander geheim of een andere URL-lijst = andere config: bewijs vervalt vanzelf
  for (const env of [{ ...PUBLIEK, TURN_SECRET: crypto.randomBytes(32).toString('hex') },
    { ...PUBLIEK, TURN_URL: 'turns:turn2.rtg-proef.nl:5349?transport=tcp' }, { ...PUBLIEK, TURN_CREDENTIAL_TTL: '600' }])
    assert.equal(relaystand.beoordeel({ env, bewijs: goed, nu }).reden, 'TURN_BEWIJS_ANDERE_CONFIG');
  // kill switch wint van een geldig bewijs
  assert.equal(relaystand.beoordeel({ env: { ...PUBLIEK, RTG_RTC_UIT: '1' }, bewijs: goed, nu }).reden, 'RTC_KILL_SWITCH');
  // een vaste TURN_USER/TURN_PASS opent publieke productie nooit
  const vast = { NODE_ENV: 'production', TURN_URL: PUBLIEK.TURN_URL, TURN_USER: 'rtg', TURN_PASS: GEHEIM };
  assert.equal(relaystand.beoordeel({ env: vast, bewijs: goed, nu }).reden, 'TURN_CONFIG_ONGELDIG');
});

test('VERIFIED is geen knop: de module exporteert geen setter en de bron zet laatste alleen in proef()', () => {
  assert.ok(Object.isFrozen(relaystand));
  for (const naam of Object.keys(relaystand)) assert.doesNotMatch(naam, /^(zet|set|markeer|forceer|verifieer)/i, naam);
  const bron = fs.readFileSync(require.resolve('../server/kern/rtc/relaystand'), 'utf8');
  const toewijzingen = bron.match(/\blaatste\s*=(?!=)/g) || [];
  assert.equal(toewijzingen.length, 3, 'declaratie, proef() en vergeet() -- en vergeet zet alleen null');
  assert.match(bron, /function vergeet\(\) \{ laatste = null; \}/);
  // geen route die de stand schrijft
  const routes = execFileSync('grep', ['-rln', "relaystand", path.join(__dirname, '..', 'server')], { encoding: 'utf8' }).trim().split('\n');
  for (const f of routes) {
    const t = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(t, /app\.(post|put|patch|delete)\([^)]*rtc/i, f);
  }
});

test('mutatie: een geverifieerde stand wordt dicht zodra de onderliggende proef zakt, zonder iets te corrigeren', opts, async () => {
  const env = { TURN_URL: urls().udp, TURN_SECRET: GEHEIM };
  assert.equal((await relaystand.proef(env)).ok, true);
  assert.equal(relaystand.stand(env).geverifieerd, true);
  // het relais valt weg (zelfde config, andere poort gaat dood): de volgende proef zakt
  const tijdelijk = await startCoturn(GEHEIM);
  const env2 = { TURN_URL: 'turn:127.0.0.1:' + tijdelijk.poort + '?transport=udp', TURN_SECRET: GEHEIM };
  assert.equal((await relaystand.proef(env2)).ok, true);
  assert.equal(relaystand.stand(env2).geverifieerd, true);
  tijdelijk.kind.kill('SIGKILL');
  await new Promise(r => setTimeout(r, 200));
  const u = await relaystand.proef(env2, { timeoutMs: 1500 });
  assert.equal(u.ok, false);
  assert.equal(relaystand.stand(env2).geverifieerd, false, 'geen opgeslagen BESCHIKBAAR om te corrigeren');
  // en het bewijs van env2 opent env (andere config) niet
  assert.equal(relaystand.stand(env).geverifieerd, false);
  // het verloop: hetzelfde bewijs na GELDIG_MS is dicht
  assert.equal((await relaystand.proef(env)).ok, true);
  assert.equal(relaystand.stand(env, Date.now() + relaystand.GELDIG_MS + 1).geverifieerd, false);
});

/* ---------- 3/5. policy en poort: hogere DENY blijft DENY ---------- */

test('Connection-policy: voice/video eisen de relaystand; lagere lagen openen een hogere weigering nooit', () => {
  const oud = { ...process.env };
  const policy = require('../server/kern/connection-policy');
  const lid = { pass: 'rtg', verified: true, adult: true, relay: true, beschikbaar: true, geverifieerd: true };
  try {
    process.env.NODE_ENV = 'production'; delete process.env.RTG_PRIVATE_BETA;
    process.env.TURN_URL = PUBLIEK.TURN_URL; process.env.TURN_SECRET = GEHEIM; delete process.env.RTG_RTC_UIT;
    relaystand.vergeet();
    for (const cap of ['connection.voice', 'connection.video']) {
      const d = policy.beslis({ actor: 'member', product: 'vonk', capability: cap, state: lid });
      assert.equal(d.allow, false, cap); assert.equal(d.code, 'PROVIDER_NOT_READY');
      assert.equal(policy.beslis({ actor: 'office', product: 'vonk', capability: cap, state: lid }).allow, false,
        'ook het kantoor: een relais dat niet werkt, werkt voor niemand');
    }
    // kwalificatie gaat voor: een niet-geverifieerd lid krijgt die reden, niet de providerreden
    assert.equal(policy.beslis({ actor: 'member', product: 'vonk', capability: 'connection.voice',
      state: { ...lid, verified: false } }).code, 'IDENTITY_REQUIRED');
    // een tekstbericht hangt niet aan het relais
    assert.equal(policy.beslis({ actor: 'member', product: 'vonk', capability: 'connection.message', state: lid }).code !== 'PROVIDER_NOT_READY', true);
    // kill switch boven autorisatie
    process.env.RTG_RTC_UIT = '1';
    assert.equal(policy.beslis({ actor: 'nobody', product: 'vonk', capability: 'connection.video', state: lid }).code, 'KILL_SWITCH');
    // buiten publieke productie: direct bellen mag (bestaande afspraak), en het label zegt dat er geen relais is
    delete process.env.RTG_RTC_UIT; process.env.NODE_ENV = 'development';
    assert.equal(policy.beslis({ actor: 'member', product: 'vonk', capability: 'connection.video', state: lid }).allow, true);
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in oud)) delete process.env[k];
    Object.assign(process.env, oud);
  }
});

test('RTC-poort: weigert openen/voortzetten zonder relais, laat ophangen door, dekt elke signaalroute', () => {
  const dicht = maakRtcPoort({ stand: () => ({ beschikbaar: false, reden: 'TURN_NOG_NIET_BEWEZEN' }) });
  const open = maakRtcPoort({ stand: () => ({ beschikbaar: true }) });
  const kapot = maakRtcPoort({ stand: () => { throw new Error('x'); } });
  const roep = (poort, pad, body, method = 'POST') => {
    let status = 0, door = false;
    const res = { set() { return res; }, status(s) { status = s; return res; }, json() { return res; } };
    poort({ method, path: pad, body }, res, () => { door = true; });
    return door ? 'door' : status;
  };
  for (const pad of SIGNAALROUTES) {
    assert.equal(roep(dicht, pad, { kind: 'offer' }), 503, pad);
    assert.equal(roep(kapot, pad, { kind: 'offer' }), 503, pad + ' (stand gooit = dicht)');
    assert.equal(roep(open, pad, { kind: 'offer' }), 'door', pad);
    if (!/\/call\/(start|answer|signal)$/.test(pad)) assert.equal(roep(dicht, pad, { kind: 'hangup' }), 'door', pad + ' ophangen');
  }
  assert.equal(roep(dicht, '/api/connection/vonk/call/answer', { accept: false }), 'door', 'weigeren mag');
  assert.equal(roep(dicht, '/api/connection/vonk/call/answer', { accept: true }), 503);
  for (const pad of VEILIGHEIDSKANALEN) assert.equal(roep(dicht, pad, { kind: 'offer' }), 'door', pad + ' (veiligheidskanaal, besluit)');
  assert.equal(roep(dicht, '/api/member/call', { kind: 'ring' }, 'GET'), 'door');
});

test('alle server-routes die WebRTC-signalen doorgeven staan in de poort of in de veiligheidslijst', () => {
  const uit = execFileSync('grep', ['-rhoE', "app\\.post\\('/api/[a-z/-]*(call|bel|sein|signaal|signal)[a-z/-]*'", path.join(__dirname, '..', 'server')], { encoding: 'utf8' });
  const router = execFileSync('grep', ['-rhoE', "router\\.post\\('/(gezin|school)/bel'", path.join(__dirname, '..', 'server')], { encoding: 'utf8' });
  const paden = [...uit.matchAll(/'([^']+)'/g)].map(m => m[1])
    .concat([...router.matchAll(/'([^']+)'/g)].map(m => '/api/foundation' + m[1]));
  const bekend = new Set([...SIGNAALROUTES, ...VEILIGHEIDSKANALEN]);
  /* Routes met 'call' of 'bel' in de naam die GEEN WebRTC-signaal doorgeven
     (beheer van een gesprek, geen mediapad). Elke nieuwe moet hier bewust bij. */
  const geenSignaal = new Set(['/api/connection/vonk/call/poll', '/api/connection/vonk/call/end',
    '/api/connection/rendezvous/call/poll', '/api/connection/rendezvous/call/end',
    '/api/residentie/bel',        // de deurbel van een kamer in het spel De Residentie: een melding, geen mediapad
    '/api/connect/signaal',       // een horizonvoorkeur in Foundation Connect (kern/connect/horizon.js)
    '/api/rtf/connect/signaal']);
  const vergeten = [...new Set(paden)].filter(p => !bekend.has(p) && !geenSignaal.has(p)
    && /(\/call$|\/call\/|\/bel$|\/sein$|signaal$|\/signal$)/.test(p));
  assert.deepEqual(vergeten, [], 'een signaalroute buiten de RTC-poort: ' + vergeten.join(', '));
});

/* ---------- 3 en 4 tegen een echte RTG-server en een echte browser ---------- */

test('end-to-end: /api/ice alleen voor een sessie, kortlevend, HMAC klopt, en de server bewijst zijn eigen relais', opts, async (t) => {
  const { child, base } = await startServer({ env: {
    RTG_DATA_DIR: path.join(TMP, 'data'), SMTP_URL: '',
    TURN_URL: urls().udp + ',' + urls().tcp, TURN_SECRET: GEHEIM, TURN_CREDENTIAL_TTL: '1800'
  } });
  t.after(() => { try { child.kill('SIGKILL'); } catch (e) {} });

  const anoniem = await fetch(base + '/api/ice');
  assert.equal(anoniem.status, 401);
  assert.equal(anoniem.headers.get('cache-control'), 'no-store');
  const a = await anoniem.json();
  assert.equal(JSON.stringify(a.iceServers).includes('turn:'), false, 'geen TURN voor wie niet is ingelogd');
  assert.equal((await fetch(base + '/api/ice', { headers: { Authorization: 'Bearer nep' } })).status, 401);
  assert.equal((await fetch(base + '/api/rtf/ice', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'XXXX', token: 'nep' }) })).status, 403, 'gezinsPoort weigert een vreemd profiel');

  const login = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: 'rtg' }) })).json();
  assert.ok(login.token, 'demo-lid');
  const met = await fetch(base + '/api/ice', { headers: { Authorization: 'Bearer ' + login.token } });
  assert.equal(met.status, 200);
  const d = await met.json();
  const relay = d.iceServers.find(s => s.urls.some(u => u.startsWith('turn:')));
  assert.ok(relay, 'TURN voor een ingelogd lid');
  assert.match(relay.username, /^\d+:[A-Za-z0-9_-]{22}$/, 'verloop plus ondoorzichtig label, geen codenaam');
  const verloopt = Number(relay.username.split(':')[0]) * 1000;
  assert.ok(verloopt > Date.now() + 25 * 60000 && verloopt < Date.now() + 31 * 60000, 'TURN_CREDENTIAL_TTL=1800 telt');
  assert.equal(relay.credential, crypto.createHmac('sha1', GEHEIM).update(relay.username).digest('base64'));
  assert.equal(JSON.stringify(d).includes(GEHEIM), false, 'het permanente geheim verlaat de server nooit');

  // de runtimeproef van de server zelf
  let stand = null;
  for (let i = 0; i < 60; i++) {
    stand = await (await fetch(base + '/api/rtc/stand')).json();
    if (stand.laatsteProef) break;
    await new Promise(r => setTimeout(r, 250));
  }
  assert.equal(stand.laatsteProef && stand.laatsteProef.ok, true, JSON.stringify(stand));
  assert.equal(stand.geverifieerd, true);
  assert.equal(JSON.stringify(stand).includes(GEHEIM), false);

  // het plafond per actor
  ijs.vergeetLimieten();
  let laatste = 200;
  for (let i = 0; i < ijs.LIMIET + 2 && laatste !== 429; i++)
    laatste = (await fetch(base + '/api/ice', { headers: { Authorization: 'Bearer ' + login.token } })).status;
  assert.equal(laatste, 429, 'een sessie wordt geen bandbreedtekraan');
});

test('publieke productie zonder bewezen relais: /api/ice geeft geen TURN, ook niet aan een lid', () => {
  relaystand.vergeet();
  const env = { ...PUBLIEK, APP_URL: 'https://app.rtg-proef.nl' };
  const uit = ijs.antwoord('sessie:lid-1', { env, hostname: 'app.rtg-proef.nl' });
  assert.equal(uit.status, 200);
  assert.equal(uit.body.relay.beschikbaar, false);
  assert.equal(uit.body.iceServers.some(s => s.urls.some(u => /^turns?:/.test(u))), false);
  assert.equal(ijs.antwoord(null, { env }).status, 401);
  assert.equal(ijs.antwoord('sessie:lid-1', { env: { ...env, RTG_RTC_UIT: '1' } }).status, 503);
});
