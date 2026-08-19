/* Scherm-tests voor de overige vlaggenschip-apps: leverancier, lid en
   backoffice. Elk logt in via een API-token in localStorage (net als de PDA-
   test), opent de app in een echte browser en controleert dat de beveiligde
   hoofdweergave verschijnt (het inlogscherm gaat weg, de app komt op) zonder
   onopgevangen JS-fouten. Zo boot elk scherm aantoonbaar schoon.
   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-e2e-')); }
function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  // Geen Playwright-pakket? Onze eigen browser-driver (CDP over pipe), maar alleen als er een Chromium-binary is.
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadPlaywright();
async function api(base, pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return (await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) })).json();
}

/* RTG Command is de landing op elke breedte, en sinds het springboard als
   scherm verdween (WERELD.md) is er niets meer om naar op te vouwen. Deze helper
   klikte de knop die dat deed; hij opent nu de deur in de VOET van de bank, en
   dat is dezelfde weg die een lid heeft. `naam` is de tekst op die deur. */
async function bankDeur(page, naam) {
  await page.waitForSelector('#rtgCommand', { state: 'visible', timeout: 10000 });
  const lade = page.locator('#rtgCommand .cmd-lade');
  if (await lade.isVisible()) {
    await lade.click();
    await page.waitForSelector('#rtgCommand.bank-open', { timeout: 5000 });
  }
  await page.waitForFunction((n) => [...document.querySelectorAll('#rtgCommand .cmd-bankvoet button')]
    .some((b) => b.textContent.trim() === n), naam, { timeout: 15000 });
  await page.evaluate((n) => {
    [...document.querySelectorAll('#rtgCommand .cmd-bankvoet button')]
      .find((b) => b.textContent.trim() === n).click();
  }, naam);
}

// Gedeeld stramien: zet tokens/keys in localStorage, open de app, wacht tot het
// inlogscherm weg is en de app-weergave zichtbaar is, en eis geen JS-fouten.
async function bootTest(opts) {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const keys = await opts.tokens(base); // { rtg_sup_token: '...', ... }
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    /* DE INTAKE STAAT BUITEN DIT STRAMIEN. Een vers geregistreerd lid is niet
       `klaar`, dus opent app-main het onboardinggesprek en gaat #onbGate open
       -- en daar mag de werktafel niet overheen (shared/command.js). Deze
       toetsen gaan over "komt het scherm beveiligd op na herstel van de
       sessie", niet over de ondertekening; die heeft zijn eigen toets in
       test/werktafel.e2e.js, en dat is de plek waar de grendel hoort te zakken.
       Mocken is wat de rest van deze suite hieronder ook doet. */
    await page.route('**/api/onboarding/status', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ klaar: true }) }));
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((kv) => {
      for (const k in kv) localStorage.setItem(k, kv[k]);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      /* HIER STOND rtg_os_wereld = 'uit', om het rooster af te dwingen: het
         beginscherm had daarnaast een wereldstand (de kring om de klok) waarin
         de maprijen op display:none stonden. Die stand bestaat niet meer -- de
         klok is met het beginscherm meegegaan, zie WERELD.md -- dus is het
         rooster de enige vorm en zet deze toets niets meer voor. */
    }, keys);
    await page.goto(base + opts.pad, { waitUntil: 'load' });
    await page.waitForSelector('#gate', { state: 'hidden', timeout: 15000 });
    await page.waitForSelector('#app', { state: 'visible', timeout: 5000 });
    if (opts.na) await opts.na(page);
    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
}

test('Leverancier-app: de zaak-backoffice komt beveiligd op',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  await bootTest({
    pad: '/apps/leverancier.html',
    tokens: async (base) => {
      const roster = await api(base, '/api/supplier/roster', { code: 'KIKUNOI' });
      const man = roster.staff.find(x => x.role === 'manager');
      const login = await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' });
      assert.ok(login.token, 'manager-login geeft een token');
      return { rtg_sup_token: login.token };
    }
  });
});

