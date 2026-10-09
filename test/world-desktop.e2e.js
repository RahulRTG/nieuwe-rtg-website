'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser, token, note;
async function post(url, data, auth = token) {
  const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(data || {}) });
  const body = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(body)); return body;
}
async function context(auth = token) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1050 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(token => { localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (token) localStorage.setItem('rtg_member_token', token); }, auth); return ctx;
}
async function open(page, route = '/apps/wereld.html') {
  await page.goto(srv.base + route, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body[data-rtg-desktop]'); await page.waitForSelector('body[data-rtg-adaptive-ready="true"]');
  await page.waitForFunction(() => !document.body.hasAttribute('data-rtg-world-start') || document.body.dataset.rtgWorldStart === 'ready');
}
test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1', RTG_DEMO: '0' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const now = Date.now(); const reg = await post('/api/auth/register', { name: 'Desktop Lid', email: 'desktop-' + now + '@e.test',
    phone: '06' + String(now).slice(-8), password: 'geheim123', geboortedatum: '1980-01-01', tier: 'business', pasApp: 'business' }, null);
  token = reg.token;
  const date = new Date().toLocaleDateString('sv-SE');
  await post('/api/agenda/toevoegen', { titel: 'Eigen afspraak voor desktop', datum: date, tijd: '18:30' });
  await post('/api/notities/bewaar', { titel: 'Desktop taken', soort: 'lijst', items: [{ t: 'Eigen taak voor desktop', af: false }] });
  note = (await post('/api/notities/mijn')).eigen.find(x => x.titel === 'Desktop taken');
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });
// De ster verschijnt pas bij hover of focus op de kaart. Een muisklik zakte in CI
// op die verschijnwissel (scrollen haalde de hover weg); het toetsenbord is de
// stabiele weg en bedient dezelfde knop: focus op de kaart, Tab naar de ster, Enter.
const speld = async (page, id) => {
  await page.locator(`.wd-library [data-widget="${id}"] .wd-widget-open`).focus();
  await page.keyboard.press('Tab');
  await page.waitForFunction(i => document.activeElement && document.activeElement.matches(`.wd-library [data-widget="${i}"] .wd-widget-pin`), id);
  await page.keyboard.press('Enter');
};
test('four desktop worlds use one composition and one Edge; the mobile home stays usable', { skip }, async () => {
  const ctx = await context(null), page = await ctx.newPage(), errors = []; letOpFouten(page, errors);
  try {
    for (const route of ['/apps/rtg.html', '/apps/reizen.html', '/apps/kantoor.html', '/apps/foundation/os-publiek.html']) {
      await open(page, route);
      assert.equal(await page.locator('.wd-people').isVisible(), true);
      assert.equal(await page.locator('.rtg-adaptive-bar').count(), 1);
      if (route !== '/') assert.ok(await page.locator('.wd-world-label').evaluate(e => e.getBoundingClientRect().bottom <= e.closest('header').getBoundingClientRect().bottom));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, route);
      if (route !== '/') assert.match(await page.locator('.wd-people').innerText(), /Meld u aan/);
      if (route.includes('foundation')) assert.match(await page.locator('.wd-people').innerText(), /100% gratis/);
      await page.waitForFunction(() => [...document.querySelectorAll('.wd-favorites .wd-widget-content')]
        .every(el => el.dataset.state !== 'loading'));
      const guestCards = await page.locator('.wd-favorites .wd-widget-content[data-state="guest"]').evaluateAll(nodes => nodes.map(el => ({
        minHeight: getComputedStyle(el).minHeight, height: el.getBoundingClientRect().height,
        repeatedIcon: el.querySelectorAll('.wd-icon').length, repeatedAction: el.querySelectorAll('button').length,
        hasAppAction: !!el.closest('.wd-widget').querySelector('.wd-widget-open'),
        timestamp: el.querySelectorAll('.wd-widget-updated').length
      })));
      for (const card of guestCards) {
        assert.equal(card.minHeight, '0px');
        assert.ok(card.height < 60, route + ': an unauthenticated status is a compact line, not an empty data panel');
        assert.equal(card.repeatedIcon, 0); assert.equal(card.repeatedAction, 0);
        assert.equal(card.hasAppAction, true, 'the original app action remains available');
        assert.equal(card.timestamp, 0, 'an unauthenticated widget cannot claim data was retrieved');
      }
      await page.locator('.wd-library').scrollIntoViewIfNeeded();
      const overlap = await page.evaluate(() => {
        const top = document.querySelector('.wd-library').getBoundingClientRect().top;
        return [...document.querySelectorAll('.wd-favorites')]
          .some(el => el.getBoundingClientRect().bottom > top + 1);
      });
      assert.equal(overlap, false, route + ': the side panels must not cover the library when scrolling');
      await page.evaluate(() => scrollTo(0, 0));
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.locator('.wd-people').isVisible(), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, route + ' mobile');
      await page.setViewportSize({ width: 1440, height: 1050 });
    }
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
test('the workspace context reads the Edge field of view: TravelOS by route', { skip }, async () => {
  /* Ronde 2, stap 23: RTGWorkspaceContext houdt geen eigen staat meer en leest
     het blikveld; op een los wereldbureau komt de wereld uit de route. */
  const ctx = await context(null), page = await ctx.newPage();
  try {
    await open(page, '/apps/reizen.html');
    await page.waitForFunction(() => !!window.RTGEdgeBlikveld && !!window.RTGWorkspaceContext);
    const wereld = await page.evaluate(() => window.RTGWorkspaceContext().get().velden.wereld);
    assert.deepEqual([wereld.waarde, wereld.herkomst], ['travel', 'route']);
  } finally { await ctx.close(); }
});
test('native calendar and task widgets read and change actual persisted records', { skip }, async () => {
  const ctx = await context(), page = await ctx.newPage();
  try {
    await open(page);
    await page.waitForSelector('.wd-favorites [data-widget="agenda"] [data-state="ready"]');
    assert.match(await page.locator('.wd-favorites [data-widget="agenda"]').innerText(), /Eigen afspraak voor desktop/);
    const check = page.locator('.wd-favorites [data-widget="notities"] input[type="checkbox"]').first();
    await check.click();
    await page.waitForFunction(() => document.querySelector('.wd-favorites [data-task-id]')?.checked === true);
    assert.equal((await post('/api/notities/mijn')).eigen.find(x => x.id === note.id).items[0].af, true);
    await post('/api/notities/vink', { id: note.id, index: 0, af: false });
  } finally { await ctx.close(); }
});
test('a widget expands into a real app, preserves input, and delegates controls through the shared Edge', { skip }, async () => {
  const ctx = await context(), page = await ctx.newPage();
  try {
    await open(page); await page.locator('.wd-favorites [data-widget-open="notities"]').click();
    const frame = page.frameLocator('iframe[data-desktop-app="/apps/notities.html"]');
    await frame.locator('#zoek').fill('Mijn eigen zoektekst');
    assert.equal(await frame.locator('.rtg-adaptive-bar').count(), 0);
    await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="context"]').click();
    await page.waitForSelector('[data-desktop-source="nieuwLijst"]');
    await page.locator('[data-desktop-source="nieuwLijst"]').click();
    await frame.locator('#ntTitel').fill('Mijn concept blijft staan');
    await page.setViewportSize({ width:390, height:844 });
    await page.waitForSelector('body[data-rtg-shell="mobile"]');
    await frame.locator('#ntTitel').waitFor({ state:'visible' });
    assert.equal(await frame.locator('#ntTitel').inputValue(), 'Mijn concept blijft staan');
    assert.equal(await page.locator('.wd-home').isVisible(), false, 'the open app is the only mobile surface');
    await page.setViewportSize({ width:1440, height:1050 });
    await page.waitForSelector('body[data-rtg-desktop]');
    await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="home"]').click();
    assert.equal(await page.locator('.wd-home').isVisible(), true);
    await page.evaluate(() => window.RTGi18n.set('en'));
    await page.locator('.wd-favorites [data-widget-open="notities"]').click();
    assert.equal(await frame.locator('#ntTitel').inputValue(), 'Mijn concept blijft staan');
    assert.equal(await frame.locator('#zoek').inputValue(), 'Mijn eigen zoektekst');
    assert.equal(await page.locator('iframe[data-desktop-app="/apps/notities.html"]').count(), 1);
    assert.equal(await page.locator('.wd-people').isVisible(), true);
  } finally { await ctx.close(); }
});
test('unavailable and forbidden widget data are never rendered as an empty confirmed account', { skip }, async () => {
  const ctx = await context(), page = await ctx.newPage();
  try {
    for (const status of [503, 403]) {
      await page.route('**/api/notities/mijn', r => r.fulfill({ status, contentType: 'application/json', body: '{"error":"Unavailable test source"}' }));
      await open(page);
      await page.waitForSelector('.wd-favorites [data-widget="notities"] [data-state="' + (status === 403 ? 'locked' : 'error') + '"]');
      assert.equal(await page.locator('.wd-favorites [data-widget="notities"] input[type="checkbox"]').count(), 0);
      const state = await page.locator('.wd-favorites [data-widget="notities"] .wd-widget-content').evaluate(el => ({
        minHeight: getComputedStyle(el).minHeight, content: el.dataset.contentState,
        timestamp: el.querySelectorAll('.wd-widget-updated').length,
        retry: [...el.querySelectorAll('button')].some(b => b.dataset.i18n === 'widget.retry')
      }));
      assert.equal(state.minHeight, '0px'); assert.equal(state.content, undefined);
      assert.equal(state.timestamp, 0, 'failed or forbidden reads cannot masquerade as retrieved records');
      assert.equal(state.retry, status === 503, 'only a failed read offers the existing retry');
      await page.unroute('**/api/notities/mijn');
    }
  } finally { await ctx.close(); }
});
test('the direct task action opens the original form and a rejected update never checks a task', { skip }, async () => {
  const ctx = await context(), page = await ctx.newPage();
  try {
    await page.route('**/api/notities/vink', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Write failed"}' }));
    await open(page);
    const check = page.locator('.wd-favorites [data-widget="notities"] input[type="checkbox"]').first();
    await check.click();
    await page.waitForSelector('.wd-favorites .wd-widget-warning[role="alert"]');
    assert.equal(await check.isChecked(), false);
    assert.equal((await post('/api/notities/mijn')).eigen.find(x => x.id === note.id).items[0].af, false);
    await page.locator('.wd-favorites [data-widget="notities"] .wd-primary').click();
    const frame = page.frameLocator('iframe[data-desktop-app="/apps/notities.html"]');
    await frame.locator('#ntTitel').fill('Een echte nieuwe lijst');
    assert.equal(await frame.locator('#ntTitel').inputValue(), 'Een echte nieuwe lijst');
  } finally { await ctx.close(); }
});
test('Foundation widgets read the chosen family profile without a paid member account', { skip }, async () => {
  const family = await post('/api/foundation/gezin/maak', { gezinsnaam: 'Desktop gezin', naam: 'Ouder', pin: '1234', bevoegdGezin: true, privacyAkkoord: true }, null);
  await post('/api/foundation/gezin/agenda', { code: family.code, token: family.token, titel: 'Samen wandelen', datum: new Date().toLocaleDateString('sv-SE'), tijd: '16:00' }, null);
  const child = await post('/api/foundation/gezin/profiel/maak', { code: family.code, token: family.token, naam: 'Milan', rol: 'kind', geboortedatum: '2015-04-04', pin: '5678' }, null);
  const chosen = await post('/api/foundation/gezin/profiel/kies', { gezinscode: family.gezinscode, profielId: child.profiel.id, pin: '5678' }, null);
  family.token = chosen.token; family.profiel = chosen.profiel;
  const ctx = await context(null), page = await ctx.newPage();
  await ctx.addInitScript(f => localStorage.setItem('rtf_sessie', JSON.stringify({ code: f.code, token: f.token, profiel: f.profiel })), family);
  try {
    await open(page, '/apps/foundation/index.html');
    await page.waitForSelector('.wd-favorites [data-widget="foundation-agenda"] [data-state="ready"]');
    assert.match(await page.locator('.wd-favorites [data-widget="foundation-agenda"]').innerText(), /Samen wandelen/);
    await page.locator('.wd-app-controls>summary').click();
    await page.locator('#wdSearch').fill('schrijven');
    await speld(page, 'foundation-schrijven');
    for (const id of ['foundation-leren', 'foundation-schrijven']) {
      await page.waitForSelector('.wd-favorites [data-widget="' + id + '"] [data-state="ready"]');
    }
    assert.match(await page.locator('.wp-free').innerText(), /100% gratis/);
    await page.evaluate(() => window.RTGi18n.set('ar'));
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await open(page, '/apps/foundation/agenda.html');
    await page.waitForFunction(() => !document.documentElement.classList.contains('rtf-toegang-dicht'));
    assert.equal(await page.locator('.wd-home').isVisible(), true, 'the authorized family can still use the actual agenda');
  } finally { await ctx.close(); }
});
/* HOME OVERLEEFT EEN HERSTART VAN DE EDGE. Het tweede register begint bij elke
   start leeg en de observer van het bureau koppelt los na de eerste keer, dus
   een 'home' in dat register verdween na destroy() en start(): Home verliet dan
   het document. De haak is nu een annuleerbare gebeurtenis op window, en die
   luisteraar overleeft een herstart omdat hij niet aan het model hangt. */
test('Home on the world desktop survives a restart of the Edge', { skip }, async () => {
  const ctx = await context(), page = await ctx.newPage();
  try {
    for (const route of ['/apps/wereld.html', '/apps/rtg.html', '/apps/kantoor.html', '/apps/reizen.html']) {
      await open(page, route);
      await page.evaluate(() => { window.RTGAdaptiveEdge.destroy(); window.RTGAdaptiveEdge.start(document, window); window.__rtgMerk = route => route; });
      await page.waitForSelector('.rtg-adaptive-bar [data-rtg-adaptive-action="home"]');
      await page.locator('.wd-favorites [data-widget-open="notities"]').click();
      await page.waitForSelector('iframe[data-desktop-app="/apps/notities.html"]');
      assert.equal(await page.locator('.wd-home').isVisible(), false, route + ': the frame is open');
      await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="home"]').click();
      await page.waitForFunction(() => document.querySelector('.wd-home') && getComputedStyle(document.querySelector('.wd-home')).display !== 'none', null, { timeout: 5000 }).catch(() => {});
      assert.equal(await page.evaluate(() => typeof window.__rtgMerk), 'function', route + ': Home left or reloaded the document');
      assert.equal(await page.locator('.wd-home').isVisible(), true, route + ': the frame collapsed');
      assert.equal(await page.locator('.wd-world-label').count(), 1, route + ': the world label stays');
    }
  } finally { await ctx.close(); }
});

