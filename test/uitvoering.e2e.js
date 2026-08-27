/* HET SCHERM VAN DE UITVOERENDE MEDIA -- want een knop die niemand heeft zien
   werken, is geen knop (LAT.md regel 10).

   De serverkant staat in test/uitvoering.test.js. Deze toets doet wat een lid
   doet: de app openen, een partituur kiezen, zeggen hoeveel tijd hij heeft, en
   kijken wat er komt.

   De scherpste assertie is de TWEEDE. Vraagt iemand minder tijd dan het
   onmisbare deel van het werk duurt, dan hoort daar geen rood kruis te komen
   maar een ANTWOORD: dit is wat de kern duurt, korter bestaat er niet. Een
   scherm dat daar een foutmelding van maakt, draait de hele keuze van
   UITVOEREND.md par. 2.3 terug zonder dat de server verandert.

   Draai: npm run e2e (of los: node --experimental-sqlite --test test/uitvoering.e2e.js) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

test('een lid vraagt om een uitvoering, en leest waaruit hij bestaat',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uitve2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const api = (pad, lijf, token) => fetch(base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(lijf || {}) }).then(r => r.json());

    const u = Date.now().toString().slice(-8);
    const lid = await api('/api/auth/register', { name: 'Partituurlid', email: 'ue' + u + '@x.nl',
      phone: '06' + u, password: 'geheim12345', geboortedatum: '1990-03-03', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(lid.token, 'het lid is ingelogd');

    // eigen werk: een uitgegeven stuk (de kern) en een korte video (verdieping)
    const trackId = (await api('/api/muziek/maak', {}, lid.token)).track.id;
    // 32 maten op 60 slagen = 128 seconden, dus het kernfragment van 60 past
    await api('/api/muziek/bewaar', { id: trackId, naam: 'De lange weg', klaar: true, bpm: 60, maten: 32 }, lid.token);
    const uitgave = (await api('/api/muziek/uitgeven', { id: trackId }, lid.token)).uitgave;
    const clip = (await api('/api/clips/maak', { titel: 'Aanloop', duurS: 20, mbGeschat: 2 }, lid.token)).id;

    const p = (await api('/api/uitvoering/partituur/maak', { naam: 'De lange weg' }, lid.token)).partituur;
    await api('/api/uitvoering/partituur/onderdeel',
      { id: p.id, fragmentId: 'fragment:track:' + uitgave.id + '@0-60', rol: 'kern', naam: 'Het stuk zelf' }, lid.token);
    await api('/api/uitvoering/partituur/onderdeel',
      { id: p.id, fragmentId: 'fragment:clip:' + clip + '@0-10', rol: 'verdieping', naam: 'Aanloop' }, lid.token);
    await api('/api/uitvoering/partituur/zet',
      { id: p.id, toestemming: { inkorten: true }, klaar: true }, lid.token);

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, serviceWorkers: 'block' });
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
    }, lid.token);
    const page = await ctx.newPage();
    const fouten = letOpFouten(page, []);

    await page.goto(base + '/apps/uitvoering.html', { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelectorAll('#kiesP option').length > 0
      && document.querySelector('#kiesP option').value !== '', null, { timeout: 20000 });

    // 1) ruim genoeg tijd: de montage komt, met per regel waarom hij er staat
    await page.selectOption('#kiesP', p.id);
    await page.fill('#budget', '75');
    await page.click('#voerKnop');
    await page.waitForSelector('#uitslag .regel', { timeout: 15000 });
    const regels = await page.$$eval('#uitslag ol .regel b', els => els.map(e => e.textContent));
    assert.equal(regels.length, 2, 'de kern plus de verdieping die past');
    assert.ok(regels.includes('Het stuk zelf'), 'het onmisbare deel staat erin');
    const waaroms = await page.$$eval('#uitslag .waarom', els => els.map(e => e.textContent).filter(Boolean));
    assert.equal(waaroms.length, 2, 'elke regel draagt waarom hij er staat');

    // en het BEWIJS staat er even groot bij, niet in de kleine lettertjes
    const bewijs = await page.$eval('#uitslag .bewijs', e => e.textContent);
    assert.match(bewijs, /Waaruit dit bestaat/, 'het bewijsblok staat er');
    assert.match(bewijs, /70s van 70s|70s/, 'met wat u krijgt: ' + bewijs.slice(0, 120));
    assert.match(bewijs, /niets tussengevoegd|gladgestreken/i, 'en de herleidbaarheid staat erbij');

    /* 2) TE WEINIG TIJD. Dit is de assertie waar het om gaat: geen foutmelding
       maar een antwoord, met de werkelijke duur van de kern erin. */
    await page.fill('#budget', '30');
    await page.click('#voerKnop');
    await page.waitForSelector('#uitslag .weiger', { timeout: 15000 });
    const weiger = await page.$eval('#uitslag', e => e.textContent);
    assert.match(weiger, /waarom/i, 'het scherm legt uit in plaats van te klagen');
    assert.match(weiger, /60/, 'en noemt hoe lang het onmisbare deel werkelijk duurt');
    assert.ok(!/undefined|NaN/.test(weiger), 'geen lege plekken in de uitleg');

    assert.deepEqual(fouten, [], 'geen fouten in de console: ' + JSON.stringify(fouten));
  } finally {
    if (browser) await browser.close();
    await stop({ child });
  }
});

