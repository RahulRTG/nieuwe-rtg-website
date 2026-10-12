/* DE RELAYSTAND EN DE ICE-UITGIFTE TAK VOOR TAK (server/kern/rtc/relaystand.js
   en server/kern/rtc/ijs.js), zonder coturn en zonder netwerk.

   test/rtc-relay.test.js bewijst de proef tegen een echte coturn en slaat
   zich over waar die ontbreekt. Dit bestand vervangt in zijn eigen proces de
   netwerkproef (relayproef.proefUrl) door een nagemaakte uitslag, zodat de
   afleiding zelf altijd wordt getoetst: buiten publieke productie is een
   relais niet vereist, een gezakte proef zet de stand direct dicht, alle
   URL's moeten slagen, de periodieke ronde start een keer, en /api/ice geeft
   STUN aan iedereen maar TURN alleen aan een actor, binnen het plafond, en in
   publieke productie alleen met een bewezen relais. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const relayproef = require('../server/kern/rtc/relayproef');
const relaystand = require('../server/kern/rtc/relaystand');
const ijs = require('../server/kern/rtc/ijs');

const GEHEIM = crypto.randomBytes(32).toString('hex');
const LOKAAL = { TURN_URL: 'turn:127.0.0.1:3478?transport=udp', TURN_SECRET: GEHEIM };
const PUBLIEK = { NODE_ENV: 'production', APP_URL: 'https://rtg-proef.nl', TURN_SECRET: GEHEIM,
  TURN_URL: 'turns:turn.rtg-proef.nl:5349?transport=tcp,turn:turn.rtg-proef.nl:3478?transport=udp' };

/* De nagemaakte netwerkproef: geeft per URL de uitslag die de toets wil, en
   onthoudt welke credentials hij kreeg. */
const echteProef = relayproef.proefUrl;
let uitslagVoor = () => ({ ok: true });
const gezien = [];
relayproef.proefUrl = async (url, credential, opties) => {
  const c = credential();
  gezien.push({ url: url.url, c, opties });
  return { url: url.url, transport: relayproef.transportVan(url), ...uitslagVoor(url) };
};
test.after(() => { relayproef.proefUrl = echteProef; relaystand.stop(); relaystand.vergeet(); });
test.beforeEach(() => { relaystand.vergeet(); ijs.vergeetLimieten(); gezien.length = 0; uitslagVoor = () => ({ ok: true }); });

test('beoordeel buiten publieke productie: niet vereist, en de reden zegt eerlijk hoe het staat', () => {
  assert.deepEqual(relaystand.beoordeel({ env: {} }),
    { beschikbaar: true, relayVereist: false, geverifieerd: false, reden: 'RELAY_NIET_VEREIST' });
  assert.equal(relaystand.beoordeel({ env: LOKAAL }).reden, 'RELAY_NIET_BEWEZEN_NIET_VEREIST');
  const b = relaystand.binding(LOKAAL), nu = Date.now();
  const goed = { ok: true, config: b.config, release: b.release, gemetenOp: nu - 1, geldigTot: nu + 1000 };
  const st = relaystand.beoordeel({ env: LOKAAL, bewijs: goed, nu });
  assert.equal(st.geverifieerd, true);
  assert.equal(st.reden, 'RELAY_GEVERIFIEERD');
  assert.equal(relaystand.beoordeel({ env: LOKAAL, bewijs: goed, binding: { config: 'x', release: b.release }, nu }).geverifieerd, false,
    'een meegegeven binding telt in plaats van de live configuratie');
  assert.ok(Object.isFrozen(st));
  const priveBeta = relaystand.beoordeel({ env: { ...PUBLIEK, RTG_PRIVATE_BETA: '1' } });
  assert.equal(priveBeta.relayVereist, false, 'de private beta is geen publieke productie');
});

test('beoordeel: de kill switch zegt of een relais vereist zou zijn', () => {
  assert.deepEqual(relaystand.beoordeel({ env: { RTG_RTC_UIT: '1' } }),
    { beschikbaar: false, relayVereist: false, geverifieerd: false, reden: 'RTC_KILL_SWITCH' });
  assert.equal(relaystand.beoordeel({ env: { ...PUBLIEK, RTG_RTC_UIT: '1' } }).relayVereist, true);
});

