/* WAAR LUISTERT DE SERVER, EN WELKE STAND IS DIT? -- tak voor tak.

   Toetst server/lib/luisteradres.js (isLoopback, bindBesluit, luisterHost) en
   server/config/omgeving.js (keurOmgeving, bewezenLokaal) als zuivere
   functies op een eigen omgevingsobject: productie volgt de aanvrager, de
   toetsstand alleen de loopback, en ontwikkeling de loopback tenzij het
   netwerk aantoonbaar lokaal is of de beheerder dat bevestigt. Waar de
   functie zelf naar process.env grijpt, zet de toets die waarden na afloop
   terug. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const la = require('../server/lib/luisteradres');
const omgeving = require('../server/config/omgeving');

/* Zet een paar process.env-waarden tijdelijk, en altijd terug. */
function metEnv(waarden, fn) {
  const oud = {};
  for (const k of Object.keys(waarden)) { oud[k] = process.env[k]; if (waarden[k] === undefined) delete process.env[k]; else process.env[k] = waarden[k]; }
  try { return fn(); } finally {
    for (const k of Object.keys(oud)) { if (oud[k] === undefined) delete process.env[k]; else process.env[k] = oud[k]; }
  }
}
const SCHOON = { NODE_ENV: undefined, RTG_BIND: undefined, APP_URL: undefined, RTG_DOMAINS: undefined,
  RTG_ACME: undefined, RTG_TLS_DOMAIN: undefined, RTG_LOKAAL_NETWERK: undefined, RTG_CLUSTER_KEY: undefined };

test('isLoopback: alleen de loopback van deze machine, niet het eigen netwerk', () => {
  for (const h of ['localhost', ' LocalHost ', '::1', '[::1]', '127.0.0.1', '127.1.2.3'])
    assert.equal(la.isLoopback(h), true, h);
  for (const h of ['', null, undefined, '0.0.0.0', '192.168.1.5', '128.0.0.1', '127.0.0.1.5', '127.0.0', 'localhost.rtg.nl', '::'])
    assert.equal(la.isLoopback(h), false, String(h));
});

test('bindBesluit in productie: wat de aanvrager zegt, anders de standaard, anders alle interfaces', () => {
  assert.deepEqual(la.bindBesluit({ NODE_ENV: 'production', RTG_BIND: ' 0.0.0.0 ' }, '127.0.0.1'), { host: '0.0.0.0' });
  assert.deepEqual(la.bindBesluit({ NODE_ENV: 'production' }, '127.0.0.1'), { host: '127.0.0.1' });
  assert.deepEqual(la.bindBesluit({ NODE_ENV: 'production' }), { host: '' });
});

test('bindBesluit in de toetsstand: de loopback, en elk ander adres is een fout', () => {
  assert.deepEqual(la.bindBesluit({ NODE_ENV: 'test' }, '0.0.0.0'), { host: '127.0.0.1' }, 'de standaard telt hier niet');
  assert.deepEqual(la.bindBesluit({ NODE_ENV: 'test', RTG_BIND: '::1' }), { host: '::1' });
  const b = la.bindBesluit({ NODE_ENV: 'test', RTG_BIND: '0.0.0.0' });
  assert.equal(b.host, undefined);
  assert.equal(b.fout, la.testBindFout('0.0.0.0'));
  assert.match(b.fout, /NODE_ENV=test met RTG_BIND=0\.0\.0\.0/);
});

test('bindBesluit in ontwikkeling: een loopbackwens gaat altijd door', () => {
  assert.deepEqual(la.bindBesluit({ RTG_BIND: '127.0.0.2' }), { host: '127.0.0.2' });
  assert.deepEqual(la.bindBesluit({ NODE_ENV: 'development' }, 'localhost'), { host: 'localhost' });
});

test('bindBesluit in ontwikkeling: een lokaal APP_URL of een bevestiging opent het eigen netwerk', () => {
  assert.deepEqual(la.bindBesluit({ APP_URL: 'http://192.168.1.20:3000', RTG_BIND: '0.0.0.0' }), { host: '0.0.0.0' });
  assert.deepEqual(la.bindBesluit({ APP_URL: 'http://rtg.local' }), { host: '' }, 'zonder RTG_BIND: alle interfaces');
  assert.deepEqual(la.bindBesluit({ RTG_LOKAAL_NETWERK: la.LOKAAL_BEVESTIGD, RTG_BIND: '0.0.0.0' }), { host: '0.0.0.0' });
  assert.equal(la.LOKAAL_BEVESTIGD, 'BEVESTIGD');
  assert.ok(la.bindBesluit({ RTG_LOKAAL_NETWERK: 'ja', RTG_BIND: '0.0.0.0' }).fout, 'alleen het exacte woord telt');
});

test('bindBesluit in ontwikkeling zonder bewijs: stil de loopback, of een fout als RTG_BIND het anders wil', () => {
  assert.deepEqual(la.bindBesluit({}, ''), { host: '127.0.0.1', verengd: true });
  assert.deepEqual(la.bindBesluit({ APP_URL: 'https://rtg.nl' }), { host: '127.0.0.1', verengd: true });
  const b = la.bindBesluit({ RTG_BIND: '0.0.0.0', APP_URL: 'https://rtg.nl' });
  assert.match(b.fout, /^RTG_BIND=0\.0\.0\.0 buiten productie/);
  assert.match(b.fout, /RTG_LOKAAL_NETWERK=BEVESTIGD/);
});

