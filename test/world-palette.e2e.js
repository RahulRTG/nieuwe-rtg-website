/* Wereldkleuren op het werkelijk geschilderde scherm: een body-token alleen
   mist oude vlakken binnen een iframe en de kleur van zijn buitenste schil.
   Vergelijkt zelfstandige apps, desktopvensters en Pass-bladen op beide
   breedtes; controleert ook gebiedsnavigatie, terugkeer en de browserrand.
   De oude desktop-only CSS laat de spelerproef zakken; zonder paletprojectie
   zakt de Work-buitenrand; pathname zonder query verliest het reisgebied. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const h = require('./helper');
const pw = h.laadPlaywright(), skip = h.geenBrowser(pw);
const engines = ['chromium', ...(process.env.RTG_TEST_WEBKIT === '1' ? ['webkit'] : [])];
const colors = {
  living: ['rgb(16, 13, 10)', 'rgb(32, 25, 18)', 'rgb(247, 240, 229)'],
  work: ['rgb(16, 24, 23)', 'rgb(25, 36, 34)', 'rgb(243, 240, 231)'],
  travel: ['rgb(25, 13, 18)', 'rgb(41, 23, 29)', 'rgb(248, 239, 231)'],
  foundation: ['rgb(16, 35, 30)', 'rgb(25, 55, 45)', 'rgb(247, 241, 229)']
};
let srv, token;
async function post(route, body, auth) {
  const r = await fetch(srv.base + route, {method:'POST', headers:{'content-type':'application/json',
    ...(auth ? {Authorization:'Bearer '+auth} : {})}, body:JSON.stringify(body)});
  const data = await r.json(); assert.equal(r.status,200,JSON.stringify(data)); return data;
}
test.before(async () => {
  if (skip) return;
  srv = await h.startServer({env:{SMTP_URL:'',RTG_AI_UIT:'1',RTG_DEMO:'0'}});
  token = (await post('/api/auth/register',{name:'Wereldkleuren',email:'palet-'+Date.now()+'@example.test',
    password:'geheim12345',geboortedatum:'1980-01-01',tier:'rtg',pasApp:'rtg'})).token;
  const status = await post('/api/onboarding/status',{},token);
  await post('/api/onboarding/teken',{naam:'Wereldkleuren',akkoord:true,contractVersion:status.contract.versie},token);
});
test.after(async () => { if (srv) await h.stop(srv.child); });
async function palette(scope, world, card) {
  // Wait for imported CSS too: the body attributes precede stylesheet loading.
  await scope.waitForFunction(() => !!getComputedStyle(document.body).getPropertyValue('--rtg-world-card').trim());
  // Reduced motion still has a 0.01ms transition; sample the final painted state.
  await scope.waitForFunction(bg => getComputedStyle(document.body).backgroundColor === bg,colors[world][0],{timeout:3000});
  const actual = await scope.evaluate(selector => {
    const body = getComputedStyle(document.body), el = selector && document.querySelector(selector);
    return {body:body.backgroundColor, ink:body.color, card:el && getComputedStyle(el).backgroundColor,
      cardInk:el && getComputedStyle(el).color, palette:document.body.dataset.rtgPalette,
      token:body.getPropertyValue('--rtg-world-bg'),style:document.body.getAttribute('style'),transition:body.transition};
  },card);
  assert.equal(actual.body,colors[world][0],world+' body '+JSON.stringify(actual));
  assert.equal(actual.ink,colors[world][2],world+' text');
  if (card) {
    assert.equal(actual.card,colors[world][1],world+' '+card+' surface');
    assert.equal(actual.cardInk,colors[world][2],world+' '+card+' text');
  }
  // Let initial data requests finish before navigating or closing this frame.
  // Not `networkidle`: a signed-in screen keeps its live stream (/api/stream)
  // open, so the network never goes idle. Wait for a complete document whose
  // request count (live streams excluded) has been stable for 300 ms instead.
  await scope.waitForFunction(() => {
    if (document.readyState !== 'complete') return false;
    const n = performance.getEntriesByType('resource').filter(e => !/\/api\/stream/.test(e.name)).length;
    const v = window.__rtgPaletRust;
    if (!v || v.n !== n) { window.__rtgPaletRust = { n, sinds: performance.now() }; return false; }
    return performance.now() - v.sinds >= 300;
  }, null, { timeout: 15000 });
}
async function ready(page) { await page.waitForSelector('body[data-rtg-desktop-state="ready"]'); }
async function activeFrame(page, selector) {
  const handle = await page.waitForSelector(selector);
  const frame = await handle.contentFrame(); await frame.waitForLoadState('load'); return frame;
}
async function home(page) {
  await page.evaluate(() => RTGCommand.sluitAlles());
  await page.waitForSelector('.cmd-pane',{state:'detached'});
  await page.waitForFunction(() => document.body.getAttribute('data-rtg-palette') === 'living');
  await page.waitForSelector('.cmd-leeg'); await palette(page,'living');
}
for (const engine of engines) for (const width of [390,1440]) {
  test(engine+' '+width+': world colours survive embedding, navigation and returning home',{skip},async () => {
    const browser = await pw[engine].launch(engine === 'chromium' ? h.browserOpties(pw) : {});
    try {
      const ctx = await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
      await ctx.addInitScript(token => {localStorage.setItem('rtg_lang','nl');localStorage.setItem('rtg_cookieinfo_v1','1');
        localStorage.setItem('rtg_member_token',token);},token);
      const page = await ctx.newPage();
      // Same genuine app, standalone and in the desktop app frame.
      for (const [route,world,card] of [['muziek','living','.speler'],['media','living','.media-bank'],['werk','work','#inlog'],['reizen','travel','.wh-service']]) {
        await page.goto(srv.base+'/apps/'+route+'.html'); await ready(page); await palette(page,world,card);
        await page.goto(srv.base+'/apps/notities.html'); await ready(page);
        assert.equal(await page.evaluate(route => RTGDesktopFrame.open('/apps/'+route+'.html',route),route),true);
        const frame = await activeFrame(page,'.wd-app-frame:not([hidden])'); await palette(frame,world,card);
        await palette(page,world,'.wd-focus');
        assert.equal(await page.getAttribute('body','data-rtg-world'),'living','opening an app cannot change route identity');
        await page.evaluate(() => RTGDesktopFrame.collapse()); await palette(page,'living');
      }
      await page.goto(srv.base+'/apps/app.html?pas=rtg'); await ready(page);
      await page.waitForSelector('.cmd-leeg');
      for (const [route,world,card] of [['werk','work','#inlog'],['reizen','travel','.wh-service'],['foundation/os-publiek','foundation','.onthaal-beeld'],['muziek','living','.speler']]) {
        await page.evaluate(route => RTGCommand.open('/apps/'+route+'.html',route),route);
        const frame = await activeFrame(page,'.cmd-pane.actief iframe');
        await page.waitForFunction(world => document.body.getAttribute('data-rtg-blad-wereld') === world,world);
        await palette(frame,world,card); await palette(page,world);
        if (world === 'work' || world === 'travel') {
          const ground = await frame.locator(world === 'work' ? '.wk-shell' : '.reisapp').evaluate(el => getComputedStyle(el).backgroundColor);
          assert.equal(ground,colors[world][0],world+' inner operating shell');
        }
        const out = path.join(__dirname,'../artifacts/world-palette'); fs.mkdirSync(out,{recursive:true});
        await page.screenshot({path:path.join(out,engine+'-'+width+'-'+world+'.png')});
        await page.waitForFunction(() => {
          // The translucent header reports the same opaque pigment as rgb(),
          // while world tokens use hex. Compare colours, not their spelling.
          const c = document.createElement('canvas').getContext('2d');
          c.fillStyle = document.querySelector('meta[name="theme-color"]').content;
          const actual = c.fillStyle;
          c.fillStyle = getComputedStyle(document.body).getPropertyValue('--rtg-world-bg').trim();
          return actual === c.fillStyle;
        });
        await home(page);
      }
      await page.evaluate(() => RTGCommand.open('/apps/werkruimte.html?gebied=reizen','Reizen'));
      const frame = await activeFrame(page,'.cmd-pane.actief iframe'); await palette(frame,'travel');
      await palette(page,'travel');
      // Navigate inside the existing frame: its src attribute stays unchanged.
      await frame.goto(srv.base+'/apps/werkruimte.html?gebied=foundation');
      await page.waitForFunction(() => document.body.getAttribute('data-rtg-blad-wereld') === 'foundation');
      await palette(frame,'foundation'); await palette(page,'foundation');
      await home(page);
    } finally { await browser.close(); }
  });
}
