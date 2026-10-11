/* EEN ECHT WEBRTC-GESPREK VIA HET RELAIS, in een echte browser.

   Twee pagina's in twee GESCHEIDEN browsercontexten (geen gedeelde staat),
   elk met een RTCPeerConnection die `iceTransportPolicy: 'relay'` draagt: een
   directe of STUN-route bestaat dan voor de browser niet, dus als er een
   verbinding komt, loopt die aantoonbaar via TURN. Daarbovenop:

   - audio EN video (Chromiums nepcamera en -microfoon) in beide richtingen,
     met gemeten ontvangen RTP-bytes per soort;
   - een datakanaal met minstens 64 KiB in beide richtingen, byte voor byte
     vergeleken (SHA-256);
   - het geselecteerde kandidatenpaar uit getStats(), aan BEIDE kanten: lokaal
     en extern moeten `relay` zijn.

   De signalering loopt via deze Node-procedure (geen server ertussen); dat is
   het enige dat anders is dan in de app, en het raakt het mediapad niet.

   Gebruikt door test/rtc-relay.test.js en door scripts/turnproef.js. */
'use strict';

const http = require('node:http');

/* getUserMedia bestaat alleen in een secure context; http://127.0.0.1 telt
   als zodanig, een data:-URL niet. Dus een minuscule loopbackserver. */
function pagina() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><meta charset=utf-8><title>relayproef</title>');
    });
    s.listen(0, '127.0.0.1', () => resolve({ url: 'http://127.0.0.1:' + s.address().port + '/', sluit: () => s.close() }));
  });
}

async function maakKant(browser, iceServers, rol, PAGINA) {
  const context = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const page = await context.newPage();
  await page.goto(PAGINA);
  await page.evaluate(async ({ iceServers, rol }) => {
    const S = window.__rtc = { kandidaten: [], ontvangen: [], klaar: false, fout: null };
    const pc = S.pc = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'relay' });
    pc.onicecandidate = e => { if (e.candidate) S.kandidaten.push(e.candidate.toJSON()); else S.klaar = true; };
    const media = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: 320, height: 240 } });
    for (const t of media.getTracks()) pc.addTrack(t, media);
    const koppel = kanaal => {
      kanaal.binaryType = 'arraybuffer';
      S.kanaal = kanaal;
      kanaal.onmessage = e => S.ontvangen.push(new Uint8Array(e.data));
    };
    if (rol === 'a') koppel(pc.createDataChannel('proef', { ordered: true }));
    else pc.ondatachannel = e => koppel(e.channel);
  }, { iceServers, rol });
  return { context, page };
}

const wacht = (ms) => new Promise(r => setTimeout(r, ms));

async function tot(page, expr, ms) {
  const einde = Date.now() + ms;
  while (Date.now() < einde) {
    if (await page.evaluate(expr)) return true;
    await wacht(100);
  }
  return false;
}

