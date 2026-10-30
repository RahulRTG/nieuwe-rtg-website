'use strict';
const assert = require('node:assert/strict');
const { nieuwLid } = require('../voltooiwereld');
const { metScherm, toets } = require('../voltooischerm');
const groepen = [['mini', 'RTF Mini'], ['kind', 'RTF Kids'], ['tiener', 'RTF Tiener'], ['jong', 'RTF Jong'], ['volw', 'RTF Volwassen']];
const sc = {
  functie: 'os:rtf', ingang: '/apps/app.html?pas=rtg', kanaal: 'browser',
  belofte: 'het lid kiest via Rahul een Foundation-leeftijdsgroep, bereikt de juiste toegangsstap en behoudt de lokale keuze bij terugkeer en serveruitval',
  grens: 'de keuzetaak van een RTG-lid zonder Foundation-gezin; intake-status is gefixt zoals in bestaande browsertests, geen kwalificatie van gezinsaanmaak of menselijke Experience-kwaliteit',
  async loop(w, stap) {
    const lid = await nieuwLid(w, 'rtfkeuze');
    await metScherm(w, sc, async ({ ctx, p, observeer, verslag }) => {
      await ctx.route('**/api/onboarding/status', r => r.fulfill({ status: 200,
        contentType: 'application/json', body: JSON.stringify({ klaar: true }) }));
      await ctx.addInitScript(token => {
        localStorage.setItem('rtg_member_token', token);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, lid.token);
      const open = async () => {
        await p.goto(w.basis + sc.ingang);
        await p.locator('.rtg-adaptive-item[aria-label="Praat met Rahul"]').click();
        const vraag = p.locator('input[placeholder^="Vraag Rahul"]:visible').first();
        await vraag.fill('open RTFoundation'); await vraag.press('Enter');
        await observeer('#osBelScrim.open');
        assert.equal(await p.locator('#osBelTitel').innerText(), 'RTFoundation');
        assert.equal(await p.locator('#osBelLijst button').count(), 5);
      };
      const keuze = naam => p.locator('#osBelLijst button').filter({ hasText: naam });
      const kies = async (groep, naam) => {
        await keuze(naam).click();
        await p.waitForURL('**/apps/foundation/index.html?groep=' + groep);
        await p.waitForFunction(g => localStorage.getItem('rtf_app_groep') === g, groep);
        assert.equal(await p.title(), naam);
      };
      const welkom = async () => {
        // De desktopwereld groepeert de bestaande gezinsbediening onder het
        // zichtbare overzicht. Open dat zoals een gebruiker, zonder DOM-ingreep.
        const overzicht = p.locator('#reisoverzicht');
        await overzicht.waitFor({ state: 'visible' });
        if (!await overzicht.evaluate(d => d.open)) await overzicht.locator(':scope > summary').click();
        await observeer('#vWelkom');
      };
      for (const [groep, naam] of groepen) {
        await toets(stap, 'voltooibaar', 'via Rahul naar ' + naam, async () => { await open(); await kies(groep, naam); });
        await toets(stap, 'menselijk', naam + ': zichtbare en bedienbare toegang zonder verzonnen gezin', async () => {
          await welkom();
          assert.match(await p.locator('#vWelkom h2').innerText(), /gezin/i);
          assert.ok(await p.locator('#bMaak').isVisible());
          assert.ok(await p.locator('#bMaak').isEnabled());
          assert.deepEqual(verslag.fouten, []);
          return { titel: await p.title(), vervolg: 'gezinswelkom' };
        });
        await toets(stap, 'persistent', naam + ': browsergeschiedenis en herladen behouden de keuze', async () => {
          await p.goBack(); await p.waitForURL('**/apps/app.html?pas=rtg');
          await p.goForward(); await p.waitForURL('**/apps/foundation/index.html?groep=' + groep);
          await p.reload();
          assert.equal(await p.evaluate(() => localStorage.getItem('rtf_app_groep')), groep);
          await open();
          assert.match(await keuze(naam).innerText(), /vorige keer/);
          assert.equal(await p.locator('#osBelLijst button').filter({ hasText: 'vorige keer' }).count(), 1);
        });
      }
      const origin = w.basis;
      for (const herstel of ['herstart', 'crash']) {
        await w[herstel]();
        const bewijs = herstel === 'herstart' ? 'persistent' : 'herstelbaar';
        await toets(stap, bewijs, herstel + ': bewaarde keuze op dezelfde origin', async () => {
          assert.equal(w.basis, origin); await open();
          assert.match(await keuze('RTF Volwassen').innerText(), /vorige keer/);
        });
        await toets(stap, bewijs, herstel + ': nieuwe bewuste keuze blijft mogelijk', async () => {
          await kies('mini', 'RTF Mini'); await open();
          assert.match(await keuze('RTF Mini').innerText(), /vorige keer/);
        });
        await toets(stap, bewijs, herstel + ': terugkeer naar de oorspronkelijke keuze', async () => {
          await kies('volw', 'RTF Volwassen'); await welkom();
          assert.deepEqual(verslag.fouten, []); assert.deepEqual(verslag.documentfouten, []);
        });
      }
    });
  }
};
module.exports = sc;
