/* DE EERSTE OBJECTEN IN HET BLIKVELD: een document in Office, een bestand in
   Bestanden (EDGE.md, ronde 2, stap 21).

   Beide schermen publiceerden al een context zodra er iets open is; nu draagt die
   context ook het OBJECT waar je in staat -- als verwijzing, door de objectpoort
   (shared/objectverwijzing.js): soort, id en label, en geen inhoud.

   WAAROM EEN E2E EN GEEN SEED-OBJECT. De dekkingsmeter (scripts/edgedekking.js)
   maakt per ronde een vers lid aan en klikt niets aan, en Office opent een
   document alleen via een POST op de sleutel van dat lid -- de URL kent alleen
   `werk` en `bedrijf`. Een object dat er bij binnenkomst al staat, bestaat dus
   niet. Deze toets maakt daarom met zijn EIGEN lid, via de gewone route, een
   document en een bestand aan, opent ze, en leest dan wat het blikveld ziet. De
   meter ziet op beide schermen `na-openen` met de reden die de body verklaart;
   dat het object na openen WERKELIJK verschijnt, bewijst deze toets.

   Wat hier vastligt, per scherm:
     1. bij binnenkomst is er geen object, en de body verklaart waarom
        (data-rtg-edge-na-openen-object, met een reden);
     2. na openen is het object in het blikveld PRECIES de verwijzing
        {soort, id, label, velden: {}} -- met het id dat de server gaf;
     3. de inhoud staat er niet in: geen tekst uit het document, geen inhoud van
        het bestand.

   DE MUTATIES, elk nagetrokken: zet de inhoud in het object (office: de tekst
   van het vel, bestanden: het hele record) en laat het register de poort
   omzeilen -- toets 2/3 zakken; haal de na-openen-verklaring van de body --
   toets 1 zakt, en `edgedekking --alleen` meldt `nee`.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopHard, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();
const GEHEIM = 'Inhoud-die-nooit-in-de-Edge-hoort';

async function binnen(page, pad) {
  await page.goto(pad, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.RTGEdgeBlikveld && window.RTGAdaptief, null, { timeout: 20000 });
  const verklaring = await page.evaluate(() => document.body.getAttribute('data-rtg-edge-na-openen-object'));
  assert.ok(verklaring && verklaring.trim().length > 10, pad + ': de body verklaart met reden dat het object pas na openen ontstaat');
  const o = await page.evaluate(() => RTGEdgeBlikveld.lees().velden.object);
  assert.equal(o.waarde, null, pad + ': bij binnenkomst is er nog geen object');
}
async function object(page) {
  await page.waitForFunction(() => RTGEdgeBlikveld.lees().velden.object.waarde, null, { timeout: 15000 });
  return page.evaluate(() => RTGEdgeBlikveld.lees().velden.object);
}

test('het blikveld ziet een geopend document en een geopend bestand als verwijzing, zonder inhoud',
  { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  let browser;
  try {
    const post = async (pad, body, token) => {
      const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) });
      assert.equal(r.status, 200, pad);
      return r.json();
    };
    const n = Date.now();
    const lid = await post('/api/auth/register', { name: 'Object Proef', email: 'obj' + n + '@test.invalid',
      phone: '06' + String(n).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' });
    assert.ok(lid.token);
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript((t) => {
      localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, lid.token);

    /* ------------------------------------------------ Office: een document -- */
    await binnen(page, srv.base + '/apps/office.html');
    await page.waitForFunction(() => window.RTGOffice && window.RTGOffice.stand());
    const lijst = page.locator('#rtdVoorzijde [data-rtd-diep="lijst"]').first();
    if (await lijst.isVisible()) await lijst.click();
    const gemaakt = page.waitForResponse((r) => /\/maak$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST');
    await page.locator('#nieuwTekst').click();
    const doc = await (await gemaakt).json();
    assert.ok(doc.id, 'de server gaf het document een id');
    await page.locator('#editor.aan').waitFor();
    await page.locator('#titel').fill('Brief aan de proef');
    await page.locator('#tekst').click();
    await page.keyboard.type(GEHEIM);
    await page.waitForFunction((t) => (RTGEdgeBlikveld.lees().velden.object.waarde || {}).label === t,
      'Brief aan de proef', { timeout: 15000 });
    const od = await object(page);
    assert.deepEqual(od.waarde, { soort: 'document', id: doc.id, label: 'Brief aan de proef', velden: {} });
    assert.ok(!JSON.stringify(od).includes(GEHEIM), 'de tekst van het document hoort niet in de Edge');

    /* ------------------------------------------- Bestanden: een bestand -- */
    const f = await post('/api/bestanden/upload', { naam: 'Proefbestand.txt',
      dataUrl: 'data:text/plain;base64,' + Buffer.from(GEHEIM).toString('base64') }, lid.token);
    assert.ok(f.id, 'de server gaf het bestand een id');
    await binnen(page, srv.base + '/apps/bestanden.html');
    await page.waitForSelector('[data-open="' + f.id + '"]');
    await page.locator('[data-open="' + f.id + '"]').click();
    const ob = await object(page);
    assert.deepEqual(ob.waarde, { soort: 'bestand', id: f.id, label: 'Proefbestand.txt', velden: {} });
    const tekst = JSON.stringify(ob);
    assert.ok(!tekst.includes(GEHEIM) && !tekst.includes('base64'), 'de inhoud van het bestand hoort niet in de Edge');
    assert.deepEqual(fouten, []);
  } finally {
    if (browser) await browser.close();
    await stopHard(srv.child);
  }
});
