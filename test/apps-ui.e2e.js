/* Scherm-tests voor de overige vlaggenschip-apps: leverancier, lid en
   backoffice. Elk logt in via een API-token in localStorage (net als de PDA-
   test), opent de app in een echte browser en controleert dat de beveiligde
   hoofdweergave verschijnt (het inlogscherm gaat weg, de app komt op) zonder
   onopgevangen JS-fouten. Zo boot elk scherm aantoonbaar schoon.
   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-e2e-')); }
function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  return null;
}
const pw = laadPlaywright();
async function api(base, pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return (await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) })).json();
}

// Gedeeld stramien: zet tokens/keys in localStorage, open de app, wacht tot het
// inlogscherm weg is en de app-weergave zichtbaar is, en eis geen JS-fouten.
async function bootTest(opts) {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const keys = await opts.tokens(base); // { rtg_sup_token: '...', ... }
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const paginaFouten = [];
    page.on('pageerror', e => paginaFouten.push(e.message));
    await page.addInitScript((kv) => {
      for (const k in kv) localStorage.setItem(k, kv[k]);
      localStorage.setItem('rtg_lang', 'nl');
    }, keys);
    await page.goto(base + opts.pad, { waitUntil: 'load' });
    await page.waitForSelector('#gate', { state: 'hidden', timeout: 15000 });
    await page.waitForSelector('#app', { state: 'visible', timeout: 5000 });
    if (opts.na) await opts.na(page);
    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
}

test('Leverancier-app: de zaak-backoffice komt beveiligd op',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  await bootTest({
    pad: '/apps/leverancier.html',
    tokens: async (base) => {
      const roster = await api(base, '/api/supplier/roster', { code: 'KIKUNOI' });
      const man = roster.staff.find(x => x.role === 'manager');
      const login = await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' });
      assert.ok(login.token, 'manager-login geeft een token');
      return { rtg_sup_token: login.token };
    }
  });
});

test('Leden-app: de eigen pas komt beveiligd op na herstel van de sessie',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  await bootTest({
    pad: '/apps/app.html?pas=business',
    tokens: async (base) => {
      const reg = await api(base, '/api/auth/register', { name: 'Lid Een', email: 'appboot@x.nl', phone: '0612345788',
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
      assert.ok(reg.token, 'lid-registratie geeft een token');
      return { rtg_member_token: reg.token };
    }
  });
});

test('Verbinding: de offline-banner verschijnt bij verbindingsverlies en verdwijnt weer',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(base + '/apps/personeel.html', { waitUntil: 'load' });
    // offline -> de banner schuift in beeld met een melding
    await context.setOffline(true);
    await page.waitForFunction(() => {
      const b = document.getElementById('rtg-net-banner');
      return !!(b && /translateY\(0/.test(b.style.transform) && b.textContent.length > 0);
    }, undefined, { timeout: 8000 });
    // weer online -> de banner schuift weg
    await context.setOffline(false);
    await page.waitForFunction(() => {
      const b = document.getElementById('rtg-net-banner');
      return !!(b && /-100/.test(b.style.transform));
    }, undefined, { timeout: 8000 });
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('Backoffice: het RTG-kantoor komt beveiligd op met de eigen code',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  await bootTest({
    pad: '/apps/backoffice.html',
    tokens: async (base) => {
      const login = await api(base, '/api/office/login', { code: 'RTG-OFFICE' });
      assert.ok(login.token, 'kantoor-login geeft een token');
      return { rtg_office_token: login.token };
    }
  });
});
