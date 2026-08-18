/* GAAT ER OOK ECHT BEELD OVER? -- de clipdeler tussen twee browsers.

   test/clipdeler.test.js bewaakt dat het protocol maar op ÉÉN plek staat. Dat
   is een uitspraak over de bron. Deze toets stelt de andere vraag, en het is de
   vraag die telt: reist een korte video werkelijk van het toestel van de maker
   naar dat van de kijker, en speelt hij in de Media OS -- zonder dat de bytes
   RTG ooit passeren.

   WAAROM DIT HIER MOET STAAN. Voor deze ronde bestond er geen enkele toets die
   het clip-protocol ooit heeft zien LOPEN. De serverkant is goed gedekt (de
   kaart, de rechten, het doorgeefluik), maar dat is precies de helft die geen
   beeld verplaatst. Een refactor van de kijker naar een gedeelde laag zonder
   zo'n toets is een verhuizing in het donker.

   HOE. Twee browsercontexten met elk hun eigen toestelopslag (OPFS): de maker
   zet een clip in zijn eigen archief, de kijker opent /apps/media.html in de
   stand FLOW en drukt op spelen. Het beeld zelf is een klein blokje bytes -- of
   de codec het kan decoderen doet er niet toe, de vraag is of de bytes
   aankomen en of de speler ze in beeld zet.

   Draai: npm run e2e   (of los: node --experimental-sqlite --test test/clipdeler.e2e.js) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('een clip reist van toestel naar toestel en speelt in de Media OS en in Clips',
  { skip: geenBrowser(pw) }, async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-clipdeler-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const api = (pad, lijf, token) => fetch(base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(lijf || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
    const lid = async (naam, n) => {
      const u = (Date.now() + n).toString().slice(-8);
      const r = await api('/api/auth/register', { name: naam, email: 'cd' + u + '@x.nl', phone: '06' + u,
        password: 'geheim12345', geboortedatum: '1988-08-08', tier: 'rtg', pasApp: 'rtg' });
      assert.ok(r.body.token, naam + ' is ingelogd');
      return r.body.token;
    };
    const maker = await lid('Clipmaker', 1);
    const kijker = await lid('Clipkijker', 2);

    const gemaakt = await api('/api/clips/maak', { titel: 'Regen op het dek', duurS: 6, mbGeschat: 1 }, maker);
    assert.equal(gemaakt.status, 200);
    const clipId = gemaakt.body.id;

    browser = await pw.chromium.launch(browserOpties(pw));
    const metToken = async (token) => {
      const ctx = await browser.newContext({ viewport: { width: 900, height: 800 }, serviceWorkers: 'block' });
      await ctx.addInitScript((tok) => {
        try { localStorage.setItem('rtg_member_token', tok); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
      }, token);
      return ctx;
    };

    /* ---- de maker: de clip komt in ZIJN eigen toestelarchief ----
       Via dezelfde deler die de pagina zelf gebruikt; daarna herladen, zodat
       het de gewone clips.html-instantie is die hem straks uitdient. */
    const makerCtx = await metToken(maker);
    const makerPagina = await makerCtx.newPage();
    /* 'load' en niet 'networkidle': deze pagina's houden een SSE-verbinding
       open, dus het netwerk wordt nooit stil. Daar liep deze toets eerst 30
       seconden op vast -- de wachtregel was fout, niet de app. */
    await makerPagina.goto(base + '/apps/clips.html', { waitUntil: 'load' });
    await makerPagina.waitForFunction(() => !!window.RTGClipDeler, null, { timeout: 15000 });
    const bewaard = await makerPagina.evaluate(async ({ id, tok }) => {
      const deler = window.RTGClipDeler.start({ token: tok });
      // een klein blokje bytes met een geldige webm-kop; decoderen hoeft niet
      const kop = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);
      const romp = new Uint8Array(20000).fill(7);
      await deler.bewaar(id, new Blob([kop, romp], { type: 'video/webm' }));
      const terug = await deler.heeft(id);
      deler.stop();
      return terug ? terug.size : 0;
    }, { id: clipId, tok: maker });
    assert.equal(bewaard, 20004, 'de clip staat in het archief van de maker, en nergens anders');

    // het bewijs dat RTG die bytes NIET heeft: de datamap kent alleen de kaart
    const bestanden = [];
    (function loop(d) {
      for (const f of fs.readdirSync(d)) {
        const vol = path.join(d, f);
        if (fs.statSync(vol).isDirectory()) loop(vol); else bestanden.push(f);
      }
    })(TMP);
    assert.ok(!bestanden.some(f => f.includes(clipId)), 'er ligt geen clipbestand bij RTG');

    await makerPagina.reload({ waitUntil: 'load' });
    await makerPagina.waitForTimeout(800);   // de pagina meldt zijn aanwezigheid

    /* ---- de kijker: /apps/media.html, stand FLOW, en spelen ---- */
    const kijkCtx = await metToken(kijker);
    const kijkPagina = await kijkCtx.newPage();
    // via het gedeelde hulpje, zodat bekende browserruis niet als fout telt
    const fouten = letOpFouten(kijkPagina, []);
    await kijkPagina.goto(base + '/apps/media.html', { waitUntil: 'load' });
    await kijkPagina.waitForSelector('.standen button');
    await kijkPagina.evaluate(() => {
      const knoppen = [...document.querySelectorAll('.standen button')];
      const flow = knoppen.find(b => /flow/i.test(b.textContent));
      flow.click();
    });
    await kijkPagina.waitForSelector('.stuk .t');
    const titel = await kijkPagina.$eval('.stuk .t', e => e.textContent);
    assert.equal(titel, 'Regen op het dek', 'de clip staat in FLOW');
    const knopTekst = await kijkPagina.$eval('.stuk .rij .knop', e => e.textContent);
    assert.match(knopTekst, /Speel/, 'en er staat een speelknop, geen doorverwijzing');

    await kijkPagina.click('.stuk .rij .knop');
    /* Het beeld komt binnen over het datakanaal; dat duurt even (aanbod,
       antwoord, kandidaten). Faalt hij, dan faalt hij op de wachttijd -- en
       dat is precies wat deze toets hoort te doen. */
    await kijkPagina.waitForFunction(() => {
      const v = document.querySelector('#clipfilm');
      return v && v.src && v.src.indexOf('blob:') === 0;
    }, null, { timeout: 25000 });

    const status = await kijkPagina.$eval('#clipvlak .status', e => e.textContent);
    assert.match(status, /rechtstreeks ontvangen/, 'de speler zegt zelf waar het beeld vandaan kwam');
    assert.deepEqual(fouten, [], 'geen fout op de pagina van de kijker');

    /* ---- en dezelfde clip in Clips zelf ----
       Dat is de pagina die bij deze verhuizing het meest veranderde: haar
       eigen kijker is eruit gehaald en vervangen door de gedeelde laag. Zonder
       deze helft zou de toets bewijzen dat de NIEUWE app werkt terwijl de
       oude stilletjes stuk is. Een tweede kijker, want de eerste heeft de
       clip inmiddels in zijn cache staan en zou hem daaruit spelen. */
    const tweede = await lid('Tweede kijker', 3);
    const tweedeCtx = await metToken(tweede);
    const clipsPagina = await tweedeCtx.newPage();
    const foutenClips = letOpFouten(clipsPagina, []);
    await clipsPagina.goto(base + '/apps/clips.html', { waitUntil: 'load' });
    await clipsPagina.waitForSelector('.clip .laag .knop');
    await clipsPagina.click('.clip .laag .knop');
    await clipsPagina.waitForFunction(() => {
      const v = document.querySelector('.clip video');
      return v && v.src && v.src.indexOf('blob:') === 0;
    }, null, { timeout: 25000 });
    assert.deepEqual(foutenClips, [], 'geen fout in Clips zelf');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
