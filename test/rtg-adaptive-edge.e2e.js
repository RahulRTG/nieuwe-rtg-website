'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { browserOpties, geenBrowser, laadPlaywright, startServer, stop } = require('./helper');
const pw = laadPlaywright();

const SCHERMEN = [
  ['/apps/foundation/os-publiek.html', 'foundation', { width: 390, height: 844 }],
  ['/apps/foundation/os-publiek.html', 'foundation', { width: 1366, height: 900 }]
];

test('LivingOS Home keert vanuit de routevergelijker en een app terug naar de vernieuwde momentenfeed',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext();
    await context.addInitScript(() => localStorage.setItem('rtg_cookieinfo_v1', '1'));
    const page = await context.newPage();
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const source of ['/apps/living-os.html?view=worlds', '/apps/notities.html']) {
        await page.goto(base + source, { waitUntil: 'domcontentloaded' });
        await wacht(page, new URL(page.url()).pathname);
        await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="home"]').click();
        await page.waitForLoadState('domcontentloaded');
        assert.equal(new URL(page.url()).pathname, '/apps/wereld.html', source + ' op ' + width);
        await wacht(page, '/apps/wereld.html');
        await page.waitForSelector('.living-intro');
        assert.equal(await page.locator('#feed').count(), 1, 'de vernieuwde momentenfeed staat er');
        assert.equal(await page.locator('.lo-rail').count(), 0, 'geen routevergelijker als home');
        assert.equal((await meet(page)).bars, 1);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
        assert.equal(await page.locator('.rtg-edge-mark').getAttribute('href'), '/apps/wereld.html');
      }
    }
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
});

test('het RTG-beeldmerk blijft intact bij een eerder opgeslagen foutieve Engelse vertaling',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtg_lang', 'en');
      localStorage.setItem('rtg_tr_v2_en', JSON.stringify({
        RTG: 'RTG (No Translation Needed)', 'Rahul Travel Group': 'A wrong brand name'
      }));
    });
    const page = await context.newPage();
    for (const pad of ['/apps/living-os.html', '/apps/wereld.html']) {
      await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
      await wacht(page, pad);
      await page.waitForFunction(() => !!window.RTGi18n);
      await page.evaluate(() => window.RTGi18n.set('en'));
      await page.waitForFunction(() => document.querySelector('.rtg-adaptive-bar [data-rtg-adaptive-action="worlds"] small')?.textContent === 'Worlds');
      assert.equal(await page.locator('.rtg-edge-mark-short').textContent(), 'RTG');
      assert.equal(await page.locator('.rtg-edge-mark-lockup strong').textContent(), 'Rahul Travel Group');
    }
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
});

async function wacht(page, pad) {
  await page.waitForFunction(verwacht => location.pathname !== verwacht || document.body &&
    document.body.dataset.rtgAdaptiveReady === 'true' && window.RTGAdaptiveEdge && (() => {
      const bar = document.querySelector('.rtg-adaptive-bar');
      if (!bar) return false;
      const r = bar.getBoundingClientRect(), s = getComputedStyle(bar);
      return r.width > 100 && r.height >= 44 && r.top >= 0 && r.bottom <= innerHeight &&
        s.visibility === 'visible' && Number(s.opacity) > .99;
    })(),
  pad, { timeout: 60000 });
}

