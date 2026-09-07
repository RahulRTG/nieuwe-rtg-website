/* Een geïsoleerde server en een aangemelde browser controleren behoud van
   invoer, routecontext en de vaste bediening bij trage of ontbrekende bronnen. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  browserOpties, geduld, laadPlaywright, postJson, startServer, stop
} = require('./helper');

const KEY = '.rtg-edge-action > [data-rtg-continue-key]';
const WIDTHS = [320, 390, 768, 1024, 1440, 1920];

async function ready(page, memory = false) {
  await page.waitForFunction(needsMemory => {
    return document.body.getAttribute('data-rtg-world-start') !== 'loading' && document.body.getAttribute('data-rtg-edge-2-rendered') === 'true' &&
      !!window.RTGContinueKey && (!needsMemory || !!window.RTGRouteMemory);
  }, memory, { timeout: geduld(20000) });
  await page.evaluate(() => document.fonts && document.fonts.ready);
}

async function mode(page, value) {
  // Public Edge API; deliberately do not read/write its preference storage.
  assert.equal(await page.evaluate(v => window.RTGEdge2.setState(v), value), true);
  await page.waitForFunction(v => document.body.getAttribute('data-rtg-edge-2-state') === v,
    value, { timeout: geduld(6000) });
}

async function visibleKey(page) {
  await page.waitForSelector(KEY, { state: 'visible', timeout: geduld(10000) });
}

async function bounds(page, selector) {
  return page.$eval(selector, el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
}

function equalBounds(actual, expected, label) {
  for (const key of ['x', 'y', 'width', 'height'])
    assert.ok(Math.abs(actual[key] - expected[key]) <= .25,
      label + ': ' + key + ' changed from ' + expected[key] + ' to ' + actual[key]);
}

test('Heritage Intelligence: input, route context and stable reachable controls', async t => {
  const pw = laadPlaywright();
  assert.ok(pw && browserOpties(pw), 'A working Chromium is required; this regression may not skip.');
  const server = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const login = await postJson(server.base)('/api/auth/login', {
      login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business'
    });
    assert.ok(login && login.token, 'The isolated server must provide a real member session.');
    browser = await pw.chromium.launch(browserOpties(pw));

    async function withPage(width, fn, extra = {}) {
      const context = await browser.newContext({
        viewport: { width, height: width <= 390 ? 844 : 1000 },
        serviceWorkers: 'block', ...extra
      });
      await context.addInitScript(token => {
        localStorage.setItem('rtg_cookieinfo_v1', '1');
        localStorage.setItem('rtg_member_token', token);
        localStorage.setItem('rtg_lang', 'nl');
      }, login.token);
      const page = await context.newPage();
      try { await fn(page, context); } finally { await context.close(); }
    }

    await t.test('Agenda Plan preserves its full text when offline', async () => {
      await withPage(390, async (page, context) => {
        await page.goto(server.base + '/apps/agenda.html', { waitUntil: 'domcontentloaded' });
        await ready(page);
        await page.waitForFunction(() => document.querySelector('#periode').textContent.trim());
        const opdracht = 'Lunch met de notaris vrijdag om 12:30, bespreek de overdracht.';
        await page.fill('#rahulIn', opdracht);
        const before = await page.textContent('#melding');
        await context.setOffline(true);
        assert.equal(await page.evaluate(() => navigator.onLine), false);
        await page.click('#rahulBtn');
        await page.waitForFunction(old => {
          const text = document.querySelector('#melding').textContent.trim();
          return text && text !== old;
        }, before, { timeout: geduld(6000) });
        assert.equal(await page.inputValue('#rahulIn'), opdracht, 'Failed Plan must retain the exact input.');
        const status = await page.textContent('#melding');
        assert.match(status, /niet|mislukt|verbinding|opnieuw|bereikbaar|offline|fout/i);
        assert.doesNotMatch(status, /ingepland|aangemaakt|opgeslagen|bevestigd/i);
        assert.equal(await page.isEnabled('#rahulBtn'), true, 'Retry must remain possible.');
        await context.setOffline(false);
      });
    });

    await t.test('A non-JSON 503 cannot close an Agenda draft or report a save', async () => {
      await withPage(390, async page => {
        await page.goto(server.base + '/apps/agenda.html', { waitUntil: 'domcontentloaded' });
        await ready(page);
        await visibleKey(page);
        await page.click(KEY);
        await page.waitForSelector('#afScrim.open', { state: 'visible' });
        const title = 'Bewaar dit concept exact';
        const note = 'Bron niet bereikbaar; niets als bevestigd presenteren.';
        await page.fill('#afTitel', title);
        await page.fill('#afNotitie', note);
        let requests = 0;
        await page.route('**/api/agenda/bewaar', route => {
          requests++;
          return route.fulfill({ status: 503, contentType: 'text/html', body: '<h1>Source unavailable</h1>' });
        });
        const before = await page.textContent('#melding');
        await page.click('#afBewaar');
        await page.waitForFunction(old => {
          const text = document.querySelector('#melding').textContent.trim();
          return text && text !== old;
        }, before, { timeout: geduld(6000) });
        assert.equal(requests, 1, 'One click must attempt one save.');
        assert.equal(await page.isVisible('#afScrim.open'), true, 'The unsaved form stays open.');
        assert.equal(await page.inputValue('#afTitel'), title);
        assert.equal(await page.inputValue('#afNotitie'), note);
        assert.doesNotMatch((await page.textContent('#melding')).trim(), /^(Bewaard|Opgeslagen|Bevestigd)[.!]?$/i);
        assert.equal(await page.isEnabled('#afBewaar'), true);
      });
    });

    await t.test('A missing save receipt keeps the draft and the action stays in place', async () => {
      await withPage(390, async page => {
        await page.goto(server.base + '/apps/agenda.html', { waitUntil: 'domcontentloaded' });
        await ready(page); await visibleKey(page); await page.click(KEY);
        await page.waitForSelector('#afScrim.open');
        await page.fill('#afTitel', 'Concept zonder bronbevestiging');
        await page.locator('#afBewaar').scrollIntoViewIfNeeded();
        let release;
        await page.route('**/api/agenda/bewaar', async route => {
          await new Promise(resolve => { release = resolve; });
          await route.fulfill({status:200,contentType:'application/json',body:'{}'});
        });
        const before = await bounds(page, '#afBewaar');
        await page.click('#afBewaar');
        await page.waitForFunction(() => document.querySelector('#afBewaar').dataset.rtgActionState === 'pending');
        equalBounds(await bounds(page, '#afBewaar'), before, 'pending action');
        assert.equal(await page.isDisabled('#afBewaar'), true);
        while (!release) await new Promise(resolve => setTimeout(resolve, 10));
        release();
        await page.waitForFunction(() => document.querySelector('#afBewaar').dataset.rtgActionState === 'error');
        equalBounds(await bounds(page, '#afBewaar'), before, 'failed action');
        assert.equal(await page.inputValue('#afTitel'), 'Concept zonder bronbevestiging');
        assert.equal(await page.isVisible('#afScrim.open'), true);
        assert.match(await page.textContent('#melding'), /Geen bevestiging/);
      }, {reducedMotion:'reduce'});
    });

    await t.test('Edits entered during a slow successful save stay in the open draft', async () => {
      await withPage(390, async page => {
        await page.goto(server.base + '/apps/agenda.html',{waitUntil:'domcontentloaded'}); await ready(page); await visibleKey(page); await page.click(KEY);
        await page.waitForSelector('#afScrim.open'); await page.fill('#afTitel','Oorspronkelijke titel');
        let release;
        await page.route('**/api/agenda/bewaar',async route=>{
          await new Promise(resolve=>{release=resolve;});
          await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,id:'slow-save-fixture'})});
        });
        await page.click('#afBewaar');
        await page.fill('#afTitel','Nieuw getypte titel tijdens bewaren');
        while(!release)await new Promise(resolve=>setTimeout(resolve,10));
        release();
        await page.waitForFunction(()=>document.querySelector('#melding').textContent.includes('nieuwe wijzigingen'));
        assert.equal(await page.isVisible('#afScrim.open'),true);
        assert.equal(await page.inputValue('#afTitel'),'Nieuw getypte titel tijdens bewaren');
        assert.equal(await page.isEnabled('#afBewaar'),true);
      });
    });

    await t.test('Pinned actions keep their three explicit slots after navigation', async () => {
      await withPage(1440, async page => {
        await page.goto(server.base + '/apps/agenda.html', {waitUntil:'domcontentloaded'}); await ready(page);
        await page.click('.rtg-edge-menu'); await page.click('.rtg-action-dock summary');
        const ids = await page.locator('.rtg-action-dock select').first().evaluate(el => [...el.options].map(o=>o.value).filter(Boolean).slice(0,2));
        assert.equal(ids.length,2);
        await page.selectOption('.rtg-action-dock [data-slot="0"]', ids[0]);
        await page.selectOption('.rtg-action-dock [data-slot="2"]', ids[1]);
        const links = await page.locator('.rtg-action-dock-slots > div').evaluateAll(els=>els.map(e=>e.querySelector('a')?.getAttribute('href') || null));
        assert.equal(links[1],null);
        await page.goto(server.base + '/apps/rtg.html', {waitUntil:'domcontentloaded'}); await ready(page);
        await page.click('.rtg-edge-menu');
        assert.deepEqual(await page.locator('.rtg-action-dock-slots > div').evaluateAll(els=>els.map(e=>e.querySelector('a')?.getAttribute('href') || null)),links);
        await page.keyboard.press('Escape'); await page.click('.rtg-edge-state');
        await page.click('.rtg-edge-density [data-density="compact"]');
        await page.reload({waitUntil:'domcontentloaded'}); await ready(page,true);
        await page.waitForFunction(()=>document.body.dataset.rtgDensity==='compact');
      });
    });

    await t.test('The map remains a native canvas in Compact and Focus', async () => {
      await withPage(390, async page => {
        await page.goto(server.base + '/apps/navigatie.html', {waitUntil:'domcontentloaded'}); await ready(page);
        assert.equal(await page.getAttribute('body','data-rtg-edge-2-state'),'compact');
        await page.waitForSelector('#kaart[data-rtg-native-canvas]');
        await page.locator('.rtgplek .nee').click();
        await page.evaluate(()=>{window.__canvasResizes=0;window.addEventListener('resize',()=>window.__canvasResizes++);});
        await page.click('.rtg-edge-menu');
        await page.click('.rtg-edge-preferences-open');
        await page.click('[data-edge-2-mode="focus"]');
        await page.waitForFunction(()=>window.__canvasResizes>0);
        const r=await bounds(page,'#kaart');
        assert.ok(Math.abs(r.x)<1 && Math.abs(r.y)<1);
        assert.ok(Math.abs(r.width-390)<1 && Math.abs(r.height-844)<1);
        assert.equal(await page.locator('.rtg-edge-chrome').count(),1);
        await page.click('.rtg-edge-2-reveal');
        await page.waitForFunction(()=>document.body.getAttribute('data-rtg-edge-2-state')==='overview');
      });
    });

    await t.test('Workspace pins keep its live workbooks and each area keeps its world', async () => {
      await withPage(1440, async page => {
        for (const [area,world] of [['reizen','travel'],['living','living'],['foundation','foundation'],['kantoor','work']]) {
          await page.goto(server.base + '/apps/werkruimte.html?gebied=' + area, {waitUntil:'domcontentloaded'}); await ready(page);
          assert.deepEqual(await page.evaluate(()=>[document.body.dataset.rtgWorld,window.RTGEdge.active.key]),[world,world]);
        }
        await page.click('.rtg-edge-menu'); await page.click('.rtg-action-dock summary');
        const id=await page.locator('.rtg-action-dock select').first().evaluate(el=>[...el.options].find(o=>/agenda/i.test(o.textContent)).value);
        await page.selectOption('.rtg-action-dock [data-slot="0"]',id);
        const address=page.url();
        await page.locator('.rtg-action-dock-slots a').first().click();
        await page.waitForFunction(()=>document.querySelector('.rtg-edge-menu').getAttribute('aria-expanded')==='false');
        assert.equal(page.url(),address,'A pinned function must stay in the existing workspace.');
        assert.ok(await page.locator('iframe[src*="agenda"]').count(),'Agenda must open as a real workbook.');
      });
    });

    await t.test('A late Foundation world shell joins the one Edge context', async () => {
      await withPage(390, async page => {
        await page.goto(server.base + '/apps/foundation/speeltuin.html', {waitUntil:'domcontentloaded'}); await ready(page);
        await page.waitForSelector('.rtg-edge-2-context-slot .ws-balk', {state:'attached'});
        assert.equal(await page.locator('body > .ws-balk').count(),0);
        await page.click('.rtg-edge-menu'); await page.click('.rtg-edge-preferences-open');
        await page.click('[data-edge-2-mode="overview"]');
        await page.waitForFunction(()=>document.body.getAttribute('data-rtg-edge-2-state')==='overview');
      });
    });

    await t.test('Edge mode belongs to its route and survives a real back navigation', async () => {
      await withPage(1440, async page => {
        await page.goto(server.base + '/apps/rtg.html', { waitUntil: 'domcontentloaded' });
        await ready(page, true);
        await mode(page, 'compact');
        await page.goto(server.base + '/apps/agenda.html', { waitUntil: 'domcontentloaded' });
        await ready(page, true);
        await mode(page, 'overview');
        await page.goBack({ waitUntil: 'domcontentloaded' });
        await ready(page, true);
        assert.equal(new URL(page.url()).pathname, '/apps/rtg.html');
        await page.waitForFunction(() => document.body.getAttribute('data-rtg-edge-2-state') === 'compact');
        await page.goForward({ waitUntil: 'domcontentloaded' });
        await ready(page, true);
        assert.equal(new URL(page.url()).pathname, '/apps/agenda.html');
        assert.equal(await page.getAttribute('body', 'data-rtg-edge-2-state'), 'overview');
      });
    });

    await t.test('The Continue position dialog closes for Focus and does not reappear', async () => {
      await withPage(390, async page => {
        await page.goto(server.base + '/apps/agenda.html', { waitUntil: 'domcontentloaded' });
        await ready(page);
        await visibleKey(page);
        await page.focus(KEY);
        await page.keyboard.press('Shift+F10');
        await page.waitForSelector('.rtg-continue-key-picker:not([hidden])', { state: 'visible' });
        await page.click('[data-rtg-key-place="links"]');
        assert.equal(await page.getAttribute(KEY, 'data-rtg-key-anchor'), 'links');
        assert.equal(await page.$eval(KEY, el => el === document.activeElement), true);
        await page.keyboard.press('Shift+F10');
        await page.waitForSelector('.rtg-continue-key-picker:not([hidden])', { state: 'visible' });
        await mode(page, 'focus');
        await page.waitForFunction(() => document.querySelector('.rtg-continue-key-picker').hidden);
        assert.equal(await page.getAttribute(KEY, 'aria-expanded'), 'false');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.body.getAttribute('data-rtg-edge-2-state') === 'overview');
        assert.equal(await page.$eval('.rtg-continue-key-picker', el => el.hidden), true);
        assert.equal(await page.getAttribute(KEY, 'aria-expanded'), 'false');
        assert.equal(await page.getAttribute(KEY, 'data-rtg-key-anchor'), 'links');
      });
    });

    await t.test('Desktop buttons keep the same hit rectangle throughout hover', async () => {
      await withPage(1440, async page => {
        await page.goto(server.base + '/apps/rtg.html', { waitUntil: 'domcontentloaded' });
        await ready(page);
        await visibleKey(page);
        await mode(page, 'overview');
        await page.waitForFunction(() => !document.getAnimations || document.getAnimations().every(animation =>
          animation.playState !== 'running' || animation.effect.getComputedTiming().iterations === Infinity),
        null, { timeout: geduld(6000) });
        for (const selector of [KEY, '.rtg-dashboard-hero-cta', '[data-paneel="alles"]']) {
          await page.mouse.move(2, 500);
          const before = await bounds(page, selector);
          await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
          const samples = await page.$eval(selector, async el => {
            const values = [];
            for (let i = 0; i < 20; i++) {
              await new Promise(requestAnimationFrame);
              const r = el.getBoundingClientRect();
              values.push({ x: r.x, y: r.y, width: r.width, height: r.height });
            }
            return values;
          });
          samples.forEach(sample => equalBounds(sample, before, selector));
        }
      });
    });

    for (const width of WIDTHS) await t.test('Visible Edge controls are at least 44px at ' + width, async () => {
      await withPage(width, async page => {
        await page.goto(server.base + '/apps/rtg.html', { waitUntil: 'domcontentloaded' });
        await ready(page);
        await mode(page, 'overview');
        await visibleKey(page);
        const result = await page.evaluate(() => {
          const nodes = [...document.querySelectorAll('.rtg-edge-chrome button,.rtg-edge-chrome a[href],.rtg-edge-chrome input,.rtg-edge-chrome select')];
          const visible = nodes.filter(el => {
            const r = el.getBoundingClientRect(), s = getComputedStyle(el);
            return !el.hidden && s.display !== 'none' && s.visibility !== 'hidden' &&
              Number(s.opacity) !== 0 && r.width > 0 && r.height > 0 &&
              r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
          });
          return {
            count: visible.length,
            small: visible.filter(el => {
              const r = el.getBoundingClientRect();
              return r.width < 43.99 || r.height < 43.99;
            }).map(el => {
              const r = el.getBoundingClientRect();
              return { tag: el.tagName, name: el.getAttribute('aria-label') || el.textContent.trim(),
                width: r.width, height: r.height };
            }),
            shells: document.querySelectorAll('.rtg-edge-chrome').length,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
          };
        });
        assert.ok(result.count >= 4, 'The test must inspect actual visible controls.');
        assert.deepEqual(result.small, [], width + 'px controls below 44px: ' + JSON.stringify(result.small));
        assert.equal(result.shells, 1, 'Only one navigation shell may exist.');
        assert.ok(result.overflow <= 1, 'The shell may not force horizontal page overflow.');
      });
    });
    await t.test('Edge auto follows a human scroll, never a scroll made by the software', async () => {
      await withPage(1280, async page => {
        await page.goto(server.base + '/apps/mall.html', { waitUntil: 'domcontentloaded' });
        await ready(page);
        await page.waitForFunction(() => document.body.getAttribute('data-rtg-edge-2-auto') === 'true' &&
          document.body.getAttribute('data-rtg-edge-2-state') === 'overview' &&
          document.documentElement.scrollHeight > innerHeight * 3, null, { timeout: geduld(10000) });
        /* The software scrolls (scrollIntoView, an anchor, a focus move): the stand
           stays. Otherwise the top rail collapses, the body loses 44px of padding
           and a tap that aimed at a button lands on what stood below it --
           test/appstore.e2e.js saw exactly that on "Inkoopdossier". */
        await page.evaluate(() => window.scrollTo(0, 900));
        await page.waitForFunction(() => Math.round(scrollY) === 900);
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
        assert.equal(await page.evaluate(() => document.body.getAttribute('data-rtg-edge-2-state')), 'overview',
          'a programmatic scroll may not collapse the rail');
        assert.equal(await page.evaluate(() => getComputedStyle(document.body).paddingTop), '44px',
          'and the page keeps its top inset, so nothing moves under a finger');
        // A human scrolls down: compact. Up again: overview.
        await page.mouse.move(640, 500);
        await page.mouse.wheel(0, 600);
        await page.waitForFunction(() => document.body.getAttribute('data-rtg-edge-2-state') === 'compact', null, { timeout: geduld(6000) });
        await page.mouse.wheel(0, -400);
        await page.waitForFunction(() => document.body.getAttribute('data-rtg-edge-2-state') === 'overview', null, { timeout: geduld(6000) });
      });
    });
  } finally {
    if (browser) await browser.close();
    await stop(server.child);
  }
});
