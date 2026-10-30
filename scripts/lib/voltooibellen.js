/* Gedeelde browserhandelingen voor de echte videobel- en Clipstoets. De
   observatie van zichtbare schermtoestanden blijft in voltooischerm.js; hier
   wonen alleen de accounts, toestellen en WebRTC-metingen die beide proeven
   werkelijk uitvoeren. */
'use strict';
const assert = require('node:assert/strict');
const { nepMediaArgs, installeerNepMicrofoon, wachtOpWaarde, wachtTot } = require('../../test/helper');

const contextOpties = { permissions: ['microphone', 'camera'] };

function maakPost(base) {
  return async (pad, lijf, tok) => {
    const r = await fetch(base + pad, { method: 'POST',
      headers: Object.assign({ 'content-type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
      body: JSON.stringify(lijf || {}) });
    return { status: r.status, data: await r.json().catch(() => null) };
  };
}

async function lid(post, merk) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const r = await post('/api/auth/register', { name: 'Beller ' + merk, email: merk + u + '@voorbeeld.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
  if (!r.data || !r.data.token) throw new Error('registratie lukte niet (' + r.status + ')');
  const c = (await post('/api/member/connections', {}, r.data.token)).data;
  return { token: r.data.token, key: c.me, codenaam: c.codename };
}

async function verbind(post, A, B) {
  const f = await post('/api/member/find', { q: B.codenaam }, A.token);
  const doel = ((f.data && f.data.results) || []).find((x) => x.codename === B.codenaam);
  assert.ok(doel, 'het tweede lid is niet vindbaar');
  await post('/api/member/connect', { key: doel.key }, A.token);
  const r = await post('/api/member/connect/respond', { key: A.key, action: 'accept' }, B.token);
  assert.equal(r.data && r.data.status, 'verbonden');
}

async function bereidToestel(toestel, base, token, adres) {
  await installeerNepMicrofoon(toestel.ctx);
  await toestel.ctx.route('**/api/onboarding/status', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ klaar: true }) }));
  await toestel.ctx.addInitScript((t) => {
    try {
      localStorage.setItem('rtg_member_token', t);
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    } catch (e) {}
  }, token);
  await toestel.p.goto(base + adres, { waitUntil: 'domcontentloaded' });
  return toestel;
}

async function nieuwMediaToestel(nieuwToestel, base, token, adres) {
  return bereidToestel(await nieuwToestel(contextOpties), base, token, adres);
}

async function wachtWerktafel(toestel, metLive) {
  await toestel.p.waitForFunction(() => window.RTGSocial && window.RTGSocial.ok() && window.RTGSocial.lijst().length > 0,
    null, { timeout: 30000 });
  if (metLive) await toestel.p.waitForFunction(() => window.RTGRealtime?.source?.readyState === 1,
    null, { timeout: 20000 });
}

async function openViaRahul(toestel) {
  await toestel.p.click('.rtg-adaptive-item[aria-label="Praat met Rahul"]');
  const vraag = toestel.p.locator('input[placeholder^="Vraag Rahul"]:visible').first();
  await vraag.fill('open videobellen');
  await vraag.press('Enter');
  await toestel.observeer('#osBelScrim.open');
  assert.match(await toestel.p.textContent('#osBelTitel'), /Videobellen/);
}

async function kiesContact(beller, ontvanger, contact) {
  await beller.p.click('#osBelLijst button:has-text("' + contact.codenaam + '")');
  await ontvanger.observeer('#callIncoming.open');
  const soort = await ontvanger.p.textContent('#ciSoort');
  assert.match(soort, /Video/i, 'de ontvanger hoort dat het een videogesprek is, niet: ' + soort);
}

async function neemOp(toestel) {
  await toestel.observeer('.rtg-edge-live__accept');
  await toestel.p.click('.rtg-edge-live__accept');
}

const ontvangst = (p) => p.evaluate(async () => {
  const c = window.__rtgCall && window.__rtgCall();
  const v = document.querySelector('#csRemote');
  let frames = 0, breed = 0, audio = null;
  if (c && c.pc) (await c.pc.getStats()).forEach((r) => {
    if (r.type === 'inbound-rtp' && r.kind === 'video') {
      frames = r.framesDecoded || 0;
      breed = r.frameWidth || 0;
    }
    if (r.type === 'inbound-rtp' && r.kind === 'audio') {
      // Uitsluitend echte ontvangststatistiek; ontbrekende velden blijven ongeldig.
      // Concealment kan de sampleteller verhogen zonder nieuw ontvangen geluid.
      audio = { id: r.id, pakketten: r.packetsReceived,
        samples: r.totalSamplesReceived - r.concealedSamples,
        duur: r.totalSamplesDuration, energie: r.totalAudioEnergy };
    }
  });
  return { stand: c && c.pc ? c.pc.connectionState : (c ? 'zonder-pc' : 'geen'), frames, breed,
    videoBreed: v ? v.videoWidth : 0, klok: v ? v.currentTime : 0, audio };
});

function audioLoopt(nu, oud) {
  return !!nu && typeof nu.id === 'string' && nu.id.length > 0 && (!oud || nu.id === oud.id) &&
    ['pakketten', 'samples', 'duur', 'energie'].every((veld) =>
      Number.isFinite(nu[veld]) && nu[veld] > (oud ? oud[veld] : 0));
}

