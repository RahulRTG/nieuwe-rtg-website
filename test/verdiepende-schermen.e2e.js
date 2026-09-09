/* DE ELF VERDIEPINGSSCHERMEN IN EEN ECHTE BROWSER.

   De bronproeven bewaken tekst, bedrading en veiligheidsgrenzen, maar een
   scherm is pas af als iemand de weg werkelijk kan afleggen. Deze toets opent
   daarom ieder nieuw Foundation-, Living- en WorkOS-scherm en gebruikt er de
   eerste betekenisvolle bediening. Zo bewijst hij niet alleen dat de pagina
   bestaat, maar ook dat haar volgende stap bereikbaar is.

   Draai los: node --test test/verdiepende-schermen.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  browserOpties, geenBrowser, kantoorAlsPersoon, laadPlaywright, letOpFouten, startServer, stop
} = require('./helper');

const pw = laadPlaywright();

async function openEnZie(page, base, pad, kop) {
  await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
  const titel = page.locator('h1', { hasText: kop }).first();
  await titel.waitFor({ state: 'visible', timeout: 15000 });
  assert.match((await titel.textContent()).trim(), kop,
    pad + ' vertelt bij binnenkomst waarvoor het scherm er is');
}

async function openView(page, knop, paneel) {
  await page.locator(knop).first().click();
  await page.locator(paneel).waitFor({ state: 'visible', timeout: 10000 });
}

test('de elf verdiepingsschermen openen en brengen een mens naar de volgende stap',
  { skip: geenBrowser(pw) }, async () => {
  const server = await startServer();
  let browser;
  try {
    const post = (pad, body) => fetch(server.base + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
    }).then((r) => r.json());
    const kantoor = await kantoorAlsPersoon(server.base);
    assert.ok(kantoor, 'de beveiligde WorkOS Rooms openen als een echte testmedewerker');
    const lid = await post('/api/login', { tier: 'rtg' });
    assert.ok(lid.token, 'de LivingOS-schermen openen als een echt testlid');
    const gezin = await post('/api/foundation/gezin/maak', {
      gezinsnaam: 'Verdiepingsproef', naam: 'Beheerder', pin: '4321', geboortedatum: '1985-04-12'
    });
    assert.ok(gezin.token, 'de Foundation-schermen openen met een echt beheerprofiel');
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    await context.addInitScript((sessies) => {
      localStorage.setItem('rtg_office_token', sessies.kantoor);
      localStorage.setItem('rtg_member_token', sessies.lid);
      localStorage.setItem('rtf_sessie', JSON.stringify(sessies.foundation));
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, { kantoor, lid: lid.token,
      foundation: { code: gezin.code, token: gezin.token, gezin: gezin.gezin, profiel: gezin.profiel } });
    const page = await context.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await openEnZie(page, server.base, '/apps/decision-room.html', /Beslis waar het nodig is/);
    await page.locator('[data-dr-nieuw]').first().click();
    await page.locator('#drIntake').waitFor({ state: 'visible' });

    await openEnZie(page, server.base, '/apps/project-room.html', /Maak voortgang voelbaar/);
    await page.locator('[data-pr-huis="rtf"]').click();
    await page.waitForFunction(() => document.querySelector('[data-pr-huis="rtf"]')?.getAttribute('aria-pressed') === 'true');

    await openEnZie(page, server.base, '/apps/wonen.html', /Alles thuis/);
    await page.locator('a[href="#vandaag"]').click();
    await page.waitForFunction(() => location.hash === '#vandaag');

    await openEnZie(page, server.base, '/apps/onderhoud.html', /^Onderhoud$/);
    await page.locator('#nieuwMelding').click();
    await page.locator('#meldingDialoog').waitFor({ state: 'visible' });

    await openEnZie(page, server.base, '/apps/woningdossier.html', /Nooit meer zoeken/);
    await page.locator('#dossierZoek').fill('garantie');
    assert.equal(await page.locator('#dossierZoek').inputValue(), 'garantie',
      'het woningdossier kan meteen worden doorzocht');

    await openEnZie(page, server.base, '/apps/foundation/geld-later.html', /Vandaag begrijpen/);
    await page.locator('#glBekijkGeld').click();
    await page.locator('#glGeldBegin').waitFor({ state: 'visible' });

    await openEnZie(page, server.base, '/apps/foundation/gezondheid-welzijn.html', /Goed voor uzelf/);
    await page.locator('#gwBekijkDag').click();
    await page.locator('#gwDagBegin').waitFor({ state: 'visible' });

    await openEnZie(page, server.base, '/apps/foundation/meedoen-ontdekken.html', /Er is meer mogelijk/);
    await openView(page, '[data-mo-open="buurt"]', '[data-mo-view="buurt"]');

    await openEnZie(page, server.base, '/apps/foundation/samen-thuis.html', /Samen begint met overzicht/);
    await page.locator('#stBekijkDag').click();
    await page.locator('#stDagBegin').waitFor({ state: 'visible' });

    await openEnZie(page, server.base, '/apps/foundation/veilig-vertrouwd.html', /Veilig voelen begint/);
    await openView(page, '[data-vv-open="hulp"]', '[data-vv-view="hulp"]');

    await openEnZie(page, server.base, '/apps/foundation/zorg.html', /Hulp die met uw leven meebeweegt/);
    await openView(page, '[data-fh-open="hulp"]', '[data-fh-view="hulp"]');

    assert.deepEqual(fouten, [], 'geen paginafouten: ' + fouten.join(' | '));
    await page.close();
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop(server);
  }
});
