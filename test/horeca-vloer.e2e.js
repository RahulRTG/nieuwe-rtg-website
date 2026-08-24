/* HET VLOERSCHERM in een echte browser: /apps/horeca-vloer.html.

   De regels staan vast in test/horeca-wijk.test.js. Wat hier bewezen wordt is
   dat een maitre en een medewerker er samen mee kunnen werken -- en dat is de
   enige toets die de kern niet kan doen, want een overdracht speelt zich af
   tussen TWEE schermen:

   1. UITGELOGD STAAT ER EEN DEUR (TAKEN 5.5).
   2. DE VERDELING STAAT ER: welke wijk, wie draagt hem, hoeveel open werk, en
      welke tafels. Een wijk die niemand draagt komt naar voren en kan vanaf dit
      scherm genomen worden.
   3. EEN OVERDRACHT IS EEN AANBOD, EN DAT IS OP HET SCHERM TE ZIEN: zolang de
      ander niet aanvaardt, staat de wijk nog op naam van de aanbieder. Dat is
      het hele ontwerp -- de reden dat er geen moment bestaat waarop een wijk van
      niemand is -- en als het scherm dat niet toont, gelooft niemand het.
   4. HET AANBOD KOMT AAN BIJ DE ANDER en die neemt hem over; daarna staat de
      wijk bij beide mensen op de nieuwe naam.
   5. INDELEN VERSCHIJNT BIJ DE MANAGER EN NIET BIJ DE VLOER. Een weergavehint,
      geen slot: de server weigert het toch al (dat staat in horeca-wijk.test.js).

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vloerscherm-'));

const post = (base, pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('het vloerscherm toont de verdeling en draagt een wijk over',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const fouten = [];

    /* Twee mensen, dus twee contexten: een gedeelde localStorage zou beide
       schermen dezelfde inlog geven, en dan is er niets over te dragen. */
    async function scherm() {
      const ctx = await browser.newContext({ serviceWorkers: 'block' });
      const page = await ctx.newPage();
      letOpFouten(page, fouten);
      return page;
    }

    const uitgelogd = await scherm();
    await uitgelogd.goto(base + '/apps/horeca-vloer.html', { waitUntil: 'load' });
    await uitgelogd.evaluate(() => {
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.removeItem('rtg_sup_token');
    });
    await uitgelogd.goto(base + '/apps/horeca-vloer.html', { waitUntil: 'load' });
    await uitgelogd.waitForTimeout(900);
    const deur = await uitgelogd.evaluate(() => ({ pad: location.pathname,
      deur: !!document.querySelector('.rtgdeur'), tekst: document.body.innerText.replace(/\s+/g, ' ') }));
    assert.equal(deur.pad, '/apps/horeca-vloer.html', 'de pagina stuurt niemand weg');
    assert.ok(deur.deur || /personeel|inlog|zaak/i.test(deur.tekst), 'uitgelogd staat er een deur');

    const roster = (await post(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
    const mgr = (roster.staff || []).find(x => x.role === 'manager') || roster.staff[0];
    const vloer = (roster.staff || []).find(x => x.id !== mgr.id);
    assert.ok(vloer, 'de demozaak heeft naast de manager nog iemand');
    const tokM = (await post(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
    const tokA = (await post(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: vloer.id, pin: '5678' })).body.token;
    const M = (pad, body) => post(base, '/api/supplier/horeca' + pad, body, tokM);

    // een wijk met een tafel waar een gast om hulp vraagt, zodat er drukte te tonen is
    const w = (await M('/wijk/zet', { naam: 'Serre', tafels: ['VL1'] })).body.wijk;
    await M('/rekening/open', { kanaal: 'tafel', tafel: 'VL1', gasten: 2 });
    const qr = (await M('/gast/qr', { tafel: 'VL1' })).body;
    const aan = (await post(base, '/api/gast/aanschuiven', { token: qr.token, naam: 'Gast' })).body;
    await post(base, '/api/gast/verzoek', { sleutel: aan.sleutel, soort: 'hulp', tekst: 'iets met VL1' });

    async function open(page, tok) {
      await page.goto(base + '/apps/horeca-vloer.html', { waitUntil: 'load' });
      await page.evaluate(t => { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_sup_token', t); }, tok);
      await page.goto(base + '/apps/horeca-vloer.html', { waitUntil: 'load' });
      await page.waitForTimeout(900);
    }
    const lees = (page) => page.evaluate(() => ({
      wijken: document.getElementById('vWijken').innerText.replace(/\s+/g, ' '),
      voorMij: document.getElementById('vVoorMij').innerText.replace(/\s+/g, ' '),
      aanbod: document.getElementById('vAanbod').innerText.replace(/\s+/g, ' '),
      open: document.getElementById('vOpen').textContent,
      los: document.getElementById('vLos').textContent,
      indeel: !document.getElementById('vIndeel').hidden
    }));

    const pA = await scherm(); await open(pA, tokA);
    const pM = await scherm(); await open(pM, tokM);

    /* ---- 2. de verdeling ---- */
    let a = await lees(pA);
    assert.match(a.wijken, /Serre/, 'de wijk staat er: ' + a.wijken);
    assert.match(a.wijken, /VL1/, 'met zijn tafels erbij');
    assert.match(a.wijken, /Niemand draagt deze wijk/, 'en dat niemand hem draagt');
    assert.equal(a.los, '1', 'de teller telt de wijken zonder drager');
    assert.ok(Number(a.open) >= 1, 'er staat open werk: ' + a.open);

    /* ---- 5. indelen: wel bij de manager, niet bij de vloer ---- */
    assert.equal(a.indeel, false, 'de vloer krijgt het indeelblok niet te zien');
    assert.equal((await lees(pM)).indeel, true, 'de manager wel');

    await pA.click('[data-neem="' + w.id + '"]');
    await pA.waitForTimeout(800);
    a = await lees(pA);
    assert.match(a.wijken, new RegExp(vloer.name + ' draagt deze wijk'), 'genomen vanaf het scherm: ' + a.wijken);

    /* ---- 3. aanbieden, en de wijk blijft ondertussen van de aanbieder ---- */
    await pA.selectOption('select[data-naar="' + w.id + '"]', String(mgr.id));
    await pA.click('[data-bied="' + w.id + '"]');
    await pA.waitForTimeout(800);
    a = await lees(pA);
    assert.match(a.wijken, new RegExp('Aangeboden aan ' + mgr.name), 'het aanbod staat bij de wijk: ' + a.wijken);
    assert.match(a.wijken, new RegExp(vloer.name + ' draagt deze wijk'),
      'EN DIT IS DE POINTE: hij draagt hem nog steeds -- ' + a.wijken);
    assert.match(a.aanbod, /Serre/, 'het aanbod staat ook in de lijst met open aanbiedingen');

    /* ---- 4. het aanbod komt aan, en pas dan verhuist de wijk ---- */
    await pM.click('#vVerversNu');
    await pM.waitForTimeout(800);
    let m = await lees(pM);
    assert.match(m.voorMij, new RegExp(vloer.name + ' biedt u Serre aan'), 'het aanbod staat bovenaan: ' + m.voorMij);
    assert.match(m.voorMij, new RegExp('draagt ' + vloer.name + ' hem nog'), 'met wat er tot dan geldt');
    assert.match(m.wijken, new RegExp(vloer.name + ' draagt deze wijk'), 'en de wijk is nog niet verhuisd');

    await pM.click('[data-pak]');
    await pM.waitForTimeout(900);
    m = await lees(pM);
    assert.equal(m.voorMij.trim(), '', 'het aanbod is weg');
    assert.match(m.wijken, new RegExp(mgr.name + ' draagt deze wijk'), 'de wijk staat op de nieuwe naam: ' + m.wijken);

    await pA.click('#vVerversNu');
    await pA.waitForTimeout(800);
    a = await lees(pA);
    assert.match(a.wijken, new RegExp(mgr.name + ' draagt deze wijk'), 'ook op het scherm van wie hem overdroeg');
    assert.doesNotMatch(a.wijken, /Aangeboden aan/, 'en er staat geen aanbod meer open');

    /* ---- 5b. indelen werkt ook echt, en een verversing gooit het niet weg ---- */
    await pM.click('#vNieuw');
    await pM.waitForTimeout(200);
    await pM.fill('#vNaam', 'Loge');

    /* Dit scherm ververst op elke duw van een collega. Een vorm die daarbij
       opnieuw wordt opgebouwd, gooit een half ingetypte indeling weg -- en dat
       gebeurt juist op een drukke avond, want dan zijn er duwberichten. */
    await pM.click('#vVerversNu');
    await pM.waitForTimeout(900);
    assert.equal(await pM.inputValue('#vNaam'), 'Loge',
      'een verversing tijdens het typen gooit de half ingevulde wijk niet weg');

    await pM.click('#vVorm [data-bewaar]');
    await pM.waitForTimeout(900);
    assert.match((await lees(pM)).wijken, /Loge/, 'een nieuwe wijk staat meteen in de verdeling');

    assert.deepEqual(fouten, [], 'geen fouten in de console');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
