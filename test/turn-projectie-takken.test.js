/* DE TURN-PROJECTIE TAK VOOR TAK (server/config/turn.js).

   Wat dit bestand vasthoudt: hoe een TURN- en STUN-adres wordt ontleed (vorm,
   poort, host, transport, en wat publieke productie extra weigert), hoe een
   lijst dubbelen en lege stukken behandelt en in publieke productie een
   turns:-adres eist, hoe de STUN-projectie zijn eigen host bepaalt en een
   vreemde host weigert, hoe de vingerafdruk meebeweegt met URL, geheim en
   levensduur, en wat projecteerTurn voor een vast en een tijdelijk credential
   aan de browser geeft. Geen netwerk: alles is ontleding en rekenwerk. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const turn = require('../server/config/turn');

const HOST = 'turn.rtg-proef.nl';
const GEHEIM = crypto.createHash('sha256').update('rtg-turn-proefgeheim').digest('hex');
const PUB = { publiekeProductie: true };

test('ontleedUrl: een geldige turns: en turn: met transport', () => {
  const a = turn.ontleedUrl(' turns:' + HOST + ':5349 ');
  assert.deepEqual(a, { ok: true, url: 'turns:' + HOST + ':5349', schema: 'turns', host: HOST, poort: 5349, transport: null });
  const b = turn.ontleedUrl('TURN:' + HOST + ':3478?transport=UDP');
  assert.equal(b.ok, true);
  assert.equal(b.schema, 'turn');
  assert.equal(b.transport, 'udp');
  const c = turn.ontleedUrl('turn:[2a00:1450::1]:3478');
  assert.equal(c.ok, true);
  assert.equal(c.host, '2a00:1450::1');
});

test('ontleedUrl: vorm, poort en host worden geweigerd met hun reden', () => {
  assert.equal(turn.ontleedUrl('').reden, 'formaat-host-of-poort-ongeldig');
  assert.equal(turn.ontleedUrl(null).reden, 'formaat-host-of-poort-ongeldig');
  assert.equal(turn.ontleedUrl('http://' + HOST + ':80').reden, 'formaat-host-of-poort-ongeldig');
  assert.equal(turn.ontleedUrl('turn:' + HOST).reden, 'formaat-host-of-poort-ongeldig');
  assert.equal(turn.ontleedUrl('turn:' + HOST + ':0').reden, 'poort-ongeldig');
  assert.equal(turn.ontleedUrl('turn:' + HOST + ':70000').reden, 'poort-ongeldig');
  assert.equal(turn.ontleedUrl('turn:host_met_streep:3478').reden, 'host-ongeldig');
  /* Buiten publieke productie mag een privé-host wel (eigen lab). */
  assert.equal(turn.ontleedUrl('turn:10.0.0.1:3478').ok, true);
});

test('ontleedUrl in publieke productie: kale turn:, turns: over udp en een privé-host zijn dicht', () => {
  assert.equal(turn.ontleedUrl('turn:' + HOST + ':3478', PUB).reden, 'plaintext-turn-niet-toegestaan');
  assert.equal(turn.ontleedUrl('turn:' + HOST + ':3478?transport=tcp', PUB).reden, 'plaintext-turn-niet-toegestaan');
  assert.equal(turn.ontleedUrl('turn:' + HOST + ':3478?transport=udp', PUB).ok, true);
  assert.equal(turn.ontleedUrl('turns:' + HOST + ':5349?transport=udp', PUB).reden, 'onveilig-transport');
  assert.equal(turn.ontleedUrl('turns:' + HOST + ':5349?transport=tcp', PUB).ok, true);
  assert.equal(turn.ontleedUrl('turns:' + HOST + ':5349', PUB).ok, true);
  assert.equal(turn.ontleedUrl('turns:10.0.0.1:5349', PUB).reden, 'host-niet-openbaar');
  assert.equal(turn.ontleedUrl('turns:turn.example.com:5349', PUB).reden, 'host-niet-openbaar');
});

