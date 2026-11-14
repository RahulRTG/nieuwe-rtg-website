'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright();

test('TeamCall toont en bedient de statische gespreksoverlay in een echte browser', { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 430, height: 932 }, reducedMotion:'reduce', serviceWorkers:'block' });
    const fouten=letOpFouten(page,[]), pad='/__teamcall-ds';
    await page.route('**'+pad,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="nl"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script src="/shared/teamcall.js"></script></body></html>'}));
    await page.goto(srv.base+pad,{waitUntil:'networkidle'});
    await page.evaluate(() => {
      const audio = { enabled: true, stop() {} };
      const video = { enabled: true, stop() {} };
      const stroom = new MediaStream();
      stroom.getTracks = () => [audio, video];
      stroom.getAudioTracks = () => [audio];
      stroom.getVideoTracks = () => [video];
      window.RTGMedia = { camera: async () => stroom };
    });
    await page.evaluate(async () => {
      TeamCall.init({
        API: { call: async pad => pad === '/ice' ? { iceServers: [] } : { ok: true } },
        mij: () => ({ staffId: 'ik', name: 'Ria Rahul' })
      });
      await TeamCall.groep();
    });

    await page.waitForSelector('#tcOverlay');
    assert.equal(await page.locator('link[href="/ds/rtg-ds.css"]').count(),1);
    assert.match(await page.locator('#tcOverlay').getAttribute('class'),/ds-teamcall/);
    assert.match(await page.locator('#tcKop').textContent(), /Teamcall · 1\/100/);
    const maten = await page.locator('#tcMic').evaluate(el => {
      const r = el.getBoundingClientRect(); return { width: r.width, height: r.height };
    });
    assert.ok(maten.width >= 44 && maten.height >= 44, JSON.stringify(maten));
    await page.locator('#tcMic').click();
    assert.equal(await page.locator('#tcMic').evaluate(el => el.classList.contains('uit')), true);
    await page.locator('#tcWeg').click();
    assert.equal(await page.locator('#tcOverlay').count(), 0);
    assert.equal(await page.evaluate(() => TeamCall.actief()), false);
    assert.deepEqual(fouten,[]);
  } finally {
    if (browser) await browser.close();
    await stop(srv.child);
  }
});
