/* Scherm-tests voor de overige vlaggenschip-apps: leverancier, lid en
   backoffice. Elk logt in via een API-token in localStorage (net als de PDA-
   test), opent de app in een echte browser en controleert dat de beveiligde
   hoofdweergave verschijnt (het inlogscherm gaat weg, de app komt op) zonder
   onopgevangen JS-fouten. Zo boot elk scherm aantoonbaar schoon.
   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-e2e-')); }
function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  // Geen Playwright-pakket? Onze eigen browser-driver (CDP over pipe), maar alleen als er een Chromium-binary is.
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
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
    letOpFouten(page, paginaFouten);
    await page.addInitScript((kv) => {
      for (const k in kv) localStorage.setItem(k, kv[k]);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
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
    },
    /* Het beginscherm is het OS: de begroeting, de mappen boven de klok, de
       klok zelf, de functierij eronder en de balk van Rahul. De ledenpas
       staat er bewust NIET meer op -- die ligt in de wallet (zie de toets
       hieronder). De reiskaart is verhuisd naar de app Reizen, maar wordt nog
       steeds bij het opstarten gevuld, dus die controleren we hier gewoon. */
    na: async (page) => {
      await page.waitForSelector('#homeGreeting', { timeout: 5000 });
      // de begroeting spreekt de taal van de pas: RTG als vriend, Business
      // zakelijk ("Alles onder controle"), Lifestyle als concierge
      assert.match(await page.textContent('#homeGreeting'),
        /Welkom|goed je te zien|Alles onder controle|Alles staat voor u klaar/i,
        'de begroeting staat er');
      const thuis = await page.evaluate(() => ({
        mappen: document.querySelectorAll('#osMappen .os-app').length,
        functies: [...document.querySelectorAll('#osFuncties .os-app')].map(b => b.getAttribute('aria-label')),
        klok: !!document.querySelector('#homeKlok svg'),
        balk: !!document.querySelector('#osAiBalk #osAiIn'),
        // de vier lagen staan in deze volgorde onder elkaar
        y: ['#osMappen', '.os-klokvak', '#osFuncties', '#osAiBalk']
          .map(s => Math.round(document.querySelector(s).getBoundingClientRect().top))
      }));
      assert.ok(thuis.mappen >= 3, 'er staan mappen met apps boven de klok');
      assert.ok(thuis.klok, 'de ronde RTG-klok staat in het midden');
      assert.ok(thuis.balk, 'de balk van Rahul staat onderaan');
      assert.deepEqual(thuis.functies, ['Bellen', 'Berichten', 'Videobellen', 'Wallet'],
        'onder de klok staan bellen, chat en de wallet');
      assert.deepEqual(thuis.y.slice().sort((a, b) => a - b), thuis.y,
        'de volgorde is mappen, klok, functies, balk');
      assert.ok((await page.textContent('#homeTrip .big')).trim().length > 0, 'de eerstvolgende reis staat er');
    }
  });
});

