/* ECHT VIDEOBELLEN EN ECHT CLIPS KIJKEN -- twee leden, één headless Chromium.

   WAAROM DIT BESTAAT. os:videobellen en de P2P-weergave van Clips stonden als
   blokkade: "vraagt test-identiteiten voor WebRTC in een headless browser"
   (scripts/lib/appcontract.js, TESTWERELD_ONTBREEKT). Die bestaan wel: één
   Chromium met --use-fake-device-for-media-stream (een synthetisch testbeeld)
   en --use-fake-ui-for-media-stream (geen toestemmingsvenster), twee contexten
   als twee toestellen, en de verbinding loopt over loopback met de STUN die
   /api/ice in de testomgeving uitgeeft (stun:127.0.0.1). Er gaat niets naar
   buiten. Wat de ander ziet, wordt hier GEMETEN en niet aangenomen:
   framesDecoded in de inbound-rtp-statistiek van de echte RTCPeerConnection,
   en een <video> met een breedte en een lopende klok.

   WAT DEZE PROEF DRAAGT (en wat niet):
   - voltooibaar: A belt B, B neemt op via de knop "Opnemen" van de rand, ze
     zien elkaar in BEIDE richtingen, en ophangen beëindigt het gesprek aan
     beide kanten. Bij Clips ziet een kijker het beeld van de maker, rechtstreeks
     van diens toestel.
   - bevoegd: een lid met wie A niet verbonden is, kan A niet bellen (403), en
     bij A gaat dan niets over.
   - menselijk: de weigering draagt een melding in woorden.
   Niet: persistent en herstelbaar (een gesprek wordt nergens bewaard; een
   crash van de server midden in een gesprek is een andere proef), TURN over
   een streng netwerk, en echte camera's.

   DE OPROEP LOOPT DE ECHTE ROUTE, met zichtbare klikken en typen. Videobellen
   heeft geen tegel: de werktafel is het beginscherm (WERELD.md) en een wereld
   opent zonder tussenscherm met tegels (PLATFORM.md par. 0). Een lid vraagt het
   aan Rahul: "Praat met Rahul" in de rand, "open videobellen" in het veld dat
   verschijnt; de functiegids opent de kiezer met Salon-contacten
   (apps/app-main/app-main-26.js), en een tik op B belt.

   Draait alleen waar Playwright met een passende browser staat. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { laadScherm, startServer, stop, browserOpties, geenBrowser, nepMediaArgs, installeerNepMicrofoon, letOpFouten, wachtOpWaarde, wachtTot } = require('./helper');

const pw = laadScherm();

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
  await post('/api/member/connect', { key: doel.key }, A.token);
  const r = await post('/api/member/connect/respond', { key: A.key, action: 'accept' }, B.token);
  assert.equal(r.data && r.data.status, 'verbonden');
}

/* Een toestel: eigen context, nepcamera en -microfoon, de intake buiten beeld
   (dezelfde afspraak als apps-ui en appmenu: die meten de werktafel, niet de
   intake), en het token van dit lid. */
async function toestel(browser, base, tok, adres) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, permissions: ['microphone', 'camera'] });
  await installeerNepMicrofoon(ctx);
  await ctx.route('**/api/onboarding/status', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ klaar: true }) }));
  await ctx.addInitScript((t) => {
    try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
  }, tok);
  const p = await ctx.newPage();
  const fouten = [];
  letOpFouten(p, fouten);
  await p.goto(base + adres, { waitUntil: 'domcontentloaded' });
  return { p, fouten };
}

/* Wat dit toestel van de ander ontvangt: de stand van de verbinding en de
   gedecodeerde beelden van de binnenkomende videotrack. */
const ontvangst = (p) => p.evaluate(async () => {
  const c = window.__rtgCall && window.__rtgCall();
  const v = document.querySelector('#csRemote');
  let frames = 0, breed = 0;
  if (c && c.pc) (await c.pc.getStats()).forEach((r) => { if (r.type === 'inbound-rtp' && r.kind === 'video') { frames = r.framesDecoded || 0; breed = r.frameWidth || 0; } });
  return { stand: c && c.pc ? c.pc.connectionState : (c ? 'zonder-pc' : 'geen'), frames, breed, videoBreed: v ? v.videoWidth : 0, klok: v ? v.currentTime : 0 };
});

async function wereld(fn) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-echtbellen-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw, { args: nepMediaArgs() }));
    await fn({ base, post: maakPost(base), browser });
  } finally {
    if (browser) await browser.close();
    await stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
}

