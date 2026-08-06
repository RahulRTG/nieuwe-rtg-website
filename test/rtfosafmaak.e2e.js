/* ============================================================================
   DE TWEE LAATSTE SCHERMEN

   De grenzen staan in test/rtfos-afmaak.test.js. Dit gaat over wat er op het
   scherm verschijnt, en bij deze twee is dat elk een ander soort fout.

   DE VELD-APP kan er perfect uitzien terwijl hij te veel toont: een lijst met
   alle hulpvragen van de stad ziet er precies zo uit als een lijst met de
   toegewezen drie. Daarom wordt hier geteld: de tweede hulpvraag hoort er NIET
   op te staan, en zijn codenaam mag ook nergens in het rauwe antwoord opduiken.

   HET DONATEURSSCHERM kan een gever iets vertellen wat niet van hem is. Er
   staat een tweede gever in het decor met een ander bedrag; die twee mogen
   nergens verschijnen -- niet in de tekst en niet in het antwoord.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, kantoorAlsPersoon } = require('./helper');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfosaf-e2e-'));
const OFFICE_CODE = 'RTFOSAFE-KEURING';

// wat op geen van beide schermen mag staan
const GEHEIM = ['Zonnelaan', '0655544433', 'Peter G.', 'Rijke Buurman', 'schoolspullen voor twee'];
const lekken = t => GEHEIM.filter(g => t.includes(g));

async function decor(base) {
  const token = await kantoorAlsPersoon(base);
  assert.ok(token, 'geen kantoorsessie');
  const post = (pad, body, tok) => fetch(base + pad, {
    method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {})
  }).then(r => r.json());
  const api = (pad, body, tok) => post('/api/rtfos/' + pad, body, tok || token);

  const stad = (await api('stad/maak', { naam: 'Zaanstad' })).stad;
  await api('stad/status', { id: stad.id, status: 'actief' });
  for (const vlag of ['individual_cases', 'donations', 'youth_programs']) {
    await api('stad/module', { id: stad.id, vlag, aan: true });
  }
  const reg = await post('/api/auth/register', { name: 'Medewerker Fatima', email: 'mf@rtfosafe.test',
    phone: '0612345687', password: 'geheim123', geboortedatum: '1992-01-01', pasApp: 'rtg' });
  await post('/api/account/koppel', { soort: 'kantoor', code: OFFICE_CODE }, reg.token);
  const werker = (await post('/api/account/start', { rol: 'kantoor' }, reg.token)).token;
  const key = (await api('ik', {}, werker)).key;
  await api('zetel', { stad: stad.id, key, naam: 'Fatima', rol: 'medewerker' });

  const project = (await api('project/maak', { stad: stad.id, naam: 'Huiswerkklas Zaandam',
    soort: 'jongeren', budget: 700, doelgroep: 'jongeren 12-18' })).project;
  for (const st of ['aanvraag', 'beoordeling', 'goedgekeurd', 'actief']) {
    await api('project/status', { id: project.id, status: st });
  }

  const mijn = (await api('casus/maak', { stad: stad.id, soort: 'voedsel', urgentie: 'hoog', wijk: 'Poelenburg',
    vraag: 'geen geld voor eten deze week', contact: 'Aisha M., Zonnelaan 4, 0655544433' })).casus;
  const ander = (await api('casus/maak', { stad: stad.id, soort: 'schoolspullen', urgentie: 'middel',
    vraag: 'schoolspullen voor twee kinderen', contact: 'Peter G., 0699988877' })).casus;
  await api('casus/toewijzen', { id: mijn.id, key });

  const gift = (await api('bron/maak', { stad: stad.id, soort: 'donatie', gever: 'Familie Bakker',
    bedrag: 250, projectId: project.id })).bron;
  await api('bron/maak', { stad: stad.id, soort: 'donatie', gever: 'Rijke Buurman', bedrag: 7500 });
  const scode = (await api('donateur/code', { bronId: gift.id })).code;

  return { token, werker, scode, mijnCodenaam: mijn.codenaam, anderCodenaam: ander.codenaam };
}

async function scherm(base, pad) {
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  const antwoorden = [];
  page.on('response', async res => {
    if (!res.url().includes('/api/rtfos/')) return;
    try { antwoorden.push(await res.text()); } catch (e) { /* afgebroken */ }
  });
  await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
  return { browser, page, fouten, antwoorden };
}

