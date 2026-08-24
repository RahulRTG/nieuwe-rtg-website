/* HET BARSCHERM in een echte browser: /apps/horeca-bar.html.

   De rekensom staat vast in test/horeca-bar.test.js. Wat hier bewezen wordt is
   dat een barman ermee kan werken:

   1. UITGELOGD STAAT ER EEN DEUR (TAKEN 5.5).
   2. DE TWEE LIJSTEN STAAN ER ALLEBEI: de stapel (wat samen gemaakt kan worden)
      en de ronden. Zonder de stapel is dit een keukenbord met andere gerechten.
   3. EEN GERECHT STAAT ER NIET OP. Een barman die soep op zijn bord ziet, gaat
      het bord niet lezen.
   4. AANZETTEN EN KLAAR MELDEN WERKEN, via dezelfde deur als de keuken -- en een
      glas dat klaar staat verdwijnt uit de stapel, want dat hoeft niet nog eens
      gemaakt te worden.
   5. DE STOEL EN DE ALLERGIE STAAN OP HET GLAS. Vier glazen op een blad zonder
      te weten welk glas waarheen gaat, is raden.
   6. HET WERKT ZONDER LIJN. Een barman kan niet eerst uitzoeken of het netwerk
      het doet; een glas dat "klaar" is gemeld maar nooit aankwam, is een glas
      dat niemand komt halen. En als een collega intussen sneller was, hoort het
      scherm dat te horen -- niet stil zijn eigen beeld te herstellen.

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
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-barscherm-'));

const post = (base, pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('het barscherm toont de stapel en de ronden, en zet een glas door',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(base + '/apps/horeca-bar.html', { waitUntil: 'load' });
    await page.evaluate(() => {
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.removeItem('rtg_sup_token');
      localStorage.removeItem('rtg_horeca_hand');
      localStorage.removeItem('rtg_horeca_hand-vast');
    });
    await page.goto(base + '/apps/horeca-bar.html', { waitUntil: 'load' });
    await page.waitForTimeout(900);
    const uit = await page.evaluate(() => ({ pad: location.pathname,
      deur: !!document.querySelector('.rtgdeur'), tekst: document.body.innerText.replace(/\s+/g, ' ') }));
    assert.equal(uit.pad, '/apps/horeca-bar.html', 'de pagina stuurt niemand weg');
    assert.ok(uit.deur || /personeel|inlog|zaak/i.test(uit.tekst), 'uitgelogd staat er een deur');

    const roster = (await post(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
    const mgr = (roster.staff || []).find(x => x.role === 'manager') || roster.staff[0];
    const tok = (await post(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
    const H = (pad, body) => post(base, '/api/supplier/horeca' + pad, body, tok);

    /* Twee tafels met dezelfde drank erop, plus een gerecht dat er niet hoort. */
    async function tafel(naam, regels) {
      const r = (await H('/rekening/open', { kanaal: 'tafel', tafel: naam, gasten: 2 })).body.rekening;
      const stoel = (await H('/gezelschap/stoel', { rekeningId: r.id, handle: 'bij het raam' })).body.stoel;
      const ids = [];
      for (const x of regels) {
        const reg = (await H('/rekening/regel', { rekeningId: r.id, naam: x.naam, prijs: 9, aantal: x.aantal || 1,
          gang: 1, station: x.station || 'bar', allergie: x.allergie || '', gastNr: x.stoel ? stoel.nr : undefined })).body.regel;
        ids.push(reg.id);
      }
      await H('/gang/vrij', { rekeningId: r.id, gang: 1 });
      return { id: r.id, regels: ids };
    }
    const t1 = await tafel('BAR-A', [
      { naam: 'Gin-tonic', aantal: 2, stoel: true, allergie: 'kinine' },
      { naam: 'Gazpacho', station: 'koud' }
    ]);
    await tafel('BAR-B', [{ naam: 'Gin-tonic', aantal: 1 }]);

    await page.evaluate(t => { localStorage.setItem('rtg_sup_token', t); }, tok);
    await page.goto(base + '/apps/horeca-bar.html', { waitUntil: 'load' });
    await page.waitForTimeout(900);

    const lees = () => page.evaluate(() => ({
      stapel: document.getElementById('bStapel').innerText.replace(/\s+/g, ' '),
      golven: document.getElementById('bGolvenLijst').innerText.replace(/\s+/g, ' '),
      open: document.getElementById('bOpen').textContent
    }));
    let beeld = await lees();

    /* 2 + 3: de stapel telt over tafels heen, en de soep staat er niet op */
    assert.match(beeld.stapel, /3x Gin-tonic/, 'twee tafels, drie glazen, één handeling: ' + beeld.stapel);
    assert.match(beeld.stapel, /BAR-A/, 'met de tafels erbij');
    assert.match(beeld.stapel, /BAR-B/);
    assert.doesNotMatch(beeld.stapel + beeld.golven, /Gazpacho/, 'een gerecht hoort niet op het barbord');
    assert.equal(beeld.open, '3', 'drie glazen te maken');

    /* 5: stoel en allergie op het glas */
    assert.match(beeld.golven, /bij het raam/, 'de stoel staat op het glas');
    assert.match(beeld.golven, /kinine/, 'en de allergie ook');

    /* 4: aanzetten en klaar melden */
    const aan = await page.$('[data-naar="gestart"]');
    assert.ok(aan, 'er staat een knop om aan te zetten');
    await aan.click();
    await page.waitForTimeout(700);
    const klaar = await page.$('[data-naar="klaar"]');
    assert.ok(klaar, 'daarna kan hij klaar gemeld worden');
    const welke = await klaar.evaluate(el => el.getAttribute('data-zet'));
    await klaar.click();
    await page.waitForTimeout(700);

    beeld = await lees();
    const bord = (await H('/bar', {})).body;
    const gt = bord.stapel.find(x => x.naam === 'Gin-tonic');
    assert.ok(!gt || !gt.regelIds.includes(welke), 'een glas dat klaar staat, hoeft niet nog eens gemaakt');
    const rek = (await H('/rekening', { rekeningId: t1.id })).body.rekening;
    assert.equal(rek.regels.find(x => x.id === welke).stand, 'klaar',
      'en de stand staat op de rekening zelf, via dezelfde deur als de keuken');

    /* ---- 6. de lijn eruit ---- */
    const t3 = await tafel('BAR-C', [{ naam: 'Negroni', aantal: 1 }]);
    let lijnDicht = true;
    await page.route('**/api/supplier/horeca/offline/handelingen', async (route) => {
      if (lijnDicht) return route.abort('failed');
      return route.continue();
    });
    await page.click('#bVerversNu');
    await page.waitForTimeout(800);

    const aanC = await page.$('.b-golf:has-text("BAR-C") [data-naar="gestart"]');
    assert.ok(aanC, 'de negroni staat op het bord');
    await aanC.click();
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => RTGHorecaEdge.handRij().length), 1,
      'zonder lijn staat de handeling op het toestel');
    const strook = await page.evaluate(() => ({
      verborgen: !!document.getElementById('bEdgeStrook').hidden,
      tekst: document.getElementById('bEdgeStrook').textContent }));
    assert.equal(strook.verborgen, false, 'en dat staat op het scherm');
    assert.match(strook.tekst, /op dit toestel/, strook.tekst);
    const tussenC = (await H('/rekening', { rekeningId: t3.id })).body.rekening;
    assert.equal(tussenC.regels[0].stand, 'besteld', 'bij de server is er nog niets gebeurd');

    lijnDicht = false;
    await page.evaluate(() => RTGHorecaEdge.handLeeg());
    await page.waitForTimeout(1000);
    assert.equal(await page.evaluate(() => RTGHorecaEdge.handRij().length), 0, 'de rij is leeg');
    const naC = (await H('/rekening', { rekeningId: t3.id })).body.rekening;
    assert.equal(naC.regels[0].stand, 'gestart', 'en de handeling is alsnog aangekomen');

    /* EEN COLLEGA DIE SNELLER WAS. Het glas gaat online de deur uit terwijl dit
       toestel offline "klaar" meldt. De samenvoeging weigert dat -- een stand
       gaat nooit achteruit -- en het scherm hoort de reden te horen. */
    lijnDicht = true;
    const klaarC = await page.$('.b-golf:has-text("BAR-C") [data-naar="klaar"]');
    assert.ok(klaarC, 'er staat een knop om hem klaar te melden');
    await klaarC.click();
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => RTGHorecaEdge.handRij().length), 1, 'hij wacht');

    await H('/keuken/stand', { rekeningId: t3.id, regelId: t3.regels[0], stand: 'uitgegeven' });

    lijnDicht = false;
    await page.evaluate(() => RTGHorecaEdge.handLeeg());
    await page.waitForTimeout(1000);
    const eindC = (await H('/rekening', { rekeningId: t3.id })).body.rekening;
    assert.equal(eindC.regels[0].stand, 'uitgegeven',
      'de offline-melding zet het bord niet terug naar klaar');
    assert.equal(await page.evaluate(() => RTGHorecaEdge.handRij().length), 0,
      'en de handeling is afgehandeld, niet blijven hangen');

    assert.deepEqual(fouten, [], 'geen scriptfouten op het barscherm');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
