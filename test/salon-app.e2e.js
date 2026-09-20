/* Scherm-test voor De Salon-app. De unit-toetsen (test/salon-app.test.js)
   bewijzen de server-kant; deze bewijst dat het SCHERM het doet: plaatsen vanaf
   het tabblad zelf, de post die daarna in je eigen profiel staat, reageren in
   de app, en de eerlijke grens onderaan de feed ("Je bent bij.") in plaats van
   een oneindige scroll.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { edgeBediening, startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const http = require('http');
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
  const spraakModel = http.createServer((req, res) => {
    req.resume(); req.on('end', () => { res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ text: 'Welkom aan het water.',
        segments: [{ start: 0, end: 2.5, text: 'Welkom aan het water.' }] })); });
  });
  await new Promise(resolve => spraakModel.listen(0, '127.0.0.1', resolve));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP,
    LOCAL_AI_URL: 'http://127.0.0.1:' + spraakModel.address().port,
    LOCAL_AI_MODEL_SPRAAK: 'salon-whisper' } });
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

    // 3. zelf een foto EN video plaatsen vanaf het tabblad. De browser geeft
    // echte bestanden aan het invoerveld; dit bewijst dus ook de change-handler,
    // de rauwe upload, het plaatsverzoek en de twee feed-elementen samen.
    await edgeBediening(page, 'Plaatsen');
    await page.waitForSelector('#ptekst', { timeout: 10000 });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(256, 7)]);
    await page.setInputFiles('#pfotos', [
      { name: 'avond.png', mimeType: 'image/png', buffer: png },
      { name: 'avond.webm', mimeType: 'video/webm', buffer: webm }
    ]);
    await page.waitForFunction(() => document.querySelectorAll('#mini figure').length === 2, null, { timeout: 10000 });
    await page.evaluate(() => {
      const t = document.querySelector('#ptekst');
      t.value = 'Een avond aan de kade, geschreven vanaf het scherm. #kade';
      document.querySelector('#pplaats').value = 'Ibiza';
      const beschrijvingen = document.querySelectorAll('[data-alt]');
      beschrijvingen[0].value = 'Avondlicht aan de kade'; beschrijvingen[0].dispatchEvent(new Event('input'));
      beschrijvingen[1].value = 'Korte beweging aan het water'; beschrijvingen[1].dispatchEvent(new Event('input'));
    });
    await page.click('[data-auto="1"]');
    await page.waitForFunction(() => /ondertitels staan klaar/i.test(document.querySelector('#mediaStatus').textContent), null, { timeout: 15000 });
    assert.match(await page.inputValue('[data-ond="1"]'), /Welkom aan het water/,
      'het lokale spraakmodel heeft de tijdregel in het bewerkbare veld gezet');
    await page.click('#plaatsknop');
    await page.waitForFunction(() => /kade/.test(document.querySelector('#main').textContent), null, { timeout: 15000 });
    await page.waitForSelector('[data-post][data-media="ja"] video', { timeout: 10000 });
    const mediaInFeed = await page.evaluate(() => {
      const post = document.querySelector('[data-post][data-media="ja"]');
      const vlak = post.querySelector('.salon-video');
      return { fotos: post.querySelectorAll('img').length, videos: post.querySelectorAll('video').length,
        foto: post.querySelector('img')?.getAttribute('src'), video: post.querySelector('video')?.getAttribute('src'),
        videoControls: post.querySelector('video')?.controls,
        ondertitels: JSON.parse(decodeURIComponent(vlak?.dataset.ondertitels || '%5B%5D')),
        band: !!vlak?.querySelector('.ondert') };
    });
    assert.equal(mediaInFeed.fotos, 1, 'de foto staat in de feed');
    assert.equal(mediaInFeed.videos, 1, 'de video staat in de feed');
    assert.match(mediaInFeed.foto || '', /^\/media\//);
    assert.match(mediaInFeed.video || '', /^\/media\//);
    assert.equal(mediaInFeed.videoControls, true, 'de video is bedienbaar en start niet vanzelf');
    assert.equal(mediaInFeed.band, true, 'de gedeelde ondertitelband is aan de speler gekoppeld');
    assert.equal(mediaInFeed.ondertitels[0].tekst, 'Welkom aan het water.');
    const mediaPostId = await page.evaluate(() => document.querySelector('[data-post][data-media="ja"]')?.getAttribute('data-post'));
    assert.ok(mediaPostId, 'de mediapost heeft een adres voor profiel en archief');

    // 4. de post staat in je eigen profiel (het raster van "Ik")
    await edgeBediening(page, 'Mijn profiel');
    await page.waitForSelector('[data-open]', { timeout: 10000 });
    const rasterMedia = await page.evaluate((id) => {
      const tegel = document.querySelector('[data-open="' + id + '"]');
      return { bestaat: !!tegel, beeld: tegel?.querySelector('img')?.getAttribute('alt') || '' };
    }, mediaPostId);
    assert.equal(rasterMedia.bestaat, true, 'je eigen mediapost staat in je eigen raster');
    assert.match(rasterMedia.beeld, /Avondlicht/, 'het raster bewaart ook de beschrijving');

    // 5. reageren in de app zelf, zonder weg te navigeren
    await edgeBediening(page, 'Feed');
    await page.waitForSelector('[data-reacties]', { timeout: 10000 });
    await page.click('[data-reacties]');
    await page.waitForSelector('#rtekst', { timeout: 10000 });
    await page.evaluate(() => { document.querySelector('#rtekst').value = 'Mooi gezegd.'; });
    await page.click('#rknop');
    await page.waitForFunction(() => /Mooi gezegd/.test(document.querySelector('#main').textContent), null, { timeout: 15000 });
    const pad = await page.evaluate(() => location.pathname);
    assert.equal(pad, '/apps/salon.html', 'we zijn nergens heen genavigeerd');

    // 6. inzicht: je eigen cijfers, met de reactie die we net plaatsten erin
    await edgeBediening(page, 'Inzicht');
    await page.waitForFunction(() => /Wat jouw posts deden/.test(document.querySelector('#main').textContent), null, { timeout: 10000 });
    const cijfers = await page.evaluate(() => document.querySelector('#main').textContent);
    assert.ok(/1 reacties/.test(cijfers), 'de reactie is geteld in je eigen spiegel: ' + cijfers.slice(0, 120));
    assert.ok(/#kade/.test(cijfers), 'en je onderwerp staat erbij');

    // 7. archiveren vanuit het inzicht: de post verlaat je raster maar blijft bestaan
    await page.click('[data-arch="' + mediaPostId + '"]');
    await page.waitForFunction(() => /terugzetten/.test(document.querySelector('#main').textContent), null, { timeout: 10000 });
    await edgeBediening(page, 'Mijn profiel');
    await page.waitForSelector('[data-open]', { timeout: 10000 });
    await page.waitForFunction((id) => !document.querySelector('[data-open="' + id + '"]'), mediaPostId, { timeout: 10000 });
    await edgeBediening(page, 'Inzicht');
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
    await new Promise(resolve => spraakModel.close(resolve));
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
