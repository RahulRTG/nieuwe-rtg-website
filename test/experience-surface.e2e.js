/* De browser-golden-path van het Experience Platform: een echte Economic
   Proof verschijnt alleen bij de juiste principal; een afspraak gaat via
   preview + menselijke bevestiging naar de autoritatieve agenda en komt daarna
   als zelfstandig verifieerbaar bewijs terug. De server en data zijn per test
   geïsoleerd; dit maakt geen afspraak in een echte ledenomgeving. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties,
  geenBrowser } = require('./helper');

const pw = laadPlaywright();
async function api(base, pad, body, token) {
  const r = await fetch(base + pad, { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {})
  }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

test('Experience surface: Economic Proof en bevestigde actie zijn mobiel zichtbaar en verifieerbaar',
  { skip: geenBrowser(pw) }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-experience-surface-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: tmp,
    RTF_IBAN: '' } });
  let browser;
  try {
    const t = Date.now();
    const reg = await api(base, '/api/auth/register', { name: 'Experience Surface',
      email: 'experience-surface-' + t + '@rtg.test', phone: '06' + String(t).slice(-8),
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
    assert.equal(reg.status, 200);
    const token = reg.body.token;
    const state = await api(base, '/api/state', {}, token);
    const invoice = (state.body.state.invoices || []).find(i => i.status === 'open' &&
      /maandbijdrage|lidmaatschap|jaarbijdrage/i.test(i.desc || ''));
    assert.ok(invoice, 'de golden path heeft een open abonnementsfactuur nodig');
    const betaald = await api(base, '/api/pay', { invoiceId: invoice.id }, token);
    assert.equal(betaald.status, 200, JSON.stringify(betaald.body));

    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(tok => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, token);
    const page = await context.newPage(), fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/rtg.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const b = document.querySelector('.xp-trigger');
      return b && !/Verbinden/.test(b.textContent);
    }, null, { timeout: 15000 });
    await page.click('.xp-trigger');
    await page.waitForSelector('.xp-dialog[open]', { timeout: 5000 });
    await page.waitForSelector('.xp-proofs .xp-proof', { timeout: 5000 });
    const valueProof = await page.textContent('.xp-proofs');
    assert.match(valueProof, /Integriteit bevestigd/);
    assert.match(valueProof, /platform/);
    assert.match(valueProof, /local-fund/);
    assert.match(valueProof, /foundation/);

    await page.click('.xp-quick .xp-action');
    await page.fill('.xp-plan input[name="title"]', 'Premium golden path');
    await page.fill('.xp-plan input[name="date"]', '2026-09-09');
    await page.fill('.xp-plan input[name="time"]', '14:15');
    await page.fill('.xp-plan textarea[name="note"]', 'Browserbewijs');
    await page.click('.xp-plan button[type="submit"]');
    await page.waitForFunction(() => /Bevestig en plan/.test(
      (document.querySelector('.xp-plan button[type="submit"]') || {}).textContent || ''),
    null, { timeout: 5000 });
    assert.match(await page.textContent('.xp-feedback'),
      /Geen betaling of extern bericht/);
    const voor = await api(base, '/api/agenda/mijn-lijst', {}, token);
    assert.equal(voor.body.items.some(i => i.titel === 'Premium golden path'), false,
      'een preview mag nog geen domeinwaarheid maken');

    await page.click('.xp-plan button[type="submit"]');
    await page.waitForSelector('.xp-action-proofs .xp-action-proof', { timeout: 10000 });
    assert.match(await page.textContent('.xp-flash'), /Gepland: Premium golden path/);
    assert.match(await page.textContent('.xp-action-proofs'), /Keten geverifieerd/);
    assert.match(await page.textContent('.xp-action-proofs'), /Premium golden path/);

    const na = await api(base, '/api/agenda/mijn-lijst', {}, token);
    assert.equal(na.body.items.filter(i => i.titel === 'Premium golden path').length, 1);
    const evidence = await api(base, '/api/experience/evidence', { limit: 10 }, token);
    assert.equal(evidence.body.integrity.status, 'VERIFIED');
    assert.equal(evidence.body.integrity.valid, true);
    assert.equal(evidence.body.evidence.filter(e =>
      e.intent && e.intent.id === 'schedule.item.create').length, 1);

    const maat = await page.evaluate(() => {
      const d = document.querySelector('.xp-dialog'), r = d.getBoundingClientRect();
      const laatste = document.querySelector('.xp-action-proofs .xp-action-proof:last-child');
      return { left: r.left, right: r.right, width: innerWidth,
        actionOverflow: laatste ? laatste.scrollWidth - laatste.clientWidth : 0 };
    });
    assert.ok(maat.left >= -1 && maat.right <= maat.width + 1,
      'het mobiele bewijsvenster valt buiten beeld: ' + JSON.stringify(maat));
    assert.ok(maat.actionOverflow <= 1,
      'een bewijsregel loopt horizontaal uit: ' + JSON.stringify(maat));
    assert.deepEqual(fouten, [], 'geen browserfouten in de golden path');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    stop(child);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  }
});
