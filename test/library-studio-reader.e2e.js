'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stopHard, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { alleenDs, geenOverloop } = require('./lib/ds-toets');
const pw = laadPlaywright();

async function beeld(page, naam) {
  if (!process.env.RTG_LIBRARY_EVIDENCE_DIR) return;
  fs.mkdirSync(process.env.RTG_LIBRARY_EVIDENCE_DIR, { recursive: true });
  await page.screenshot({ path: path.join(process.env.RTG_LIBRARY_EVIDENCE_DIR, naam + '.png'), fullPage: true });
}

async function bereikbaarheid(page) {
  const concept = await page.locator('#node-content').inputValue();
  const basisMaat = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  for (const width of [390, 820, 1440]) for (const tekst of [100, 200]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(n => { document.documentElement.style.fontSize = n + '%'; }, tekst);
    await page.evaluate(() => document.fonts.ready);
    const tekstMaat = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    assert.ok(Math.abs(tekstMaat - basisMaat * tekst / 100) < .1, 'werkelijke tekstmaat ' + tekstMaat + ' bij ' + tekst + '%');
    const wereld = await page.evaluate(() => {
      const css = getComputedStyle(document.body);
      return { route: window.RTGWorldIdentity.classify(location.href), body: document.body.dataset.rtgWorld,
        accent: css.getPropertyValue('--ds-accent').trim(), foundation: css.getPropertyValue('--ds-p-nachtblauw').trim() };
    });
    assert.equal(wereld.route, 'foundation'); assert.equal(wereld.body, 'foundation');
    assert.ok(wereld.foundation && wereld.accent === wereld.foundation, JSON.stringify(wereld));
    await alleenDs(page); await geenOverloop(page);
    assert.equal(await page.locator('.wd-shell').count(), 1, 'één bestaande werkruimte');
    for (const [id, selector] of [['rail', '#new-title'], ['main', '#node-content'], ['side', '#release']]) {
      const knop = page.locator('[data-tab="' + id + '"]');
      if (await knop.isVisible()) {
        await knop.focus(); await page.keyboard.press('Enter');
        assert.equal(await knop.getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('[data-tab][aria-pressed="true"]').count(), 1);
      }
      const paneel = page.locator('#' + id), control = page.locator(selector);
      assert.equal(await paneel.isVisible(), true, id + ' bereikbaar bij ' + width + '/' + tekst);
      await control.focus(); assert.equal(await control.evaluate(el => el === document.activeElement), true);
      await control.click({ trial: true });
      const geometry = await paneel.evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth,
        buttons: [...el.querySelectorAll('button')].filter(b => b.getClientRects().length).map(b => ({ id: b.id, w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height })) }));
      assert.ok(geometry.scroll <= geometry.client + 1, JSON.stringify({ width, tekst, id, geometry }));
      assert.ok(geometry.buttons.every(b => b.w >= 44 && b.h >= 44), JSON.stringify({ width, tekst, id, geometry }));
      assert.equal(await page.locator('#node-content').inputValue(), concept, 'paneel- en formaatwissels behouden hetzelfde concept');
      const spring = page.locator('.ds-basis__spring');
      await spring.focus(); await page.keyboard.press('Enter');
      assert.equal(await spring.evaluate(el => el.hash === '#libraryContent' && document.activeElement === document.getElementById('libraryContent') && document.activeElement.getClientRects().length > 0), true, 'de springlink focust zichtbare Library-inhoud');
      if (tekst === 100 && width !== 820) await beeld(page, 'library-' + width + '-' + id);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
  await page.locator('[data-tab="main"]').click();
}

