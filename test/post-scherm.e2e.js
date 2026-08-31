/* Schermtoets voor apps/mijn-post.html. Dit scherm belooft drie dingen die
   allebei op het scherm EN in de bron waar moeten zijn:

   1. alles staat uit tot het lid het aanzet -- afwezigheid is geen toestemming,
      en een scherm dat drie ongelezen vinkjes toont ziet er hetzelfde uit als
      een scherm waarop niets aanstaat. Daarom staat de stand in woorden;
   2. een tik op een kanaal raakt de BRON en niet alleen het beeld. Daarom wordt
      er na de tik bij /api/mijn/post opnieuw gekeken;
   3. wat je hoe dan ook blijft krijgen staat er even groot bij. Een
      toestemmingsscherm dat alleen toont wat je KUNT uitzetten, laat denken dat
      de rest ook uit kan -- en dat is precies het misverstand dat een mens
      zichzelf blind laat zetten voor een beveiligingswaarschuwing.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

test('Post van RTG: standaard uit, een tik raakt de bron, en de vaste post staat erbij',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-postscherm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Post Lid', email: 'postscherm@x.nl', phone: '0612345871',
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
    }).then(r => r.json());
    assert.ok(reg.token);
    const api = (pad, body) => fetch(base + '/api/' + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: JSON.stringify(body || {})
    }).then(r => r.json());

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/mijn-post.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('#lijst .soort').length > 0,
      null, { timeout: 15000 });

    /* 1. ALLES UIT, en met zoveel woorden. Vier soorten, geen enkel kanaal
       ingedrukt, en per soort een zin die zegt dat er niets aanstaat. */
    const kaarten = page.locator('#lijst .soort');
    assert.ok(await kaarten.count() >= 4, 'alle soorten post staan er');
    assert.equal(await page.locator('#lijst .kanaal[aria-pressed="true"]').count(), 0,
      'er staat bij een vers account geen enkel kanaal aan');
    assert.match(await page.textContent('#lijst'), /Staat uit/,
      'en dat staat er in woorden, niet alleen als een ongevuld vinkje');
    assert.ok(await page.locator('#afmeld .knop[disabled]').count(),
      'de afmeldknop staat er wel, maar heeft niets te doen');

    /* 3. WAT ER HOE DAN OOK BLIJFT KOMEN, even groot ernaast. */
    const altijd = await page.textContent('#altijd');
    assert.match(altijd, /Beveiligingswaarschuwingen/, 'de vaste post staat er');
    assert.match(altijd, /blind/i, 'met de reden erbij en niet als kale opsomming');

    /* 2. EEN TIK ZET HET AAN -- en dan kijken we bij de bron. */
    const email = page.locator('#lijst .soort').first().locator('.kanaal').first();
    await email.scrollIntoViewIfNeeded();
    await email.click();
    await page.waitForFunction(() => document.querySelectorAll('#lijst .kanaal[aria-pressed="true"]').length === 1,
      null, { timeout: 10000 });

    const bijDeBron = await api('mijn/post', {});
    const aan = bijDeBron.soorten.filter(s => s.aan);
    assert.equal(aan.length, 1, 'precies een soort staat aan bij de bron zelf');
    assert.deepEqual(aan[0].kanalen, ['email'], 'en alleen het kanaal waarop geklikt is');
    assert.ok(aan[0].sinds, 'met een tijdstip');
    assert.match(String(aan[0].gegevenVia), /^scherm:post$/,
      'en met de herkomst van DIT scherm; een stand zonder herkomst is geen bewijs van toestemming');
    assert.match(await page.textContent('#lijst'), /Door u gegeven op/,
      'het lid leest zelf terug wanneer hij ja zei');

    /* En de poort erachter luistert er ook echt naar: alleen dit kanaal. */
    const g = await api('mijn/post/geschiedenis', {});
    assert.equal(g.geschiedenis[0].handeling, 'gegeven');
    assert.equal(g.geschiedenis[0].bron, 'scherm:post');

    /* ALLES UIT MOET EEN HANDELING ZIJN. Wie vier vinkjes moet omzetten om van
       post af te komen, is niet afgemeld maar afgeschrikt. */
    await page.locator('#afmeld .knop').click();
    await page.waitForFunction(() => document.querySelectorAll('#lijst .kanaal[aria-pressed="true"]').length === 0,
      null, { timeout: 10000 });
    const na = await api('mijn/post', {});
    assert.equal(na.soorten.filter(s => s.aan).length, 0, 'ook bij de bron staat alles weer uit');
    const g2 = await api('mijn/post/geschiedenis', {});
    assert.equal(g2.geschiedenis[0].handeling, 'ingetrokken',
      'en de intrekking staat in de geschiedenis; een intrekking die je niet kunt aantonen, telt niet');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
