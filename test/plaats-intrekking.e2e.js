/* Echte Arrival/plaats-API, afzonderlijke lokale data. Alleen GPS is een
   bestuurbare toestelgrens; vertraagde antwoorden komen ongewijzigd van de
   server. Intrekking moet ook reeds lopend werk blijvend annuleren. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten, wachtOpNetstilte } = require('./helper');
const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser, tmp, token, punt;
async function api(pad, body) {
  const r = await fetch(srv.base + pad, { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {})
  }, body: JSON.stringify(body) });
  const j = await r.json(); assert.equal(r.status, 200, pad + ': ' + JSON.stringify(j)); return j;
}
test.before(async () => {
  if (skip) return;
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-arrival-intrekking-'));
  srv = await startServer({ env: { RTG_DATA_DIR: tmp, SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1',
    LOCAL_AI_URL: '', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' } });
  token = (await api('/api/auth/register', { name: 'Intrekking', email: 'intrekking@voorbeeld.test',
    password: 'intrekking123', geboortedatum: '1990-04-04', tier: 'rtg', pasApp: 'rtg' })).token;
  assert.ok(token);
  const h = (await api('/api/plaats/hekken', { doel: 'nadering' })).hekken.find(h => h.id === 'leverancier:KIKUNOI');
  assert.ok(h); punt = h.punten[0];
  browser = await pw.chromium.launch(browserOpties(pw));
});
test.after(async () => {
  if (browser) await browser.close(); if (srv) await stop(srv.child);
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

for (const [i, variant] of ['stop-delen', 'gps-uit', 'gps-uit-aan', 'hekken-uit-aan'].entries()) {
  test('Arrival: ' + variant + ' annuleert een echt vertraagd antwoord', { skip, timeout: 60000 }, async () => {
    const p = (await api('/api/arrival/request', {
      requestToken: ('intrekking-' + i).padEnd(32, 'x') + '.' + ('browser-' + i).padEnd(32, 'y'),
      supplierCode: 'KIKUNOI', datum: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      tijd: '20:00', personen: 2, zone: 'zaal'
    })).pass;
    assert.ok(p?.accessToken);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', locale: 'nl-NL' });
    let release, opgehouden, mislukt, grens;
    const vrij = new Promise(r => { release = r; }), vast = new Promise((r, j) => { opgehouden = r; mislukt = j; });
    vast.catch(() => {}); // Ook een fout vóór het latere await wordt opgevangen.
    try {
      await ctx.addInitScript(({ token, p, punt }) => {
        localStorage.clear(); localStorage.setItem('rtg_member_token', token);
        localStorage.setItem('rtg_arrival_pass', JSON.stringify({ p: p.accessToken, tot: p.vervaltAt }));
        localStorage.setItem('rtg_os_gps', '1'); localStorage.setItem('rtg_cookieinfo_v1', '1');
        const fix = { coords: { latitude: punt.lat, longitude: punt.lng, accuracy: 10 } };
        const g = window.__gps = { gestart: 0, gestopt: [], emit: null };
        Object.defineProperty(navigator, 'geolocation', { value: {
          getCurrentPosition(ok) { ok(fix); },
          watchPosition(ok) { g.gestart++; g.emit = () => ok(fix); return 0; },
          clearWatch(id) { g.gestopt.push(id); }
        } });
        window.__vastAntwoordVerwerkt = 0;
        const fetch = window.fetch.bind(window);
        window.fetch = async (...args) => {
          const r = await fetch(...args);
          if (r.headers.get('x-rtg-test-vast') === 'ja') {
            const json = r.json.bind(r);
            r.json = async () => {
              const j = await json();
              // Alleen dit concrete JSON-antwoord. De volgende task volgt
              // na de consumercontinuations in dezelfde microtaskqueue.
              setTimeout(() => { window.__vastAntwoordVerwerkt++; }, 0);
              return j;
            };
          }
          return r;
        };
      }, { token, p, punt });
      const page = await ctx.newPage(), fouten = letOpFouten(page, []), pulsen = [];
      page.on('request', r => { if (new URL(r.url()).pathname === '/api/arrival/pulse') pulsen.push(r.postDataJSON().pulse); });
      const pad = variant === 'hekken-uit-aan' ? '/api/plaats/hekken' : '/api/arrival/pass';
      let vasthouden = false;
      await page.route('**' + pad, async route => {
        if (!vasthouden) return route.continue();
        vasthouden = false;
        try {
          assert.deepEqual(route.request().postDataJSON(), variant === 'hekken-uit-aan' ? { doel: 'nadering' } : { pass: p.accessToken });
          const antwoord = await route.fetch(); assert.equal(antwoord.status(), 200);
          if (variant !== 'hekken-uit-aan') assert.equal((await antwoord.json()).pass.pulse, 'nog-niet-onderweg');
          opgehouden(); await vrij;
          // Alleen een testmarkering in headers; de bedrijfsrespons blijft intact.
          await route.fulfill({ response: antwoord, headers: { ...antwoord.headers(), 'x-rtg-test-vast': 'ja' } });
        } catch (e) { mislukt(e); await route.abort().catch(() => {}); }
      });
      await page.goto(srv.base + '/apps/arrival.html', { waitUntil: 'domcontentloaded' });
      await page.locator('.rtgnader .ja').waitFor(); await page.locator('[data-pulse="stop"]').waitFor();
      if (variant === 'hekken-uit-aan') vasthouden = true;
      await page.locator('.rtgnader .ja').click();
      if (variant !== 'hekken-uit-aan') {
        await page.waitForFunction(() => window.__gps.gestart === 1);
        vasthouden = true;
        await page.evaluate(() => window.__gps.emit());
      }
      // Het vaste antwoord is al door de echte server geproduceerd.
      await Promise.race([vast, new Promise((_, reject) => {
        grens = setTimeout(() => reject(new Error('verwacht echt antwoord niet vastgehouden')), 15000);
      })]);
      clearTimeout(grens);
      if (variant === 'stop-delen') {
        const verwerkt = page.waitForResponse(r => new URL(r.url()).pathname === '/api/arrival/pulse');
        await page.locator('[data-pulse="stop"]').click();
        assert.equal((await verwerkt).status(), 200);
      } else {
        await page.evaluate(() => window.RTGPlek.zetAan(false));
        if (variant.endsWith('-aan')) assert.equal(await page.evaluate(() => window.RTGPlek.zetAan(true)), true);
      }
      if (variant !== 'hekken-uit-aan') {
        assert.deepEqual(await page.evaluate(() => window.__gps.gestopt), [0]);
        // Zelfs een callback die een toestel na clearWatch nog levert is oud.
        await page.evaluate(() => window.__gps.emit());
      }
      release(); await page.waitForFunction(() => window.__vastAntwoordVerwerkt === 1);
      await wachtOpNetstilte(page);
      assert.equal(await page.evaluate(() => window.RTGPlaats.stand().doel), null);
      assert.deepEqual(pulsen, variant === 'stop-delen' ? ['stop'] : [], 'geen automatische puls na intrekking');
      if (variant === 'hekken-uit-aan') assert.equal(await page.evaluate(() => window.__gps.gestart), 0);
      const na = (await api('/api/arrival/pass', { pass: p.accessToken })).pass;
      assert.equal(na.pulse, variant === 'stop-delen' ? 'delen-gestopt' : 'nog-niet-onderweg');
      assert.deepEqual(fouten, []);
    } finally { clearTimeout(grens); release(); await ctx.close(); }
  });
}
