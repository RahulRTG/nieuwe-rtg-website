'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright();

test('LibraryOS-scherm: Work naar Edition 1, lezen, feedback, correctie en Edition 2',
  { skip: geenBrowser(pw), timeout: 60000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-library-ui-'));
  const srv = await startServer({ env: { RTG_STORE: 'sqlite', RTG_DATA_DIR: dir, SMTP_URL: '',
    RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1', VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '' } });
  let browser; t.after(() => { stop(srv.child); fs.rmSync(dir, { recursive: true, force: true }); });
  try {
    const reg = await fetch(srv.base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Library maker', email: 'library-ui@example.test', phone: '0612345678',
        password: 'VeiligWachtwoord123!', geboortedatum: '1990-01-01', tier: 'rtg' }) }).then(r => r.json());
    assert.ok(reg.token);
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }), errors = [];
    letOpFouten(page, errors);
    await page.addInitScript(token => { localStorage.setItem('rtg_member_token', token); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, reg.token);
    await page.goto(srv.base + '/apps/library.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /klaar/.test(document.querySelector('#status').textContent));
    await page.fill('#new-title', 'Verhalen van de haven'); await page.selectOption('#new-type', 'oral-history');
    await page.click('#create button[type=submit]');
    await page.waitForFunction(() => document.querySelector('#work-title').textContent === 'Verhalen van de haven');
    await page.click('#new-node'); await page.fill('#node-title', 'De eerste overtocht');
    await page.selectOption('#node-kind', 'interview'); await page.fill('#node-content', 'In 1964 voer de boot voor het eerst uit.');
    await page.fill('#node-summary', 'Eerste mondelinge geschiedenis vastgelegd.'); await page.click('#node-form button[type=submit]');
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
    if (process.env.RTG_LIBRARY_EVIDENCE_DIR) {
      fs.mkdirSync(process.env.RTG_LIBRARY_EVIDENCE_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.RTG_LIBRARY_EVIDENCE_DIR, 'library-mobile-editions.png'), fullPage: true });
      await page.setViewportSize({ width: 1440, height: 1000 }); await page.click('[data-read]');
      await page.waitForFunction(() => /1965/.test(document.querySelector('#paper').textContent));
      await page.screenshot({ path: path.join(process.env.RTG_LIBRARY_EVIDENCE_DIR, 'library-desktop-reader.png'), fullPage: true });
    }
    assert.deepEqual(errors, []);
  } finally { if (browser) await browser.close(); }
});