test('een maker wijst een fragment aan op een tijdlijn, zonder ooit een id te typen',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-studio-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const api = (pad, lijf, token) => fetch(base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(lijf || {}) }).then(r => r.json());

    const u = Date.now().toString().slice(-8);
    const lid = await api('/api/auth/register', { name: 'Studiolid', email: 'us' + u + '@x.nl',
      phone: '06' + u, password: 'geheim12345', geboortedatum: '1990-03-03', tier: 'rtg', pasApp: 'rtg' });
    const trackId = (await api('/api/muziek/maak', {}, lid.token)).track.id;
    // 32 maten op 60 slagen = 128 seconden: lang genoeg om een bereik in te kiezen
    await api('/api/muziek/bewaar', { id: trackId, naam: 'Het lange stuk', klaar: true, bpm: 60, maten: 32 }, lid.token);
    await api('/api/muziek/uitgeven', { id: trackId }, lid.token);
    const p = (await api('/api/uitvoering/partituur/maak', { naam: 'Op de tijdlijn' }, lid.token)).partituur;

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, serviceWorkers: 'block' });
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
    }, lid.token);
    const page = await ctx.newPage();
    const fouten = letOpFouten(page, []);
    await page.goto(base + '/apps/uitvoering.html', { waitUntil: 'load' });

    await page.locator('[data-stand="studio"]').click();
    await page.waitForSelector('#werkLijst .werkknop', { timeout: 20000 });

    /* Het stuk staat er MET zijn duur. Die is gerekend uit tempo en maten
       (kern/muziek-uitgave-beeld.js); stond hij op null, dan viel er geen
       tijdlijn overheen te leggen en zou de knop uitstaan. */
    const knop = await page.$eval('#werkLijst .werkknop', e => e.textContent);
    assert.match(knop, /Het lange stuk/);
    assert.match(knop, /128s/, 'de duur is gerekend en staat erbij: ' + knop);

    await page.locator('#werkLijst .werkknop').first().click();
    await page.waitForSelector('#knipVlak:not([hidden])', { timeout: 10000 });

    /* Met het TOETSENBORD een bereik kiezen. Dat is de weg die moet werken voor
       wie niet kan slepen; als alleen slepen werkte, kon een deel van de makers
       niet monteren. */
    await page.locator('#balk').focus();
    await page.keyboard.press('Shift+ArrowRight');   // begin +10
    await page.keyboard.press('ArrowUp');            // eind +1
    const bereik = await page.$eval('#balkTekst', e => e.textContent);
    assert.match(bereik, /10s tot 31s/, 'de pijltjes verschuiven het bereik: ' + bereik);

    await page.fill('#fragNaam', 'De opbouw');
    await page.selectOption('#fragRol', 'kern');
    await page.click('#zetFragment');
    await page.waitForFunction(() => /Toegevoegd/.test(document.querySelector('#melding').textContent),
      null, { timeout: 10000 });

    /* En het staat er ook echt in, met precies het gekozen bereik. Het id is
       door het scherm samengesteld; de maker heeft geen letter ervan getypt. */
    const na = await api('/api/uitvoering/partituren', {}, lid.token);
    const mijn = (na.partituren || []).find(x => x.id === p.id);
    assert.equal(mijn.onderdelen.length, 1, 'er staat een onderdeel in');
    const o = mijn.onderdelen[0];
    assert.equal(o.naam, 'De opbouw');
    assert.equal(o.rol, 'kern');
    assert.equal(o.duurS, 21, 'van 10 tot 31 is 21 seconden');
    assert.match(o.fragmentId, /^fragment:track:.+@10-31$/, 'het id is samengesteld: ' + o.fragmentId);

    assert.deepEqual(fouten, [], 'geen fouten in de console: ' + JSON.stringify(fouten));
  } finally {
    if (browser) await browser.close();
    await stop({ child });
  }
});

