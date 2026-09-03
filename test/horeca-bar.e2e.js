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
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser,
  wachtTot, wachtOpTekst, wachtOpZichtbaar } = require('./helper');
const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-barscherm-'));

const post = (base, pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('het barscherm toont de stapel en de ronden, en zet een glas door',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(base + '/apps/horeca-bar.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.removeItem('rtg_sup_token');
      localStorage.removeItem('rtg_horeca_hand');
      localStorage.removeItem('rtg_horeca_hand-vast');
    });
    await page.goto(base + '/apps/horeca-bar.html', { waitUntil: 'domcontentloaded' });
    /* De deur komt niet uit het HTML maar wordt na het laden getekend
       (RTGHoreca.poort() doet dat in een setTimeout). We wachten dus tot hij er
       staat -- OF tot de pagina alsnog ergens anders heen ging, want juist dat
       tweede moet de bewering hieronder kunnen afkeuren in plaats van dat de
       wacht hem voor is. */
    await wachtTot(page, () => !!document.querySelector('.rtgdeur') ||
      location.pathname !== '/apps/horeca-bar.html', null,
      { wat: 'de deur op het barscherm (of een omleiding weg van dit scherm)' });
    const uit = await page.evaluate(() => ({ pad: location.pathname,
      deur: !!document.querySelector('.rtgdeur'), tekst: document.body.innerText.replace(/\s+/g, ' ') }));
    assert.equal(uit.pad, '/apps/horeca-bar.html', 'de pagina stuurt niemand weg');
    assert.ok(uit.deur || /personeel|inlog|zaak/i.test(uit.tekst), 'uitgelogd staat er een deur');

    const roster = (await post(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
    const mgr = (roster.staff || []).find(x => x.role === 'manager') || roster.staff[0];
    const tok = (await post(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
    const H = (pad, body) => post(base, pad, body, tok);

    /* Twee tafels met dezelfde drank erop, plus een gerecht dat er niet hoort. */
    async function tafel(naam, regels) {
      const r = (await H('/api/supplier/horeca/rekening/open', { kanaal: 'tafel', tafel: naam, gasten: 2 })).body.rekening;
      const stoel = (await H('/api/supplier/horeca/gezelschap/stoel', { rekeningId: r.id, handle: 'bij het raam' })).body.stoel;
      const ids = [];
      for (const x of regels) {
        const reg = (await H('/api/supplier/horeca/rekening/regel', { rekeningId: r.id, naam: x.naam, prijs: 9, aantal: x.aantal || 1,
          gang: 1, station: x.station || 'bar', allergie: x.allergie || '', gastNr: x.stoel ? stoel.nr : undefined })).body.regel;
        ids.push(reg.id);
      }
      await H('/api/supplier/horeca/gang/vrij', { rekeningId: r.id, gang: 1 });
      return { id: r.id, regels: ids };
    }
    const t1 = await tafel('BAR-A', [
      { naam: 'Gin-tonic', aantal: 2, stoel: true, allergie: 'kinine' },
      { naam: 'Gazpacho', station: 'koud' }
    ]);
    await tafel('BAR-B', [{ naam: 'Gin-tonic', aantal: 1 }]);

    await page.evaluate(t => { localStorage.setItem('rtg_sup_token', t); }, tok);
    await page.goto(base + '/apps/horeca-bar.html', { waitUntil: 'domcontentloaded' });
    /* De tellers staan in het HTML op "-" en krijgen pas een waarde als teken()
       heeft gedraaid, en dat gebeurt alleen NA het antwoord van /bar. Een teller
       die niet meer "-" is, betekent dus: het bord is een keer met echte
       servergegevens getekend. Bewust niet op "3x Gin-tonic" wachten -- dat is
       precies wat de beweringen hieronder moeten kunnen afkeuren. */
    await wachtTot(page, () => document.getElementById('bOpen').textContent !== '-', null,
      { wat: 'een bord dat met servergegevens is getekend (bOpen niet meer "-")' });

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
    const aan = page.locator('[data-naar="gestart"]');   // locator en geen vaste handle: het bord hertekent
    await aan.first().waitFor({ state: 'visible' });
    assert.ok(await aan.count() > 0, 'er staat een knop om aan te zetten');
    await aan.first().click();
    /* Aanzetten loopt via de offline-laag en daarna tekent haal() het bord
       opnieuw; dan pas verandert de knop van "Aanzetten" in "Klaar". Op die knop
       wachten is precies waar de volgende regel om vraagt. */
    await wachtOpZichtbaar(page, '[data-naar="klaar"]');
    const klaar = page.locator('[data-naar="klaar"]');   // locator en geen vaste handle: het bord hertekent
    await klaar.first().waitFor({ state: 'visible' });
    assert.ok(await klaar.count() > 0, 'daarna kan hij klaar gemeld worden');
    const welke = await klaar.evaluate(el => el.getAttribute('data-zet'));
    await klaar.first().click();
    /* Een glas dat klaar staat heeft geen vervolgstap meer, dus verdwijnt zijn
       knop uit het bord. Die knop verdwijnt pas bij de hertekening NA het
       antwoord van de server -- en dat is precies de toestand die de vragen aan
       de server hieronder nodig hebben. Geen selector met de id erin: een id met
       een vreemd teken zou dan stil niets matchen. */
    await wachtTot(page, (id) => [...document.querySelectorAll('[data-zet]')]
      .every((b) => b.getAttribute('data-zet') !== id), welke,
      { wat: 'het glas ' + welke + ' zonder vervolgknop (klaar gemeld)' });

    beeld = await lees();
    const bord = (await H('/api/supplier/horeca/bar', {})).body;
    const gt = bord.stapel.find(x => x.naam === 'Gin-tonic');
    assert.ok(!gt || !gt.regelIds.includes(welke), 'een glas dat klaar staat, hoeft niet nog eens gemaakt');
    const rek = (await H('/api/supplier/horeca/rekening', { rekeningId: t1.id })).body.rekening;
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
    /* Ververs haalt het bord opnieuw op; de nieuwe ronde is binnen zodra BAR-C
       in de ronderlijst staat. De knop eronder komt in dezelfde hertekening mee,
       want teken() zet de hele lijst in een keer neer. */
    await wachtOpTekst(page, 'BAR-C', { in: '#bGolvenLijst' });

    const aanC = page.locator('.b-golf:has-text("BAR-C") [data-naar="gestart"]');   // locator en geen vaste handle: het bord hertekent
    await aanC.first().waitFor({ state: 'visible' });
    assert.ok(await aanC.count() > 0, 'de negroni staat op het bord');
    await aanC.first().click();
    /* Zonder lijn ketst de fetch af, komt de handeling op het toestel te staan
       en meldt de wachtrij dat aan het scherm: de strook gaat aan. Dat is het
       eerste zichtbare teken dat de handeling geland is -- eerder heeft vragen
       naar de rij geen zin. */
    await wachtOpZichtbaar(page, '#bEdgeStrook');
    assert.equal(await page.evaluate(() => RTGHorecaEdge.handRij().length), 1,
      'zonder lijn staat de handeling op het toestel');
    const strook = await page.evaluate(() => ({
      verborgen: !!document.getElementById('bEdgeStrook').hidden,
      tekst: document.getElementById('bEdgeStrook').textContent }));
    assert.equal(strook.verborgen, false, 'en dat staat op het scherm');
    assert.match(strook.tekst, /op dit toestel/, strook.tekst);
    const tussenC = (await H('/api/supplier/horeca/rekening', { rekeningId: t3.id })).body.rekening;
    assert.equal(tussenC.regels[0].stand, 'besteld', 'bij de server is er nog niets gebeurd');

    lijnDicht = false;
    await page.evaluate(() => RTGHorecaEdge.handLeeg());
    /* De rij is leeggelopen zodra de strook weer uit gaat: die staat aan zolang
       er iets wacht OF iets is vastgelopen, en gaat pas uit als beide nul zijn.
       Dat is strenger dan alleen naar de rij kijken -- een handeling die de
       server weigerde zou blijven staan als "vast". */
    await wachtOpZichtbaar(page, '#bEdgeStrook', { weg: true });
    assert.equal(await page.evaluate(() => RTGHorecaEdge.handRij().length), 0, 'de rij is leeg');
    const naC = (await H('/api/supplier/horeca/rekening', { rekeningId: t3.id })).body.rekening;
    assert.equal(naC.regels[0].stand, 'gestart', 'en de handeling is alsnog aangekomen');

    /* EEN COLLEGA DIE SNELLER WAS. Het glas gaat online de deur uit terwijl dit
       toestel offline "klaar" meldt. De samenvoeging weigert dat -- een stand
       gaat nooit achteruit -- en het scherm hoort de reden te horen. */
    /* EERST WACHTEN TOT HET BORD DE NIEUWE STAND TOONT, EN PAS DAARNA DE LIJN
       DICHT. Twee dingen die niet samenvallen: de rij loopt leeg zodra het
       antwoord binnen is, maar de knop van BAR-C verandert pas van "aanzetten"
       in "klaar" als het bord opnieuw is getekend -- en dat hertekenen HAALT
       eerst de stand op. Zet je de lijn eerder dicht, dan ketst juist die fetch
       af en komt de knop er nooit; dat is deze toets een keer overkomen.

       En de wacht loopt via de LOCATOR en niet via wachtOpZichtbaar: die laatste
       voert querySelector uit IN de pagina, en `:has-text()` is een selector van
       Playwright en geen CSS -- de browser gooit er een SyntaxError op. */
    const klaarC = page.locator('.b-golf:has-text("BAR-C") [data-naar="klaar"]');
    await klaarC.first().waitFor({ state: 'visible' });
    lijnDicht = true;
    assert.ok(await klaarC.count() > 0, 'er staat een knop om hem klaar te melden');
    await klaarC.first().click();
    // de lijn is weer dicht: de strook hoort opnieuw aan te gaan, en pas dan
    // staat de klaarmelding werkelijk op het toestel
    await wachtOpZichtbaar(page, '#bEdgeStrook');
    assert.equal(await page.evaluate(() => RTGHorecaEdge.handRij().length), 1, 'hij wacht');

    await H('/api/supplier/horeca/keuken/stand', { rekeningId: t3.id, regelId: t3.regels[0], stand: 'uitgegeven' });

    lijnDicht = false;
    await page.evaluate(() => RTGHorecaEdge.handLeeg());
    /* Ook een GEWEIGERDE samenvoeging is een antwoord van de server: het pakket
       gaat dan gewoon uit de rij en niet naar de vastgelopen hoek. De strook uit
       betekent hier dus "afgehandeld", en niet "gelukt" -- wat er van de weigering
       terechtkwam, beweren de regels hieronder. */
    await wachtOpZichtbaar(page, '#bEdgeStrook', { weg: true });
    const eindC = (await H('/api/supplier/horeca/rekening', { rekeningId: t3.id })).body.rekening;
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
