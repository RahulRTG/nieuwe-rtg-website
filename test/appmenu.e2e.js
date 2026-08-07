/* Het app-menu (public/shared/appmenu.js) en de belofte dat Rahul ÉÉN balk heeft.

   TWEE BELOFTES, EN ALLEBEI ZIJN ZE HIER AL EEN KEER GEBROKEN.

   1. ÉÉN BALK VAN RAHUL PER SCHERM. shared/metgezel.js hangt zijn chatbalk op
      elke app-pagina, behalve waar het scherm er zelf al een heeft -- en dat is
      de homescreen (#osAiBalk). Die uitzondering werd getoetst met
      `/\/apps\/app\.html$/.test(location.pathname)`, en dat is precies één
      regel te letterlijk: server/middleware/voordeur.js serveert de homescreen
      OOK op /, /apps/ en /apps/index.html, zonder omleiding. Op drie van de
      vier ingangen -- waaronder de kale domeinnaam, de meest bezochte van
      allemaal -- stonden er dus twee invoervelden voor hetzelfde gesprek, recht
      onder elkaar. Vandaar dat deze toets alle vier de paden afgaat en niet
      alleen het bestandspad.

      De mutatie die hem hoort te laten zakken: zet in shared/metgezel.js de
      padtoets terug als enige voorwaarde voor `eigenRahul`.

   2. ELKE APP HEEFT EEN MENU. De hamburger rechtsboven komt van
      shared/appmenu.js, en die wordt door shared/ios.js binnengehaald -- één
      plek voor elke app-pagina. Dat is de kracht en de zwakte tegelijk: valt die
      koppeling weg, of vergeet een nieuwe pagina shared/ios.js (dat was bij
      dispatch.html en zakelijk.html precies wat er aan de hand was), dan is er
      geen foutmelding en geen rood -- alleen een app zonder weg terug naar
      huis. Deze toets loopt daarom ALLE app-pagina's af.

      De mutatie: haal het blok dat appmenu.js bijlaadt uit shared/ios.js.

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');

function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  return null;
}
const pw = laadPlaywright();

function appPaden(dir = path.join(PUB, 'apps'), uit = []) {
  for (const naam of fs.readdirSync(dir)) {
    const p = path.join(dir, naam);
    if (fs.statSync(p).isDirectory()) appPaden(p, uit);
    else if (naam.endsWith('.html')) uit.push('/' + path.relative(PUB, p).split(path.sep).join('/'));
  }
  return uit.sort();
}

async function api(base, pad, body) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return r.json();
}

/* Een echt lid, want zonder inlog bouwt metgezel.js niets en heeft de toets
   niets te meten. */
async function lidToken(base, email) {
  const reg = await api(base, '/api/auth/register', { name: 'Menu Lid', email, phone: '0612345799',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.token, 'lid-registratie geeft een token');
  return reg.token;
}

async function metLid(fn) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-menu-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const tok = await lidToken(base, 'appmenu' + process.pid + '@x.nl');
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('rtg_member_token', t);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    }, tok);
    await fn({ base, ctx });
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
}

test('Rahul heeft één balk, op elk pad waarop de homescreen te bereiken is',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  await metLid(async ({ base, ctx }) => {
    /* Alle vier de ingangen van de homescreen (zie voordeur.js) plus een paar
       gewone app-pagina's, want daar hoort de balk van metgezel.js juist WEL te
       staan -- eentje. */
    const thuisPaden = ['/', '/apps/', '/apps/index.html', '/apps/bureau.html', '/apps/app.html'];
    const appPagina = ['/apps/muziek.html', '/apps/wallet.html', '/apps/berichten.html'];
    const fouten = [];

    for (const pad of thuisPaden.concat(appPagina)) {
      const page = await ctx.newPage();
      try {
        await page.goto(base + pad, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1200);
        const r = await page.evaluate(() => ({
          eigen: document.querySelectorAll('.os-aibalk').length,
          metgezel: document.querySelectorAll('.mgz-balk').length
        }));
        const totaal = r.eigen + r.metgezel;
        if (totaal > 1) {
          fouten.push(pad + ': ' + totaal + ' balken (eigen ' + r.eigen + ', metgezel ' + r.metgezel + ')');
        }
        // en op de homescreen hoort de EIGEN balk het te zijn, niet die van de laag
        if (thuisPaden.includes(pad) && r.metgezel > 0) {
          fouten.push(pad + ': de homescreen kreeg de balk van metgezel.js erbij');
        }
      } finally { await page.close(); }
    }
    assert.deepEqual(fouten, [], 'dubbele balk van Rahul:\n' + fouten.join('\n'));
  });
});

test('elke app-pagina draagt de hamburger van het app-menu',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  await metLid(async ({ base, ctx }) => {
    const fouten = [];
    let gemeten = 0;

    for (const pad of appPaden()) {
      const page = await ctx.newPage();
      try {
        await page.goto(base + pad, { waitUntil: 'domcontentloaded', timeout: 20000 });
        /* Wegnavigeerd (een inlogdeur) of bewust zonder OS-chrome? Niet meten.
           De uitleesactie zelf moet ook een navigatie overleven: een pagina die
           tijdens het lezen naar het inlogscherm springt breekt de context af,
           en dat is geen meetresultaat maar een pagina die er niet meer is. */
        await page.waitForTimeout(200);
        let meedoen;
        try {
          meedoen = await page.evaluate(() => !document.body.hasAttribute('data-ios-uit'));
        } catch (e) { continue; }
        if (!meedoen) continue;
        if (new URL(page.url()).pathname !== pad) continue;
        try {
          await page.waitForSelector('#osMenuBtn', { timeout: 8000 });
          gemeten++;
        } catch (e) {
          if (new URL(page.url()).pathname === pad) fouten.push(pad);
        }
      } finally { await page.close(); }
    }

    assert.ok(gemeten > 100, 'te weinig pagina\'s gemeten (' + gemeten + '): dan bewijst een groene uitslag niets');
    assert.deepEqual(fouten, [], 'deze app-pagina\'s hebben geen app-menu:\n' + fouten.join('\n'));
  });
});

