/* De zoekindex van de Toestelkluis in een ECHTE browser (TOESTEL.md par. 14).
   Zonder model: de vectoren zijn met de hand gemaakt, want wat hier bewezen
   moet worden is de INDEX -- dat hij alleen vectoren van dezelfde vingerafdruk
   vergelijkt, dat de kluis de waarheid is, en dat vergeten ook vergeten is. Wat
   een model ervan maakt, meet scripts/vectorproef.js. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kluisindex-'));

test('de kluisindex vergelijkt alleen gelijke vingerafdrukken, volgt de kluis en vergeet echt',
  { skip: geenBrowser(pw) }, async () => {
    const srv = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
    const browser = await pw.chromium.launch(browserOpties(pw));
    try {
      const page = await browser.newPage();
      await page.goto(srv.base + '/site/404.html');
      await page.addScriptTag({ url: '/shared/toestelkluis.js' });
      await page.addScriptTag({ url: '/shared/toestel/kluisindex.js' });
      const u = await page.evaluate(async () => {
        const K = window.Toestelkluis, I = window.RTGToestelKluisIndex, uit = {};
        const A = 'a'.repeat(64), B = 'b'.repeat(64);
        const v = (...x) => { const f = Float32Array.from(x), n = Math.hypot(...x); return f.map((y) => y / n); };
        for (const naam of ['vlucht.pdf', 'hotel.pdf', 'tandarts.pdf', 'recept.pdf'])
          await K.bewaar(naam, new Blob([naam]));
        uit.toe = await I.voegToe(A, [{ naam: 'vlucht.pdf', vector: v(1, 0, 0) }, { naam: 'hotel.pdf', vector: v(0, 1, 0) },
          { naam: 'tandarts.pdf', vector: v(0, 0, 1) }]);
        uit.zoek = await I.zoek(A, v(0.9, 0.1, 0), 2);
        uit.vormFout = await I.voegToe(A, [{ naam: 'x', vector: v(1, 0) }]);
        uit.ander = await I.zoek(B, v(1, 0, 0));
        await K.wis('hotel.pdf');
        uit.naWissen = await I.zoek(A, v(0, 1, 0), 5);
        uit.vergeet = await I.vergeet('tandarts.pdf');
        uit.naVergeten = await I.zoek(A, v(0, 0, 1), 5);
        uit.stand = await I.stand();
        uit.wis = await I.wis(A);
        uit.naWis = await I.zoek(A, v(1, 0, 0));
        return uit;
      });
      assert.deepEqual(u.toe, { ok: true, aantal: 3 });
      assert.deepEqual(u.zoek.treffers.map((t) => t.naam), ['vlucht.pdf', 'hotel.pdf']);
      assert.equal(u.zoek.zonderVector, 1, 'recept.pdf staat in de kluis zonder vector, en dat wordt gezegd');
      assert.equal(u.vormFout.ok, false);
      assert.equal(u.ander.ok, false);
      assert.equal(u.ander.stap, 'vingerafdruk', 'een vraag van een ander model wordt niet tegen deze index gehouden');
      assert.match(u.ander.reden, /ander model/);
      assert.equal(u.naWissen.weg, 1, 'een gewist document valt weg en wordt geteld');
      assert.ok(!u.naWissen.treffers.some((t) => t.naam === 'hotel.pdf'));
      assert.deepEqual(u.vergeet, { ok: true, indexen: 1 });
      assert.ok(!u.naVergeten.treffers.some((t) => t.naam === 'tandarts.pdf'));
      assert.equal(u.naVergeten.zonderVector, 2, 'vergeten laat het document staan maar zonder vector');
      assert.deepEqual(u.stand, [{ vingerafdruk: 'a'.repeat(64), dim: 3, aantal: 2 }]);
      assert.equal(u.naWis.ok, false);
    } finally {
      await browser.close();
      await stop(srv);
      fs.rmSync(TMP, { recursive: true, force: true });
    }
  });