test('de veld-app toont de toegewezen hulpvraag en de andere nergens, ook niet in het antwoord',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  let s;
  try {
    const d = await decor(srv.base);
    s = await scherm(srv.base, '/apps/foundation/os-veld.html');
    await s.page.evaluate(t => { localStorage.setItem('rtg_office_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, d.werker);
    await s.page.goto(srv.base + '/apps/foundation/os-veld.html', { waitUntil: 'domcontentloaded' });
    await s.page.waitForSelector('[data-adres]', { timeout: 15000 });

    const tekst = await s.page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.ok(tekst.includes(d.mijnCodenaam), 'de toegewezen hulpvraag staat niet op het scherm');
    assert.equal(tekst.includes(d.anderCodenaam), false, 'een niet-toegewezen hulpvraag stond in de veld-app');
    assert.match(tekst, /geen geld voor eten/, 'de vraag zelf staat er niet');

    // het adres staat er niet, tot je erom vraagt
    assert.deepEqual(lekken(tekst), [], 'het scherm lekt voordat er iets is opgevraagd: ' + lekken(tekst).join(', '));
    await s.page.click('[data-adres]');
    await s.page.waitForSelector('.melder.goed', { timeout: 15000 });
    assert.match(await s.page.textContent('.melder.goed'), /Zonnelaan/, 'het adres kwam niet in beeld na de knop');
    assert.match(await s.page.textContent('.melder.goed'), /genoteerd/i, 'er staat niet bij dat het openen is genoteerd');

    // afronden weigert, met de reden
    await s.page.click('[data-af]');
    await s.page.waitForSelector('.melder.fout', { timeout: 15000 });
    assert.match(await s.page.textContent('.melder.fout'), /co(o|ö)rdinator/i);

    // en een rapport zonder vervolg wordt op het scherm geweigerd
    const id = await s.page.getAttribute('[data-rap]', 'data-rap');
    await s.page.fill('#h-' + id + ' .rTekst', 'langsgeweest en pakket afgegeven');
    await s.page.click('[data-rap]');
    await s.page.waitForFunction(() => /vervolg/i.test(
      (document.querySelector('.melder.fout') || {}).textContent || ''), null, { timeout: 15000 });

    const rauw = s.antwoorden.join('\n');
    assert.equal(rauw.includes(d.anderCodenaam), false, 'de andere hulpvraag zat wel in het antwoord aan de veld-app');
    assert.equal(rauw.includes('Peter G.'), false, 'er ging een naam mee die niet aan deze medewerker toebehoort');
    assert.deepEqual(s.fouten, [], 'paginafouten: ' + s.fouten.join(' | '));
  } finally {
    if (s && s.browser) await s.browser.close();
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('het donateursscherm toont de eigen gift en nergens die van een ander',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP + '-2', OFFICE_CODE } });
  let s;
  try {
    const d = await decor(srv.base);
    s = await scherm(srv.base, '/apps/foundation/os-donateur.html');

    // eerst een code met het verkeerde voorvoegsel
    await s.page.fill('#code', 'RTFX-FOUT');
    await s.page.click('#open');
    await s.page.waitForSelector('.melder.fout', { timeout: 15000 });
    assert.match(await s.page.textContent('.melder.fout'), /begint niet met RTFS/);

    await s.page.fill('#code', d.scode);
    await s.page.click('#open');
    await s.page.waitForSelector('[data-bewijs]', { timeout: 15000 });

    const tekst = await s.page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(tekst, /Familie Bakker/, 'de eigen naam staat er niet');
    assert.match(tekst, /Huiswerkklas Zaandam/, 'de bestemming van de gift staat er niet');
    assert.deepEqual(lekken(tekst), [], 'het donateursscherm lekt: ' + lekken(tekst).join(', '));
    assert.equal(/7\.?500/.test(tekst), false, 'het bedrag van een andere gever stond op het scherm');

    // het giftbewijs zegt dat het een gewone gift is, met de drempel erbij
    await s.page.click('[data-bewijs]');
    await s.page.waitForFunction(() => /drempel/i.test(document.body.innerText), null, { timeout: 15000 });
    const na = await s.page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(na, /Stichting RTFoundation/, 'het bewijs noemt de stichting niet');
    assert.equal(/periodieke gift op grond van/i.test(na), false,
      'het bewijs noemde de gift periodiek zonder vastgelegde overeenkomst');

    const rauw = s.antwoorden.join('\n');
    assert.deepEqual(lekken(rauw), [], 'het antwoord aan de gever lekt');
    assert.equal(/"hulpvragen"|"casussen"|"perWijk"/.test(rauw), false,
      'er gaan gegevens over hulpvragen naar het donateursscherm');
    assert.deepEqual(s.fouten, [], 'paginafouten: ' + s.fouten.join(' | '));
  } finally {
    if (s && s.browser) await s.browser.close();
    stop(srv && srv.child);
    try { fs.rmSync(TMP + '-2', { recursive: true, force: true }); } catch (e) {}
  }
});