async function meet(page) {
  return page.evaluate(() => {
    const zichtbaar = el => {
      if (!el) return false;
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0 &&
        r.width > 1 && r.height > 1 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight;
    };
    const host = document.querySelector('.rtg-adaptive-edge');
    const bar = document.querySelector('.rtg-adaptive-bar');
    const lippen = document.querySelector('.rtg-adaptive-lips');
    const br = bar.getBoundingClientRect(), lr = lippen.getBoundingClientRect();
    return {
      ready: document.body.dataset.rtgAdaptiveReady,
      wereld: document.body.dataset.rtgWorld,
      hosts: document.querySelectorAll('.rtg-adaptive-edge').length,
      bars: [...document.querySelectorAll('.rtg-adaptive-bar')].filter(zichtbaar).length,
      oudeBalkZichtbaar: zichtbaar(document.querySelector('.rtg-edge-bottom')),
      binnen: br.left >= 0 && br.right <= innerWidth && br.bottom <= innerHeight,
      barBreedte: br.width,
      midden: Math.abs((br.left + br.width / 2) - (lr.left + lr.width / 2)),
      lipBreedte: lr.width,
      richting: getComputedStyle(bar.querySelector('button')).flexDirection,
      aiKopieZichtbaar: zichtbaar(bar.querySelector('[data-rtg-adaptive-action="ai"] .rtg-adaptive-item-copy')),
      knoppen: [...bar.querySelectorAll('button')].map(el => {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el), small = el.querySelector('small');
        return { width: r.width, height: r.height, color: s.color,
          labelWeight: small ? Number(getComputedStyle(small).fontWeight) : 0 };
      }),
      state: host.dataset.rtgAdaptiveState,
      deck: host.dataset.rtgAdaptiveDeck
    };
  });
}

test('Adaptive Edge is één tastbare RTG-laag op mobiel en desktop',
  { skip: geenBrowser(pw) }, async (t) => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext();
    await context.route('**/api/onboarding/status', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ klaar: true }) }));
    await context.addInitScript(() => {
      try {
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    });
    for (const [pad, wereld, maat] of SCHERMEN) {
      await t.test(wereld + ' ' + maat.width, async st => {
        const page = await context.newPage();
        try {
          await page.setViewportSize(maat);
          await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
          if (new URL(page.url()).pathname !== pad) { st.skip('route vraagt toegang'); return; }
          await wacht(page, pad);
          const m = await meet(page);
          assert.equal(m.ready, 'true');
          assert.equal(m.wereld, wereld);
          assert.equal(m.hosts, 1);
          assert.equal(m.bars, 1);
          assert.equal(m.oudeBalkZichtbaar, false);
          assert.equal(m.binnen, true);
          assert.ok(m.midden <= 1, 'lippen staan ' + m.midden + 'px uit het midden');
          assert.ok(m.lipBreedte >= 44, 'lippen zijn te klein: ' + m.lipBreedte);
          assert.ok(m.barBreedte <= 721, 'Edge wijkt af van de vaste marketingmaat: ' + m.barBreedte);
          assert.equal(m.richting, 'column');
          assert.equal(m.aiKopieZichtbaar, false);
          assert.equal(m.knoppen.length, 5);
          m.knoppen.forEach(k => {
            assert.ok(k.width >= 43.5 && k.height >= 43.5, 'raakvlak is ' + k.width + 'x' + k.height);
            assert.ok(k.labelWeight >= 600, 'label is te licht: ' + k.labelWeight);
          });
          await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="menu"]').click();
          await page.waitForSelector('.rtg-edge-index[aria-hidden="false"]');
          await page.keyboard.press('Escape');
          await page.waitForSelector('.rtg-edge-index[aria-hidden="false"]', { state: 'hidden' });
          if (maat.width === 390) {
            const veeg = async (dx, dy) => page.evaluate(([x, y]) => {
              const bar = document.querySelector('.rtg-adaptive-bar'), r = bar.getBoundingClientRect();
              const maak = (type, cx, cy) => bar.dispatchEvent(new PointerEvent(type, {
                bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', button: 0,
                clientX: cx, clientY: cy
              }));
              const sx = r.left + r.width / 2, sy = r.top + r.height / 2;
              maak('pointerdown', sx, sy); maak('pointermove', sx + x, sy + y); maak('pointerup', sx + x, sy + y);
            }, [dx, dy]);
            await veeg(-120, 0);
            await page.waitForFunction(() => document.querySelector('.rtg-adaptive-edge').dataset.rtgAdaptiveDeck === 'context');
            await veeg(0, -90);
            await page.waitForFunction(() => document.querySelector('.rtg-adaptive-edge').dataset.rtgAdaptiveState === 'expanded');
            assert.equal(await page.locator('.rtg-adaptive-sheet').isVisible(), true);
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => document.querySelector('.rtg-adaptive-edge').dataset.rtgAdaptiveState === 'dock');
          }
        } finally { await page.close(); }
      });
    }
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
});

