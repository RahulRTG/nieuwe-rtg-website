/* ============================================================================
   DE CONCIERGE-LUS DOOR HET SCHERM (CONCIERGE.md par. 0a)

   De lus stond sinds 30 september 2026 in de server, met toetsen tegen een
   echte server (test/conciergelus*.test.js), en had GEEN scherm. Volgens
   BETROUWBAARHEID.md bestond de functie daarmee voor een mens nog niet. Deze
   toets legt de weg af zoals twee mensen hem afleggen, met de muis:

     het lid       Privékantoor (apps/lifestyle.html), tabblad Zaken:
                   een wens in een zin, als verrassing
     het kantoor   Concierge-bureau (apps/concierge.html), Privékantoor:
                   oppakken, de gewone route weigert, een aanbod buiten de
                   speelruimte, kiezen -> het voorstel gaat naar het lid
     het lid       ziet het voorstel met de REDEN en drukt Akkoord
     het kantoor   rekent een vertraging door, ziet het klaargezette bericht,
                   kan pas versturen als hij het heeft aangevinkt, en sluit af

   Wat deze toets met opzet NIET bewijst: dat het scherm het mandaat goed
   uitrekent (dat doet de server, en test/conciergelus.test.js houdt dat vast),
   en het scherm van de ZAAK die een onderdeel levert -- dat bestaat nog niet;
   de API-weergave ervan wordt hier wel gelezen, zodat de verrassing ("discreet")
   en de positieve veldenlijst ook vanaf deze kant vastliggen.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, elevateTier, laadPlaywright, browserOpties, geenBrowser, wachtOpRust } = require('./helper');

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lusscherm-'));
const CODE = 'KANTOOR-LUSSCHERM';

const post = (base, pad, body, token) => fetch(base + '/api' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, d: await r.json().catch(() => null) }));

const tekst = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

async function wachtOpTekst(page, re, waar) {
  const tot = Date.now() + 15000;
  while (Date.now() < tot) {
    if (re.test(await tekst(page))) return;
    await new Promise(r => setTimeout(r, 150));
  }
  assert.fail(waar + ': ' + re + ' verscheen niet. Op het scherm: ' + (await tekst(page)).slice(-1500));
}

async function zaakTok(base, code) {
  const ro = await post(base, '/supplier/roster', { code });
  const staf = (ro.d && ro.d.staff) || [];
  const man = staf.find(x => x.role === 'manager') || staf[0];
  const r = await post(base, '/supplier/login', { code, staffId: man && man.id, pin: '1234' });
  return r.d && r.d.token;
}

test('de lus is door een mens te bedienen: lid vraagt, kantoor zoekt, lid beslist, kantoor sluit',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
    const reg = await post(base, '/auth/register', { name: 'Luslid', email: 'lus' + u + '@x.nl', phone: '06' + u.slice(0, 8),
      password: 'geheim12345', geboortedatum: '1980-04-04', tier: 'rtg' });
    assert.ok(reg.d && reg.d.token, 'het lid is aangemeld');
    const lid = reg.d.token;
    const kantoor = (await post(base, '/office/login', { code: CODE })).d.token;
    await elevateTier(base, lid, 'lifestyle', kantoor);

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const fouten = [];
    const lp = await ctx.newPage(); letOpFouten(lp, fouten);
    const kp = await ctx.newPage(); letOpFouten(kp, fouten);

    // ---- het lid: een wens in een zin, als verrassing ----
    await lp.goto(base + '/apps/lifestyle.html', { waitUntil: 'domcontentloaded' });
    await lp.evaluate(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, lid);
    await lp.goto(base + '/apps/lifestyle.html', { waitUntil: 'domcontentloaded' });
    await wachtOpRust(lp);
    await lp.click('.chip[data-t="zaken"]');
    await lp.waitForSelector('#lusZin');
    await lp.fill('#lusZin', 'Mijn vrouw is morgen jarig. We zijn in Amsterdam. Diner om 20 uur voor twee, geen noten.');
    await lp.selectOption('#lusRuimte', '0');
    await lp.check('#lusVerrassing');
    await lp.click('#lusVraag');
    await wachtOpTekst(lp, /Een van onze mensen regelt dit voor u/, 'het lid ziet zijn zaak');
    await wachtOpTekst(lp, /Aan: er gaat niets naar uw gezin/, 'de verrassing staat aan');

    // ---- het kantoor: oppakken, weigering, aanbod, kiezen ----
    await kp.goto(base + '/apps/concierge.html', { waitUntil: 'domcontentloaded' });
    await kp.evaluate(t => { localStorage.setItem('rtg_office_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, kantoor);
    await kp.goto(base + '/apps/concierge.html', { waitUntil: 'domcontentloaded' });
    await kp.waitForSelector('[data-bureau] [data-lus-open]');
    const kaart = kp.locator('[data-bureau]').filter({ hasText: 'concierge-lus' }).first();
    await kaart.locator('[data-lus-open]').click();
    await kaart.locator('[data-l-neem]').waitFor();
    assert.match(await kaart.innerText(), /Verrassing\./, 'het kantoor ziet dat het een verrassing is');
    await kaart.locator('[data-l-neem]').click();
    await wachtOpTekst(kp, /Opgepakt\. Met de gedeelde kantoorcode ziet het lid een rol/, 'oppakken met de gedeelde code zet geen naam');

    await kaart.locator('.js-weigering').fill('Volgeboekt om 20:00');
    await kaart.locator('[data-l-weigering]').click();
    await wachtOpTekst(kp, /Soort: bijzonder/, 'de weigering maakt het verzoek bijzonder');

    await kaart.locator('.js-a-wat').fill('Tafel bij het water');
    await kaart.locator('.js-a-van').fill('21:30');
    await kaart.locator('.js-a-duur').fill('120');
    await kaart.locator('.js-a-zaak').fill('KIKUNOI');
    await kaart.locator('.js-a-geldig').fill('30');
    await kaart.locator('.js-a-bron').selectOption('beslisser');
    await kaart.locator('[data-l-aanbod]').click();
    await kaart.locator('[data-aanbod] [data-l-kies]').waitFor();
    await kaart.locator('[data-aanbod] [data-l-kies]').click();
    await wachtOpTekst(kp, /Buiten het mandaat: het voorstel ligt bij het lid\. \S/, 'het voorstel gaat naar het lid, met de reden');

    // ---- het lid: het voorstel, met de reden, en Akkoord ----
    await lp.reload({ waitUntil: 'domcontentloaded' });
    await wachtOpRust(lp);
    await lp.click('.chip[data-t="zaken"]');
    await lp.waitForSelector('.js-lus');
    await lp.click('.js-lus');
    await wachtOpTekst(lp, /Wij leggen u iets voor.*Tafel bij het water.*Waarom wij het u vragen: \S/, 'het lid ziet voorstel en reden');
    await lp.click('.js-lus-ja');
    await wachtOpTekst(lp, /Alles is geregeld\./, 'na het akkoord staat het vast');

    // ---- de zaak (API): ziet zijn eigen onderdeel, discreet, zonder codenaam ----
    const zt = await zaakTok(base, 'KIKUNOI');
    const op = await post(base, '/supplier/concierge/opdrachten', {}, zt);
    assert.equal(op.status, 200);
    const mijn = op.d.opdrachten.find(o => o.wat === 'Tafel bij het water');
    assert.ok(mijn, 'de zaak ziet het onderdeel');
    assert.equal(mijn.discreet, true, 'de verrassing reist mee als "discreet"');
    assert.deepEqual(Object.keys(mijn).sort(), ['caseRef', 'datum', 'discreet', 'duurMin', 'gelegenheid', 'onderdeel', 'personen', 'stand', 'van', 'wat', 'wensen']);

    // ---- het kantoor: vertraging, eerst zien dan versturen, afsluiten ----
    await kp.reload({ waitUntil: 'domcontentloaded' });
    await kp.waitForSelector('[data-bureau] [data-lus-open]');
    const k2 = kp.locator('[data-bureau]').filter({ hasText: 'concierge-lus' }).first();
    await k2.locator('[data-lus-open]').click();
    await k2.locator('[data-onderdeel] .js-min').waitFor();
    await k2.locator('[data-onderdeel] .js-min').fill('15');
    await k2.locator('[data-l-vertraging]').click();
    await wachtOpTekst(kp, /1 bericht\(en\) klaargezet\. Er is nog niets verstuurd\./, 'de vertraging zet klaar en verstuurt niet');
    await k2.locator('[data-l-verstuur]').waitFor();
    assert.equal(await k2.locator('[data-l-verstuur]').isDisabled(), true, 'versturen kan pas als alles is gezien');
    await k2.locator('.js-gezien').check();
    assert.equal(await k2.locator('[data-l-verstuur]').isDisabled(), false);
    await k2.locator('[data-l-verstuur]').click();
    await wachtOpTekst(kp, /1 van 1 bezorgd\./, 'het bericht is bij de zaak');

    await k2.locator('.js-slot').waitFor();
    await k2.locator('.js-slot').fill('Tafel bij het water om 21:45');
    await k2.locator('[data-l-geregeld]').click();
    await wachtOpTekst(kp, /Geregeld, met de uitkomst erbij\./, 'de zaak sluit');

    // en de waarheid eronder: geregeld, met een uitkomst
    const zaken = await post(base, '/member/bureau/zaken', {}, lid);
    const z = zaken.d.zaken.find(x => x.werkwijze === 'voorstel');
    assert.equal(z.status, 'geregeld');
    assert.equal(z.uitkomst.beloften.nagekomen, 1);
    assert.equal(z.uitkomst.opnieuwVerteld, 0);

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
