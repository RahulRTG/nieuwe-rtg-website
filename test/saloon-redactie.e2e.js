'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const pw = require('playwright');
const { startServer, stop, browserOpties, geenBrowser, letOpFouten } = require('./helper');

/* #413 zet de eigen inhoud van een wereldhuis (hier de Saloon op /apps/wereld.html)
   bewust in een ingeklapt "Uw volledige overzicht" (details.wp-domain) onder de warme
   scene; test/world-homes.e2e.js opent hem net zo. Deze proef gaat over de Saloon
   zelf, dus hij opent die vouw eerst -- zoals een lid dat doet -- en zwakt verder niets af. */
async function openOverzicht(page) {
  const vouw = page.locator('details.wp-domain');
  await vouw.waitFor({ state: 'attached' });
  if (!(await vouw.evaluate(d => d.open))) await page.locator('details.wp-domain > summary').click();
}
test('van interne redactie via review naar Saloon, met een zichtbare correctie', { skip: geenBrowser(pw) }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-redactielus-'));
  let srv, browser;
  try {
    srv = await startServer({ env: { RTG_DATA_DIR: tmp, SMTP_URL: '' } });
    const api = async (pad, body, token) => {
      const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (token || '') }, body: JSON.stringify(body || {}) });
      return { status: r.status, ...await r.json() };
    };
    const rooster = await api('/api/supplier/roster', { code: 'BODE' });
    const zaak = await api('/api/supplier/login', { code: 'BODE', staffId: rooster.staff.find(x => x.role === 'manager').id, pin: '1234' });
    const lid = await api('/api/auth/register', { name: 'Redactieproef', email: 'redactieproef@example.test', phone: '0612345678',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' });
    assert.ok(zaak.token && lid.token);
    await api('/api/wereld/modus', { modus: 'alles', saloon: { bronnen: ['nieuws'] } }, lid.token);
    browser = await pw.chromium.launch(browserOpties(pw, { headless: true }));
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(tokens => {
      localStorage.setItem('rtg_sup_token', tokens.zaak); localStorage.setItem('rtg_member_token', tokens.lid); localStorage.setItem('rtg_lang', 'nl');
    }, { zaak: zaak.token, lid: lid.token });
    const editor = await context.newPage(), fouten = []; letOpFouten(editor, fouten);
    const stappen = [];
    editor.on('response', r => { if (r.url().includes('/api/supplier/redactie/')) stappen.push(r.status() + ' ' + r.url().split('/redactie/')[1]); });
    const lijstKlaar = () => editor.locator('#nieuwArt').waitFor().catch(async e => {
      throw new Error(e.message + '\n' + JSON.stringify({ fouten, stappen }) + '\n' + (await editor.locator('#hoofd').innerText()).slice(0, 2000));
    });
    await editor.goto(srv.base + '/apps/redactie.html');
    await editor.locator('#hoofd .kpis').waitFor()
      .catch(async e => { throw new Error(e.message + '\n' + JSON.stringify(fouten) + '\n' + (await editor.locator('body').innerText()).slice(0, 2000)); });
    await editor.locator('[data-t="artikelen"]').click(); await editor.locator('#nieuwArt').click();
    await editor.locator('#a_titel').fill('Een nieuw plein voor de buurt');
    await editor.locator('#a_inhoud').fill('Het plein gaat maandag open.');
    await editor.locator('#a_notities').fill('VERTRAUWELIJK: nog na te bellen bron.');
    await editor.locator('#a_review').click();
    await editor.waitForFunction(() => document.querySelector('#a_stand')?.textContent.includes('Werkstand: eindredactie'));
    const lijst = await api('/api/supplier/redactie/artikelen', { status: 'eindredactie' }, zaak.token);
    const id = lijst.lijst[0].id;
    assert.equal((await api('/api/krant/artikel', { code: 'BODE', id })).status, 404);
    await editor.locator('#a_pub').click(); await lijstKlaar();
    const lees = await context.newPage(); letOpFouten(lees, fouten);
    await lees.goto(srv.base + '/apps/wereld.html?embed=1');
    await openOverzicht(lees);
    const kaart = lees.locator('[data-saloon-id="nieuws:BODE:' + id + '"]');
    await kaart.getByRole('button', { name: 'Lees artikel', exact: true }).click();
    await lees.locator('#saloonArtikel').getByText('Het plein gaat maandag open.', { exact: true }).waitFor();
    assert.ok(!(await lees.locator('#saloonArtikel').textContent()).includes('VERTRAUWELIJK'));
    await lees.getByRole('button', { name: '‹ Saloon', exact: true }).click();
    await editor.locator('.art').filter({ hasText: 'Een nieuw plein voor de buurt' }).getByRole('button', { name: 'Bewerk', exact: true }).click();
    await editor.locator('#a_inhoud').fill('Het plein gaat dinsdag open.');
    await editor.locator('#a_bewaar').click();
    await editor.waitForFunction(() => document.querySelector('#a_stand')?.textContent.includes('Werkstand: concept'));
    assert.equal((await api('/api/krant/artikel', { code: 'BODE', id })).artikel.inhoud, 'Het plein gaat maandag open.');
    await editor.locator('#a_toelichting').fill('Correctie: de opening is op dinsdag.');
    await editor.locator('#a_pub').click(); await lijstKlaar();
    await lees.locator('[data-ververs]').click();
    await lees.waitForFunction(() => document.querySelector('#saloonStatus')?.textContent.includes('1 gewijzigd'));
    await kaart.getByRole('button', { name: 'Lees artikel', exact: true }).click();
    await lees.locator('#saloonArtikel').getByText('Het plein gaat dinsdag open.', { exact: true }).waitFor();
    await lees.locator('#saloonArtikel summary').click();
    await lees.locator('#saloonArtikel').getByText('Correctie: de opening is op dinsdag.', { exact: true }).waitFor();
    if (process.env.SALOON_REDACTIE_SCREENSHOT) await lees.screenshot({ path: process.env.SALOON_REDACTIE_SCREENSHOT });
    await lees.goto(srv.base + '/apps/krant.html?zaak=BODE#' + id);
    await lees.locator('article').getByText('Het plein gaat dinsdag open.', { exact: true }).waitFor();
    // Niet 'article summary': de desktopstandaard (#413) zet in de agendawidget een
    // eigen <details> "Week kiezen", ook in een <article>. Deze stap gaat over de
    // correctievouw van DIT krantenartikel, dus zoeken we hem in dat artikel.
    await lees.locator('article').filter({ hasText: 'Het plein gaat dinsdag open.' })
      .getByText('Correcties en actualiseringen', { exact: true }).click();
    await lees.locator('article').getByText('Correctie: de opening is op dinsdag.', { exact: true }).waitFor();
    assert.deepEqual(fouten, []);
  } finally { if (browser) await browser.close(); stop(srv?.child); fs.rmSync(tmp, { recursive: true, force: true }); }
});