test('videobellen: twee vrienden zien elkaar echt, in beide richtingen, en ophangen sluit het aan beide kanten',
  { skip: geenBrowser(pw), timeout: 180000 }, async () => {
  await wereld(async ({ base, post, browser }) => {
    const A = await lid(post, 'vba'), B = await lid(post, 'vbb');
    await verbind(post, A, B);
    const ijs = (await post('/api/ice', {}, A.token)).data;
    assert.ok(ijs && Array.isArray(ijs.iceServers), 'de testomgeving geeft ICE-servers uit');

    const a = await toestel(browser, base, A.token, '/apps/app.html');
    const b = await toestel(browser, base, B.token, '/apps/app.html');
    const klaar = () => window.RTGSocial && window.RTGSocial.ok() && window.RTGSocial.lijst().length > 0;
    await a.p.waitForFunction(klaar, null, { timeout: 30000 });
    await b.p.waitForFunction(klaar, null, { timeout: 30000 });
    /* De oproep komt over de livestroom van B: wacht tot die echt openstaat. Een
       lid dat (nog) niet verbonden is, hoort een oproep niet -- dat is hoe een
       oproep naar een gesloten app werkt, en niet wat hier gemeten wordt. */
    await b.p.waitForFunction(() => window.RTGRealtime && window.RTGRealtime.source && window.RTGRealtime.source.readyState === 1, null, { timeout: 20000 });

    await a.p.click('.rtg-adaptive-item[aria-label="Praat met Rahul"]');
    const vraag = a.p.locator('input[placeholder^="Vraag Rahul"]:visible').first();
    await vraag.fill('open videobellen');
    await vraag.press('Enter');
    await a.p.waitForSelector('#osBelScrim.open', { timeout: 10000 });
    assert.match(await a.p.textContent('#osBelTitel'), /Videobellen/);
    await a.p.click('#osBelLijst button:has-text("' + B.codenaam + '")');
    await b.p.waitForSelector('#callIncoming.open', { state: 'attached', timeout: 20000 });
    await b.p.waitForSelector('.rtg-edge-live__accept', { state: 'visible', timeout: 10000 });
    const soort = await b.p.textContent('#ciSoort');
    assert.match(soort, /Video/i, 'B hoort dat het een videogesprek is, niet: ' + soort);
    await b.p.click('.rtg-edge-live__accept');

    const verbonden = (p) => p.waitForFunction(() => { const c = window.__rtgCall && window.__rtgCall(); return c && c.pc && c.pc.connectionState === 'connected'; }, null, { timeout: 30000 });
    await verbonden(a.p); await verbonden(b.p);
    const beeld = (p, wie, vorig) => wachtOpWaarde(async () => {
      const nu = await ontvangst(p);
      return nu.stand === 'connected' && nu.frames > (vorig ? vorig.frames : 0) && nu.breed > 0 &&
        nu.videoBreed > 0 && nu.klok > (vorig ? vorig.klok : 0) ? nu : false;
    }, { ms: 30000, wat: wie + (vorig ? ': nieuwe frames en een voortlopende videoklok' : ': gedecodeerd beeld op het scherm') });
    const [a1, b1] = await Promise.all([beeld(a.p, 'A ziet B'), beeld(b.p, 'B ziet A')]);
    const [a2, b2] = await Promise.all([beeld(a.p, 'A ziet B', a1), beeld(b.p, 'B ziet A', b1)]);
    for (const [wie, een, twee] of [['A ziet B', a1, a2], ['B ziet A', b1, b2]]) {
      assert.ok(een.frames > 0 && een.breed > 0, wie + ': geen gedecodeerd beeld ' + JSON.stringify(een));
      assert.ok(twee.frames > een.frames, wie + ': het beeld staat stil ' + een.frames + ' -> ' + twee.frames);
      assert.ok(twee.videoBreed > 0 && twee.klok > een.klok, wie + ': de video op het scherm speelt niet ' + JSON.stringify(twee));
    }

    /* Ophangen met de knop van de rand bij A; B's gesprek eindigt vanzelf. */
    await a.p.click('.rtg-edge-live__danger', { timeout: 10000 });
    await a.p.waitForFunction(() => !(window.__rtgCall && window.__rtgCall()), null, { timeout: 10000 });
    await b.p.waitForFunction(() => !(window.__rtgCall && window.__rtgCall()), null, { timeout: 15000 });
    assert.deepEqual(a.fouten.concat(b.fouten), [], 'paginafouten tijdens het gesprek');
  });
});