test('Vrienden stands in the Foundation library because its world says so, not by exception', { skip }, async () => {
  /* WERELDEN.md: Vrienden moved to FoundationOS on 7 September. The desktop used
     to keep it in this library through a hard-coded url in world-desktop-home.js;
     now the catalogue carries world 'foundation' from the manifest. Remove the
     exception without rebuilding the catalogue and this test fails. */
  const ctx = await context(null), page = await ctx.newPage(), errors = []; letOpFouten(page, errors);
  try {
    await open(page, '/apps/foundation/index.html');
    await page.waitForSelector('.wd-library .wd-catalog [data-widget]');
    await page.locator('.wd-app-controls>summary').click();
    await page.fill('.wd-library #wdSearch', 'Contacten');
    await page.waitForSelector('.wd-library .wd-catalog [data-widget="foundation-vrienden"]', { timeout: 5000 });
    assert.equal(await page.locator('.wd-library .wd-catalog [data-widget="foundation-vrienden"]').count(), 1);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('direct function screens keep their inputs when the common frame changes size', { skip }, async () => {
  const ctx = await context(), page = await ctx.newPage();
  try {
    await open(page, '/apps/notities.html');
    await page.locator('#zoek').fill('Desktop taken');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('#zoek').inputValue(), 'Desktop taken');
    assert.equal(await page.locator('.wd-people').isVisible(), false);
    await page.setViewportSize({ width: 1440, height: 1050 });
    assert.equal(await page.locator('#zoek').inputValue(), 'Desktop taken');
    assert.equal(await page.locator('.wd-shell').count(), 1);
    const expected = 'rgb(16, 13, 10)';
    assert.equal(await page.locator('body').evaluate(e => getComputedStyle(e).backgroundColor), expected);
    // Control experiment: the rendered check detects a wrong pure-black theme.
    await page.addStyleTag({ content: 'body[data-rtg-layout][data-rtg-world][data-rtg-skin][data-rtg-desktop]{background:#000!important}' });
    assert.notEqual(await page.locator('body').evaluate(e => getComputedStyle(e).backgroundColor), expected);
  } finally { await ctx.close(); }
});

test('the Foundation access gate uses the standard while protected controls stay inaccessible', { skip }, async () => {
  const ctx = await context(null), page = await ctx.newPage();
  try {
    await open(page, '/apps/foundation/agenda.html');
    await page.waitForSelector('.wd-access');
    assert.equal(await page.locator('.wd-home').isVisible(), false);
    assert.equal(await page.locator('.wd-home').evaluate(e => e.inert), true);
    assert.equal(await page.locator('.wd-access [data-rtf-wissel]').isVisible(), true);
    assert.equal(await page.locator('.rtg-adaptive-bar').isVisible(), true);
    assert.equal(await page.locator('body').getAttribute('data-rtg-desktop-access'), 'locked');
  } finally { await ctx.close(); }
});

test('a missing catalogue reports failure inside the standard without restoring an old layout', { skip }, async () => {
  const ctx = await context(null), page = await ctx.newPage();
  try {
    await page.route('**/shared/interface/world-widget-catalog.json', r => r.fulfill({ status:503, body:'unavailable' }));
    await page.goto(srv.base + '/apps/agenda.html');
    await page.waitForSelector('body[data-rtg-desktop-state="error"]');
    assert.equal(await page.locator('.wd-shell').count(), 1);
    assert.equal(await page.locator('.wd-home').isVisible(), true);
    assert.match(await page.locator('.wd-announcement').innerText(), /kon niet worden geladen/);
    const x = await page.locator('.wd-shell').evaluate(e => e.getBoundingClientRect().x);
    assert.equal(x, 24);
  } finally { await ctx.close(); }
});

test('a shared projector never loads the signed-in member’s personal desktop widgets', { skip }, async () => {
  const ctx = await context(), page = await ctx.newPage(), reads = [];
  page.on('request', r => { if (/\/api\/(?:comm\/|agenda\/|notities\/|member\/connect)/.test(r.url())) reads.push(r.url()); });
  try {
    await page.goto(srv.base + '/apps/spelscherm.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body[data-rtg-desktop][data-rtg-desktop-state="ready"]');
    assert.equal(await page.locator('.wd-shell').count(), 1);
    assert.equal(await page.locator('.wd-widget').count(), 0);
    assert.deepEqual(reads, []);
    assert.equal(await page.locator('.rtg-adaptive-bar').count(), 0,
      'een gedeelde televisie krijgt geen persoonlijke Edge of accountcontext');
  } finally { await ctx.close(); }
});

test('the public website keeps the same side columns when opening existing content', { skip }, async () => {
  const ctx = await context(null), page = await ctx.newPage();
  try {
    await page.goto(srv.base + '/');
    await page.waitForSelector('body[data-public-platform="app"] .wd-shell');
    await page.evaluate(() => window.RTGPublicApp.open('platform'));
    assert.equal(await page.locator('#platform').isVisible(), true);
    assert.equal(await page.locator('.wd-people').isVisible(), true);
    assert.equal(await page.locator('.wd-favorites').isVisible(), true);
    assert.equal(await page.locator('.rtg-adaptive-bar').count(), 1);
    await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="home"]').click();
    assert.equal(await page.locator('.wd-home').isVisible(), true);
  } finally { await ctx.close(); }
});
