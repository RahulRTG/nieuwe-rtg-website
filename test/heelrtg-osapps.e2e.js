/* HEEL RTG VINDT ELKE APP, OOK DE OS-APPS (eigenaarsbesluit 19 oktober 2026).
   Videobellen, Bellen, Snaps en Werk hebben geen eigen adres: ze wonen in de
   functiegids (MAPPEN, workspace-world-catalog.js), dezelfde bron die Rahul
   leest bij "open videobellen". Het zoekmenu "Heel RTG" in de rand las alleen
   de URL-catalogus van de widgets, en een lid dat daar "video" typte, vond
   niets. Deze toets loopt het zoekmenu zoals een lid: rand open, Heel RTG,
   "video" typen, Videobellen kiezen, en de kiezer met zijn vriend staat open.

   Draait alleen waar Playwright met een passende browser staat. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { laadScherm, startServer, stop, browserOpties, geenBrowser, letOpFouten } = require('./helper');

const pw = laadScherm();
const maakPost = (base) => async (pad, lijf, tok) => {
  const r = await fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(lijf || {}) });
  return { status: r.status, data: await r.json().catch(() => null) };
};
async function lid(post, merk) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const r = await post('/api/auth/register', { name: 'Zoeker ' + merk, email: merk + u + '@voorbeeld.nl',
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

test('Heel RTG: "video" vindt Videobellen, en een tik opent de kiezer met de vriend (1200 en 390 px)',
  { skip: geenBrowser(pw), timeout: 240000 }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-heelrtg-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const post = maakPost(base);
    const A = await lid(post, 'hra'), B = await lid(post, 'hrb');
    await verbind(post, A, B);
    browser = await pw.chromium.launch(browserOpties(pw, {}));
    for (const viewport of [{ width: 1200, height: 900 }, { width: 390, height: 844 }]) {
      const ctx = await browser.newContext({ viewport });
      await ctx.route('**/api/onboarding/status', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"klaar":true}' }));
      await ctx.addInitScript((t) => {
        try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
      }, A.token);
      const p = await ctx.newPage();
      const fouten = []; letOpFouten(p, fouten);
      await p.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
      await p.waitForFunction(() => window.RTGSocial && window.RTGSocial.ok() && window.RTGSocial.lijst().length > 0, null, { timeout: 30000 });
      const breed = viewport.width + ' px';
      /* De rand: Alle functies opent het menu, Heel RTG is het tweede gezicht,
         en Zoeken zet het zoekveld van de hele catalogus open. */
      await p.click('.rtg-adaptive-item[aria-label="Alle functies"]');
      await p.click('[data-edge-face="all"]');
      await p.click('[data-edge-smart-search]');
      const zoek = p.locator('.rtg-edge-face-all .rtg-edge-find input');
      await zoek.fill('video');
      /* De poort blijft de poort: het tweede scherm is van de zaak (werkrol), en
         de gids toont het een lid niet. */
      await zoek.fill('tweede scherm');
      assert.equal(await p.locator('[data-edge-gids] a', { hasText: 'Tweede scherm' }).count(), 0, breed + ': de gids toont een ingang met een werkrol die het lid niet heeft');
      await zoek.fill('video');
      const treffer = p.locator('.rtg-edge-face-all :is(a,button):visible', { hasText: 'Videobellen' }).first();
      await treffer.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      assert.equal(await treffer.count(), 1, breed + ': Heel RTG vindt Videobellen niet bij "video"');
      await treffer.click();
      await p.waitForSelector('#osBelScrim.open', { timeout: 10000 });
      assert.match(await p.textContent('#osBelTitel'), /Videobellen/, breed);
      assert.equal(await p.locator('#osBelLijst button', { hasText: B.codenaam }).count(), 1, breed + ': de vriend staat niet in de kiezer');
      assert.deepEqual(fouten, [], breed + ': paginafouten');
      await ctx.close();
    }
  } finally {
    if (browser) await browser.close();
    await stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