test('videobellen: wie niet verbonden is, belt niet, en bij de ander gaat niets over',
  { skip: geenBrowser(pw), timeout: 120000 }, async () => {
  await wereld(async ({ base, post, browser }) => {
    const A = await lid(post, 'vna'), C = await lid(post, 'vnc'), B = await lid(post, 'vnb');
    await verbind(post, A, B);
    const a = await toestel(browser, base, A.token, '/apps/app.html');
    await a.p.waitForFunction(() => window.RTGSocial && window.RTGSocial.ok(), null, { timeout: 30000 });
    await a.p.waitForFunction(() => window.RTGRealtime && window.RTGRealtime.source && window.RTGRealtime.source.readyState === 1, null, { timeout: 20000 });
    await a.p.evaluate(() => {
      window.__belSignalen = [];
      window.RTGRealtime.source.addEventListener('call', e => window.__belSignalen.push(JSON.parse(e.data)));
    });
    const r = await post('/api/member/call', { toKey: A.key, kind: 'ring', video: true }, C.token);
    assert.equal(r.status, 403, 'een vreemde mag niet bellen');
    assert.match((r.data && r.data.error) || '', /verbonden/, 'de weigering zegt in woorden waarom');
    const anoniem = await post('/api/member/call', { toKey: A.key, kind: 'ring', video: true });
    assert.equal(anoniem.status, 401);
    /* Een toegestaan ICE-signaal van vriend B volgt de geweigerde verzoeken
       over dezelfde livestroom. Ontvangst daarvan bewijst dat de eerdere
       signalen verwerkt konden worden; C blijft een vreemde. Zonder gesprek
       negeert het scherm ICE, dus dit kan geen oproep afsluiten of verbergen. */
    const merk = 'na-geweigerde-oproepen';
    const grens = await post('/api/member/call', { toKey: A.key, kind: 'ice', payload: { proef: merk } }, B.token);
    assert.equal(grens.status, 200, 'het controlesignaal van een vriend wordt toegelaten');
    await wachtTot(a.p, m => window.__belSignalen.some(s => s.kind === 'ice' && s.payload && s.payload.proef === m),
      merk, { ms: 10000, wat: 'het controlesignaal na de geweigerde oproepen is ontvangen' });
    assert.deepEqual(await a.p.evaluate(() => window.__belSignalen.filter(s => s.kind === 'ring')), [],
      'een geweigerde oproep mag geen belsignaal uitsturen');
    assert.equal(await a.p.locator('.rtg-edge-live__accept').count(), 0, 'bij A ging toch iets over');
    assert.equal(await a.p.evaluate(() => document.querySelector('#callIncoming').classList.contains('open')), false);
  });
});

/* CLIPS: het beeld reist van toestel naar toestel. De maker neemt een clip op
   met de nepcamera (een echte MediaRecorder, een echte webm), deelt de kaart en
   houdt zijn scherm open; een ander lid tikt op Speel en krijgt het beeld
   rechtstreeks over het datakanaal -- bij RTG staan alleen titel en duur. */
test('clips: een kijker ziet de clip van de maker, rechtstreeks van diens toestel',
  { skip: geenBrowser(pw), timeout: 180000 }, async () => {
  await wereld(async ({ base, post, browser }) => {
    const M = await lid(post, 'clm'), V = await lid(post, 'clv');
    const m = await toestel(browser, base, M.token, '/apps/clips.html');
    await m.p.waitForSelector('#studioOpen', { timeout: 20000 });
    await m.p.evaluate(() => document.querySelector('#studioOpen').click());
    await m.p.waitForFunction(() => /Klaar om op te nemen/.test((document.querySelector('#studioStatus') || {}).textContent || ''), null, { timeout: 15000 });
    await m.p.click('#opneem');
    const opnameKlok = await m.p.locator('#studioDoek').evaluate(v => v.currentTime);
    await wachtTot(m.p, van => {
      const v = document.querySelector('#studioDoek');
      return v && v.videoWidth > 0 && !v.paused && v.currentTime >= van + 1 &&
        /Opnemen/.test(document.querySelector('#studioStatus').textContent);
    }, opnameKlok, { ms: 15000, wat: 'de echte camera levert tijdens de opname een seconde bewegend beeld' });
    await m.p.click('#stopOpname');
    await wachtTot(m.p, () => !document.querySelector('#deelClip').disabled &&
      /Opname klaar/.test(document.querySelector('#studioStatus').textContent),
    null, { ms: 10000, wat: 'de echte MediaRecorder heeft de clip afgerond' });
    await m.p.fill('#clipTitel', 'Mist over de gracht');
    await m.p.click('#deelClip');
    await m.p.waitForFunction(() => /staat in uw archief/.test((document.querySelector('#melding') || {}).textContent || ''), null, { timeout: 15000 });

    /* Een ander lid ziet alleen de kaart; het beeld staat bij RTG nergens. */
    const kaart = (await post('/api/clips/feed', {}, V.token)).data || {};
    assert.ok(JSON.stringify(kaart).includes('Mist over de gracht'), 'de kaart staat niet in de feed van de kijker');

    const v = await toestel(browser, base, V.token, '/apps/clips.html');
    const sec = v.p.locator('section.clip', { hasText: 'Mist over de gracht' });
    await sec.waitFor({ timeout: 20000 });
    await sec.getByRole('button', { name: '▶ Speel' }).click();
    await v.p.waitForFunction((titel) => {
      const s = [...document.querySelectorAll('section.clip')].find((x) => (x.getAttribute('aria-label') || '').startsWith(titel));
      const vid = s && s.querySelector('video');
      return vid && vid.videoWidth > 0 && /rechtstreeks ontvangen/.test((s.querySelector('.status') || {}).textContent || '');
    }, 'Mist over de gracht', { timeout: 30000 });
    const breed = await sec.evaluate((s) => s.querySelector('video').videoWidth);
    assert.ok(breed > 0, 'de kijker ziet geen beeld');
    assert.deepEqual(m.fouten.concat(v.fouten), [], 'paginafouten bij delen of kijken');
  });
});