test('het menu opent en brengt je terug naar het beginscherm',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  await metLid(async ({ base, ctx }) => {
    const page = await ctx.newPage();
    await page.goto(base + '/apps/wallet.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#osMenuBtn', { timeout: 10000 });
    await page.click('#osMenuBtn');
    await page.waitForSelector('.amn-scrim.amn-open', { timeout: 5000 });

    const inhoud = await page.evaluate(() => ({
      tegels: [...document.querySelectorAll('.amn-tegel')].map((b) => b.textContent.trim()),
      rijen: [...document.querySelectorAll('.amn-rij')].map((b) => b.textContent.trim())
    }));
    /* "Deze app": gelezen uit het scherm zelf, niet met de hand opgeschreven.
       De wallet draagt zijn eigen schakelrij (Passen, Tickets, Sleutels...), en
       die hoort dus in het menu te staan. Staat er niets, dan is de hele
       vondstlaag stilgevallen -- precies het soort storing dat je niet ziet. */
    assert.ok(inhoud.tegels.length > 0, 'het menu vond geen enkele functie van de app zelf');
    assert.ok(inhoud.rijen.some((t) => /Beginscherm/i.test(t)), 'geen weg naar het beginscherm');
    assert.ok(inhoud.rijen.some((t) => /Instellingen/i.test(t)), 'geen ingang naar de instellingen');

    // Escape sluit, en dan brengt de rij "Beginscherm" je ook echt thuis
    await page.keyboard.press('Escape');
    await page.waitForSelector('.amn-scrim.amn-open', { state: 'detached', timeout: 3000 }).catch(() => {});
    assert.equal(await page.evaluate(() => !!document.querySelector('.amn-scrim.amn-open')), false,
      'Escape sluit het menu niet');

    await page.click('#osMenuBtn');
    await page.waitForSelector('.amn-scrim.amn-open', { timeout: 5000 });
    await page.evaluate(() => {
      const rij = [...document.querySelectorAll('.amn-rij')].find((b) => /Beginscherm/i.test(b.textContent));
      rij.click();
    });
    await page.waitForURL(/\/apps\/app\.html/, { timeout: 8000 });
    assert.match(new URL(page.url()).pathname, /\/apps\/app\.html$/, 'het menu brengt je niet thuis');
    await page.close();
  });
});

test('op de homescreen zitten de losse statusknopjes in het menu, niet in de balk',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  await metLid(async ({ base, ctx }) => {
    const page = await ctx.newPage();
    await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#osMenuBtn', { timeout: 10000 });
    /* Een vers geregistreerd lid staat nog in de intake, en die legt een blad
       over het hele scherm. Wat we hier meten ligt eronder: de statusbalk van
       de homescreen. Het blad gaat dus opzij -- de intake zelf heeft een eigen
       toets en hoort niet in deze. */
    await page.evaluate(() => { const g = document.getElementById('onbGate'); if (g) g.hidden = true; });
    await page.waitForTimeout(200);

    /* De knoppen mogen NIET uit de HTML verdwijnen: het menu, het
       bedieningspaneel en de rest van de app klikken ze aan. Ze horen alleen
       niet meer in beeld te staan. */
    const balk = await page.evaluate(() => {
      const zichtbaar = (id) => {
        const e = document.getElementById(id);
        return e ? !!e.offsetParent : null;   // null = bestaat niet meer
      };
      return { bel: zichtbaar('bell'), paneel: zichtbaar('osCcBtn'), accu: zichtbaar('osBat'),
        knoppenInBalk: [...document.querySelectorAll('.topbar .os-rechts button')]
          .filter((b) => b.offsetParent).map((b) => b.id) };
    });
    assert.equal(balk.bel, false, 'de bel staat nog in de statusbalk');
    assert.equal(balk.paneel, false, 'het bedieningspaneel staat nog als knop in de statusbalk');
    assert.equal(balk.accu, false, 'de batterij staat nog in de statusbalk');
    assert.deepEqual(balk.knoppenInBalk, ['osMenuBtn'],
      'er staat meer dan alleen de hamburger rechts in de statusbalk: ' + balk.knoppenInBalk.join(', '));

    await page.click('#osMenuBtn');
    await page.waitForSelector('.amn-scrim.amn-open', { timeout: 5000 });
    const rijen = await page.evaluate(() =>
      [...document.querySelectorAll('.amn-rij')].map((b) => b.textContent.trim()));
    for (const woord of ['Meldingen', 'Instellingen', 'Zoeken', 'Scannen']) {
      assert.ok(rijen.some((t) => new RegExp(woord, 'i').test(t)), woord + ' ontbreekt in het menu');
    }

    // en de bel doet het nog: het menu klikt de verborgen knop aan
    await page.evaluate(() => {
      const rij = [...document.querySelectorAll('.amn-rij')].find((b) => /Meldingen/i.test(b.textContent));
      rij.click();
    });
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => {
      const p = document.getElementById('notifPanel');
      return !!(p && p.classList.contains('open'));
    }), true, 'de rij Meldingen opent het meldingenpaneel niet');
    await page.close();
  });
});
