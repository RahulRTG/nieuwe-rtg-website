/* RAHUL ZIET HET OPEN BLAD -- in een echte schil, tot op de server.

   test/rahulzicht.test.js houdt de projectie vast zonder browser. Hier staat wat
   alleen een echte keten kan laten zien:

   1. VOOR: in de schil van app.html wist de Rahul-helper alleen wat de DOM van
      de SCHIL zei. Met een reizenblad open en een object erin, geeft
      RTGRahulTabHelpers.context() nu de wereld van het blad, de titel die het
      blad zelf publiceerde, en de verwijzing -- alleen soort en id.
   2. DE VRAAG REIST ERMEE: een vraag in de vraagvorm van de schilbalk gaat naar
      /api/fluister met precies die context in het lichaam.
   3. DE SERVER KENT DE VORM: met de deterministische intentierail (de enige rail
      die zijn spoor teruggeeft) staat CONTEXT_SANITIZED op PASS, met NUL
      weggegooide sleutels en EEN verwijzing. Zonder deze stap is "Rahul leest
      het blikveld" een bewering over de client.

   DE MUTATIES, nagetrokken: laad rahulzicht.js niet in app.html (1 zakt: geen
   wereld), en laat de projectie het label meesturen als `label` in de
   verwijzing -- de server gooit dat stil weg, maar stap 1 zakt op de vorm.

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

async function lid(base) {
  const u = Date.now().toString(36);
  const r = await fetch(base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Rahulzicht Proef', email: 'rahulzicht' + u + '@voorbeeld.test',
      password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
  }).then((x) => x.json());
  assert.ok(r.token, 'registratie hoort een token te geven');
  const status = await fetch(base + '/api/onboarding/status', { method: 'POST',
    headers: { Authorization: 'Bearer ' + r.token } }).then((x) => x.json());
  const t = await fetch(base + '/api/onboarding/teken', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + r.token },
    body: JSON.stringify({ naam: 'Rahulzicht Proef', akkoord: true, contractVersion: status.contract.versie }) });
  assert.equal(t.status, 200, 'de proefgebruiker hoort de overeenkomst te kunnen tekenen');
  return r.token;
}

test('Rahul ziet het open blad: wereld, titel en verwijzing -- en de server zegt PASS zonder iets weg te gooien',
  { skip: geenBrowser(pw) }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rahulzicht-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir, RTG_INTENT_RAIL: 'deterministisch',
    ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', GEMINI_API_KEY: '', LOCAL_AI_URL: '' } });
  const browser = await pw.chromium.launch(browserOpties(pw));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', locale: 'nl-NL' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  try {
    const token = await lid(srv.base);
    await page.addInitScript((t) => {
      localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, token);
    await page.goto(srv.base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#rtgCommand[data-stand="open"] .cmd-leeg', { timeout: 20000 });
    await page.waitForFunction(() => !!window.RTGEdgeBlikveld && !!window.RTGEdgeRahulzicht && !!window.RTGRahulTabHelpers,
      null, { timeout: 20000 });

    // Op de lege tafel ziet het blikveld nog geen wereld; de helper verzint er geen.
    const leeg = await page.evaluate(() => RTGRahulTabHelpers.context());
    assert.equal(leeg.wereld, undefined, 'zonder blad is er geen wereld: ' + JSON.stringify(leeg));

    await page.locator('.cmd-leeg button[data-url="/apps/reizen.html"]').click();
    const blad = () => page.frames().find((f) => /\/apps\/reizen\.html/.test(f.url()));
    await page.waitForFunction(() => RTGEdgeBlikveld.lees().velden.context.herkomst === 'blad', null, { timeout: 20000 });
    await blad().evaluate(() => {
      const c = RTGAdaptief.context();
      RTGAdaptief.context({ bron: c.bron, titel: c.titel, acties: c.acties, selectie: c.selectie, staat: c.staat,
        rail: c.rail, object: { soort: 'reis', id: 'proef-7', label: 'Geheime reis', velden: { bedrag: '9000' } } });
    });
    await page.waitForFunction(() => (RTGEdgeBlikveld.lees().velden.object.waarde || {}).id === 'proef-7', null, { timeout: 10000 });

    // 1) De helper neemt het blikveld over: alleen de drie velden.
    const z = await page.evaluate(() => ({ c: RTGRahulTabHelpers.context(),
      titel: RTGEdgeBlikveld.lees().velden.context.waarde.titel }));
    assert.equal(z.c.wereld, 'travel');
    assert.ok(z.titel, 'het reizenblad publiceert een titel');
    assert.equal(z.c.deel, z.titel, 'Rahul ziet de titel van het blad en niet die van de schil');
    assert.deepEqual(z.c.verwijzingen, [{ soort: 'reis', id: 'proef-7' }]);
    assert.ok(!JSON.stringify(z.c).includes('Geheime reis') && !JSON.stringify(z.c).includes('9000'),
      'het label en de velden van het object gaan niet mee');

    // 2) Een vraag in de vraagvorm van de schilbalk reist met die context naar de server.
    const verzoek = page.waitForRequest((r) => r.url().endsWith('/api/fluister') && r.method() === 'POST', { timeout: 20000 });
    const antwoord = page.waitForResponse((r) => r.url().endsWith('/api/fluister') && r.request().method() === 'POST', { timeout: 30000 });
    /* Op telefoonformaat staat de mondknop niet in beeld; de vraag komt binnen via
       de vraagvorm van de schilbalk, precies zoals de adaptieve Edge hem indient
       (rtg-adaptive-edge-controls.js: field.value = ...; original.requestSubmit()). */
    await page.evaluate(() => {
      const vorm = document.querySelector('#rtgCommand .cmd-vraagvorm');
      vorm.querySelector('.cmd-vraagveld').value = 'die andere';
      vorm.requestSubmit();
    });
    const lijf = JSON.parse((await verzoek).postData() || '{}');
    assert.equal(lijf.context && lijf.context.wereld, 'travel', 'de context ging niet mee: ' + JSON.stringify(lijf));
    assert.equal(lijf.context.deel, z.titel);
    assert.deepEqual(lijf.context.verwijzingen, [{ soort: 'reis', id: 'proef-7' }]);

    // 3) De server saneert hem tot PASS, zonder een sleutel weg te gooien.
    const r = await antwoord;
    assert.equal(r.status(), 200);
    const d = await r.json();
    assert.ok(d.spoor && d.spoor.perFase, 'de deterministische rail hoort zijn spoor mee te geven: ' + JSON.stringify(d).slice(0, 400));
    const fase = d.spoor.merken.find((m) => m.fase === 'CONTEXT_SANITIZED');
    assert.equal(d.spoor.perFase.CONTEXT_SANITIZED.stand, 'PASS');
    assert.equal(fase.detail.gewist, 0, 'de server gooide een sleutel van de client weg: ' + JSON.stringify(fase.detail));
    assert.equal(fase.detail.verwijzingen, 1);
    assert.deepEqual(fouten, []);
  } finally {
    await browser.close();
    await stop(srv);
  }
});
