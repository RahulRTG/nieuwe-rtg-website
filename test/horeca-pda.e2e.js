/* PDA SERVICE in een echte browser: /apps/horeca-pda.html.

   De rekensom staat vast in test/horeca-werklijst.test.js. Wat hier bewezen
   wordt, is het deel dat een groene API-toets niet ziet: dat de bediening met
   deze lijst werkelijk kan werken.

   1. UITGELOGD STAAT ER EEN DEUR, geen leeg scherm (TAKEN 5.5).
   2. DE TWEE LIJSTEN STAAN ER ALLEBEI, en de scheiding is zichtbaar: een tafel
      die openstaat zonder bestelling staat NIET tussen de taken die over hun
      grens zijn -- ook niet als hij het langst wacht.
   3. EEN VERZOEK VAN EEN GAST KOMT HIER BINNEN EN GAAT ER WEER UIT. Oppakken en
      afronden zijn twee knoppen, en na "Ik ga" staat er wie het heeft.
   4. EEN COMPLETE GANG IS EEN DRAAGTAAK MET DE BORDEN EN DE ALLERGIE EROP. Een
      allergie die de drager niet ziet, is de fout die dit huis niet mag maken.
   5. DE MODUS IS EEN LENS: de runner ziet de gang wel en het verzoek niet.
   6. HET SCHERM VINKT NIETS ZELF AF: na "Ik draag hem" staat de bon nog steeds
      op klaar, en pas "Uitgegeven" haalt hem van de lijst.

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
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pda-'));

const post = (base, pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('de PDA toont uitgelogd een deur en ingelogd een werkbare servicelijst',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    /* ---- uitgelogd: een deur ---- */
    await page.goto(base + '/apps/horeca-pda.html', { waitUntil: 'load' });
    await page.evaluate(() => {
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.removeItem('rtg_sup_token');
      localStorage.removeItem('rtg_pda_modus');
    });
    await page.goto(base + '/apps/horeca-pda.html', { waitUntil: 'load' });
    await page.waitForTimeout(900);
    const uit = await page.evaluate(() => ({ pad: location.pathname,
      deur: !!document.querySelector('.rtgdeur'), tekst: document.body.innerText.replace(/\s+/g, ' ') }));
    assert.equal(uit.pad, '/apps/horeca-pda.html', 'de pagina stuurt niemand weg');
    assert.ok(uit.deur || /personeel|inlog|zaak/i.test(uit.tekst),
      'uitgelogd staat er een deur: ' + uit.tekst.slice(0, 140));

    /* ---- de zaak opstellen ---- */
    const roster = (await post(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
    const mgr = (roster.staff || []).find(x => x.role === 'manager') || roster.staff[0];
    const tok = (await post(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
    assert.ok(tok, 'de zaak-inlog werkt');
    const H = (pad, body) => post(base, '/api/supplier/horeca' + pad, body, tok);

    // een tafel met een complete gang met een allergie erop: een draagtaak
    const draag = (await H('/rekening/open', { kanaal: 'tafel', tafel: 'PDA-DRAAG', gasten: 2 })).body.rekening;
    const regel = (await H('/rekening/regel', { rekeningId: draag.id, naam: 'Tournedos', prijs: 34.5,
      aantal: 1, gang: 1, station: 'grill', allergie: 'noten' })).body.regel;
    await H('/gang/vrij', { rekeningId: draag.id, gang: 1 });
    await H('/keuken/stand', { rekeningId: draag.id, regelId: regel.id, stand: 'klaar' });

    // een tafel die openstaat zonder bestelling: geen grens, dus nooit in "nu"
    await H('/rekening/open', { kanaal: 'tafel', tafel: 'PDA-LEEG', gasten: 4 });

    /* En een halve gang met een afgesproken serveertijd die AL VOORBIJ is: die
       is over zijn grens (het serveermoment zelf) en hoort dus in "nu". Twintig
       minuten terug, in de tijd van deze machine -- dezelfde tijd waarmee
       kern/horeca/cadans.js rekent. */
    const toen = new Date(Date.now() - 20 * 60000);
    const serveerOm = String(toen.getHours()).padStart(2, '0') + ':' + String(toen.getMinutes()).padStart(2, '0');
    const laat = (await H('/rekening/open', { kanaal: 'tafel', tafel: 'PDA-LAAT', gasten: 2 })).body.rekening;
    const l1 = (await H('/rekening/regel', { rekeningId: laat.id, naam: 'Tartaar', prijs: 22, aantal: 1, gang: 1, station: 'koud' })).body.regel;
    await H('/rekening/regel', { rekeningId: laat.id, naam: 'Zeebaars', prijs: 29, aantal: 1, gang: 1, station: 'warm' });
    await H('/gang/vrij', { rekeningId: laat.id, gang: 1, serveerOm });
    await H('/keuken/stand', { rekeningId: laat.id, regelId: l1.id, stand: 'klaar' });

    // en een gast die om hulp vraagt: grens 3 minuten
    const qr = (await H('/gast/qr', { tafel: 'PDA-DRAAG' })).body;
    const aan = (await post(base, '/api/gast/aanschuiven', { token: qr.token, naam: 'Sam' })).body;
    assert.ok(aan.sleutel, 'de gast zit aan tafel');
    const vz = (await post(base, '/api/gast/verzoek', { sleutel: aan.sleutel, soort: 'hulp',
      tekst: 'Het glas is gebarsten' })).body;
    assert.ok(vz.verzoek, 'het verzoek staat: ' + JSON.stringify(vz).slice(0, 120));

    /* ---- ingelogd: de lijst ---- */
    await page.evaluate(t => { localStorage.setItem('rtg_sup_token', t); }, tok);
    await page.goto(base + '/apps/horeca-pda.html', { waitUntil: 'load' });
    await page.waitForTimeout(900);

    const lees = () => page.evaluate(() => ({
      nu: document.getElementById('pNu').innerText.replace(/\s+/g, ' '),
      open: document.getElementById('pOpen').innerText.replace(/\s+/g, ' '),
      modi: [...document.querySelectorAll('#pModi button')].map(b => b.textContent)
    }));
    let beeld = await lees();
    assert.deepEqual(beeld.modi, ['Bediening', 'Runner', 'Alles'], 'de drie werkstanden staan er');

    /* 2. de scheiding. Alleen wat over een vastgelegde grens is, staat in "nu";
       een tafel zonder bestelling heeft geen grens en komt er dus nooit in, hoe
       lang hij ook staat. */
    assert.match(beeld.nu, /PDA-LAAT/, 'de gang die zijn serveermoment voorbij is, staat in "nu"');
    assert.match(beeld.nu, /serveermoment|op tafel staan/i, 'met de reden erbij');
    assert.doesNotMatch(beeld.nu, /PDA-LEEG/, 'een tafel zonder grens staat niet in "nu"');
    assert.match(beeld.open, /PDA-LEEG/, 'maar wel in "ook open"');
    assert.match(beeld.open, /nergens vastgelegd/, 'met de reden erbij');

    /* 4. de draagtaak, met bord en allergie. Hij staat nog in "ook open": hij is
       net klaar gemeld en dus nog binnen de pasmarge -- precies zoals het hoort. */
    assert.match(beeld.open, /PDA-DRAAG/, 'de complete gang staat als taak');
    assert.match(beeld.open, /Tournedos/, 'met het bord erop');
    assert.match(beeld.open, /noten/i, 'en met de allergie in beeld');
    assert.match(beeld.open, /pas/i, 'en met de rekensom van de pasmarge');

    /* 3. het verzoek oppakken */
    assert.match(beeld.nu + beeld.open, /gebarsten/, 'het verzoek van de gast staat er');
    const gaan = await page.$('[data-stand="opgepakt"]');
    assert.ok(gaan, 'er staat een knop "Ik ga"');
    await gaan.click();
    await page.waitForTimeout(700);
    beeld = await lees();
    assert.match(beeld.nu + beeld.open, /U heeft dit opgepakt/, 'na oppakken staat er wie het heeft');

    /* 6. oppakken van een gang vinkt niets af */
    const pak = await page.$('[data-pak]');
    assert.ok(pak, 'er staat een knop om de gang te dragen');
    await pak.click();
    await page.waitForTimeout(700);
    const naPak = (await H('/rekening', { rekeningId: draag.id })).body.rekening;
    assert.equal(naPak.regels[0].stand, 'klaar', 'het bord staat nog op klaar, niet op uitgegeven');
    beeld = await lees();
    assert.match(beeld.nu + beeld.open, /PDA-DRAAG/, 'en de taak staat er nog, want hij is niet uitgegeven');

    /* 5. de modus is een lens */
    await page.click('[data-modus="runner"]');
    await page.waitForTimeout(700);
    beeld = await lees();
    assert.match(beeld.nu + beeld.open, /PDA-DRAAG/, 'de runner ziet de gang');
    assert.doesNotMatch(beeld.nu + beeld.open, /gebarsten/, 'en niet het verzoek van de gast');
    assert.doesNotMatch(beeld.nu + beeld.open, /PDA-LEEG/, 'en niet de lege tafel');
    assert.doesNotMatch(beeld.nu + beeld.open, /PDA-LAAT/, 'en niet de halve gang van de keuken');

    /* en uitgeven haalt hem er wel af */
    await page.click('[data-uit]');
    await page.waitForTimeout(700);
    const naUit = (await H('/rekening', { rekeningId: draag.id })).body.rekening;
    assert.equal(naUit.regels[0].stand, 'uitgegeven', 'nu pas is hij uitgegeven');
    beeld = await lees();
    assert.doesNotMatch(beeld.nu + beeld.open, /PDA-DRAAG/, 'en dan is de taak weg');

    assert.deepEqual(fouten, [], 'geen scriptfouten op de PDA');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