async function stuurEnMeet(van, naar, bytes) {
  const verstuurd = await van.page.evaluate(async (bytes) => {
    const data = crypto.getRandomValues(new Uint8Array(bytes));
    const k = window.__rtc.kanaal;
    for (let i = 0; i < bytes; i += 16384) {
      while (k.bufferedAmount > 256 * 1024) await new Promise(r => setTimeout(r, 10));
      k.send(data.slice(i, i + 16384));
    }
    const h = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('');
  }, bytes);
  const ok = await tot(naar.page, `window.__rtc.ontvangen.reduce((n, b) => n + b.length, 0) >= ${bytes}`, 20000);
  const ontvangen = await naar.page.evaluate(async () => {
    const delen = window.__rtc.ontvangen; window.__rtc.ontvangen = [];
    const n = delen.reduce((s, b) => s + b.length, 0);
    const alles = new Uint8Array(n); let i = 0;
    for (const d of delen) { alles.set(d, i); i += d.length; }
    const h = await crypto.subtle.digest('SHA-256', alles);
    return { n, hash: [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('') };
  });
  return { ok: ok && ontvangen.n === bytes && ontvangen.hash === verstuurd, bytes: ontvangen.n };
}

async function statistiek(page) {
  return page.evaluate(async () => {
    const st = await window.__rtc.pc.getStats();
    const per = new Map(); st.forEach(r => per.set(r.id, r));
    let paar = null;
    st.forEach(r => { if (r.type === 'transport' && r.selectedCandidatePairId) paar = per.get(r.selectedCandidatePairId); });
    if (!paar) st.forEach(r => { if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') paar = r; });
    const lok = paar && per.get(paar.localCandidateId), ext = paar && per.get(paar.remoteCandidateId);
    const rtp = { audio: 0, video: 0 };
    st.forEach(r => { if (r.type === 'inbound-rtp' && rtp[r.kind] != null) rtp[r.kind] += r.bytesReceived || 0; });
    return { lokaal: lok ? lok.candidateType : null, extern: ext ? ext.candidateType : null,
      lokaalProtocol: lok ? (lok.relayProtocol || lok.protocol) : null, rtp,
      ice: window.__rtc.pc.iceConnectionState };
  });
}

/* iceServers: precies wat /api/ice teruggaf. Geeft een uitslag die nooit
   gooit; `ok` is alleen waar als ALLES gemeten is. */
async function relayGesprek(browser, iceServers, { bytes = 65536, timeoutMs = 30000 } = {}) {
  const uit = { ok: false, relayKandidatenA: 0, relayKandidatenB: 0 };
  let a, b;
  const p = await pagina();
  try {
    a = await maakKant(browser, iceServers, 'a', p.url);
    b = await maakKant(browser, iceServers, 'b', p.url);
    const offer = await a.page.evaluate(async () => { const o = await window.__rtc.pc.createOffer(); await window.__rtc.pc.setLocalDescription(o); return o; });
    await b.page.evaluate(async (o) => { await window.__rtc.pc.setRemoteDescription(o); }, offer);
    const answer = await b.page.evaluate(async () => { const o = await window.__rtc.pc.createAnswer(); await window.__rtc.pc.setLocalDescription(o); return o; });
    await a.page.evaluate(async (o) => { await window.__rtc.pc.setRemoteDescription(o); }, answer);
    await Promise.all([tot(a.page, 'window.__rtc.klaar', 15000), tot(b.page, 'window.__rtc.klaar', 15000)]);
    const kand = async (p) => p.page.evaluate(() => window.__rtc.kandidaten);
    const ka = await kand(a), kb = await kand(b);
    uit.relayKandidatenA = ka.filter(c => / typ relay /.test(c.candidate)).length;
    uit.relayKandidatenB = kb.filter(c => / typ relay /.test(c.candidate)).length;
    uit.nietRelayKandidaten = [...ka, ...kb].filter(c => !/ typ relay /.test(c.candidate)).length;
    for (const c of kb) await a.page.evaluate(async (c) => window.__rtc.pc.addIceCandidate(c), c);
    for (const c of ka) await b.page.evaluate(async (c) => window.__rtc.pc.addIceCandidate(c), c);
    const verbonden = `['connected','completed'].includes(window.__rtc.pc.iceConnectionState) && window.__rtc.kanaal && window.__rtc.kanaal.readyState === 'open'`;
    const [va, vb] = await Promise.all([tot(a.page, verbonden, timeoutMs), tot(b.page, verbonden, timeoutMs)]);
    uit.verbonden = va && vb;
    if (!uit.verbonden) { uit.reden = 'ICE_NIET_VERBONDEN'; uit.ice = await a.page.evaluate(() => window.__rtc.pc.iceConnectionState); return uit; }
    const heen = await stuurEnMeet(a, b, bytes), terug = await stuurEnMeet(b, a, bytes);
    uit.bytesAB = heen.bytes; uit.bytesBA = terug.bytes;
    await wacht(2500);   // genoeg RTP voor een eerlijke telling
    uit.statA = await statistiek(a.page); uit.statB = await statistiek(b.page);
    const relayAanBeideKanten = [uit.statA, uit.statB].every(s => s.lokaal === 'relay' && s.extern === 'relay');
    const media = [uit.statA, uit.statB].every(s => s.rtp.audio > 0 && s.rtp.video > 0);
    uit.ok = heen.ok && terug.ok && relayAanBeideKanten && media && uit.nietRelayKandidaten === 0;
    if (!uit.ok) uit.reden = !heen.ok || !terug.ok ? 'DATA_ONVOLLEDIG' : !relayAanBeideKanten ? 'GEEN_RELAY_PAAR'
      : !media ? 'GEEN_MEDIA' : 'NIET_RELAY_KANDIDAAT';
    return uit;
  } catch (e) {
    uit.reden = 'PROEF_FOUT'; uit.fout = String(e && e.message || e).slice(0, 200);
    return uit;
  } finally {
    for (const k of [a, b]) if (k) await k.context.close().catch(() => {});
    p.sluit();
  }
}

module.exports = { relayGesprek };
