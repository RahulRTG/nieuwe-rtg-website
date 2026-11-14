/* Echte Foundation-routes, serveruitgegeven gezinssessie van gekeurd ouderlid.
   Geen positieve API-stubs. Alleen een 503-tegenproef voor conceptbehoud.
   Browsermatrix is ontwikkelbewijs, geen menselijke/APPWERKT-kwalificatie. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, keurLidGoed, letOpFouten } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');
const { land, matrix } = require('./lib/foundation-coach-browser');
const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser, tmp, gezin;
const schermen = [
  '/apps/foundation/studie.html',
  '/apps/foundation/hulpwijzer.html',
  '/apps/foundation/steun.html'
];
async function post(url, body, token) {
  const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  const d = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(d)); return d;
}
test.before(async () => {
  if (skip) return;
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-foundation-ds-'));
  srv = await startServer({ env: { RTG_DATA_DIR: tmp, RTG_DEMO: '1', SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1', RTG_AI_UIT: '1', LOCAL_AI_URL: '', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' } });
  const ouder = await registreerGratis(srv.base); assert.ok(ouder, 'echte ouderregistratie');
  await keurLidGoed(srv.base, ouder.token, ouder.codenaam, '1985-05-05');
  gezin = await post('/api/rtf/eigen-gezin/maak', { gezinsnaam: 'DS Ontwikkelproef', naam: 'Ouder', bevoegdGezin: true, privacyAkkoord: true }, ouder.token);
  assert.match(gezin.token, /^GZ\.[0-9A-F]{32}$/); assert.ok(gezin.code && gezin.profiel?.beheerder);
  browser = await pw.chromium.launch(browserOpties(pw));
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); });

async function context() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await ctx.addInitScript(s => {
    localStorage.setItem('rtf_sessie', JSON.stringify({ code: s.code, token: s.token, profiel: s.profiel }));
    localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
  }, gezin);
  return ctx;
}
for (const scherm of schermen) {
 const route = scherm.split('/').at(-1).replace(/\.html$/, '');
 test('Foundation DS ' + route + ': echte inhoud, bediening, gezinssessie, herstel en wereldnavigatie', { skip, timeout: 120000 }, async () => {
  const ctx = await context();
  try {
    const page = await ctx.newPage(), errors = [];
    // De verwachte 503 wordt apart op de wire en in de UI bewezen.
    letOpFouten(page, errors);
    await land(page, route, srv.base); await matrix(page, route);
    /* Eén route bewijst de gedeelde sessiebalk met Escape. Op ieder van de
       drie routes vlak daarna nogmaals Escape gebruiken zou bewust de
       afzonderlijk bewezen dubbele-Escape-uitstap activeren; dat is geen
       sessie- of Samen-fout. */
    if (route === 'studie') {
      await page.locator('#sbProf').click(); await page.locator('#sbWissel').focus(); await page.keyboard.press('Escape');
      assert.equal(await page.locator('#sbProf').evaluate(e => document.activeElement === e), true);
      assert.equal(await page.locator('#sbMenu').isVisible(), false);
    }
    if (route === 'hulpwijzer') {
      await page.locator('#cats summary').first().click();
      assert.equal(await page.locator('#cats details').first().getAttribute('open'), '');
      assert.match(await page.locator('#cats details').first().textContent(), /Veilig Thuis/);
    }
    if (route === 'steun') {
      await page.getByRole('button', { name: 'Hoe gaat het echt met jou?', exact: true }).click();
      await page.locator('[data-m="3"]').click(); assert.equal(await page.locator('[data-m="3"]').getAttribute('aria-pressed'), 'true');
      assert.match(await page.locator('#reactie').textContent(), /oké is echt goed genoeg/);
      const before = await page.evaluate(() => JSON.parse(localStorage.getItem('rtf_stemming_' + Sessie.huidig().profiel.id)));
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => !document.documentElement.classList.contains('rtf-toegang-dicht'));
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('rtf_stemming_' + Sessie.huidig().profiel.id)).length), before.length);
      assert.match(await page.locator('#privaat').textContent(), /ingecheckt/);
    }
    if (route === 'steun') await page.getByRole('button', { name: 'Even je hart luchten', exact: true }).click();
    const q = 'Welke eerste stap kan ik zelf doen?'; await page.locator('#vraag').fill(q);
    const antwoord = page.waitForResponse(r => r.url().endsWith('/api/foundation/hulp/ai') && r.request().method() === 'POST');
    await page.locator('#stuur').click(); const r = await antwoord; assert.equal(r.status(), 200); const d = await r.json(); assert.ok(d.text);
    await page.waitForFunction(tekst => [...document.querySelectorAll('#chat .ai')].some(el => el.textContent === tekst), d.text);
    const failed = 'Bewaar deze vraag na een verbindingsfout';
    await page.route('**/api/foundation/hulp/ai', r => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Geïsoleerde transporttegenproef' }) }));
    await page.locator('#vraag').fill(failed); await page.locator('#stuur').click();
    await page.waitForFunction(q => document.querySelector('#vraag').value === q && !document.querySelector('#stuur').disabled, failed);
    assert.match(await page.locator('#chat .ai').last().textContent(), /lukte even niet/);
    await page.unroute('**/api/foundation/hulp/ai');
    await page.locator('.rsm-knop').click(); assert.equal(await page.locator('.rsm-sheet').isVisible(), true);
    await page.locator('.rsm-sheet input').fill('ONGELDIGE-CODE'); await page.locator('.rsm-sheet .rsm-x').click();
    assert.equal(await page.locator('.rsm-knop').evaluate(e => document.activeElement === e), true);
    await page.locator('.rsm-rahul').click(); const ri = page.locator('.rsm-rsheet input'); await ri.fill('Hoe kan ik leren?');
    const rr = page.waitForResponse(r => r.url().endsWith('/api/rtf/rahul'));
    await page.locator('.rsm-rsheet button[type=submit]').click(); const actual = await rr; assert.equal(actual.status(), 200); const rd = await actual.json(); assert.ok(rd.antwoord);
    await page.waitForFunction(text => document.querySelector('.rsm-ruit').textContent === text, rd.antwoord);
    await ri.focus(); await page.keyboard.press('Escape'); assert.equal(await page.locator('.rsm-rahul').evaluate(e => document.activeElement === e), true);
    if (route === 'studie') {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.locator('#vraag').fill('Concept blijft bij Naast');
      const voorHand = await page.locator('html').getAttribute('data-hand');
      assert.ok(['links', 'rechts'].includes(voorHand));
      const naHand = voorHand === 'rechts' ? 'links' : 'rechts';
      await page.locator('.ws-hand').click();
      assert.equal(await page.locator('html').getAttribute('data-hand'), naHand);
      assert.equal(await page.evaluate(() => localStorage.getItem('rtg_hand')), naHand);
      assert.equal(await page.evaluate(() => RTGHand.is()), naHand);
      assert.match(await ctx.cookies().then(cs => cs.find(c => c.name === 'rtg_hand').value), new RegExp('^' + naHand + '$'));
      await page.locator('.ws-splits').click();
      await page.locator('.ws-doel[href="agenda.html"]').click();
      await page.waitForSelector('.ds-wereldnav-paneel iframe');
      assert.equal(new URL(page.url()).pathname, '/apps/foundation/studie.html');
      assert.equal(await page.locator('#vraag').inputValue(), 'Concept blijft bij Naast');
      assert.equal(await page.locator('.ws-paneel iframe').getAttribute('src'), 'agenda.html');
      await page.locator('.ws-paneel-dicht').click();
      assert.equal(await page.locator('.ws-paneel').count(), 0);
      assert.equal(await page.locator('#vraag').inputValue(), 'Concept blijft bij Naast');
    }
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
 });
}