test('ontleedLijst: dubbelen tellen een keer, lege stukken en fouten krijgen hun index', () => {
  const uit = turn.ontleedLijst('turns:' + HOST + ':5349, ,turns:' + HOST + ':5349,turn:x_y:1');
  assert.deepEqual(uit.urls, ['turns:' + HOST + ':5349']);
  assert.deepEqual(uit.fouten, [{ index: 1, reden: 'lege-url' }, { index: 3, reden: 'host-ongeldig' }]);
  const leeg = turn.ontleedLijst('   ');
  assert.deepEqual(leeg, { urls: [], fouten: [] });
  assert.deepEqual(turn.ontleedLijst(undefined, PUB), { urls: [], fouten: [] });
});

test('ontleedLijst in publieke productie: zonder turns:-adres een fout op index -1', () => {
  const zonder = turn.ontleedLijst('turn:' + HOST + ':3478?transport=udp', PUB);
  assert.deepEqual(zonder.urls, ['turn:' + HOST + ':3478?transport=udp']);
  assert.deepEqual(zonder.fouten, [{ index: -1, reden: 'turns-adres-ontbreekt' }]);
  const met = turn.ontleedLijst('turn:' + HOST + ':3478?transport=udp,turns:' + HOST + ':5349', PUB);
  assert.equal(met.urls.length, 2);
  assert.equal(met.fouten.length, 0);
  /* Buiten publieke productie geen eis. */
  assert.equal(turn.ontleedLijst('turn:' + HOST + ':3478').fouten.length, 0);
});

test('ontleedStunUrl: vorm, poort, host en openbaarheid', () => {
  assert.deepEqual(turn.ontleedStunUrl('stun:' + HOST + ':3478'),
    { ok: true, url: 'stun:' + HOST + ':3478', schema: 'stun', host: HOST, poort: 3478 });
  assert.equal(turn.ontleedStunUrl('STUNS:[2a00:1450::1]:5349').schema, 'stuns');
  assert.equal(turn.ontleedStunUrl('stun:' + HOST + ':3478?transport=udp').reden, 'formaat-host-of-poort-ongeldig');
  assert.equal(turn.ontleedStunUrl(undefined).reden, 'formaat-host-of-poort-ongeldig');
  assert.equal(turn.ontleedStunUrl('stun:' + HOST + ':99999').reden, 'poort-ongeldig');
  assert.equal(turn.ontleedStunUrl('stun:a_b:3478').reden, 'host-ongeldig');
  assert.equal(turn.ontleedStunUrl('stun:192.168.1.1:3478').ok, true);
  assert.equal(turn.ontleedStunUrl('stun:192.168.1.1:3478', PUB).reden, 'host-niet-openbaar');
});

test('ontleedStunLijst: dubbelen, lege stukken en items', () => {
  const uit = turn.ontleedStunLijst('stun:' + HOST + ':3478,,stun:' + HOST + ':3478,stun:x:0');
  assert.deepEqual(uit.urls, ['stun:' + HOST + ':3478']);
  assert.equal(uit.items.length, 1);
  assert.equal(uit.items[0].host, HOST);
  assert.deepEqual(uit.fouten, [{ index: 1, reden: 'lege-url' }, { index: 3, reden: 'poort-ongeldig' }]);
  assert.deepEqual(turn.ontleedStunLijst(''), { urls: [], items: [], fouten: [] });
});

