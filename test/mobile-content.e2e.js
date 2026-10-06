/* Content must be painted and reachable inside the common frame. Checking
   only the outer .wd-home missed a 58px Work viewport inside a 400px box. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helper');
const pw = h.laadPlaywright(), skip = h.geenBrowser(pw);
const engines = ['chromium', ...(process.env.RTG_TEST_WEBKIT === '1' ? ['webkit'] : [])];
let srv, token, session;
async function post(route, body, auth) {
  const r = await fetch(srv.base + route, {method:'POST', headers:{'content-type':'application/json',
    ...(auth ? {Authorization:'Bearer ' + auth} : {})}, body:JSON.stringify(body)});
  const data = await r.json(); assert.equal(r.status, 200, route + ': ' + JSON.stringify(data)); return data;
}
test.before(async () => {
  if (skip) return;
  srv = await h.startServer({env:{SMTP_URL:'', RTG_AI_UIT:'1', RTG_DEMO:'0'}});
  const user = await post('/api/auth/register', {name:'Schermproef', email:'inhoud-'+Date.now()+'@example.test',
    password:'geheim12345', geboortedatum:'1980-01-01', tier:'rtg', pasApp:'rtg'});
  token = user.token;
  const status = await post('/api/onboarding/status', {}, token);
  await post('/api/onboarding/teken', {naam:'Schermproef', akkoord:true, contractVersion:status.contract.versie}, token);
  const work = await post('/api/bedrijf/werkruimte/maak', {naam:'Schermproef BV', land:'NL'});
  session = {werkruimte:work.werkruimte, beheerToken:work.beheerToken};
});
test.after(async () => { if (srv) await h.stop(srv.child); });
async function context(browser, width, signedIn = true) {
  const ctx = await browser.newContext({...(width < 1000 ? pw.devices['iPhone 13'] : {}),
    viewport:{width, height:900}, serviceWorkers:'block', reducedMotion:'reduce'});
  await ctx.addInitScript(({token,session}) => {
    localStorage.setItem('rtg_lang','nl'); localStorage.setItem('rtg_cookieinfo_v1','1');
    if (token) localStorage.setItem('rtg_member_token', token);
    localStorage.setItem('rtg_werk_sessie',JSON.stringify(session));
    Object.defineProperty(navigator,'standalone',{value:true});
  }, {token:signedIn ? token : null, session});
  return ctx;
}
async function open(page, route) {
  await page.goto(srv.base + route, {waitUntil:'domcontentloaded'});
  await page.waitForSelector('body[data-rtg-desktop-state="ready"]');
  await page.waitForSelector('body[data-rtg-adaptive-ready="true"]');
  await page.evaluate(() => document.fonts.ready);
}
async function painted(page, selector) {
  const target = page.locator(selector).first();
  await target.waitFor({state:'visible'});
  await target.scrollIntoViewIfNeeded();
  const state = await target.evaluate(el => {
    const r = el.getBoundingClientRect();
    let left = Math.max(0,r.left), right = Math.min(innerWidth,r.right);
    let top = Math.max(0,r.top), bottom = Math.min(innerHeight,r.bottom);
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p), b = p.getBoundingClientRect();
      if (/hidden|clip|scroll|auto/.test(s.overflowY)) { top = Math.max(top,b.top); bottom = Math.min(bottom,b.bottom); }
      if (/hidden|clip|scroll|auto/.test(s.overflowX)) { left = Math.max(left,b.left); right = Math.min(right,b.right); }
    }
    const hit = document.elementFromPoint((left+right)/2,(top+bottom)/2);
    return {height:r.height, visibleHeight:Math.max(0,bottom-top), visibleWidth:right-left,
      reachable:!!hit && (el.contains(hit) || hit.contains(el)), hit:hit && hit.tagName+'.'+hit.className};
  });
  assert.ok(state.height > 10 && state.visibleHeight >= state.height - 2 && state.visibleWidth > 20 && state.reachable,
    selector + ' is clipped or covered: ' + JSON.stringify(state));
}
async function shot(page, name) {
  const out = path.join(__dirname,'../artifacts/mobile-content'); fs.mkdirSync(out,{recursive:true});
  await page.screenshot({path:path.join(out,name+'.png')});
}
/* "TypeError: Load failed" is wat WebKit meldt voor een fetch die afbreekt omdat
   zijn DOCUMENT wordt verlaten (herladen, context dicht). Chromium meldt die niet.
   Alleen precies die tekst, en alleen terwijl de toets zelf weg-navigeert, telt
   niet; buiten dat venster blijft hij een clientfout, en dan zegt netwerkStand()
   welk adres het was. Geteld wordt hij wel (stand.afgebroken). */