test('Edge voert appbediening uit, controleert actuele beschikbaarheid en sluit werkbladen',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const call = async (url, body, token) => {
      const response = await fetch(base + url, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify(body) });
      assert.equal(response.status, 200, url);
      return response.json();
    };
    const account = await call('/api/auth/register', { name: 'Edge Proef',
      email: 'edge' + Date.now() + '@voorbeeld.test', password: 'Edge-proef-12345',
      geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    const agreement=await call('/api/onboarding/status',{},account.token);
    await call('/api/onboarding/teken', { naam: 'Edge Proef', akkoord: true,contractVersion:agreement.contract.versie }, account.token);
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(token => {
      localStorage.setItem('rtg_member_token', token); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, account.token);
    const page = await context.newPage();
    await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    await wacht(page, '/apps/app.html');
    await page.waitForSelector('#rtgCommand[data-stand="open"]');
    assert.equal(await page.locator('.cmd-balk').isVisible(), false);

    await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="ai"]').click();
    await page.locator('.rtg-adaptive-question input').fill('open LIFE');
    await page.locator('.rtg-adaptive-question button').click();
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.cmd-pane iframe'))
      .some(frame => frame.getAttribute('src') === '/apps/rtg.html'));
    assert.equal(await page.locator('.cmd-praat').isVisible(), true, 'the existing reply remains readable above Edge');
    await require('./helper').edgeActies(page);
    await page.locator('.rtg-adaptive-controls').getByRole('button', { name: 'Sluit dit werkblad', exact: true }).click();
    await page.waitForSelector('.cmd-pane', { state: 'detached' });

    // A retained proxy must recheck its original control at the moment of use.
    await page.evaluate(() => {
      window.__edgeExecutions = 0;
      const root = document.createElement('nav'); root.className = 'wos-dock'; root.id = 'edgeProbe';
      const button = document.createElement('button'); button.id = 'edgeProbeAction'; button.textContent = 'Proefhandeling';
      button.onclick = () => window.__edgeExecutions++;
      root.appendChild(button); document.body.appendChild(root);
    });
    await require('./helper').edgeActies(page);
    const source = page.locator('[data-rtg-adaptive-source="edgeProbeAction"]');
    await source.waitFor({ state: 'visible' });
    assert.equal(await page.locator('#edgeProbe').isVisible(), false);
    await source.evaluate(proxy => { document.getElementById('edgeProbeAction').disabled = true; proxy.click(); });
    assert.equal(await page.evaluate(() => window.__edgeExecutions), 0, 'disabled owner cannot execute through a stale proxy');
    await page.evaluate(() => { document.getElementById('edgeProbeAction').disabled = false; });
    await source.click();
    assert.equal(await page.evaluate(() => window.__edgeExecutions), 1, 'the real click reaches its existing handler once');
    await require('./helper').edgeActies(page);
    await source.evaluate(proxy => { document.getElementById('edgeProbe').remove(); proxy.click(); });
    assert.equal(await page.evaluate(() => window.__edgeExecutions), 1, 'removed owner cannot execute through a retained proxy');
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
});

