/* Het gedeelde element van reiskaart naar reisboek: gebeurt het ECHT?

   Een unittoets kan bewijzen dat de juiste link de naam krijgt
   (test/rtg-heritage-transition.test.js). Dat de browser er ook een overgang
   van maakt, hangt af van dingen die alleen een browser weet: of beide
   documenten @view-transition aanzetten, of het doel zijn naam bij het eerste
   beeld al draagt, en of geen tweede element dezelfde naam heeft (dan slaat de
   browser de hele overgang over -- stil). Deze toets kijkt daarom naar wat de
   browser zelf animeert, in het nieuwe document, op het moment van onthullen.

   En hij doet dat in een BLAD van de werktafel, want dat is de weg die een lid
   neemt (SCHILHERSTART.json): TravelOS staat als iframe in RTG Command, en de
   kaart navigeert dat iframe. Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, browserOpties, geenBrowser } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

async function maakLid(base) {
  const post = async (pad, body, token) => {
    const r = await fetch(base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(pad + ' gaf ' + r.status + ': ' + (j && j.error || ''));
    return j;
  };
  const naam = 'Gedeeld Element';
  const acc = await post('/api/auth/register', { name: naam, email: 'gedeeld' + Date.now().toString(36) + '@voorbeeld.test',
    password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  const status = await post('/api/onboarding/status', {}, acc.token);
  await post('/api/onboarding/teken', { naam, akkoord: true, contractVersion: status.contract.versie }, acc.token);
  return acc.token;
}

/* In elk document, voor het eerste script: bij pagereveal noteren welke
   overgangsgroepen de browser animeert. */
function luister() {
  window.__gedeeld = { overgang: false, groepen: [], klaar: false };
  window.addEventListener('pagereveal', (e) => {
    if (!e.viewTransition) { window.__gedeeld.klaar = true; return; }
    window.__gedeeld.overgang = true;
    e.viewTransition.ready.then(() => {
      window.__gedeeld.groepen = document.getAnimations()
        .map((a) => a.effect && a.effect.pseudoElement).filter(Boolean);
      window.__gedeeld.klaar = true;
    }).catch(() => { window.__gedeeld.klaar = true; });
  });
}

async function proef(reducedMotion) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gedeeld-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const token = await maakLid(srv.base);
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion });
    await ctx.addInitScript((t) => {
      localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, token);
    await ctx.addInitScript(luister);
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(srv.base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.RTGCommand && window.RTGCommand.actief(), null, { timeout: 30000 });
    await page.evaluate(() => window.RTGCommand.open('/apps/reizen.html', 'TravelOS'));
    const blad = () => page.frames().find((f) => { try { return new URL(f.url()).pathname === '/apps/reizen.html'; } catch (e) { return false; } });
    await page.waitForFunction(() => !!document.querySelector('.cmd-pane.actief iframe'), null, { timeout: 20000 });
    for (let i = 0; i < 100 && !blad(); i++) await page.waitForTimeout(100);
    const reizen = blad();
    assert.ok(reizen, 'TravelOS staat als blad in de werktafel');
    await reizen.waitForSelector('a.wh-service[href="/apps/reisboek.html"]', { state: 'attached', timeout: 20000 });
    /* De kaart wordt op zijn ADRES gezocht en niet op zijn markering: dan
       meet een toets zonder markering (de mutatieproef) een kaart die gewoon
       navigeert, en zakt hij op de overgang in plaats van op het zoeken. */
    /* De pageswap-kant moet geladen zijn (basis.js laadt hem), anders meet je
       een pagina die nog bezig is en niet de overgang. */
    await reizen.waitForFunction(() => !!window.RTGHeritageTransition, null, { timeout: 20000 });
    /* Een ECHTE tik op een kaart die IN BEELD staat. De eerste versie riep
       click() aan via JavaScript terwijl de kaart onder de rand van het scherm
       stond (boven 748 px in een venster van 704 px): zichtbaar volgens
       checkVisibility, maar buiten het venster, en dan legde de browser de oude
       kant van de groep onder belasting niet vast -- 6 van 9 keer rood in drie
       parallelle rondes, en zo ook in CI. Een duim tikt alleen op wat hij ziet,
       dus de toets schuift hem eerst in beeld en tikt dan met de muis. */
    const kaart = reizen.locator('a.wh-service[href="/apps/reisboek.html"]');
    await kaart.waitFor({ state: 'visible', timeout: 20000 });
    await kaart.scrollIntoViewIfNeeded();
    await reizen.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await kaart.click();
    let doel = null;
    for (let i = 0; i < 200 && !doel; i++) {
      doel = page.frames().find((f) => { try { return new URL(f.url()).pathname === '/apps/reisboek.html'; } catch (e) { return false; } });
      if (!doel) await page.waitForTimeout(100);
    }
    assert.ok(doel, 'de kaart opent het reisboek in hetzelfde blad');
    await doel.waitForFunction(() => document.readyState !== 'loading', null, { timeout: 20000 });
    /* Wachten op het MOMENT en niet op een vaste tijd: onder belasting komt
       `ready` later dan 800 ms, en dan las de eerste versie een lege lijst en
       zakte een op de acht keer zonder dat er iets mis was. */
    await doel.waitForFunction(() => window.__gedeeld && window.__gedeeld.klaar, null, { timeout: 15000 });
    const uit = await doel.evaluate(() => ({ g: window.__gedeeld, naam: getComputedStyle(document.querySelector('.reisboek-kop')).viewTransitionName }));
    assert.equal(uit.naam, 'rtg-gedeeld-reisboek', 'het doel draagt zijn naam bij binnenkomst (rtg-uniform.css)');
    return { uit, fouten };
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop(srv);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
}

test('gedeeld element: de reisboekkaart wordt het reisboek, in een blad van de werktafel',
  { skip: geenBrowser(pw) }, async () => {
  const { uit, fouten } = await proef('no-preference');
  assert.ok(uit.g.overgang, 'de browser maakt een overgang tussen de twee documenten');
  assert.ok(uit.g.groepen.includes('::view-transition-group(rtg-gedeeld-reisboek)'),
    'de kaart en de kop vormen samen een groep (gevonden: ' + uit.g.groepen.join(', ') + ')');
  /* Een groep alleen is niet genoeg: een doel met een naam en GEEN bron levert
     een groep met alleen een nieuwe kant op (mutatieproef: de markering van de
     kaart weg, en deze toets zakt hier). De oude kant IS de kaart. */
  assert.ok(uit.g.groepen.includes('::view-transition-old(rtg-gedeeld-reisboek)'),
    'de oude kant van de groep is de kaart (gevonden: ' + uit.g.groepen.join(', ') + ')');
  assert.deepEqual(fouten, [], 'geen paginafouten');
});

test('gedeeld element: wie minder beweging vraagt, krijgt geen overgang',
  { skip: geenBrowser(pw) }, async () => {
  const { uit } = await proef('reduce');
  assert.ok(!uit.g.groepen.includes('::view-transition-group(rtg-gedeeld-reisboek)'),
    'prefers-reduced-motion slaat de gedeelde overgang over');
});
