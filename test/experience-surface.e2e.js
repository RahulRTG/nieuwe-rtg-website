/* De browser-golden-path van het Experience Platform: een echte Economic
   Proof verschijnt alleen bij de juiste principal; een afspraak gaat via
   preview + menselijke bevestiging naar de autoritatieve agenda en komt daarna
   als zelfstandig verifieerbaar bewijs terug. De server en data zijn per test
   geïsoleerd; dit maakt geen afspraak in een echte ledenomgeving.

   De open factuur is een expliciet overeengekomen historische RTG-termijn,
   geen gevolg van gratis registratie en geen nieuwe Business-toelating. De
   betaling loopt over HTTP door betaalwaarheid en settlement; Economic Proof
   wordt niet gezaaid. De lokale Magnaat Test-rail bewijst hier geen externe
   provideracceptatie, externe afdracht of huidige abonnementsprijs. Nieuwe
   contractacceptatie en activering worden in abonnementen-http.test.js beproefd. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stopHard, letOpFouten, laadPlaywright, browserOpties,
  geenBrowser } = require('./helper');
const historischAccount = require('./lib/historisch-account');

const pw = laadPlaywright();
async function api(base, pad, body, token) {
  const r = await fetch(base + pad, { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {})
  }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

test('Experience surface: Economic Proof en bevestigde actie zijn mobiel zichtbaar en verifieerbaar',
  { skip: geenBrowser(pw) }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-experience-surface-'));
  const email = 'experience-surface-historisch@rtg.test';
  const invoiceId = 'RTG-2026-09-EXPERIENCEPROEF';
  let child, base, browser;
  try {
    historischAccount(tmp, { name: 'Experience Surface', email, tier: 'rtg',
      memberState: { invoices: [{ id: invoiceId, desc: 'Historische maandbijdrage lidmaatschap',
        maand: '2026-09', netto: 0, bijdrage: 78.65, btw: 13.65,
        status: 'open', date: 'Historische termijn september 2026' }] } });
    ({ child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: tmp,
      RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '',
      RTG_MAGNAAT_TEST: '1', RTG_BETALEN_UIT: '0', RTG_SIMULATIEBANK: '0',
      STRIPE_SECRET_KEY: '', MOLLIE_API_KEY: '', ADYEN_API_KEY: '',
      RTF_IBAN: '', RTF_LOKAAL_IBAN: '' } }));
    const login = await api(base, '/api/auth/login', { login: email, password: 'geheim123', pasApp: 'rtg' });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    assert.equal(login.body.state.user.tier, 'rtg', 'een bestaande persoonlijke RTG-pas, zonder Business-autoriteit');
    const token = login.body.token;
    assert.ok(token);
    const state = await api(base, '/api/state', {}, token);
    assert.equal(state.status, 200, JSON.stringify(state.body));
    const invoice = (state.body.state.invoices || []).find(i => i.id === invoiceId && i.status === 'open' &&
      /maandbijdrage|lidmaatschap|jaarbijdrage/i.test(i.desc || ''));
    assert.ok(invoice, 'de golden path heeft een open abonnementsfactuur nodig');
    assert.equal(invoice.bijdrage, 78.65, 'de historische contractprijs wordt niet herprijsd');
    const voorBetaling = await api(base, '/api/experience/bootstrap', { world: 'living' }, token);
    assert.equal(voorBetaling.status, 200, JSON.stringify(voorBetaling.body));
    assert.deepEqual(voorBetaling.body.projection.view.valueProofs, [], 'een open factuur is nog geen Economic Proof');
    const betaald = await api(base, '/api/pay', { invoiceId: invoice.id }, token);
    assert.equal(betaald.status, 200, JSON.stringify(betaald.body));
    assert.notEqual(betaald.body.pending, true, 'een wachtende betaling is geen afgeronde betaling');
    const voldaan = betaald.body.state.invoices.find(i => i.id === invoiceId);
    assert.ok(voldaan);
    assert.equal(voldaan.status, 'paid');
    assert.equal(voldaan.betaalBewijzen.length, 1);
    assert.equal(voldaan.betaalBewijzen[0].centen, 7865);
    assert.ok(voldaan.betaalBewijzen[0].id, 'het betaalbewijs komt uit de echte settlementketen');
    const naBetaling = await api(base, '/api/experience/bootstrap', { world: 'living' }, token);
    assert.equal(naBetaling.status, 200, JSON.stringify(naBetaling.body));
    assert.equal(naBetaling.body.projection.view.valueProofs.length, 1);
    const proofs = naBetaling.body.projection.view.valueProofs;
    assert.equal(proofs.length, 1, 'alleen de uitgevoerde betaling levert een Economic Proof op');
    assert.equal(proofs[0].purpose, 'MEMBERSHIP.CONTRIBUTION');
    assert.deepEqual(proofs[0].requestedValue, { amountMinor: 6500, currency: 'EUR' });
    assert.deepEqual(Object.fromEntries(proofs[0].components.map(c => [c.component, c.amountMinor])),
      { platform: 4550, 'local-fund': 1300, foundation: 650 });
    assert.equal(proofs[0].proof.integrity, true);
    assert.ok(proofs[0].proof.ledgerTransactions > 0, 'het bewijs verifieert echte economische ledgerboekingen');
    assert.ok(proofs[0].proof.evidenceItems > 0, 'het bewijs bevat betaal-evidence, niet alleen een status');
    const herlezen = await api(base, '/api/experience/bootstrap', { world: 'living' }, token);
    assert.equal(herlezen.status, 200);
    assert.equal(herlezen.body.projection.view.valueProofs.length, 1,
      'een nieuwe projectielezing houdt het betaalbewijs vast; het is geen eenmalig betaalantwoord');
    assert.deepEqual(herlezen.body.projection.view.valueProofs[0].requestedValue, proofs[0].requestedValue);
    assert.equal(herlezen.body.projection.view.valueProofs[0].proof.integrity, true);

    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext({ viewport: { width: 320, height: 720 } });
    await context.addInitScript(tok => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, token);
    const page = await context.newPage(), fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/rtg.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body[data-rtg-edge-2-rendered="true"]', { timeout: 15000 });
    await require('./helper').edgeActies(page);
    await page.waitForFunction(() => {
      const b = document.querySelector('.rtg-edge-action .xp-trigger');
      if (!b || /Verbinden/.test(b.textContent)) return false;
      const r = b.getBoundingClientRect();
      const voor = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return r.width > 0 && r.height > 0 && !!voor && b.contains(voor);
    }, null, { timeout: 15000 });
    assert.equal(await page.locator('.rtg-edge-action .xp-trigger').count(), 1,
      'Economic Proof heeft exact één zichtbare ingang in de Edge-onderrand');
    const randMaat = await page.evaluate(() => {
      const slot = document.querySelector('.rtg-edge-action');
      const sr = slot.getBoundingClientRect();
      const knoppen = [...slot.querySelectorAll('button')].filter(x => x.offsetParent !== null).map(x => {
        const r = x.getBoundingClientRect();
        return { naam: x.getAttribute('aria-label') || x.textContent.trim(), left: r.left,
          right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      }).sort((a, b) => a.left - b.left);
      return { slot: { left: sr.left, right: sr.right }, knoppen };
    });
    assert.equal(randMaat.knoppen.length, 3,
      'Context, dagactie en Experience delen exact dezelfde actieruimte: ' + JSON.stringify(randMaat));
    for (const k of randMaat.knoppen) {
      assert.ok(k.width >= 24 && k.height >= 24,
        'raakvlak is te klein op 320 px: ' + JSON.stringify(k));
      assert.ok(k.left >= randMaat.slot.left - 1 && k.right <= randMaat.slot.right + 1,
        'bediening wordt op 320 px afgeknipt: ' + JSON.stringify({ randMaat, k }));
    }
    for (let i = 1; i < randMaat.knoppen.length; i++) assert.ok(
      randMaat.knoppen[i - 1].right <= randMaat.knoppen[i].left + .5,
      'bedieningen overlappen op 320 px: ' + JSON.stringify(randMaat));
    await require('./helper').edgeActies(page);
    await page.click('.rtg-edge-action .xp-trigger');
    await page.waitForSelector('.xp-dialog[open]', { timeout: 5000 });
    await page.waitForSelector('.xp-proofs .xp-proof', { timeout: 5000 });
    const valueProof = await page.textContent('.xp-proofs');
    assert.match(valueProof, /Integriteit bevestigd/);
    assert.match(valueProof, /platform/);
    assert.match(valueProof, /local-fund/);
    assert.match(valueProof, /foundation/);

    await page.click('.xp-quick .xp-action');
    await page.fill('.xp-plan input[name="title"]', 'Premium golden path');
    await page.fill('.xp-plan input[name="date"]', '2026-09-09');
    await page.fill('.xp-plan input[name="time"]', '14:15');
    await page.fill('.xp-plan textarea[name="note"]', 'Browserbewijs');
    await page.click('.xp-plan button[type="submit"]');
    await page.waitForFunction(() => /Bevestig en plan/.test(
      (document.querySelector('.xp-plan button[type="submit"]') || {}).textContent || ''),
    null, { timeout: 5000 });
    assert.match(await page.textContent('.xp-feedback'),
      /Geen betaling of extern bericht/);
    const voor = await api(base, '/api/agenda/mijn-lijst', {}, token);
    assert.equal(voor.body.items.some(i => i.titel === 'Premium golden path'), false,
      'een preview mag nog geen domeinwaarheid maken');

    await page.click('.xp-plan button[type="submit"]');
    await page.waitForSelector('.xp-action-proofs .xp-action-proof', { timeout: 10000 });
    assert.match(await page.textContent('.xp-flash'), /Gepland: Premium golden path/);
    assert.match(await page.textContent('.xp-action-proofs'), /Keten geverifieerd/);
    assert.match(await page.textContent('.xp-action-proofs'), /Premium golden path/);

    const na = await api(base, '/api/agenda/mijn-lijst', {}, token);
    assert.equal(na.body.items.filter(i => i.titel === 'Premium golden path').length, 1);
    const evidence = await api(base, '/api/experience/evidence', { limit: 10 }, token);
    assert.equal(evidence.body.integrity.status, 'VERIFIED');
    assert.equal(evidence.body.integrity.valid, true);
    assert.equal(evidence.body.evidence.filter(e =>
      e.intent && e.intent.id === 'schedule.item.create').length, 1);

    const maat = await page.evaluate(() => {
      const d = document.querySelector('.xp-dialog'), r = d.getBoundingClientRect();
      const laatste = document.querySelector('.xp-action-proofs .xp-action-proof:last-child');
      return { left: r.left, right: r.right, width: innerWidth,
        actionOverflow: laatste ? laatste.scrollWidth - laatste.clientWidth : 0 };
    });
    assert.ok(maat.left >= -1 && maat.right <= maat.width + 1,
      'het mobiele bewijsvenster valt buiten beeld: ' + JSON.stringify(maat));
    assert.ok(maat.actionOverflow <= 1,
      'een bewijsregel loopt horizontaal uit: ' + JSON.stringify(maat));
    assert.deepEqual(fouten, [], 'geen browserfouten in de golden path');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    await stopHard(child);
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  }
});
