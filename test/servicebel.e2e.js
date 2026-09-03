/* BELLEN MET RTG -- de twee schermen.

   De routes waren al beproefd; deze toetsen gaan over wat een mens ziet en kan.
   Wat ze vastleggen:

   1. EEN RTG-LID KRIJGT DE BELKNOP NIET, MAAR WEL DE WEG NAAR EEN MENS. Bellen
      is een pas-dienst; hulp is dat niet. Als die twee op het scherm door elkaar
      gaan lopen, verkopen we toegang tot hulp.
   2. Het belscherm zegt wat er GEBEURT en belooft geen wachttijd.
   3. Er is een MEELEESBAAN. Een live gesprek zonder weg naar tekst sluit een
      dove deelnemer uit, en bij een hulplijn weegt dat het zwaarst: wie niet kan
      bellen, houdt anders geen kanaal over waar de rest er wel een bij kreeg.
   4. De medewerker ziet de oproep rinkelen en kan hem aannemen.

   Draait alleen waar Playwright met een passende browser staat; anders
   overgeslagen. Draai: npm run e2e */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { laadScherm, startServer, stop, browserOpties, geenBrowser, nepMediaArgs,
  installeerNepMicrofoon, kantoorAlsPersoon, elevateTier } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadScherm();

async function api(base, pad, body, tok) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {}) });
  return r.json();
}

async function metLid(pas, fn) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bel-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'RTG-OFFICE' } });
  let browser;
  try {
    const mail = 'belscherm' + pas + '@x.nl';
    const reg = await api(base, '/api/auth/register', { name: 'Bel Lid', email: mail, phone: '061234571' + pas.length,
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    let token = reg.token;
    if (pas !== 'rtg') {
      await elevateTier(base, token, pas);
      const her = await api(base, '/api/auth/login', { login: mail, password: 'geheim123', pasApp: pas });
      token = her.token || token;
    }
    const balie = await kantoorAlsPersoon(base);
    /* Nepmedia: de browser levert een camera en microfoon die er niet zijn, en
       vraagt er ook niet om. Zonder deze vlaggen blijft elke beltoets hangen op
       een toestemmingsvenster dat niemand kan wegklikken. */
    /* browserOpties() verwacht een OBJECT met `args`, geen kale array. Hier
       stond `browserOpties(pw, nepMediaArgs())`, en dan verdwijnen de vlaggen
       geruisloos: de toets zag daarna "wij kunnen uw microfoon niet gebruiken"
       en dat leek een fout in het scherm terwijl het de opstelling was. */
    browser = await pw.chromium.launch(browserOpties(pw, { args: nepMediaArgs() }));
    const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 },
      permissions: ['microphone', 'camera'] });
    /* Een ECHTE live audiotrack uit Web Audio, want een RTCPeerConnection heeft
       aan een kaal testobject niets. */
    await installeerNepMicrofoon(ctx);
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
    }, token);
    const page = await ctx.newPage();
    await fn(page, base, token, balie, ctx);
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
}

test('een RTG-lid ziet geen belknop, maar wel de weg naar een mens', { skip: geenBrowser(pw) }, async () => {
  await metLid('rtg', async (page, base) => {
    await page.goto(base + '/apps/service-bel.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !/Bezig met laden/.test(document.body.textContent), null, { timeout: 20000 });
    const tekst = await page.textContent('#main');
    assert.match(tekst, /Lifestyle|Business/, 'de weigering zegt niet waar bellen bij hoort');
    /* DE KERN. Zonder deze zin leest "u mag niet bellen" als "u krijgt geen
       hulp", en dan is een mens stilletjes een pas-dienst geworden. */
    assert.match(tekst, /mens/i, 'het scherm noemt de weg naar een mens niet');
    assert.equal(await page.locator('#bAudio').count(), 0, 'er staat toch een belknop');
  });
});

test('een Lifestyle-lid belt, en het scherm belooft geen wachttijd', { skip: geenBrowser(pw) }, async () => {
  await metLid('lifestyle', async (page, base, token) => {
    await page.goto(base + '/apps/service-bel.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#bAudio', { timeout: 20000 });
    await page.click('#bAudio');
    await page.waitForSelector('#bStop', { timeout: 20000 });

    const tekst = await page.textContent('#main');
    assert.match(tekst, /rinkelt/i, 'het scherm zegt niet wat er gebeurt');
    assert.doesNotMatch(tekst, /wachttijd|nummer \d|binnen \d+ minu/i,
      'er wordt een wachttijd beloofd die niemand meet: ' + tekst);
    /* De melder hoort waar zijn verhaal blijft, ook als er niet wordt opgenomen. */
    assert.match(tekst, /SUP-/, 'het scherm noemt de zaak niet waar de melding blijft staan');

    /* DE MEELEESBAAN. Bij een hulplijn is dit geen extraatje: wie niet kan
       bellen houdt anders geen kanaal over waar de rest er wel een bij kreeg. */
    assert.equal(await page.locator('[data-meelees]').count(), 1,
      'er is geen weg naar tekst in dit gesprek');

    const mijn = await api(base, '/api/service/bel/mijn', {}, token);
    assert.equal(mijn.gesprekken.length, 1);
    assert.equal(mijn.gesprekken[0].status, 'rinkelt');
  });
});

test('de cockpit ziet de oproep rinkelen en neemt op', { skip: geenBrowser(pw) }, async () => {
  await metLid('business', async (page, base, token, balie, ctx) => {
    const g = (await api(base, '/api/service/bel', {}, token)).gesprek;

    const kantoor = await ctx.newPage();
    await kantoor.addInitScript((t) => { try { localStorage.setItem('rtg_office_token', t); } catch (e) {} }, balie);
    await kantoor.goto(base + '/apps/service.html', { waitUntil: 'domcontentloaded' });
    await kantoor.waitForSelector('#tBel', { timeout: 20000 });
    await kantoor.click('#tBel');
    await kantoor.waitForSelector('[data-neem]', { timeout: 20000 });

    const rij = await kantoor.textContent('#main');
    assert.match(rij, new RegExp(g.id), 'de oproep staat niet in de belrij');
    /* Het bord legt uit waarom een RTG-lid hier niet tussen staat -- anders
       leest een medewerker de afwezigheid als een storing. */
    assert.match(rij, /ondergrens|wacht op een mens/i,
      'het bord legt niet uit dat een RTG-lid via de wachtrij komt en niet via de lijn');

    await kantoor.click('[data-neem]');
    await kantoor.waitForSelector('#bStop', { timeout: 20000 });
    assert.equal(await kantoor.locator('[data-meelees]').count(), 1,
      'de medewerker heeft geen weg naar tekst');

    const na = await api(base, '/api/office/service/gesprekken', {}, balie);
    assert.equal(na.gesprekken[0].status, 'bezig', 'de oproep staat niet op bezig');
    assert.ok(na.gesprekken[0].mens, 'er staat geen naam onder het aangenomen gesprek');
  });
});
