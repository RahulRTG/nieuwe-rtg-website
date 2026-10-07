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
const all = site ? fs.readdirSync(site,{recursive:true}).filter(f=>f.endsWith('.html')&&!f.startsWith('public/')).sort().map(f=>'/'+f.replace(/index\.html$/,'')) : require('./editorial-coverage').discover().rows.filter(r=>r.type==='SCREEN'&&(r.source==='index.html'||r.source.startsWith('public/'))).map(r=>r.route);
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
    // Playwright's worker-blocking injection reads navigator.serviceWorker in
    // every frame. That property is forbidden in an opaque app-store sandbox.
    // Use a fresh ordinary context; never inject RTG preferences into a cell.
    const ctx = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { if (window.top !== window) return; localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); });
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
          await page.waitForLoadState('load', { timeout: 12000 });
          await page.waitForSelector('body[data-rtg-desktop-state="ready"],body[data-public-platform]', { timeout: 12000 });
          row.contentReadyMs = Date.now() - started;
          row.access = await page.evaluate(() => [...document.querySelectorAll('[data-rtg-access]')].some(e =>
            e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'));
          if (route === '/apps/reisuitnodiging.html') {
            await require('./lib/desktop-guest')(page, row, errors);
          } else {
          if (!row.access) await page.waitForSelector('.rtg-adaptive-bar', { timeout: 12000 });
          row.edgeReadyMs = Date.now() - started;
          // Verify media the screen actually promises. A public pass uses a
          // gradient and Explore is a product index; neither invents a photo.
          row.media = row.access ? { kind:'access-portal', required:false,
            reason:'Account access is intentionally image-free and owns the viewport before authentication.' } : await page.evaluate(() => {
            if (!document.body.dataset.publicPlatform) return { kind:'native-world-media', selector:'.wp-atmosphere img,.wp-photo>img', required:true };
            if (document.querySelector('.pp-feature')) return { kind:'public-story-photo', selector:'.pp-feature-photo', required:true };
            if (document.querySelector('.pp-detail-shell')) {
              const hero = document.querySelector('.world-hero');
              const image = getComputedStyle(document.body).getPropertyValue('--world-image').trim();
              if (hero && /^url\(/.test(image)) return { kind:'public-world-photo', selector:'.world-hero .wp-photo>img', required:true };
              return { kind:hero ? 'public-pass-gradient' : 'public-product-index', required:false,
                reason:hero ? 'The source hero declares a gradient, not a photo.' : 'The source contains a product index, not a photographic hero.' };
            }
            return { kind:'unknown-public-surface', selector:'.pp-feature-photo', required:true };
          });
          if (row.media.required) await page.waitForFunction(selector => {
            const photos = [...document.querySelectorAll(selector)];
            return photos.length > 0 && photos.every(img => img.complete && img.naturalWidth > 0);
          }, row.media.selector, { timeout:12000 });
          // Edge can append styles after DOMContentLoaded; wait for the shared
          // desktop stylesheet to finish applying before measuring its grid.
          if (!row.access) await page.waitForFunction(() => document.body.dataset.rtgShell === 'mobile' || getComputedStyle(document.body).paddingTop === (/^(compact|focus)$/.test(document.body.getAttribute('data-rtg-edge-2-state') || '') ? '0px' : '64px'), null, { timeout: 6000 });
          await page.evaluate(() => document.fonts.ready);
          // Een doorverwijzing of later geladen stylesheet kan alle losse
          // gereed-signalen tussendoor vervangen. Meet één stabiel document;
          // de geometrie-eisen hieronder blijven onverminderd van kracht.
          await page.waitForFunction(() => {
            const b = document.body, shell = document.querySelector('.wd-shell');
            if (!b || !shell || document.readyState !== 'complete') return false;
            const r = shell.getBoundingClientRect();
            const beeld = JSON.stringify([location.href, b.dataset.rtgDesktopState,
              b.getAttribute('data-rtg-edge-2-state'), document.querySelectorAll('.rtg-adaptive-bar').length,
              getComputedStyle(b).paddingTop, r.x, r.y, r.width, r.height]);
            const vorige = window.__rtgAuditStabiel;
            if (!vorige || vorige.beeld !== beeld) { window.__rtgAuditStabiel = { beeld, sinds: performance.now() }; return false; }
            return performance.now() - vorige.sinds >= 300;
          }, null, { timeout: 12000 });
          row.state = await page.evaluate(() => {
            const b = document.body, css = getComputedStyle(b);
            const rect = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,scroll: getComputedStyle(e).overflowY }; };
            const visible = s => [...document.querySelectorAll(s)].some(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
            const heading = [...document.querySelectorAll('#platform-story-title,.wd-home h1,.wd-access h1,h1')]
              .find(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
            return { url: location.pathname, world:b.dataset.rtgWorld, desktop:b.dataset.rtgDesktop, shellMode:b.dataset.rtgShell, layout:b.dataset.rtgLayout, public:b.dataset.publicPlatform,
              access:[...document.querySelectorAll('[data-rtg-access]')].some(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'),
              mobileDecoration:visible('.wd-shell>.wd-greeting,.wd-shell>.wp-tabs,.wd-shell>.wd-people,.wd-shell>.wd-favorites,.wd-shell>.wd-library,.wd-home>.wp-scene,.wp-domain'),
              nativeContent:visible('.wd-home:not([hidden]) main,.wd-home:not([hidden])>*,.wd-access,.wd-focus:not([hidden])'),
              publicDecoration:visible('.wd-shell>.wd-greeting,.wd-shell>.wp-tabs,.wp-edit-images'),
              publicHeader:rect('.pp-header'),
              accessRect:rect('[data-rtg-access]'),
              background:css.backgroundColor, editorialVersion:css.getPropertyValue('--rtg-editorial-version').trim(), headingFont:heading&&getComputedStyle(heading).fontFamily, edgeState:b.getAttribute('data-rtg-edge-2-state'), padding:css.padding, pageScroll:scrollY, scheme:css.colorScheme, shells:document.querySelectorAll('.wd-shell').length,
              edges:[...document.querySelectorAll('.rtg-adaptive-bar')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').length,
              paletteRegions:['.rtg-adaptive-bar','.wk-shell','.hq-shell','.pn-shell','.reisapp'].flatMap(selector => {
                const el = document.querySelector(selector); if (!el || !el.getBoundingClientRect().height) return [];
                return [{selector,background:getComputedStyle(el).backgroundColor,material:getComputedStyle(el).getPropertyValue('--edge-bar-bg').trim()}];
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
          const expectedTop = s.access ? 0 : s.public ? (mobile ? 76 : 88) : (mobile ? 136 : 88) - (/^(compact|focus)$/.test(s.edgeState || '') ? 64 : 0);
          if (!s.access && (!mobile || s.public) && Math.abs(s.shell?.y+s.pageScroll-expectedTop) > 2) row.failures.push('nonstandard-top-inset');
          if (s.access && (!s.accessRect || s.accessRect.y > 64 || s.accessRect.w < 300 || s.accessRect.h < 600)) row.failures.push('access-portal-not-viewport');
          if (mobile && !s.public) {
            if (s.shellMode !== 'mobile' || s.desktop) row.failures.push('desktop-shell-on-mobile');
            if (s.mobileDecoration) row.failures.push('stacked-mobile-shell');
            if (!s.nativeContent) row.failures.push('missing-mobile-content');
          }
          if (mobile && s.public) {
            if (s.publicDecoration) row.failures.push('stacked-public-mobile-shell');
            if (!s.nativeContent || !s.content || s.content.w < 250 || s.content.h < 60) row.failures.push('missing-public-content');
            if (!s.publicHeader || Math.abs(s.publicHeader.h-64) > 2) row.failures.push('nonstandard-public-header');
            if (!s.headingFont || !s.headingFont.includes('Bodoni')) row.failures.push('public-editorial-heading-missing');
          }
          if (s.shells !== 1 || s.edges !== (s.access ? 0 : 1)) row.failures.push('duplicate-or-missing-frame');
          if (s.overflow) row.failures.push('horizontal-overflow');
          if (!s.content || !s.shell || (!s.access && !mobile && (!s.left || !s.right || s.left.w < 100 || s.right.w < 100))) row.failures.push('missing-column');
          else if (!s.access && !mobile) {
            if (Math.abs(s.shell.x-24) > 2 || Math.abs(s.left.w-216) > 2 || Math.abs(s.right.w-280) > 2) row.failures.push('nonstandard-geometry');
            if (s.content.x < s.left.right || s.content.right > s.right.x + 1) row.failures.push('overlapping-columns');
            if (s.content.scroll === 'auto' || s.left.scroll === 'auto' || s.right.scroll === 'auto') row.failures.push('nested-page-scroll');
            if (s.library && Math.max(s.content.bottom,s.right.bottom) > s.library.y+1) row.failures.push('library-overlap');
          }
          const palettes = {living:'rgb(16, 13, 10)',work:'rgb(16, 24, 23)',travel:'rgb(25, 13, 18)',foundation:'rgb(16, 35, 30)'};
          if(s.editorialVersion !== '20261001')row.failures.push('editorial-system-not-loaded');
          if(s.layout !== 'standard')row.failures.push('legacy-layout');
          if (!s.access && s.background !== (s.public ? 'rgb(16, 14, 12)' : palettes[s.world])) row.failures.push('nonstandard-world-palette');
          const cards = {living:'#201912',work:'#192422',travel:'#29171d',foundation:'#19372d'};
          if (!s.public && !s.access) for (const region of s.paletteRegions) {
            const expected = region.selector === '.rtg-adaptive-bar' ? cards[s.world] : palettes[s.world];
            if ((region.selector === '.rtg-adaptive-bar' ? region.material : region.background) !== expected) row.failures.push('nonstandard-inner-palette:'+region.selector);
          }
          }
        } catch (e) { row.failures = [e.message.split('\n')[0]]; }
        row.errors = errors;
        if (errors.length && !row.failures.includes('page-error') && !row.failures.includes('guest-page-error')) row.failures.push('page-error');
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
