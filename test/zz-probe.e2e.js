const { startServer, stop, laadPlaywright, browserOpties } = require('./helper');
(async () => {
  const pw = laadPlaywright(); const srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1', RTG_DEMO: '0' } });
  const b = await pw.chromium.launch(browserOpties(pw));
  for (const route of ['/apps/reizen.html','/apps/kantoor.html','/apps/foundation/index.html']) for (const w of [320,390]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, serviceWorkers: 'block' });
    await ctx.addInitScript(() => { localStorage.setItem('rtg_lang','nl'); localStorage.setItem('rtg_cookieinfo_v1','1'); });
    const p = await ctx.newPage(); await p.goto(srv.base + route, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('body[data-rtg-desktop-state="ready"]').catch(()=>{});
    const r = await p.evaluate(() => ({ shell: document.body.dataset.rtgShell, cin: document.body.dataset.rtgCinematic, home: document.body.hasAttribute('data-world-home'),
      scene: [...document.querySelectorAll('.wp-scene')].filter(e=>e.checkVisibility()).length,
      wh: [...document.querySelectorAll('.wh-photo h1')].filter(e=>e.checkVisibility()).length, wdhome: !!document.querySelector('.wd-home>.wp-scene') }));
    console.log(route, w, JSON.stringify(r)); await ctx.close();
  }
  await b.close(); await stop(srv.child);
})();