test('Leden-app: de ledenpas ligt in de wallet, niet meer op het beginscherm',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await api(base, '/api/auth/register', { name: 'Pas Lid', email: 'walletpas@x.nl', phone: '0612345701',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(reg.token, 'lid-registratie geeft een token');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
    await ctx.addInitScript(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_lang', 'nl'); }, reg.token);
    const page = await ctx.newPage();
    await page.goto(base + '/apps/wallet.html', { waitUntil: 'load' });

    await page.waitForSelector('#ledenpas .ledenpas .cn', { timeout: 15000 });
    assert.ok((await page.textContent('#ledenpas .ledenpas .cn')).trim().length > 0,
      'de codenaam staat op de pas in de wallet');
    assert.match(await page.textContent('#ledenpas .ledenpas'), /RTG Pass/,
      'de pas noemt welke pas het is');
    // de QR is echt: hij komt uit onze eigen codec, niet uit een plaatje
    assert.equal(await page.evaluate(() => document.querySelectorAll('#ledenpas .qr canvas').length), 1,
      'er staat een echte QR op de pas');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('Leden-app: in het Engels is de startpagina echt Engels (i18n-dekking)',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await api(base, '/api/auth/register', { name: 'Lid EN', email: 'appen@x.nl', phone: '0612345799',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
    assert.ok(reg.token, 'lid-registratie geeft een token');
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_lang', 'en'); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, reg.token);
    await page.goto(base + '/apps/app.html?pas=business', { waitUntil: 'load' });
    await page.waitForSelector('#gate', { state: 'hidden', timeout: 15000 });
    await page.waitForSelector('#homeGreeting', { timeout: 5000 });
    // de begroeting is via T('app.welcome',...) uit het EN-woordenboek gekomen
    const greet = await page.textContent('#homeGreeting');
    assert.match(greet, /Welcome/i, 'de begroeting is in het Engels');
    assert.doesNotMatch(greet, /Welkom/i, 'er staat geen Nederlands meer in de begroeting');
    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('Leverancier-app: een betaalde bestelling komt bij Orders binnen en wordt doorgezet',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    // manager-token + een keukengerecht op de kaart
    const roster = await api(base, '/api/supplier/roster', { code: 'KIKUNOI' });
    const man = roster.staff.find(x => x.role === 'manager');
    const login = await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' });
    assert.ok(login.token, 'manager-login geeft een token');
    const authHead = tok => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok });
    await fetch(base + '/api/supplier/menu', { method: 'POST', headers: authHead(login.token),
      body: JSON.stringify({ menu: [{ id: 'ramen', name: 'Ramen', price: 12, station: 'keuken', cat: 'Warm' }] }) });

    // een lid bestelt aan tafel 3 en betaalt (dan pas ziet de zaak het)
    const reg = await api(base, '/api/auth/register', { name: 'Kassa Lid', email: 'kassa@x.nl', phone: '0612345001',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
    const ord = await (await fetch(base + '/api/order', { method: 'POST', headers: authHead(reg.token),
      body: JSON.stringify({ supplierCode: 'KIKUNOI', items: [{ id: 'ramen', qty: 1 }], table: 'Tafel 3' }) })).json();
    assert.ok(ord.order && ord.order.ref, 'de bestelling is aangemaakt');
    const betaald = await (await fetch(base + '/api/order/pay', { method: 'POST', headers: authHead(reg.token),
      body: JSON.stringify({ ref: ord.order.ref }) })).json();
    assert.ok(betaald.ok, 'de bestelling is betaald');
    const ref = ord.order.ref;

    // de leverancier opent de app en gaat via Meer naar Orders
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript(t => { localStorage.setItem('rtg_sup_token', t); localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, login.token);
    await page.goto(base + '/apps/leverancier.html', { waitUntil: 'load' });
    await page.waitForSelector('#app.active', { timeout: 15000 });
    // het Werk-OS: alle functies staan als apps op het springboard; de zaak
    // opent (na de sector-doorverwijzing) op het startscherm met dock
    // a11y: de actieve app meldt zich als actief aan de schermlezer
    await page.waitForSelector('.wos-dock button[data-tab="home"]', { state: 'visible', timeout: 10000 });
    assert.equal(await page.getAttribute('.wos-dock button[data-tab="home"]', 'aria-current'), 'page', 'de actieve dock-app heeft aria-current');
    // Orders opent als app vanaf het springboard
    await page.waitForSelector('.wos-grid .wos-app[aria-label="Orders"]', { state: 'visible', timeout: 10000 });
    await page.click('.wos-grid .wos-app[aria-label="Orders"]');

    // de betaalde bestelling staat op het scherm
    const kaart = page.locator('.order[data-ref="' + ref + '"]');
    await kaart.waitFor({ timeout: 10000 });
    assert.match(await kaart.textContent(), /Tafel 3|Ramen/, 'de tafel/het gerecht staat op de bon');

    // doorzetten naar 'in bereiding' (de keuken pakt hem op)
    await kaart.locator('.js-next').first().click();
    await page.waitForFunction(r => {
      const el = document.querySelector('.order[data-ref="' + r + '"]');
      return !!(el && /in bereiding/.test(el.textContent));
    }, ref, { timeout: 15000 });

    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('Leden-app: het conciergegesprek toont een bericht veilig (geen XSS)',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await api(base, '/api/auth/register', { name: 'Chat Lid', email: 'chat@x.nl', phone: '0612345002',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
    assert.ok(reg.token, 'lid-registratie geeft een token');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    // Deze test gaat over XSS-veiligheid in het conciergegesprek, niet over
    // onboarding. Mock de onboarding-status op "klaar" zodat de verplichte
    // onboarding-modal (die anders de app blokkeert) niet verschijnt.
    await page.route('**/api/onboarding/status', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ klaar: true }) }));
    await page.addInitScript(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, reg.token);
    await page.goto(base + '/apps/app.html?pas=business', { waitUntil: 'load' });
    await page.waitForSelector('#gate', { state: 'hidden', timeout: 15000 });

    /* Naar het AI/concierge-scherm en een bericht met een XSS-payload sturen.

       De weg erheen is een tik op Rahuls mond in de balk onderaan het
       beginscherm: dan opent zijn hele app. Typen in de balk zelf doet iets
       anders sinds die balk een gesprek werd -- dan antwoordt hij daar, op het
       beginscherm, en blijf je thuis. (De oude tabbalk bestaat nog als model,
       maar is onzichtbaar; daar klikken loopt vast op een timeout.) */
    await page.click('#osAiOrb');
    await page.waitForSelector('#askInput', { state: 'visible', timeout: 10000 });
    const payload = '<img src=x onerror="window.__xss=1">';
    await page.fill('#askInput', payload);
    await page.click('#askBtn');
    await page.waitForSelector('#chat .bubble.user', { timeout: 10000 });
    await page.waitForTimeout(400); // geef een (eventuele) onerror de tijd om te vuren

    // de payload staat als TEKST in de bubbel, niet als uitgevoerd element
    assert.equal(await page.evaluate(() => document.querySelectorAll('#chat img').length), 0, 'de payload is niet als <img> uitgevoerd');
    assert.ok(!(await page.evaluate(() => window.__xss)), 'er is geen script uitgevoerd');
    assert.match(await page.textContent('#chat'), /onerror/, 'het bericht staat leesbaar als tekst');
    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('Leden-app: Rahul begint zelf op het beginscherm en antwoordt daar ook',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  /* De balk onderaan was een doorgeefluik naar zijn app; nu is het een gesprek
     dat op het beginscherm staat. Twee dingen die echt moeten kloppen: hij
     BEGINT uit zichzelf (anders is hij niet proactief, alleen aanwezig), en een
     antwoord komt daar terug zonder dat je van het beginscherm af gaat. En wat
     in de draad komt is TEKST -- ook als er html-achtigs in staat. */
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await api(base, '/api/auth/register', { name: 'Thuis Lid', email: 'thuis@x.nl', phone: '0612345004',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' });
    assert.ok(reg.token, 'lid-registratie geeft een token');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.route('**/api/onboarding/status', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ klaar: true }) }));
    await page.addInitScript(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, reg.token);
    await page.goto(base + '/apps/app.html', { waitUntil: 'load' });
    await page.waitForSelector('#gate', { state: 'hidden', timeout: 15000 });

    // 1. hij begint uit zichzelf: er staat een zin van Rahul in de draad
    await page.waitForSelector('#osAiDraad .os-bel.van-rahul', { timeout: 10000 });
    const opening = await page.textContent('#osAiDraad .os-bel.van-rahul');
    assert.ok(opening && opening.trim().length > 5, 'Rahul opent met een zin: ' + opening);

    // 2. een vraag wordt daar beantwoord, en we blijven op het beginscherm
    await page.fill('#osAiIn', '<b>wat kun je</b>');
    await page.evaluate(() => document.getElementById('osAiBalk').requestSubmit());
    await page.waitForSelector('#osAiDraad .os-bel.van-mij', { timeout: 10000 });
    await page.waitForFunction(() => document.querySelectorAll('#osAiDraad .os-bel.van-rahul').length >= 2, null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => document.querySelector('.view.active').dataset.view), 'home',
      'we zijn niet weggenavigeerd; het antwoord komt op het beginscherm');

    // 3. wat er staat is tekst, geen opmaak die is uitgevoerd
    assert.equal(await page.evaluate(() => document.querySelectorAll('#osAiDraad b').length), 0,
      'de <b> uit het bericht is niet als opmaak uitgevoerd');
    assert.match(await page.textContent('#osAiDraad .os-bel.van-mij'), /<b>/, 'hij staat leesbaar als tekst');

    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens het gesprek');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
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
