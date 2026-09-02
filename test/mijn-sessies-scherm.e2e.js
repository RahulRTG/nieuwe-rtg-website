/* HET SESSIESCHERM (/apps/mijn-sessies.html) IN EEN ECHTE BROWSER.

   test/mijnrtg-routes.test.js en test/mijnsessies.test.js bewijzen de routes
   over HTTP: intrekken werkt op de sid, en "sluit alle andere" doet de eigen
   sessie nooit. Dit bestand dubbelt dat niet; het gaat over het SCHERM waar een
   mens beslist welke ingang hij dichtdoet. scripts/schermen.js eist een eigen
   tocht door de browser.

   WAT DEZE TOETS VASTLEGT, en waarom juist dat:

   1. EEN SESSIE DRAAGT GEEN NAMEN. Op het scherm staat het kenmerk, de manier
      van inloggen en de bewijsgraad per veld -- en NIET het e-mailadres of de
      echte naam van het lid. Een sessielijst is de plek waar "iPhone 16 Pro,
      Amsterdam" vanzelf ontstaat als niemand de grens bewaakt; hier staat bij
      het toestel `onbekend` met een lege rail, niet een gok.
   2. DE EIGEN SESSIE IS HERKENBAAR. Precies een kaart draagt "U bent hier",
      en de knop "Sluit alle andere sessies" staat er alleen als er andere zijn.
   3. EEN GEVOELIGE HANDELING VERTRAAGT PRECIES GENOEG. Wie de bevestigingsvraag
      wegklikt, sluit niets; er gaat dan geen verzoek de deur uit.
   4. SLUIT-OVERIGE LAAT DE EIGEN SESSIE STAAN. Na de bevestiging is het andere
      token geweigerd (401), het eigen token werkt nog, de kaart van de andere
      sessie is weg en de knop "alle andere" verdwijnt omdat er niets meer te
      sluiten valt.

   Wat NIET is beproefd: toestelbinding (die vraagt WebCrypto plus een prompt en
   heeft zijn eigen weg), en het sluiten van de eigen sessie (dat is uitloggen).

   Draai los: node --test test/mijn-sessies-scherm.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser, wachtOpNetstilte } = require('./helper');

const pw = laadPlaywright();

test('Waar ben ik aanwezig: geen namen op een sessie, de eigen sessie herkenbaar, en sluit-overige laat haar staan',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sessies-scherm-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    const post = async (pad, body, token) => {
      const r = await fetch(base + pad, { method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' },
          token ? { Authorization: 'Bearer ' + token } : {}),
        body: JSON.stringify(body || {}) });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    };
    let browser;
    try {
      const u = String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 90) + 10);
      const NAAM = 'Sessieganger', EMAIL = 'x' + u + '@x.nl', WW = 'geheim12345';
      const reg = await post('/api/auth/register', { name: NAAM, email: EMAIL,
        phone: '06' + u.slice(-8), password: WW, geboortedatum: '1990-03-03',
        tier: 'rtg', pasApp: 'rtg' });
      assert.ok(reg.body.token, 'het lid is aangemeld: ' + JSON.stringify(reg.body).slice(0, 160));
      const HIER = reg.body.token;
      /* Een tweede ingang op hetzelfde account: een gewone wachtwoord-inlog. Dat
         is de sessie die "een ander toestel" speelt. */
      const login = await post('/api/auth/login', { email: EMAIL, password: WW, pasApp: 'rtg' });
      assert.ok(login.body.token, 'de tweede inlog geeft een sessie: ' + JSON.stringify(login.body).slice(0, 160));
      const ANDER = login.body.token;
      assert.notEqual(ANDER, HIER);

      browser = await pw.chromium.launch(browserOpties(pw));
      const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
      await ctx.addInitScript((token) => {
        localStorage.setItem('rtg_member_token', token);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, HIER);
      const page = await ctx.newPage();
      const fouten = [];
      letOpFouten(page, fouten);
      const verzoeken = [];
      page.on('request', (r) => { if (r.url().includes('/api/mijn/sessies/')) verzoeken.push(r.url()); });
      const geladen = page.waitForResponse((r) => r.url().endsWith('/api/mijn/sessies'), { timeout: 20000 });
      await page.goto(base + '/apps/mijn-sessies.html', { waitUntil: 'domcontentloaded' });
      const lijst = await geladen;
      assert.equal(lijst.status(), 200, 'het scherm leest de sessies met de ledensessie');
      const lj = await lijst.json();
      assert.equal((lj.sessies || []).length, 2, 'twee sessies op het account: ' + JSON.stringify(lj).slice(0, 200));
      await page.waitForFunction(() => document.querySelectorAll('article.sessie').length === 2, null, { timeout: 15000 });

      const tekst = (s) => page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '';
      }, s);

      /* ---- 1. geen namen ---- */
      const alles = await tekst('body');
      assert.ok(!alles.includes(EMAIL), 'het e-mailadres staat niet op het sessiescherm');
      assert.ok(!alles.includes(NAAM), 'de echte naam staat niet op het sessiescherm');
      assert.ok(!JSON.stringify(lj).includes(EMAIL) && !JSON.stringify(lj).includes(NAAM),
        'en de sessielijst van de server draagt ze ook niet');
      assert.match(alles, /KENMERK [A-Z0-9]{4}/, 'elke kaart draagt een kenmerk dat een mens kan voorlezen');
      assert.equal(await page.locator('article.sessie .samen .los', { hasText: 'Toestel nog niet bevestigd' }).count(), 2,
        'een toestel dat nooit is vastgesteld heet zo, en krijgt geen verzonnen naam');
      assert.equal(await page.locator('article.sessie .rail.onbekend[aria-label="Toestelbinding: onbekend"]').count(), 2,
        'de rail voor de toestelbinding is leeg en heet onbekend');
      assert.match(alles, /Wachtwoord/, 'de manier van inloggen komt van de server');

      /* ---- 2. de eigen sessie ---- */
      assert.equal(await page.locator('article.sessie.hier').count(), 1, 'precies een kaart is de eigen sessie');
      assert.equal(await tekst('article.sessie.hier .hierlabel'), 'U bent hier');
      assert.equal(await page.locator('article.sessie:not(.hier) .titel', { hasText: /^Sessie [A-Z0-9]{4}$/ }).count(), 1,
        'de andere sessie heet naar haar kenmerk');
      assert.equal(await page.locator('#overigeBlok.weg').count(), 0, 'met een andere sessie staat "alle andere" er');
      assert.equal(await page.locator('#alles').isVisible(), true);

      /* ---- 3. wegklikken sluit niets ---- */
      page.once('dialog', (d) => d.dismiss());
      await page.locator('#alles').click();
      await wachtOpNetstilte(page, { stilMs: 400, maxMs: 4000 });
      assert.deepEqual(verzoeken, [], 'na het wegklikken van de vraag gaat er geen verzoek de deur uit');
      assert.equal((await post('/api/mijn/sessies', {}, ANDER)).status, 200, 'de andere sessie werkt nog');
      assert.equal(await page.locator('article.sessie').count(), 2);

      /* ---- 4. bevestigen sluit de andere, en laat deze staan ---- */
      page.once('dialog', (d) => d.accept());
      const gesloten = page.waitForResponse((r) => r.url().endsWith('/api/mijn/sessies/sluit-overige'), { timeout: 20000 });
      await page.locator('#alles').click();
      const s = await gesloten;
      assert.equal(s.status(), 200, 'sluit-overige via het scherm lukt');
      const sj = await s.json();
      assert.equal(sj.aantal, 1, 'er is precies een andere sessie gesloten');
      await page.waitForFunction(() => {
        const m = document.querySelector('#melding');
        return m && m.classList.contains('zien') && /1 sessie\(s\) gesloten/.test(m.textContent);
      }, null, { timeout: 15000 });
      assert.match(await tekst('#melding'), /Deze sessie blijft open/, 'de melding zegt dat deze sessie blijft');
      await page.waitForFunction(() => document.querySelectorAll('article.sessie').length === 1, null, { timeout: 15000 });
      assert.equal(await page.locator('article.sessie.hier').count(), 1, 'de overgebleven kaart is de eigen sessie');
      assert.equal(await page.locator('#overigeBlok.weg').count(), 1, 'zonder andere sessies verdwijnt "alle andere"');

      assert.equal((await post('/api/mijn/sessies', {}, ANDER)).status, 401, 'het andere token is geweigerd');
      assert.equal((await post('/api/mijn/sessies', {}, HIER)).status, 200, 'het eigen token werkt nog');

      assert.deepEqual(fouten, [], 'geen JS-fouten op het sessiescherm: ' + fouten.join(' | '));
    } finally {
      if (browser) await browser.close();
      await stop(child);
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* weg is weg */ }
    }
  });
