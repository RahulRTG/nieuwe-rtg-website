/* ECHT VIDEOBELLEN EN ECHT CLIPS KIJKEN -- twee leden, één headless Chromium.

   De positieve videobelketen is dezelfde taak als de VOLTOOIPROEF: het
   scenario in scripts/lib/voltooi/videobellen.js loopt via Rahul en de Edge,
   meet voortlopende gedecodeerde beelden in beide richtingen, houdt dezelfde
   peer tijdens signalingherstart en -crash, ruimt bij ophangen peers en tracks
   op en bewijst via een SSE-barriere dat een herladen scherm geen oude oproep
   herleeft. Het gesprek is vluchtig: dit claimt geen opnamepersistentie.

   De afzonderlijke kruisproef blijft bewaken dat een vreemde en een anonieme
   actor niet kunnen bellen. De Clipstoets blijft de rechtstreekse P2P-weergave
   meten. Alle drie gebruiken dezelfde toestel- en mediahelper; alleen het
   voltooiscenario schrijft waargenomen browsertoestanden als productbewijs. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakWereld } = require('../scripts/lib/voltooiwereld');
const { metScherm } = require('../scripts/lib/voltooischerm');
const scenario = require('../scripts/lib/voltooi/videobellen');
const bel = require('../scripts/lib/voltooibellen');
const { laadScherm, geenBrowser, wachtTot } = require('./helper');

const pw = laadScherm();

async function wereld(naam, fn) {
  const w = await maakWereld(naam, undefined, { behoudAdres: true });
  const base = w.basis;
  try {
    await metScherm(w, scenario, async (scherm) => {
      await fn({ ...scherm, base, post: bel.maakPost(base), w });
    }, { args: bel.nepMediaArgs(), context: bel.contextOpties });
  } finally {
    w.klaar();
  }
}

test('videobellen: dezelfde browsertaak bewijst beeld, signalingherstel, beeindiging en geen herleving',
  { skip: geenBrowser(pw), timeout: 300000 }, async () => {
  const w = await maakWereld('echtbellen-voltooi', undefined, { behoudAdres: true });
  const gezien = { voltooibaar: [], persistent: [], herstelbaar: [], menselijk: [] };
  try {
    await scenario.loop(w, async (bewijs, wat, fn) => {
      assert.ok(gezien[bewijs], 'onbekende bewijsdimensie: ' + bewijs);
      const uit = await fn();
      assert.equal(uit && uit.klopt, true, wat);
      gezien[bewijs].push({ wat, ziet: uit.ziet });
    });
    for (const [bewijs, schakels] of Object.entries(gezien)) {
      assert.ok(schakels.length >= 3, bewijs + ' heeft minder dan drie betekenisvolle schakels');
    }
    assert.equal(w.browser.ingang, scenario.ingang);
    assert.ok(w.browser.bezocht.includes(scenario.ingang));
    assert.ok(w.browser.toestanden.some((t) => t.pad === scenario.ingang &&
      t.selector === '#osBelScrim.open' && t.zichtbaar === true));
    assert.deepEqual(w.browser.fouten, []);
    assert.deepEqual(w.browser.documentfouten, []);
  } finally {
    w.klaar();
  }
});

test('videobellen: wie niet verbonden is, belt niet, en bij de ander gaat niets over',
  { skip: geenBrowser(pw), timeout: 120000 }, async () => {
  await wereld('echtbellen-onbevoegd', async ({ ctx, p, observeer, base, post, verslag }) => {
    const A = await bel.lid(post, 'vna');
    const C = await bel.lid(post, 'vnc');
    const B = await bel.lid(post, 'vnb');
    await bel.verbind(post, A, B);
    const a = await bel.bereidToestel({ ctx, p, observeer }, base, A.token, '/apps/app.html');
    await a.p.waitForFunction(() => window.RTGSocial && window.RTGSocial.ok(), null, { timeout: 30000 });
    await a.p.waitForFunction(() => window.RTGRealtime?.source?.readyState === 1, null, { timeout: 20000 });
    await a.p.evaluate(() => {
      window.__belSignalen = [];
      window.RTGRealtime.source.addEventListener('call', (e) => window.__belSignalen.push(JSON.parse(e.data)));
    });
    const r = await post('/api/member/call', { toKey: A.key, kind: 'ring', video: true }, C.token);
    assert.equal(r.status, 403, 'een vreemde mag niet bellen');
    assert.match((r.data && r.data.error) || '', /verbonden/, 'de weigering zegt in woorden waarom');
    const anoniem = await post('/api/member/call', { toKey: A.key, kind: 'ring', video: true });
    assert.equal(anoniem.status, 401);

    const merk = 'na-geweigerde-oproepen';
    const grens = await post('/api/member/call', { toKey: A.key, kind: 'ice', payload: { proef: merk } }, B.token);
    assert.equal(grens.status, 200, 'het controlesignaal van een vriend wordt toegelaten');
    await wachtTot(a.p, (m) => window.__belSignalen.some((s) => s.kind === 'ice' && s.payload?.proef === m),
      merk, { ms: 10000, wat: 'het controlesignaal na de geweigerde oproepen is ontvangen' });
    assert.deepEqual(await a.p.evaluate(() => window.__belSignalen.filter((s) => s.kind === 'ring')), [],
      'een geweigerde oproep mag geen belsignaal uitsturen');
    assert.equal(await a.p.locator('.rtg-edge-live__accept').count(), 0, 'bij A ging toch iets over');
    assert.equal(await a.p.locator('#callIncoming').evaluate((e) => e.classList.contains('open')), false);
    assert.deepEqual(verslag.fouten, []);
  });
});

/* CLIPS: het beeld reist van toestel naar toestel. De maker neemt een clip op
   met de nepcamera, deelt de kaart en houdt zijn scherm open; de kijker krijgt
   het beeld rechtstreeks over het datakanaal. Bij RTG staan titel en duur. */