test('LibraryOS-scherm: Work naar Edition 1, lezen, feedback, correctie en Edition 2',
  { skip: geenBrowser(pw), timeout: 90000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-library-ui-'));
  let srv, browser;
  t.after(async () => { if (srv) await stopHard(srv.child); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
  srv = await startServer({ env: { RTG_STORE: 'sqlite', RTG_DATA_DIR: dir, DATABASE_URL: '', PG_URL: '', REDIS_URL: '', SMTP_URL: '',
    RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1', RTG_EXTERNE_AI_UIT: '1', LOCAL_AI_URL: '', RTG_PUSH_UIT: '1', VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '' } });
  try {
    const reg = await fetch(srv.base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Library maker', email: 'library-ui@example.test', phone: '0612345678',
        password: 'VeiligWachtwoord123!', geboortedatum: '1990-01-01', tier: 'rtg' }) }).then(r => r.json());
    assert.ok(reg.token);
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'nl-NL', serviceWorkers: 'block', reducedMotion: 'reduce' }), errors = [];
    letOpFouten(page, errors);
    await page.addInitScript(token => { localStorage.setItem('rtg_member_token', token); localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_lang', 'nl'); }, reg.token);
    await page.goto(srv.base + '/apps/library.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /klaar/.test(document.querySelector('#status').textContent));
    await page.waitForFunction(() => document.body.dataset.rtgDesktopState === 'ready' && window.RTGWorldIdentity && document.querySelector('.ds-basis__spring'));
    await page.fill('#new-title', 'Verhalen van de haven'); await page.selectOption('#new-type', 'oral-history');
    await page.click('#create button[type=submit]');
    await page.waitForFunction(() => document.querySelector('#work-title').textContent === 'Verhalen van de haven');
    await page.click('#new-node'); await page.fill('#node-title', 'De eerste overtocht');
    await page.selectOption('#node-kind', 'interview'); await page.fill('#node-content', 'In 1964 voer de boot voor het eerst uit.');
    await page.fill('#node-summary', 'Eerste mondelinge geschiedenis vastgelegd.');
    await bereikbaarheid(page);
    await page.click('#node-form button[type=submit]');
    await page.waitForFunction(() => /Nieuwe inhoudsrevisie/.test(document.querySelector('#status').textContent));
    await page.click('[data-tab=side]');
    for (const id of ['#solo-decision', '#solo-rights', '#solo-foundation']) await page.check(id);
    await page.click('#solo'); await page.waitForFunction(() => /rechten zijn vastgelegd/.test(document.querySelector('#status').textContent));
    await page.click('#release'); await page.waitForFunction(() => /immutable vrijgegeven/.test(document.querySelector('#status').textContent), null, { timeout: 10000 });
    await page.click('[data-read]'); await page.waitForFunction(() => /1964/.test(document.querySelector('#paper').textContent));
    await page.fill('#reader-note', 'Persoonlijke vraag voor later.'); await page.click('#save-note');
    await page.selectOption('#feedback-kind', 'correction');
    await page.fill('#feedback-message', 'Volgens het interview moet dit 1965 zijn.'); await page.click('#send-feedback');
    await page.waitForFunction(() => /feedback is/.test(document.querySelector('#status').textContent));
    await page.click('#close-reader'); await page.click('#show-feedback');
    await page.waitForSelector('[data-choice=accepted]'); await page.click('[data-choice=accepted]');
    await page.waitForFunction(() => document.querySelector('#feedback').textContent.includes('accepted'));
    await page.click('[data-edit]'); await page.fill('#node-content', 'In 1965 voer de boot voor het eerst uit.');
    await page.fill('#node-summary', 'Jaartal gecorrigeerd na lezersfeedback.'); await page.click('#node-form button[type=submit]');
    await page.waitForSelector('[data-resolve]'); await page.click('[data-resolve]');
    await page.waitForFunction(() => document.querySelector('#feedback').textContent.includes('resolved'));
    await page.click('[data-tab=side]'); await page.click('#release');
    await page.waitForFunction(() => document.querySelectorAll('[data-read]').length === 2, null, { timeout: 10000 });

    const post = async (route, body) => fetch(srv.base + route, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token }, body: JSON.stringify(body || {}) }).then(r => r.json());
    const works = await post('/api/library/work/list'), workId = works.works[0].id;
    const work = (await post('/api/library/work/get', { workId })).work;
    const editions = Object.values(work.editions).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    assert.equal(editions.length, 2); assert.match(editions[0].snapshot.content[0].revision.content, /1964/);
    assert.match(editions[1].snapshot.content[0].revision.content, /1965/);
    assert.equal(editions[0].status, 'released'); assert.equal(editions[1].status, 'released');
    assert.equal(Object.values(work.feedback)[0].status, 'resolved');
    await alleenDs(page); await geenOverloop(page);
    if (process.env.RTG_LIBRARY_EVIDENCE_DIR) {
      await beeld(page, 'library-mobile-editions');
      await page.setViewportSize({ width: 1440, height: 1000 }); await page.click('[data-read]');
      await page.waitForFunction(() => /1965/.test(document.querySelector('#paper').textContent));
      await beeld(page, 'library-desktop-reader');
    }
    assert.deepEqual(errors, []);
  } finally { if (browser) await browser.close(); }
});
