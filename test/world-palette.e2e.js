/* Wereldkleuren op het werkelijk geschilderde scherm: een body-token alleen
   mist oude vlakken binnen een iframe en de kleur van zijn buitenste schil.
   Sinds de www-pariteit (#534) is de grond in elke wereld dezelfde ivoren
   kamer van de publieke website; de wereld zelf leeft in de signatuurkleur.
   Vergelijkt zelfstandige apps, desktopvensters en Pass-bladen op beide
   breedtes; controleert ook gebiedsnavigatie, terugkeer en de browserrand.
   Een donkere oude vlakkenlaag laat de grond zakken; een signatuur die aan de
   route hangt in plaats van aan het palet laat de ingebedde schil zakken;
   pathname zonder query verliest het reisgebied. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const h = require('./helper');
const pw = h.laadPlaywright(), skip = h.geenBrowser(pw);
const engines = h.testMotoren();
// V4 gebruikt één rustige tijdschriftgrond. Wereldidentiteit blijft zichtbaar in
// signatuur en accent, zodat dezelfde besturing niet tot anonieme domeinen leidt.
const paper = 'rgb(244, 239, 231)', inkt = 'rgb(23, 19, 15)';
const colors = {
  living: [paper, inkt, '#b59063', '#67101f'],
  work: [paper, inkt, '#8da99b', '#173d37'],
  travel: [paper, inkt, '#b86a7e', '#791a35'],
  foundation: [paper, inkt, '#9eb69b', '#285849']
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
  // Basis injects the editorial runtime after the route scripts. WebKit on a
  // wide fresh document can report desktop-ready one frame before that final
  // stylesheet/runtime pair has annotated the body. Sample the actual V4
  // surface only after both layers are present.
  await scope.waitForFunction(() => document.body.dataset.rtgEditorialV4 === 'true' &&
    !!getComputedStyle(document.body).getPropertyValue('--v4-paper').trim());
  // Reduced motion still has a 0.01ms transition; sample the final painted state.
  await scope.waitForFunction(world => document.body.dataset.rtgPalette === world,world,{timeout:3000});
  const actual = await scope.evaluate(selector => {
    const body = getComputedStyle(document.body), el = selector && document.querySelector(selector);
    return {body:body.backgroundColor, ink:body.color, card:el && getComputedStyle(el).backgroundColor,
      cardInk:el && getComputedStyle(el).color, palette:document.body.dataset.rtgPalette,
      kind:document.body.dataset.rtgV4Kind,token:body.getPropertyValue('--rtg-world-bg'),
      signature:body.getPropertyValue('--rtg-world-signature').trim(),accent:body.getPropertyValue('--v4-accent').trim(),
      style:document.body.getAttribute('style'),transition:body.transition};
  },card);
  if (actual.kind === 'cover' || actual.kind === 'canvas') assert.equal(actual.body,'rgb(12, 12, 11)',world+' cinematic ground');
  else assert.equal(actual.body,colors[world][0],world+' paper '+JSON.stringify(actual));
  assert.equal(actual.ink,actual.kind === 'cover' || actual.kind === 'canvas' ? 'rgb(255, 250, 242)' : colors[world][1],world+' text');
  assert.equal(actual.palette,world,world+' palette');
  assert.equal(actual.signature,colors[world][2],world+' signature');
  assert.equal(actual.accent,colors[world][3],world+' editorial accent');
  if (card) {
    assert.ok(actual.card,world+' '+card+' surface is painted');
    assert.ok(actual.cardInk,world+' '+card+' text is painted');
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
      // Het onthaal van Foundation is een fotohero (donker beeld, lichte tekst),
      // geen ivoren vlak; daar toetst deze proef alleen grond, inkt en signatuur.
      for (const [route,world,card] of [['werk','work','#inlog'],['reizen','travel','.wh-service'],['foundation/os-publiek','foundation',null],['muziek','living','.speler']]) {
        await page.evaluate(route => RTGCommand.open('/apps/'+route+'.html',route),route);
        const frame = await activeFrame(page,'.cmd-pane.actief iframe');
        await page.waitForFunction(world => document.body.getAttribute('data-rtg-blad-wereld') === world,world);
        await palette(frame,world,card); await palette(page,world);
        const out = path.join(__dirname,'../artifacts/world-palette'); fs.mkdirSync(out,{recursive:true});
        await page.screenshot({path:path.join(out,engine+'-'+width+'-'+world+'.png')});
        await page.waitForFunction(() => {
          // De browserrand volgt de werkelijk geschilderde papier- of filmgrond.
          // Vergelijk kleuren, niet hun rgb/hex-spelling.
          const c = document.createElement('canvas').getContext('2d');
          c.fillStyle = document.querySelector('meta[name="theme-color"]').content;
          const actual = c.fillStyle;
          c.fillStyle = getComputedStyle(document.body).backgroundColor;
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
