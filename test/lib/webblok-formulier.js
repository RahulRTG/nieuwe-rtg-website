/* Echte browserhandelingen. De negatieve antwoordproef injecteert expliciet
   ongeldige HTTP-200-antwoorden; de overige proef onderschept echte antwoorden. */
'use strict';
const assert = require('node:assert/strict');
const PAD = '**/api/browser/bericht';

async function beginConcept(doek) {
  const veld = doek.locator('textarea'), origineel = await veld.elementHandle();
  const tekst = 'Mijn concept blijft bij dit formulier';
  await veld.fill(tekst); await veld.evaluate(el => el.setSelectionRange(2, 12, 'backward'));
  return async () => {
    assert.equal(await veld.evaluate((el, oud) => el === oud, origineel), true, 'dezelfde textarea na resize');
    assert.equal(await veld.inputValue(), tekst);
    assert.deepEqual(await veld.evaluate(el => [document.activeElement === el,
      el.selectionStart, el.selectionEnd, el.selectionDirection]), [true, 2, 12, 'backward']);
  };
}

async function bereikbaar(doek) {
  for (const sel of ['textarea', 'button[type="submit"]']) {
    const maat = await doek.locator(sel).evaluate(el => {
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      const geraakt = document.elementFromPoint(x, y);
      return { breed: r.width, hoog: r.height, raak: geraakt === el || el.contains(geraakt) };
    });
    assert.ok(maat.breed >= 44 && maat.hoog >= 44 && maat.raak,
      sel + ' is bereikbaar boven de Edge: ' + JSON.stringify(maat));
  }
}

async function onbevestigdAntwoord(page, post, zaak, adres) {
  const doek = page.locator('#hoofd .ds-webblok'), veld = doek.locator('textarea');
  const bericht = 'Webblokproef: bewaar dit bericht tot geldige ontvangst.';
  const antwoorden = ['{geen geldige JSON', JSON.stringify({ ok: false, error: 'Niet verwerkt' }),
    JSON.stringify({ ok: true, via: 'onbekend', soort: 'offerte' })];
  let eerste;
  await veld.fill(bericht);
  for (const body of antwoorden) {
    await page.route(PAD, route => route.fulfill({ status: 200, contentType: 'application/json', body }));
    try {
      const ontvangen = page.waitForResponse(r => r.url().endsWith('/api/browser/bericht'));
      await doek.locator('button[type="submit"]').click();
      const response = await ontvangen; assert.equal(response.status(), 200);
      const opdracht = response.request().postDataJSON();
      if (!eerste) eerste = opdracht;
      else assert.deepEqual(opdracht, eerste, 'ongeldige bevestiging verbruikt geen herhaalsleutel');
      await page.waitForFunction(() => document.querySelector('.ds-webblok form')?.getAttribute('aria-busy') === 'false' &&
        document.querySelector('#melding').textContent.includes('ontvangst is niet bevestigd'));
      assert.equal(await veld.inputValue(), bericht);
      assert.equal(await doek.locator('button[type="submit"]').isDisabled(), false);
      assert.doesNotMatch(await page.locator('#melding').textContent(), /^Verstuurd/);
    } finally { await page.unroute(PAD); }
  }
  assert.equal(eerste.adres, adres);
  // Nu gaat exact dezelfde opdracht wél naar de echte geïsoleerde server.
  const ontvangen = page.waitForResponse(r => r.url().endsWith('/api/browser/bericht'));
  await doek.locator('button[type="submit"]').click();
  const response = await ontvangen, antwoord = await response.json();
  assert.equal(response.status(), 200);
  assert.deepEqual({ ok: antwoord.ok, via: antwoord.via, soort: antwoord.soort },
    { ok: true, via: 'werklijst', soort: 'offerte' });
  assert.deepEqual(response.request().postDataJSON(), eerste, 'bevestigde retry behoudt de oorspronkelijke opdracht');
  await page.waitForFunction(() => document.querySelector('.ds-webblok textarea').value === '');
  const staat = await post('/api/supplier/state', {}, zaak);
  assert.equal((staat.state.tickets || []).filter(t => String(t.text).includes(bericht)).length, 1,
    'na ongeldige antwoorden en geldige retry bestaat precies één klus');
}