test('projecteerStun: de host komt uit STUN_PUBLIC_HOST, dan APP_URL, en buiten productie uit het verzoek', () => {
  assert.deepEqual(turn.projecteerStun({ STUN_PUBLIC_HOST: HOST }), { urls: ['stun:' + HOST + ':3478'], fouten: [] });
  assert.deepEqual(turn.projecteerStun({ APP_URL: 'https://' + HOST + '/', STUN_PORT: '3479' }).urls, ['stun:' + HOST + ':3479']);
  assert.deepEqual(turn.projecteerStun({ APP_URL: 'geen url' }, { requestHost: 'lab.lokaal' }).urls, ['stun:lab.lokaal:3478']);
  /* IPv6 komt tussen haken in de URL; haken in de omgeving worden eerst weggehaald. */
  assert.deepEqual(turn.projecteerStun({ STUN_PUBLIC_HOST: '[2a00:1450::1]' }).urls, ['stun:[2a00:1450::1]:3478']);
  /* Niets te vinden: geen URL's. */
  assert.deepEqual(turn.projecteerStun({}), { urls: null, fouten: [] });
  /* Een expliciete STUN_URL wint van de afgeleide. */
  assert.deepEqual(turn.projecteerStun({ STUN_URL: 'stun:ander.rtg-proef.nl:1', STUN_PUBLIC_HOST: HOST }).urls,
    ['stun:ander.rtg-proef.nl:1']);
});

test('projecteerStun in publieke productie: eigen openbare host, en geen vreemde host in de lijst', () => {
  assert.deepEqual(turn.projecteerStun({ APP_URL: 'https://' + HOST }, PUB), { urls: ['stun:' + HOST + ':3478'], fouten: [] });
  /* Het verzoek telt in productie niet als bron. */
  const zonder = turn.projecteerStun({}, { publiekeProductie: true, requestHost: HOST });
  assert.equal(zonder.urls, null);
  assert.deepEqual(zonder.fouten, [{ index: -1, reden: 'eigen-host-ontbreekt-of-is-onveilig' }]);
  const prive = turn.projecteerStun({ STUN_PUBLIC_HOST: '10.0.0.1' }, PUB);
  assert.equal(prive.urls, null);
  assert.ok(prive.fouten.some(f => f.reden === 'eigen-host-ontbreekt-of-is-onveilig'));
  const vreemd = turn.projecteerStun({ STUN_PUBLIC_HOST: HOST, STUN_URL: 'stun:STUN.andermans.nl:3478,stun:' + HOST.toUpperCase() + ':3478' }, PUB);
  assert.equal(vreemd.urls, null);
  assert.deepEqual(vreemd.fouten, [{ index: 0, reden: 'host-niet-eigendom' }]);
  /* Buiten productie is dezelfde vreemde host wel goed, en blijven de fouten gewoon staan. */
  const lab = turn.projecteerStun({ STUN_URL: 'stun:stun.andermans.nl:3478,stun:a_b:1' });
  assert.deepEqual(lab.urls, ['stun:stun.andermans.nl:3478']);
  assert.deepEqual(lab.fouten, [{ index: 1, reden: 'host-ongeldig' }]);
});

test('vingerafdruk: gelijk bij gelijke configuratie, anders bij URL, geheim, ttl of soort', () => {
  const basis = { TURN_URL: 'turns:' + HOST + ':5349', TURN_SECRET: GEHEIM };
  const v = turn.vingerafdruk(basis);
  assert.match(v, /^[0-9a-f]{64}$/);
  assert.equal(turn.vingerafdruk({ ...basis }), v);
  /* Volgorde van de URL's doet er niet toe. */
  const twee = { ...basis, TURN_URL: 'turns:' + HOST + ':5349,turns:' + HOST + ':443' };
  assert.equal(turn.vingerafdruk({ ...twee, TURN_URL: 'turns:' + HOST + ':443,turns:' + HOST + ':5349' }), turn.vingerafdruk(twee));
  assert.notEqual(turn.vingerafdruk(twee), v);
  assert.notEqual(turn.vingerafdruk({ ...basis, TURN_SECRET: GEHEIM.slice(1) + 'f' }), v);
  assert.notEqual(turn.vingerafdruk({ ...basis, TURN_CREDENTIAL_TTL: '600' }), v);
  const geen = turn.vingerafdruk({ TURN_URL: basis.TURN_URL });
  assert.notEqual(geen, v);
  const vast = turn.vingerafdruk({ TURN_URL: basis.TURN_URL, TURN_USER: 'rtg-relais', TURN_PASS: GEHEIM });
  assert.notEqual(vast, geen);
  /* In publieke productie telt een vast wachtwoord niet: dan is het "geen". */
  assert.equal(turn.vingerafdruk({ TURN_URL: basis.TURN_URL, TURN_USER: 'rtg-relais', TURN_PASS: GEHEIM }, PUB),
    turn.vingerafdruk({ TURN_URL: basis.TURN_URL }, PUB));
});