test('Leden-app: de eigen pas komt beveiligd op na herstel van de sessie',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  await bootTest({
    pad: '/apps/app.html?pas=business',
    tokens: async (base) => {
      const reg = await api(base, '/api/auth/register', { name: 'Lid Een', email: 'appboot@x.nl', phone: '0612345788',
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
      assert.ok(reg.token, 'lid-registratie geeft een token');
      return { rtg_member_token: reg.token };
    },
    /* HET BEGINSCHERM IS DE WERKTAFEL, EN DEZE TOETS IS MEEVERHUISD.

       Hij mat het springboard: de passregel, de mappen, de functierij, de klok
       ertussen en de balk van Rahul onderaan. Dat scherm is er niet meer
       (WERELD.md) -- wie inlogt landt op de werktafel van RTG Command, met de
       drie werelden bovenaan de bank.

       Wat blijft is dat de sessie ECHT is hersteld, en dat is nog steeds waar
       deze toets over gaat: de registry achter de bank is gevuld (dat is
       dezelfde MAPPEN als altijd), de werktafel staat open op een lege keuze,
       en de reisgegevens zijn opgehaald. */
    na: async (page) => {
      await page.waitForSelector('#rtgCommand', { state: 'visible', timeout: 15000 });
      await page.waitForFunction(() => {
        const nav = document.querySelector('#rtgCommand .cmd-nav');
        return !!nav && [...nav.querySelectorAll('button[data-url]')]
          .some((b) => /\/apps\/rtg\.html$/.test(b.dataset.url));
      }, null, { timeout: 20000 });

      const start = await page.evaluate(() => {
        const nav = document.querySelector('#rtgCommand .cmd-nav');
        const zicht = (s) => { const e = document.querySelector(s); if (!e) return null;
          const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        return {
          koppen: [...nav.querySelectorAll('.cmd-kop')].map((k) => k.textContent.trim()),
          werelden: [...nav.querySelectorAll('button[data-url]')].map((b) => b.dataset.url)
            .filter((u) => /^\/apps\/(rtg|kantoor|reizen|foundation)/.test(u)),
          leeg: (document.querySelector('#rtgCommand .cmd-leeg') || {}).textContent || '',
          springboard: zicht('.os-thuisscherm'),
          klok: !!document.getElementById('homeKlok')
        };
      });
      assert.deepEqual(start.koppen, ['Werelden', 'Software'],
        'de bank scheidt de werelden niet van de software: ' + start.koppen.join(', '));
      assert.deepEqual(start.werelden,
        ['/apps/rtg.html', '/apps/kantoor.html', '/apps/reizen.html', '/apps/foundation/os-publiek.html'],
        'de vier werelden staan niet in de bank');
      assert.match(start.leeg, /Kies een wereld/i,
        'de werktafel begint niet op een lege keuze: "' + start.leeg + '"');
      assert.equal(start.springboard, false, 'het springboard staat weer in beeld');
      assert.equal(start.klok, false, 'de klok is terug op het beginscherm');

      /* De passregel en de reiskaart worden nog steeds bij het opstarten gevuld
         -- ze staan alleen niet meer op een scherm. Dat ze gevuld ZIJN is het
         teken dat de sessie werkelijk is hersteld, en dat is wat hier telt. */
      await page.waitForFunction(() => {
        const e = document.getElementById('homeSub');
        return e && e.textContent.trim().length > 0;
      }, null, { timeout: 10000 });
      assert.match(await page.textContent('#homeSub'), /lid sinds|member since/i,
        'de passregel is niet gevuld; dan is de sessie niet echt hersteld');
      assert.ok((await page.textContent('#homeTrip .big')).trim().length > 0, 'de eerstvolgende reis staat er');
    }
  });
});

test('Leden-app: de ledenpas ligt in de wallet, niet meer op het beginscherm',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  /* DEZE TOETS WEES NAAR EEN PAGINA DIE VERHUISD IS.

     Hij opende /apps/wallet.html en zocht #ledenpas .ledenpas .cn. Dat pad is
     sinds PLATFORM.md par. 0 (acht apps, niet drieentachtig) een omleiding naar
     /apps/geld.html#wallet, en de opmaak heet daar #waPas .wa-pas. De toets
     stond dus rood om een verhuizing en niet om een gebrek: de pas werkt, hij
     woont ergens anders.

     De BELOFTE is niet veranderd, en die staat in de naam: de pas ligt in de
     wallet, en niet op het beginscherm. Vandaar dat deze toets nu drie dingen
     doet die hij daarvoor niet allemaal deed:

     1. hij loopt binnen via het OUDE pad, want daar kan een bladwijzer, een
        gedeelde link of een geinstalleerd PWA-icoon nog naar wijzen -- een dood
        pad is erger dan een omleiding, en dat is precies wat wallet.html zegt
        te zijn;
     2. hij kijkt of de pas op zijn nieuwe plek echt staat, met codenaam, welke
        pas het is, en een ECHTE QR (uit onze eigen codec, geen plaatje);
     3. hij kijkt eindelijk ook naar de tweede helft van zijn eigen naam: dat de
        pas NIET op het beginscherm staat. Dat werd nooit gemeten. */
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await api(base, '/api/auth/register', { name: 'Pas Lid', email: 'walletpas@x.nl', phone: '0612345701',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(reg.token, 'lid-registratie geeft een token');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
    await ctx.addInitScript(t => {
      localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    const page = await ctx.newPage();

    // 1. het oude pad blijft werken en komt uit bij de wallet-stand van RTG Geld
    await page.goto(base + '/apps/wallet.html', { waitUntil: 'load' });
    await page.waitForFunction(() => /\/apps\/geld\.html/.test(location.pathname + location.hash),
      null, { timeout: 15000 });
    assert.match(await page.evaluate(() => location.pathname + location.hash), /\/apps\/geld\.html#wallet$/,
      'het oude wallet-pad hoort door te sturen naar de wallet-stand van RTG Geld');

    // 2. de pas staat er, met codenaam, pasnaam en een echte QR
    await page.waitForSelector('#waPas .wa-pas .cn', { timeout: 15000 });
    assert.ok((await page.textContent('#waPas .wa-pas .cn')).trim().length > 0,
      'de codenaam staat op de pas in de wallet');
    assert.match(await page.textContent('#waPas .wa-pas'), /RTG Pass/,
      'de pas noemt welke pas het is');
    // de QR is echt: hij komt uit onze eigen codec, niet uit een plaatje
    assert.equal(await page.evaluate(() => document.querySelectorAll('#waPas .qr canvas').length), 1,
      'er staat een echte QR op de pas');

    /* 3. en niet op het beginscherm. Dit is de helft die nooit gemeten werd, en
          juist die kant kan stil terugkomen: een pas op de homescreen is een
          codenaam die je aan iedereen laat zien die over je schouder meekijkt. */
    const thuis = await ctx.newPage();
    await thuis.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    await thuis.waitForSelector('#osMappen .os-app, .os-wm', { timeout: 15000, state: 'attached' });
    await thuis.waitForTimeout(1200);
    const opThuis = await thuis.evaluate(() => ({
      pas: document.querySelectorAll('.wa-pas, #waPas, #ledenpas').length,
      codenaam: document.querySelectorAll('.wa-pas .cn, #ledenpas .cn').length
    }));
    assert.equal(opThuis.pas, 0, 'de ledenpas staat weer op het beginscherm');
    assert.equal(opThuis.codenaam, 0, 'de codenaam van de pas staat op het beginscherm');
    await thuis.close();
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('Leden-app: in het Engels is de startpagina echt Engels (i18n-dekking)',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await api(base, '/api/auth/register', { name: 'Lid EN', email: 'appen@x.nl', phone: '0612345799',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
    assert.ok(reg.token, 'lid-registratie geeft een token');
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_lang', 'en'); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, reg.token);
    await page.goto(base + '/apps/app.html?pas=business', { waitUntil: 'load' });
    await page.waitForSelector('#gate', { state: 'hidden', timeout: 15000 });
    /* De begroeting stond hier en is van het beginscherm af; de passregel
       eronder loopt langs dezelfde weg (T('app.membersince',...) uit het
       EN-woordenboek) en bewijst dus hetzelfde: de door JS gevulde tekst komt
       vertaald uit het woordenboek en niet in het Nederlands terug. */
    await page.waitForSelector('#homeSub', { timeout: 5000 });
    await page.waitForFunction(() => {
      const e = document.getElementById('homeSub');
      return e && e.textContent.trim().length > 0;
    }, null, { timeout: 5000 });
    const sub = await page.textContent('#homeSub');
    assert.match(sub, /member since/i, 'de passregel is in het Engels');
    assert.doesNotMatch(sub, /lid sinds/i, 'er staat geen Nederlands meer in de passregel');
    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('Leverancier-app: een betaalde bestelling komt bij Orders binnen en wordt doorgezet',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    // manager-token + een keukengerecht op de kaart
    const roster = await api(base, '/api/supplier/roster', { code: 'KIKUNOI' });
    const man = roster.staff.find(x => x.role === 'manager');
    const login = await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' });
    assert.ok(login.token, 'manager-login geeft een token');
    const authHead = tok => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok });
    await fetch(base + '/api/supplier/menu', { method: 'POST', headers: authHead(login.token),
      body: JSON.stringify({ menu: [{ id: 'ramen', name: 'Ramen', price: 12, station: 'keuken', cat: 'Warm' }] }) });

    // een lid bestelt aan tafel 3 en betaalt (dan pas ziet de zaak het)
    const reg = await api(base, '/api/auth/register', { name: 'Kassa Lid', email: 'kassa@x.nl', phone: '0612345001',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
    const ord = await (await fetch(base + '/api/order', { method: 'POST', headers: authHead(reg.token),
      body: JSON.stringify({ supplierCode: 'KIKUNOI', items: [{ id: 'ramen', qty: 1 }], table: 'Tafel 3' }) })).json();
    assert.ok(ord.order && ord.order.ref, 'de bestelling is aangemaakt');
    const betaald = await (await fetch(base + '/api/order/pay', { method: 'POST', headers: authHead(reg.token),
      body: JSON.stringify({ ref: ord.order.ref }) })).json();
    assert.ok(betaald.ok, 'de bestelling is betaald');
    const ref = ord.order.ref;

    // de leverancier opent de app en gaat via Meer naar Orders
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript(t => { localStorage.setItem('rtg_sup_token', t); localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, login.token);
    await page.goto(base + '/apps/leverancier.html', { waitUntil: 'load' });
    await page.waitForSelector('#app.active', { timeout: 15000 });
    // het Werk-OS: alle functies staan als apps op het springboard; de zaak
    // opent (na de sector-doorverwijzing) op het startscherm met dock
    // a11y: de actieve app meldt zich als actief aan de schermlezer
    await page.waitForSelector('.wos-dock button[data-tab="home"]', { state: 'visible', timeout: 10000 });
    assert.equal(await page.getAttribute('.wos-dock button[data-tab="home"]', 'aria-current'), 'page', 'de actieve dock-app heeft aria-current');
    // Orders opent als app vanaf het springboard
    await page.waitForSelector('.wos-grid .wos-app[aria-label="Orders"]', { state: 'visible', timeout: 10000 });
    await page.click('.wos-grid .wos-app[aria-label="Orders"]');

    // de betaalde bestelling staat op het scherm
    const kaart = page.locator('.order[data-ref="' + ref + '"]');
    await kaart.waitFor({ timeout: 10000 });
    assert.match(await kaart.textContent(), /Tafel 3|Ramen/, 'de tafel/het gerecht staat op de bon');

    // doorzetten naar 'in bereiding' (de keuken pakt hem op)
    await kaart.locator('.js-next').first().click();
    await page.waitForFunction(r => {
      const el = document.querySelector('.order[data-ref="' + r + '"]');
      return !!(el && /in bereiding/.test(el.textContent));
    }, ref, { timeout: 15000 });

    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('Leden-app: het conciergegesprek toont een bericht veilig (geen XSS)',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await api(base, '/api/auth/register', { name: 'Chat Lid', email: 'chat@x.nl', phone: '0612345002',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
    assert.ok(reg.token, 'lid-registratie geeft een token');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
    const fouten = [];
    letOpFouten(page, fouten);
    // Deze test gaat over XSS-veiligheid in het conciergegesprek, niet over
    // onboarding. Mock de onboarding-status op "klaar" zodat de verplichte
    // onboarding-modal (die anders de app blokkeert) niet verschijnt.
    await page.route('**/api/onboarding/status', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ klaar: true }) }));
    await page.addInitScript(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, reg.token);
    await page.goto(base + '/apps/app.html?pas=business', { waitUntil: 'load' });
    await page.waitForSelector('#gate', { state: 'hidden', timeout: 15000 });

    /* Naar het AI/concierge-scherm en een bericht met een XSS-payload sturen.

       DE WEG ERHEEN IS VERHUISD, DE MEETPLEK NIET. Hier stond een tik op Rahuls
       mond in de balk onderaan het springboard. Dat scherm is weg (WERELD.md);
       wat een lid nu heeft is het bedieningspaneel uit de voet van de bank, en
       daarin Zoeken -- dat is Spotlight, en die brengt je met "Laat Rahul dit
       doen" naar precies hetzelfde scherm. Wat er daarna gemeten wordt is
       ongewijzigd: #chat mag de payload nooit uitvoeren. */
    await bankDeur(page, 'Bedieningspaneel');
    await page.waitForSelector('#osCcScrim.open', { timeout: 10000 });
    await page.click('#osCcZoek');
    await page.waitForSelector('#osZoekScrim.open', { timeout: 10000 });
    await page.fill('#osZoekInput', 'iets vragen');
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('#osZoekLijst button')]
        .find((x) => /Laat Rahul dit doen/i.test(x.textContent));
      b.click();
    });
    await page.waitForSelector('#askInput', { state: 'visible', timeout: 10000 });
    const payload = '<img src=x onerror="window.__xss=1">';
    await page.fill('#askInput', payload);
    await page.click('#askBtn');
    await page.waitForSelector('#chat .bubble.user', { timeout: 10000 });
    await page.waitForTimeout(400); // geef een (eventuele) onerror de tijd om te vuren

    // de payload staat als TEKST in de bubbel, niet als uitgevoerd element
    assert.equal(await page.evaluate(() => document.querySelectorAll('#chat img').length), 0, 'de payload is niet als <img> uitgevoerd');
    assert.ok(!(await page.evaluate(() => window.__xss)), 'er is geen script uitgevoerd');
    assert.match(await page.textContent('#chat'), /onerror/, 'het bericht staat leesbaar als tekst');
    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('Leden-app: Rahul begint zelf op het beginscherm en antwoordt daar ook',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  /* De balk onderaan was een doorgeefluik naar zijn app; nu is het een gesprek
     dat op het beginscherm staat. Twee dingen die echt moeten kloppen: hij
     BEGINT uit zichzelf (anders is hij niet proactief, alleen aanwezig), en een
     antwoord komt daar terug zonder dat je van het beginscherm af gaat. En wat
     in de draad komt is TEKST -- ook als er html-achtigs in staat. */
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await api(base, '/api/auth/register', { name: 'Thuis Lid', email: 'thuis@x.nl', phone: '0612345004',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' });
    assert.ok(reg.token, 'lid-registratie geeft een token');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
    const fouten = [];
    letOpFouten(page, fouten);
    await page.route('**/api/onboarding/status', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ klaar: true }) }));
    await page.addInitScript(t => {
      localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/app.html', { waitUntil: 'load' });
    await page.waitForSelector('#gate', { state: 'hidden', timeout: 15000 });

    /* DE BELOFTE IS DEZELFDE, DE PLEK NIET.

       Deze toets mat de draad van Rahul onderaan het springboard: hij begon uit
       zichzelf, je stelde er een vraag, en het antwoord kwam daar terug zonder
       dat je het beginscherm verliet. Dat springboard is weg (WERELD.md), en
       daarmee ook zijn draad -- als SCHERM. De belofte niet: op de werktafel
       roep je hem uit de voet van de bank, en dan staat hij er.

       Dat die deur er staat is geen detail maar de reden dat deze toets
       herschreven is en niet geschrapt: gemeten in de browser was Rahul na het
       verdwijnen van het springboard NERGENS meer aanklikbaar -- zijn console in
       de werktafel wordt verborgen door shared/rahul-tab/style-base.js, de tab
       die daarvoor in de plaats komt vindt hier geen gastheer, en de
       handenvrij-balk hangt weg tot je hem roept. Precies het soort gat dat
       niemand ziet: er staat gewoon niets.

       Sinds hij in de SCHILBALK woont (shared/command/praat.js) is dat ook wat
       hier gemeten wordt: de balk die er al was verandert van taak, met zijn
       mond ernaast. De zwevende handenvrij-balk die hier eerst stond was een
       tweede meubel boven een balk die er al was.

       DE MUTATIE DIE HEM HOORT TE LATEN ZAKKEN: haal de Rahul-deur uit
       deuren() in shared/command.js, of haal `.cmd-balk.vraagt{display:flex}`
       uit het brede-scherm-blok in command.css -- dan doet de deur wel iets
       maar zie je er niets van. */
    await bankDeur(page, 'Rahul');
    await page.waitForSelector('#rtgCommand .cmd-balk.vraagt .cmd-vraagveld', { state: 'visible', timeout: 15000 });
    /* De lade van de bank glijdt in 280ms weg (command.css). Meten of de balk
       vrij ligt terwijl hij nog beweegt, meet de animatie en niet de stand. */
    await page.waitForFunction(() => !document.querySelector('#rtgCommand.bank-open'), null, { timeout: 5000 });
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => {
      const e = document.querySelector('#rtgCommand .cmd-balk'), r = e.getBoundingClientRect();
      const boven = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
      return !!(boven && boven.closest('.cmd-balk'));
    }), true, 'de vraagbalk van Rahul gaat open achter iets anders in plaats van erboven');
    assert.equal(await page.evaluate(() => !!document.querySelector('#rtgCommand .cmd-mondknop canvas')), true,
      'de mond van Rahul staat niet in de balk');

    // en we zijn de werktafel niet kwijt: hij roepen is geen navigatie
    assert.match(new URL(page.url()).pathname, /\/apps\/app\.html$/,
      'Rahul roepen bracht ons van de werktafel af');
    assert.equal(await page.evaluate(() => !!document.getElementById('rtgCommand')), true,
      'de werktafel is verdwenen toen Rahul openging');

    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens het gesprek');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('Verbinding: de offline-banner verschijnt bij verbindingsverlies en verdwijnt weer',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(base + '/apps/personeel.html', { waitUntil: 'load' });
    // offline -> de banner schuift in beeld met een melding
    await context.setOffline(true);
    await page.waitForFunction(() => {
      const b = document.getElementById('rtg-net-banner');
      return !!(b && /translateY\(0/.test(b.style.transform) && b.textContent.length > 0);
    }, undefined, { timeout: 8000 });
    // weer online -> de banner schuift weg
    await context.setOffline(false);
    await page.waitForFunction(() => {
      const b = document.getElementById('rtg-net-banner');
      return !!(b && /-100/.test(b.style.transform));
    }, undefined, { timeout: 8000 });
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('Backoffice: het RTG-kantoor komt beveiligd op met de eigen code',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  await bootTest({
    pad: '/apps/backoffice.html',
    tokens: async (base) => {
      const login = await api(base, '/api/office/login', { code: 'RTG-OFFICE' });
      assert.ok(login.token, 'kantoor-login geeft een token');
      return { rtg_office_token: login.token };
    }
  });
});

/* De klok is rond, en zijn vak hoort dat ook te zijn.

   DEZE TOETS IS MEEVERHUISD MET DE KLOK. Hij mat de klok op het beginscherm;
   dat beginscherm is de werktafel geworden en de klok is er af (WERELD.md).
   Het horloge staat nog op een plek -- de inlogpoort -- en de belofte die deze
   toets bewaakt is precies dezelfde gebleven, want het is dezelfde kast uit
   shared/klok.js. Weghalen zou de wachter kwijtmaken samen met het scherm.

   Waarom dit een toets verdient. De schaduw van de klok zit op een
   pseudo-element met border-radius:50% over het VAK van .rtg-ring. Zolang dat
   vak vierkant is, is die schaduw een cirkel om de kast. Werd het vak
   uitgerekt, dan werd de schaduw een ellips die ver boven en onder de
   wijzerplaat uitliep: het donkere ei dat maandenlang voor een verkeerd
   gekozen schaduwkleur werd aangezien, terwijl de kleur er niets mee te maken
   had. De wijzerplaat zelf verraadt het niet, want de SVG houdt zijn
   verhouding en blijft netjes rond.

   Zo raakte het vak uitgerekt: height:100% met aspect-ratio:1 rekent de
   breedte uit de hoogte, en als max-width die breedte daarna afknijpt, laat de
   browser de hoogte staan. Beide bovengrenzen moeten dus gelijk zijn. Deze
   toets meet het vak, niet de CSS-regel: hij zakt bij elke manier waarop het
   vak alsnog scheef wordt getrokken. */
test('Inlogpoort: het vak van de klok is vierkant, dus de schaduw is rond',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    // een smalle, hoge telefoon: juist daar knijpt max-width de breedte af
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    await ctx.addInitScript(() => {
      try { localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
    });
    const page = await ctx.newPage();
    // zonder token: dan staat de poort er, en daar hangt de klok
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('#gate .rtg-ring svg', { timeout: 15000 });
    const vak = await page.evaluate(() => {
      const k = document.querySelector('#gate .rtg-ring');
      const b = k.getBoundingClientRect();
      return { breed: Math.round(b.width), hoog: Math.round(b.height) };
    });
    assert.ok(vak.breed > 0 && vak.hoog > 0, 'de klok staat op het scherm');
    // een pixel speling voor afronding; het ei was 228 tegen 384
    assert.ok(Math.abs(vak.breed - vak.hoog) <= 1,
      'het vak van de klok is vierkant (gemeten ' + vak.breed + ' bij ' + vak.hoog + '), anders wordt de schaduw een ellips');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('Inlogpoort: de lippen van Rahul hangen onder de klok, niet erin',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  /* DIT IS TWEE KEER MISGEGAAN, EEN KEER NAAR ELKE KANT, en allebei de keren
     zag je het pas op een afdruk. Eerst zweefde de mond tientallen pixels onder
     de klok; daarna werd hij opgetrokken tot hij "aansloot", en toen begon de
     INKT op 0 tot -1 pixel van de onderrand van de wijzerplaat -- de lippen
     lagen tegen de gouden rand en middenin de contactschaduw van de kast.

     Een meting op de DOOS zou allebei die standen goedkeuren: het doek is 440
     bij 200 en de tekening begint pas op 27,9% van die hoogte, dus de doos zegt
     niets over waar de lippen liggen. Deze toets leest daarom de echte inkt uit
     het doek en rekent de afstand in KLOKKEN, niet in pixels -- want de klok
     schaalt mee met het scherm en een vaste pixelmaat zou op de ene telefoon
     kloppen en op de andere niet.

     DE MUTATIE: zet --lipgat in app-main-04a.js op 0. De lippen raken de klok
     weer, en deze toets zakt. */
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    // twee maten: de verhouding hoort op allebei dezelfde te zijn
    for (const maat of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      const ctx = await browser.newContext({ viewport: maat });
      await ctx.addInitScript(() => {
        try { localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
      });
      const page = await ctx.newPage();
      // zonder token: dan staat de poort er, en die is wat we meten
      await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#gate .ag-mond', { timeout: 15000 });
      await page.waitForTimeout(1200);

      const r = await page.evaluate(() => {
        const klok = document.querySelector('#gate .os-lock .rtg-ring');
        const cv = document.querySelector('#gate .ag-mond');
        if (!klok || !cv) return null;
        /* Het doek kan van WebGL zijn (shared/mond.js), en dan geeft
           getContext('2d') null. Overtekenen naar een eigen doek werkt altijd. */
        const kopie = document.createElement('canvas');
        kopie.width = cv.width; kopie.height = cv.height;
        const c = kopie.getContext('2d');
        c.drawImage(cv, 0, 0);
        const dt = c.getImageData(0, 0, kopie.width, kopie.height).data;
        let eerste = -1;
        for (let y = 0; y < kopie.height && eerste < 0; y++) {
          for (let x = 0; x < kopie.width; x++) {
            if (dt[(y * kopie.width + x) * 4 + 3] > 12) { eerste = y; break; }
          }
        }
        const kb = klok.getBoundingClientRect(), mb = cv.getBoundingClientRect();
        return {
          klokMaat: Math.round(kb.width),
          inktTop: eerste < 0 ? null : mb.top + mb.height * eerste / kopie.height,
          klokBodem: kb.bottom
        };
      });

      assert.ok(r && r.inktTop != null,
        'de lippen horen getekend te zijn op ' + maat.width + ' breed');
      const gat = (r.inktTop - r.klokBodem) / r.klokMaat;
      assert.ok(gat > 0.05,
        'de lippen raken de wijzerplaat op ' + maat.width + ' breed (afstand ' +
        gat.toFixed(3) + ' klok); ze horen eronder te hangen, niet erin');
      assert.ok(gat < 0.25,
        'de lippen zweven te ver onder de klok op ' + maat.width + ' breed (afstand ' +
        gat.toFixed(3) + ' klok); Rahul komt uit de klok, hij hangt er niet los onder');
      await ctx.close();
    }
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* Het beginscherm mag niet verdwijnen doordat de app je plek onthoudt.

   Deze twee horen bij elkaar en daarom in een toets. "Terug waar je was" is
   bedoeld voor de app die ONDER je vandaan wordt gedood -- iOS ruimt een app in
   de achtergrond op, of je herlaadt per ongeluk -- en dat gebeurt binnen
   seconden. Het venster stond op een half uur, en omdat elke schermwissel de
   tijd bijschrijft schoof dat venster steeds mee: in gewoon gebruik landde je
   dus vrijwel altijd weer in de app waar je was, en kreeg je het beginscherm
   met de tegels en de klok nooit meer te zien. Dat is precies wat er gemeld
   werd ("ik zie geen iOS meer").

   De toets meet allebei de kanten, want een reparatie die alleen de ene kant
   vastlegt kan de andere stilletjes weer stukmaken. */
test('Leden-app: een verse start begint thuis, een onderbreking van seconden niet',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await api(base, '/api/auth/register', { name: 'Plek Lid', email: 'plek@x.nl', phone: '0612345703',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(reg.token, 'lid-registratie geeft een token');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const actieveView = async (page) => page.evaluate(() => {
      const v = document.querySelector('.view.active');
      return v ? v.getAttribute('data-view') : null;
    });

    // 1. een onderbreking van seconden: je plek hoort terug te komen
    const ctxKort = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctxKort.addInitScript(([t]) => {
      localStorage.setItem('rtg_member_token', t);
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_actieve_tab', JSON.stringify({ tab: 'salon', t: Date.now() - 20000 }));
    }, [reg.token]);
    const pKort = await ctxKort.newPage();
    await pKort.goto(base + '/apps/app.html?pas=rtg', { waitUntil: 'load' });
    await pKort.waitForSelector('.view.active', { timeout: 15000 });
    assert.equal(await actieveView(pKort), 'salon',
      'na een onderbreking van seconden staat u weer waar u was');

    // 2. een verse start later op de dag: het beginscherm
    const ctxVers = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctxVers.addInitScript(([t]) => {
      localStorage.setItem('rtg_member_token', t);
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_actieve_tab', JSON.stringify({ tab: 'salon', t: Date.now() - 5 * 60000 }));
    }, [reg.token]);
    const pVers = await ctxVers.newPage();
    await pVers.goto(base + '/apps/app.html?pas=rtg', { waitUntil: 'load' });
    await pVers.waitForSelector('.view.active', { timeout: 15000 });
    assert.equal(await actieveView(pVers), 'home',
      'een verse start toont het beginscherm, niet de app waar u het laatst was');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