test('Foundation legacy-host gebruikt dezelfde Samen-presentatie zonder runtime-CSS', { skip, timeout: 120000 }, async () => {
  const ctx = await context();
  try {
    const page = await ctx.newPage(), errors = [];
    letOpFouten(page, errors);
    const response = await page.goto(srv.base + '/apps/foundation/beheer.html', { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200);
    await page.waitForFunction(() => window.Sessie?.actief() && !document.documentElement.classList.contains('rtf-toegang-dicht') && !!document.querySelector('.rsm-knop'));
    assert.equal(await page.locator('style').evaluateAll(nodes => nodes.filter(n => /\.rsm-(?:sheet|rsheet|knop)|\.sb-balk\{/.test(n.textContent)).length), 0);
    assert.equal(await page.locator('html').evaluate(e => e.classList.contains('ds-samen-host')), false);
    assert.equal(await page.locator('body').evaluate(e => e.classList.contains('ds-samen-host')), true);
    await page.locator('.rsm-knop').click();
    const sluit = page.locator('.rsm-sheet .rsm-x');
    const maat = await sluit.evaluate(e => { const r=e.getBoundingClientRect(); return {w:r.width,h:r.height}; });
    assert.ok(maat.w >= 44 && maat.h >= 44, JSON.stringify(maat));
    await sluit.focus(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('.rsm-knop').evaluate(e => document.activeElement === e), true);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, 'Samen veroorzaakt horizontale overloop: ' + overflow);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