test('projecteerTurn: zonder URL of credential geen server, met fouten erbij', () => {
  assert.deepEqual(turn.projecteerTurn({}), { server: null, fouten: [] });
  assert.deepEqual(turn.projecteerTurn({ TURN_URL: 'turns:' + HOST + ':5349' }), { server: null, fouten: [] });
  const zwak = turn.projecteerTurn({ TURN_URL: 'turns:' + HOST + ':5349,x', TURN_SECRET: 'kort' });
  assert.equal(zwak.server, null);
  assert.deepEqual(zwak.fouten, [{ index: 1, reden: 'formaat-host-of-poort-ongeldig' }]);
  /* In publieke productie blokkeert elke fout in de lijst. */
  const fout = turn.projecteerTurn({ TURN_URL: 'turns:' + HOST + ':5349,turn:' + HOST + ':3478', TURN_SECRET: GEHEIM }, PUB);
  assert.equal(fout.server, null);
  assert.deepEqual(fout.fouten, [{ index: 1, reden: 'plaintext-turn-niet-toegestaan' }]);
});

test('projecteerTurn: een vast credential gaat ongewijzigd mee, alleen buiten publieke productie', () => {
  const env = { TURN_URL: 'turn:' + HOST + ':3478', TURN_USER: 'rtg-relais', TURN_PASS: GEHEIM };
  const uit = turn.projecteerTurn(env);
  assert.deepEqual(uit.server, { urls: ['turn:' + HOST + ':3478'], username: 'rtg-relais', credential: GEHEIM });
  assert.equal('verloopt' in uit, false);
  assert.equal(turn.projecteerTurn({ ...env, TURN_URL: 'turns:' + HOST + ':5349' }, PUB).server, null);
});

test('projecteerTurn: een tijdelijk credential draagt verloop en een HMAC over de gebruikersnaam', () => {
  const nu = () => 1_700_000_000_000;
  const env = { TURN_URL: 'turns:' + HOST + ':5349', TURN_SECRET: GEHEIM, TURN_CREDENTIAL_TTL: '900' };
  const uit = turn.projecteerTurn(env, { publiekeProductie: true, nu, actor: 'user-7' });
  assert.equal(uit.verloopt, 1_700_000_000 + 900);
  assert.deepEqual(uit.server.urls, ['turns:' + HOST + ':5349']);
  assert.equal(uit.server.username, uit.verloopt + ':' + turn.actorLabel(GEHEIM, 'user-7'));
  assert.equal(uit.server.credential, crypto.createHmac('sha1', GEHEIM).update(uit.server.username).digest('base64'));
  assert.ok(!uit.server.username.includes('user-7'), 'de actor staat er niet leesbaar in');
  /* Een andere actor geeft een ander label onder hetzelfde verloop. */
  const ander = turn.projecteerTurn(env, { nu, actor: 'user-8' });
  assert.notEqual(ander.server.username, uit.server.username);
  /* Zonder ttl de standaard van vier uur. */
  const standaard = turn.projecteerTurn({ TURN_URL: env.TURN_URL, TURN_SECRET: GEHEIM }, { nu });
  assert.equal(standaard.verloopt, 1_700_000_000 + turn.TTL_STANDAARD);
});