async function berichtProef(page, post, zaak, adres) {
  await onbevestigdAntwoord(page, post, zaak, adres);
  const doek = page.locator('#hoofd .ds-webblok'), veld = doek.locator('textarea');
  const origineel = await veld.elementHandle(), bericht = 'Webblokproef: graag een offerte voor zes personen.';
  const resize = async (width, versie) => {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForFunction(v => document.querySelector('.ds-webblok')?.dataset.ver === v, versie);
  };
  let eerste, serverAntwoord, ontvangen, vrij, aanvragen = 0;
  const ontvangenP = new Promise(resolve => { ontvangen = resolve; });
  const vrijP = new Promise(resolve => { vrij = resolve; });
  await page.route(PAD, async route => {
    aanvragen++;
    if (eerste) return route.continue();
    eerste = route.request().postDataJSON();
    const r = await route.fetch(); serverAntwoord = { status: r.status(), body: await r.json() };
    ontvangen(); await vrijP; await route.abort('failed');
  });
  try {
    await veld.fill(bericht);
    const afgebroken = page.waitForEvent('requestfailed', r => r.url().endsWith('/api/browser/bericht'));
    await doek.locator('button[type="submit"]').click(); await ontvangenP;
    assert.equal(serverAntwoord.status, 200); assert.equal(serverAntwoord.body.ok, true);
    assert.equal(await doek.locator('button[type="submit"]').isDisabled(), true);
    assert.equal(await doek.locator('form').getAttribute('aria-busy'), 'true');
    await doek.locator('form').dispatchEvent('submit');
    await doek.locator('form').dispatchEvent('submit');
    await resize(1280, 'desktop');
    assert.equal(aanvragen, 1, 'dubbele submits tijdens wachten maken geen extra aanvraag');
    assert.equal(await veld.evaluate((el, oud) => el === oud, origineel), true, 'lopende aanvraag behoudt de formowner');
    assert.equal(await veld.inputValue(), bericht);
    vrij(); await afgebroken;
    await page.waitForFunction(() => /fetch/i.test(document.querySelector('#melding').textContent));
    await resize(820, 'tablet');
    assert.equal(await veld.inputValue(), bericht);
    const antwoord = page.waitForResponse(r => r.url().endsWith('/api/browser/bericht') && r.request().method() === 'POST');
    await doek.locator('button[type="submit"]').click(); const r = await antwoord, j = await r.json();
    assert.equal(r.status(), 200);
    assert.equal(aanvragen, 2, 'alleen de bewuste retry is een tweede aanvraag');
    assert.deepEqual({ ok: j.ok, via: j.via, soort: j.soort, herhaald: j.herhaald },
      { ok: true, via: 'werklijst', soort: 'offerte', herhaald: true });
    assert.deepEqual(r.request().postDataJSON(), eerste);
    assert.equal(eerste.adres, adres); assert.equal(eerste.tekst, bericht);
    assert.match(eerste.idem, /^web-[a-f0-9]{32}$/);
    await page.waitForFunction(() => document.querySelector('.ds-webblok textarea').value === '');
    const staat = await post('/api/supplier/state', {}, zaak);
    const tickets = (staat.state.tickets || []).filter(t => String(t.text).includes(bericht));
    assert.equal(tickets.length, 1, 'verloren antwoord en retry leveren precies één klus');
    assert.match(tickets[0].text, /Offerteaanvraag/);
  } finally { vrij(); await page.unroute(PAD); }

  const ander = await post('/api/supplier/site/bewaar', { design: { titel: 'Andere webbloksite',
    blokken: [{ id: 'form', type: 'formulier', kop: 'Andere ontvanger', knop: 'Ander bericht' }] } }, zaak);
  const online = await post('/api/supplier/site/publiceer', { id: ander.design.id, adres: 'ander-webblok' }, zaak);
  let ontvangenLaat, vrijLaat;
  const laatP = new Promise(resolve => { ontvangenLaat = resolve; });
  const release = new Promise(resolve => { vrijLaat = resolve; });
  await page.route(PAD, async route => {
    const r = await route.fetch(); ontvangenLaat(); await release; await route.fulfill({ response: r });
  });
  try {
    await veld.fill('Bericht dat bij de vorige site blijft');
    const laat = page.waitForResponse(r => r.url().endsWith('/api/browser/bericht'));
    await doek.locator('button[type="submit"]').click(); await laatP;
    await page.locator('#adres').fill(online.adres + '.rtg'); await page.locator('#balk button').click();
    await page.waitForFunction(() => document.title === 'Andere webbloksite · RTG Browser');
    assert.equal(await veld.inputValue(), '', 'sitewisseling neemt geen vorig concept over');
    assert.equal(await veld.evaluate((el, oud) => el === oud, origineel), false);
    await veld.fill('Concept bij de nieuwe site');
    await page.evaluate(() => {
      window.__lateWebmeldingen = 0;
      new MutationObserver(() => window.__lateWebmeldingen++)
        .observe(document.querySelector('#melding'), { childList: true, characterData: true, subtree: true });
    });
    vrijLaat(); await (await laat).finished();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await veld.inputValue(), 'Concept bij de nieuwe site');
    assert.equal(await page.evaluate(() => window.__lateWebmeldingen), 0, 'oude site meldt geen succes op de nieuwe site');
  } finally { vrijLaat(); await page.unroute(PAD); }
}

module.exports = { beginConcept, bereikbaar, berichtProef };