test('clips: een kijker ziet de clip van de maker, rechtstreeks van diens toestel',
  { skip: geenBrowser(pw), timeout: 180000 }, async () => {
  await wereld('echte-clips', async ({ ctx, p, observeer, nieuwToestel, base, post, verslag }) => {
    const M = await bel.lid(post, 'clm');
    const V = await bel.lid(post, 'clv');
    const m = await bel.bereidToestel({ ctx, p, observeer }, base, M.token, '/apps/clips.html');
    await m.p.waitForSelector('#studioOpen', { timeout: 20000 });
    await m.p.evaluate(() => document.querySelector('#studioOpen').click());
    await m.p.waitForFunction(() => /Klaar om op te nemen/.test((document.querySelector('#studioStatus') || {}).textContent || ''),
      null, { timeout: 15000 });
    await m.p.click('#opneem');
    const opnameKlok = await m.p.locator('#studioDoek').evaluate((v) => v.currentTime);
    await wachtTot(m.p, (van) => {
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
    await m.p.waitForFunction(() => /staat in uw archief/.test((document.querySelector('#melding') || {}).textContent || ''),
      null, { timeout: 15000 });

    const kaart = (await post('/api/clips/feed', {}, V.token)).data || {};
    assert.ok(JSON.stringify(kaart).includes('Mist over de gracht'), 'de kaart staat niet in de feed van de kijker');

    const v = await bel.nieuwMediaToestel(nieuwToestel, base, V.token, '/apps/clips.html');
    const sec = v.p.locator('section.clip', { hasText: 'Mist over de gracht' });
    await sec.waitFor({ timeout: 20000 });
    await sec.getByRole('button', { name: '▶ Speel' }).click();
    await v.p.waitForFunction((titel) => {
      const s = [...document.querySelectorAll('section.clip')]
        .find((x) => (x.getAttribute('aria-label') || '').startsWith(titel));
      const vid = s && s.querySelector('video');
      return vid && vid.videoWidth > 0 && /rechtstreeks ontvangen/.test((s.querySelector('.status') || {}).textContent || '');
    }, 'Mist over de gracht', { timeout: 30000 });
    const breed = await sec.evaluate((s) => s.querySelector('video').videoWidth);
    assert.ok(breed > 0, 'de kijker ziet geen beeld');
    assert.deepEqual(verslag.fouten, [], 'paginafouten bij delen of kijken');
  });
});
