/* Echte Wonen-route en bestaande help-/toegankelijkheidseigenaren. Negatieve
   netwerkantwoorden zijn expliciete tegenproeven, geen APPWERKT-kwalificatie. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright(); let srv, browser, token;
test.before(async () => {
  if (geenBrowser(pw)) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1', LOCAL_AI_URL: '', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '' } });
  const r = await fetch(srv.base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Basis Proef', email: 'basis-ds@example.test', phone: '0612345890', password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg' }) });
  assert.equal(r.status, 200); token = (await r.json()).token; assert.ok(token);
  browser = await pw.chromium.launch(browserOpties(pw));
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });
async function open() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await context.addInitScript(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, token);
  const page = await context.newPage(), fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/wonen.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.RTGAppMenu && !!window.RTGGids && !!window.RTGToegankelijk &&
    document.body.dataset.rtgDesktopState === 'ready' && document.documentElement.classList.contains('ds-basis') &&
    getComputedStyle(document.querySelector('.ds-basis__spring')).position === 'fixed');
  await page.evaluate(() => document.fonts.ready);
  return { page, context, fouten };
}
async function gids(page) {
  await page.locator('#osMenuBtn').click();
  await page.locator('.amn-blad').getByRole('button', { name: 'Instellingen', exact: true }).click();
  await page.getByRole('dialog', { name: 'Instellingen', exact: true }).getByRole('button', { name: 'Openen', exact: true }).click();
  const d = page.getByRole('dialog', { name: 'Uitleg over deze app', exact: true }); await d.waitFor(); return d;
}
test('basis: instellingen naar hulp, leesbare toestanden, profielen en focus op echte DS-route', { skip: geenBrowser(pw) }, async () => {
  const { page, context, fouten } = await open();
  try {
    const spring = page.locator('.ds-basis__spring'); await spring.focus();
    await page.waitForFunction(() => document.querySelector('.ds-basis__spring').getBoundingClientRect().left >= 0);
    const sprong = await spring.evaluate(el => ({ left: el.getBoundingClientRect().left, focus: el === document.activeElement,
      focusMatch: el.matches(':focus'), bronFocus: document.hasFocus(), token: getComputedStyle(el).getPropertyValue('--ds-ruimte-2'),
      inset: getComputedStyle(el).insetInlineStart, fysiek: getComputedStyle(el).left,
      actief: document.activeElement?.outerHTML.slice(0, 350), inert: el.closest('[inert]')?.tagName, classes: document.documentElement.className }));
    assert.ok(sprong.left >= 0 && sprong.focus, JSON.stringify(sprong));
    await spring.click();
    const bestemming = await spring.evaluate(el => {
      const doel = document.getElementById(el.hash.slice(1));
      return { focus: doel === document.activeElement, inhoud: !!doel?.querySelector('main,[role="main"]') || !!doel?.matches('main,[role="main"]'),
        actief: document.activeElement?.outerHTML.slice(0, 240), doel: doel?.outerHTML.slice(0, 240), zichtbaar: !!doel?.getClientRects().length, inert: doel?.closest('[inert]')?.tagName };
    });
    assert.ok(bestemming.focus && bestemming.inhoud, 'springlink focust zijn huidige inhoudsbestemming: ' + JSON.stringify(bestemming));
    const d = await gids(page);
    await page.waitForFunction(() => document.querySelector('.bss-doe li'));
    assert.equal(await d.evaluate(el => el.matches(':modal')), true);
    for (const width of [390, 820, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const r = await d.evaluate(el => ({ r: el.getBoundingClientRect().toJSON(), w: el.clientWidth, scroll: el.scrollWidth,
        doelen: [...el.querySelectorAll('button')].map(b => b.getBoundingClientRect().toJSON()) }));
      assert.ok(r.scroll <= r.w + 1 && r.r.left >= 0 && r.r.right <= width + 1 && r.r.top >= 0 && r.r.bottom <= 845, JSON.stringify(r));
      assert.ok(r.doelen.every(x => x.width >= 44 && x.height >= 44));
    }
    await page.keyboard.press('Escape'); await d.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement === document.getElementById('osMenuBtn'));
    const voor = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    const bewaard = await page.evaluate(() => window.RTGToegankelijk.zet({ tekst: 'groter', beweging: 'stil', links: 'streep', nadruk: 'rustig', contrast: 'hoog' }));
    await page.waitForFunction(voor => parseFloat(getComputedStyle(document.documentElement).fontSize) >= voor * 1.3, voor);
    const profiel = await page.evaluate(() => ({ maat: parseFloat(getComputedStyle(document.documentElement).fontSize),
      link: getComputedStyle(document.querySelector('.ds-basis__spring')).textDecorationLine,
      lijn: getComputedStyle(document.querySelector('.ds-kop')).boxShadow, html: document.documentElement.className }));
    assert.ok(profiel.maat >= voor * 1.3, JSON.stringify({ voor, profiel, bewaard })); assert.match(profiel.link, /underline/); assert.equal(profiel.lijn, 'none');
    await page.evaluate(() => dispatchEvent(new Event('offline')));
    const offlineStatus = page.getByRole('status').filter({ hasText: 'Geen verbinding' });
    await offlineStatus.waitFor();
    assert.equal(await offlineStatus.evaluate(el => getComputedStyle(el).position), 'fixed');
    await page.evaluate(() => dispatchEvent(new Event('online')));
    await page.getByRole('status').filter({ hasText: 'De verbinding is terug' }).waitFor();
    const injecties = await page.locator('style').allTextContents();
    assert.equal(injecties.some(s => s.includes('.bss-sheet{') || s.includes('.rtg-spring{')), false, 'geen oude basis- of springstijl');
    await page.evaluate(() => window.RTGToegankelijk.zet({ tekst: 'normaal', beweging: 'normaal', links: 'normaal', nadruk: 'normaal', contrast: 'normaal' }));
    assert.deepEqual(fouten, []);
  } finally { await context.close(); }
});
test('basis: mislukte of oude gidsantwoorden schrijven nooit over een nieuw venster', { skip: geenBrowser(pw) }, async () => {
  const { page, context } = await open();
  let oud, ontvangen;
  try {
    await page.route('**/api/gids/app', async r => {
      if (!ontvangen) { ontvangen = true; oud = r; return; }
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ gids: { wat: 'Actuele uitleg', doe: ['Nieuwe taak'], tip: 'Huidige tip' } }) });
    });
    let d = await gids(page); await page.waitForFunction(() => document.querySelector('.bss-wat').textContent === 'Even ophalen…');
    await page.keyboard.press('Escape'); await d.waitFor({ state: 'hidden' });
    d = await gids(page); await page.waitForFunction(() => document.querySelector('.bss-wat').textContent === 'Actuele uitleg');
    assert.ok(oud, 'eerste aanvraag tegengehouden');
    await oud.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ gids: { wat: 'VEROUDERD', doe: ['Oude taak'], tip: 'Oud' } }) });
    await page.waitForLoadState('networkidle');
    assert.equal(await d.locator('.bss-wat').textContent(), 'Actuele uitleg'); assert.equal(await d.locator('.bss-doe li').count(), 1);
    await page.keyboard.press('Escape'); await d.waitFor({ state: 'hidden' });
    await page.unroute('**/api/gids/app');
    await page.route('**/api/gids/app', r => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ gids: { wat: 'Geen geldig succes', doe: [], tip: '' } }) }));
    d = await gids(page); await page.waitForFunction(() => document.querySelector('.bss-wat').textContent.includes('probeer opnieuw'));
    assert.equal(await d.locator('.bss-doe').count(), 0); assert.doesNotMatch(await d.textContent(), /Geen geldig succes/);
  } finally { await context.close(); }
});
test('DS Edge: echte Tab-focus blijft boven vaste balk op de documentvloer', {skip:geenBrowser(pw)},async()=>{
 const {page,context,fouten}=await open();try{
  await page.waitForSelector('.ds-edge__balk');
  // Afgebakende geometriefixture in de echte DS-host, geen app-/authbewijs.
  await page.evaluate(()=>{const vloer=document.createElement('section');vloer.id='focusVloer';vloer.style.cssText='position:relative;min-height:300vh;padding-top:110vh';const voor=document.createElement('button');voor.id='focusVoor';voor.textContent='Voor';const doel=document.createElement('button');doel.id='focusDoel';doel.textContent='Volgende invoer';doel.style.cssText='display:block;margin-top:200px;min-height:44px';vloer.append(voor,doel);document.body.append(vloer);voor.focus({preventScroll:true});scrollTo(0,voor.getBoundingClientRect().top+scrollY-innerHeight+100);});
  await page.keyboard.press('Tab');await page.waitForFunction(()=>document.activeElement?.id==='focusDoel');
  const maat=await page.evaluate(()=>({doel:document.querySelector('#focusDoel').getBoundingClientRect().toJSON(),edge:document.querySelector('.ds-edge').getBoundingClientRect().toJSON(),ruimte:getComputedStyle(document.documentElement).scrollPaddingBlockEnd}));
  assert.ok(parseFloat(maat.ruimte)>=80,JSON.stringify(maat));assert.ok(maat.doel.top>=0&&maat.doel.bottom<=maat.edge.top,JSON.stringify(maat));
  await page.evaluate(()=>document.querySelector('.ds-edge').hidden=true);assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollPaddingBlockEnd),'auto');assert.deepEqual(fouten,[]);
 }finally{await context.close();}
});