/* DE BALK FLIKKERT NIET BIJ EEN SCROLL VAN DE SOFTWARE (EDGE.md, ronde 2). Een
   scrollTo van het scherm liet de balk opkijken (peek) en 520 ms later weer
   zakken. Waar Edge 2 draait, vraagt de balk nu de gebaarversheid van de ene
   eigenaar (rtg-edge-2-context.js); zonder Edge 2 -- de landing -- blijft het
   gedrag van vandaag. Drie gevallen: een scroll zonder gebaar geeft geen peek
   (reisboek), een wiel geeft peek en daarna dock zoals voorheen (reizen), en op
   de landing geeft een wiel peek.

   Waarom het wiel op reizen en niet op reisboek: zonder inlog is reisboek maar
   zo'n 150 px langer dan het venster. Een wiel maakt Edge 2 compact, de pagina
   krimpt tot het venster, de scroll valt terug op 0 en Edge 2 gaat weer naar
   overview -- en DAT zet de balk op dock, wat de klok van de balk ook doet.
   Op reizen blijft Edge 2 compact staan, dus de dock daar komt van de klok van
   de balk zelf; de proef eist dat Edge 2 op het eind nog compact is.

   Elke tussenstand telt: een MutationObserver schrijft ELKE waarde van
   data-rtg-adaptive-state op, en daarnaast wordt per frame bemonsterd. Een peek
   die binnen een frame weer weg is, glipt zo niet langs. `y` is de HOOGSTE
   scrollpositie tijdens de proef en niet de laatste, want een pagina kan
   krimpen terwijl er gescrold wordt.

   DE MUTATIES, elk nagetrokken: haal de versheidsvraag weg (de flikkertoets zakt
   op peek), eis de gebaarversheid ook zonder Edge 2 (de landing krijgt geen peek
   meer), en zet de klok van 520 op 520000 (het wiel komt nooit op dock). */
/* WACHTEN OP DE TOESTAND, NIET OP DE KLOK (test/klokwacht.test.js). De proef
   stopt zodra zijn uitkomst er is: 'peekDock' als de balk via peek op dock
   staat, 'peek' als er een peek was en de pagina voorbij 100 px kwam, en 'rust'
   als scroll en balkstand dertig frames stil liggen -- dat laatste is het venster
   waarin een flikkering zich zou verraden, geteld in frames in plaats van ms. Een
   grens van vijf seconden houdt de lus eindig; de bewering daarna zegt wat er
   ontbrak. */
