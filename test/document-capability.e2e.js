'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser, edgeActies } = require('./helper');
const pw = laadPlaywright();
for (const [lang, width, height] of [['nl', 390, 844], ['en', 1440, 1000], ['ar', 390, 844]]) {
  test('document UI and standard Edge Bar use one contract: ' + lang, { skip: geenBrowser(pw) }, async () => {
    const srv = await startServer({ env: { RTG_STORE: 'sqlite', SMTP_URL: '' } });
    let browser, page;
    const trace = [], errors = [], responses = [];
    const out = process.env.RTG_DOCUMENT_EVIDENCE_DIR;
    try {
      const post = async (pad, body, token) => {
        const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token }, body: JSON.stringify(body || {}) });
        assert.equal(r.status, 200, pad); return r.json();
      };
      const member = await post('/api/auth/register', { name: 'Synthetic Pilot', email: 'pilot-' + lang + '@example.test',
        phone: '0612345678', password: 'local-pilot-123', geboortedatum: '1990-01-01', tier: 'rtg' });
      const f = await post('/api/bestanden/upload', { naam: 'Pilot-' + lang + '.txt', dataUrl: 'data:text/plain;base64,cHJvb2Y=' }, member.token);
      browser = await pw.chromium.launch(browserOpties(pw));
      page = await browser.newPage({ viewport: { width, height } });
      letOpFouten(page, errors);
      await page.addInitScript(({ token, lang }) => {
        localStorage.setItem('rtg_member_token', token); localStorage.setItem('rtg_lang', lang);
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, { token: member.token, lang });
      page.on('dialog', dialog => dialog.accept());
      page.on('request', r => {
        if (new URL(r.url()).pathname === '/api/bestanden/actie')
          trace.push({ at: new Date().toISOString(), kind: 'request', method: r.method(),
            path: '/api/bestanden/actie', body: JSON.parse(r.postData()) });
      });
      page.on('response', r => {
        if (new URL(r.url()).pathname === '/api/bestanden/actie') responses.push(r.json().then(body => {
          trace.push({ at: new Date().toISOString(), kind: 'response', path: '/api/bestanden/actie', status: r.status(), body });
        }));
      });
      const state = async () => (await post('/api/bestanden/mijn', {}, member.token)).items.find(x => x.id === f.id);
      await page.goto(srv.base + '/apps/bestanden.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-open="' + f.id + '"]');
      await page.locator('[data-open="' + f.id + '"]').click();
      if (out) await page.screenshot({ path: path.join(out, 'document-' + lang + '-before.png'), fullPage: true });
      const trashResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/api/bestanden/actie');
      await page.locator('#bkWeg').click();
      assert.equal((await trashResponse).status(), 200, 'trash must be confirmed by the backend');
      await page.waitForFunction(() => !document.querySelector('#bkScrim').classList.contains('open'));
      assert.equal((await state()).weg, true);
      await edgeActies(page);
      await page.locator('[data-rtg-adaptive-source="toonBak"]').click();
      await page.locator('[data-open="' + f.id + '"]').click();
      await edgeActies(page);
      const restore = page.locator('.rtg-adaptive-controls [data-cap="bestanden.herstel"]');
      await restore.waitFor({ state: 'visible', timeout: 8000 });
      assert.ok(await restore.getAttribute('aria-label'), 'Edge action has an accessible name');
      if (out) await page.screenshot({ path: path.join(out, 'document-' + lang + '-edge.png'), fullPage: true });
      const restoreResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/api/bestanden/actie');
      await restore.click();
      assert.equal((await restoreResponse).status(), 200, 'restore must be confirmed by the backend');
      await page.waitForFunction(() => {
        const b = window.RTGBestanden; return b && b.stand().items.every(x => !x.weg);
      });
      assert.equal((await state()).weg, false);
      await page.waitForFunction(() => !document.getElementById('bkScrim').classList.contains('open'));
      assert.equal(await page.evaluate(() => document.querySelector('main').inert), false);
      assert.equal(await page.evaluate(() => document.activeElement === document.body), false, 'focus returns to a usable control');
      assert.deepEqual(trace.filter(x => x.kind === 'request').map(x => x.body.capability), ['documents.trash', 'documents.restore']);
      assert.ok(trace.filter(x => x.kind === 'request').every(x => x.body.contractVersion === 1 && x.body.operationId && x.body.expectedVersion));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.RTGBestanden && window.RTGBestanden.stand());
      assert.equal((await state()).weg, false);
      assert.deepEqual(errors, []);
    } catch (e) {
      if (page && out) {
        await page.screenshot({ path: path.join(out, 'document-' + lang + '-failure.png'), fullPage: true });
        const diagnostic = await page.evaluate(() => ({
          context: window.RTGAdaptief && window.RTGAdaptief.context(),
          file: window.RTGBestandenPaneel && window.RTGBestandenPaneel.huidig(),
          controls: document.querySelector('.rtg-adaptive-controls')?.innerHTML,
          scrim: document.getElementById('bkScrim')?.className
        }));
        fs.writeFileSync(path.join(out, 'document-' + lang + '-diagnostic.json'), JSON.stringify(diagnostic, null, 2));
      }
      throw e;
    } finally {
      await Promise.all(responses);
      if (out) fs.writeFileSync(path.join(out, 'document-' + lang + '-trace.json'), JSON.stringify({
        kind: 'SANITIZED_UI_HTTP_TRACE', device: 'SIMULATED_CHROMIUM_VIEWPORT', lang, width, height, trace, errors
      }, null, 2));
      if (browser) await browser.close(); stop(srv.child);
    }
  });
}
