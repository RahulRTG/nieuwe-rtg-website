/* DE LESSLEUTEL VERLAAT DE URL, IN EEN ECHTE BROWSER (besluit B25, RELEASEKANDIDAAT.md).

   test/foundation-lesstroom.test.js beproeft de server; hier de WEG, met de
   schermen zelf:
   1. De begeleider start een les vanuit leren.html en komt op het bord.
   2. Een leerling doet mee via de deellink en komt in zijn schrift.
   3. Beide live-stromen werken: het bord ziet de leerling binnenkomen
      (presentie) en het schrift krijgt een opgave van het bord (SSE).
   4. Een herladen schrift opent de stroom met een NIEUW ticket.
   5. Over beide schermen en over elke paginawissel heen draagt GEEN enkele
      request-URL, Referer of adresbalk (op het moment van een verzoek) een
      lescode, leraar- of leerlingsleutel, of een ?token=.

   Draai los: node --test test/lesstroom.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser,
  wachtTot, wachtOpTekst } = require('./helper');

const pw = laadPlaywright();
const OVERSLAAN = geenBrowser(pw);
/* Lescode (LES.), leraarssleutel (LESLR.) en leerlingsleutel (LESLL.); het
   stroomticket (LESST.) mag wel in het adres van de stroom staan. */
const SLEUTEL = /LES(?:LR|LL)?\.[0-9A-F]{32}/i;

let child, base, browser, TMP, BEHEERDER, MILAN;

const post = async (pad, body) => {
  const r = await fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

test.before(async () => {
  if (OVERSLAAN) return;
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lesstroom-'));
  ({ child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }));
  const gezin = (await post('/api/foundation/gezin/maak', { gezinsnaam: 'Stroomgezin', naam: 'Papa',
    pin: '1234', geboortedatum: '1985-01-01', bevoegdGezin: true, privacyAkkoord: true })).body;
  assert.ok(gezin.token, 'het gezin bestaat: ' + JSON.stringify(gezin).slice(0, 160));
  BEHEERDER = { code: gezin.code, token: gezin.token, profiel: { naam: 'Papa', beheerder: true } };
  const p = (await post('/api/foundation/gezin/profiel/maak', { code: gezin.code, token: gezin.token,
    naam: 'Milan', rol: 'kind', geboortedatum: '2015-04-04', pin: '5678' })).body;
  const kies = (await post('/api/foundation/gezin/profiel/kies', { gezinscode: gezin.gezinscode, profielId: p.profiel.id, pin: '5678' })).body;
  assert.ok(kies.token, 'Milan kiest zijn profiel');
  MILAN = { code: gezin.code, token: kies.token, profiel: kies.profiel };
  browser = await pw.chromium.launch(browserOpties(pw));
});

test.after(async () => {
  if (browser) try { await browser.close(); } catch (e) { /* al dicht */ }
  if (child) await stop(child);
  if (TMP) try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* weg is weg */ }
});

/* Een context met de gezinssessie, een netwerkspion op CONTEXTniveau (die
   overleeft elke paginawissel) en een spion in de pagina die bij elk verzoek de
   adresbalk noteert, in sessionStorage zodat het spoor de overstap overleeft. */
async function openAls(sessie) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.addInitScript((s) => {
    localStorage.setItem('rtf_sessie', JSON.stringify(s));
    localStorage.setItem('rtg_lang', 'nl');
    localStorage.setItem('rtg_cookieinfo_v1', '1');
  }, sessie);
  await ctx.addInitScript(() => {
    const noteer = (wat) => {
      const log = JSON.parse(sessionStorage.getItem('__adresBijVerzoek') || '[]');
      log.push(wat + ' @ ' + location.href);
      sessionStorage.setItem('__adresBijVerzoek', JSON.stringify(log));
    };
    const f = window.fetch;
    window.fetch = function (u) { noteer('fetch ' + (u && u.url ? u.url : u)); return f.apply(this, arguments); };
    if (window.EventSource) {
      const E = window.EventSource;
      window.EventSource = function (u, c) { noteer('sse ' + u); return new E(u, c); };
      window.EventSource.prototype = E.prototype;
    }
    if (navigator.sendBeacon) {
      const b = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = (u, d) => { noteer('beacon ' + u); return b(u, d); };
    }
  });
  const verzoeken = [];
  ctx.on('request', (r) => verzoeken.push({ url: r.url(), referer: r.headers().referer || '',
    auth: r.headers().authorization || '' }));
  ctx.on('response', (r) => { const v = verzoeken.find((x) => x.url === r.url() && x.status === undefined); if (v) v.status = r.status(); });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  return { ctx, page, fouten, verzoeken };
}

function schoon(wie, verzoeken, adressen) {
  for (const r of verzoeken) {
    assert.doesNotMatch(r.url, SLEUTEL, wie + ': sleutel in een request-URL: ' + r.url);
    assert.doesNotMatch(r.url, /[?&](token|t)=/, wie + ': token-parameter in een request-URL: ' + r.url);
    assert.doesNotMatch(r.referer, SLEUTEL, wie + ': sleutel in een Referer: ' + r.url);
  }
  for (const a of adressen) assert.doesNotMatch(a, SLEUTEL, wie + ': adresbalk droeg een sleutel bij: ' + a);
}