test('beoordeel in publieke productie: een lijst met een fout adres, of een gezakte proef met zijn eigen reden', () => {
  const half = { ...PUBLIEK, TURN_URL: PUBLIEK.TURN_URL + ',turn:10.0.0.1:3478?transport=udp' };
  assert.equal(relaystand.beoordeel({ env: half }).reden, 'TURN_CONFIG_ONGELDIG', 'een half goede lijst is geen configuratie');
  const b = relaystand.binding(PUBLIEK), nu = Date.now();
  const gezakt = relaystand.beoordeel({ env: PUBLIEK, nu,
    bewijs: { ok: false, reden: 'TURN_AUTH_GEWEIGERD', config: b.config, release: b.release, gemetenOp: nu, geldigTot: nu } });
  assert.deepEqual({ ...gezakt }, { beschikbaar: false, relayVereist: true, geverifieerd: false, reden: 'TURN_AUTH_GEWEIGERD', gemetenOp: nu });
  const goed = relaystand.beoordeel({ env: PUBLIEK, nu,
    bewijs: { ok: true, config: b.config, release: b.release, gemetenOp: nu - 5, geldigTot: nu + 5 } });
  assert.deepEqual({ ...goed }, { beschikbaar: true, relayVereist: true, geverifieerd: true, reden: 'RELAY_GEVERIFIEERD',
    gemetenOp: nu - 5, geldigTot: nu + 5 });
  for (const bewijs of ['tekst', { ok: true, config: 1, release: 'r', gemetenOp: 1, geldigTot: 2 },
    { ok: true, config: 'c', release: 'r', gemetenOp: 'x', geldigTot: 2 }, { ok: true, config: 'c', release: 'r', gemetenOp: 1, geldigTot: NaN }])
    assert.equal(relaystand.beoordeel({ env: PUBLIEK, bewijs }).reden, 'TURN_BEWIJS_MISVORMD', JSON.stringify(bewijs));
});

test('binding: de configuratie en de release, stabiel zolang er niets verandert', () => {
  const a = relaystand.binding(PUBLIEK);
  assert.match(a.config, /^[0-9a-f]{64}$/);
  assert.ok(typeof a.release === 'string' && a.release.length > 0);
  assert.deepEqual(relaystand.binding(PUBLIEK), a);
  assert.notEqual(relaystand.binding(LOKAAL).config, a.config);
});

test('proef zonder geldige configuratie: een gezakte uitslag zonder netwerkproef', async () => {
  const u = await relaystand.proef({});
  assert.equal(u.ok, false);
  assert.equal(u.reden, 'TURN_CONFIG_ONGELDIG');
  assert.deepEqual(u.urls, []);
  assert.equal(u.geldigTot, u.gemetenOp, 'een gezakte proef draagt geen geldigheid');
  assert.equal(gezien.length, 0);
  assert.equal((await relaystand.proef({ ...PUBLIEK, TURN_URL: 'turn:10.0.0.1:3478?transport=udp' })).reden, 'TURN_CONFIG_ONGELDIG');
  assert.equal(relaystand.stand({}).reden, 'RELAY_NIET_VEREIST');
});

test('proef in publieke productie: elke URL wordt beproefd met een eigen credential, en dan is de stand open', async () => {
  const u = await relaystand.proef(PUBLIEK, { timeoutMs: 10 });
  assert.equal(u.ok, true);
  assert.equal(u.reden, null);
  assert.equal(u.geldigTot - u.gemetenOp, relaystand.GELDIG_MS);
  assert.deepEqual(gezien.map(g => g.url), PUBLIEK.TURN_URL.split(','));
  for (const g of gezien) {
    assert.match(g.c.username, /^\d+:[A-Za-z0-9_-]{22}$/);
    assert.equal(g.c.credential, crypto.createHmac('sha1', GEHEIM).update(g.c.username).digest('base64'));
    assert.deepEqual(g.opties, { timeoutMs: 10, eisOpenbaarRelay: true });
  }
  assert.equal(relaystand.stand(PUBLIEK).geverifieerd, true);
  assert.equal(relaystand.gereed(PUBLIEK), true);
  assert.equal(relaystand.gereed(PUBLIEK, Date.now() + relaystand.GELDIG_MS + 1), false, 'het bewijs verloopt');
  assert.equal(relaystand.stand({ ...PUBLIEK, TURN_CREDENTIAL_TTL: '600' }).reden, 'TURN_BEWIJS_ANDERE_CONFIG');
});

