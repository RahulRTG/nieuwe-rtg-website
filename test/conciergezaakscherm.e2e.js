/* ============================================================================
   DE ZAAK IN DE CONCIERGE-LUS, EN TUSSEN JA EN NEE AAN TAFEL -- door het scherm
   (CONCIERGE.md par. 0a, 2.7-2.9)

   Ronde 1 bouwde de schermen voor het lid en het kantoor. Twee stukken bleven
   alleen over de API bereikbaar, en volgens BETROUWBAARHEID.md bestonden ze dus
   voor een mens nog niet:

     de zaak die een onderdeel levert  ziet zijn opdrachten op Vandaag in de
                                        leverancier-app en bevestigt ze;
     de tafeluitzondering              een medewerker biedt een andere tijd aan
                                        of zet door naar een manager, en het lid
                                        antwoordt op de Food Court.

   Plus de regel uit de tegenlezing die geen zakkende toets had: een NIET
   aangevinkte verrassing wordt nooit als `verrassing: false` meegestuurd, want
   de server laat een expliciete false winnen van wat hij uit de zin las. De
   toets kijkt daarom naar twee dingen: het lijf dat de browser verstuurt, en de
   stand die de server ervan maakte.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, elevateTier, laadPlaywright, browserOpties, geenBrowser, wachtOpRust } = require('./helper');

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zaakscherm-'));
const CODE = 'KANTOOR-ZAAKSCHERM';

const post = (base, pad, body, token) => fetch(base + '/api' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, d: await r.json().catch(() => null) }));

const tekst = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
async function wachtOpTekst(page, re, waar) {
  const tot = Date.now() + 30000;
  while (Date.now() < tot) {
    if (re.test(await tekst(page))) return;
    await new Promise(r => setTimeout(r, 150));
  }
  assert.fail(waar + ': ' + re + ' verscheen niet. Op het scherm: ' + (await tekst(page)).slice(-1500));
}

async function zaakTok(base, code, rol) {
  const staf = ((await post(base, '/supplier/roster', { code })).d || {}).staff || [];
  const wie = rol === 'manager' ? staf.find(x => x.role === 'manager') : staf.find(x => x.role !== 'manager');
  const r = await post(base, '/supplier/login', { code, staffId: wie && wie.id, pin: rol === 'manager' ? '1234' : '5678' });
  return r.d && r.d.token;
}

const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

test('de zaak bevestigt haar onderdeel, de tafel kent een andere tijd en een manager, en een uitgevinkte verrassing blijft een verrassing',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
    const reg = await post(base, '/auth/register', { name: 'Zaaklid', email: 'zl' + u + '@x.nl', phone: '06' + u.slice(0, 8),
      password: 'geheim12345', geboortedatum: '1980-04-04', tier: 'rtg' });
    const lid = reg.d.token;
    const kantoor = (await post(base, '/office/login', { code: CODE })).d.token;
    await elevateTier(base, lid, 'lifestyle', kantoor);

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const fouten = [];

    // ---- 1. het lid: een verrassing uit de ZIN, met het vinkje UIT ----
    const lp = await ctx.newPage(); letOpFouten(lp, fouten);
    await lp.goto(base + '/apps/lifestyle.html', { waitUntil: 'domcontentloaded' });
    await lp.evaluate(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, lid);
    await lp.goto(base + '/apps/lifestyle.html', { waitUntil: 'domcontentloaded' });
    await wachtOpRust(lp);
    await lp.click('.chip[data-t="zaken"]');
    await lp.waitForSelector('#lusZin');
    await lp.fill('#lusZin', 'Mijn vrouw is morgen jarig, ze weet van niets. We zijn in Amsterdam. Diner om 20 uur voor twee.');
    assert.equal(await lp.isChecked('#lusVerrassing'), false, 'het vinkje staat uit');
    const verzoek = lp.waitForRequest(r => r.url().endsWith('/api/member/bureau/lus/intake'));
    await lp.click('#lusVraag');
    const lijf = JSON.parse((await verzoek).postData() || '{}');
    assert.ok(!('verrassing' in lijf), 'een uitgevinkte verrassing gaat niet mee als veld: ' + JSON.stringify(lijf));
    await wachtOpTekst(lp, /Aan: er gaat niets naar uw gezin/, 'de verrassing die de server uit de zin las, blijft staan');
    const z = ((await post(base, '/member/bureau/zaken', {}, lid)).d.zaken || []).find(x => x.werkwijze === 'voorstel');
    assert.equal(z.verrassing, true, 'de server houdt de verrassing uit de zin vast');

    // ---- 2. het kantoor zet een onderdeel uit bij KIKUNOI (API: dat scherm is al beproefd) ----
    const key = (await post(base, '/office/bureau', {}, kantoor)).d.zaken.find(x => x.id === z.id).key;
    await post(base, '/office/bureau/lus/neem', { key, id: z.id }, kantoor);
    const on = await post(base, '/office/bureau/lus/onderdeel', { key, id: z.id, wat: 'Verjaardagstaart', zaak: 'KIKUNOI', van: '21:30', duurMin: 10 }, kantoor);
    assert.equal(on.status, 200, JSON.stringify(on.d));

    // ---- 3. de zaak: ziet de opdracht op Vandaag, discreet, en bevestigt ----
    const man = await zaakTok(base, 'KIKUNOI', 'manager');
    const zp = await ctx.newPage(); letOpFouten(zp, fouten);
    await zp.goto(base + '/apps/leverancier.html?sector=restaurant', { waitUntil: 'domcontentloaded' });
    await zp.evaluate(t => { localStorage.setItem('rtg_sup_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, man);
    await zp.goto(base + '/apps/leverancier.html?sector=restaurant', { waitUntil: 'domcontentloaded' });
    await zp.waitForSelector('#lusOpdrachten .js-lus-bev');
    const kaart = await zp.locator('#lusOpdrachten').innerText();
    assert.match(kaart, /Opdrachten van De Rechterhand/i);
    assert.match(kaart, /Verjaardagstaart/);
    assert.match(kaart, /Discreet\./, 'de verrassing reist mee als discreet');
    assert.doesNotMatch(kaart, /Zaaklid|lifestyle/i, 'geen naam en geen pas van het lid');
    await zp.click('#lusOpdrachten .js-lus-bev');
    await wachtOpTekst(zp, /Verjaardagstaart.*Bevestigd/i, 'de zaak ziet haar bevestiging');
    const kz = (await post(base, '/office/bureau/lus', { key, id: z.id }, kantoor)).d.zaak;
    assert.equal(kz.onderdelen.find(o => o.wat === 'Verjaardagstaart').stand, 'bevestigd', 'het kantoor ziet het onderdeel bevestigd');
    assert.ok(kz.tijdlijn.some(r => /Bevestigd door de zaak/.test(r.notitie)), 'en in de tijdlijn staat dat de zaak het deed');

    // ---- 4. de tafel: een medewerker zet door, en biedt een andere tijd aan ----
    const a = await post(base, '/reserveer', { supplierCode: 'KIKUNOI', datum: morgen(), tijd: '20:00', personen: 2 }, lid);
    const b = await post(base, '/reserveer', { supplierCode: 'KIKUNOI', datum: morgen(), tijd: '19:00', personen: 2 }, lid);
    assert.equal(a.status, 200, JSON.stringify(a.d)); assert.equal(b.status, 200, JSON.stringify(b.d));
    const mw = await zaakTok(base, 'KIKUNOI', 'medewerker');
    const mp = await ctx.newPage(); letOpFouten(mp, fouten);
    await mp.goto(base + '/apps/leverancier.html?sector=restaurant', { waitUntil: 'domcontentloaded' });
    await mp.evaluate(t => { localStorage.setItem('rtg_sup_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, mw);
    await mp.goto(base + '/apps/leverancier.html?sector=restaurant', { waitUntil: 'domcontentloaded' });
    const antwoorden = [];
    mp.on('dialog', d => d.accept(antwoorden.shift() || ''));
    // de weg van een medewerker: "Vandaag nog doen" wijst naar de open reserveringen
    await mp.waitForSelector('button.todo-row[data-goto="orders"]');
    await mp.click('button.todo-row[data-goto="orders"]');
    const rij = (id) => mp.locator('[data-res="' + id + '"]');
    await rij(b.d.reservering.id).locator('.js-resdoor').waitFor();
    antwoorden.push('Jubileum, graag een uitzondering');
    await rij(b.d.reservering.id).locator('.js-resdoor').click();
    await wachtOpTekst(mp, /Doorgezet: een manager beslist\. Jubileum/, 'de medewerker ziet dat een manager beslist');
    assert.equal(await rij(b.d.reservering.id).locator('.js-resok').count(), 0, 'na doorzetten heeft de medewerker geen Bevestig meer');
    antwoorden.push('21:15', '12');
    await rij(a.d.reservering.id).locator('.js-restv').click();
    await wachtOpTekst(mp, /Aangeboden in plaats van 20:00; vastgehouden tot \d\d:\d\d\. Wacht op de gast\./, 'het tegenvoorstel staat met zijn termijn');

    // ---- 5. het lid antwoordt op de Food Court ----
    await lp.goto(base + '/apps/foodcourt.html', { waitUntil: 'domcontentloaded' });
    await lp.waitForSelector('#tvLijst .js-tv-ja');
    assert.match(await lp.locator('#tvLijst').innerText(), /Om 20:00 lukt het niet\. Wel om 21:15/);
    assert.doesNotMatch(await lp.locator('#tvLijst').innerText(), /medewerker|manager/i, 'het lid ziet niet wie het besloot');
    await lp.click('#tvLijst .js-tv-ja');
    await wachtOpTekst(lp, /Uw tafel om 21:15 is bevestigd\./, 'het lid hoort dat het vaststaat');
    const mijn = (await post(base, '/reserveringen/mijn', {}, lid)).d.reserveringen.find(x => x.id === a.d.reservering.id);
    assert.equal(mijn.status, 'bevestigd');
    assert.equal(mijn.tijd, '21:15');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
