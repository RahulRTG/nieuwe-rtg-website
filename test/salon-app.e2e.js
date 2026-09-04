/* Scherm-test voor De Salon-app. De unit-toetsen (test/salon-app.test.js)
   bewijzen de server-kant; deze bewijst dat het SCHERM het doet: plaatsen vanaf
   het tabblad zelf, de post die daarna in je eigen profiel staat, reageren in
   de app, en de eerlijke grens onderaan de feed ("Je bent bij.") in plaats van
   een oneindige scroll.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();
const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();

test('De Salon: plaatsen, je eigen raster, reageren en een eerlijk einde aan de feed',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-salon-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const maak = async (n) => {
      const t = Date.now() + '' + n;
      return (await api(base, '/api/auth/register', { name: 'Lid ' + t, email: 'q' + t + '@v.test',
        phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-02-02', tier: 'rtg' })).token;
    };
    const a = await maak(1), b = await maak(2);
    const ik = await api(base, '/api/salon/lid', { wie: 'ik' }, a);

    // B volgt A en zet er alvast 25 posts op, zodat de feed echt moet bladeren
    await api(base, '/api/salon/volg-lid', { wie: ik.codenaam, aan: true }, b);
    for (let i = 0; i < 25; i++) await api(base, '/api/salon/plaats', { tekst: 'Notitie ' + i + ' #reeks' }, a);

    browser = await pw.chromium.launch(browserOpties(pw));
    const fouten = [];
    const zetSessie = (page) => page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, a);

    // Een eigen context voorkomt dat de sociale serviceworker dit scherm of de
    // Salon uit zijn cache levert: beide blijven zo aantoonbare navigaties.
    const priveContext = await browser.newContext();
    const privePage = await priveContext.newPage();
    letOpFouten(privePage, fouten);
    await zetSessie(privePage);
    await privePage.goto(base + '/apps/sociaal-prive.html', { waitUntil: 'domcontentloaded' });
    await privePage.waitForSelector('#privateRooms', { timeout: 10000 });
    const prive = await privePage.evaluate(() => ({
      pad: location.pathname,
      titel: document.querySelector('#privateTitle')?.textContent || '',
      kamers: [...document.querySelectorAll('#privateRooms .private-room')].map((a) => a.getAttribute('href')),
      tekst: document.body.textContent || ''
    }));
    assert.equal(prive.pad, '/apps/sociaal-prive.html');
    assert.match(prive.titel, /Ruimte voor wat niet openbaar hoeft/);
    assert.deepEqual(prive.kamers, [
      '/apps/meet.html', '/apps/vonk.html', '/apps/rendezvous.html',
      '/apps/cercle.html', '/apps/entourage.html', '/apps/attenties.html'
    ]);
    assert.match(prive.tekst, /pas na uw bevestiging/);
    await priveContext.close();

    const page = await browser.newPage();
    letOpFouten(page, fouten);
    await zetSessie(page);
    await page.goto(base + '/apps/salon.html', { waitUntil: 'domcontentloaded' });

    // 1. de feed komt op en houdt op bij de eerste bladzijde, met een knop
    await page.waitForSelector('[data-post]', { timeout: 15000 });
    const eerste = await page.evaluate(() => document.querySelectorAll('[data-post]').length);
    assert.ok(eerste > 0 && eerste <= 20, 'de eerste bladzijde is er, en is een bladzijde: ' + eerste);
    const meerKnop = await page.evaluate(() => !!document.querySelector('#meer'));
    assert.equal(meerKnop, true, 'er is een knop om verder te lezen, geen scroll die zichzelf aanvult');

    // 2. verder lezen voegt toe, en aan het einde staat het er eerlijk
    await page.click('#meer');
    await page.waitForFunction((n) => document.querySelectorAll('[data-post]').length > n, eerste, { timeout: 10000 });
    await page.waitForFunction(() => !document.querySelector('#meer'), null, { timeout: 15000 })
      .catch(async () => { await page.click('#meer'); await page.waitForFunction(() => !document.querySelector('#meer'), null, { timeout: 10000 }); });
    const slot = await page.evaluate(() => document.querySelector('#main').textContent);
    assert.ok(/Je bent bij/.test(slot), 'de app zegt eerlijk wanneer je bij bent');

    // 3. zelf plaatsen vanaf het tabblad
    await page.click('[data-t="plaats"]');
    await page.waitForSelector('#ptekst', { timeout: 10000 });
    await page.evaluate(() => {
      const t = document.querySelector('#ptekst');
      t.value = 'Een avond aan de kade, geschreven vanaf het scherm. #kade';
      document.querySelector('#pplaats').value = 'Ibiza';
    });
    await page.click('#plaatsknop');
    await page.waitForFunction(() => /kade/.test(document.querySelector('#main').textContent), null, { timeout: 15000 });

    // 4. de post staat in je eigen profiel (het raster van "Ik")
    await page.click('[data-t="ik"]');
    await page.waitForSelector('[data-open]', { timeout: 10000 });
    const raster = await page.evaluate(() => document.querySelector('#main').textContent);
    assert.ok(/kade/.test(raster), 'je eigen post staat in je eigen raster');

    // 5. reageren in de app zelf, zonder weg te navigeren
    await page.click('[data-t="feed"]');
    await page.waitForSelector('[data-reacties]', { timeout: 10000 });
    await page.click('[data-reacties]');
    await page.waitForSelector('#rtekst', { timeout: 10000 });
    await page.evaluate(() => { document.querySelector('#rtekst').value = 'Mooi gezegd.'; });
    await page.click('#rknop');
    await page.waitForFunction(() => /Mooi gezegd/.test(document.querySelector('#main').textContent), null, { timeout: 15000 });
    const pad = await page.evaluate(() => location.pathname);
    assert.equal(pad, '/apps/salon.html', 'we zijn nergens heen genavigeerd');

    // 6. inzicht: je eigen cijfers, met de reactie die we net plaatsten erin
    await page.click('[data-t="inzicht"]');
    await page.waitForFunction(() => /Wat jouw posts deden/.test(document.querySelector('#main').textContent), null, { timeout: 10000 });
    const cijfers = await page.evaluate(() => document.querySelector('#main').textContent);
    assert.ok(/1 reacties/.test(cijfers), 'de reactie is geteld in je eigen spiegel: ' + cijfers.slice(0, 120));
    assert.ok(/#kade/.test(cijfers), 'en je onderwerp staat erbij');

    // 7. archiveren vanuit het inzicht: de post verlaat je raster maar blijft bestaan
    await page.click('[data-arch]');
    await page.waitForFunction(() => /terugzetten/.test(document.querySelector('#main').textContent), null, { timeout: 10000 });
    await page.click('[data-t="ik"]');
    await page.waitForSelector('[data-open]', { timeout: 10000 });
    await page.waitForFunction(() => !/kade/.test(document.querySelector('#main').textContent), null, { timeout: 10000 });
    await page.click('[data-t="inzicht"]');
    await page.waitForFunction(() => /archief/.test(document.querySelector('#main').textContent), null, { timeout: 10000 });
    await page.click('#archknop');
    await page.waitForFunction(() => /Je archief/.test(document.querySelector('#main').textContent), null, { timeout: 10000 });
    const kast = await page.evaluate(() => document.querySelector('#main').textContent);
    assert.ok(/kade/.test(kast), 'in het archief staat hij er nog gewoon');

    // 8. de AI-balk staat er: in deze app typ je tegen Rahul wat er moet gebeuren
    const balk = await page.evaluate(() => !!document.querySelector('#aiform') && !!document.querySelector('#aiin'));
    assert.equal(balk, true, 'de AI-balk staat op de app');

    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