test('bindBesluit zonder env leest process.env', () => {
  metEnv({ ...SCHOON, NODE_ENV: 'test' }, () => assert.deepEqual(la.bindBesluit(), { host: '127.0.0.1' }));
  metEnv({ ...SCHOON, NODE_ENV: 'production', RTG_BIND: '10.0.0.4' }, () =>
    assert.deepEqual(la.bindBesluit(undefined, ''), { host: '10.0.0.4' }));
});

test('luisterHost geeft de host, en gooit bij een fout in plaats van stil verkeerd te luisteren', () => {
  assert.equal(la.luisterHost({ NODE_ENV: 'test' }), '127.0.0.1');
  assert.equal(la.luisterHost({ NODE_ENV: 'production' }, '0.0.0.0'), '0.0.0.0');
  assert.throws(() => la.luisterHost({ NODE_ENV: 'test', RTG_BIND: '10.0.0.1' }), /NODE_ENV=test met RTG_BIND=10\.0\.0\.1/);
  assert.equal(omgeving.luisterHost, la.luisterHost, 'de keuring en de luisteraars delen een besluit');
});

test('keurOmgeving: de gesloten lijst van standen', () => {
  for (const stand of [undefined, '', 'production', 'development', 'test']) {
    const fouten = [];
    omgeving.keurOmgeving({ NODE_ENV: stand, RTG_BIND: '127.0.0.1' }, fouten);
    assert.deepEqual(fouten, [], String(stand));
  }
  for (const stand of ['prod', 'Production', 'staging']) {
    const fouten = [];
    omgeving.keurOmgeving({ NODE_ENV: stand, RTG_BIND: '127.0.0.1' }, fouten);
    assert.equal(fouten.length, 1, stand);
    assert.match(fouten[0], new RegExp('NODE_ENV="' + stand + '" is geen stand'));
  }
  assert.deepEqual(omgeving.STANDEN, ['production', 'development', 'test']);
  assert.ok(Object.isFrozen(omgeving.STANDEN));
});

test('keurOmgeving: een bindfout breekt de start af, ook naast een onbekende stand', () => {
  const a = [];
  omgeving.keurOmgeving({ NODE_ENV: 'test', RTG_BIND: '0.0.0.0' }, a);
  assert.equal(a.length, 1);
  assert.match(a[0], /toetsstand/);
  const b = [];
  omgeving.keurOmgeving({ NODE_ENV: 'prod', RTG_BIND: '0.0.0.0' }, b);
  assert.equal(b.length, 2, 'onbekende stand EN een niet-lokaal bindadres');
  /* Met een poortwachter (cluster of domeinen) is de standaard de loopback,
     dus zonder RTG_BIND is er dan niets te melden. */
  const c = [];
  omgeving.keurOmgeving({ RTG_CLUSTER_KEY: 'k' }, c);
  omgeving.keurOmgeving({ RTG_DOMAINS: 'member' }, c);
  omgeving.keurOmgeving({}, c);
  assert.deepEqual(c, []);
});

test('bewezenLokaal: drie bewijzen, en een openbaar adres wint van alles', () => {
  assert.deepEqual(omgeving.bewezenLokaal({ APP_URL: 'http://localhost:3000' }),
    { ja: true, waarom: 'APP_URL is lokaal (localhost)' });
  assert.deepEqual(omgeving.bewezenLokaal({ APP_URL: 'https://rtg.nl', NODE_ENV: 'test' }),
    { ja: false, waarom: 'het opgegeven adres is openbaar (rtg.nl)' });
  assert.deepEqual(omgeving.bewezenLokaal({ NODE_ENV: 'test' }),
    { ja: true, waarom: 'de toetsstand luistert alleen op de loopback' });
  assert.deepEqual(omgeving.bewezenLokaal({ RTG_BIND: '127.0.0.1' }),
    { ja: true, waarom: 'RTG_BIND is de loopback en er staat geen poortwachter voor' });
});

test('bewezenLokaal: een poortwachter of een open bind maakt een loopback geen bewijs', () => {
  const met = omgeving.bewezenLokaal({ RTG_BIND: '127.0.0.1', RTG_CLUSTER_KEY: 'k' });
  assert.equal(met.ja, false);
  assert.equal(met.waarom, 'APP_URL is niet gezet, en er staat een poortwachter voor die naar buiten luistert');
  const open = omgeving.bewezenLokaal({ RTG_BIND: '0.0.0.0', APP_URL: 'http://webserver:3000' });
  assert.equal(open.ja, false);
  assert.equal(open.waarom, 'APP_URL wijst naar webserver, en RTG_BIND is niet de loopback');
  const onleesbaar = omgeving.bewezenLokaal({ APP_URL: 'geen adres' });
  assert.match(onleesbaar.waarom, /^APP_URL is geen leesbaar adres, en RTG_BIND/);
});

test('bewezenLokaal zonder env leest process.env', () => {
  metEnv({ ...SCHOON, NODE_ENV: 'test' }, () => assert.equal(omgeving.bewezenLokaal().ja, true));
  metEnv({ ...SCHOON, APP_URL: 'https://rtg.nl' }, () => assert.equal(omgeving.bewezenLokaal(null).ja, false));
});