test('proef: een enkele gezakte URL zet het hele relais dicht, met zijn reden', async () => {
  uitslagVoor = url => (url.schema === 'turn' ? { ok: false, reden: 'TURN_GEEN_ANTWOORD' } : { ok: true, bytesAB: 70000, bytesBA: 70001 });
  const u = await relaystand.proef(PUBLIEK);
  assert.equal(u.ok, false);
  assert.equal(u.reden, 'TURN_GEEN_ANTWOORD');
  assert.equal(relaystand.stand(PUBLIEK).reden, 'TURN_GEEN_ANTWOORD');
  assert.equal(relaystand.gereed(PUBLIEK), false);
  assert.deepEqual(relaystand.publiekeUitslag(), { ok: false, reden: 'TURN_GEEN_ANTWOORD', gemetenOp: u.gemetenOp, geldigTot: u.gemetenOp,
    urls: [
      { url: 'turns:turn.rtg-proef.nl:5349?transport=tcp', transport: 'tls', ok: true, reden: null, bytesAB: 70000, bytesBA: 70001 },
      { url: 'turn:turn.rtg-proef.nl:3478?transport=udp', transport: 'udp', ok: false, reden: 'TURN_GEEN_ANTWOORD', bytesAB: 0, bytesBA: 0 }
    ] });
  assert.equal(JSON.stringify(relaystand.publiekeUitslag()).includes(GEHEIM), false);
});

test('proef: twee gelijktijdige vragen delen een lopende proef', async () => {
  const [a, b] = await Promise.all([relaystand.proef(LOKAAL), relaystand.proef(LOKAAL)]);
  assert.equal(a, b);
  assert.equal(gezien.length, 1);
  assert.equal(gezien[0].opties.eisOpenbaarRelay, false, 'buiten publieke productie geen eis van een openbaar relais');
  const c = await relaystand.proef(LOKAAL);
  assert.notEqual(c, a, 'na afloop draait een nieuwe vraag een nieuwe proef');
});

test('publiekeUitslag en vergeet: zonder proef niets, en vergeten zet alleen dicht', async () => {
  assert.equal(relaystand.publiekeUitslag(), null);
  await relaystand.proef({});
  assert.deepEqual(relaystand.publiekeUitslag().urls, []);
  await relaystand.proef(PUBLIEK);
  assert.equal(relaystand.stand(PUBLIEK).geverifieerd, true);
  relaystand.vergeet();
  assert.equal(relaystand.stand(PUBLIEK).reden, 'TURN_NOG_NIET_BEWEZEN');
});

test('start: niet zonder TURN_URL, een keer met, en de eerste ronde logt zijn uitslag', async () => {
  assert.equal(relaystand.start({}), false);
  assert.equal(relaystand.start({ TURN_URL: '   ' }), false);
  const log = [];
  let klaar;
  const gelogd = new Promise(r => { klaar = r; });
  assert.equal(relaystand.start(LOKAAL, u => { log.push(u); klaar(); }), true);
  assert.equal(relaystand.start(LOKAAL), false, 'er loopt er al een');
  await gelogd;
  assert.equal(log[0].ok, true);
  relaystand.stop();
  relaystand.stop();
  assert.equal(relaystand.start(LOKAAL), true, 'na stop mag hij weer');
  relaystand.stop();
});

/* ------------------------------------------------------------------ ijs */

