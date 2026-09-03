/* DE HULPLAAG IN DE APP-GIDS -- kan een lid er echt bij?

   WAAROM DIT EEN BROWSERTOETS IS EN GEEN API-TOETS. De routes zijn elders al
   beproefd (test/service.test.js). Wat hier wordt vastgesteld is iets anders:
   dat een lid ze KAN BEREIKEN. Dat was namelijk precies het gebrek dat deze
   hele laag oplost -- de ledenbalie had een werkstroom die niemand kon
   uitvoeren, en de chat had een mens waar je niet bij kon. Een API zonder deur
   herhaalt die fout een niveau hoger.

   Draait alleen waar Playwright met een passende browser staat; anders
   overgeslagen. Draai: npm run e2e */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { laadScherm, startServer, stop, browserOpties, geenBrowser, kantoorAlsPersoon } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadScherm();

/* DE LA WORDT LEEG NEERGEZET EN DAARNA GEVULD. `.bss-hulp` bestaat dus al
   voordat /api/service/mijn terug is, en wachten op die selector alleen levert
   een toets die onder belasting op een lege la meet -- precies hoe deze drie
   toetsen een keer wisselend zakten toen ze naast acht andere draaiden. Wachten
   op een KNOP is het eerste moment waarop er echt iets staat. */
async function laHelemaalOpen(page) {
  await page.waitForFunction(() => window.RTGGids && window.RTGGids.open, null, { timeout: 20000 });
  await page.evaluate(() => window.RTGGids.open());
  await page.waitForSelector('.bss-hulp button', { timeout: 20000 });
}

async function api(base, pad, body, tok) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {}) });
  return r.json();
}

async function metLid(fn) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-servicehulp-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'RTG-OFFICE' } });
  let browser;
  try {
    const reg = await api(base, '/api/auth/register', { name: 'Hulp Lid',
      email: 'hulplid' + process.pid + '@x.nl', phone: '0612345788',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(reg.token, 'lid-registratie geeft een token');
    browser = await pw.chromium.launch(browserOpties(pw));
    /* Telefoonformaat, want daar wordt de belofte het eerst gebroken: een
       hulpknop die op een bureaublad past en op een telefoon onder de 24x24
       zakt, bestaat voor de helft van de leden niet (TOEGANKELIJK.md). */
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('rtg_member_token', t);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    }, reg.token);
    const page = await ctx.newPage();
    await fn(page, base, reg.token);
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
}

test('een lid meldt iets vanuit het scherm waar hij stond', { skip: geenBrowser(pw) }, async () => {
  await metLid(async (page, base, token) => {
    await page.goto(base + '/apps/wallet.html', { waitUntil: 'domcontentloaded' });
    await laHelemaalOpen(page);

    await page.click('.bss-hulp button');            // "Iets melden"
    await page.fill('.bss-veld', 'Mijn saldo klopt niet meer sinds vanochtend');
    await page.click('.bss-zaak button.bss-ja');     // "Versturen"
    await page.waitForFunction(() => /Genoteerd als SUP-/.test(document.body.textContent), null, { timeout: 20000 });

    /* EN DE CONTEXT REISDE MEE. Dit is het verschil tussen deze voordeur en een
       contactformulier: het systeem wist al waar hij stond.

       LET OP HET PAD. Er wordt /apps/wallet.html geopend en er komt
       /apps/geld.html terug, en dat is GOED: wallet is een stand van RTG Geld
       geworden (PLATFORM.md par. 0) en leidt door. De context legt dus vast waar
       het lid werkelijk IS, niet welk adres hij intikte -- en dat is precies wat
       een medewerker moet weten. Deze toets stond eerst op wallet.html en zakte
       daarop; de verwachting was fout, niet de laag. */
    const mijn = await api(base, '/api/service/mijn', {}, token);
    assert.equal(mijn.zaken.length, 1, JSON.stringify(mijn).slice(0, 200));
    assert.deepEqual(mijn.zaken[0].betrokken, { soort: 'scherm', code: '/apps/geld.html' },
      'het scherm waar het lid stond reisde niet mee: ' + JSON.stringify(mijn.zaken[0].betrokken));
  });
});

