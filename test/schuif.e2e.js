/* GEEN SCHERM SCHUIFT ZIJWAARTS.

   Waarom deze toets bestaat. Een pagina die breder is dan het scherm valt niet
   om en geeft geen foutmelding: hij schuift. Je merkt het pas als je hem op een
   telefoon vasthoudt, en dan nog denk je dat je zelf veegt. Op 19 augustus 2026
   deed de RTFoundation dat op vier schermen tegelijk -- de hub was 736px breed
   op een toestel van 390, vrienden.html 809 -- en geen enkele van de duizend
   toetsen in deze map merkte er iets van.

   Twee oorzaken zaten eronder, en allebei zijn ze het soort dat terugkomt:

   1. een grid-track van `1fr` krimpt NIET onder de min-content van zijn item,
      dus een lang label in kapitalen zette de ondergrens van de hele kolom;
   2. een grid-kolom van `auto` (de acties rechts in de iOS-balk) krimpt ook
      niet, dus een scherm met zeven knoppen rechtsboven maakte niet de balk te
      vol maar de PAGINA te breed.

   Beide zijn gerepareerd waar ze ontstonden. Deze toets is er zodat de derde
   variant -- en die komt -- niet weer maanden onopgemerkt blijft.

   WAT HIJ MEET. Niet of het er mooi uitziet: alleen of de documentbreedte de
   vensterbreedte overschrijdt. Dat is waar of onwaar. Bij een overschrijding
   noemt hij het BOVENSTE element dat buiten valt en waarvan de ouder dat niet
   doet -- dat is de veroorzaker, niet het slachtoffer, en dat scheelt de
   volgende lezer een halve avond.

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-schuif-')); }
function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadPlaywright();

/* De smalste stand die we serieus nemen. 390 is een iPhone 14/15; alles
   daaronder is zeldzaam genoeg om niet als poort te dienen, alles erboven is
   makkelijker. Wie hier doorheen komt, komt overal doorheen. */
const TELEFOON = { width: 390, height: 844 };

/* Alle schermen van de RTFoundation, uit de map zelf. Met opzet niet een
   handmatige lijst: een scherm dat er morgen bij komt hoort er vanzelf in te
   vallen, anders bewaakt deze toets over een half jaar de helft. */
function foundationSchermen() {
  const map = path.join(__dirname, '..', 'public', 'apps', 'foundation');
  return fs.readdirSync(map).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, '')).sort();
}

test('geen enkel Foundation-scherm schuift zijwaarts op een telefoon', { skip: !pw && 'Playwright niet beschikbaar' }, async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    /* Een echt gezin, zodat de schermen achter de gezinsdeur ook echt opengaan.
       Zonder sessie toont driekwart van de map dezelfde deur, en dan meet deze
       toets vooral die deur. */
    const gemaakt = await (await fetch(base + '/api/foundation/gezin/maak', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gezinsnaam: 'Schuiftest', naam: 'Meter', pin: '1234', geboortedatum: '1985-04-12' }),
    })).json();
    assert.ok(gemaakt && gemaakt.token, 'het testgezin hoort aangemaakt te zijn');

    /* RTG_CHROMIUM is de conventie van dit huis (server/lib/browser.js noemt
       hem in zijn foutmelding): waar de gebundelde browser van Playwright niet
       bij de binary past, wijst die variabele de goede aan. Niet gezet? Dan het
       normale pad, zoals de andere e2e-toetsen. */
    browser = await pw.chromium.launch(Object.assign({ args: ['--no-sandbox'] },
      process.env.RTG_CHROMIUM ? { executablePath: process.env.RTG_CHROMIUM } : {}));
    const ctx = await browser.newContext({ viewport: TELEFOON, isMobile: true, hasTouch: true });
    await ctx.addInitScript((s) => {
      localStorage.setItem('rtf_sessie', JSON.stringify(s));
      localStorage.setItem('rtf_app_groep', 'volw');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, { code: gemaakt.code, token: gemaakt.token, gezin: gemaakt.gezin, profiel: gemaakt.profiel });

    const stuk = [];
    for (const naam of foundationSchermen()) {
      const page = await ctx.newPage();
      try {
        await page.goto(base + '/apps/foundation/' + naam + '.html', { waitUntil: 'networkidle', timeout: 25000 });
        await page.waitForTimeout(500);
        const uitslag = await page.evaluate(() => {
          const cw = document.documentElement.clientWidth;
          const sw = document.documentElement.scrollWidth;
          if (sw <= cw + 1) return null;
          /* De bovenste overtreder: zelf buiten beeld, ouder niet. */
          let schuldige = null;
          document.querySelectorAll('body *').forEach((el) => {
            if (schuldige) return;
            const b = el.getBoundingClientRect();
            if (b.width <= 0 || b.right <= cw + 0.5) return;
            const p = el.parentElement;
            if (p && p.getBoundingClientRect().right > cw + 0.5) return;
            schuldige = el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/).join('.') : '');
          });
          return { sw, cw, schuldige };
        });
        if (uitslag) stuk.push(naam + '.html is ' + uitslag.sw + 'px breed in een venster van ' +
          uitslag.cw + ' -- veroorzaker: ' + (uitslag.schuldige || 'onbekend'));
      } finally { await page.close(); }
    }

    assert.deepEqual(stuk, [], 'deze schermen schuiven zijwaarts op ' + TELEFOON.width + 'px:\n  ' + stuk.join('\n  '));
  } finally {
    if (browser) await browser.close();
    await stop(child);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
