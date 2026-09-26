/* SOCIAAL IN DE EDGE: EEN DECLARATIE, EN ELK SCHERM ZEGT ZELF WAAR JE BENT.

   De technische laag van de sociale schermen (het commandodeck van
   shared/social-intelligence-runtime.js) stond tot ronde 2 van EDGE.md in het
   TWEEDE register: de runtime pollde tot RTGAdaptiveEdge er was en riep dan
   registerAction en setProjection aan. Dat had drie gevolgen die alleen een
   echte browser laat zien, en die staan hier:

   1. een TIK op 'Sociale context bekijken' in het Edge-blad gaat nu precies een
      keer langs RTGGewicht.voer, als licht -- en het scherm publiceerde zelf de
      context waarin die handeling staat (bron, titel en de id in acties);
   2. een VERHINDERING in de context komt met haar reden in voorNu() terecht.
      Dat kan alleen als de grammatica vóór het register laadt: register.js
      leest RTGGrammatica een keer, bij het laden, en zonder hem valt de
      verhindering stil weg;
   3. de HERSTARTPROEF: na destroy()/start() van de Edge staat de handeling er
      nog. Het tweede register leefde in het model van de Edge, dus een herstart
      gooide hem weg;
   4. op comm.html opent precies EEN knop in het blad het deck. De voormeting
      (23 september 2026, Actiesdeck, telefoon) vond er twee: de handeling uit
      het register en de overgenomen knop OPEN COMMAND uit de strook. De
      actiesleutel op die knop ontdubbelt ze.

   DE MUTATIES, elk nagetrokken: haal data-rtg-action-key van .rtg-intel-command
   (4 zakt: twee knoppen), draai in sociaal.html de laadvolgorde van grammatica
   en register om (2 zakt: geen verhindering), en zet registerAction terug in
   de runtime in plaats van declareer (1 en 3 zakken: de handeling komt niet
   uit RTGAdaptief).

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

async function lid(base) {
  const u = Date.now().toString(36);
  const r = await fetch(base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Sociaal Proef', email: 'sociaaledge' + u + '@voorbeeld.test',
      password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
  }).then((x) => x.json());
  assert.ok(r.token, 'registratie hoort een token te geven');
  const status = await fetch(base + '/api/onboarding/status', { method: 'POST',
    headers: { Authorization: 'Bearer ' + r.token } }).then((x) => x.json());
  const t = await fetch(base + '/api/onboarding/teken', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + r.token },
    body: JSON.stringify({ naam: 'Sociaal Proef', akkoord: true, contractVersion: status.contract.versie }) });
  assert.equal(t.status, 200, 'de proefgebruiker hoort de overeenkomst te kunnen tekenen');
  return r.token;
}

test('sociaal: de handeling komt uit RTGAdaptief, weegt langs RTGGewicht, overleeft een herstart en staat op comm een keer',
  { skip: geenBrowser(pw) }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sociaaledge-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir } });
  const browser = await pw.chromium.launch(browserOpties(pw));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', locale: 'nl-NL' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  const klaar = () => page.waitForFunction(() => window.RTGAdaptief && window.RTGAdaptiveEdge && window.RTGGewicht &&
    window.RTGEdgeBlikveld && document.body.getAttribute('data-rtg-adaptive-ready') === 'true', null, { timeout: 20000 });
  const blad = () => page.evaluate(() => { RTGAdaptiveEdge.setDeck('actions'); RTGAdaptiveEdge.setState('expanded'); });
  try {
    const token = await lid(srv.base);
    await page.addInitScript((t) => {
      localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, token);

    // 1) Het scherm publiceert zelf, en een tik gaat langs de gewichtlaag.
    await page.goto(srv.base + '/apps/sociaal.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await klaar();
    const c = await page.evaluate(() => RTGAdaptief.context());
    assert.ok(c.bron, 'het scherm zegt wie het is');
    assert.ok(c.titel, 'het scherm zegt hoe het heet');
    assert.deepEqual(c.acties, ['sociaal.context'], 'de context noemt de gedeclareerde handeling');
    const cap = await page.evaluate(() => {
      const x = RTGAdaptief.capability('sociaal.context');
      return x && { naam: x.naam, gewicht: x.gewicht, effect: x.effect, herstel: x.herstel || null, vormen: x.vormen };
    });
    assert.deepEqual(cap, { naam: 'Sociale context bekijken', gewicht: 'licht', effect: 'lokaal', herstel: null,
      vormen: { telefoon: ['paneel'], tablet: ['paneel'], bureau: ['paneel'], stem: [] } },
      'een declaratie, en er wordt geen herstel verzonnen');
    assert.equal(await page.evaluate(() => RTGEdgeBlikveld.lees().velden.context.herkomst), 'scherm',
      'op een los scherm is de context van het scherm zelf');
    await page.evaluate(() => {
      window.gewogen = [];
      const echt = RTGGewicht.voer;
      RTGGewicht.voer = function (it) { window.gewogen.push([it.id, it.gewicht]); return echt.apply(this, arguments); };
    });
    await blad();
    await page.locator('.rtg-adaptive-controls [data-cap="sociaal.context"]').click();
    await page.waitForFunction(() => document.body.classList.contains('rtg-intel-open'), null, { timeout: 10000 });
    assert.deepEqual(await page.evaluate(() => window.gewogen), [['sociaal.context', 'licht']],
      'een tik gaat precies een keer langs RTGGewicht.voer, als licht');
    await page.keyboard.press('Escape');

    // 2) Een verhindering in de context komt met haar reden door.
    const verhinderd = await page.evaluate(() => {
      const c0 = RTGAdaptief.context();
      RTGAdaptief.context({ bron: c0.bron, titel: c0.titel, acties: c0.acties,
        staat: { 'sociaal.context': { verhinderd: { reden: 'Proef: het deck is hier dicht.', bron: 'toestand' } } } });
      const it = RTGAdaptief.voorNu().find((x) => x.id === 'sociaal.context');
      RTGAdaptief.context({ bron: c0.bron, titel: c0.titel, acties: c0.acties });
      return it && it.verhinderd ? it.verhinderd.reden : null;
    });
    assert.equal(verhinderd, 'Proef: het deck is hier dicht.',
      'de grammatica laadt voor het register, anders valt de verhindering stil weg');

    // 3) De herstartproef.
    await page.evaluate(() => { RTGAdaptiveEdge.destroy(); RTGAdaptiveEdge.start(document, window); });
    await page.waitForFunction(() => document.body.getAttribute('data-rtg-adaptive-ready') === 'true', null, { timeout: 10000 });
    await blad();
    await page.waitForSelector('.rtg-adaptive-controls [data-cap="sociaal.context"]', { timeout: 10000 });

    // 4) Op comm.html opent precies een knop in het blad het deck.
    await page.goto(srv.base + '/apps/comm.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await klaar();
    await page.waitForSelector('.rtg-intel-command', { state: 'attached', timeout: 20000 });
    /* Een knop in het blad kan een link volgen; die houden we hier tegen, want
       de vraag is alleen welke knoppen het deck openen. */
    await page.evaluate(() => document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (a) e.preventDefault();
    }, true));
    await blad();
    const aantal = await page.evaluate(() => document.querySelectorAll('.rtg-adaptive-sheet button').length);
    assert.ok(aantal > 3, 'het blad hoort knoppen te tonen');
    let openen = [];
    for (let i = 0; i < aantal; i++) {
      await blad();
      const r = await page.evaluate((n) => new Promise((klaar) => {
        const k = [...document.querySelectorAll('.rtg-adaptive-sheet button')][n];
        if (!k || !(k.offsetWidth || k.offsetHeight)) { klaar(null); return; }
        const naam = (k.textContent || '').trim();
        let open = false;
        const hoor = () => { open = true; };
        document.addEventListener('rtg:intel-open', hoor);
        k.click();
        setTimeout(() => {
          document.removeEventListener('rtg:intel-open', hoor);
          const scrim = document.querySelector('.rtg-intel-scrim');
          if (scrim && !scrim.hidden) scrim.click();
          klaar(open ? naam : null);
        }, 300);
      }), i);
      if (r) openen.push(r);
    }
    assert.equal(openen.length, 1, 'precies een knop in het blad opent het deck, niet: ' + JSON.stringify(openen));

    assert.deepEqual(fouten, [], 'geen JS-fouten');
  } finally {
    await ctx.close();
    await browser.close();
    await stop(srv.child);
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});