test('een lid bevestigt in de app wat een medewerker vraagt', { skip: geenBrowser(pw) }, async () => {
  await metLid(async (page, base, token) => {
    const z = (await api(base, '/api/service/open',
      { onderwerp: 'betaling', titel: 'Mijn uitbetaling ontbreekt' }, token)).zaak;
    const balie = await kantoorAlsPersoon(base);
    const v = await api(base, '/api/office/service/bevestiging/vraag',
      { id: z.id, doel: 'betaalstand bekijken', capabilities: ['betaling.stand'],
        reden: 'de uitbetaling staat sinds gisteren op pending' }, balie);
    assert.ok(v.bevestiging, JSON.stringify(v).slice(0, 200));

    await page.goto(base + '/apps/wallet.html', { waitUntil: 'domcontentloaded' });
    await laHelemaalOpen(page);
    await page.waitForSelector('.bss-zaak', { timeout: 20000 });

    /* HET LID LEEST WAT ER OPENGAAT VOORDAT HIJ DRUKT. Zonder die zin is een
       bevestigingsknop een blanco cheque. */
    const tekst = await page.textContent('.bss-hulp');
    assert.match(tekst, /vraagt toegang/, 'het lid ziet niet dat er iemand toegang vraagt');
    assert.match(tekst, /betaling\.stand/, 'het lid ziet niet wat er opengaat');
    assert.match(tekst, /pending/, 'het lid ziet de reden niet');

    await page.click('.bss-zaak button.bss-ja');
    await page.waitForFunction(() => /Bevestigd\./.test(document.body.textContent), null, { timeout: 20000 });

    const mijne = await api(base, '/api/office/service/machtigingen', {}, balie);
    assert.equal(mijne.machtigingen.length, 1, 'de bevestiging leverde geen machtiging op');
    assert.deepEqual(mijne.machtigingen[0].capabilities, ['betaling.stand']);
  });
});

test('een storing die het lid raakt staat in zijn eigen hulp-la', { skip: geenBrowser(pw) }, async () => {
  await metLid(async (page, base, token) => {
    const z = (await api(base, '/api/service/open',
      { onderwerp: 'betaling', titel: 'Betalen lukt niet' }, token)).zaak;
    const balie = await kantoorAlsPersoon(base);
    await api(base, '/api/office/service/bundel', { zaken: [z.id], incident: 'RTG-0042' }, balie);

    await page.goto(base + '/apps/wallet.html', { waitUntil: 'domcontentloaded' });
    await laHelemaalOpen(page);
    await page.waitForFunction(() => /RTG-0042/.test(document.body.textContent), null, { timeout: 20000 });

    const tekst = await page.textContent('.bss-hulp');
    assert.match(tekst, /Storing RTG-0042/, 'het lid ziet de storing niet in zijn eigen la');
    /* EN ER STAAT GEEN GERUSTSTELLING. Geen groen vinkje, geen "alles werkt" --
       beschikbaarheid wordt niet per lid gemeten. */
    assert.doesNotMatch(tekst, /alles werkt|RTG werkt normaal/i,
      'het scherm belooft beschikbaarheid die niemand meet');
  });
});

test('de knop "ik wil een mens" staat er, en zet echt door', { skip: geenBrowser(pw) }, async () => {
  await metLid(async (page, base, token) => {
    await api(base, '/api/service/open', { onderwerp: 'bestelling', titel: 'Mijn bestelling kwam niet aan' }, token);
    await page.goto(base + '/apps/wallet.html', { waitUntil: 'domcontentloaded' });
    await laHelemaalOpen(page);

    const knop = page.locator('.bss-hulp button', { hasText: 'Ik wil een mens' });
    assert.equal(await knop.count(), 1, 'de knop om een mens te vragen staat er niet');
    /* En hij is met de duim te raken. Een hulpknop onder de 24x24 bestaat op
       een telefoon niet (WCAG 2.5.8, TOEGANKELIJK.md). */
    const maat = await knop.boundingBox();
    assert.ok(maat.width >= 24 && maat.height >= 24, 'de knop is ' + maat.width + 'x' + maat.height);

    await knop.click();
    await page.waitForFunction(() => /Ondertussen/.test(document.body.textContent), null, { timeout: 20000 });

    const balie = await kantoorAlsPersoon(base);
    const rij = await api(base, '/api/office/service/wachtrij', { mensGevraagd: true }, balie);
    assert.equal(rij.zaken.length, 1, 'het verzoek kwam niet in de wachtrij: ' + JSON.stringify(rij.tel));
    assert.equal(rij.zaken[0].stand, 'wachtOpMens');
  });
});

/* HET MAILADRES STAAT ER, EN KOMT VAN DE SERVER. Een kanaal dat niemand kent
   bestaat niet; en een adres dat in dit scherm was overgetypt, zou de tweede
   plek zijn die uitrekent welk adres de servicebus is (kern/service/post.js
   legt uit waarom dat bij post een lek is en geen schoonheidsfout). */
test('wie iets meldt, ziet ook waar hij het naartoe kan mailen', { skip: geenBrowser(pw) }, async () => {
  await metLid(async (page, base) => {
    await page.goto(base + '/apps/wallet.html', { waitUntil: 'domcontentloaded' });
    await laHelemaalOpen(page);
    await page.click('.bss-hulp button');            // "Iets melden"
    await page.waitForFunction(() => /Liever mailen\?/.test(document.body.textContent), null, { timeout: 20000 });

    /* Uit de BRON en niet overgetypt: verhuist het domein, dan verhuist deze
       toets mee in plaats van stil te blijven staan op het oude adres. */
    const adres = 'hulp@' + require('../server/kern/rtmail-adres').domeinVoor('kantoor');
    const tekst = await page.evaluate(() => document.body.textContent);
    assert.ok(tekst.includes(adres), 'het serviceadres staat niet in de hulp-la: ' + adres);
  });
});
