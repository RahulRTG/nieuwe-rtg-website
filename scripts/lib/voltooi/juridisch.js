'use strict';
const assert = require('node:assert/strict');
const { metScherm, toets } = require('../voltooischerm');
const docs = [['voorwaarden', 'Algemene voorwaarden'], ['privacy', 'Privacybeleid'], ['partnervoorwaarden', 'Partnervoorwaarden']];
const sc = {
  functie: 'link:juridisch', ingang: '/apps/juridisch.html', kanaal: 'browser',
  belofte: 'de bezoeker leest alle drie gepubliceerde documenten en keert terug; dezelfde publicatie blijft na herladen en serverherstel leesbaar',
  grens: 'publicatiecontinuïteit, geen opslag van persoonsgegevens, juridische inhoudsbeoordeling, offlinegarantie of menselijke Experience-beoordeling',
  async loop(w, stap) {
    await metScherm(w, sc, async ({ p, observeer, verslag }) => {
      const publicaties = new Map();
      await p.goto(w.basis + sc.ingang);
      await observeer('#hoofd .intro h1');
      assert.equal(await p.locator('#hoofd .intro h1').innerText(), 'Juridisch');
      for (const [naam, titel] of docs) {
        await toets(stap, 'voltooibaar', 'document via toetsenbord openen: ' + naam, async () => {
          await p.locator('.docs a[href="/apps/juridisch/' + naam + '.html"]').focus();
          await p.keyboard.press('Enter');
          await p.waitForURL('**/apps/juridisch/' + naam + '.html');
          await observeer('main > .wrap > h1');
          assert.equal(await p.locator('main > .wrap > h1').innerText(), titel);
          const inhoud = await p.locator('main > .wrap').innerText();
          assert.ok(inhoud.length > 500, 'geen lege publicatie');
          publicaties.set(naam, inhoud);
          return { titel, tekens: inhoud.length };
        });
        await toets(stap, 'persistent', 'publicatie na herladen: ' + naam, async () => {
          await p.reload();
          assert.equal(await p.locator('main > .wrap').innerText(), publicaties.get(naam));
        });
        await p.goBack();
        await p.waitForURL('**/apps/juridisch.html');
        await toets(stap, 'menselijk', 'terugkeer biedt leesbare documentkeuze: ' + naam, async () => {
          await observeer('#hoofd .intro h1');
          assert.equal(await p.locator('.docs a').count(), 3);
          assert.deepEqual(verslag.fouten, []);
          assert.deepEqual(verslag.documentfouten, []);
        });
      }
      for (const herstel of ['herstart', 'crash']) {
        await w[herstel]();
        await p.goto(w.basis + sc.ingang);
        for (const [naam, titel] of docs) {
          await toets(stap, herstel === 'herstart' ? 'persistent' : 'herstelbaar', herstel + ': volledige publicatie ' + naam, async () => {
            await p.locator('.docs a[href="/apps/juridisch/' + naam + '.html"]').click();
            await observeer('main > .wrap > h1');
            assert.equal(await p.locator('main > .wrap > h1').innerText(), titel);
            assert.equal(await p.locator('main > .wrap').innerText(), publicaties.get(naam));
            await p.goBack();
          });
        }
      }
      assert.deepEqual(verslag.fouten, []);
      assert.deepEqual(verslag.documentfouten, []);
    });
  }
};
module.exports = sc;