test('een handeling in een uitvoering ZET KLAAR en koopt niet',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-handeling-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const api = (pad, lijf, token) => fetch(base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(lijf || {}) }).then(r => r.json());

    const u = Date.now().toString().slice(-8);
    const maker = await api('/api/auth/register', { name: 'Aanbieder', email: 'uh' + u + '@x.nl',
      phone: '06' + u, password: 'geheim12345', geboortedatum: '1990-03-03', tier: 'rtg', pasApp: 'rtg' });
    const kijker = await api('/api/auth/register', { name: 'Kijker', email: 'uk' + u + '@x.nl',
      phone: '07' + u, password: 'geheim12345', geboortedatum: '1990-03-03', tier: 'rtg', pasApp: 'rtg' });

    const mk = async (naam) => {
      const t = (await api('/api/muziek/maak', {}, maker.token)).track.id;
      await api('/api/muziek/bewaar', { id: t, naam, klaar: true, bpm: 60, maten: 32 }, maker.token);
      return (await api('/api/muziek/uitgeven', { id: t }, maker.token)).uitgave;
    };
    const hoofd = await mk('Het werk'), les = await mk('De masterclass');

    // het betaalde aanbod
    const lesP = (await api('/api/uitvoering/partituur/maak', { naam: 'De masterclass' }, maker.token)).partituur;
    await api('/api/uitvoering/partituur/onderdeel',
      { id: lesP.id, fragmentId: 'fragment:track:' + les.id + '@0-40', rol: 'kern' }, maker.token);
    await api('/api/uitvoering/partituur/zet',
      { id: lesP.id, aanspraakNodig: 'les-e2e', prijsCenten: 900, klaar: true }, maker.token);

    // het werk waarin ernaar wordt verwezen
    const p = (await api('/api/uitvoering/partituur/maak', { naam: 'Het werk' }, maker.token)).partituur;
    await api('/api/uitvoering/partituur/onderdeel',
      { id: p.id, fragmentId: 'fragment:track:' + hoofd.id + '@0-40', rol: 'kern', naam: 'Het werk zelf',
        handeling: { soort: 'aanbod', doel: lesP.id, label: 'De hele masterclass' } }, maker.token);
    await api('/api/uitvoering/partituur/zet', { id: p.id, toestemming: { inkorten: true }, klaar: true }, maker.token);

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, serviceWorkers: 'block' });
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
    /* De KIJKER zit in de browser en niet de maker: een maker die zijn eigen
       aanbod aanklikt krijgt terecht "dit is uw eigen werk", en dan zou deze
       toets de bon nooit zien. Hij opent het werk met het id, want het scherm
       toont alleen je eigen partituren -- zoeken bestaat hier nog niet. */
    }, kijker.token);
    const page = await ctx.newPage();
    const fouten = letOpFouten(page, []);
    await page.goto(base + '/apps/uitvoering.html', { waitUntil: 'load' });
    await page.waitForSelector('#vreemdP', { timeout: 20000 });

    await page.fill('#vreemdP', p.id);
    await page.click('#voerKnop');
    await page.waitForSelector('#uitslag .handeling', { timeout: 15000 });

    /* De knop noemt de PRIJS voordat er iets gebeurt, en het werkwoord komt van
       de server. Zou het scherm zelf mogen kiezen, dan koos het op een dag
       "koop" -- en dat is precies wat GELD.md par. 3 verbiedt. */
    const knop = await page.$eval('#uitslag .handeling .knop', e => e.textContent);
    assert.match(knop, /De hele masterclass/);
    assert.match(knop, /9\.00 euro/, 'de prijs staat erop: ' + knop);
    assert.ok(!/^koop|kopen/i.test(knop.trim()), 'dit is geen koopknop: ' + knop);

    await page.click('#uitslag .handeling .knop');
    await page.waitForFunction(() => /Wat dit kost/.test(document.querySelector('#uitslag').textContent),
      null, { timeout: 10000 });
    const bon = await page.$eval('#uitslag .handeling .bewijs', e => e.textContent);
    assert.match(bon, /btw|retour/i, 'de bon zegt ook wat RTG NIET doet: ' + bon.slice(0, 120));

    /* EN ER IS NIETS AFGESCHREVEN. Dit is de assertie waar het om gaat: een
       uitvoering zet klaar en rekent nooit af. */
    const aanspraken = (await api('/api/uitvoering/aanspraken', {}, kijker.token)).aanspraken || [];
    assert.ok(!aanspraken.some(a => a.code === 'les-e2e'), 'er is niets gekocht door te kijken');

    assert.deepEqual(fouten, [], 'geen fouten in de console: ' + JSON.stringify(fouten));
  } finally {
    if (browser) await browser.close();
    await stop({ child });
  }
});
