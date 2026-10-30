'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { metScherm, toets } = require('../voltooischerm');
const { nepMediaArgs } = require('../../../test/helper');
const { monster, vergelijk, decodeer, bewegendBeeld, volgNetwerk } = require('../cameraproefbeeld');

async function opname(w, stap) {
  const toestelmap = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toestel-export-'));
  const exportpad = path.join(toestelmap, 'foto.jpg');
  try {
    await metScherm(w, sc, async ({ ctx, p, observeer, verslag, nieuwToestel }) => {
      const verzonden = [];
      volgNetwerk(ctx, () => w.basis, verzonden);
      let bronmaat, afmetingen, origineel, bytes;
      await toets(stap, 'voltooibaar', 'camerabeeld geeft opeenvolgende echte frames', async () => {
        await p.goto(w.basis + sc.ingang);
        await observeer('#beeld');
        bronmaat = await bewegendBeeld(p);
        return { bronmaat };
      });
      await toets(stap, 'voltooibaar', 'opname verschijnt als lokale foto in Studio', async () => {
        await p.locator('#sluiter').click();
        await p.locator('#duimpje').click();
        await observeer('#studio.aan');
        assert.match(await p.locator('#duimBeeld').getAttribute('src'), /^blob:/);
        afmetingen = await p.locator('#stDoek').evaluate(c => [c.width, c.height]);
        assert.ok(afmetingen.every(n => n > 0));
        origineel = await p.locator('#stDoek').evaluate(monster);
        return { preview: afmetingen };
      });
      await toets(stap, 'voltooibaar', 'export bevat gekozen beeld op volledige cameraresolutie', async () => {
        const wacht = p.waitForEvent('download');
        await p.locator('#stBewaar').click();
        await (await wacht).saveAs(exportpad);
        bytes = fs.readFileSync(exportpad);
        assert.ok(bytes.length > 1000);
        assert.deepEqual([...bytes.subarray(0, 3)], [255, 216, 255]);
        const foto = await decodeer(p, bytes);
        assert.deepEqual(foto.maat, bronmaat);
        vergelijk(origineel, foto.pixels, 'export bevat gekozen opname');
        assert.ok(Math.max(...foto.pixels) - Math.min(...foto.pixels) > 32, 'geen lege export');
        return { bytes: bytes.length, resolutie: foto.maat };
      });
      await toets(stap, 'menselijk', 'exportmelding noemt de daadwerkelijk gedownloade resolutie', async () => {
        assert.match(await p.locator('#stRahul').innerText(), new RegExp('Opgeslagen op volle resolutie \\(' + bronmaat[0] + '×' + bronmaat[1] + '\\)'));
        assert.deepEqual(verslag.fouten, []);
      });
      await toets(stap, 'persistent', 'gedownloade foto blijft na sluiten van browsercontext op toestel', async () => {
        await ctx.close();
        assert.deepEqual(fs.readFileSync(exportpad), bytes);
      });
      for (const herstel of ['herstart', 'crash']) {
        await w[herstel]();
        const nieuw = await nieuwToestel({ permissions: ['camera'], acceptDownloads: true });
        volgNetwerk(nieuw.ctx, () => w.basis, verzonden);
        const downloads = [];
        nieuw.p.on('download', d => downloads.push(d.suggestedFilename()));
        try {
          await toets(stap, 'persistent', herstel + ': lokale foto wordt intact in een nieuwe context heropend', async () => {
            assert.deepEqual(fs.readFileSync(exportpad), bytes);
            await nieuw.p.goto(w.basis + sc.ingang);
            await nieuw.observeer('#beeld');
            await nieuw.p.locator('#openBestand').setInputFiles(exportpad);
            await nieuw.observeer('#studio.aan');
            assert.deepEqual(await nieuw.p.locator('#stDoek').evaluate(c => [c.width, c.height]), afmetingen);
            vergelijk(origineel, await nieuw.p.locator('#stDoek').evaluate(monster), 'heropende opname');
          });
          await toets(stap, 'herstelbaar', herstel + ': sluiten zonder bewaren wijzigt noch downloadt de foto', async () => {
            await nieuw.p.locator('#stTerug').click();
            await nieuw.p.locator('#studio.aan').waitFor({ state: 'hidden' });
            // Nogmaals via de bestaande bestandsingang: de taak blijft bruikbaar
            // na annuleren; de waarneming loopt door tot deze handeling klaar is.
            await nieuw.p.locator('#openBestand').setInputFiles(exportpad);
            await nieuw.observeer('#studio.aan');
            vergelijk(origineel, await nieuw.p.locator('#stDoek').evaluate(monster), 'opnieuw geopend na annulering');
            await nieuw.p.locator('#stTerug').click();
            await nieuw.p.locator('#studio.aan').waitFor({ state: 'hidden' });
            assert.deepEqual(downloads, []);
            assert.deepEqual(fs.readFileSync(exportpad), bytes);
          });
        } finally { await nieuw.ctx.close(); }
      }
      await toets(stap, 'menselijk', 'opname en herstel eindigen zonder browserfout of verzendhandeling', async () => {
        assert.deepEqual(verzonden, [], 'geen externe bestemming, muterende HTTP- of WebSocket-handeling');
        assert.deepEqual(verslag.fouten, []);
        assert.deepEqual(verslag.documentfouten, []);
      });
    }, { args: nepMediaArgs(), context: { permissions: ['camera'], acceptDownloads: true } });
  } finally { fs.rmSync(toestelmap, { recursive: true, force: true }); }
}

