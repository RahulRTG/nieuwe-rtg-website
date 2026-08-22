/* Scherm-toets op DE REISWACHT in /apps/reizen.html (REIZEN.md fase 3).

   De serverkant staat in test/reiswacht.test.js. Wat alleen hier te bewijzen
   valt, is het gevaarlijkste scenario van dit hele scherm: RUST. Een leeg vak
   leest als "niets aan de hand", en dat mag alleen als er ook echt gemeten is
   -- en als de kijker in dezelfde oogopslag ziet met hoeveel ogen.

   DRIE BEWERINGEN, en alle drie kunnen ze zakken:
   1. bij een reis met een visumvraag staat het signaal er, met zijn bron;
   2. de bronnen staan ALTIJD onder het vak -- ook de ontbrekende (externe
      luchtvaart), en de momentopname-zin staat erbij;
   3. rust wordt gezegd ("er speelt niets") en niet gezwegen.

   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, browserOpties, geenBrowser, laadPlaywright } = require('./helper');

const pw = laadPlaywright();
const dag = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

test('de reiswacht op het scherm: signalen met bron, de ontbrekende bronnen, en rust die gezegd wordt',
  { skip: geenBrowser(pw) }, async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wacht-e2e-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  const post = (pad, body, token) => fetch(srv.base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  try {
    const u = Date.now().toString().slice(-8);
    const lid = (await post('/api/auth/register', { name: 'Reiziger', email: 'we' + u + '@x.nl',
      phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;
    assert.ok(lid);

    browser = await pw.chromium.launch(browserOpties());
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
    await ctx.addInitScript((tok) => { try { localStorage.setItem('rtg_member_token', tok); } catch (e) {} }, lid);
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    /* ---- eerst de rust: een lid zonder reizen ---- */
    await page.goto(srv.base + '/apps/reizen.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const el = document.querySelector('#wacht');
      return el && !/Laden/.test(el.textContent);
    }, null, { timeout: 20000 });

    await t.test('rust wordt gezegd, en de bronnen staan er toch', async () => {
      const tekst = await page.$eval('#wacht', el => el.innerText);
      assert.match(tekst, /speelt op dit moment niets/i, 'rust is een zin en geen leegte: ' + tekst.slice(0, 150));
      assert.match(tekst, /luchtvaart \(extern\)/i, 'de ontbrekende bron staat eronder');
      assert.match(tekst, /kijkt hier nu niet mee/i, 'met de eerlijke uitleg');
      assert.match(tekst, /waakt niet op de achtergrond/i, 'en de momentopname-zin');
    });

    /* ---- dan een reis met een visumvraag ---- */
    const lees = await post('/api/reis/invoer/lees', { tekst: 'Rondreis India, vertrek ' + dag(20) }, lid);
    const bev = await post('/api/reis/invoer/bevestig', { id: lees.body.voorstel.id,
      velden: { titel: 'Rondreis India', soort: 'activiteit', bestemming: 'India', van_datum: dag(20) } }, lid);
    assert.equal(bev.status, 200);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const el = document.querySelector('#wacht');
      return el && !/Laden/.test(el.textContent) && /India/.test(el.innerText);
    }, null, { timeout: 20000 });

    await t.test('het signaal staat er met zijn bron en zijn grond', async () => {
      const tekst = await page.$eval('#wacht', el => el.innerText);
      assert.match(tekst, /India/);
      assert.match(tekst, /geen taak/i, 'de visumvraag staat er: ' + tekst.slice(0, 300));
      assert.match(tekst, /Al geregeld\?/i, 'als vraag, niet als bewering');
      assert.match(tekst, /Bron: landregels/i, 'met de bron erbij');
      assert.doesNotMatch(tekst, /speelt op dit moment niets/i, 'en de rustzin is weg');
    });

    assert.deepEqual(fouten, [], 'geen scriptfouten op het scherm');
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* DE OPLOSSER OP HET SCHERM (fase 5), in dezelfde suite: hij leeft in dezelfde
   wacht-sectie en draait op dezelfde opstelling -- een eigen serverstart zou
   dezelfde vijftien seconden nog een keer betalen om hetzelfde scherm te
   openen. Bewezen wordt de hele klikketen: Los het op -> het taak-voorstel ->
   de taak staat ECHT in de agenda (aan de API nagemeten) -> en de wacht op het
   scherm laat nu de open taak zien in plaats van de vraag. */
test('de knop "Los het op": van visumvraag naar een taak in de agenda, in twee klikken',
  { skip: geenBrowser(pw) }, async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-oplos-e2e-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  const post = (pad, body, token) => fetch(srv.base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  try {
    const u = Date.now().toString().slice(-8);
    const lid = (await post('/api/auth/register', { name: 'Reiziger', email: 'lo' + u + '@x.nl',
      phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;
    const lees = await post('/api/reis/invoer/lees', { tekst: 'Rondreis India, vertrek ' + dag(20) }, lid);
    await post('/api/reis/invoer/bevestig', { id: lees.body.voorstel.id,
      velden: { titel: 'Rondreis India', soort: 'activiteit', bestemming: 'India', van_datum: dag(20) } }, lid);

    browser = await pw.chromium.launch(browserOpties());
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
    await ctx.addInitScript((tok) => { try { localStorage.setItem('rtg_member_token', tok); } catch (e) {} }, lid);
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(srv.base + '/apps/reizen.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#wacht [data-los]', { timeout: 20000 });

    await page.click('#wacht [data-los]');
    await page.waitForSelector('#wacht [data-doe]', { timeout: 20000 });
    const grens = await page.$eval('#wacht', el => el.innerText);
    assert.match(grens, /voert hier niets uit/i, 'de grens staat bij de voorstellen');
    // voorstellen bekijken heeft nog niets uitgevoerd
    const agendaVoor = await post('/api/agenda/mijn-lijst', {}, lid);
    assert.ok(!JSON.stringify(agendaVoor.body).includes('isum'), 'kijken zet nog geen taak');

    await page.click('#wacht [data-doe]');
    /* Na de klik ververst het scherm de hele wacht; de stabiele eindtoestand
       is dat de vraag een OPEN TAAK is geworden. Op een tussentekst wachten
       zou een wedloop met die verversing zijn. */
    await page.waitForFunction(() => /staat nog open/i.test(document.querySelector('#wacht').innerText),
      null, { timeout: 20000 });
    const agendaNa = await post('/api/agenda/mijn-lijst', {}, lid);
    assert.ok(JSON.stringify(agendaNa.body).match(/isum aanvragen/), 'de taak staat echt in de agenda');
    assert.deepEqual(fouten, [], 'geen scriptfouten op het scherm');
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
