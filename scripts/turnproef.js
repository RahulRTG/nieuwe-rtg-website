#!/usr/bin/env node
/* DE TURN-SMOKE NA UITROL -- een echt gesprek via het LIVE relais.

   Voor wie de productie heeft uitgerold en wil weten of bellen daar werkt, niet
   of de configuratie er netjes uitziet. Wat hij doet:

     1. GET <basis>/api/rtc/stand            moet geverifieerd zijn
     2. GET <basis>/api/ice  (zonder sessie)  moet 401 zijn, zonder TURN
     3. GET <basis>/api/ice  (met sessie)     een kortlevend turns:-credential
     4. Chromium, twee gescheiden contexten, iceTransportPolicy 'relay':
        audio, video en 64 KiB data heen en terug, relay-paar aan beide kanten
     5. hetzelfde met een gemanipuleerd credential: mag NIET verbinden

   Het sessietoken komt uit een BESTAND (nooit uit argv, dat in `ps` staat) en
   wordt nergens afgedrukt; de uitvoer bevat geen credential.

   Gebruik:
     node scripts/turnproef.js --basis=https://<app-domein> --token-bestand=/pad/naar/token \
       [--uit=turnproef.json]

   Uitgang 0 alleen als ALLES klopt. Wat dit niet bewijst: twee verschillende
   netwerk-AS'en (beide browsercontexten draaien op deze machine) -- dat blijft
   het getekende connectionRealtime-bewijs van de externe meetrunner. */
'use strict';

const fs = require('node:fs');
const { relayGesprek } = require('./lib/relaygesprek');

function args(argv) {
  const uit = {};
  for (const a of argv) { const m = a.match(/^--([a-z-]+)=(.*)$/); if (m) uit[m[1]] = m[2]; }
  return uit;
}

async function json(url, opties) {
  const r = await fetch(url, opties);
  let body = null; try { body = await r.json(); } catch (e) {}
  return { status: r.status, cache: r.headers.get('cache-control'), body };
}

async function laadBrowser() {
  const { laadPlaywright, browserOpties, geenBrowser, nepMediaArgs } = require('../test/helper');
  const pw = laadPlaywright();
  const opties = browserOpties(pw, { args: nepMediaArgs() });
  if (!opties) throw new Error(geenBrowser(pw) || 'geen browser');
  return pw.chromium.launch(opties);
}

(async () => {
  const o = args(process.argv.slice(2));
  const stappen = [];
  const stap = (naam, ok, meer) => { stappen.push({ naam, ok: !!ok, ...(meer || {}) }); };
  try {
    if (!/^https:\/\//.test(String(o.basis || ''))) throw new Error('--basis moet een https-adres zijn');
    if (!o['token-bestand']) throw new Error('--token-bestand ontbreekt');
    const basis = o.basis.replace(/\/+$/, '');
    const token = fs.readFileSync(o['token-bestand'], 'utf8').trim();

    const stand = await json(basis + '/api/rtc/stand');
    stap('relaystand geverifieerd', stand.status === 200 && stand.body && stand.body.geverifieerd === true &&
      stand.body.beschikbaar === true, { reden: stand.body && stand.body.reden,
      laatsteProef: stand.body && stand.body.laatsteProef });

    const anoniem = await json(basis + '/api/ice');
    stap('anoniem geen TURN', anoniem.status === 401 &&
      !JSON.stringify((anoniem.body || {}).iceServers || []).match(/turns?:/));

    const met = await json(basis + '/api/ice', { headers: { Authorization: 'Bearer ' + token } });
    const relay = met.body && (met.body.iceServers || []).find(s => (s.urls || []).some(u => /^turns:/.test(u)));
    stap('sessie krijgt turns:-credential', met.status === 200 && met.cache === 'no-store' && !!relay &&
      /^\d+:[A-Za-z0-9_-]{22}$/.test(relay.username), { urls: relay ? relay.urls : [],
      geldigTot: relay ? new Date(Number(relay.username.split(':')[0]) * 1000).toISOString() : null });

    if (relay) {
      const browser = await laadBrowser();
      try {
        for (const url of relay.urls) {
          const r = await relayGesprek(browser, [{ urls: [url], username: relay.username, credential: relay.credential }]);
          stap('gesprek via ' + url, r.ok, { bytesAB: r.bytesAB || 0, bytesBA: r.bytesBA || 0, reden: r.reden || null,
            paarA: r.statA ? [r.statA.lokaal, r.statA.extern] : null, paarB: r.statB ? [r.statB.lokaal, r.statB.extern] : null,
            rtpA: r.statA ? r.statA.rtp : null, rtpB: r.statB ? r.statB.rtp : null });
        }
        const fout = await relayGesprek(browser, [{ urls: [relay.urls[0]], username: relay.username,
          credential: (relay.credential[0] === 'A' ? 'B' : 'A') + relay.credential.slice(1) }], { timeoutMs: 8000 });
        stap('gemanipuleerd credential verbindt niet', fout.ok === false && fout.relayKandidatenA + fout.relayKandidatenB === 0);
      } finally { await browser.close(); }
    }
  } catch (e) {
    stap('proef kon niet draaien', false, { fout: String(e && e.message || e).slice(0, 200) });
  }
  const uitslag = { formaat: 'rtg-turnproef-v1', basis: o.basis || null, op: new Date().toISOString(),
    geslaagd: stappen.length > 0 && stappen.every(s => s.ok), stappen };
  const tekst = JSON.stringify(uitslag, null, 2);
  if (o.uit) fs.writeFileSync(o.uit, tekst + '\n', { mode: 0o600 });
  console.log(tekst);
  process.exit(uitslag.geslaagd ? 0 : 1);
})();
