'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, postJson, laadPlaywright, browserOpties, geduld } = require('./helper');

test('Heritage context returns through real navigation without writes', async t => {
  const server = await startServer({env:{SMTP_URL:''}}), pw = laadPlaywright();
  let browser;
  try {
    const login = await postJson(server.base)('/api/auth/login', { login:'roellie.i@gmail.com', password:'Imran', pasApp:'business' });
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
    await context.addInitScript(token => { localStorage.setItem('rtg_member_token',token);localStorage.setItem('rtg_cookieinfo_v1','1'); },login.token);
    const page = await context.newPage();
    async function visit(path) {
      await page.goto(server.base + path);
      await page.waitForFunction(() => window.RTGRouteMemory && document.body.getAttribute('data-rtg-world-start') !== 'loading' && document.body.getAttribute('data-rtg-edge-2-rendered') === 'true', null, {timeout:geduld(12000)});
    }
    async function returnTo(path) {
      await page.evaluate(() => window.RTGRouteMemory.save());
      await visit('/apps/bestanden.html');
      await page.goBack();
      await page.waitForFunction(() => window.RTGRouteMemory && document.body.getAttribute('data-rtg-world-start') !== 'loading' && document.body.getAttribute('data-rtg-edge-2-rendered') === 'true');
      assert.ok(page.url().includes(path));
    }
    await t.test('Agenda restores view and selected week', async () => {
      await visit('/apps/agenda.html');
      await page.click('#wWeek');
      await page.waitForFunction(() => document.querySelector('#wWeek').classList.contains('aan'));
      const previous = await page.textContent('#periode');
      await page.click('#volgendeK');
      await page.waitForFunction(value => document.querySelector('#periode').textContent !== value, previous);
      const period = await page.textContent('#periode');
      await returnTo('/apps/agenda.html');
      await page.waitForFunction(value => document.querySelector('#periode').textContent === value,period);
      assert.equal(await page.$eval('#wWeek',el=>el.classList.contains('aan')),true);
    });
    await t.test('Files restore search, sorting and trash without mutations', async () => {
      await visit('/apps/bestanden.html');
      await page.fill('#zoek','rapport'); await page.selectOption('#sorteer','naam'); await page.click('#toonBak');
      await page.evaluate(() => RTGRouteMemory.save());
      await visit('/apps/agenda.html');
      const writes = [];
      page.on('request',request=> { if (/\/api\/bestanden\/(?!mijn(?:\?|$))/.test(request.url())) writes.push(request.url()); });
      await page.goBack();
      await page.waitForFunction(() => document.querySelector('#zoek').value === 'rapport');
      assert.equal(await page.inputValue('#sorteer'),'naam');
      assert.match(await page.textContent('#toonBak'),/Terug/);
      assert.deepEqual(writes,[]);
    });
    await t.test('Living restores its selected tab', async () => {
      await visit('/apps/rtg.html'); await page.click('[data-paneel="mensen"]');
      await returnTo('/apps/rtg.html');
      await page.waitForFunction(() => document.querySelector('[data-paneel="mensen"]').classList.contains('actief'));
    });
    await t.test('Travel restores the selected view and respects a direct address', async () => {
      await visit('/apps/reizen.html');
      await page.evaluate(() => RTGReizen.wisselBlad('reizen',false));
      await returnTo('/apps/reizen.html');
      await page.waitForFunction(() => window.RTGReizen.staat.blad === 'reizen');
      await visit('/apps/reizen.html#taxi');
      await page.waitForFunction(() => RTGReizen.staat.blad === 'taxi');
    });
    await t.test('Work restores audience and respects a direct address', async () => {
      await visit('/apps/kantoor.html'); await page.click('[data-work-kies="ondernemers"]');
      await page.evaluate(() => history.replaceState(null,'',location.pathname));
      await returnTo('/apps/kantoor.html');
      await page.waitForFunction(() => document.body.dataset.workDoelgroep === 'ondernemers');
      await visit('/apps/kantoor.html?doelgroep=personeel');
      assert.equal(await page.getAttribute('body','data-work-doelgroep'),'personeel');
    });
    await t.test('Closed sheets do not block Auto, open sheets trap and return focus', async () => {
      await visit('/apps/agenda.html');
      await page.evaluate(() => document.activeElement.blur());
      await page.mouse.move(200,350);
      assert.equal(await page.evaluate(() => RTGEdge2.isBusy(document,false)),false);
      const key = '.rtg-edge-action>[data-rtg-continue-key]';
      await page.click(key); await page.waitForSelector('#afScrim.open');
      await page.keyboard.press('Escape');
      await page.waitForFunction(selector=>document.activeElement.matches(selector),key);
      assert.equal(await page.getAttribute('#afScrim','aria-modal'),'false');
      /* Maand is op telefoon bewust verborgen; Week is de zichtbare route
         naar dezelfde dagsheet die deze toets nodig heeft. */
      await page.click('#wWeek');
      await page.click('.rtg-edge-state'); await page.click('[data-edge-2-mode="focus"]');
      await page.locator('#kal [data-dag]').first().click();
      await page.waitForSelector('#afScrim.open');
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!document.querySelector('#afScrim').classList.contains('open'));
      assert.equal(await page.getAttribute('body','data-rtg-edge-2-state'),'focus','Escape closes only the sheet, retaining Focus');
      await page.click('.rtg-edge-2-reveal');
    });
    await t.test('Offline source status cannot retain a prior confirmation', async () => {
      await visit('/apps/agenda.html');
      await page.click('.rtg-edge-state');
      await context.setOffline(true);
      await page.waitForFunction(() => document.querySelector('[data-edge-ready]').textContent.includes('Wacht op bron'));
      assert.equal((await page.textContent('[data-edge-network]')).trim(),'Offline');
      for (const field of ['ready','store','ai']) assert.match(await page.textContent('[data-edge-'+field+']'),/Wacht op bron/);
      await context.setOffline(false);
    });
    await context.close();
  } finally { if (browser) await browser.close(); await stop(server.child); }
});