test('binnenLimiet: dertig per minuut per actor, en het venster schuift', () => {
  const t0 = 1_000_000;
  for (let i = 0; i < ijs.LIMIET; i++) assert.equal(ijs.binnenLimiet('a', t0 + i), true, 'uitgifte ' + (i + 1));
  assert.equal(ijs.binnenLimiet('a', t0 + 100), false);
  assert.equal(ijs.binnenLimiet('b', t0 + 100), true, 'een andere actor heeft zijn eigen plafond');
  assert.equal(ijs.binnenLimiet('a', t0 + ijs.VENSTER_MS + 1), true, 'na het venster mag het weer');
  ijs.vergeetLimieten();
  assert.equal(ijs.binnenLimiet('a', t0 + 101), true);
});

test('binnenLimiet: het geheugen is begrensd en vergeet de oudste actor', () => {
  for (let i = 0; i <= 50000; i++) ijs.binnenLimiet('actor-' + i, 5);
  /* actor-0 is verdrongen: hij begint weer bij nul en mag dus dertig keer. */
  for (let i = 0; i < ijs.LIMIET - 1; i++) ijs.binnenLimiet('actor-0', 6);
  assert.equal(ijs.binnenLimiet('actor-0', 6), true);
  assert.equal(ijs.binnenLimiet('actor-0', 6), false);
  ijs.vergeetLimieten();
});

test('stunLijst: de eigen host buiten productie, de reserve alleen op verzoek, en niets zonder host', () => {
  assert.deepEqual(ijs.stunLijst('rtg.local', {}), [{ urls: ['stun:rtg.local:3478'] }]);
  assert.deepEqual(ijs.stunLijst('rtg.local', { STUN_FALLBACK_GOOGLE: '1', STUN_PORT: '3479' }),
    [{ urls: ['stun:rtg.local:3479', 'stun:stun.l.google.com:19302'] }]);
  assert.deepEqual(ijs.stunLijst(null, { STUN_FALLBACK_GOOGLE: '1' }), [{ urls: ['stun:stun.l.google.com:19302'] }]);
  assert.deepEqual(ijs.stunLijst(null, {}), []);
  assert.deepEqual(ijs.stunLijst('kwaad.nl', PUBLIEK), [{ urls: ['stun:rtg-proef.nl:3478'] }], 'productie: de host uit APP_URL');
  assert.deepEqual(ijs.stunLijst('kwaad.nl', { ...PUBLIEK, APP_URL: '', STUN_FALLBACK_GOOGLE: '1' }), [],
    'publieke productie zonder eigen host: geen STUN, en geen reserve van derden');
});

test('antwoord: zonder actor 401 met STUN, en de kill switch geeft niemand iets', () => {
  const anon = ijs.antwoord(null, { hostname: 'rtg.local', env: LOKAAL });
  assert.equal(anon.status, 401);
  assert.deepEqual(anon.body.iceServers, [{ urls: ['stun:rtg.local:3478'] }]);
  assert.equal(anon.body.iceServers.length, 1, 'zonder kill switch staat er wel een STUN-adres');
  assert.equal(anon.body.relay.vereist, false);
  const uit = ijs.antwoord('sessie:a', { hostname: 'rtg.local', env: { ...LOKAAL, RTG_RTC_UIT: '1' } });
  assert.equal(uit.status, 503);
  assert.deepEqual(uit.body.iceServers, []);
  assert.equal(uit.body.relay.reden, 'RTC_KILL_SWITCH');
  assert.deepEqual(ijs.antwoord(null, { env: { RTG_RTC_UIT: '1' } }).body.iceServers, [], 'ook anoniem geen STUN');
});