test('leraar en leerling: de live-stroom werkt en geen request-URL draagt een lessleutel',
  { skip: OVERSLAAN }, async () => {
    const docent = await openAls(BEHEERDER);
    const leerling = await openAls(MILAN);
    try {
      /* 1. DE BEGELEIDER START EEN LES. */
      const bord = docent.page;
      await bord.goto(base + '/apps/foundation/leren.html', { waitUntil: 'domcontentloaded' });
      await wachtTot(bord, () => !!document.getElementById('dStart'), null, { wat: 'het venster Nieuwe les' });
      await bord.evaluate(() => document.getElementById('dlgDocent').showModal());
      await bord.fill('#dVak', 'Rekenen');
      await bord.fill('#dNaam', 'Juf');
      await bord.locator('#dStart').click();
      await bord.waitForURL(/\/apps\/foundation\/bord\.html\?code=/);
      await wachtTot(bord, () => /^LES\.[A-F0-9]{32}$/.test(document.querySelector('#lesCode').textContent), null,
        { wat: 'de lescode op het bord' });
      for (let i = 0; i < 50 && !docent.verzoeken.some((r) => r.url.endsWith('/les/stroomticket') && r.status); i++)
        await new Promise((r) => setTimeout(r, 100));
      const t = docent.verzoeken.find((r) => r.url.endsWith('/api/foundation/les/stroomticket'));
      assert.equal(t && t.status, 200, 'het bord haalt een stroomticket');
      assert.match(t.auth, /^Bearer LESLR\./, 'met de leraarssleutel in de kop');
      const lescode = await bord.evaluate(() => document.querySelector('#lesCode').textContent);

      /* 2. DE LEERLING DOET MEE VIA DE DEELLINK. */
      const p = leerling.page;
      await p.goto(base + '/apps/foundation/leren.html#les=' + lescode, { waitUntil: 'domcontentloaded' });
      await wachtTot(p, () => document.querySelector('#dlgLeerling').open, null, { wat: 'het venster Meedoen' });
      await p.fill('#lNaam', 'Milan');
      await p.locator('#lJoin').click();
      await p.waitForURL(/\/apps\/foundation\/schrift\.html\?code=/);

      /* 3. BEIDE STROMEN LEVEN. */
      await wachtOpTekst(bord, 'Milan', { in: '#llLijst' });
      await wachtTot(p, () => !!document.querySelector('#liveDot.aan'), null, { wat: 'het schrift is live' });
      await bord.fill('#opgTekst', 'Wat is 6 x 9?');
      await bord.locator('#opgZet').click();
      await wachtTot(p, () => document.querySelector('#opgLijst').textContent.includes('6 x 9'), null,
        { wat: 'de opgave komt live in het schrift' });

      /* 4. HERLADEN: een nieuw ticket, want elk ticket werkt maar een keer. */
      await p.reload({ waitUntil: 'domcontentloaded' });
      await wachtTot(p, () => document.querySelector('#opgLijst').textContent.includes('6 x 9'), null,
        { wat: 'het schrift na herladen' });
      const ticketsVan = (v) => [...new Set(v.map((r) => (/[?&]ticket=([^&]+)/.exec(r.url) || [])[1]).filter(Boolean))];
      for (let i = 0; i < 50 && ticketsVan(leerling.verzoeken).length < 2; i++) await new Promise((r) => setTimeout(r, 100));
      const lt = ticketsVan(leerling.verzoeken);
      assert.ok(lt.length >= 2, 'het herladen schrift opende de stroom met een nieuw ticket: ' + lt.length);
      for (const x of lt) assert.match(decodeURIComponent(x), /^LESST\.[0-9A-F]{32}$/);
      assert.ok(ticketsVan(docent.verzoeken).length >= 1, 'het bord opende de stroom met een ticket');

      /* 5. NERGENS EEN SLEUTEL IN EEN ADRES. */
      const adr = async (pg) => pg.evaluate(() => JSON.parse(sessionStorage.getItem('__adresBijVerzoek') || '[]'));
      const bordAdr = await adr(bord), schriftAdr = await adr(p);
      assert.ok(bordAdr.some((a) => a.includes('/bord.html')), 'de spion zag verzoeken van het bord');
      assert.ok(schriftAdr.some((a) => a.includes('/schrift.html')), 'de spion zag verzoeken van het schrift');
      assert.ok(leerling.verzoeken.some((r) => /\/api\/foundation\/schrift\//.test(r.url)), 'het schrift las zichzelf');
      schoon('bord', docent.verzoeken, bordAdr);
      schoon('schrift', leerling.verzoeken, schriftAdr);
      assert.deepEqual(docent.fouten, [], 'geen JS-fouten op het bord: ' + docent.fouten.join(' | '));
      assert.deepEqual(leerling.fouten, [], 'geen JS-fouten in het schrift: ' + leerling.fouten.join(' | '));
    } finally {
      await docent.ctx.close();
      await leerling.ctx.close();
    }
  });
