/* DE DEELLINK VAN DE LESCODE IN EEN ECHTE BROWSER (besluit B20, RELEASEKANDIDAAT.md).

   test/lesdeel.test.js legt de stukken los vast; hier de WEG, van bord tot schrift:
   1. Het bord vernieuwt de lescode en toont link + QR; de QR wordt van het CANVAS
      gelezen met de eigen scanner en moet precies de link opleveren.
   2. De leerling opent die link: "Meedoen" staat open met de volledige code, en
      het fragment is uit de adresbalk voordat hij drukt.
   3. "Doe mee" geeft 200, hij komt in zijn schrift en staat op het bord.
   4. Het geheim stond in geen request-URL, geen Referer, en in geen location.href
      op het moment van een fetch/XHR/EventSource/sendBeacon van de pagina.

   NIET beproefd: een leerling zonder gezinsprofiel (de code staat alleen in
   geheugen; hij scant opnieuw).

   Draai los: node --test test/lesdeellink.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser,
  wachtTot, wachtOpTekst } = require('./helper');
const Scanner = require('../public/shared/scanner');

const pw = laadPlaywright();
const OVERSLAAN = geenBrowser(pw);

let child, base, browser, TMP, BEHEERDER, MILAN;

const post = async (pad, body) => {
  const r = await fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

test.before(async () => {
  if (OVERSLAAN) return;
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lesdeellink-'));
  ({ child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }));
  const gezin = (await post('/api/foundation/gezin/maak', { gezinsnaam: 'Deelgezin', naam: 'Papa',
    pin: '1234', geboortedatum: '1985-01-01', bevoegdGezin: true, privacyAkkoord: true })).body;
  assert.ok(gezin.token, 'het gezin bestaat: ' + JSON.stringify(gezin).slice(0, 160));
  BEHEERDER = { code: gezin.code, token: gezin.token, profiel: { naam: 'Papa', beheerder: true } };
  const p = (await post('/api/foundation/gezin/profiel/maak', { code: gezin.code, token: gezin.token,
    naam: 'Milan', rol: 'kind', geboortedatum: '2015-04-04', pin: '5678' })).body;
  assert.ok(p.profiel && p.profiel.id, 'Milan bestaat: ' + JSON.stringify(p).slice(0, 160));
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

async function openAls(sessie, spion) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.addInitScript((s) => {
    localStorage.setItem('rtf_sessie', JSON.stringify(s));
    localStorage.setItem('rtg_lang', 'nl');
    localStorage.setItem('rtg_cookieinfo_v1', '1');
  }, sessie);
  if (spion) {
    /* Bij elk verzoek dat de PAGINA doet: waar stond de adresbalk op dat moment? */
    await ctx.addInitScript(() => {
      // in sessionStorage: het spoor overleeft de overstap naar schrift.html
      const noteer = (wat) => {
        const log = JSON.parse(sessionStorage.getItem('__adresBijVerzoek') || '[]');
        log.push(wat + ' @ ' + location.href);
        sessionStorage.setItem('__adresBijVerzoek', JSON.stringify(log));
      };
      const f = window.fetch;
      window.fetch = function (u) { noteer('fetch ' + (u && u.url ? u.url : u)); return f.apply(this, arguments); };
      const o = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (m, u) { noteer('xhr ' + u); return o.apply(this, arguments); };
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
  }
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  return { ctx, page, fouten };
}