const AFGEBROKEN = 'TypeError: Load failed';
const bak = (errors, stand) => ({ push(m) { if (stand.weg && m === AFGEBROKEN) stand.afgebroken++; else errors.push(m); } });
const lopend = new WeakMap(), mislukt = new WeakMap();
function netwerk(p) {
  const open = new Map(), fout = [];
  lopend.set(p, open); mislukt.set(p, fout);
  p.on('request', r => open.set(r, r.url()));
  p.on('requestfinished', r => open.delete(r));
  p.on('requestfailed', r => { open.delete(r); fout.push(r.url().replace(srv.base, '') + ' (' + ((r.failure() || {}).errorText || '?') + ')'); });
}
function netwerkStand(p) {
  const open = [...(lopend.get(p) || new Map()).values()].map(u => u.replace(srv.base, ''));
  return 'hangend: ' + JSON.stringify(open.slice(0, 12)) + '; mislukt: ' + JSON.stringify((mislukt.get(p) || []).slice(0, 12));
}
test('de afbreekzeef laat alleen een WebKit-afbreking tijdens het weg-navigeren door', () => {
  const errors = [], stand = {weg:false, afgebroken:0}, b = bak(errors, stand);
  b.push(AFGEBROKEN);
  assert.deepEqual(errors, [AFGEBROKEN], 'buiten het venster is hij een gewone clientfout');
  stand.weg = true;
  b.push(AFGEBROKEN); b.push('TypeError: iets anders'); b.push(AFGEBROKEN + ' uitgebreid');
  assert.deepEqual(errors, [AFGEBROKEN, 'TypeError: iets anders', AFGEBROKEN + ' uitgebreid'], 'alleen precies die tekst');
  assert.equal(stand.afgebroken, 1, 'en hij wordt geteld, niet weggegooid');
});
for (const engine of engines) {
  for (const width of [390,1440]) test(engine+' '+width+': Work, Horeca en Network houden hun inhoud', {skip}, async () => {
    const browser = await pw[engine].launch(engine === 'chromium' ? h.browserOpties(pw) : {});
    try {
      const ctx = await context(browser,width), page = await ctx.newPage(), errors = [];
      h.letOpFouten(page,errors);
      for (const [route,heading,stage] of [
        ['werk','.wk-briefing h1','.wk-stage'], ['horeca','.hq-stage h2','.hq-stage'],
        ['partner-network','.pn-network h2','.pn-grid']
      ]) {
        await open(page,'/apps/'+route+'.html');
        await painted(page,heading);
        const geometry = await page.locator(stage).evaluate(el => ({height:el.clientHeight, content:el.scrollHeight}));
        assert.ok(geometry.height >= geometry.content - 2, route+' crops document content: '+JSON.stringify(geometry));
        await shot(page,engine+'-'+width+'-'+route);
        if (route === 'werk') {
          await h.edgeActies(page);
          await page.click('[data-wk="projecten"]');
          await page.click('[data-rtg-adaptive-close]');
          await painted(page,'[data-doe="0"]');
          // .wd-home is display:contents on mobile; measure the real Work content stage.
          const fits = await page.locator('[data-doe="0"]').evaluate(el => {
            const button = el.getBoundingClientRect(), home = el.closest('.wk-stage').getBoundingClientRect();
            return button.left >= home.left && button.right <= home.right;
          });
          assert.ok(fits, 'the project action must remain inside the content column');
          await shot(page,engine+'-'+width+'-project-action');
        }
      }
      await open(page,'/apps/werk.html');
      await page.waitForSelector('.wk-briefing');
      await page.waitForFunction(() => document.documentElement.scrollHeight > innerHeight);
      await page.evaluate(() => scrollTo(0,document.documentElement.scrollHeight));
      await page.waitForFunction(() => scrollY > 0);
      assert.ok(await page.evaluate(() => scrollY > 0), 'the common document must scroll');
      assert.deepEqual(errors, [], 'no client errors while showing the content');
    } finally { await browser.close(); }
  });
  for (const delayed of [false,true]) test(engine+': Pass inhoud, tabblad en hervatten'+(delayed?' met late Command':'') , {skip}, async () => {
    const browser = await pw[engine].launch(engine === 'chromium' ? h.browserOpties(pw) : {});
    try {
      const ctx = await context(browser,390), errors = [], stand = {weg:false, afgebroken:0};
      let page = await ctx.newPage();
      const volg = (p) => { h.letOpFouten(p, bak(errors, stand)); netwerk(p); };
      volg(page);
      let held = 0;
      const vertraag = async r => {held++;await new Promise(resolve => setTimeout(resolve,1200));await r.continue();};
      if (delayed) await page.route('**/shared/command.js*',vertraag);
      await open(page,'/apps/app.html?pas=rtg');
      await painted(page,'.cmd-leeg h2');
      if (delayed) assert.ok(held > 0, 'the late-load case must delay the versioned Command script');
      await page.evaluate(() => document.querySelector('.tabbar button[data-tab="reizen"]').click());
      await page.waitForSelector('#app.os-open');
      await painted(page,'.view.active h2');
      await page.evaluate(() => document.querySelector('.tabbar button[data-tab="home"]').click());
      await page.evaluate(() => RTGCommand.open('/apps/werk.html','Werk OS'));
      await page.waitForSelector('.cmd-pane.actief iframe');
      /* Het hervatten leest de open bladen uit localStorage (shared/command/geheugen.js);
         wacht tot die stand er staat in plaats van te hopen dat hij er al is. */
      await page.waitForFunction(() => /werk\.html/.test(localStorage.getItem('rtg_cmd_bladen') || ''));
      /* DE LATE COMMAND IS BEWEZEN OP DE EERSTE LAADBEURT (held > 0), en het
         hervatten wordt gemeten op een pagina waar NOOIT een route op stond.
         Een pagina die ooit een onderschepte en doorgelaten aanvraag had, herlaadt
         in WebKit niet betrouwbaar: eerst een interne fout, en na unroute() nog
         steeds soms een pagina die nooit ready wordt (6 oktober 2026, twee keer op
         een dag, met nul clientfouten). Routes horen bij de PAGINA en de stand bij
         de CONTEXT, dus een tweede pagina erft de bladen en niet de onderschepping. */
      if (delayed) {
        const verder = await ctx.newPage(); volg(verder);
        await page.close(); page = verder;
        await page.goto(srv.base + '/apps/app.html?pas=rtg', {waitUntil:'domcontentloaded'});
      }
      stand.weg = true;
      await page.reload({waitUntil:'domcontentloaded'});
      stand.weg = false;
      await page.waitForSelector('body[data-rtg-desktop-state="ready"]').catch(async e => {
        const ds = await page.evaluate(() => document.body.dataset.rtgDesktopState).catch(() => '?');
        throw new Error('na herladen geen ready-stand maar ' + JSON.stringify(ds) + '; fouten: ' + JSON.stringify(errors) +
          '; ' + netwerkStand(page) + ' -- ' + e.message);
      });
      const frame = page.frameLocator('.cmd-pane.actief iframe');
      await frame.locator('.wk-briefing h1').waitFor({state:'visible'});
      const bounds = await page.locator('.cmd-pane.actief iframe').boundingBox();
      assert.ok(bounds.height >= 300, 'resumed app needs a usable viewport');
      await shot(page,engine+'-pass-resumed-'+delayed);
      stand.weg = true;
      await ctx.close();
      stand.weg = false;
      const guest = await context(browser,390,false), login = await guest.newPage();
      volg(login);
      await open(login,'/apps/app.html?pas=rtg');
      await painted(login,'#gate button:not([hidden])');
      assert.deepEqual(errors, [], 'no client errors during Pass transitions; ' + netwerkStand(login));
    } finally { await browser.close(); }
  });
}
