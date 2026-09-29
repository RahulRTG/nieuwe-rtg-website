/* Real installation and interrupted startup, rather than a mocked PWA flag
   alone. API responses must never become part of the offline interface. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helper');
const pw = h.laadPlaywright(), skip = h.geenBrowser(pw);
let srv, token;
test.before(async () => {
  if (skip) return;
  srv = await h.startServer({env:{SMTP_URL:'', RTG_AI_UIT:'1', RTG_DEMO:'0'}});
  async function post(path, body, auth) {
    const r = await fetch(srv.base+path, {method:'POST',headers:{'content-type':'application/json',
      ...(auth ? {Authorization:'Bearer '+auth} : {})},body:JSON.stringify(body)});
    assert.equal(r.status,200); return r.json();
  }
  const user = await post('/api/auth/register', {name:'Pass start',email:'pass-start-'+Date.now()+'@example.test',
    password:'geheim12345',geboortedatum:'1980-01-01',tier:'rtg',pasApp:'rtg'});
  token = user.token;
  const status = await post('/api/onboarding/status',{},token);
  await post('/api/onboarding/teken',{naam:'Pass start',akkoord:true,contractVersion:status.contract.versie},token);
});
test.after(async () => { if (srv) await h.stop(srv.child); });
async function context(browser, workers, savedToken = token) {
  const ctx = await browser.newContext({...pw.devices['iPhone 13'],viewport:{width:390,height:844},
    deviceScaleFactor:1,serviceWorkers:workers,reducedMotion:'reduce'});
  await ctx.addInitScript(token => {
    if (!sessionStorage.getItem('pass-test-seeded')) {
      localStorage.setItem('rtg_member_token',token);
      sessionStorage.setItem('pass-test-seeded','1');
    }
    localStorage.setItem('rtg_cookieinfo_v1','1');
    Object.defineProperty(navigator,'standalone',{value:true});
  }, savedToken);
  return ctx;
}
async function reachable(page, selector) {
  // Restoring the session rebuilds Command's home. Resolve the current node
  // and test its painted hit area atomically, rather than keeping a stale one.
  await page.waitForFunction(selector => {
    const e = document.querySelector(selector);
    if (!e) return false;
    e.scrollIntoView({block:'center',behavior:'instant'});
    const r = e.getBoundingClientRect(), hit = document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return r.height >= 40 && hit && e.contains(hit);
  }, selector);
}
for (const engine of ['chromium',...(process.env.RTG_TEST_WEBKIT === '1' ? ['webkit'] : [])]) {
  test(engine+': ontbrekende Pass-module toont herstel en opnieuw proberen opent de echte inhoud', {skip}, async () => {
    const browser = await pw[engine].launch(engine === 'chromium' ? h.browserOpties(pw) : {});
    try {
      const ctx = await context(browser,'block'), page = await ctx.newPage();
      let blocked = 0;
      await page.route('**/shared/command/beginscherm.js*',r => { blocked++; return r.abort(); });
      await page.goto(srv.base+'/apps/app.html?pas=rtg');
      await page.waitForSelector('#app.active');
      await reachable(page,'#passStartup button');
      assert.ok(blocked > 0, 'the real versioned startup module must be interrupted');
      assert.equal(await page.locator('.cmd-leeg').count(),0);
      await page.unroute('**/shared/command/beginscherm.js*');
      await page.locator('#passStartup button').click();
      await reachable(page,'.cmd-intentie');
      assert.equal(await page.locator('#passStartup:visible').count(),0);
      await ctx.close();
    } finally { await browser.close(); }
  });
}
test('Pass opent na één installatie offline met de volledige interface, zonder privégegevens in de cache', {skip}, async () => {
  const browser = await pw.chromium.launch(h.browserOpties(pw));
  try {
    const ctx = await context(browser,'allow'), page = await ctx.newPage();
    await page.goto(srv.base+'/apps/app.html?pas=rtg');
    await page.waitForSelector('.cmd-leeg h2');
    await page.waitForSelector('body[data-rtg-pass-cache="ready"]');
    // These exact server-generated URLs were fetched before worker control.
    const cached = await page.evaluate(async () => {
      const keys = await caches.keys(), c = await caches.open(keys.find(k => k.startsWith('rtg-app-')));
      return (await c.keys()).map(r => new URL(r.url).pathname+new URL(r.url).search);
    });
    for (const prefix of ['/scriptbundel.js?', '/stijlbundel.css?', '/stijlblok.css?',
      '/shared/command.js?', '/shared/interface/world-desktop-home.js', '/shared/interface/world-widget-catalog.json',
      '/images/world-homes/living-sfeer.jpg']) {
      assert.ok(cached.some(p => p.startsWith(prefix)), 'missing offline dependency: '+prefix);
    }
    assert.ok(cached.every(p => !p.startsWith('/api/') && !p.startsWith('/uploads/')), 'cache contains public assets only');
    await ctx.setOffline(true);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForSelector('body[data-rtg-desktop-state="ready"]');
    await reachable(page,'#passStartup button');
    assert.equal(await page.evaluate(() => localStorage.getItem('rtg_member_token')),token,
      'a network failure must not erase the saved session');
    assert.equal(await page.locator('#app.active').count(),0, 'offline startup does not bypass the session gate');
    assert.equal(await page.locator('.cmd-leeg').count(),0, 'no member workspace without session validation');
    await ctx.setOffline(false);
    await page.locator('#passStartup button').click();
    await reachable(page,'.cmd-intentie');
    await ctx.close();
  } finally { await browser.close(); }
});

test('een afgewezen sessie blijft achter de inlogdeur en wordt wel gewist', {skip}, async () => {
  const browser = await pw.chromium.launch(h.browserOpties(pw));
  try {
    const ctx = await context(browser,'block','invalid-pass-session'), page = await ctx.newPage();
    await page.goto(srv.base+'/apps/app.html?pas=rtg');
    await page.waitForFunction(() => !localStorage.getItem('rtg_member_token'));
    await reachable(page,'#gate button:not([hidden])');
    assert.equal(await page.locator('#app.active,.cmd-leeg,#passStartup:visible').count(),0);
    await ctx.close();
  } finally { await browser.close(); }
});