test('antwoord: een actor krijgt buiten publieke productie een kortlevend TURN-credential', () => {
  const nu = () => 1_700_000_000_000;
  const r = ijs.antwoord('sessie:lid-1', { hostname: 'rtg.local', env: { ...LOKAAL, TURN_CREDENTIAL_TTL: '900' }, nu });
  assert.equal(r.status, 200);
  assert.equal(r.body.verloopt, 1_700_000_000 + 900);
  const turn = r.body.iceServers.find(s => s.urls.includes(LOKAAL.TURN_URL));
  assert.ok(turn);
  assert.equal(turn.username.includes('lid-1'), false, 'een ondoorzichtig label, geen codenaam');
  /* Een vaste credential gaat mee zonder verloop; zonder TURN alleen STUN. */
  const vast = ijs.antwoord('sessie:lid-2', { hostname: 'rtg.local',
    env: { TURN_URL: LOKAAL.TURN_URL, TURN_USER: 'rtgturn', TURN_PASS: GEHEIM } });
  assert.equal('verloopt' in vast.body, false);
  assert.equal(vast.body.iceServers[1].username, 'rtgturn');
  const kaal = ijs.antwoord('sessie:lid-3', { hostname: 'rtg.local', env: {} });
  assert.deepEqual(kaal.body, { iceServers: [{ urls: ['stun:rtg.local:3478'] }],
    relay: { vereist: false, beschikbaar: true, geverifieerd: false, reden: 'RELAY_NIET_VEREIST' } });
});

test('antwoord: boven het plafond 429, met STUN maar zonder TURN', () => {
  for (let i = 0; i < ijs.LIMIET; i++) assert.equal(ijs.antwoord('sessie:veel', { hostname: 'h.local', env: LOKAAL }).status, 200);
  const r = ijs.antwoord('sessie:veel', { hostname: 'h.local', env: LOKAAL });
  assert.equal(r.status, 429);
  assert.equal(JSON.stringify(r.body.iceServers).includes('turn:'), false);
});

test('antwoord in publieke productie: zonder bewijs geen TURN, met bewijs wel', async () => {
  const zonder = ijs.antwoord('sessie:p', { env: PUBLIEK });
  assert.equal(zonder.status, 200);
  assert.deepEqual(zonder.body.iceServers, [{ urls: ['stun:rtg-proef.nl:3478'] }]);
  assert.equal(zonder.body.relay.reden, 'TURN_NOG_NIET_BEWEZEN');
  await relaystand.proef(PUBLIEK);
  const met = ijs.antwoord('sessie:p', { env: PUBLIEK });
  assert.equal(met.body.relay.geverifieerd, true);
  assert.equal(met.body.iceServers.length, 2);
  assert.ok(met.body.verloopt > Date.now() / 1000);
});

test('bearerActor: een stabiele sessiesleutel, anders een hash van het token, nooit het token zelf', () => {
  const req = h => ({ get: k => (k === 'authorization' ? h : undefined) });
  const sessies = { 'tok-1': { key: 'LID-1' }, 'tok-2': { rol: 'kantoor' } };
  const los = t => sessies[t] || null;
  assert.equal(ijs.bearerActor(req('Bearer tok-1'), los), 'sessie:LID-1');
  const zonderSleutel = ijs.bearerActor(req('Bearer tok-2'), los);
  assert.equal(zonderSleutel, 'token:' + crypto.createHash('sha256').update('tok-2').digest('hex').slice(0, 32));
  assert.equal(ijs.bearerActor(req('Bearer onbekend'), los), null);
  assert.equal(ijs.bearerActor(req('Basic abc'), los), null);
  assert.equal(ijs.bearerActor(req(undefined), los), null);
  assert.equal(ijs.bearerActor(req('Bearer tok-1'), null), null, 'zonder sessieresolver geen actor');
  assert.equal(ijs.bearerActor({}, los), null);
  assert.equal(ijs.bearerActor(null, los), null);
});

test('stuur: nooit in een cache, met de status en het lichaam van het antwoord', () => {
  const uit = {};
  const res = { set(k, v) { uit.kop = [k, v]; return res; }, status(s) { uit.status = s; return res; }, json(b) { uit.body = b; return 'klaar'; } };
  assert.equal(ijs.stuur(res, { status: 429, body: { error: 'x' } }), 'klaar');
  assert.deepEqual(uit, { kop: ['Cache-Control', 'no-store'], status: 429, body: { error: 'x' } });
});
