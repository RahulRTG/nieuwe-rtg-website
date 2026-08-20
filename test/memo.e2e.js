/* Scherm-test voor RTG Memo: de lijst leest de kluis, de samenvatting is
   eerlijk (met en zonder transcript op het toestel) en weggooien gaat naar
   de prullenbak. Opnemen zelf (microfoon) valt buiten headless bereik; de
   memo wordt via de kluis-API klaargezet, precies zoals de app hem bewaart.
   Draait alleen waar een browser beschikbaar is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

test('Memo: de lijst leest de kluis en de samenvatting is eerlijk over het transcript',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-memo-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, ANTHROPIC_API_KEY: '' } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const reg = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Memolid', email: 'me' + u + '@x.nl', phone: '06' + u,
        password: 'geheim123', geboortedatum: '1992-04-04', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());
    assert.ok(reg.token, 'het memolid is aangemeld: ' + JSON.stringify(reg).slice(0, 160));
    const api = (pad, body) => fetch(base + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: JSON.stringify(body || {}) }).then(r => r.json());
    const map = await api('/api/bestanden/map', { naam: "Memo's" });
    assert.ok(map.id, 'de memomap is aangemaakt: ' + JSON.stringify(map).slice(0, 160));
    const up = await api('/api/bestanden/upload', { naam: 'memo-2026-07-27-0900.webm', map: map.id,
      dataUrl: 'data:audio/webm;base64,' + Buffer.from('demo-audio').toString('base64') });
    assert.ok(up.id, 'de memo is opgeslagen: ' + JSON.stringify(up).slice(0, 160));

    browser = await pw.chromium.launch(browserOpties(pw));
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
    try {
      await page.waitForFunction(() => document.querySelectorAll('#lijst .memo').length === 1, null, { timeout: 20000 });
    } catch (e) {
      const toestand = await page.evaluate(() => ({
        lijst: (document.querySelector('#lijst') || {}).textContent || '',
        melding: (document.querySelector('#melding') || {}).textContent || '',
        token: !!localStorage.getItem('rtg_member_token')
      }));
      throw new Error(e.message + '\nMemo-scherm: ' + JSON.stringify(toestand) +
        '\nPaginafouten: ' + JSON.stringify(fouten));
    }
    assert.ok(await page.evaluate(() => /met transcript/.test(document.querySelector('#lijst').textContent)));

    /* samenvatting: de lokale taalroute toont de inhoud als menselijke tekst;
       technische herkomstmetadata hoort niet in de memokaart. */
    await page.evaluate(() => { document.querySelector('[data-vat]').click(); });
    await page.waitForFunction(() => /aannemer bellen/i.test(document.querySelector('[data-uit]').textContent), null, { timeout: 8000 });
    assert.doesNotMatch(await page.textContent('[data-uit]'), /Lokale samenvatting|\d+ woorden/i);

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

/* OPNEMEN EN BEWAREN, EN DE WEDLOOP DAAROMHEEN.

   De toets hierboven zet de memo via de kluis-API klaar; het echte bewaarpad
   (opnemen -> stoppen -> upload) liep daardoor nooit door een toets heen. Dat
   was precies de plek waar het misging: apps/memo/app.js zoekt de map Memo's op
   in twee verzoeken en bewaarde ondertussen met `map: null`. De memo landde dan
   naast de map, terwijl er "Memo bewaard in je kluis" stond -- en omdat de lijst
   op diezelfde map filtert, zag je hem ook niet meer terug.

   De microfoon valt buiten headless bereik, maar het bewaarpad niet: RTGMedia en
   MediaRecorder zijn hier vervangen door een dubbelganger die precies doet wat
   de app van ze verwacht. Wat er daarna gebeurt is de echte code.

   De vertraging op het opzoeken van de map maakt van de wedloop een zekerheid,
   zoals ook in test/scanner.e2e.js. Zonder de wachtende zoekMap() zakt hij. */
test('Memo: opnemen en stoppen bewaart in de map Memo\'s, ook als het opzoeken traag is',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-memo-opname-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, ANTHROPIC_API_KEY: '' } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const reg = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Opnamelid', email: 'mo' + u + '@x.nl', phone: '06' + u,
        password: 'geheim123', geboortedatum: '1992-04-04', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());
    assert.ok(reg.token, 'het opnamelid is aangemeld');
    const api = (pad, body) => fetch(base + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: JSON.stringify(body || {}) }).then(r => r.json());

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    /* De map wordt traag opgezocht, en de dubbelganger van de recorder is klaar
       voordat dat rond is -- de wedloop die op een drukke telefoon vanzelf
       ontstaat, hier met de klok vastgezet. */
    await page.addInitScript(() => {
      const echt = window.fetch;
      window.fetch = function (p, o) {
        if (String(p).includes('/api/bestanden/mijn'))
          return new Promise(r => setTimeout(() => r(echt(p, o)), 1200));
        return echt(p, o);
      };
    });
    await page.goto(base + '/apps/memo.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => {
      localStorage.setItem('rtg_member_token', t);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/memo.html', { waitUntil: 'domcontentloaded' });

    await page.evaluate(() => {
      const spoor = { stop() {} };
      window.RTGMedia = window.RTGMedia || {};
      window.RTGMedia.microfoon = () => Promise.resolve({ getTracks: () => [spoor] });
      window.MediaRecorder = function () {
        this.mimeType = 'audio/webm';
        this.start = function () {};
        this.stop = function () {
          if (this.ondataavailable) this.ondataavailable({ data: new Blob(['geluid'], { type: 'audio/webm' }) });
          if (this.onstop) this.onstop();
        };
      };
    });

    /* opnemen en meteen stoppen: dat is sneller dan het opzoeken van de map */
    await page.evaluate(() => { document.querySelector('#opneem').click(); });
    await page.waitForFunction(() => /Stop en bewaar/.test(document.querySelector('#opneem').textContent),
      null, { timeout: 8000 });
    await page.evaluate(() => { document.querySelector('#opneem').click(); });
    await page.waitForFunction(() => /bewaard in je kluis/.test(document.querySelector('#melding').textContent),
      null, { timeout: 20000 });

    const kluis = await api('/api/bestanden/mijn', {});
    const map = (kluis.mappen || []).find(m => m.naam === "Memo's");
    const memo = (kluis.items || []).find(x => /^memo-.*\.webm$/.test(x.naam));
    assert.ok(map, 'de map Memo\'s bestaat');
    assert.ok(memo, 'er staat een memo in de kluis');
    assert.equal(memo.map, map.id, 'en hij staat IN de map Memo\'s, niet ernaast');

    /* en de lijst laat hem ook zien -- die filtert op dezelfde map */
    await page.waitForFunction(() => document.querySelectorAll('#lijst .memo').length === 1,
      null, { timeout: 20000 });

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
