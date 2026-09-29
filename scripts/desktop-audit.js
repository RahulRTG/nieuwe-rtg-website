/* Browser coverage of every actual app entry, not a hand-picked route list.
   RTG_DESKTOP_ROUTES can narrow a repair run; the report states that scope. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties } = require('../test/helper');
const identity = require('../public/shared/rtg-world-identity');
function arg(name) { const i = process.argv.indexOf('--'+name); return i >= 0 ? process.argv[i+1] : ''; }
if (arg('browser')) process.env.RTG_BROWSER_PATH = arg('browser');
const root = path.join(__dirname, '..');
const out = path.resolve(arg('output') || process.env.RTG_DESKTOP_OUTPUT || path.join(root, 'artifacts/desktop-standard'));
const files = fs.readdirSync(path.join(root, 'public/apps'), { recursive: true }).filter(f => f.endsWith('.html')).sort();
const site = arg('site');
const all = site ? fs.readdirSync(site,{recursive:true}).filter(f=>f.endsWith('.html')&&!f.startsWith('public/')).sort().map(f=>'/'+f.replace(/index\.html$/,'')) : files.map(f => '/apps/' + f).filter(f => identity.classify(f) !== 'redirect').concat(['/'], fs.readdirSync(path.join(root,'public/site'), {recursive:true}).filter(f=>f.endsWith('.html')).map(f=>'/site/'+f));
const selected = arg('routes') || process.env.RTG_DESKTOP_ROUTES;
const routes = selected ? selected.split(',') : all;
const shots = new Set(['/apps/rtg.html', '/apps/wereld.html', '/apps/kantoor.html', '/apps/reizen.html', '/apps/foundation/os-publiek.html', '/apps/agenda.html', '/apps/camera.html', '/apps/office.html', '/apps/foundation/agenda.html', '/apps/app.html', '/']);
const results = [], width = Number(arg('width') || 1440), mobile = width < 1000;
async function main() {
  const pw = laadPlaywright();
  if (!pw) throw new Error('A real browser is required; this audit cannot be skipped.');
  fs.mkdirSync(out, { recursive: true });
  const srv = site ? await require('./lib/desktop-static')(site) : await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1', RTG_DEMO: '0' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); });
    let next = 0;
    await Promise.all(Array.from({ length: 3 }, async () => {
      const page = await ctx.newPage();
      while (next < routes.length) {
        const route = routes[next++], errors = [];
        const onError = e => errors.push(e.message);
        page.on('pageerror', onError);
        const row = { route };
        try {
          const started = Date.now();
          const response = await page.goto(srv.base + route, { waitUntil: 'domcontentloaded', timeout: 25000 });
          row.http = response.status();
          await page.waitForSelector('body[data-rtg-desktop-state="ready"],body[data-public-platform]', { timeout: 12000 });
          row.contentReadyMs = Date.now() - started;
          if (route === '/apps/reisuitnodiging.html') {
            await require('./lib/desktop-guest')(page, row, errors);
          } else {
          await page.waitForSelector('.rtg-adaptive-bar', { timeout: 12000 });
          row.edgeReadyMs = Date.now() - started;
          await page.waitForFunction(() => { const photos = [...document.querySelectorAll('.wp-atmosphere img,.wp-photo>img')]; return photos.length && photos.every(img => img.complete && img.naturalWidth > 0); }, null, { timeout: 12000 });
          // Edge can append styles after DOMContentLoaded; wait for the shared
          // desktop stylesheet to finish applying before measuring its grid.
          await page.waitForFunction(() => getComputedStyle(document.body).paddingTop === (/^(compact|focus)$/.test(document.body.getAttribute('data-rtg-edge-2-state') || '') ? '0px' : '64px'), null, { timeout: 6000 });
          await page.evaluate(() => document.fonts.ready);
          row.state = await page.evaluate(() => {
            const b = document.body, css = getComputedStyle(b);
            const rect = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,scroll: getComputedStyle(e).overflowY }; };
            return { url: location.pathname, world:b.dataset.rtgWorld, desktop:b.dataset.rtgDesktop, layout:b.dataset.rtgLayout, public:b.dataset.publicPlatform,
              background:css.backgroundColor, edgeState:b.getAttribute('data-rtg-edge-2-state'), padding:css.padding, pageScroll:scrollY, scheme:css.colorScheme, shells:document.querySelectorAll('.wd-shell').length,
              edges:document.querySelectorAll('.rtg-adaptive-bar').length,
              paletteRegions:['.rtg-adaptive-bar','.wk-shell','.hq-shell','.pn-shell','.reisapp'].flatMap(selector => {
                const el = document.querySelector(selector); if (!el || !el.getBoundingClientRect().height) return [];
                return [{selector,background:getComputedStyle(el).backgroundColor}];
              }),
              shell:rect('.wd-shell'), content:rect(b.dataset.rtgDesktopAccess === 'locked' ? '.wd-access' : document.querySelector('.wd-focus:not([hidden])') ? '.wd-focus:not([hidden])' : '.wd-home'), left:rect('.wd-people'), right:rect('.wd-favorites'), library:rect('.wd-library'),
              overflow:document.documentElement.scrollWidth > innerWidth + 1,
              offenders:Array.from(document.querySelectorAll('body *')).filter(e => { const r=e.getBoundingClientRect(); return r.width && (r.right > innerWidth+2 || r.x < -2) && getComputedStyle(e).position !== 'fixed'; }).slice(0,8).map(e => e.tagName+'#'+e.id+'.'+e.className)
            };
          });
          const s = row.state;
          row.clippedContent = await page.evaluate(require('./lib/desktop-content'));
          row.failures = [];
          if (row.clippedContent.length) row.failures.push('clipped-app-content');
          if (row.http !== 200 && route !== '/site/404.html') row.failures.push('http-'+row.http);
          const expectedTop = (mobile ? 136 : !s.public && s.world === 'living' ? 154 : 104) - (/^(compact|focus)$/.test(s.edgeState || '') ? 64 : 0);
          if (Math.abs(s.shell?.y+s.pageScroll-expectedTop) > 2) row.failures.push('nonstandard-top-inset');
          if (s.shells !== 1 || s.edges !== 1) row.failures.push('duplicate-or-missing-frame');
          if (s.overflow) row.failures.push('horizontal-overflow');
          if (!s.left || !s.right || !s.content || !s.shell || (!mobile && (s.left.w < 100 || s.right.w < 100))) row.failures.push('missing-column');
          else if (!mobile) {
            if (Math.abs(s.shell.x-40) > 2 || Math.abs(s.left.w-216) > 2 || Math.abs(s.right.w-280) > 2) row.failures.push('nonstandard-geometry');
            if (s.content.x < s.left.right || s.content.right > s.right.x + 1) row.failures.push('overlapping-columns');
            if (s.content.scroll === 'auto' || s.left.scroll === 'auto' || s.right.scroll === 'auto') row.failures.push('nested-page-scroll');
            if (s.library && Math.max(s.content.bottom,s.right.bottom) > s.library.y+1) row.failures.push('library-overlap');
          }
          const palettes = {living:'rgb(250, 248, 243)',work:'rgb(20, 26, 24)',travel:'rgb(28, 24, 24)',foundation:'rgb(20, 32, 42)'};
          if(s.layout !== 'standard')row.failures.push('legacy-layout');
          if (s.background !== (s.public ? 'rgb(18, 18, 16)' : palettes[s.world])) row.failures.push('nonstandard-world-palette');
          const cards = {living:'rgb(255, 253, 249)',work:'rgb(28, 37, 36)',travel:'rgb(45, 32, 37)',foundation:'rgb(27, 41, 58)'};
          if (!s.public) for (const region of s.paletteRegions) {
            const expected = region.selector === '.rtg-adaptive-bar' ? cards[s.world] : palettes[s.world];
            if (region.background !== expected) row.failures.push('nonstandard-inner-palette:'+region.selector);
          }
          }
        } catch (e) { row.failures = [e.message.split('\n')[0]]; }
        row.errors = errors;
        if (shots.has(route) || row.failures.length) {
          const name = route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home';
          try { await page.screenshot({ path:path.join(out,name+'.png'), fullPage:false, timeout:5000 }); } catch (_) {}
          try { fs.writeFileSync(path.join(out,name+'.html'), await page.content()); } catch (_) {}
        }
        results.push(row); page.off('pageerror', onError);
        fs.writeFileSync(path.join(out,'report.json'), JSON.stringify({ viewport:width, total:all.length, scope:routes.length, checked:results.length, results },null,2));
        console.log((row.failures.length ? 'FAIL ' : 'PASS ') + route + (row.failures.length ? ' '+row.failures.join(', ') : ''));
      }
      await page.close();
    }));
    await ctx.close();
  } finally { if (browser) await browser.close(); if(srv.close)await srv.close();else await stop(srv.child); }
  const failed = results.filter(r => r.failures.length);
  console.log(`${results.length} checked; ${failed.length} failed. ${out}/report.json`);
  process.exitCode = failed.length ? 1 : 0;
}
main().catch(e => { console.error(e); process.exitCode = 1; });
