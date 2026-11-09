/* Twee echte leveranciersflows op dezelfde DS-schil; geen API-stubs. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten, elevateTier, edgeRahul } = require('./helper');
const { decodeer, PAD } = require('../server/middleware/stijlbundel-rij');
const pw = laadPlaywright(), skip = geenBrowser(pw);
const routes = { service: '/apps/leverancier-service.html', aanvragen: '/apps/leverancier-aanvragen.html' };
let srv, browser, token, lid, aanvraag;
async function post(pad, body, auth) {
  const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(body || {}) });
  const d = await r.json(); assert.equal(r.status, 200, pad + ': ' + JSON.stringify(d)); return d;
}
async function open(route, auth = token, width = 390) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(t => { if (t) localStorage.setItem('rtg_sup_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, auth);
  const page = await ctx.newPage(), fouten = letOpFouten(page, []);
  await page.goto(srv.base + route, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk');
  return { ctx, page, fouten };
}
async function ontwerp(page) {
  const hrefs = await page.evaluate(() => [...document.styleSheets].map(s => s.href).filter(Boolean));
  for (const h of hrefs) {
    const u = new URL(h), paden = u.pathname === PAD ? decodeer(u.searchParams.get('f')) : [u.pathname];
    for (const p of paden) assert.match(p, /^\/(ds|fonts)\//, 'geen erfenisblad: ' + p);
  }
  assert.equal(await page.locator('html').getAttribute('data-ds'), '1');
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const geometrie = await page.evaluate(() => ({
      breed: innerWidth, inhoud: document.documentElement.scrollWidth,
      buiten: [...document.body.querySelectorAll('*')].flatMap(el => {
        const r = el.getBoundingClientRect();
        return r.width && (r.right > innerWidth + 1 || r.left < -1 || el.scrollWidth > el.clientWidth)
          ? [{ tag: el.tagName, id: el.id, klasse: el.className, links: r.left, rechts: r.right,
            eigen: el.clientWidth, inhoud: el.scrollWidth }] : [];
      }).slice(0, 12)
    }));
    assert.ok(geometrie.inhoud <= geometrie.breed, 'geen overloop op ' + width + ': ' + JSON.stringify(geometrie));
  }
  await page.setViewportSize({ width: 390, height: 900 });
}
test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { NODE_ENV: 'test', RTG_DEMO: '1', RTG_AI_UIT: '1', SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const roster = await post('/api/supplier/roster', { code: 'SERENA' });
  const manager = roster.staff.find(s => s.role === 'manager'); assert.ok(manager);
  token = (await post('/api/supplier/login', { code: 'SERENA', staffId: manager.id, pin: '1234' })).token;
  assert.ok(token);
  lid = (await post('/api/auth/register', { name: 'DS Aanvrager', email: 'ds-aanvrager@example.test', phone: '0612345674',
    password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).token;
  assert.ok(lid);
  aanvraag = (await post('/api/mall/aanvraag', { wat: 'Gezichtsbehandeling zaterdag', verdieping: 'beauty', plek: 'Ibiza' }, lid)).aanvraag;
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });
test('Rahul behoudt de legacy-presentatie op hosts met eigen globale CSS', { skip }, async () => {
  const legacyLid = (await post('/api/auth/register', { name: 'Legacy Browserproef', email: 'legacy-presentatie@example.test',
    phone: '0612345678', password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg' })).token;
  const office = (await post('/api/office/login', { code: 'RTG-OFFICE' })).token;
  await elevateTier(srv.base, legacyLid, 'lifestyle', office);
  for (const route of ['/apps/websitestudio.html', '/apps/cellier.html']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    try {
      await ctx.addInitScript(t => {
        localStorage.setItem('rtg_member_token', t);
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, legacyLid);
      const page = await ctx.newPage(), fouten = letOpFouten(page, []);
      await page.goto(srv.base + route, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !!window.RTGRahulTabHelpers && !!window.RTGRahulSession && !!window.RTGRahulApproval);
      async function openRahul() {
        // Editorial V4 draagt de bewust verborgen oude tab aan Edge over.
        // Neem die echte gebruikersroute; force-click is geen bewijs van bereikbaarheid.
        const tab = page.locator('.rtg-rahul-tab');
        const direct = await tab.isVisible();
        const ingang = direct ? tab : page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="ai"]');
        await ingang.waitFor({ state: 'visible' });
        const r = await ingang.boundingBox();
        const stijl = await ingang.evaluate(el => ({ klasse: el.className, hoogte: getComputedStyle(el).height,
          minimum: getComputedStyle(el).minHeight, transform: getComputedStyle(el).transform, html: el.outerHTML }));
        assert.ok(r.width >= 44 && r.height >= 44, route + ': de zichtbare ingang houdt zijn aanraakruimte: ' + JSON.stringify({ r, stijl }));
        if (direct) await tab.click(); else await edgeRahul(page);
      }
      await openRahul();
      await page.locator('.rtg-rahul-page').waitFor({ state: 'visible' });
      for (const width of [390, 820, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const staat = await page.evaluate(() => {
          const werk = document.querySelector('.rtg-rahul-page');
          return { ds: document.documentElement.hasAttribute('data-ds'),
            oud: !!document.querySelector('#rtgRahulTabBasisStijl') && !!document.querySelector('#rtgRahulTabTwinStijl'),
            head: getComputedStyle(werk.querySelector('.rtg-command-head')).display,
            breed: werk.clientWidth, inhoud: werk.scrollWidth };
        });
        assert.equal(staat.ds, false, route + ': geen onterechte DS-promotie');
        assert.equal(staat.oud, true, route + ': de bestaande presentatie blijft actief');
        assert.equal(staat.head, 'grid', route + ': hostheader overschrijft de Rahul-layout niet');
        assert.ok(staat.inhoud <= staat.breed, route + ': Rahul blijft binnen zijn werkruimte op ' + width);
      }
      await page.locator('.rtg-command-form input').fill('Nog niet verzonden');
      await page.locator('.rtg-command-close').click();
      await page.locator('.rtg-rahul-page').waitFor({ state: 'hidden' });
      await openRahul();
      assert.equal(await page.locator('.rtg-command-form input').inputValue(), 'Nog niet verzonden');
      assert.deepEqual(fouten, []);
    } finally { await ctx.close(); }
  }
});
test('gedeelde Rahul-bediening houdt inhoud en bediening bereikbaar op drie formaten', { skip }, async () => {
  const { ctx, page, fouten } = await open(routes.service);
  try {
    await page.waitForFunction(() => !!window.RTGRahulTabHelpers && !!window.RTGRahulSession && !!window.RTGRahulApproval);
    async function openRahul() {
      await page.locator('[data-ds-edge="acties"]').click();
      await page.locator('#dsEdgeBlad').getByRole('button', { name: 'Rahul openen', exact: true }).click();
    }
    await openRahul();
    const werk = page.locator('.rtg-rahul-page');
    await werk.waitFor({ state: 'visible' });
    assert.equal(await page.locator('#rtgRahulTabBasisStijl, #rtgRahulTabTwinStijl').count(), 0, 'DS injecteert geen legacy-presentatie');
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('ds-rahul-eigenaar')), true);
    for (const width of [390, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const maten = await werk.evaluate(el => ({
        breed: el.clientWidth, inhoud: el.scrollWidth,
        inkt: getComputedStyle(el).color,
        veld: el.querySelector('input').getBoundingClientRect().height,
        sluit: el.querySelector('.rtg-command-close').getBoundingClientRect().height,
        context: getComputedStyle(el.querySelector('.rtg-command-context')).display,
        stappen: [...el.querySelectorAll('.rtg-twin-flow > div')].filter(n => getComputedStyle(n).display !== 'none').length
      }));
      assert.ok(maten.inhoud <= maten.breed, 'geen horizontaal verlies op ' + width);
      assert.ok(maten.veld >= 44 && maten.sluit >= 44, 'bereikbare bediening op ' + width);
      assert.notEqual(maten.context, 'none', 'context verdwijnt niet op mobiel');
      assert.equal(maten.stappen, 5, 'ook impact en akkoord blijven zichtbaar');
      if (process.env.RTG_DS_BEELDEN) {
        fs.mkdirSync(process.env.RTG_DS_BEELDEN, { recursive: true });
        await page.screenshot({ path: path.join(process.env.RTG_DS_BEELDEN, 'rahul-' + width + '.png') });
      }
    }
    await page.locator('.rtg-command-form input').fill('Mijn nog niet verzonden vraag');
    await page.locator('.rtg-command-close').click();
    await werk.waitFor({ state: 'hidden' });
    await openRahul();
    await werk.waitFor({ state: 'visible' });
    assert.equal(await page.locator('.rtg-command-form input').inputValue(), 'Mijn nog niet verzonden vraag');
    assert.deepEqual(fouten, []);
  } finally { await ctx.close(); }
});
test('service: echte melding, antwoord en herladen op DS zonder identiteitsvelden', { skip }, async () => {
  const { ctx, page, fouten } = await open(routes.service);
  try {
    await page.waitForSelector('#mStuur'); await ontwerp(page);
    await page.getByLabel('Korte omschrijving').fill('Uitbetaling ontbreekt bij onze zaak');
    await page.selectOption('#mOnderwerp', 'betaling');
    await page.check('#mGeld'); await page.click('#mStuur');
    await page.waitForSelector('#aTekst');
    await page.getByLabel('Uw antwoord aan RTG').fill('Aanvullende gegevens volgen morgen');
    await page.click('#aStuur');
    await page.waitForFunction(() => document.querySelector('#dossier')?.textContent.includes('Aanvullende gegevens volgen morgen'));
    const mijn = await post('/api/supplier/service/mijn', {}, token);
    assert.equal(mijn.zaken.length, 1); assert.equal(mijn.zaken[0].doelgroep, 'zaak');
    await page.reload(); await page.waitForSelector('[data-open]');
    await page.locator('[data-open]').first().click();
    await page.waitForFunction(() => document.querySelector('#dossier')?.textContent.includes('Aanvullende gegevens volgen morgen'));
    assert.deepEqual(fouten, []);
  } finally { await ctx.close(); }
});
test('aanvragen: echte reactie, eigen tekst bijwerken en servergestuurde afhandeling', { skip }, async () => {
  const { ctx, page, fouten } = await open(routes.aanvragen);
  try {
    await page.waitForSelector('.reageer'); await ontwerp(page);
    await page.getByLabel('Wat kunt u bieden?').fill('Zaterdag om 14:00 is mogelijk');
    await page.getByLabel('Prijs in euro').fill('95'); await page.locator('.reageer').click();
    await page.getByRole('button', { name: 'Bijwerken', exact: true }).waitFor();
    await page.getByLabel('Wat kunt u bieden?').fill('Zaterdag om 15:00 is mogelijk');
    await page.getByRole('button', { name: 'Bijwerken', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.mijn')?.textContent.includes('15:00'));
    let d = await post('/api/supplier/mall/aanvragen', {}, token);
    const a = d.aanvragen.find(x => x.id === aanvraag.id);
    assert.equal(a.reacties.filter(x => x.code === 'SERENA').length, 1);
    await post('/api/mall/aanvraag/kies', { id: a.id, versie: a.versie, code: 'SERENA' }, lid);
    await page.reload(); await page.waitForSelector('[data-aanvraag-actie]');
    const buttons = page.locator('[data-aanvraag-actie]');
    for (let i = 0; i < await buttons.count(); i++) assert.match(await buttons.nth(i).getAttribute('class'), /ds-knop/);
    assert.deepEqual(fouten, []);
  } finally { await ctx.close(); }
});
for (const route of Object.values(routes)) {
  test(route + ': zonder leverancierssessie blijft de inloggrens zichtbaar', { skip }, async () => {
    const { ctx, page, fouten } = await open(route, null);
    try {
      await ontwerp(page);
      assert.match(await page.locator('main').innerText(), /meld u eerst aan|log eerst in/i);
      assert.equal(await page.locator('#mStuur, .reageer').count(), 0);
      assert.deepEqual(fouten, []);
    } finally { await ctx.close(); }
  });
}