async function volgBalk(page, doe, klaar) {
  /* Eerst de waarnemers, dan de handeling: een wiel dat vertrekt voordat de
     waarnemer hangt, wordt anders niet gezien. */
  await page.evaluate(() => {
    const host = document.querySelector('.rtg-adaptive-edge');
    const p = window.__balkProef = { standen: [host.dataset.rtgAdaptiveState], hoogste: window.scrollY, loopt: true };
    p.noteer = () => { const s = host.dataset.rtgAdaptiveState; if (p.standen[p.standen.length - 1] !== s) p.standen.push(s); };
    p.waarnemer = new MutationObserver(p.noteer);
    p.waarnemer.observe(host, { attributes: true, attributeFilter: ['data-rtg-adaptive-state'] });
    /* In de VANGfase: een luisteraar die later komt, leest de positie pas nadat
       Edge 2 op dezelfde scroll compact werd en de pagina kromp. */
    p.scrol = () => { p.hoogste = Math.max(p.hoogste, window.scrollY); };
    addEventListener('scroll', p.scrol, { passive: true, capture: true });
    const frame = () => { p.noteer(); if (p.loopt) requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  });
  if (doe === 'scrollTo') await page.evaluate(() => window.scrollTo(0, 900));
  else await doe();
  return page.evaluate(async soort => {
    const p = window.__balkProef, t0 = performance.now();
    let stil = 0, y = window.scrollY, n = p.standen.length;
    while (performance.now() - t0 < 5000) {
      await new Promise(r => requestAnimationFrame(r));
      const laatste = p.standen[p.standen.length - 1];
      if (soort === 'peekDock' && p.standen.includes('peek') && laatste === 'dock') break;
      if (soort === 'peek' && p.standen.includes('peek') && p.hoogste > 100) break;
      if (soort === 'rust') {
        if (window.scrollY === y && p.standen.length === n) stil++;
        else { stil = 0; y = window.scrollY; n = p.standen.length; }
        if (stil >= 30) break;
      }
    }
    p.loopt = false; p.waarnemer.disconnect(); removeEventListener('scroll', p.scrol, { capture: true }); p.noteer();
    return { standen: p.standen, y: p.hoogste, edge2: !!window.RTGEdge2,
      edge2Stand: document.body.getAttribute('data-rtg-edge-2-state') };
  }, klaar);
}

test('de balk flikkert niet bij een scroll van de software, en een wiel werkt zoals voorheen',
  { skip: geenBrowser(pw) }, async (t) => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => { try { localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {} });

    const edge2Pagina = async (st, pad) => {
      const page = await context.newPage();
      await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
      if (new URL(page.url()).pathname !== pad) {
        st.skip(pad + ' leidde naar ' + new URL(page.url()).pathname + '; geen contract omzeild');
        await page.close(); return null;
      }
      await wacht(page, pad);
      await page.waitForFunction(() => document.body.getAttribute('data-rtg-edge-2-rendered') === 'true' &&
        document.querySelector('.rtg-adaptive-edge').dataset.rtgAdaptiveState === 'dock');
      /* scrollTo(0, 900) wordt afgekapt op een korte pagina, en elke afstand
         boven de 8 px laat de balk reageren. Kan er niet gescrold worden, dan
         meet deze proef niets en zakt hij hier. */
      assert.ok(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight > 60),
        pad + ' kan niet scrollen; dan meet deze proef niets');
      return page;
    };

    await t.test('reisboek: scrollTo zonder gebaar geeft geen peek', async (st) => {
      const page = await edge2Pagina(st, '/apps/reisboek.html');
      if (!page) return;
      try {
        const m = await volgBalk(page, 'scrollTo', 'rust');
        assert.equal(m.edge2, true, 'op reisboek hoort Edge 2 te draaien');
        assert.ok(m.y > 50, 'de pagina scrolde niet (' + m.y + '); dan meet deze proef niets');
        assert.deepEqual(m.standen, ['dock'], 'de balk flikkerde bij een scroll van de software: ' + m.standen.join(' > '));
      } finally { await page.close(); }
    });

    await t.test('reizen: een wiel omlaag geeft peek en daarna dock', async (st) => {
      const page = await edge2Pagina(st, '/apps/reizen.html');
      if (!page) return;
      try {
        await page.mouse.move(195, 420);
        const m = await volgBalk(page, () => page.mouse.wheel(0, 700), 'peekDock');
        assert.equal(m.edge2, true, 'op reizen hoort Edge 2 te draaien');
        assert.ok(m.y > 50, 'het wiel scrolde de pagina niet (hoogste ' + m.y + '; ' + m.standen.join(' > ') + ')');
        assert.ok(m.standen.includes('peek'), 'een wiel gaf geen peek: ' + m.standen.join(' > '));
        assert.equal(m.edge2Stand, 'compact',
          'Edge 2 staat niet meer op compact; dan kan de dock van Edge 2 komen en niet van de klok van de balk');
        assert.equal(m.standen[m.standen.length - 1], 'dock', 'na het wiel kwam de balk niet op dock: ' + m.standen.join(' > '));
      } finally { await page.close(); }
    });

    await t.test('landing: een wiel omlaag geeft peek, ook zonder Edge 2', async () => {
      const page = await context.newPage();
      try {
        await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.rtg-experience-edge .rtg-adaptive-bar');
        await page.waitForFunction(() => document.querySelector('.rtg-adaptive-edge').dataset.rtgAdaptiveState === 'dock');
        await page.mouse.move(195, 420);
        const m = await volgBalk(page, () => page.mouse.wheel(0, 700), 'peek');
        assert.equal(m.edge2, false, 'de landing hoort zonder Edge 2 te draaien; dan meet deze proef de verkeerde weg');
        assert.ok(m.y > 100, 'het wiel scrolde de landing niet (' + m.y + ')');
        assert.ok(m.standen.includes('peek'), 'een wiel op de landing gaf geen peek: ' + m.standen.join(' > '));
      } finally { await page.close(); }
    });
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
});
