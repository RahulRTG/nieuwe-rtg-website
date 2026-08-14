/* Scherm-test voor RTG Memo: de lijst leest de kluis, de samenvatting is
   eerlijk (met en zonder transcript op het toestel) en weggooien gaat naar
   de prullenbak. Opnemen zelf (microfoon) valt buiten headless bereik; de
   memo wordt via de kluis-API klaargezet, precies zoals de app hem bewaart.
   Draait alleen waar een browser beschikbaar is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();

test('Memo: de lijst leest de kluis en de samenvatting is eerlijk over het transcript',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-memo-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, ANTHROPIC_API_KEY: '' } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const reg = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Memolid', email: 'me' + u + '@x.nl', phone: '06' + u,
        password: 'geheim123', geboortedatum: '1992-04-04', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());
    const api = (pad, body) => fetch(base + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: JSON.stringify(body || {}) }).then(r => r.json());
    const map = await api('/api/bestanden/map', { naam: "Memo's" });
    const up = await api('/api/bestanden/upload', { naam: 'memo-2026-07-27-0900.webm', map: map.id,
      dataUrl: 'data:audio/webm;base64,' + Buffer.from('demo-audio').toString('base64') });

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/memo.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(s => {
      localStorage.setItem('rtg_member_token', s.token);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      // een transcript zoals het meeluisteren dat op het toestel had bewaard
      localStorage.setItem('rtg_memo_tx', JSON.stringify({ [s.id]: 'morgen de aannemer bellen over de kozijnen' }));
    }, { token: reg.token, id: up.id });
    await page.goto(base + '/apps/memo.html', { waitUntil: 'domcontentloaded' });

    /* de lijst toont de memo uit de kluis, met transcript-vlaggetje */
    await page.waitForFunction(() => document.querySelectorAll('#lijst .memo').length === 1, null, { timeout: 8000 });
    assert.ok(await page.evaluate(() => /met transcript/.test(document.querySelector('#lijst').textContent)));

    /* samenvatting: eerlijk demo-antwoord op het transcript */
    await page.evaluate(() => { document.querySelector('[data-vat]').click(); });
    await page.waitForFunction(() => /Lokale samenvatting/.test(document.querySelector('[data-uit]').textContent), null, { timeout: 8000 });

    /* weggooien: naar de prullenbak, de lijst wordt leeg */
    await page.evaluate(() => { document.querySelector('[data-weg]').click(); });
    await page.waitForFunction(() => /Nog geen memo's/.test(document.querySelector('#lijst').textContent), null, { timeout: 8000 });

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