test('een leerling komt via de deellink van het bord in de les, en het geheim blijft nergens hangen',
  { skip: OVERSLAAN }, async () => {
    const les = (await post('/api/foundation/les/maak', { vak: 'Rekenen', naam: 'Juf', idem: 'deellink-e2e-1' })).body;
    assert.ok(les.lesId && les.token, 'de les bestaat: ' + JSON.stringify(les).slice(0, 120));

    /* 1. HET BORD, sleutel in de schoolsessie (B25: geen ?t=); roteren. */
    const docent = await openAls(BEHEERDER, false);
    const leerling = await openAls(MILAN, true);
    try {
      const bord = docent.page;
      await bord.goto(base + '/apps/foundation/leren.html', { waitUntil: 'domcontentloaded' });
      await bord.evaluate((l) => window.RTGSchoolSession.zet('rtf_docent', { code: l.lesId, token: l.token }), les);
      await bord.goto(base + '/apps/foundation/bord.html?code=' + les.lesId, { waitUntil: 'domcontentloaded' });
      assert.equal(await bord.locator('#btnDeel').isHidden(), true, 'zonder lescode is er niets te delen');
      const roteer = bord.waitForResponse((r) => r.url().endsWith('/api/foundation/les/code/roteer'));
      await bord.locator('#btnKopieer').click();
      assert.equal((await roteer).status(), 200, 'de lescode is vernieuwd');
      await wachtTot(bord, () => /^LES\.[A-F0-9]{32}$/.test(document.querySelector('#lesCode').textContent), null, { wat: 'de lescode op het bord' });
      const lescode = await bord.evaluate(() => document.querySelector('#lesCode').textContent);
      await bord.locator('#btnDeel').click();
      await wachtTot(bord, () => !!document.querySelector('#deelQrBeeld'), null, { wat: 'de QR op het bord' });
      const link = await bord.inputValue('#deelLink');
      assert.equal(link, base + '/apps/foundation/leren.html#les=' + lescode, 'de link draagt de code alleen in het fragment');

      const beeld = await bord.evaluate(() => {
        const cv = document.querySelector('#deelQrBeeld');
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
        return { width: d.width, height: d.height, data: Array.from(d.data) };
      });
      const rgba = { width: beeld.width, height: beeld.height, data: Uint8ClampedArray.from(beeld.data) };
      const gelezen = Scanner.leesGrijs(Scanner.grijs(rgba), beeld.width, beeld.height);
      assert.equal(gelezen, link, 'de QR op het scherm leest terug als de deellink');

      /* 2. DE LEERLING OPENT WAT DE CAMERA LAS. */
      const p = leerling.page;
      const urls = [];
      p.on('request', (r) => urls.push({ url: r.url(), referer: r.headers().referer || '' }));
      await p.goto(gelezen, { waitUntil: 'domcontentloaded' });
      await wachtTot(p, () => document.querySelector('#dlgLeerling').open, null, { wat: 'het venster Meedoen' });
      assert.equal(await p.inputValue('#lCode'), lescode, 'de volledige code staat ingevuld');
      assert.equal(await p.evaluate(() => location.hash), '', 'het fragment is uit de adresbalk');
      assert.equal(p.url().includes(lescode), false);
      assert.equal(await p.evaluate(() => window.__RTG_LESCODE), undefined, 'de code staat niet meer los op window');

      /* 3. MEEDOEN IS EEN DRUK OP DE KNOP. */
      await p.fill('#lNaam', 'Milan');
      const join = p.waitForResponse((r) => r.url().endsWith('/api/foundation/les/join'));
      await p.locator('#lJoin').click();
      const antwoord = await join;
      assert.equal(antwoord.status(), 200, 'de join lukt');
      assert.match(antwoord.request().postData(), new RegExp('"lescode":"' + lescode.replace('.', '\\.') + '"'), 'de code reist in de POST-body');
      await p.waitForURL(/\/apps\/foundation\/schrift\.html\?code=/);
      await wachtOpTekst(bord, 'Milan', { in: '#llLijst' });

      /* 4. NERGENS BLIJVEN HANGEN. */
      const geheim = [lescode, lescode.toLowerCase(), lescode.slice(4)];
      for (const r of urls) {
        for (const g of geheim) {
          assert.equal(r.url.includes(g), false, 'geheim in een request-URL: ' + r.url);
          assert.equal(r.referer.includes(g), false, 'geheim in een Referer: ' + r.url);
        }
      }
      assert.ok(urls.some((r) => r.url.endsWith('/api/foundation/les/join')), 'de spion zag de join');
      const adressen = await p.evaluate(() => JSON.parse(sessionStorage.getItem('__adresBijVerzoek') || '[]'));
      assert.ok(adressen.some((a) => a.includes('/apps/foundation/leren.html')), 'de spion zag verzoeken van leren.html zelf');
      assert.ok(adressen.length > 0, 'de pagina deed verzoeken die de spion zag');
      for (const a of adressen) for (const g of geheim) assert.equal(a.includes(g), false, 'adresbalk droeg het geheim bij: ' + a);
      assert.deepEqual(leerling.fouten, [], 'geen JS-fouten bij de leerling: ' + leerling.fouten.join(' | '));
    } finally {
      await docent.ctx.close();
      await leerling.ctx.close();
    }
  });
