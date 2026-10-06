/* EEN ECHT GESPREK VIA HET RELAIS: echte RTG-server, echte coturn, echte Chromium.

   De server geeft (alleen aan een ingelogd lid) een kortlevend credential uit
   via /api/ice. Precies DAT credential gaat naar twee gescheiden
   browsercontexten met `iceTransportPolicy: 'relay'`; daarna moeten audio,
   video en 64 KiB data in beide richtingen aankomen en moet het geselecteerde
   kandidatenpaar aan beide kanten `relay` zijn (scripts/lib/relaygesprek.js).

   Negatief: een gemanipuleerd, verlopen (met een GELDIGE HMAC), aan een ander
   geheim of een andere gebruikersnaam gebonden credential levert geen enkele
   relay-allocatie op en dus geen verbinding.

   Wat deze toets NIET bewijst: TURN over TLS in de browser (Chromium vertrouwt
   het zelfondertekende proefcertificaat terecht niet; TLS is met een vastgepind
   certificaat bewezen in test/rtc-relay.test.js), en een tweede netwerk-AS --
   dat is het externe connectionRealtime-bewijs van de release. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, laadPlaywright, browserOpties, geenBrowser, nepMediaArgs } = require('./helper');
const { opts, maakCert, startCoturn, nieuwGeheim } = require('./lib/coturn');
const { relayGesprek } = require('../scripts/lib/relaygesprek');
const turn = require('../server/config/turn');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtc-e2e-'));
const GEHEIM = nieuwGeheim();
let coturn = null, server = null, browser = null;

test.after(async () => {
  if (browser) await browser.close().catch(() => {});
  if (server) try { server.child.kill('SIGKILL'); } catch (e) {}
  if (coturn) coturn.kind.kill('SIGKILL');
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('Chromium belt met audio, video en data via het relais met het credential van /api/ice', opts, async () => {
  maakCert(TMP);
  coturn = await startCoturn(TMP, GEHEIM);
  const udp = 'turn:127.0.0.1:' + coturn.poort + '?transport=udp';
  const tcp = 'turn:127.0.0.1:' + coturn.poort + '?transport=tcp';
  server = await startServer({ env: { RTG_DATA_DIR: path.join(TMP, 'data'), SMTP_URL: '',
    TURN_URL: udp + ',' + tcp, TURN_SECRET: GEHEIM } });
  const login = await (await fetch(server.base + '/api/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' }) })).json();
  const d = await (await fetch(server.base + '/api/ice', { headers: { Authorization: 'Bearer ' + login.token } })).json();
  const relay = d.iceServers.find(s => s.urls.some(u => u.startsWith('turn:')));
  assert.ok(relay, 'de server gaf een TURN-credential aan het lid');

  const pw = laadPlaywright();
  const opties = browserOpties(pw, { args: nepMediaArgs() });
  assert.ok(opties, geenBrowser(pw) || 'geen browser');
  browser = await pw.chromium.launch(opties);
  for (const url of [udp, tcp]) {
    const r = await relayGesprek(browser, [{ urls: [url], username: relay.username, credential: relay.credential }]);
    assert.equal(r.ok, true, url + ': ' + JSON.stringify(r));
    assert.equal(r.nietRelayKandidaten, 0, 'met relay-beleid bestaat er geen andere route');
    for (const s of [r.statA, r.statB]) {
      assert.equal(s.lokaal, 'relay'); assert.equal(s.extern, 'relay');
      assert.equal(s.lokaalProtocol, url.endsWith('tcp') ? 'tcp' : 'udp', 'het gevraagde transport naar coturn');
      assert.ok(s.rtp.audio > 0, 'voice kwam aan'); assert.ok(s.rtp.video > 0, 'video kwam aan');
    }
    assert.ok(r.bytesAB >= 65536 && r.bytesBA >= 65536, 'bidirectioneel 64 KiB');
  }
});

test('een fout, verlopen of gemanipuleerd credential verbindt niet', opts, async () => {
  assert.ok(browser && coturn, 'draait na de positieve toets');
  const udp = 'turn:127.0.0.1:' + coturn.poort + '?transport=udp';
  const geldig = turn.tijdelijk(GEHEIM, { actor: 'proef' });
  const verlopen = turn.tijdelijk(GEHEIM, { actor: 'proef', nu: () => Date.now() - 3 * 3600000 });
  const vreemd = turn.tijdelijk(crypto.randomBytes(32).toString('hex'), { actor: 'proef' });
  const besturing = await relayGesprek(browser, [{ urls: [udp], username: geldig.username, credential: geldig.credential }]);
  assert.equal(besturing.ok, true, 'besturingsproef: het geldige credential werkt in deze opstelling');
  const gevallen = {
    gemanipuleerd: { username: geldig.username, credential: (geldig.credential[0] === 'A' ? 'B' : 'A') + geldig.credential.slice(1) },
    verlopen: { username: verlopen.username, credential: verlopen.credential },
    vreemdGeheim: { username: vreemd.username, credential: vreemd.credential },
    andereGebruikersnaam: { username: (Number(geldig.username.split(':')[0]) + 60) + ':' + geldig.username.split(':')[1],
      credential: geldig.credential }
  };
  for (const [naam, c] of Object.entries(gevallen)) {
    const r = await relayGesprek(browser, [{ urls: [udp], ...c }], { timeoutMs: 6000 });
    assert.equal(r.ok, false, naam);
    assert.equal(r.relayKandidatenA + r.relayKandidatenB, 0, naam + ': coturn gaf geen allocatie');
  }
});
