/* Echte browser, lokale Stripe-SDK-stub: bewijst UI-toestemming en dezelfde
   PaymentIntent, niet een bankauthenticatie of externe providerbeschikbaarheid. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright();
async function pagina(t) {
  const browser = await pw.chromium.launch(browserOpties()); t.after(() => browser.close());
  const p = await browser.newPage(), fouten = []; letOpFouten(p, fouten);
  await p.setContent('<!doctype html><html lang="nl"><body><main id="vak"></main></body></html>');
  await p.addScriptTag({ path: path.join(__dirname, '../public/apps/geld/hulp.js') });
  await p.addScriptTag({ path: path.join(__dirname, '../public/apps/geld/lidmaatschap-aanbod-kaart.js') });
  await p.evaluate(() => {
    window.kaartCalls = []; window.vernietigd = 0;
    window.Stripe = key => ({ elements: () => ({ create: soort => ({
      mount: el => { el.textContent = 'Beveiligd fixture-kaartveld'; }, destroy: () => { window.vernietigd++; }, fixture: soort
    }) }), confirmCardPayment: async (secret, opties) => {
      window.kaartCalls.push({ key, secret, opties });
      return window.kaartFout ? { error: { message: 'Niet tonen: intern_fixture_secret' } } : { paymentIntent: { status: 'succeeded' } };
    } });
  });
  return { p, fouten };
}
const actie = nieuw => ({ soort: 'stripe-bevestigen', publicKey: 'pk_test_fixture', clientSecret: 'pi_fixture_secret_fixture',
  nieuweBetaalmethode: nieuw, paymentMethodId: nieuw ? null : 'pm_fixture', returnUrl: 'https://rtg.example/apps/geld.html#lidmaatschap' });
async function open(p, a) {
  await p.evaluate(a => {
    window.uitkomst = 'wacht';
    window.RTGGeldAbonnementKaart.bevestig(document.getElementById('vak'), 'eigen-contract', a)
      .then(r => { window.uitkomst = r; });
  }, a);
  await p.locator('[data-abo-kaartbevestig]').waitFor();
}

test('nieuwe kaart vraagt apart mandaat en bevestigt uitsluitend dezelfde PI met off_session',
  { skip: geenBrowser(pw), timeout: 30000 }, async t => {
    const { p, fouten } = await pagina(t); await open(p, actie(true));
    assert.equal(await p.locator('[data-abo-kaartakkoord]').isChecked(), false);
    await p.locator('[data-abo-kaartbevestig]').click();
    assert.equal(await p.evaluate(() => window.kaartCalls.length), 0);
    await p.locator('[data-abo-kaartakkoord]').check(); await p.locator('[data-abo-kaartbevestig]').click();
    await p.waitForFunction(() => window.uitkomst === true);
    const calls = await p.evaluate(() => window.kaartCalls);
    assert.equal(calls.length, 1); assert.equal(calls[0].secret, actie(true).clientSecret);
    assert.equal(calls[0].opties.setup_future_usage, 'off_session');
    assert.equal(calls[0].opties.payment_method.card.fixture, 'card');
    assert.equal(await p.evaluate(() => window.vernietigd), 1);
    assert.doesNotMatch(await p.locator('body').textContent(), /succeeded|betaald|secret/);
    assert.deepEqual(fouten, []);
  });

test('bestaande kaart blijft dezelfde PM; fout blijft herstelbaar zonder secret of betaalclaim',
  { skip: geenBrowser(pw), timeout: 30000 }, async t => {
    const { p, fouten } = await pagina(t); await p.evaluate(() => { window.kaartFout = true; });
    await open(p, actie(false)); assert.equal(await p.locator('[data-abo-kaartakkoord]').count(), 0);
    await p.locator('[data-abo-kaartbevestig]').click();
    await p.waitForFunction(() => document.querySelector('[data-abo-kaartmelding]').textContent.includes('niet afgerond'));
    const calls = await p.evaluate(() => window.kaartCalls);
    assert.deepEqual(calls[0].opties, { payment_method: 'pm_fixture' });
    assert.doesNotMatch(await p.locator('body').textContent(), /secret|intern_fixture/);
    await p.locator('[data-abo-kaartstop]').click(); await p.waitForFunction(() => window.uitkomst === false);
    assert.equal(await p.locator('[aria-label="Beveiligde kaartcontrole"]').count(), 0);
    assert.deepEqual(fouten, []);
  });