const verbonden = (toestel) => toestel.p.waitForFunction(() => {
  const c = window.__rtgCall && window.__rtgCall();
  return c && c.pc && c.pc.connectionState === 'connected';
}, null, { timeout: 30000 });

async function beeld(toestel, wie, vorig) {
  return wachtOpWaarde(async () => {
    const nu = await ontvangst(toestel.p);
    return nu.stand === 'connected' && nu.frames > (vorig ? vorig.frames : 0) && nu.breed > 0 &&
      nu.videoBreed > 0 && nu.klok > (vorig ? vorig.klok : 0) &&
      audioLoopt(nu.audio, vorig && vorig.audio) ? nu : false;
  }, { ms: 30000, wat: wie + (vorig ? ': nieuwe frames en voortlopende gedecodeerde audio' : ': gedecodeerd beeld en ontvangen audio met energie') });
}

async function beelden(a, b, vorig) {
  const eerste = await Promise.all([
    beeld(a, 'A ziet B', vorig && vorig[0]),
    beeld(b, 'B ziet A', vorig && vorig[1])
  ]);
  for (const [wie, nu, oud] of [['A ziet B', eerste[0], vorig && vorig[0]], ['B ziet A', eerste[1], vorig && vorig[1]]]) {
    assert.ok(nu.frames > (oud ? oud.frames : 0) && nu.breed > 0, wie + ': geen nieuw gedecodeerd beeld ' + JSON.stringify(nu));
    assert.ok(nu.videoBreed > 0 && nu.klok > (oud ? oud.klok : 0), wie + ': de video op het scherm speelt niet ' + JSON.stringify(nu));
    assert.ok(audioLoopt(nu.audio, oud && oud.audio), wie + ': geen voortlopende ontvangen audio ' + JSON.stringify(nu.audio));
  }
  return eerste;
}

async function bewaarPeer(toestellen) {
  for (const toestel of toestellen) await toestel.p.evaluate(() => {
    window.__testPcVoorHerstel = window.__rtgCall().pc;
  });
}

async function controleerDezelfdePeer(toestellen) {
  for (const toestel of toestellen) {
    await toestel.p.waitForFunction(() => window.RTGRealtime?.source?.readyState === 1, null, { timeout: 30000 });
    assert.equal(await toestel.p.evaluate(() => window.__rtgCall()?.pc === window.__testPcVoorHerstel), true,
      'signalingherstel start geen tweede gesprek');
  }
}

async function bewaarGespreksmiddelen(toestellen) {
  for (const toestel of toestellen) await toestel.p.evaluate(() => {
    const c = window.__rtgCall();
    window.__testGespreksmiddelen = { pc: c.pc, tracks: c.stream.getTracks() };
  });
}

async function hangOp(a, b) {
  await a.observeer('.rtg-edge-live__danger');
  await a.p.click('.rtg-edge-live__danger', { timeout: 10000 });
  await a.p.waitForFunction(() => !(window.__rtgCall && window.__rtgCall()), null, { timeout: 10000 });
  await b.p.waitForFunction(() => !(window.__rtgCall && window.__rtgCall()), null, { timeout: 15000 });
  for (const toestel of [a, b]) assert.equal(await toestel.p.evaluate(() => {
    const r = window.__testGespreksmiddelen;
    return r.pc.connectionState === 'closed' && r.tracks.length > 0 && r.tracks.every((t) => t.readyState === 'ended');
  }), true, 'ophangen sluit verbinding en mediatracks');
}

async function herlaadZonderOudeOproep(toestel, post, naar, van, merk) {
  await toestel.p.reload({ waitUntil: 'domcontentloaded' });
  await toestel.p.waitForFunction(() => window.RTGSocial?.ok(), null, { timeout: 30000 });
  await toestel.p.waitForFunction(() => window.RTGRealtime?.source?.readyState === 1, null, { timeout: 30000 });
  await toestel.p.evaluate(() => {
    window.__naHerlaad = [];
    window.RTGRealtime.source.addEventListener('call', (e) => window.__naHerlaad.push(JSON.parse(e.data)));
  });
  const r = await post('/api/member/call', { toKey: naar.key, kind: 'ice', payload: { proef: merk } }, van.token);
  assert.equal(r.status, 200);
  await wachtTot(toestel.p, (m) => window.__naHerlaad.some((s) => s.payload?.proef === m), merk,
    { ms: 10000, wat: 'live-barriere na herladen' });
  assert.equal(await toestel.p.evaluate(() => !!window.__rtgCall?.()), false, 'beeindigd gesprek wordt niet opnieuw actief');
  assert.equal(await toestel.p.locator('#callIncoming').evaluate((e) => e.classList.contains('open')), false,
    'geen oude inkomende oproep');
}

module.exports = { contextOpties, nepMediaArgs, maakPost, lid, verbind, bereidToestel, nieuwMediaToestel,
  wachtWerktafel, openViaRahul, kiesContact, neemOp, verbonden, beeld, beelden, bewaarPeer,
  controleerDezelfdePeer, bewaarGespreksmiddelen, hangOp, herlaadZonderOudeOproep };
