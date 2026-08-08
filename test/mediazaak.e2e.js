/* DE INTERNE BIBLIOTHEEK OP HET SCHERM -- want een knop die niemand heeft zien
   werken, is geen knop (LAT.md regel 10).

   De server-kant staat in test/mediazaak.test.js. Deze toets doet wat een
   leidinggevende doet: het Theater openen, zien dat zijn zaak nog geen interne
   bibliotheek heeft, hem beginnen -- en daarna kijken of de keuze "waar komt
   deze video" ook echt verschijnt zodra het kantoor hem heeft goedgekeurd. Die
   laatste is met opzet de kern: hij hangt aan de volgorde waarin het scherm
   zijn twee standen ophaalt, en dat soort halve werking valt nergens op.

   En de andere kant: een lid dat NERGENS werkt hoort dit blok helemaal niet te
   zien. Een tab die altijd nee zegt is geen tab.

   Draai: npm run e2e (of los: node --experimental-sqlite --test test/mediazaak.e2e.js) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten } = require('./helper');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) {}
  return null;
}
const pw = laadBrowser();

test('de leiding begint een interne bibliotheek, en wie nergens werkt ziet hem niet',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mzscherm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  const api = (pad, body, token) => fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  try {
    const u = Date.now().toString().slice(-8);
    const email = 'mzs' + u + '@x.nl', wachtwoord = 'geheim12345';
    const baas = await api('/api/auth/register', { name: 'Baas', email, phone: '06' + u,
      password: wachtwoord, geboortedatum: '1985-01-01', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(baas.body.token, 'de baas is ingelogd');
    const buiten = await api('/api/auth/register', { name: 'Buiten', email: 'mzb' + u + '@x.nl', phone: '07' + u,
      password: wachtwoord, geboortedatum: '1985-01-01', tier: 'rtg', pasApp: 'rtg' });

    // hem echt aan een zaak koppelen, langs de weg die het huis daarvoor heeft
    const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
    const man = roster.staff.find(x => x.role === 'manager');
    const zaakToken = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;
    const inv = await api('/api/supplier/staff/invite', { name: 'Baas', role: 'manager', func: 'demo' }, zaakToken);
    assert.equal((await api('/api/supplier/staff/join', { bedrijf: roster.supplier.name,
      kassacode: inv.body.invite.kassacode, login: email, password: wachtwoord })).status, 200);

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const maakPagina = async (token) => {
      const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, serviceWorkers: 'block' });
      await ctx.addInitScript((t) => {
        try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
      }, token);
      return ctx.newPage();
    };

    const page = await maakPagina(baas.body.token);
    const fouten = letOpFouten(page, []);
    await page.goto(base + '/apps/theater.html', { waitUntil: 'load' });
    await page.waitForSelector('#blokZaak:not(.weg)', { timeout: 20000 });
    assert.match(await page.$eval('#zaakBeheer', e => e.textContent), /nog geen interne bibliotheek/,
      'zijn zaak heeft er nog geen, en dat staat er');

    await page.locator('#zaakBeheer .knop', { hasText: 'Begin de interne bibliotheek' }).click();
    await page.waitForFunction(() => /RTG-kantoor/.test(document.querySelector('#melding').textContent),
      null, { timeout: 10000 });

    /* Nu keurt het kantoor hem goed. Daarna hoort de KEUZE te verschijnen waar
       een nieuwe video naartoe gaat -- en dat is precies de plek waar de
       volgorde van het scherm telt. */
    const office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
    const rij = await api('/api/office/theater', {}, office);
    const wacht = (rij.body.wacht || [])[0];
    assert.ok(wacht, 'de bibliotheek staat in de wachtrij van het kantoor');
    assert.equal((await api('/api/office/theater/beslis', { id: wacht.id, besluit: 'goedgekeurd' }, office)).status, 200);

    // en hij heeft ook een eigen kanaal nodig om het uploadblok te zien
    assert.equal((await api('/api/theater/kanaal/aanmeld', { naam: 'Eigen kanaal', genre: 'ambacht' }, baas.body.token)).status, 200);
    const eigen = (await api('/api/office/theater', {}, office)).body.wacht.find(k => k.naam === 'Eigen kanaal');
    assert.equal((await api('/api/office/theater/beslis', { id: eigen.id, besluit: 'goedgekeurd' }, office)).status, 200);

    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#vDoel', { timeout: 20000 });
    const opties = await page.$$eval('#vDoel option', els => els.map(e => e.textContent));
    assert.equal(opties.length, 2, 'twee bestemmingen: ' + opties.join(' | '));
    assert.match(opties[0], /eigen kanaal/i);
    assert.match(opties[1], /^Intern:/, 'en de interne bibliotheek met zijn zaaknaam');

    /* En de werklijst: de leiding zet de video erop, en dan staat hij er bij
       de medewerker ook -- met de zin erbij dat er geen kijkgedrag gemeten
       wordt. Zonder dit rondje is die hele knop nooit door iets aangeraakt. */
    const bieb = (await api('/api/theater/zaak', {}, baas.body.token)).body;
    const biebKanaal = (bieb.kanalen || [])[0];
    const vid = (await api('/api/theater/video/maak', { kanaalId: biebKanaal.id, titel: 'Werkinstructie', duurS: 30 }, baas.body.token)).body.id;
    await fetch(base + '/api/theater/upload/' + vid, { method: 'POST',
      headers: { 'Content-Type': 'video/webm', Authorization: 'Bearer ' + baas.body.token },
      body: Buffer.concat([Buffer.from([0x1A, 0x45, 0xDF, 0xA3]), Buffer.alloc(600, 7)]) });

    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#kijkplicht .kaart', { timeout: 20000 });
    await page.locator('#kijkplicht .knop', { hasText: 'Zet op de werklijst' }).click();
    await page.waitForFunction(() => /werklijst gezet/.test(document.querySelector('#melding').textContent),
      null, { timeout: 10000 });
    await page.waitForFunction(() => /Uw werk vraagt u dit te bekijken/.test(document.querySelector('#kijkplicht').textContent),
      null, { timeout: 10000 });
    assert.match(await page.$eval('#kijkplicht', e => e.textContent), /meet geen kijkgedrag/,
      'en het scherm zegt zelf wat er niet gemeten wordt');
    await page.locator('#kijkplicht .knop', { hasText: 'Ik heb dit gezien' }).click();
    await page.waitForFunction(() => /eigen verklaring/.test(document.querySelector('#melding').textContent),
      null, { timeout: 10000 });

    // en wie nergens werkt, ziet het hele blok niet
    const kaal = await maakPagina(buiten.body.token);
    const fouten2 = letOpFouten(kaal, []);
    await kaal.goto(base + '/apps/theater.html', { waitUntil: 'load' });
    await kaal.waitForSelector('#vZaal:not(.weg)', { timeout: 20000 });
    assert.equal(await kaal.$eval('#blokZaak', e => e.className.indexOf('weg') >= 0), true,
      'wie nergens werkt ziet geen zakenblok');
    assert.equal(await kaal.$$eval('#vDoel', els => els.length), 0, 'en geen bestemmingskeuze');

    assert.deepEqual(fouten, [], 'geen fout op de pagina van de baas');
    assert.deepEqual(fouten2, [], 'geen fout op de pagina van het kale lid');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