async function weigering(w, stap) {
  await metScherm(w, sc, async ({ ctx, p, observeer }) => {
    const cdp = await ctx.newCDPSession(p);
    const { targetInfo } = await cdp.send('Target.getTargetInfo');
    await cdp.send('Browser.setPermission', { browserContextId: targetInfo.browserContextId,
      permission: { name: 'camera' }, setting: 'denied', origin: w.basis });
    await p.goto(w.basis + sc.ingang);
    await observeer('#geenCam.aan');
    await toets(stap, 'menselijk', 'native browserweigering geeft concrete reden en herstelhandeling', async () => {
      assert.equal(await p.evaluate(async () => (await navigator.permissions.query({ name: 'camera' })).state), 'denied');
      assert.match(await p.locator('#geenCamTekst').innerText(), /De browser houdt camera of microfoon tegen\./);
      assert.match(await p.locator('#geenCamTekst').innerText(), /slotje naast de adresbalk.*probeer het opnieuw/);
      assert.equal(await p.locator('#sluiter').isDisabled(), true);
      assert.ok(await p.locator('#probeerCamera').isEnabled());
    });
  }, { args: nepMediaArgs().filter(arg => arg !== '--use-fake-ui-for-media-stream') });
}

async function herprobeer(w, stap) {
  await metScherm(w, sc, async ({ ctx, p, observeer, verslag }) => {
    await ctx.addInitScript(() => {
      const echt = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      let geweigerd = false;
      navigator.mediaDevices.getUserMedia = wensen => {
        if (wensen.video && !geweigerd) {
          geweigerd = true;
          return Promise.reject(new DOMException('Testweigering op de mediagrens', 'NotAllowedError'));
        }
        return echt(wensen);
      };
    });
    await p.goto(w.basis + sc.ingang);
    await observeer('#geenCam.aan');
    await toets(stap, 'herstelbaar', 'zichtbare herprobeeractie herstelt na één ingespoten platformweigering', async () => {
      assert.equal(await p.locator('#sluiter').isDisabled(), true);
      await p.locator('#probeerCamera').click();
      await bewegendBeeld(p);
      await observeer('#beeld');
      assert.equal(await p.locator('#geenCam').evaluate(e => e.classList.contains('aan')), false);
      await p.locator('#sluiter').click();
      await observeer('#duimpje');
      assert.match(await p.locator('#duimBeeld').getAttribute('src'), /^blob:/);
      assert.deepEqual(verslag.fouten, []);
    });
  }, { args: nepMediaArgs(), context: { permissions: ['camera'] } });
}

const sc = {
  functie: 'link:camera', ingang: '/apps/camera.html', kanaal: 'browser',
  belofte: 'de bezoeker maakt lokaal een foto, exporteert haar naar het toestel en kan die na serveruitval opnieuw openen; weigering blijft begrijpelijk',
  grens: 'Chromium met synthetische camera; native weigering apart van ingespoten retry. Geen native grant-, mobiele hardware-, GET-exfiltratie- of menselijke Experience-kwalificatie. Niet-opgeslagen beelden hoeven niet te overleven.',
  async loop(w, stap) { await opname(w, stap); await weigering(w, stap); await herprobeer(w, stap); },
  proeven: { opname, weigering, herprobeer }
};
module.exports = sc;
