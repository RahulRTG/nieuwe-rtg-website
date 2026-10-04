'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const pw = laadPlaywright();

test('Foundation installs a complete offline shell; duplicate cache operations cannot silently empty it',
  { skip: geenBrowser(pw) }, async () => {
    const srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
    let browser;
    try {
      browser = await pw.chromium.launch(browserOpties(pw));
      const context = await browser.newContext({ serviceWorkers: 'allow' });
      const page = await context.newPage();
      await page.goto(srv.base + '/icon.svg');
      const duplicate = await page.evaluate(async () => {
        const cache = await caches.open('rtg-duplicate-regression');
        try { await cache.addAll(['/icon.svg', '/icon.svg']); return { accepted: true }; }
        catch (error) { return { accepted: false, name: error.name, entries: (await cache.keys()).length }; }
        finally { await caches.delete('rtg-duplicate-regression'); }
      });
      assert.deepEqual(duplicate, { accepted: false, name: 'InvalidStateError', entries: 0 },
        'This browser must reproduce the all-or-nothing duplicate-cache failure.');
      const served = await (await fetch(srv.base + '/apps/foundation/sw.js')).text();
      const source = fs.readFileSync(path.join(__dirname, '../public/apps/foundation/sw.js'), 'utf8');
      assert.equal(served, source, 'The test must install the actual source worker.');
      const cacheName = /const CACHE = '([^']+)'/.exec(source)[1];
      const shell = [.../const SHELL = \[([^]*?)\];/.exec(source)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
      await page.evaluate(() => {
        window.foundationInstallState = 'registering';
        navigator.serviceWorker.register('/apps/foundation/sw.js', { scope: '/apps/foundation/' }).then(registration => {
          const worker = registration.installing || registration.waiting || registration.active;
          if (!worker) { window.foundationInstallState = 'missing'; return; }
          const observe = () => { window.foundationInstallState = worker.state; };
          worker.addEventListener('statechange', observe);
          observe();
        }).catch(error => { window.foundationInstallState = 'failed:' + error.name; });
      });
      // Activation follows the install event's waitUntil(addAll). Listen to the
      // worker lifecycle, then inspect every cache entry; elapsed time is no proof.
      await page.waitForFunction(() => ['activated', 'redundant', 'missing'].includes(window.foundationInstallState) ||
        window.foundationInstallState.startsWith('failed:'), null, { timeout: 10000 });
      assert.equal(await page.evaluate(() => window.foundationInstallState), 'activated');
      const cached = await page.evaluate(async name => (await (await caches.open(name)).keys())
        .map(request => new URL(request.url).pathname).sort(), cacheName);
      assert.deepEqual(cached, [...new Set(shell)].sort(),
        'Activated Foundation worker must have every declared offline resource; an empty cache is not success.');
      await context.close();
    } finally { if (browser) await browser.close(); await stop(srv.child); }
  });
